/**
 * @license
 * SPDX-License-Identifier: MIT
 * High-Fidelity Canvas 2D Renderer for DungeonForge Pro
 * Strictly decoupled from logical decisions: renders only verified model data
 */

import { CellType, Door, DungeonItem, DungeonModel, Point, Room, ThemeName, WallSegment } from '../core/types';

export interface RenderOptions {
  theme: ThemeName;
  showGrid: boolean;
  showLabels: boolean;
  viewMode: 'gm' | 'player';
  selectedRoomId?: string | null;
  selectedDoorId?: string | null;
  selectedItemId?: string | null;
  highlightIssues?: boolean;
}

interface ThemePalette {
  background: string;
  gridLine: string;
  roomFloor: string;
  roomFloorBorder?: string;
  corridorFloor: string;
  wall: string;
  wallWidth: number;
  wallHatch?: string;
  doorArch: string;
  doorSolid: string;
  doorSecretGM: string;
  doorLocked: string;
  doorTrapped: string;
  itemFill: string;
  itemStroke: string;
  labelFill: string;
  labelFont: string;
}

const PALETTES: Record<ThemeName, ThemePalette> = {
  pergamino: {
    background: '#1a1612',
    gridLine: 'rgba(120, 95, 65, 0.2)',
    roomFloor: '#2c251e',
    roomFloorBorder: '#3d342a',
    corridorFloor: '#26201a',
    wall: '#d4b483',
    wallWidth: 3.5,
    wallHatch: '#8c7355',
    doorArch: '#60a5fa',
    doorSolid: '#eab308',
    doorSecretGM: '#f43f5e',
    doorLocked: '#f97316',
    doorTrapped: '#ef4444',
    itemFill: '#4a3f35',
    itemStroke: '#a89078',
    labelFill: '#fef3c7',
    labelFont: '600 11px Cinzel, serif',
  },
  clasico: {
    background: '#ffffff',
    gridLine: 'rgba(0, 0, 0, 0.08)',
    roomFloor: '#f8fafc',
    roomFloorBorder: '#cbd5e1',
    corridorFloor: '#f1f5f9',
    wall: '#0f172a',
    wallWidth: 3,
    wallHatch: '#94a3b8',
    doorArch: '#0284c7',
    doorSolid: '#334155',
    doorSecretGM: '#e11d48',
    doorLocked: '#ea580c',
    doorTrapped: '#dc2626',
    itemFill: '#e2e8f0',
    itemStroke: '#475569',
    labelFill: '#0f172a',
    labelFont: '600 11px Plus Jakarta Sans, sans-serif',
  },
  piedra_oscura: {
    background: '#090d16',
    gridLine: 'rgba(255, 255, 255, 0.05)',
    roomFloor: '#151c2c',
    roomFloorBorder: '#232f48',
    corridorFloor: '#111724',
    wall: '#94a3b8',
    wallWidth: 3.5,
    wallHatch: '#334155',
    doorArch: '#38bdf8',
    doorSolid: '#fbbf24',
    doorSecretGM: '#fb7185',
    doorLocked: '#fb923c',
    doorTrapped: '#f87171',
    itemFill: '#2a3754',
    itemStroke: '#64748b',
    labelFill: '#f1f5f9',
    labelFont: '600 11px Plus Jakarta Sans, sans-serif',
  },
  arquitectonico: {
    background: '#0a192f',
    gridLine: 'rgba(56, 189, 248, 0.15)',
    roomFloor: '#0f2444',
    roomFloorBorder: '#1e3a64',
    corridorFloor: '#0c1d37',
    wall: '#38bdf8',
    wallWidth: 3,
    wallHatch: '#1e40af',
    doorArch: '#7dd3fc',
    doorSolid: '#fef08a',
    doorSecretGM: '#f43f5e',
    doorLocked: '#fdba74',
    doorTrapped: '#fca5a5',
    itemFill: '#172554',
    itemStroke: '#60a5fa',
    labelFill: '#bae6fd',
    labelFont: '600 11px JetBrains Mono, monospace',
  },
  minimalista: {
    background: '#121212',
    gridLine: 'rgba(255, 255, 255, 0.06)',
    roomFloor: '#1e1e1e',
    roomFloorBorder: '#2a2a2a',
    corridorFloor: '#181818',
    wall: '#e0e0e0',
    wallWidth: 2.5,
    wallHatch: '#404040',
    doorArch: '#60a5fa',
    doorSolid: '#ffffff',
    doorSecretGM: '#f43f5e',
    doorLocked: '#fbbf24',
    doorTrapped: '#ef4444',
    itemFill: '#333333',
    itemStroke: '#888888',
    labelFill: '#ffffff',
    labelFont: '600 11px Plus Jakarta Sans, sans-serif',
  },
  impresion: {
    background: '#ffffff',
    gridLine: 'rgba(0, 0, 0, 0.12)',
    roomFloor: '#ffffff',
    roomFloorBorder: '#e2e8f0',
    corridorFloor: '#ffffff',
    wall: '#000000',
    wallWidth: 3,
    wallHatch: '#cbd5e1',
    doorArch: '#475569',
    doorSolid: '#000000',
    doorSecretGM: '#000000',
    doorLocked: '#000000',
    doorTrapped: '#000000',
    itemFill: '#f1f5f9',
    itemStroke: '#000000',
    labelFill: '#000000',
    labelFont: '700 11px Plus Jakarta Sans, sans-serif',
  },
};

