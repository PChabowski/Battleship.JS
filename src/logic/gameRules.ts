import { PlacedShip, ShipBlueprint, ShotResult, Orientation } from '../types';

export const BOARD_SIZE = 10;
export const ROWS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
export const COLS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];

export const FLEET_BLUEPRINT: ShipBlueprint[] = [
  { type: '4-masztowiec', name: 'Czteromasztowiec', size: 4, count: 1 },
  { type: '3-masztowiec', name: 'Trójmasztowiec', size: 3, count: 2 },
  { type: '2-masztowiec', name: 'Dwumasztowiec', size: 2, count: 3 },
  { type: '1-masztowiec', name: 'Jednomasztowiec', size: 1, count: 4 },
];

export const TOTAL_SHIPS_COUNT = FLEET_BLUEPRINT.reduce((acc, ship) => acc + ship.count, 0); // 10 okrętów

// Coordinate converters: "A1" <-> { row: 0, col: 0 }
export function coordToIndices(coord: string): { row: number; col: number } | null {
  if (!coord || coord.length < 2 || coord.length > 3) return null;
  const letter = coord.charAt(0).toUpperCase();
  const numStr = coord.slice(1);

  const row = ROWS.indexOf(letter);
  const colIndex = parseInt(numStr, 10) - 1; // 1-10 -> 0-9

  if (row < 0 || row >= BOARD_SIZE || isNaN(colIndex) || colIndex < 0 || colIndex >= BOARD_SIZE) {
    return null;
  }
  return { row, col: colIndex };
}

export function indicesToCoord(row: number, col: number): string {
  if (row < 0 || row >= BOARD_SIZE || col < 0 || col >= BOARD_SIZE) return '';
  return `${ROWS[row]}${col + 1}`;
}

// Returns all 8 surrounding neighbor coordinates within board bounds
export function getSurroundingCoordinates(coord: string): string[] {
  const indices = coordToIndices(coord);
  if (!indices) return [];

  const { row, col } = indices;
  const neighbors: string[] = [];

  for (let r = row - 1; r <= row + 1; r++) {
    for (let c = col - 1; c <= col + 1; c++) {
      if (r === row && c === col) continue;
      if (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE) {
        neighbors.push(indicesToCoord(r, c));
      }
    }
  }

  return neighbors;
}

// Returns the full 1-cell buffer around all ship segments (excluding the ship cells themselves)
export function getShipBufferZone(coordinates: string[]): string[] {
  const bufferSet = new Set<string>();
  const shipSet = new Set(coordinates);

  for (const coord of coordinates) {
    const surrounding = getSurroundingCoordinates(coord);
    for (const neighbor of surrounding) {
      if (!shipSet.has(neighbor)) {
        bufferSet.add(neighbor);
      }
    }
  }

  return Array.from(bufferSet);
}

// Generate coordinate array for a ship candidate
export function calculateShipCoordinates(
  startRow: number,
  startCol: number,
  size: number,
  orientation: Orientation
): string[] | null {
  const coords: string[] = [];

  if (orientation === 'horizontal') {
    if (startCol + size > BOARD_SIZE) return null;
    for (let i = 0; i < size; i++) {
      coords.push(indicesToCoord(startRow, startCol + i));
    }
  } else {
    if (startRow + size > BOARD_SIZE) return null;
    for (let i = 0; i < size; i++) {
      coords.push(indicesToCoord(startRow + i, startCol));
    }
  }

  return coords;
}

