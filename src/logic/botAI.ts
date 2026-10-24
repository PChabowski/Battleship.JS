import { BOARD_SIZE, coordToIndices, indicesToCoord } from './gameRules';
import { ShotResult } from '../types';

export class BotAI {
  private firedCoords: Set<string> = new Set();
  private pendingQueue: string[] = [];
  private currentHitSeries: string[] = [];

  public reset() {
    this.firedCoords.clear();
    this.pendingQueue = [];
    this.currentHitSeries = [];
  }

  // Get next shot coordinate
  public getNextShot(): string {
    // 1. If we have targets in the priority queue from recent hits
    while (this.pendingQueue.length > 0) {
      const candidate = this.pendingQueue.shift()!;
      if (!this.firedCoords.has(candidate)) {
        this.firedCoords.add(candidate);
        return candidate;
      }
    }

    // 2. Parity / checkerboard hunt mode
    const allRemaining: string[] = [];
    const parityRemaining: string[] = [];

    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        const coord = indicesToCoord(r, c);
        if (!this.firedCoords.has(coord)) {
          allRemaining.push(coord);
          if ((r + c) % 2 === 0) {
            parityRemaining.push(coord);
          }
        }
      }
    }

    const pool = parityRemaining.length > 0 ? parityRemaining : allRemaining;
    if (pool.length === 0) {
      return 'A1';
    }

    const chosen = pool[Math.floor(Math.random() * pool.length)];
    this.firedCoords.add(chosen);
    return chosen;
  }

  // Process shot outcome
  public registerShotResult(result: ShotResult) {
    this.firedCoords.add(result.coordinate);

    if (result.isHit) {
      this.currentHitSeries.push(result.coordinate);

      if (result.isSunk) {
        // Sunk! Mark all buffer cells as visited/fired so bot never wastes shots around it
        if (result.bufferCoordinates) {
          for (const bufferCoord of result.bufferCoordinates) {
            this.firedCoords.add(bufferCoord);
          }
        }
        // Reset current hit hunting lock
        this.currentHitSeries = [];
        this.pendingQueue = this.pendingQueue.filter((c) => !this.firedCoords.has(c));
      } else {
        // Hit but not sunk: calculate next directional targets
        const adjacent = this.getOrthogonalNeighbors(result.coordinate);
        for (const neighbor of adjacent) {
          if (!this.firedCoords.has(neighbor) && !this.pendingQueue.includes(neighbor)) {
            // Prioritize along the confirmed line if 2+ hits exist
            if (this.currentHitSeries.length >= 2) {
              const aligned = this.isAligned(this.currentHitSeries, neighbor);
              if (aligned) {
                this.pendingQueue.unshift(neighbor);
                continue;
              }
            }
            this.pendingQueue.push(neighbor);
          }
        }
      }
    }
  }

  // Orthogonal neighbors (North, South, East, West only, since ships are straight)
  private getOrthogonalNeighbors(coord: string): string[] {
    const ind = coordToIndices(coord);
    if (!ind) return [];
    const { row, col } = ind;
    const neighbors: string[] = [];

    const deltas = [
      [-1, 0], // Góra
      [1, 0],  // Dół
      [0, -1], // Lewo
      [0, 1],  // Prawo
    ];

    for (const [dr, dc] of deltas) {
      const nr = row + dr;
      const nc = col + dc;
      if (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE) {
        neighbors.push(indicesToCoord(nr, nc));
      }
    }

    return neighbors;
  }

  // Check if candidate lies on the same row or column as the series
  private isAligned(series: string[], candidate: string): boolean {
    const indCand = coordToIndices(candidate);
    if (!indCand || series.length === 0) return false;

    const first = coordToIndices(series[0]);
    if (!first) return false;

    const isHorizontal = series.every((c) => coordToIndices(c)?.row === first.row);
    const isVertical = series.every((c) => coordToIndices(c)?.col === first.col);

    if (isHorizontal) return indCand.row === first.row;
    if (isVertical) return indCand.col === first.col;
    return true;
  }
}
