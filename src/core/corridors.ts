/**
 * @license
 * SPDX-License-Identifier: MIT
 * Corridor generation using A* pathfinding with turn penalization and junction merging
 */

import { CellType, Corridor, DungeonConfig, GraphEdge, Point, Room } from './types';
import { get4Neighbors, manhattanDistance } from './geometry';
import { PRNG } from './prng';

interface AStarNode {
  p: Point;
  g: number;
  f: number;
  parent?: AStarNode;
  dir?: 'N' | 'S' | 'E' | 'W';
}

function findBestConnectionPoints(
  roomA: Room,
  roomB: Room,
  grid: number[][],
  mapWidth: number,
  mapHeight: number,
  prng: PRNG
): { start: Point; end: Point } {
  const candidatesA: Point[] = [];
  const candidatesB: Point[] = [];

  // Candidate cells 1 step outside room perimeter that are VOID or CORRIDOR (never inside another room)
  // Room A candidate walls:
  // North
  if (roomA.y > 1) {
    for (let x = roomA.x + 1; x < roomA.x + roomA.width - 1; x++) {
      if (grid[roomA.y - 1][x] !== CellType.ROOM) {
        candidatesA.push({ x, y: roomA.y - 1 });
      }
    }
  }
  // South
  if (roomA.y + roomA.height < mapHeight - 2) {
    for (let x = roomA.x + 1; x < roomA.x + roomA.width - 1; x++) {
      if (grid[roomA.y + roomA.height][x] !== CellType.ROOM) {
        candidatesA.push({ x, y: roomA.y + roomA.height });
      }
    }
  }
  // West
  if (roomA.x > 1) {
    for (let y = roomA.y + 1; y < roomA.y + roomA.height - 1; y++) {
      if (grid[y][roomA.x - 1] !== CellType.ROOM) {
        candidatesA.push({ x: roomA.x - 1, y });
      }
    }
  }
  // East
  if (roomA.x + roomA.width < mapWidth - 2) {
    for (let y = roomA.y + 1; y < roomA.y + roomA.height - 1; y++) {
      if (grid[y][roomA.x + roomA.width] !== CellType.ROOM) {
        candidatesA.push({ x: roomA.x + roomA.width, y });
      }
    }
  }

  // Room B candidate walls:
  // North
  if (roomB.y > 1) {
    for (let x = roomB.x + 1; x < roomB.x + roomB.width - 1; x++) {
      if (grid[roomB.y - 1][x] !== CellType.ROOM) {
        candidatesB.push({ x, y: roomB.y - 1 });
      }
    }
  }
  // South
  if (roomB.y + roomB.height < mapHeight - 2) {
    for (let x = roomB.x + 1; x < roomB.x + roomB.width - 1; x++) {
      if (grid[roomB.y + roomB.height][x] !== CellType.ROOM) {
        candidatesB.push({ x, y: roomB.y + roomB.height });
      }
    }
  }
  // West
  if (roomB.x > 1) {
    for (let y = roomB.y + 1; y < roomB.y + roomB.height - 1; y++) {
      if (grid[y][roomB.x - 1] !== CellType.ROOM) {
        candidatesB.push({ x: roomB.x - 1, y });
      }
    }
  }
  // East
  if (roomB.x + roomB.width < mapWidth - 2) {
    for (let y = roomB.y + 1; y < roomB.y + roomB.height - 1; y++) {
      if (grid[y][roomB.x + roomB.width] !== CellType.ROOM) {
        candidatesB.push({ x: roomB.x + roomB.width, y });
      }
    }
  }

  if (candidatesA.length === 0) candidatesA.push(roomA.center);
  if (candidatesB.length === 0) candidatesB.push(roomB.center);

  candidatesA.sort((a, b) => manhattanDistance(a, roomB.center) - manhattanDistance(b, roomB.center));
  candidatesB.sort((a, b) => manhattanDistance(a, roomA.center) - manhattanDistance(b, roomA.center));

  const topA = candidatesA.slice(0, Math.min(3, candidatesA.length));
  const topB = candidatesB.slice(0, Math.min(3, candidatesB.length));

  return {
    start: prng.choice(topA),
    end: prng.choice(topB),
  };
}