// Check if candidate coordinates comply with the "no touching even by corners" rule
export function canPlaceShip(
  candidateCoords: string[],
  existingShips: PlacedShip[],
  ignoreShipId?: string
): { valid: boolean; reason?: string } {
  if (!candidateCoords || candidateCoords.length === 0) {
    return { valid: false, reason: 'Brak współrzędnych' };
  }

  // Check bounds
  for (const coord of candidateCoords) {
    const ind = coordToIndices(coord);
    if (!ind) {
      return { valid: false, reason: 'Okręt wychodzi poza krawędź planszy' };
    }
  }

  // Filter existing ships if we're repositioning an existing one
  const relevantShips = ignoreShipId
    ? existingShips.filter((s) => s.id !== ignoreShipId)
    : existingShips;

  // Build forbidden zone = all existing ship cells + their 8-neighbor buffers
  const forbiddenSet = new Set<string>();
  for (const ship of relevantShips) {
    for (const c of ship.coordinates) {
      forbiddenSet.add(c);
      for (const neighbor of getSurroundingCoordinates(c)) {
        forbiddenSet.add(neighbor);
      }
    }
  }

  // Check if any candidate coord touches or overlaps the forbidden zone
  for (const coord of candidateCoords) {
    if (forbiddenSet.has(coord)) {
      return {
        valid: false,
        reason: 'Okręty nie mogą się stykać nawet rogami!',
      };
    }
  }

  return { valid: true };
}

// Generates a complete legal random 10-ship fleet
export function generateRandomFleet(): PlacedShip[] {
  const ships: PlacedShip[] = [];
  let shipIdCounter = 1;

  for (const blueprint of FLEET_BLUEPRINT) {
    for (let count = 0; count < blueprint.count; count++) {
      let placed = false;
      let attempts = 0;

      while (!placed && attempts < 2000) {
        attempts++;
        const orientation: Orientation = Math.random() < 0.5 ? 'horizontal' : 'vertical';
        const startRow = Math.floor(Math.random() * BOARD_SIZE);
        const startCol = Math.floor(Math.random() * BOARD_SIZE);

        const candidateCoords = calculateShipCoordinates(
          startRow,
          startCol,
          blueprint.size,
          orientation
        );

        if (candidateCoords && canPlaceShip(candidateCoords, ships).valid) {
          ships.push({
            id: `ship_${shipIdCounter++}`,
            type: blueprint.type,
            name: blueprint.name,
            size: blueprint.size,
            orientation,
            coordinates: candidateCoords,
            hits: [],
            isSunk: false,
          });
          placed = true;
        }
      }

      if (!placed) {
        // In rare edge case of deadlock, restart fleet generation
        return generateRandomFleet();
      }
    }
  }

  return ships;
}

// Process a shot on a fleet
export function processShot(
  targetCoord: string,
  targetShips: PlacedShip[]
): ShotResult {
  let hit = false;
  let sunk = false;
  let sunkShip: PlacedShip | undefined;
  let bufferCoordinates: string[] = [];
  let message = 'Spudłowałeś';

  for (const ship of targetShips) {
    if (ship.coordinates.includes(targetCoord)) {
      hit = true;
      if (!ship.hits.includes(targetCoord)) {
        ship.hits.push(targetCoord);
      }

      if (ship.hits.length === ship.size) {
        ship.isSunk = true;
        sunk = true;
        sunkShip = ship;
        bufferCoordinates = getShipBufferZone(ship.coordinates);
        message = `Zatopiłeś ${ship.name}!`;
      } else {
        message = 'TRAFIONY!';
      }
      break;
    }
  }

  return {
    coordinate: targetCoord,
    isHit: hit,
    isSunk: sunk,
    sunkShip,
    bufferCoordinates,
    message,
  };
}

// Parse user text input (e.g. "a5", "A05", "J10")
export function parseUserInputCoordinate(input: string): { coord: string | null; error: string | null } {
  const trimmed = input.trim().toUpperCase();
  if (!trimmed) {
    return { coord: null, error: 'Wpisz pole, np. A1 lub J10' };
  }

  // Handle format like "A5" or "05" or "A0"
  const match = trimmed.match(/^([A-J])\s*([0-9]|10)$/);
  if (!match) {
    return { coord: null, error: 'Nieprawidłowe współrzędne! Użyj formatu A-J i 1-10 (np. B4).' };
  }

  const letter = match[1];
  let num = parseInt(match[2], 10);
  if (num === 0) num = 10; // Support 0 as 10 or clamp

  if (num < 1 || num > 10) {
    return { coord: null, error: 'Kolumna musi mieścić się w przedziale 1–10.' };
  }

  return { coord: `${letter}${num}`, error: null };
}
