/**
 * @license
 * SPDX-License-Identifier: MIT
 * Comprehensive Automated Validator for DungeonForge Pro
 * Tests Geometry, Doors, Connectivity, Navigation, and Data Integrity
 */

import {
  CellType,
  DungeonConfig,
  DungeonItem,
  DungeonModel,
  GraphEdge,
  Opening,
  Point,
  Room,
  ValidationIssue,
  ValidationResult,
  WallSegment,
} from './types';
import { doRectsOverlap, get4Neighbors, isPointInsideRect, manhattanDistance } from './geometry';
import { isTransitableCell } from './walls';

export function validateDungeon(model: DungeonModel): ValidationResult {
  const issues: ValidationIssue[] = [];
  const { config, rooms, corridors, wallSegments, openings, doors, items, connections, grid } = model;
  const width = config.width;
  const height = config.height;

  // ==========================================
  // CATEGORY A: GEOMETRY INVARIANTS
  // ==========================================

  // 1. Check rooms within map bounds
  for (const room of rooms) {
    if (
      room.x < 1 ||
      room.y < 1 ||
      room.x + room.width > width - 1 ||
      room.y + room.height > height - 1
    ) {
      issues.push({
        id: `geom_bounds_${room.id}`,
        code: 'GEOM_OUT_OF_BOUNDS',
        severity: 'critical',
        category: 'geometry',
        entityId: room.id,
        coordinates: { x: room.x, y: room.y },
        title: 'Habitación fuera de límites',
        description: `La habitación "${room.name}" (${room.id}) excede los márgenes seguros del mapa (${width}x${height}).`,
        suggestedFix: 'Reubicar o reducir las dimensiones de la habitación para que respete el margen exterior.',
      });
    }
  }

  // 2. Check room overlap
  for (let i = 0; i < rooms.length; i++) {
    for (let j = i + 1; j < rooms.length; j++) {
      const r1 = rooms[i];
      const r2 = rooms[j];
      
      let overlaps = false;
      if (r1.type === 'cavern_chamber' || r2.type === 'cavern_chamber') {
        if (doRectsOverlap(r1, r2, 0)) {
          for (let y = Math.max(r1.y, r2.y); y < Math.min(r1.y + r1.height, r2.y + r2.height); y++) {
            for (let x = Math.max(r1.x, r2.x); x < Math.min(r1.x + r1.width, r2.x + r2.width); x++) {
              if (model.gridRegionMap[y][x] === r1.id && model.gridRegionMap[y][x] === r2.id) {
                overlaps = true;
                break;
              }
            }
            if (overlaps) break;
          }
        }
      } else {
        overlaps = doRectsOverlap(r1, r2, 0);
      }

      if (overlaps) {
        issues.push({
          id: `geom_overlap_${r1.id}_${r2.id}`,
          code: 'GEOM_ROOM_OVERLAP',
          severity: 'critical',
          category: 'geometry',
          entityId: r1.id,
          coordinates: { x: r1.x, y: r1.y },
          title: 'Superposición de habitaciones',
          description: `Las habitaciones "${r1.name}" (${r1.id}) y "${r2.name}" (${r2.id}) se superponen geométricamente.`,
          suggestedFix: 'Desplazar una de las habitaciones o respetar la distancia de separación.',
        });
      }
    }
  }

  // 3. Check item collision & out of bounds
  for (let i = 0; i < items.length; i++) {
    const it1 = items[i];
    if (
      it1.x < 0 ||
      it1.y < 0 ||
      it1.x + it1.width > width ||
      it1.y + it1.height > height
    ) {
      issues.push({
        id: `item_oob_${it1.id}`,
        code: 'GEOM_ITEM_OUT_OF_BOUNDS',
        severity: 'critical',
        category: 'geometry',
        entityId: it1.id,
        coordinates: { x: it1.x, y: it1.y },
        title: 'Elemento interior fuera del mapa',
        description: `El objeto "${it1.name}" (${it1.id}) se encuentra fuera de los límites del mapa.`,
        suggestedFix: 'Reubicar el objeto dentro de la habitación asociada.',
      });
    }

    if (it1.blocksMovement) {
      for (let j = i + 1; j < items.length; j++) {
        const it2 = items[j];
        if (it2.blocksMovement && doRectsOverlap(it1, it2, 0)) {
          issues.push({
            id: `item_overlap_${it1.id}_${it2.id}`,
            code: 'GEOM_ITEM_OVERLAP',
            severity: 'warning',
            category: 'geometry',
            entityId: it1.id,
            coordinates: { x: it1.x, y: it1.y },
            title: 'Objetos sólidos superpuestos',
            description: `Los objetos "${it1.name}" y "${it2.name}" ocupan las mismas celdas transitables.`,
            suggestedFix: 'Ajustar la posición de uno de los elementos.',
          });
        }
      }
    }
  }

  // ==========================================
  // CATEGORY B: DOOR & OPENING INVARIANTS (SECTION 8.K)
  // ==========================================
  const wallSegmentMap = wallSegments;
  const openingMap = new Map<string, Opening>();
  for (const o of openings) {
    openingMap.set(o.id, o);
  }

  const occupiedSegments = new Set<string>();

  for (const door of doors) {
    const segment = wallSegmentMap[door.wallSegmentId];
    if (!segment) {
      issues.push({
        id: `door_no_wall_${door.id}`,
        code: 'DOOR_NO_WALL_SEGMENT',
        severity: 'critical',
        category: 'doors',
        entityId: door.id,
        coordinates: { x: door.x, y: door.y },
        title: 'Puerta flotante sin pared de origen',
        description: `La puerta ${door.id} referencia un segmento de pared inexistente (${door.wallSegmentId}).`,
        suggestedFix: 'Vincular la puerta a un límite canónico de pared existente o eliminarla.',
      });
      continue;
    }

    const opening = openingMap.get(door.openingId);
    if (!opening) {
      issues.push({
        id: `door_no_opening_${door.id}`,
        code: 'DOOR_NO_OPENING',
        severity: 'critical',
        category: 'doors',
        entityId: door.id,
        coordinates: { x: door.x, y: door.y },
        title: 'Puerta sin abertura asociada',
        description: `La puerta ${door.id} no posee una abertura registrada en el modelo geométrico.`,
        suggestedFix: 'Registrar la abertura en la pared correspondiente.',
      });
    }

    const [dRegA, dRegB] = door.connectsRegions;
    if (
      !(dRegA === segment.regionAId && dRegB === segment.regionBId) &&
      !(dRegA === segment.regionBId && dRegB === segment.regionAId)
    ) {
      issues.push({
        id: `door_wrong_regions_${door.id}`,
        code: 'DOOR_CONNECTS_WRONG_REGIONS',
        severity: 'critical',
        category: 'doors',
        entityId: door.id,
        coordinates: { x: door.x, y: door.y },
        title: 'Puerta entre regiones no adyacentes',
        description: `La puerta ${door.id} declara conectar "${dRegA}" y "${dRegB}", pero el segmento separa "${segment.regionAId}" y "${segment.regionBId}".`,
        suggestedFix: 'Alinear las regiones conectadas con los lados reales del segmento.',
      });
    }

    const expectedOrientation = segment.edgeType === 'H' ? 'horizontal' : 'vertical';
    if (door.orientation !== expectedOrientation) {
      issues.push({
        id: `door_orient_${door.id}`,
        code: 'DOOR_WRONG_ORIENTATION',
        severity: 'critical',
        category: 'doors',
        entityId: door.id,
        coordinates: { x: door.x, y: door.y },
        title: 'Orientación de puerta incompatible con la pared',
        description: `La puerta ${door.id} tiene orientación ${door.orientation}, pero el muro es ${expectedOrientation}.`,
        suggestedFix: `Alinear la orientación de la puerta a "${expectedOrientation}".`,
      });
    }

    if (occupiedSegments.has(door.wallSegmentId)) {
      issues.push({
        id: `door_dup_${door.id}`,
        code: 'DOOR_DUPLICATE_ON_SEGMENT',
        severity: 'critical',
        category: 'doors',
        entityId: door.id,
        coordinates: { x: door.x, y: door.y },
        title: 'Puertas duplicadas en el mismo segmento',
        description: `Más de una puerta ocupa el segmento de pared canónico ${door.wallSegmentId}.`,
        suggestedFix: 'Eliminar una de las puertas redundantes.',
      });
    }
    occupiedSegments.add(door.wallSegmentId);

    const cellA = segment.cellA;
    const cellB = segment.cellB;
    const aIn = cellA.x >= 0 && cellA.x < width && cellA.y >= 0 && cellA.y < height;
    const bIn = cellB.x >= 0 && cellB.x < width && cellB.y >= 0 && cellB.y < height;

    const aTrans = aIn ? isTransitableCell(grid[cellA.y][cellA.x]) : false;
    const bTrans = bIn ? isTransitableCell(grid[cellB.y][cellB.x]) : false;

    if (!aTrans || !bTrans) {
      issues.push({
        id: `door_unpassable_${door.id}`,
        code: 'DOOR_LEADS_TO_VOID',
        severity: 'critical',
        category: 'doors',
        entityId: door.id,
        coordinates: { x: door.x, y: door.y },
        title: 'Puerta bloqueada o hacia el vacío exterior',
        description: `La puerta ${door.id} en (${door.x}, ${door.y}) no cuenta con espacio transitable a ambos lados.`,
        suggestedFix: 'Asegurar que el pasillo o habitación llegue a ambos extremos de la abertura.',
      });
    }
  }

  // ==========================================
  // CATEGORY C & D: CONNECTIVITY & REACHABILITY
  // ==========================================
  const totalRoomsCount = rooms.length;
  let isolatedRooms: string[] = [];
  let navigablePathExists = true;

  if (rooms.length > 0) {
    const entranceRoom = rooms[0];

    // Grid Navigation BFS Test:
    // Flood-fill through transitable cells and open door segments from entranceRoom.center
    const visitedCells = new Set<string>();
    const cellQ: Point[] = [entranceRoom.center];
    visitedCells.add(`${entranceRoom.center.x},${entranceRoom.center.y}`);

    while (cellQ.length > 0) {
      const cur = cellQ.shift()!;
      const neighbors = get4Neighbors(cur, width, height);

      for (const nb of neighbors) {
        const np = nb.point;
        const k = `${np.x},${np.y}`;
        if (visitedCells.has(k)) continue;

        const nextType = grid[np.y][np.x];
        if (!isTransitableCell(nextType)) continue;

        let edgeId = '';
        if (nb.dir === 'N') edgeId = `H:${cur.x}:${cur.y}`;
        else if (nb.dir === 'S') edgeId = `H:${cur.x}:${cur.y + 1}`;
        else if (nb.dir === 'W') edgeId = `V:${cur.x}:${cur.y}`;
        else if (nb.dir === 'E') edgeId = `V:${cur.x + 1}:${cur.y}`;

        const wall = wallSegmentMap[edgeId];
        // If a wall exists between these two cells, it MUST have an opening or door to be passable!
        if (wall && !wall.hasOpening) {
          continue;
        }

        visitedCells.add(k);
        cellQ.push(np);
      }
    }

    if (config.mapType === 'cavern') {
      // In caverns, reachability is directly through natural open passages
      isolatedRooms = rooms.filter((r) => {
        let reached = false;
        for (let ry = r.y; ry < r.y + r.height; ry++) {
          for (let rx = r.x; rx < r.x + r.width; rx++) {
            if (visitedCells.has(`${rx},${ry}`)) {
              reached = true;
              break;
            }
          }
          if (reached) break;
        }
        return !reached;
      }).map((r) => r.id);
    } else {
      // In structured dungeons, check topological reachability through existing corridors
      const existingCorridorIds = new Set(corridors.map((c) => c.id));
      const regionAdjacency = new Map<string, Set<string>>();

      for (const d of doors) {
        const [rA, rB] = d.connectsRegions;
        if (rA.startsWith('corridor_') && !existingCorridorIds.has(rA)) continue;
        if (rB.startsWith('corridor_') && !existingCorridorIds.has(rB)) continue;

        if (!regionAdjacency.has(rA)) regionAdjacency.set(rA, new Set());
        if (!regionAdjacency.has(rB)) regionAdjacency.set(rB, new Set());
        regionAdjacency.get(rA)!.add(rB);
        regionAdjacency.get(rB)!.add(rA);
      }

      for (const c of corridors) {
        const [r1, r2] = c.connectedRoomIds;
        if (!regionAdjacency.has(c.id)) regionAdjacency.set(c.id, new Set());
        if (r1) {
          if (!regionAdjacency.has(r1)) regionAdjacency.set(r1, new Set());
          regionAdjacency.get(r1)!.add(c.id);
          regionAdjacency.get(c.id)!.add(r1);
        }
        if (r2) {
          if (!regionAdjacency.has(r2)) regionAdjacency.set(r2, new Set());
          regionAdjacency.get(r2)!.add(c.id);
          regionAdjacency.get(c.id)!.add(r2);
        }
      }

      const visitedRegions = new Set<string>();
      visitedRegions.add(entranceRoom.id);
      const regQueue = [entranceRoom.id];

      while (regQueue.length > 0) {
        const curr = regQueue.shift()!;
        const neighbors = regionAdjacency.get(curr);
        if (!neighbors) continue;
        for (const n of neighbors) {
          if (!visitedRegions.has(n)) {
            visitedRegions.add(n);
            regQueue.push(n);
          }
        }
      }

      isolatedRooms = rooms.filter((r) => !visitedRegions.has(r.id)).map((r) => r.id);
    }

    if (isolatedRooms.length > 0) {
      for (const isoId of isolatedRooms) {
        const isoRoom = rooms.find((r) => r.id === isoId);
        issues.push({
          id: `conn_isolated_${isoId}`,
          code: 'CONN_ISOLATED_ROOM',
          severity: 'critical',
          category: 'connectivity',
          entityId: isoId,
          coordinates: isoRoom ? { x: isoRoom.x, y: isoRoom.y } : undefined,
          title: 'Habitación desconectada',
          description: `La habitación "${isoRoom?.name || isoId}" no tiene camino físico ni puertas que la conecten con la red principal.`,
          suggestedFix: 'Crear un corredor y puerta para integrar la habitación a la red transitable.',
        });
      }
    }

    // Check if every non-isolated room is reached by transitable cells
    for (const r of rooms) {
      if (isolatedRooms.includes(r.id)) continue;
      let roomVisited = false;
      for (let ry = r.y; ry < r.y + r.height; ry++) {
        for (let rx = r.x; rx < r.x + r.width; rx++) {
          if (visitedCells.has(`${rx},${ry}`)) {
            roomVisited = true;
            break;
          }
        }
        if (roomVisited) break;
      }

      if (!roomVisited) {
        navigablePathExists = false;
        issues.push({
          id: `nav_no_path_${r.id}`,
          code: 'NAV_PHYSICAL_PATH_BLOCKED',
          severity: 'critical',
          category: 'navigation',
          entityId: r.id,
          coordinates: r.center,
          title: `Camino físico hacia "${r.name}" bloqueado`,
          description: `No existe ruta transitable continua entre la entrada y la cámara "${r.name}".`,
          suggestedFix: 'Verificar que la abertura en la pared de acceso no esté obstruida.',
        });
      }
    }
  }

  const criticalCount = issues.filter((i) => i.severity === 'critical').length;
  const warningCount = issues.filter((i) => i.severity === 'warning').length;
  const infoCount = issues.filter((i) => i.severity === 'info').length;

  return {
    isValid: criticalCount === 0,
    criticalCount,
    warningCount,
    infoCount,
    issues,
    isolatedRooms,
    reachableRoomsCount: totalRoomsCount - isolatedRooms.length,
    totalRoomsCount,
    navigablePathExists,
    timestamp: Date.now(),
  };
}
