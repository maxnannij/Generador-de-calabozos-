/**
 * @license
 * SPDX-License-Identifier: MIT
 * Import, Export and Persistence Subsystem
 * Versioned JSON serialization, SVG generation, and PNG export
 */

import { DungeonModel } from './types';
import { DungeonEditor } from './editor';

export const CURRENT_SCHEMA_VERSION = '1.0.0';

export function exportDungeonToJSON(model: DungeonModel): string {
  const exportPayload = {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    appName: 'DungeonForge Pro',
    exportedAt: new Date().toISOString(),
    seed: model.seed,
    config: model.config,
    rooms: model.rooms,
    corridors: model.corridors,
    doors: model.doors,
    openings: model.openings,
    items: model.items,
    connections: model.connections,
    stats: model.stats,
    validationStatus: {
      isValid: model.validation.isValid,
      criticalCount: model.validation.criticalCount,
      warningCount: model.validation.warningCount,
    },
  };
  return JSON.stringify(exportPayload, null, 2);
}

export function importDungeonFromJSON(jsonString: string): {
  success: boolean;
  model?: DungeonModel;
  error?: string;
} {
  try {
    const data = JSON.parse(jsonString);

    if (!data || typeof data !== 'object') {
      return { success: false, error: 'El archivo JSON no contiene un objeto válido.' };
    }

    if (!data.rooms || !Array.isArray(data.rooms)) {
      return { success: false, error: 'El archivo carece de la lista requerida de habitaciones.' };
    }

    if (!data.config || typeof data.config.width !== 'number' || typeof data.config.height !== 'number') {
      return { success: false, error: 'La configuración de dimensiones del mapa es inválida o inexistente.' };
    }

    // Reconstruct raw model skeleton
    const dummyModel: DungeonModel = {
      version: data.schemaVersion || CURRENT_SCHEMA_VERSION,
      seed: data.seed || 'imported_seed',
      config: data.config,
      grid: Array.from({ length: data.config.height }, () => Array(data.config.width).fill(0)),
      gridRegionMap: Array.from({ length: data.config.height }, () => Array(data.config.width).fill('exterior')),
      rooms: data.rooms,
      corridors: data.corridors || [],
      wallSegments: {},
      openings: data.openings || [],
      doors: data.doors || [],
      items: data.items || [],
      connections: data.connections || [],
      validation: {
        isValid: true,
        criticalCount: 0,
        warningCount: 0,
        infoCount: 0,
        issues: [],
        isolatedRooms: [],
        reachableRoomsCount: data.rooms.length,
        totalRoomsCount: data.rooms.length,
        navigablePathExists: true,
        timestamp: Date.now(),
      },
      stats: data.stats || {
        generationTimeMs: 0,
        roomAreaTotal: 0,
        corridorAreaTotal: 0,
        occupancyRatio: 0,
        totalWalls: 0,
        totalOpenings: 0,
      },
    };

    // Safely rebuild all canonical wall geometry and revalidate
    const validatedModel = DungeonEditor.rebuildAndValidate(dummyModel);
    return { success: true, model: validatedModel };
  } catch (err: any) {
    return {
      success: false,
      error: `Error al procesar el archivo JSON: ${err.message || 'Formato no reconocido'}`,
    };
  }
}

/**
 * Generates an SVG string representation of the dungeon directly from the geometric model
 */
