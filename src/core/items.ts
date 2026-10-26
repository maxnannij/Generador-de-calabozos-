/**
 * @license
 * SPDX-License-Identifier: MIT
 * Interior elements, props, furniture and stairs placement engine
 */

import { DungeonConfig, DungeonItem, ItemType, Point, Room } from './types';
import { PRNG } from './prng';

interface ItemTemplate {
  type: ItemType;
  name: string;
  width: number;
  height: number;
  blocksMovement: boolean;
  allowedRoomTypes?: string[];
  description: string;
}

const TEMPLATES: ItemTemplate[] = [
  {
    type: 'chest',
    name: 'Cofre Reforzado',
    width: 1,
    height: 1,
    blocksMovement: true,
    description: 'Cofre de roble con herrajes de bronce.',
  },
  {
    type: 'altar',
    name: 'Altar de Piedra',
    width: 2,
    height: 1,
    blocksMovement: true,
    allowedRoomTypes: ['shrine', 'crypt', 'boss'],
    description: 'Bloque monolítico con inscripciones rituales.',
  },
  {
    type: 'pillar',
    name: 'Columna de Canto',
    width: 1,
    height: 1,
    blocksMovement: true,
    description: 'Pilar cilíndrico que sostiene la bóveda.',
  },
  {
    type: 'sarcophagus',
    name: 'Sarcófago de Granito',
    width: 2,
    height: 1,
    blocksMovement: true,
    allowedRoomTypes: ['crypt', 'boss'],
    description: 'Tumba tallada con efigie funeraria.',
  },
  {
    type: 'table',
    name: 'Mesa de Roble',
    width: 2,
    height: 1,
    blocksMovement: true,
    allowedRoomTypes: ['dining_hall', 'barracks', 'laboratory', 'armory', 'standard'],
    description: 'Mesa maciza para mapas y vituallas.',
  },
  {
    type: 'bookshelf',
    name: 'Estantería de Tomos',
    width: 2,
    height: 1,
    blocksMovement: true,
    allowedRoomTypes: ['library', 'laboratory'],
    description: 'Balda repleta de grimorios y legajos antiguos.',
  },
  {
    type: 'trap_pit',
    name: 'Fosa con Estacas',
    width: 1,
    height: 1,
    blocksMovement: false,
    description: 'Mecanismo oculto de caída sobre púas.',
  },
  {
    type: 'fountain',
    name: 'Fuente Ornamental',
    width: 2,
    height: 2,
    blocksMovement: true,
    allowedRoomTypes: ['entrance', 'shrine', 'dining_hall'],
    description: 'Pila de agua bendecida con caños de gárgola.',
  },
  {
    type: 'rubble',
    name: 'Derrubios de Mampostería',
    width: 1,
    height: 1,
    blocksMovement: true,
    description: 'Cascotes caídos del techo abovedado.',
  },
  {
    type: 'statue',
    name: 'Estatua Heroica',
    width: 1,
    height: 1,
    blocksMovement: true,
    description: 'Efigie de guerrero esculpida en alabastro.',
  },
  {
    type: 'stairs_up',
    name: 'Escaleras Hacia Arriba',
    width: 1,
    height: 2,
    blocksMovement: false,
    allowedRoomTypes: ['entrance'],
    description: 'Peldaños de ascenso hacia el exterior o nivel superior.',
  },
  {
    type: 'stairs_down',
    name: 'Escaleras Hacia Abajo',
    width: 1,
    height: 2,
    blocksMovement: false,
    allowedRoomTypes: ['boss', 'crypt', 'standard'],
    description: 'Escalones descendentes hacia la siguiente profundidad.',
  },
];