export function findAStarPath(
  start: Point,
  target: Point,
  grid: number[][],
  regionMap: string[][],
  mapWidth: number,
  mapHeight: number,
  windingPenalty: number
): Point[] | null {
  const openSet: Map<string, AStarNode> = new Map();
  const closedSet: Set<string> = new Set();

  const startKey = `${start.x},${start.y}`;
  const targetKey = `${target.x},${target.y}`;

  if (startKey === targetKey) {
    return [start];
  }

  const startNode: AStarNode = {
    p: start,
    g: 0,
    f: manhattanDistance(start, target),
  };
  openSet.set(startKey, startNode);

  let iterations = 0;
  const maxIterations = 8000;

  while (openSet.size > 0 && iterations < maxIterations) {
    iterations++;

    let currentKey = '';
    let currentNode: AStarNode | null = null;
    for (const [k, n] of openSet.entries()) {
      if (!currentNode || n.f < currentNode.f) {
        currentNode = n;
        currentKey = k;
      }
    }

    if (!currentNode) break;

    if (currentKey === targetKey) {
      const path: Point[] = [];
      let curr: AStarNode | undefined = currentNode;
      while (curr) {
        path.unshift(curr.p);
        curr = curr.parent;
      }
      return path;
    }

    openSet.delete(currentKey);
    closedSet.add(currentKey);

    const neighbors = get4Neighbors(currentNode.p, mapWidth, mapHeight);
    for (const neighbor of neighbors) {
      const np = neighbor.point;
      const nKey = `${np.x},${np.y}`;

      if (closedSet.has(nKey)) continue;

      const cellType = grid[np.y][np.x];

      // A* MUST NOT enter inside any room! Corridors live strictly in exterior / void / corridor space!
      if (cellType === CellType.ROOM || cellType === CellType.BLOCKED) {
        continue;
      }

      let moveCost = cellType === CellType.CORRIDOR ? 1.0 : 2.0;
      if (currentNode.dir && currentNode.dir !== neighbor.dir) {
        moveCost += windingPenalty * 1.5;
      }

      const tentativeG = currentNode.g + moveCost;
      const existingOpen = openSet.get(nKey);

      if (!existingOpen || tentativeG < existingOpen.g) {
        const neighborNode: AStarNode = {
          p: np,
          g: tentativeG,
          f: tentativeG + manhattanDistance(np, target),
          parent: currentNode,
          dir: neighbor.dir,
        };
        openSet.set(nKey, neighborNode);
      }
    }
  }

  return null;
}

export function generateCorridors(
  config: DungeonConfig,
  rooms: Room[],
  edges: GraphEdge[],
  grid: number[][],
  regionMap: string[][],
  prng: PRNG
): Corridor[] {
  const corridors: Corridor[] = [];
  const roomMap = new Map<string, Room>();
  for (const r of rooms) {
    roomMap.set(r.id, r);
  }

  let corridorIndex = 1;

  for (const edge of edges) {
    const roomA = roomMap.get(edge.fromRegion);
    const roomB = roomMap.get(edge.toRegion);
    if (!roomA || !roomB) continue;

    const { start, end } = findBestConnectionPoints(
      roomA,
      roomB,
      grid,
      config.width,
      config.height,
      prng
    );

    const path = findAStarPath(
      start,
      end,
      grid,
      regionMap,
      config.width,
      config.height,
      config.corridorWinding
    );

    if (path && path.length > 0) {
      const corridorId = `corridor_${corridorIndex++}`;
      edge.corridorId = corridorId;

      const corridorCells: Point[] = [];

      for (const p of path) {
        if (grid[p.y][p.x] !== CellType.ROOM) {
          grid[p.y][p.x] = CellType.CORRIDOR;
          if (regionMap[p.y][p.x] === 'exterior' || !regionMap[p.y][p.x]) {
            regionMap[p.y][p.x] = corridorId;
          }
          corridorCells.push(p);
        }
      }

      if (config.corridorWidth > 1) {
        const extraCells: Point[] = [];
        for (const p of corridorCells) {
          const neighbors = get4Neighbors(p, config.width, config.height);
          for (const n of neighbors) {
            if (
              grid[n.point.y][n.point.x] === CellType.VOID &&
              regionMap[n.point.y][n.point.x] === 'exterior'
            ) {
              let touchesOtherRoom = false;
              for (const n2 of get4Neighbors(n.point, config.width, config.height)) {
                if (grid[n2.point.y][n2.point.x] === CellType.ROOM) {
                  touchesOtherRoom = true;
                  break;
                }
              }
              if (!touchesOtherRoom) {
                grid[n.point.y][n.point.x] = CellType.CORRIDOR;
                regionMap[n.point.y][n.point.x] = corridorId;
                extraCells.push(n.point);
              }
            }
          }
        }
        corridorCells.push(...extraCells);
      }

      corridors.push({
        id: corridorId,
        cells: corridorCells,
        width: config.corridorWidth,
        connectedRoomIds: [roomA.id, roomB.id],
      });
    }
  }

  return corridors;
}