export function exportDungeonToSVG(
  model: DungeonModel,
  options: { showGrid?: boolean; showLabels?: boolean } = {}
): string {
  const { config, rooms, corridors, wallSegments, doors, items } = model;
  const cellSize = config.cellSize || 28;
  const svgWidth = config.width * cellSize;
  const svgHeight = config.height * cellSize;

  const showGrid = options.showGrid !== undefined ? options.showGrid : config.showGrid;
  const showLabels = options.showLabels !== undefined ? options.showLabels : config.showLabels;

  let svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgWidth} ${svgHeight}" width="${svgWidth}" height="${svgHeight}">
  <defs>
    <style>
      .bg { fill: #0f172a; }
      .grid-line { stroke: #1e293b; stroke-width: 0.5; stroke-dasharray: 2,2; }
      .room-floor { fill: #1e293b; stroke: none; }
      .corridor-floor { fill: #1e293b; stroke: none; }
      .wall { stroke: #cbd5e1; stroke-width: 3.5; stroke-linecap: square; }
      .door-arch { stroke: #38bdf8; stroke-width: 2.5; stroke-dasharray: 3,3; }
      .door-solid { stroke: #f59e0b; stroke-width: 3; }
      .door-secret { stroke: #ec4899; stroke-width: 2; stroke-dasharray: 2,2; }
      .item { fill: #94a3b8; stroke: #475569; stroke-width: 1; }
      .label { fill: #f8fafc; font-family: sans-serif; font-size: 11px; font-weight: 600; text-anchor: middle; }
    </style>
  </defs>

  <!-- Background Void -->
  <rect width="100%" height="100%" class="bg" />
`;

  // Grid
  if (showGrid) {
    svg += '  <!-- Grid -->\n  <g id="grid">\n';
    for (let x = 0; x <= config.width; x++) {
      svg += `    <line x1="${x * cellSize}" y1="0" x2="${x * cellSize}" y2="${svgHeight}" class="grid-line" />\n`;
    }
    for (let y = 0; y <= config.height; y++) {
      svg += `    <line x1="0" y1="${y * cellSize}" x2="${svgWidth}" y2="${y * cellSize}" class="grid-line" />\n`;
    }
    svg += '  </g>\n';
  }

  // Floors (Rooms)
  svg += '  <!-- Rooms Floors -->\n  <g id="rooms">\n';
  for (const r of rooms) {
    svg += `    <rect x="${r.x * cellSize}" y="${r.y * cellSize}" width="${r.width * cellSize}" height="${r.height * cellSize}" class="room-floor" />\n`;
  }
  svg += '  </g>\n';

  // Corridors
  svg += '  <!-- Corridors Floors -->\n  <g id="corridors">\n';
  for (const c of corridors) {
    for (const p of c.cells) {
      svg += `    <rect x="${p.x * cellSize}" y="${p.y * cellSize}" width="${cellSize}" height="${cellSize}" class="corridor-floor" />\n`;
    }
  }
  svg += '  </g>\n';

  // Canonical Walls (skipping those with openings)
  svg += '  <!-- Walls -->\n  <g id="walls">\n';
  for (const seg of Object.values(wallSegments)) {
    if (seg.hasOpening) continue;
    if (seg.edgeType === 'H') {
      const x1 = seg.x * cellSize;
      const y1 = seg.y * cellSize;
      const x2 = (seg.x + 1) * cellSize;
      const y2 = y1;
      svg += `    <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="wall" />\n`;
    } else {
      const x1 = seg.x * cellSize;
      const y1 = seg.y * cellSize;
      const x2 = x1;
      const y2 = (seg.y + 1) * cellSize;
      svg += `    <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="wall" />\n`;
    }
  }
  svg += '  </g>\n';

  // Doors
  svg += '  <!-- Doors -->\n  <g id="doors">\n';
  for (const d of doors) {
    const isH = d.orientation === 'horizontal';
    const x1 = d.x * cellSize + (isH ? 0 : cellSize / 2);
    const y1 = d.y * cellSize + (isH ? cellSize / 2 : 0);
    const x2 = isH ? (d.x + 1) * cellSize : x1;
    const y2 = isH ? y1 : (d.y + 1) * cellSize;
    const doorClass = d.type === 'archway' ? 'door-arch' : d.type === 'secret' ? 'door-secret' : 'door-solid';
    svg += `    <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="${doorClass}" />\n`;
  }
  svg += '  </g>\n';

  // Items
  svg += '  <!-- Interior Items -->\n  <g id="items">\n';
  for (const it of items) {
    svg += `    <rect x="${it.x * cellSize + 2}" y="${it.y * cellSize + 2}" width="${it.width * cellSize - 4}" height="${it.height * cellSize - 4}" rx="2" class="item" />\n`;
  }
  svg += '  </g>\n';

  // Labels
  if (showLabels) {
    svg += '  <!-- Labels -->\n  <g id="labels">\n';
    for (const r of rooms) {
      const cx = (r.x + r.width / 2) * cellSize;
      const cy = (r.y + r.height / 2) * cellSize + 4;
      svg += `    <text x="${cx}" y="${cy}" class="label">${r.name}</text>\n`;
    }
    svg += '  </g>\n';
  }

  svg += '</svg>';
  return svg;
}
