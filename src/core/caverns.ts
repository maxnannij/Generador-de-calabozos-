/**
 * @license
 * SPDX-License-Identifier: MIT
 * Cellular Automata organic cavern generation mode
 */

import { CellType, DungeonConfig, Point, Room } from './types';
import { PRNG } from './prng';
import { get8Neighbors, manhattanDistance } from './geometry';

export function generateCaverns(
  config: DungeonConfig,
  prng: PRNG,
  grid: number[][],
  regionMap: string[][]
): Room[] {
  const width = config.width;
  const height = config.height;

  // 1. Initial randomized noise grid (45% open, 55% wall)
  const map: boolean[][] = Array.from({ length: height }, () =>
    Array(width).fill(false)
  );

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      map[y][x] = prng.boolean(0.48);
    }
  }

  // 2. Cellular Automata simulation (4 iterations of 4-5 rule)
  const iterations = 4;
  for (let it = 0; it < iterations; it++) {
    const nextMap = map.map((row) => [...row]);
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        let wallCount = 0;
        for (const n of get8Neighbors({ x, y }, width, height)) {
          if (!map[n.y][n.x]) wallCount++;
        }
        // If 5 or more neighbors are walls, cell becomes wall
        if (wallCount >= 5) {
          nextMap[y][x] = false;
        } else {
          nextMap[y][x] = true;
        }
      }
    }
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        map[y][x] = nextMap[y][x];
      }
    }
  }

  // 3. Flood-fill to find connected cave regions
  const visited: boolean[][] = Array.from({ length: height }, () =>
    Array(width).fill(false)
  );
  const chambers: Point[][] = [];

  for (let y = 2; y < height - 2; y++) {
    for (let x = 2; x < width - 2; x++) {
      if (map[y][x] && !visited[y][x]) {
        const chamber: Point[] = [];
        const queue: Point[] = [{ x, y }];
        visited[y][x] = true;

        while (queue.length > 0) {
          const curr = queue.shift()!;
          chamber.push(curr);

          const neighbors = [
            { x: curr.x + 1, y: curr.y },
            { x: curr.x - 1, y: curr.y },
            { x: curr.x, y: curr.y + 1 },
            { x: curr.x, y: curr.y - 1 },
          ];

          for (const n of neighbors) {
            if (
              n.x >= 1 &&
              n.x < width - 1 &&
              n.y >= 1 &&
              n.y < height - 1 &&
              map[n.y][n.x] &&
              !visited[n.y][n.x]
            ) {
              visited[n.y][n.x] = true;
              queue.push(n);
            }
          }
        }

        // Only keep chambers with at least 15 cells; fill smaller pockets
        if (chamber.length >= 15) {
          chambers.push(chamber);
        } else {
          for (const p of chamber) {
            map[p.y][p.x] = false;
          }
        }
      }
    }
  }

  // Sort chambers by size descending
  chambers.sort((a, b) => b.length - a.length);

  // Keep top N chambers
  const activeChambers = chambers.slice(0, Math.min(6, chambers.length));

  // 4. Carve natural connecting tunnels between adjacent chambers
  for (let i = 0; i < activeChambers.length - 1; i++) {
    const c1 = activeChambers[i];
    const c2 = activeChambers[i + 1];

    // Find two closest points
    let bestP1 = c1[0];
    let bestP2 = c2[0];
    let minD = Infinity;

    for (const p1 of c1) {
      for (const p2 of c2) {
        const d = manhattanDistance(p1, p2);
        if (d < minD) {
          minD = d;
          bestP1 = p1;
          bestP2 = p2;
        }
      }
    }

    // Carve corridor between them with 2-cell radius
    let cx = bestP1.x;
    let cy = bestP1.y;

    while (cx !== bestP2.x || cy !== bestP2.y) {
      if (cx !== bestP2.x) {
        cx += cx < bestP2.x ? 1 : -1;
      } else if (cy !== bestP2.y) {
        cy += cy < bestP2.y ? 1 : -1;
      }
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx > 1 && nx < width - 2 && ny > 1 && ny < height - 2) {
            map[ny][nx] = true;
          }
        }
      }
    }
  }

  // 5. Transfer to DungeonForge logical Room & Grid representations
  const rooms: Room[] = [];
  activeChambers.forEach((chamber, idx) => {
    const roomId = `cave_chamber_${idx + 1}`;
    let minX = width;
    let maxX = 0;
    let minY = height;
    let maxY = 0;

    for (const p of chamber) {
      grid[p.y][p.x] = CellType.CAVE;
      regionMap[p.y][p.x] = roomId;
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }

    const rWidth = maxX - minX + 1;
    const rHeight = maxY - minY + 1;

    rooms.push({
      id: roomId,
      name: idx === 0 ? 'Entrada a la Gruta' : `Cámara Cavernosa ${idx + 1}`,
      x: minX,
      y: minY,
      width: rWidth,
      height: rHeight,
      type: 'cavern_chamber',
      level: 1,
      area: chamber.length,
      center: {
        x: Math.floor((minX + maxX) / 2),
        y: Math.floor((minY + maxY) / 2),
      },
      doorIds: [],
      itemIds: [],
    });
  });

  // Write remaining carved pathways as CORRIDOR cells
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (map[y][x] && grid[y][x] === CellType.VOID) {
        grid[y][x] = CellType.CORRIDOR;
        regionMap[y][x] = 'cave_passage';
      }
    }
  }

  return rooms;
}