export function renderDungeonToCanvas(
  ctx: CanvasRenderingContext2D,
  model: DungeonModel,
  options: RenderOptions,
  zoom: number = 1,
  panOffset: Point = { x: 0, y: 0 }
): void {
  const { config, rooms, corridors, wallSegments, doors, items, grid, validation } = model;
  const cellSize = config.cellSize || 28;
  const palette = PALETTES[options.theme] || PALETTES.pergamino;

  const canvas = ctx.canvas;
  ctx.save();
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Apply camera transformation (Pan & Zoom)
  ctx.translate(panOffset.x, panOffset.y);
  ctx.scale(zoom, zoom);

  const totalPixelW = config.width * cellSize;
  const totalPixelH = config.height * cellSize;

  // 1. Draw Void / Background
  ctx.fillStyle = palette.background;
  ctx.fillRect(0, 0, totalPixelW, totalPixelH);

  // 2. Draw Grid (if enabled)
  if (options.showGrid) {
    ctx.strokeStyle = palette.gridLine;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= config.width; x++) {
      ctx.moveTo(x * cellSize, 0);
      ctx.lineTo(x * cellSize, totalPixelH);
    }
    for (let y = 0; y <= config.height; y++) {
      ctx.moveTo(0, y * cellSize);
      ctx.lineTo(totalPixelW, y * cellSize);
    }
    ctx.stroke();
  }

  // 3. Draw Room Floors
  for (const r of rooms) {
    const rx = r.x * cellSize;
    const ry = r.y * cellSize;
    const rw = r.width * cellSize;
    const rh = r.height * cellSize;

    ctx.fillStyle = palette.roomFloor;
    ctx.fillRect(rx, ry, rw, rh);

    if (palette.roomFloorBorder) {
      ctx.strokeStyle = palette.roomFloorBorder;
      ctx.lineWidth = 1;
      ctx.strokeRect(rx + 0.5, ry + 0.5, rw - 1, rh - 1);
    }

    // Highlight selected room
    if (options.selectedRoomId === r.id) {
      ctx.fillStyle = 'rgba(56, 189, 248, 0.2)';
      ctx.fillRect(rx, ry, rw, rh);
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2.5;
      ctx.strokeRect(rx, ry, rw, rh);
    }
  }

  // 4. Draw Corridors
  ctx.fillStyle = palette.corridorFloor;
  for (const c of corridors) {
    for (const p of c.cells) {
      ctx.fillRect(p.x * cellSize, p.y * cellSize, cellSize, cellSize);
    }
  }

  // Also draw cavern passage cells
  if (config.mapType === 'cavern') {
    for (let y = 0; y < config.height; y++) {
      for (let x = 0; x < config.width; x++) {
        if (grid[y][x] === CellType.CAVE) {
          ctx.fillStyle = palette.roomFloor;
          ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
        }
      }
    }
  }

  // 5. Draw Canonical Walls (Zero duplicate lines, skipping open segments)
  ctx.strokeStyle = palette.wall;
  ctx.lineWidth = palette.wallWidth;
  ctx.lineCap = 'square';
  ctx.beginPath();

  for (const seg of Object.values(wallSegments)) {
    // If wall has an opening / door, do NOT draw solid wall!
    if (seg.hasOpening) {
      // In player mode, if it's a secret door and undiscovered, render as solid wall
      if (options.viewMode === 'player' && seg.doorId) {
        const d = doors.find((door) => door.id === seg.doorId);
        if (d && d.type === 'secret' && !d.discovered) {
          // Render as secret wall hiding opening
        } else {
          continue;
        }
      } else {
        continue;
      }
    }

    if (seg.edgeType === 'H') {
      const x1 = seg.x * cellSize;
      const y1 = seg.y * cellSize;
      const x2 = (seg.x + 1) * cellSize;
      const y2 = y1;
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
    } else {
      const x1 = seg.x * cellSize;
      const y1 = seg.y * cellSize;
      const x2 = x1;
      const y2 = (seg.y + 1) * cellSize;
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
    }
  }
  ctx.stroke();

  // 6. Draw Doors
  for (const door of doors) {
    // In Player mode, hide secret doors if undiscovered
    if (options.viewMode === 'player' && door.type === 'secret' && !door.discovered) {
      continue;
    }

    const isH = door.orientation === 'horizontal';
    const cellMidX = door.x * cellSize + (isH ? 0 : cellSize / 2);
    const cellMidY = door.y * cellSize + (isH ? cellSize / 2 : 0);

    ctx.save();
    let strokeColor = palette.doorSolid;
    ctx.lineWidth = 3.5;

    if (door.type === 'archway') {
      strokeColor = palette.doorArch;
      ctx.setLineDash([4, 3]);
    } else if (door.type === 'secret') {
      strokeColor = palette.doorSecretGM;
      ctx.setLineDash([3, 2]);
    } else if (door.type === 'locked') {
      strokeColor = palette.doorLocked;
    } else if (door.type === 'trapped') {
      strokeColor = palette.doorTrapped;
    }

    ctx.strokeStyle = strokeColor;
    ctx.beginPath();
    if (isH) {
      ctx.moveTo(door.x * cellSize, cellMidY);
      ctx.lineTo((door.x + 1) * cellSize, cellMidY);
    } else {
      ctx.moveTo(cellMidX, door.y * cellSize);
      ctx.lineTo(cellMidX, (door.y + 1) * cellSize);
    }
    ctx.stroke();

    // Draw door symbol / tick
    if (door.type === 'double') {
      ctx.fillStyle = strokeColor;
      const mid = isH ? (door.x + 0.5) * cellSize : (door.y + 0.5) * cellSize;
      if (isH) {
        ctx.fillRect(mid - 1, cellMidY - 3, 2, 6);
      } else {
        ctx.fillRect(cellMidX - 3, mid - 1, 6, 2);
      }
    } else if (door.type === 'locked') {
      // Small padlock dot
      ctx.fillStyle = strokeColor;
      ctx.beginPath();
      ctx.arc(
        isH ? (door.x + 0.5) * cellSize : cellMidX,
        isH ? cellMidY : (door.y + 0.5) * cellSize,
        3,
        0,
        Math.PI * 2
      );
      ctx.fill();
    } else if (door.type === 'secret' && options.viewMode === 'gm') {
      // 'S' glyph for GM
      ctx.fillStyle = palette.doorSecretGM;
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(
        'S',
        isH ? (door.x + 0.5) * cellSize : cellMidX,
        isH ? cellMidY : (door.y + 0.5) * cellSize
      );
    }

    // Highlight selected door
    if (options.selectedDoorId === door.id) {
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 6;
      ctx.stroke();
    }

    ctx.restore();
  }

  // 7. Draw Interior Items
  for (const it of items) {
    const ix = it.x * cellSize + 2;
    const iy = it.y * cellSize + 2;
    const iw = it.width * cellSize - 4;
    const ih = it.height * cellSize - 4;

    ctx.save();
    ctx.fillStyle = palette.itemFill;
    ctx.strokeStyle = palette.itemStroke;
    ctx.lineWidth = 1.5;

    ctx.fillRect(ix, iy, iw, ih);
    ctx.strokeRect(ix, iy, iw, ih);

    // Mini icon glyph
    ctx.fillStyle = palette.itemStroke;
    ctx.font = '9px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    let glyph = '■';
    if (it.type === 'chest') glyph = '⊞';
    else if (it.type === 'altar') glyph = '⛩';
    else if (it.type === 'pillar') glyph = '●';
    else if (it.type === 'stairs_up') glyph = '▲';
    else if (it.type === 'stairs_down') glyph = '▼';
    else if (it.type === 'fountain') glyph = '≋';
    else if (it.type === 'table') glyph = '▭';
    else if (it.type === 'bookshelf') glyph = '▤';
    else if (it.type === 'sarcophagus') glyph = '✝';

    ctx.fillText(glyph, ix + iw / 2, iy + ih / 2);

    if (options.selectedItemId === it.id) {
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2.5;
      ctx.strokeRect(ix - 2, iy - 2, iw + 4, ih + 4);
    }

    ctx.restore();
  }

  // 8. Draw Room Labels (if enabled)
  if (options.showLabels) {
    ctx.save();
    ctx.font = palette.labelFont;
    ctx.fillStyle = palette.labelFill;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (let i = 0; i < rooms.length; i++) {
      const r = rooms[i];
      const cx = (r.x + r.width / 2) * cellSize;
      const cy = (r.y + r.height / 2) * cellSize;

      // Room index number badge + name
      ctx.fillText(`${i + 1}. ${r.name}`, cx, cy);
    }
    ctx.restore();
  }

  // 9. Draw Validation Diagnostic Pins (if highlightIssues is enabled)
  if (options.highlightIssues && validation.issues.length > 0) {
    ctx.save();
    for (const issue of validation.issues) {
      if (issue.coordinates) {
        const px = issue.coordinates.x * cellSize + cellSize / 2;
        const py = issue.coordinates.y * cellSize + cellSize / 2;

        ctx.fillStyle = issue.severity === 'critical' ? '#ef4444' : '#f59e0b';
        ctx.beginPath();
        ctx.arc(px, py, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 9px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('!', px, py);
      }
    }
    ctx.restore();
  }

  ctx.restore();
}
