/**
 * @license
 * SPDX-License-Identifier: MIT
 * Room placement and spatial layout engine
 */

import { CellType, DungeonConfig, Point, Rect, Room, RoomType } from './types';
import { PRNG } from './prng';
import { doRectsOverlap, isRectWithinBounds } from './geometry';

const THEMATIC_NAMES: Record<RoomType, string[]> = {
  entrance: ['Vestíbulo de Entrada', 'Atrio Principal', 'Umbral de Piedra', 'Zaguán Enlosado'],
  boss: ['Cámara del Trono', 'Cenotafio del Señor', 'Sancta Sanctorum', 'Cámara del Tirano'],
  shrine: ['Santuario Olvidado', 'Altar de Sombras', 'Capilla Consagrada', 'Oratorio Antiguo'],
  armory: ['Armería de la Guardia', 'Depósito de Armas', 'Arsenal de Hierro', 'Bastión Táctico'],
  library: ['Scriptorium Silencioso', 'Biblioteca Arcana', 'Archivo Prohibido', 'Sala de Códices'],
  crypt: ['Cripta de los Antiguos', 'Mausoleo de Alabastro', 'Catacumbas del Duque', 'Sepulcro Real'],
  prison: ['Celdas de Castigo', 'Mazmorra de Hierro', 'Mazmorra Inferior', 'Fosa de Cautivos'],
  treasury: ['Cámara Acorazada', 'Bóveda de Tesoros', 'Depósito de Riquezas', 'Cofre Profundo'],
  barracks: ['Barracones del Cuartel', 'Dormitorio Común', 'Aposentos de Guardia', 'Sala de Armas'],
  laboratory: ['Laboratorio Alquímico', 'Gabinete de Curiosidades', 'Athanor Central', 'Taller Arcano'],
  dining_hall: ['Gran Salón Comensal', 'Refectorio de Piedra', 'Sala de Banquetes', 'Cámara de Huéspedes'],
  cavern_chamber: ['Gruta Resonante', 'Caverna de Estalactitas', 'Cámara Hundida', 'Fosa Subterránea'],
  standard: ['Cámara de Paso', 'Sala Columnada', 'Salón Abovedado', 'Cámara Cuadrangular', 'Recinto Fortificado'],
};

export function generateRooms(
  config: DungeonConfig,
  prng: PRNG,
  grid: number[][],
  regionMap: string[][]
): Room[] {
  const rooms: Room[] = [];
  const targetRoomCount = prng.int(config.roomCountMin, config.roomCountMax);
  const maxAttempts = 600;
  let attempts = 0;

  const roomTypesPool: RoomType[] = [
    'entrance',
    'boss',
    'shrine',
    'armory',
    'library',
    'crypt',
    'prison',
    'treasury',
    'laboratory',
    'dining_hall',
    'barracks',
  ];
  let typeIndex = 0;

  while (rooms.length < targetRoomCount && attempts < maxAttempts) {
    attempts++;

    // Proportional size distribution: 40% small, 40% medium, 20% large
    const sizeRoll = prng.next();
    let minW = config.roomSizeMin;
    let maxW = config.roomSizeMax;
    let minH = config.roomSizeMin;
    let maxH = config.roomSizeMax;

    if (sizeRoll < 0.45) {
      // Small
      maxW = Math.max(minW + 2, Math.floor(minW + (config.roomSizeMax - minW) * 0.4));
      maxH = Math.max(minH + 2, Math.floor(minH + (config.roomSizeMax - minH) * 0.4));
    } else if (sizeRoll < 0.8) {
      // Medium
      minW = Math.max(minW + 1, Math.floor(minW + (config.roomSizeMax - minW) * 0.3));
      maxW = Math.max(minW + 2, Math.floor(minW + (config.roomSizeMax - minW) * 0.7));
      minH = Math.max(minH + 1, Math.floor(minH + (config.roomSizeMax - minH) * 0.3));
      maxH = Math.max(minH + 2, Math.floor(minH + (config.roomSizeMax - minH) * 0.7));
    } else {
      // Large
      minW = Math.max(minW + 2, Math.floor(minW + (config.roomSizeMax - minW) * 0.6));
      minH = Math.max(minH + 2, Math.floor(minH + (config.roomSizeMax - minH) * 0.6));
    }

    const width = prng.int(minW, maxW);
    const height = prng.int(minH, maxH);

    // Candidates must leave at least 2 cells border margin
    const margin = 2;
    const maxX = config.width - width - margin;
    const maxY = config.height - height - margin;

    if (maxX <= margin || maxY <= margin) continue;

    const x = prng.int(margin, maxX);
    const y = prng.int(margin, maxY);

    const candidateRect: Rect = { x, y, width, height };

    // 1. Check bounds
    if (!isRectWithinBounds(candidateRect, config.width, config.height, margin)) {
      continue;
    }

    // 2. Check overlap and separation distance
    let overlaps = false;
    for (const existing of rooms) {
      const existingRect: Rect = {
        x: existing.x,
        y: existing.y,
        width: existing.width,
        height: existing.height,
      };
      if (doRectsOverlap(candidateRect, existingRect, config.roomSeparation)) {
        overlaps = true;
        break;
      }
    }

    if (overlaps) continue;

    // Accept room!
    const roomId = `room_${rooms.length + 1}`;
    let roomType: RoomType = 'standard';
    if (rooms.length === 0) {
      roomType = 'entrance';
    } else if (rooms.length === 1) {
      roomType = 'boss';
    } else if (typeIndex < roomTypesPool.length && prng.boolean(0.75)) {
      roomType = roomTypesPool[typeIndex % roomTypesPool.length];
      typeIndex++;
    }

    const nameChoices = THEMATIC_NAMES[roomType] || THEMATIC_NAMES.standard;
    const name = prng.choice(nameChoices);

    const center: Point = {
      x: Math.floor(x + width / 2),
      y: Math.floor(y + height / 2),
    };

    const newRoom: Room = {
      id: roomId,
      name,
      x,
      y,
      width,
      height,
      type: roomType,
      level: 1,
      area: width * height,
      center,
      doorIds: [],
      itemIds: [],
    };

    rooms.push(newRoom);

    // Write room to logical grid & region map
    for (let ry = y; ry < y + height; ry++) {
      for (let rx = x; rx < x + width; rx++) {
        grid[ry][rx] = CellType.ROOM;
        regionMap[ry][rx] = roomId;
      }
    }
  }

  return rooms;
}