export function generateItems(
  config: DungeonConfig,
  rooms: Room[],
  doorPositions: Point[],
  prng: PRNG
): DungeonItem[] {
  const items: DungeonItem[] = [];
  let itemCounter = 1;

  // Set of cells reserved around doors to guarantee clear entry / exit swing
  const doorClearance = new Set<string>();
  for (const dp of doorPositions) {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        doorClearance.add(`${dp.x + dx},${dp.y + dy}`);
      }
    }
  }

  // Already occupied cell footprints by other items
  const occupiedCells = new Set<string>();

  for (const room of rooms) {
    // Entrance always gets stairs_up
    if (room.type === 'entrance') {
      const upStairs = TEMPLATES.find((t) => t.type === 'stairs_up')!;
      const sx = room.x + 1;
      const sy = room.y + 1;
      const id = `item_${itemCounter++}`;
      items.push({
        id,
        roomId: room.id,
        type: upStairs.type,
        name: upStairs.name,
        x: sx,
        y: sy,
        width: upStairs.width,
        height: upStairs.height,
        rotation: 0,
        blocksMovement: upStairs.blocksMovement,
        description: upStairs.description,
      });
      room.itemIds.push(id);
      occupiedCells.add(`${sx},${sy}`);
      occupiedCells.add(`${sx},${sy + 1}`);
    }

    // Boss room or deepest room gets stairs_down
    if (room.type === 'boss') {
      const downStairs = TEMPLATES.find((t) => t.type === 'stairs_down')!;
      const sx = room.x + room.width - 2;
      const sy = room.y + room.height - 3;
      if (sx > room.x && sy > room.y) {
        const id = `item_${itemCounter++}`;
        items.push({
          id,
          roomId: room.id,
          type: downStairs.type,
          name: downStairs.name,
          x: sx,
          y: sy,
          width: downStairs.width,
          height: downStairs.height,
          rotation: 0,
          blocksMovement: downStairs.blocksMovement,
          description: downStairs.description,
        });
        room.itemIds.push(id);
        occupiedCells.add(`${sx},${sy}`);
        occupiedCells.add(`${sx},${sy + 1}`);
      }
    }

    // Determine how many props to place based on room area and itemDensity
    const maxItems = Math.max(1, Math.floor((room.area / 16) * config.itemDensity * 2));
    const toPlace = prng.int(1, maxItems);

    for (let i = 0; i < toPlace; i++) {
      // Pick suitable template for room type
      const suitableTemplates = TEMPLATES.filter(
        (t) =>
          t.type !== 'stairs_up' &&
          t.type !== 'stairs_down' &&
          (!t.allowedRoomTypes || t.allowedRoomTypes.includes(room.type))
      );

      if (suitableTemplates.length === 0) continue;
      const template = prng.choice(suitableTemplates);

      // Try placing item inside room away from door clearance and walls
      let placed = false;
      for (let attempt = 0; attempt < 20; attempt++) {
        const maxItemX = room.x + room.width - template.width;
        const maxItemY = room.y + room.height - template.height;

        if (maxItemX <= room.x || maxItemY <= room.y) continue;

        const ix = prng.int(room.x, maxItemX);
        const iy = prng.int(room.y, maxItemY);

        // Check if footprint overlaps door clearance or existing items
        let collision = false;
        for (let dy = 0; dy < template.height; dy++) {
          for (let dx = 0; dx < template.width; dx++) {
            const key = `${ix + dx},${iy + dy}`;
            if (doorClearance.has(key) || occupiedCells.has(key)) {
              collision = true;
              break;
            }
          }
          if (collision) break;
        }

        if (!collision) {
          // Reserve footprint
          for (let dy = 0; dy < template.height; dy++) {
            for (let dx = 0; dx < template.width; dx++) {
              occupiedCells.add(`${ix + dx},${iy + dy}`);
            }
          }

          const id = `item_${itemCounter++}`;
          items.push({
            id,
            roomId: room.id,
            type: template.type,
            name: template.name,
            x: ix,
            y: iy,
            width: template.width,
            height: template.height,
            rotation: prng.choice([0, 90, 180, 270]),
            blocksMovement: template.blocksMovement,
            description: template.description,
          });
          room.itemIds.push(id);
          placed = true;
          break;
        }
      }
    }
  }

  return items;
}
