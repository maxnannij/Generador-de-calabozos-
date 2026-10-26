/**
 * @license
 * SPDX-License-Identifier: MIT
 * Master Procedural Dungeon Generator Pipeline
 */

import { CellType, DungeonConfig, DungeonModel, GraphEdge, Room } from './types';
import { PRNG } from './prng';
import { generateRooms } from './rooms';
import { buildRoomGraph } from './graph';
import { generateCorridors } from './corridors';
import { generateCaverns } from './caverns';
import { buildCanonicalWallSegments } from './walls';
import { generateDoors } from './doors';
import { generateItems } from './items';
import { validateDungeon } from './validator';

export function createDefaultConfig(overrides: Partial<DungeonConfig> = {}): DungeonConfig {
  return {
    width: 48,
    height: 36,
    cellSize: 24,
    roomCountMin: 7,
    roomCountMax: 12,
    roomSizeMin: 5,
    roomSizeMax: 11,
    roomSeparation: 2,
    corridorWidth: 1,
    corridorWinding: 0.35,
    allowLoops: true,
    doorDensity: 0.8,
    secretDoorChance: 0.12,
    lockedDoorChance: 0.18,
    itemDensity: 0.5,
    mapType: 'dungeon',
    seed: String(Math.floor(Math.random() * 900000) + 100000),
    theme: 'pergamino',
    showGrid: true,
    showLabels: true,
    viewMode: 'gm',
    ...overrides,
  };
}

export function generateDungeon(config: DungeonConfig): DungeonModel {
  const startTime = performance.now();
  const prng = new PRNG(config.seed);

  // Initialize empty grid & region maps
  const grid: number[][] = Array.from({ length: config.height }, () =>
    Array(config.width).fill(CellType.VOID)
  );

  const regionMap: string[][] = Array.from({ length: config.height }, () =>
    Array(config.width).fill('exterior')
  );

  let rooms: Room[] = [];
  let connections: GraphEdge[] = [];
  let corridors: any[] = [];

  if (config.mapType === 'cavern') {
    // 1. Organic Caverns Mode
    rooms = generateCaverns(config, prng.fork('cavern'), grid, regionMap);
    connections = buildRoomGraph(rooms, config.allowLoops, prng.fork('graph'));
  } else {
    // 2. Standard or Hybrid Dungeon Mode
    rooms = generateRooms(config, prng.fork('rooms'), grid, regionMap);
    connections = buildRoomGraph(rooms, config.allowLoops, prng.fork('graph'));
    corridors = generateCorridors(config, rooms, connections, grid, regionMap, prng.fork('corridors'));
  }

  // 3. Build canonical wall segments across all shared and exterior boundaries
  const wallSegments = buildCanonicalWallSegments(
    grid,
    regionMap,
    config.width,
    config.height
  );

  // 4. Place doors strictly on verified canonical wall segments with valid transitable sides
  const { doors, openings } = generateDoors(
    config,
    rooms,
    wallSegments,
    connections,
    grid,
    regionMap,
    prng.fork('doors')
  );

  // 5. Place interior props & items with door swing clearance & collision detection
  const doorPositions = doors.map((d) => ({ x: d.x, y: d.y }));
  const items = generateItems(config, rooms, doorPositions, prng.fork('items'));

  // Calculate statistics
  let roomAreaTotal = 0;
  for (const r of rooms) roomAreaTotal += r.area;

  let corridorAreaTotal = 0;
  for (let y = 0; y < config.height; y++) {
    for (let x = 0; x < config.width; x++) {
      if (grid[y][x] === CellType.CORRIDOR) corridorAreaTotal++;
    }
  }

  const occupancyRatio = (roomAreaTotal + corridorAreaTotal) / (config.width * config.height);

  const rawModel: DungeonModel = {
    version: '1.0.0',
    seed: String(config.seed),
    config: { ...config },
    grid,
    gridRegionMap: regionMap,
    rooms,
    corridors,
    wallSegments,
    openings,
    doors,
    items,
    connections,
    validation: {
      isValid: true,
      criticalCount: 0,
      warningCount: 0,
      infoCount: 0,
      issues: [],
      isolatedRooms: [],
      reachableRoomsCount: rooms.length,
      totalRoomsCount: rooms.length,
      navigablePathExists: true,
      timestamp: Date.now(),
    },
    stats: {
      generationTimeMs: 0,
      roomAreaTotal,
      corridorAreaTotal,
      occupancyRatio,
      totalWalls: Object.keys(wallSegments).length,
      totalOpenings: openings.length,
    },
  };

  // 6. Run automated validation
  const validation = validateDungeon(rawModel);
  rawModel.validation = validation;

  const endTime = performance.now();
  rawModel.stats.generationTimeMs = Math.round((endTime - startTime) * 10) / 10;

  return rawModel;
}
