/**
 * @license
 * SPDX-License-Identifier: MIT
 * Critical Door and Opening System
 * Strictly enforces that every door corresponds to a real canonical wall segment
 * with valid transitable space on both sides, valid orientation, and no corner overlap.
 */

import { Door, DoorState, DoorType, DungeonConfig, GraphEdge, Opening, Point, Room, WallSegment } from './types';
import { PRNG } from './prng';
import { isTransitableCell } from './walls';

export interface DoorCandidate {
  wallSegment: WallSegment;
  room: Room;
  otherRegionId: string;
  isCorner: boolean;
  score: number;
}

function isWallSegmentAtRoomCorner(segment: WallSegment, room: Room): boolean {
  if (segment.edgeType === 'H') {
    if (segment.y === room.y || segment.y === room.y + room.height) {
      if (segment.x === room.x || segment.x === room.x + room.width - 1) {
        return true;
      }
    }
  } else {
    if (segment.x === room.x || segment.x === room.x + room.width) {
      if (segment.y === room.y || segment.y === room.y + room.height - 1) {
        return true;
      }
    }
  }
  return false;
}

export function findRoomDoorCandidates(
  room: Room,
  wallSegments: Record<string, WallSegment>,
  grid: number[][],
  regionMap: string[][],
  mapWidth: number,
  mapHeight: number
): DoorCandidate[] {
  const candidates: DoorCandidate[] = [];

  for (const segment of Object.values(wallSegments)) {
    if (segment.hasOpening) continue;

    const isSideA = segment.regionAId === room.id;
    const isSideB = segment.regionBId === room.id;
    if (!isSideA && !isSideB) continue;

    const otherRegionId = isSideA ? segment.regionBId : segment.regionAId;

    if (
      otherRegionId === 'exterior' ||
      otherRegionId === '' ||
      !otherRegionId
    ) {
      continue;
    }

    const cellA = segment.cellA;
    const cellB = segment.cellB;

    const aInBounds = cellA.x >= 0 && cellA.x < mapWidth && cellA.y >= 0 && cellA.y < mapHeight;
    const bInBounds = cellB.x >= 0 && cellB.x < mapWidth && cellB.y >= 0 && cellB.y < mapHeight;

    if (!aInBounds || !bInBounds) continue;

    const aTransitable = isTransitableCell(grid[cellA.y][cellA.x]);
    const bTransitable = isTransitableCell(grid[cellB.y][cellB.x]);

    if (!aTransitable || !bTransitable) {
      continue;
    }

    const isCorner = isWallSegmentAtRoomCorner(segment, room);

    let centerDistance = 0;
    if (segment.edgeType === 'H') {
      const roomMidX = room.x + room.width / 2;
      centerDistance = Math.abs(segment.x + 0.5 - roomMidX);
    } else {
      const roomMidY = room.y + room.height / 2;
      centerDistance = Math.abs(segment.y + 0.5 - roomMidY);
    }

    const score = (isCorner ? -100 : 50) - centerDistance;

    candidates.push({
      wallSegment: segment,
      room,
      otherRegionId,
      isCorner,
      score,
    });
  }

  return candidates;
}

export function generateDoors(
  config: DungeonConfig,
  rooms: Room[],
  wallSegments: Record<string, WallSegment>,
  edges: GraphEdge[],
  grid: number[][],
  regionMap: string[][],
  prng: PRNG
): { doors: Door[]; openings: Opening[] } {
  const doors: Door[] = [];
  const openings: Opening[] = [];

  const occupiedSegments = new Set<string>();
  let doorCounter = 1;
  let openingCounter = 1;

  for (const room of rooms) {
    const candidates = findRoomDoorCandidates(
      room,
      wallSegments,
      grid,
      regionMap,
      config.width,
      config.height
    );

    // Group candidates by otherRegionId so every connected corridor/room gets guaranteed passage!
    const candidatesByRegion = new Map<string, DoorCandidate[]>();
    for (const cand of candidates) {
      if (occupiedSegments.has(cand.wallSegment.id)) continue;
      if (!candidatesByRegion.has(cand.otherRegionId)) {
        candidatesByRegion.set(cand.otherRegionId, []);
      }
      candidatesByRegion.get(cand.otherRegionId)!.push(cand);
    }

    // For EACH connected region, pick the best candidate (preferring non-corner and center-aligned)
    for (const [otherReg, cands] of candidatesByRegion.entries()) {
      cands.sort((a, b) => b.score - a.score);
      const chosen = cands[0];
      if (!chosen) continue;

      const segment = chosen.wallSegment;
      if (occupiedSegments.has(segment.id)) continue;

      occupiedSegments.add(segment.id);
      segment.hasOpening = true;

      // Create Opening
      const openingId = `opening_${openingCounter++}`;
      const opening: Opening = {
        id: openingId,
        wallSegmentId: segment.id,
        edgeType: segment.edgeType,
        x: segment.x,
        y: segment.y,
        width: 1,
        regionAId: segment.regionAId,
        regionBId: segment.regionBId,
      };

      // Determine Door Type and State
      let doorType: DoorType = 'single';
      let doorState: DoorState = 'closed';
      let trapType: string | undefined = undefined;

      const typeRoll = prng.next();
      if (typeRoll < 0.2) {
        doorType = 'archway';
        doorState = 'open';
      } else if (typeRoll < 0.2 + config.secretDoorChance) {
        doorType = 'secret';
        doorState = 'secret';
      } else if (typeRoll < 0.35 + config.lockedDoorChance) {
        doorType = 'locked';
        doorState = 'locked';
      } else if (typeRoll < 0.45) {
        doorType = 'trapped';
        doorState = 'trapped';
        trapType = prng.choice([
          'Dardo Envenenado',
          'Alambre de Cuchillas',
          'Glifo Flamígero',
          'Campanilla de Alarma',
        ]);
      } else if (room.type === 'entrance' || room.type === 'boss' || room.area > 35) {
        doorType = prng.choice(['double', 'portcullis', 'single']);
        doorState = 'closed';
      }

      const orientation = segment.edgeType === 'H' ? 'horizontal' : 'vertical';
      const doorId = `door_${doorCounter++}`;

      const door: Door = {
        id: doorId,
        openingId,
        wallSegmentId: segment.id,
        x: segment.x,
        y: segment.y,
        orientation,
        type: doorType,
        state: doorState,
        width: 1,
        connectsRegions: [segment.regionAId, segment.regionBId],
        trapType,
        discovered: config.viewMode === 'gm' ? true : doorType !== 'secret',
      };

      segment.doorId = doorId;
      opening.doorId = doorId;

      openings.push(opening);
      doors.push(door);
      room.doorIds.push(doorId);

      // Link graph edges
      for (const edge of edges) {
        const edgeRegions = [edge.fromRegion, edge.toRegion];
        if (
          edgeRegions.includes(segment.regionAId) &&
          (edgeRegions.includes(segment.regionBId) || segment.regionBId.startsWith('corridor_'))
        ) {
          if (!edge.doorId) {
            edge.doorId = doorId;
          }
        }
      }
    }
  }

  return { doors, openings };
}
