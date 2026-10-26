/**
 * @license
 * SPDX-License-Identifier: MIT
 * Canonical Wall Segment System (elimination of duplicates, shared cell boundaries)
 */

import { CellType, Point, WallSegment } from './types';
import { getHorizontalEdgeId, getVerticalEdgeId } from './geometry';

export function isTransitableCell(cellType: number): boolean {
  return (
    cellType === CellType.ROOM ||
    cellType === CellType.CORRIDOR ||
    cellType === CellType.CAVE
  );
}

/**
 * Builds the canonical map of wall segments based on region boundaries.
 * Guarantees zero duplicate wall segments across any shared boundaries.
 * Conforms strictly to Section 7.E: never places walls across corridor intersections.
 */
export function buildCanonicalWallSegments(
  grid: number[][],
  regionMap: string[][],
  width: number,
  height: number
): Record<string, WallSegment> {
  const wallSegments: Record<string, WallSegment> = {};

  // 1. Horizontal Edges (between (x, y-1) and (x, y)) for y in [0 .. height]
  for (let y = 0; y <= height; y++) {
    for (let x = 0; x < width; x++) {
      const topCell: Point = { x, y: y - 1 };
      const bottomCell: Point = { x, y };

      const topInBounds = topCell.y >= 0 && topCell.y < height;
      const bottomInBounds = bottomCell.y >= 0 && bottomCell.y < height;

      const topType = topInBounds ? grid[topCell.y][topCell.x] : CellType.VOID;
      const bottomType = bottomInBounds ? grid[bottomCell.y][bottomCell.x] : CellType.VOID;

      const topRegion = topInBounds ? regionMap[topCell.y][topCell.x] : 'exterior';
      const bottomRegion = bottomInBounds ? regionMap[bottomCell.y][bottomCell.x] : 'exterior';

      const topTransitable = isTransitableCell(topType);
      const bottomTransitable = isTransitableCell(bottomType);

      let needsWall = false;

      if (topTransitable !== bottomTransitable) {
        // Boundary between interior transit and exterior/void
        needsWall = true;
      } else if (topTransitable && bottomTransitable) {
        // Both cells are transitable:
        // Section 7.E: Corridors merging into other corridors or cave passages NEVER create dividing walls!
        const isCorridorTop = topType === CellType.CORRIDOR || topType === CellType.CAVE;
        const isCorridorBottom = bottomType === CellType.CORRIDOR || bottomType === CellType.CAVE;

        if (isCorridorTop && isCorridorBottom) {
          needsWall = false;
        } else if (topRegion !== bottomRegion) {
          // Boundary between Room & Room, or Room & Corridor
          needsWall = true;
        }
      }

      if (needsWall) {
        const id = getHorizontalEdgeId(x, y);
        wallSegments[id] = {
          id,
          edgeType: 'H',
          x,
          y,
          cellA: topCell,
          cellB: bottomCell,
          regionAId: topRegion || 'exterior',
          regionBId: bottomRegion || 'exterior',
          hasOpening: false,
        };
      }
    }
  }

  // 2. Vertical Edges (between (x-1, y) and (x, y)) for x in [0 .. width]
  for (let y = 0; y < height; y++) {
    for (let x = 0; x <= width; x++) {
      const leftCell: Point = { x: x - 1, y };
      const rightCell: Point = { x, y };

      const leftInBounds = leftCell.x >= 0 && leftCell.x < width;
      const rightInBounds = rightCell.x >= 0 && rightCell.x < width;

      const leftType = leftInBounds ? grid[leftCell.y][leftCell.x] : CellType.VOID;
      const rightType = rightInBounds ? grid[rightCell.y][rightCell.x] : CellType.VOID;

      const leftRegion = leftInBounds ? regionMap[leftCell.y][leftCell.x] : 'exterior';
      const rightRegion = rightInBounds ? regionMap[rightCell.y][rightCell.x] : 'exterior';

      const leftTransitable = isTransitableCell(leftType);
      const rightTransitable = isTransitableCell(rightType);

      let needsWall = false;

      if (leftTransitable !== rightTransitable) {
        needsWall = true;
      } else if (leftTransitable && rightTransitable) {
        const isCorridorLeft = leftType === CellType.CORRIDOR || leftType === CellType.CAVE;
        const isCorridorRight = rightType === CellType.CORRIDOR || rightType === CellType.CAVE;

        if (isCorridorLeft && isCorridorRight) {
          needsWall = false;
        } else if (leftRegion !== rightRegion) {
          needsWall = true;
        }
      }

      if (needsWall) {
        const id = getVerticalEdgeId(x, y);
        wallSegments[id] = {
          id,
          edgeType: 'V',
          x,
          y,
          cellA: leftCell,
          cellB: rightCell,
          regionAId: leftRegion || 'exterior',
          regionBId: rightRegion || 'exterior',
          hasOpening: false,
        };
      }
    }
  }

  return wallSegments;
}
