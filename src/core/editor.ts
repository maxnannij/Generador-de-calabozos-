/**
 * @license
 * SPDX-License-Identifier: MIT
 * Manual Editor Operations with Safe Re-validation and Undo/Redo History
 */

import { CellType, Door, DungeonItem, DungeonModel, Room } from './types';
import { buildCanonicalWallSegments } from './walls';
import { validateDungeon } from './validator';

export class DungeonEditor {
  private history: DungeonModel[] = [];
  private historyIndex: number = -1;
  private readonly maxHistory: number = 30;

  constructor(initialModel: DungeonModel) {
    this.pushState(initialModel);
  }

  public getCurrentModel(): DungeonModel {
    return this.history[this.historyIndex];
  }

  public canUndo(): boolean {
    return this.historyIndex > 0;
  }

  public canRedo(): boolean {
    return this.historyIndex < this.history.length - 1;
  }

  public undo(): DungeonModel | null {
    if (!this.canUndo()) return null;
    this.historyIndex--;
    return this.getCurrentModel();
  }

  public redo(): DungeonModel | null {
    if (!this.canRedo()) return null;
    this.historyIndex++;
    return this.getCurrentModel();
  }

  private pushState(model: DungeonModel) {
    const clone = JSON.parse(JSON.stringify(model)) as DungeonModel;
    this.history = this.history.slice(0, this.historyIndex + 1);
    this.history.push(clone);
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    } else {
      this.historyIndex++;
    }
  }

  /**
   * Reconstructs the grid, region map, canonical walls, and runs validation
   */
  public static rebuildAndValidate(model: DungeonModel): DungeonModel {
    const updated = JSON.parse(JSON.stringify(model)) as DungeonModel;
    const { width, height } = updated.config;

    // 1. Clear grid & regionMap
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        updated.grid[y][x] = CellType.VOID;
        updated.gridRegionMap[y][x] = 'exterior';
      }
    }

    // 2. Re-carve rooms
    for (const room of updated.rooms) {
      for (let ry = room.y; ry < room.y + room.height; ry++) {
        for (let rx = room.x; rx < room.x + room.width; rx++) {
          if (ry >= 0 && ry < height && rx >= 0 && rx < width) {
            updated.grid[ry][rx] = CellType.ROOM;
            updated.gridRegionMap[ry][rx] = room.id;
          }
        }
      }
    }

    // 3. Re-carve corridors
    for (const corridor of updated.corridors) {
      for (const p of corridor.cells) {
        if (p.y >= 0 && p.y < height && p.x >= 0 && p.x < width) {
          if (updated.grid[p.y][p.x] !== CellType.ROOM) {
            updated.grid[p.y][p.x] = CellType.CORRIDOR;
            updated.gridRegionMap[p.y][p.x] = corridor.id;
          }
        }
      }
    }

    // 4. Rebuild canonical wall segments
    updated.wallSegments = buildCanonicalWallSegments(
      updated.grid,
      updated.gridRegionMap,
      width,
      height
    );

    // 5. Re-link doors to wall segments and openings
    const validDoors: Door[] = [];
    const validOpenings = [];

    for (const door of updated.doors) {
      const seg = updated.wallSegments[door.wallSegmentId];
      if (seg) {
        seg.hasOpening = true;
        seg.doorId = door.id;
        validDoors.push(door);

        const op = updated.openings.find((o) => o.id === door.openingId);
        if (op) {
          validOpenings.push(op);
        } else {
          validOpenings.push({
            id: door.openingId,
            wallSegmentId: seg.id,
            edgeType: seg.edgeType,
            x: door.x,
            y: door.y,
            width: 1,
            regionAId: seg.regionAId,
            regionBId: seg.regionBId,
            doorId: door.id,
          });
        }
      }
    }

    updated.doors = validDoors;
    updated.openings = validOpenings;

    // 6. Run automated validation
    updated.validation = validateDungeon(updated);
    return updated;
  }

  public updateRoom(roomId: string, changes: Partial<Room>): DungeonModel {
    const current = this.getCurrentModel();
    const updated = JSON.parse(JSON.stringify(current)) as DungeonModel;
    const roomIndex = updated.rooms.findIndex((r) => r.id === roomId);
    if (roomIndex === -1) return current;

    const room = updated.rooms[roomIndex];
    Object.assign(room, changes);
    room.area = room.width * room.height;
    room.center = {
      x: Math.floor(room.x + room.width / 2),
      y: Math.floor(room.y + room.height / 2),
    };

    const validated = DungeonEditor.rebuildAndValidate(updated);
    this.pushState(validated);
    return validated;
  }

  public deleteRoom(roomId: string): DungeonModel {
    const current = this.getCurrentModel();
    const updated = JSON.parse(JSON.stringify(current)) as DungeonModel;
    updated.rooms = updated.rooms.filter((r) => r.id !== roomId);
    updated.doors = updated.doors.filter(
      (d) => !d.connectsRegions.includes(roomId)
    );
    updated.items = updated.items.filter((i) => i.roomId !== roomId);
    updated.corridors = updated.corridors.filter(
      (c) => !c.connectedRoomIds.includes(roomId)
    );

    const validated = DungeonEditor.rebuildAndValidate(updated);
    this.pushState(validated);
    return validated;
  }

  public updateDoor(doorId: string, changes: Partial<Door>): DungeonModel {
    const current = this.getCurrentModel();
    const updated = JSON.parse(JSON.stringify(current)) as DungeonModel;
    const door = updated.doors.find((d) => d.id === doorId);
    if (!door) return current;

    Object.assign(door, changes);
    const validated = DungeonEditor.rebuildAndValidate(updated);
    this.pushState(validated);
    return validated;
  }

  public deleteDoor(doorId: string): DungeonModel {
    const current = this.getCurrentModel();
    const updated = JSON.parse(JSON.stringify(current)) as DungeonModel;
    const door = updated.doors.find((d) => d.id === doorId);
    if (!door) return current;

    updated.doors = updated.doors.filter((d) => d.id !== doorId);
    updated.openings = updated.openings.filter((o) => o.id !== door.openingId);

    for (const r of updated.rooms) {
      r.doorIds = r.doorIds.filter((id) => id !== doorId);
    }

    const validated = DungeonEditor.rebuildAndValidate(updated);
    this.pushState(validated);
    return validated;
  }

  public addItem(item: Omit<DungeonItem, 'id'>): DungeonModel {
    const current = this.getCurrentModel();
    const updated = JSON.parse(JSON.stringify(current)) as DungeonModel;
    const newItem: DungeonItem = {
      ...item,
      id: `item_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    };
    updated.items.push(newItem);
    const room = updated.rooms.find((r) => r.id === item.roomId);
    if (room) {
      room.itemIds.push(newItem.id);
    }

    const validated = DungeonEditor.rebuildAndValidate(updated);
    this.pushState(validated);
    return validated;
  }

  public deleteItem(itemId: string): DungeonModel {
    const current = this.getCurrentModel();
    const updated = JSON.parse(JSON.stringify(current)) as DungeonModel;
    updated.items = updated.items.filter((i) => i.id !== itemId);
    for (const r of updated.rooms) {
      r.itemIds = r.itemIds.filter((id) => id !== itemId);
    }

    const validated = DungeonEditor.rebuildAndValidate(updated);
    this.pushState(validated);
    return validated;
  }
}
