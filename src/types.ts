export type Orientation = 'horizontal' | 'vertical';

export type ShipType = '4-masztowiec' | '3-masztowiec' | '2-masztowiec' | '1-masztowiec';

export interface ShipBlueprint {
  type: ShipType;
  name: string;
  size: number;
  count: number;
}

export interface PlacedShip {
  id: string;
  type: ShipType;
  name: string;
  size: number;
  orientation: Orientation;
  coordinates: string[]; // e.g. ["A1", "A2", "A3", "A4"]
  hits: string[];
  isSunk: boolean;
}

export type CellState = 'empty' | 'ship' | 'hit' | 'miss' | 'sunk' | 'buffer';

export interface ShotResult {
  coordinate: string;
  isHit: boolean;
  isSunk: boolean;
  sunkShip?: PlacedShip;
  bufferCoordinates?: string[];
  message: string;
}

export type GameMode = 'menu' | 'placement' | 'battle' | 'gameover';
export type MatchType = 'singleplayer' | 'multiplayer';

export interface PlayerStats {
  guesses: number;
  hits: number;
  misses: number;
  shipsSunk: number;
}
