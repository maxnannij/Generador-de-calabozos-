/**
 * @license
 * SPDX-License-Identifier: MIT
 * Geometric algorithms and canonical coordinate helpers
 */

import { Point, Rect, WallEdgeType } from './types';

export function getHorizontalEdgeId(x: number, y: number): string {
  return `H:${x}:${y}`;
}

export function getVerticalEdgeId(x: number, y: number): string {
  return `V:${x}:${y}`;
}

export function parseEdgeId(id: string): { edgeType: WallEdgeType; x: number; y: number } {
  const parts = id.split(':');
  if (parts.length !== 3 || (parts[0] !== 'H' && parts[0] !== 'V')) {
    throw new Error(`Invalid edge ID format: "${id}". Expected H:x:y or V:x:y`);
  }
  return {
    edgeType: parts[0] as WallEdgeType,
    x: parseInt(parts[1], 10),
    y: parseInt(parts[2], 10),
  };
}

export function manhattanDistance(a: Point, b: Point): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

export function euclideanDistance(a: Point, b: Point): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

export function isPointInsideRect(p: Point, r: Rect): boolean {
  return p.x >= r.x && p.x < r.x + r.width && p.y >= r.y && p.y < r.y + r.height;
}

export function doRectsOverlap(a: Rect, b: Rect, margin: number = 0): boolean {
  return (
    a.x - margin < b.x + b.width &&
    a.x + a.width + margin > b.x &&
    a.y - margin < b.y + b.height &&
    a.y + a.height + margin > b.y
  );
}

export function isRectWithinBounds(r: Rect, mapWidth: number, mapHeight: number, margin: number = 1): boolean {
  return (
    r.x >= margin &&
    r.y >= margin &&
    r.x + r.width <= mapWidth - margin &&
    r.y + r.height <= mapHeight - margin
  );
}

/**
 * Returns cardinal 4-way neighbors of a cell
 */
export function get4Neighbors(p: Point, width: number, height: number): { point: Point; dir: 'N' | 'S' | 'E' | 'W' }[] {
  const neighbors: { point: Point; dir: 'N' | 'S' | 'E' | 'W' }[] = [];
  if (p.y > 0) neighbors.push({ point: { x: p.x, y: p.y - 1 }, dir: 'N' });
  if (p.y < height - 1) neighbors.push({ point: { x: p.x, y: p.y + 1 }, dir: 'S' });
  if (p.x < width - 1) neighbors.push({ point: { x: p.x + 1, y: p.y }, dir: 'E' });
  if (p.x > 0) neighbors.push({ point: { x: p.x - 1, y: p.y }, dir: 'W' });
  return neighbors;
}

/**
 * Returns all 8 neighbors (cardinal + diagonal)
 */
export function get8Neighbors(p: Point, width: number, height: number): Point[] {
  const res: Point[] = [];
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const nx = p.x + dx;
      const ny = p.y + dy;
      if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
        res.push({ x: nx, y: ny });
      }
    }
  }
  return res;
}
