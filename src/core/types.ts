/**
 * @license
 * SPDX-License-Identifier: MIT
 * Core domain types and data contracts for DungeonForge Pro
 */

export type Direction = 'N' | 'S' | 'E' | 'W';

export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export enum CellType {
  VOID = 0,
  ROOM = 1,
  CORRIDOR = 2,
  CAVE = 3,
  BLOCKED = 4,
}

export type WallEdgeType = 'H' | 'V';

/**
 * Canonical Edge Representation:
 * - H (Horizontal edge): separates (x, y-1) and (x, y), line from (x, y) to (x+1, y)
 * - V (Vertical edge): separates (x-1, y) and (x, y), line from (x, y) to (x, y+1)
 * This eliminates double walls and guarantees canonical 1:1 mapping.
 */
export interface WallSegment {
  id: string; // e.g. "H:12:15" or "V:12:15"
  edgeType: WallEdgeType;
  x: number;
  y: number;
  cellA: Point; // Cell on one side
  cellB: Point; // Cell on the other side
  regionAId: string; // Region or room ID (or "exterior")
  regionBId: string; // Region or room ID (or "exterior")
  hasOpening: boolean;
  doorId?: string;
}

export interface Opening {
  id: string;
  wallSegmentId: string;
  edgeType: WallEdgeType;
  x: number;
  y: number;
  width: number; // in grid cells (default 1)
  regionAId: string;
  regionBId: string;
  doorId?: string;
}

export type DoorType =
  | 'archway'
  | 'single'
  | 'double'
  | 'locked'
  | 'secret'
  | 'trapped'
  | 'portcullis'
  | 'barred'
  | 'custom';

export type DoorState = 'open' | 'closed' | 'locked' | 'secret' | 'trapped' | 'barred';

export interface Door {
  id: string;
  openingId: string;
  wallSegmentId: string;
  x: number;
  y: number;
  orientation: 'horizontal' | 'vertical';
  type: DoorType;
  state: DoorState;
  width: number;
  connectsRegions: [string, string];
  keyId?: string;
  trapType?: string;
  discovered?: boolean;
}

export type RoomType =
  | 'entrance'
  | 'boss'
  | 'shrine'
  | 'armory'
  | 'library'
  | 'crypt'
  | 'prison'
  | 'treasury'
  | 'barracks'
  | 'laboratory'
  | 'dining_hall'
  | 'cavern_chamber'
  | 'standard';

export interface Room {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  type: RoomType;
  level: number;
  area: number;
  center: Point;
  doorIds: string[];
  itemIds: string[];
  color?: string;
  description?: string;
}

export interface Corridor {
  id: string;
  cells: Point[];
  width: number;
  connectedRoomIds: string[];
}

export type ItemType =
  | 'chest'
  | 'table'
  | 'chair'
  | 'bed'
  | 'bookshelf'
  | 'pillar'
  | 'altar'
  | 'trap_pit'
  | 'rubble'
  | 'statue'
  | 'well'
  | 'stairs_up'
  | 'stairs_down'
  | 'fountain'
  | 'torch'
  | 'sarcophagus';

export interface DungeonItem {
  id: string;
  roomId: string;
  type: ItemType;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number; // 0, 90, 180, 270
  blocksMovement: boolean;
  description?: string;
}

export interface GraphEdge {
  id: string;
  fromRegion: string;
  toRegion: string;
  doorId?: string;
  corridorId?: string;
  distance: number;
  isValid: boolean;
}

export type IssueSeverity = 'critical' | 'warning' | 'info';
export type IssueCategory = 'geometry' | 'doors' | 'connectivity' | 'navigation' | 'rendering';

export interface ValidationIssue {
  id: string;
  code: string;
  severity: IssueSeverity;
  category: IssueCategory;
  entityId?: string;
  coordinates?: Point;
  title: string;
  description: string;
  suggestedFix?: string;
}

export interface ValidationResult {
  isValid: boolean;
  criticalCount: number;
  warningCount: number;
  infoCount: number;
  issues: ValidationIssue[];
  isolatedRooms: string[];
  reachableRoomsCount: number;
  totalRoomsCount: number;
  navigablePathExists: boolean;
  timestamp: number;
}

export type ThemeName =
  | 'pergamino'
  | 'clasico'
  | 'piedra_oscura'
  | 'arquitectonico'
  | 'minimalista'
  | 'impresion';

export interface DungeonConfig {
  width: number;
  height: number;
  cellSize: number; // for rendering scale
  roomCountMin: number;
  roomCountMax: number;
  roomSizeMin: number;
  roomSizeMax: number;
  roomSeparation: number; // minimum distance between rooms
  corridorWidth: number;
  corridorWinding: number; // 0 to 1
  allowLoops: boolean; // extra connectivity
  doorDensity: number; // 0 to 1
  secretDoorChance: number; // 0 to 1
  lockedDoorChance: number; // 0 to 1
  itemDensity: number; // 0 to 1
  mapType: 'dungeon' | 'cavern' | 'hybrid';
  seed: string;
  theme: ThemeName;
  showGrid: boolean;
  showLabels: boolean;
  viewMode: 'gm' | 'player';
}

export interface DungeonModel {
  version: string;
  seed: string;
  config: DungeonConfig;
  grid: number[][]; // [y][x] with CellType
  gridRegionMap: string[][]; // [y][x] with roomId / corridorId / "exterior"
  rooms: Room[];
  corridors: Corridor[];
  wallSegments: Record<string, WallSegment>;
  openings: Opening[];
  doors: Door[];
  items: DungeonItem[];
  connections: GraphEdge[];
  validation: ValidationResult;
  stats: {
    generationTimeMs: number;
    roomAreaTotal: number;
    corridorAreaTotal: number;
    occupancyRatio: number;
    totalWalls: number;
    totalOpenings: number;
  };
}
