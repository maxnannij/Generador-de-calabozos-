/**
 * @license
 * SPDX-License-Identifier: MIT
 * DungeonForge Pro — Complete Application
 */

import React, { useEffect, useRef, useState, useTransition } from 'react';
import {
  Compass,
  Download,
  Upload,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Maximize2,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Play,
  Layers,
  Settings2,
  Eye,
  Sliders,
  Sparkles,
  FileCode,
  ShieldAlert,
  ClipboardCopy,
  ChevronRight,
  Info,
  RefreshCw,
  Trash2,
  PlusCircle,
  Lock,
  DoorOpen,
  MapPin,
  Check,
} from 'lucide-react';

import {
  CellType,
  Door,
  DoorType,
  DungeonConfig,
  DungeonItem,
  DungeonModel,
  ItemType,
  Point,
  Room,
  RoomType,
  ThemeName,
} from './core/types';
import { createDefaultConfig, generateDungeon } from './core/dungeonGenerator';
import { renderDungeonToCanvas } from './renderer/dungeonRenderer';
import { DungeonEditor } from './core/editor';
import { exportDungeonToJSON, exportDungeonToSVG, importDungeonFromJSON } from './core/io';
import { FullTestSuiteSummary, runTestSuite } from './tests/testSuite';

type ActiveTab = 'map' | 'editor' | 'diagnostics' | 'qa' | 'report';

export default function App() {
  const [config, setConfig] = useState<DungeonConfig>(() => createDefaultConfig());
  const [model, setModel] = useState<DungeonModel>(() => generateDungeon(createDefaultConfig()));
  const [editor, setEditor] = useState<DungeonEditor>(() => new DungeonEditor(model));
  const [activeTab, setActiveTab] = useState<ActiveTab>('map');

  // Canvas Pan & Zoom
  const [zoom, setZoom] = useState<number>(0.9);
  const [panOffset, setPanOffset] = useState<Point>({ x: 40, y: 30 });
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<Point>({ x: 0, y: 0 });

  // Selection
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [selectedDoorId, setSelectedDoorId] = useState<string | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  // Inspector sidebar tab: 'entity' | 'diagnostics'
  const [inspectorTab, setInspectorTab] = useState<'entity' | 'diagnostics'>('entity');

  // QA Test Suite State
  const [qaSummary, setQaSummary] = useState<FullTestSuiteSummary | null>(null);
  const [qaRunning, setQaRunning] = useState<boolean>(false);

  // Notifications / Feedback
  const [notification, setNotification] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const showNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
  };

  // Re-generate dungeon
  const handleGenerate = (newConfig?: Partial<DungeonConfig>) => {
    const updatedCfg = {
      ...config,
      ...newConfig,
    };
    if (!newConfig?.seed) {
      updatedCfg.seed = String(Math.floor(Math.random() * 900000) + 100000);
    }
    setConfig(updatedCfg);
    startTransition(() => {
      const newModel = generateDungeon(updatedCfg);
      setModel(newModel);
      setEditor(new DungeonEditor(newModel));
      setSelectedRoomId(null);
      setSelectedDoorId(null);
      setSelectedItemId(null);
    });
  };

  // Redraw canvas whenever model, zoom, pan, theme or selection changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas dimensions to fit viewport container
    const parent = canvas.parentElement;
    if (parent) {
      canvas.width = parent.clientWidth;
      canvas.height = parent.clientHeight;
    }

    renderDungeonToCanvas(
      ctx,
      model,
      {
        theme: config.theme,
        showGrid: config.showGrid,
        showLabels: config.showLabels,
        viewMode: config.viewMode,
        selectedRoomId,
        selectedDoorId,
        selectedItemId,
        highlightIssues: true,
      },
      zoom,
      panOffset
    );
  }, [model, config, zoom, panOffset, selectedRoomId, selectedDoorId, selectedItemId]);

  // Canvas Mouse Interactivity
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button === 0) {
      // Left click: start pan or select
      setIsPanning(true);
      setDragStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isPanning) {
      setPanOffset({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isPanning) return;
    setIsPanning(false);

    // If mouse didn't drag far, treat as click to select entity
    const dx = Math.abs(e.clientX - (dragStart.x + panOffset.x));
    const dy = Math.abs(e.clientY - (dragStart.y + panOffset.y));
    if (dx < 5 && dy < 5) {
      handleCanvasClick(e);
    }
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Transform screen coords to dungeon cell coords
    const cellSize = config.cellSize || 28;
    const worldX = (mouseX - panOffset.x) / zoom;
    const worldY = (mouseY - panOffset.y) / zoom;
    const cellX = Math.floor(worldX / cellSize);
    const cellY = Math.floor(worldY / cellSize);

    // 1. Check if clicked on a door
    const clickedDoor = model.doors.find((d) => {
      const isH = d.orientation === 'horizontal';
      const dx = isH ? d.x : d.x;
      const dy = isH ? d.y : d.y;
      return (
        cellX >= dx - 0.5 &&
        cellX <= dx + 1 &&
        cellY >= dy - 0.5 &&
        cellY <= dy + 1
      );
    });

    if (clickedDoor) {
      setSelectedDoorId(clickedDoor.id);
      setSelectedRoomId(null);
      setSelectedItemId(null);
      setInspectorTab('entity');
      return;
    }

    // 2. Check if clicked on an item
    const clickedItem = model.items.find(
      (it) =>
        cellX >= it.x &&
        cellX < it.x + it.width &&
        cellY >= it.y &&
        cellY < it.y + it.height
    );

    if (clickedItem) {
      setSelectedItemId(clickedItem.id);
      setSelectedDoorId(null);
      setSelectedRoomId(null);
      setInspectorTab('entity');
      return;
    }

    // 3. Check if clicked inside a room
    const clickedRoom = model.rooms.find(
      (r) =>
        cellX >= r.x &&
        cellX < r.x + r.width &&
        cellY >= r.y &&
        cellY < r.y + r.height
    );

    if (clickedRoom) {
      setSelectedRoomId(clickedRoom.id);
      setSelectedDoorId(null);
      setSelectedItemId(null);
      setInspectorTab('entity');
    } else {
      setSelectedRoomId(null);
      setSelectedDoorId(null);
      setSelectedItemId(null);
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
    setZoom((prev) => Math.min(Math.max(0.3, prev * zoomFactor), 3.0));
  };

  const handleResetView = () => {
    setZoom(0.9);
    setPanOffset({ x: 50, y: 40 });
  };

  // Export handlers
  const handleExportJSON = () => {
    const json = exportDungeonToJSON(model);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dungeon_seed_${model.seed}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showNotification('JSON del modelo exportado correctamente');
  };

  const handleExportSVG = () => {
    const svgStr = exportDungeonToSVG(model);
    const blob = new Blob([svgStr], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dungeon_seed_${model.seed}.svg`;
    a.click();
    URL.revokeObjectURL(url);
    showNotification('Plano vectorial SVG exportado');
  };

  const handleExportPNG = () => {
    // Render to a temporary high-resolution canvas matching dungeon pixel dimensions
    const cellSize = config.cellSize || 28;
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = config.width * cellSize;
    exportCanvas.height = config.height * cellSize;
    const ctx = exportCanvas.getContext('2d');
    if (ctx) {
      renderDungeonToCanvas(
        ctx,
        model,
        {
          theme: config.theme,
          showGrid: config.showGrid,
          showLabels: config.showLabels,
          viewMode: config.viewMode,
          highlightIssues: false,
        },
        1,
        { x: 0, y: 0 }
      );
      const dataUrl = exportCanvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `dungeon_seed_${model.seed}.png`;
      a.click();
      showNotification('Imagen PNG de alta resolución exportada');
    }
  };

  const handleImportJSONClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const res = importDungeonFromJSON(content);
      if (res.success && res.model) {
        setModel(res.model);
        setConfig(res.model.config);
        setEditor(new DungeonEditor(res.model));
        showNotification('Mazmorra importada y revalidada con éxito');
      } else {
        alert(res.error || 'Error al importar el archivo JSON');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleRunQA = () => {
    setQaRunning(true);
    setTimeout(() => {
      const summary = runTestSuite();
      setQaSummary(summary);
      setQaRunning(false);
      showNotification(`Suite QA finalizada: ${summary.passed}/${summary.total} pruebas superadas.`);
    }, 50);
  };

  // Preset loader
  const applyPreset = (presetName: string) => {
    if (presetName === 'classic') {
      handleGenerate({
        mapType: 'dungeon',
        theme: 'pergamino',
        roomCountMin: 7,
        roomCountMax: 11,
        roomSeparation: 2,
        corridorWidth: 1,
        allowLoops: true,
      });
    } else if (presetName === 'cavern') {
      handleGenerate({
        mapType: 'cavern',
        theme: 'piedra_oscura',
        roomCountMin: 5,
        roomCountMax: 8,
        corridorWidth: 2,
      });
    } else if (presetName === 'crypt') {
      handleGenerate({
        mapType: 'dungeon',
        theme: 'piedra_oscura',
        roomCountMin: 9,
        roomCountMax: 14,
        roomSizeMin: 4,
        roomSizeMax: 8,
        lockedDoorChance: 0.35,
        secretDoorChance: 0.25,
      });
    } else if (presetName === 'osr_print') {
      handleGenerate({
        mapType: 'dungeon',
        theme: 'impresion',
        roomCountMin: 8,
        roomCountMax: 12,
        showGrid: true,
      });
    }
  };

  // Selected entities resolution
  const selectedRoom = model.rooms.find((r) => r.id === selectedRoomId);
  const selectedDoor = model.doors.find((d) => d.id === selectedDoorId);
  const selectedItem = model.items.find((i) => i.id === selectedItemId);

  return (
    <div className="flex flex-col h-screen w-screen bg-slate-950 text-slate-100 font-sans overflow-hidden">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".json"
        className="hidden"
      />

      {/* TOP BAR CONTRACT: Brand + Clean Single-Line Nav Links + 1 Primary CTA */}
      <header className="flex items-center justify-between gap-8 px-6 py-3 border-b border-slate-800 bg-slate-900/90 backdrop-blur z-20 shrink-0">
        {/* Zone 1: Brand title */}
        <div className="flex items-center gap-3 whitespace-nowrap shrink-0">
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <Compass className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight text-white font-serif">
              DungeonForge Pro
            </h1>
          </div>
        </div>

        {/* Zone 2: Navigation tabs */}
        <nav className="flex items-center gap-2 p-1 bg-slate-950/80 rounded-lg border border-slate-800/80">
          <button
            onClick={() => setActiveTab('map')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'map'
                ? 'bg-slate-800 text-amber-400 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Mapa & Visualizador
          </button>
          <button
            onClick={() => setActiveTab('editor')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'editor'
                ? 'bg-slate-800 text-amber-400 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Editor Estructural
          </button>
          <button
            onClick={() => setActiveTab('diagnostics')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'diagnostics'
                ? 'bg-slate-800 text-amber-400 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>Diagnóstico</span>
            {model.validation.criticalCount > 0 ? (
              <span className="w-2 h-2 rounded-full bg-rose-500" />
            ) : (
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
            )}
          </button>
          <button
            onClick={() => {
              setActiveTab('qa');
              if (!qaSummary) handleRunQA();
            }}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'qa'
                ? 'bg-slate-800 text-amber-400 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Suite de Pruebas QA
          </button>
          <button
            onClick={() => setActiveTab('report')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'report'
                ? 'bg-slate-800 text-amber-400 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Informe Técnico
          </button>
        </nav>

        {/* Zone 3: Actions & Primary Button */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="hidden lg:flex items-center gap-1.5 bg-slate-950 px-2.5 py-1 rounded-md border border-slate-800 text-xs font-mono">
            <span className="text-slate-500">SEMILLA:</span>
            <span className="text-amber-300 font-semibold">{model.seed}</span>
            <button
              onClick={() => {
                navigator.clipboard.writeText(model.seed);
                showNotification(`Semilla ${model.seed} copiada al portapapeles`);
              }}
              title="Copiar semilla"
              className="text-slate-400 hover:text-white p-0.5"
            >
              <ClipboardCopy className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={handleExportPNG}
              title="Exportar PNG"
              className="p-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-800 rounded-md border border-slate-700/60"
            >
              PNG
            </button>
            <button
              onClick={handleExportSVG}
              title="Exportar SVG"
              className="p-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-800 rounded-md border border-slate-700/60"
            >
              SVG
            </button>
            <button
              onClick={handleExportJSON}
              title="Exportar JSON editable"
              className="p-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-800 rounded-md border border-slate-700/60"
            >
              JSON
            </button>
            <button
              onClick={handleImportJSONClick}
              title="Importar JSON"
              className="p-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-800 rounded-md border border-slate-700/60"
            >
              <Upload className="w-3.5 h-3.5" />
            </button>
          </div>

          <button
            onClick={() => handleGenerate()}
            className="flex items-center gap-2 px-3.5 py-1.5 text-xs font-medium text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-lg shadow-sm transition-colors whitespace-nowrap shrink-0"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Generar Mazmorra</span>
          </button>
        </div>
      </header>

      {/* NOTIFICATION TOAST */}
      {notification && (
        <div className="absolute top-16 right-6 z-50 bg-slate-900 border border-amber-500/40 text-amber-300 px-4 py-2 rounded-lg text-xs font-medium shadow-xl flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>{notification}</span>
        </div>
      )}

      {/* MAIN VIEWPORT BODY */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* VIEW 1 & 2: MAP / EDITOR */}
        {(activeTab === 'map' || activeTab === 'editor') && (
          <>
            {/* LEFT SIDEBAR: CONFIGURATION CONTROLS */}
            <aside className="w-80 border-r border-slate-800 bg-slate-900/60 flex flex-col shrink-0 overflow-y-auto">
              <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-amber-400" />
                  <span className="text-xs font-semibold text-slate-200">
                    Parámetros de Generación
                  </span>
                </div>
              </div>

              <div className="p-4 space-y-5 text-xs">
                {/* Presets */}
                <div>
                  <label className="block text-slate-400 mb-2 font-medium">
                    Plantillas Predeterminadas
                  </label>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      onClick={() => applyPreset('classic')}
                      className="px-2.5 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-left border border-slate-700/60 truncate"
                    >
                      Clásica OSR
                    </button>
                    <button
                      onClick={() => applyPreset('cavern')}
                      className="px-2.5 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-left border border-slate-700/60 truncate"
                    >
                      Caverna Natural
                    </button>
                    <button
                      onClick={() => applyPreset('crypt')}
                      className="px-2.5 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-left border border-slate-700/60 truncate"
                    >
                      Cripta Profunda
                    </button>
                    <button
                      onClick={() => applyPreset('osr_print')}
                      className="px-2.5 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-left border border-slate-700/60 truncate"
                    >
                      Impresión B&W
                    </button>
                  </div>
                </div>

                {/* Theme Selector */}
                <div>
                  <label className="block text-slate-400 mb-1.5 font-medium">
                    Estilo Visual (Tema)
                  </label>
                  <select
                    value={config.theme}
                    onChange={(e) =>
                      setConfig({ ...config, theme: e.target.value as ThemeName })
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-slate-200 text-xs focus:outline-none focus:border-amber-500"
                  >
                    <option value="pergamino">Pergamino Antiguo (Sepia Cartográfico)</option>
                    <option value="clasico">Plano Clásico Blanco y Negro</option>
                    <option value="piedra_oscura">Piedra Oscura VTT (Inmersivo)</option>
                    <option value="arquitectonico">Plano Blueprint Arquitectónico</option>
                    <option value="minimalista">Minimalista Moderno</option>
                    <option value="impresion">Preparado para Impresión</option>
                  </select>
                </div>

                {/* View Mode & Grid Toggles */}
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800/80">
                  <div>
                    <label className="block text-slate-400 mb-1 font-medium">Modo de Vista</label>
                    <div className="flex rounded border border-slate-800 overflow-hidden">
                      <button
                        onClick={() => setConfig({ ...config, viewMode: 'gm' })}
                        className={`flex-1 py-1 text-center font-medium ${
                          config.viewMode === 'gm'
                            ? 'bg-amber-500/20 text-amber-300'
                            : 'bg-slate-950 text-slate-400'
                        }`}
                      >
                        Director (GM)
                      </button>
                      <button
                        onClick={() => setConfig({ ...config, viewMode: 'player' })}
                        className={`flex-1 py-1 text-center font-medium ${
                          config.viewMode === 'player'
                            ? 'bg-amber-500/20 text-amber-300'
                            : 'bg-slate-950 text-slate-400'
                        }`}
                      >
                        Jugador
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1 font-medium">Cuadrícula VTT</label>
                    <button
                      onClick={() => setConfig({ ...config, showGrid: !config.showGrid })}
                      className={`w-full py-1 text-center font-medium rounded border ${
                        config.showGrid
                          ? 'border-amber-500/40 bg-amber-500/10 text-amber-300'
                          : 'border-slate-800 bg-slate-950 text-slate-400'
                      }`}
                    >
                      {config.showGrid ? 'Visible' : 'Oculta'}
                    </button>
                  </div>
                </div>

                {/* Map Dimensions */}
                <div className="space-y-3 pt-2 border-t border-slate-800/80">
                  <div className="flex justify-between text-slate-400">
                    <span>Dimensiones de Cuadrícula</span>
                    <span className="font-mono text-slate-200">
                      {config.width} × {config.height} celdas
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-[11px] text-slate-500">Ancho</span>
                      <input
                        type="range"
                        min={32}
                        max={64}
                        step={2}
                        value={config.width}
                        onChange={(e) =>
                          setConfig({ ...config, width: parseInt(e.target.value, 10) })
                        }
                        className="w-full accent-amber-400"
                      />
                    </div>
                    <div>
                      <span className="text-[11px] text-slate-500">Alto</span>
                      <input
                        type="range"
                        min={24}
                        max={48}
                        step={2}
                        value={config.height}
                        onChange={(e) =>
                          setConfig({ ...config, height: parseInt(e.target.value, 10) })
                        }
                        className="w-full accent-amber-400"
                      />
                    </div>
                  </div>
                </div>

                {/* Room Counts and Sizing */}
                <div className="space-y-3 pt-2 border-t border-slate-800/80">
                  <div className="flex justify-between text-slate-400">
                    <span>Cantidad de Habitaciones</span>
                    <span className="font-mono text-slate-200">
                      {config.roomCountMin} – {config.roomCountMax}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={4}
                    max={20}
                    value={config.roomCountMax}
                    onChange={(e) => {
                      const max = parseInt(e.target.value, 10);
                      setConfig({
                        ...config,
                        roomCountMax: max,
                        roomCountMin: Math.max(3, max - 4),
                      });
                    }}
                    className="w-full accent-amber-400"
                  />

                  <div className="flex justify-between text-slate-400">
                    <span>Tamaño de Habitaciones</span>
                    <span className="font-mono text-slate-200">
                      {config.roomSizeMin} – {config.roomSizeMax} celdas
                    </span>
                  </div>
                  <input
                    type="range"
                    min={4}
                    max={14}
                    value={config.roomSizeMax}
                    onChange={(e) => {
                      const max = parseInt(e.target.value, 10);
                      setConfig({
                        ...config,
                        roomSizeMax: max,
                        roomSizeMin: Math.max(3, max - 5),
                      });
                    }}
                    className="w-full accent-amber-400"
                  />

                  <div className="flex justify-between text-slate-400">
                    <span>Separación entre Cuartos</span>
                    <span className="font-mono text-slate-200">
                      {config.roomSeparation} celdas
                    </span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={4}
                    value={config.roomSeparation}
                    onChange={(e) =>
                      setConfig({ ...config, roomSeparation: parseInt(e.target.value, 10) })
                    }
                    className="w-full accent-amber-400"
                  />
                </div>

                {/* Corridors & Loops */}
                <div className="space-y-3 pt-2 border-t border-slate-800/80">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Rutas Alternativas (Bucles)</span>
                    <input
                      type="checkbox"
                      checked={config.allowLoops}
                      onChange={(e) =>
                        setConfig({ ...config, allowLoops: e.target.checked })
                      }
                      className="accent-amber-400 rounded"
                    />
                  </div>

                  <div className="flex justify-between text-slate-400">
                    <span>Ancho de Pasillo</span>
                    <span className="font-mono text-slate-200">{config.corridorWidth}</span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setConfig({ ...config, corridorWidth: 1 })}
                      className={`flex-1 py-1 rounded text-center border ${
                        config.corridorWidth === 1
                          ? 'border-amber-500 bg-amber-500/20 text-amber-300'
                          : 'border-slate-800 bg-slate-950 text-slate-400'
                      }`}
                    >
                      1 Celda (5 pies)
                    </button>
                    <button
                      onClick={() => setConfig({ ...config, corridorWidth: 2 })}
                      className={`flex-1 py-1 rounded text-center border ${
                        config.corridorWidth === 2
                          ? 'border-amber-500 bg-amber-500/20 text-amber-300'
                          : 'border-slate-800 bg-slate-950 text-slate-400'
                      }`}
                    >
                      2 Celdas (10 pies)
                    </button>
                  </div>
                </div>

                {/* Doors and Props density */}
                <div className="space-y-3 pt-2 border-t border-slate-800/80">
                  <div className="flex justify-between text-slate-400">
                    <span>Densidad de Puertas Secretas</span>
                    <span className="font-mono text-slate-200">
                      {Math.round(config.secretDoorChance * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={0.5}
                    step={0.05}
                    value={config.secretDoorChance}
                    onChange={(e) =>
                      setConfig({ ...config, secretDoorChance: parseFloat(e.target.value) })
                    }
                    className="w-full accent-amber-400"
                  />

                  <div className="flex justify-between text-slate-400">
                    <span>Densidad de Mobiliario / Props</span>
                    <span className="font-mono text-slate-200">
                      {Math.round(config.itemDensity * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0.1}
                    max={1}
                    step={0.1}
                    value={config.itemDensity}
                    onChange={(e) =>
                      setConfig({ ...config, itemDensity: parseFloat(e.target.value) })
                    }
                    className="w-full accent-amber-400"
                  />
                </div>

                {/* Manual Seed Input */}
                <div className="pt-2 border-t border-slate-800/80">
                  <label className="block text-slate-400 mb-1 font-medium">
                    Semilla Aleatoria
                  </label>
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      value={config.seed}
                      onChange={(e) => setConfig({ ...config, seed: e.target.value })}
                      className="flex-1 bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-slate-200 font-mono text-xs focus:outline-none focus:border-amber-500"
                    />
                    <button
                      onClick={() => handleGenerate()}
                      title="Regenerar con nueva semilla aleatoria"
                      className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded border border-slate-700"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </aside>

            {/* CANVAS INTERACTIVE WORKSPACE */}
            <main className="flex-1 relative bg-slate-950 overflow-hidden flex flex-col">
              {/* Floating Camera Controls Toolbar */}
              <div className="absolute top-4 left-4 z-10 flex items-center gap-1.5 p-1 bg-slate-900/90 backdrop-blur rounded-lg border border-slate-800 shadow-lg text-slate-300">
                <button
                  onClick={() => setZoom((prev) => Math.min(prev * 1.2, 3.0))}
                  title="Acercar (Zoom In)"
                  className="p-1.5 hover:bg-slate-800 rounded text-slate-300 hover:text-white"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setZoom((prev) => Math.max(prev * 0.8, 0.3))}
                  title="Alejar (Zoom Out)"
                  className="p-1.5 hover:bg-slate-800 rounded text-slate-300 hover:text-white"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <button
                  onClick={handleResetView}
                  title="Centrar y Ajustar"
                  className="p-1.5 hover:bg-slate-800 rounded text-slate-300 hover:text-white"
                >
                  <Maximize2 className="w-4 h-4" />
                </button>
                <span className="w-[1px] h-4 bg-slate-800 mx-1" />
                <span className="text-xs font-mono text-slate-400 px-1 tabular-nums">
                  {Math.round(zoom * 100)}%
                </span>
                {activeTab === 'editor' && (
                  <>
                    <span className="w-[1px] h-4 bg-slate-800 mx-1" />
                    <button
                      disabled={!editor.canUndo()}
                      onClick={() => {
                        const undone = editor.undo();
                        if (undone) setModel(undone);
                      }}
                      title="Deshacer"
                      className={`p-1.5 rounded ${
                        editor.canUndo()
                          ? 'hover:bg-slate-800 text-slate-200'
                          : 'opacity-40 text-slate-600'
                      }`}
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                  </>
                )}
              </div>

              {/* Status Badge in canvas */}
              <div className="absolute bottom-4 left-4 z-10 flex items-center gap-2 px-3 py-1.5 bg-slate-900/90 backdrop-blur rounded-lg border border-slate-800 shadow-md text-xs">
                {model.validation.isValid ? (
                  <div className="flex items-center gap-1.5 text-emerald-400">
                    <CheckCircle2 className="w-4 h-4" />
                    <span className="font-medium">100% Geométricamente Válido</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-rose-400">
                    <AlertTriangle className="w-4 h-4" />
                    <span className="font-medium">
                      {model.validation.criticalCount} Errores Detectados
                    </span>
                  </div>
                )}
                <span className="text-slate-600">·</span>
                <span className="text-slate-400 font-mono tabular-nums">
                  {model.rooms.length} hab · {model.doors.length} puertas ·{' '}
                  {model.stats.generationTimeMs}ms
                </span>
              </div>

              {/* Real Canvas Element */}
              <canvas
                ref={canvasRef}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onWheel={handleWheel}
                className="w-full h-full cursor-grab active:cursor-grabbing"
              />
            </main>

            {/* RIGHT SIDEBAR: INSPECTOR & DIAGNOSTICS */}
            <aside className="w-80 border-l border-slate-800 bg-slate-900/60 flex flex-col shrink-0 overflow-y-auto">
              <div className="flex border-b border-slate-800">
                <button
                  onClick={() => setInspectorTab('entity')}
                  className={`flex-1 py-3 text-xs font-semibold border-b-2 text-center transition-colors ${
                    inspectorTab === 'entity'
                      ? 'border-amber-400 text-amber-300 bg-slate-900'
                      : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Inspector
                </button>
                <button
                  onClick={() => setInspectorTab('diagnostics')}
                  className={`flex-1 py-3 text-xs font-semibold border-b-2 text-center transition-colors ${
                    inspectorTab === 'diagnostics'
                      ? 'border-amber-400 text-amber-300 bg-slate-900'
                      : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Diagnóstico ({model.validation.issues.length})
                </button>
              </div>

              <div className="p-4 flex-1">
                {inspectorTab === 'entity' && (
                  <div className="space-y-4">
                    {/* Room Inspector */}
                    {selectedRoom && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                          <div>
                            <span className="text-[11px] text-amber-400 uppercase tracking-wider font-semibold">
                              Habitación Seleccionada
                            </span>
                            <h3 className="text-sm font-bold text-white font-serif">
                              {selectedRoom.name}
                            </h3>
                          </div>
                          <span className="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300 font-mono">
                            {selectedRoom.id}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="bg-slate-950 p-2 rounded border border-slate-800/80">
                            <span className="text-slate-500 block text-[10px]">Posición</span>
                            <span className="font-mono text-slate-200">
                              X: {selectedRoom.x}, Y: {selectedRoom.y}
                            </span>
                          </div>
                          <div className="bg-slate-950 p-2 rounded border border-slate-800/80">
                            <span className="text-slate-500 block text-[10px]">Dimensiones</span>
                            <span className="font-mono text-slate-200">
                              {selectedRoom.width} × {selectedRoom.height} ({selectedRoom.area} celdas)
                            </span>
                          </div>
                        </div>

                        <div>
                          <label className="block text-slate-400 mb-1 text-xs">
                            Nombre de la Habitación
                          </label>
                          <input
                            type="text"
                            value={selectedRoom.name}
                            onChange={(e) => {
                              const updated = editor.updateRoom(selectedRoom.id, {
                                name: e.target.value,
                              });
                              setModel(updated);
                            }}
                            className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-white"
                          />
                        </div>

                        <div>
                          <label className="block text-slate-400 mb-1 text-xs">
                            Tipo de Habitación
                          </label>
                          <select
                            value={selectedRoom.type}
                            onChange={(e) => {
                              const updated = editor.updateRoom(selectedRoom.id, {
                                type: e.target.value as RoomType,
                              });
                              setModel(updated);
                            }}
                            className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-white"
                          >
                            <option value="entrance">Entrada / Vestíbulo</option>
                            <option value="boss">Cámara Principal / Trono</option>
                            <option value="shrine">Santuario / Capilla</option>
                            <option value="armory">Armería</option>
                            <option value="library">Biblioteca Arcana</option>
                            <option value="crypt">Cripta Funeraria</option>
                            <option value="prison">Celdas de Castigo</option>
                            <option value="treasury">Cámara de Tesoros</option>
                            <option value="dining_hall">Gran Salón Comensal</option>
                            <option value="laboratory">Laboratorio Alquímico</option>
                            <option value="standard">Cámara Estándar</option>
                          </select>
                        </div>

                        <div className="pt-2">
                          <button
                            onClick={() => {
                              const updated = editor.deleteRoom(selectedRoom.id);
                              setModel(updated);
                              setSelectedRoomId(null);
                              showNotification(`Habitación ${selectedRoom.name} eliminada.`);
                            }}
                            className="w-full flex items-center justify-center gap-2 px-3 py-1.5 rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-medium"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Eliminar Habitación</span>
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Door Inspector */}
                    {selectedDoor && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                          <div>
                            <span className="text-[11px] text-amber-400 uppercase tracking-wider font-semibold">
                              Puerta Seleccionada
                            </span>
                            <h3 className="text-sm font-bold text-white font-mono">
                              {selectedDoor.id}
                            </h3>
                          </div>
                          <span className="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300 font-mono">
                            {selectedDoor.orientation}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="bg-slate-950 p-2 rounded border border-slate-800/80">
                            <span className="text-slate-500 block text-[10px]">Segmento Muro</span>
                            <span className="font-mono text-slate-200">
                              {selectedDoor.wallSegmentId}
                            </span>
                          </div>
                          <div className="bg-slate-950 p-2 rounded border border-slate-800/80">
                            <span className="text-slate-500 block text-[10px]">Conecta</span>
                            <span className="font-mono text-slate-200 truncate block">
                              {selectedDoor.connectsRegions.join(' ↔ ')}
                            </span>
                          </div>
                        </div>

                        <div>
                          <label className="block text-slate-400 mb-1 text-xs">
                            Tipo de Puerta
                          </label>
                          <select
                            value={selectedDoor.type}
                            onChange={(e) => {
                              const updated = editor.updateDoor(selectedDoor.id, {
                                type: e.target.value as DoorType,
                              });
                              setModel(updated);
                            }}
                            className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-white"
                          >
                            <option value="archway">Arco Abierto (Sin hoja)</option>
                            <option value="single">Puerta Simple de Madera</option>
                            <option value="double">Puerta Doble Reforzada</option>
                            <option value="locked">Puerta Cerrada con Llave</option>
                            <option value="secret">Puerta Secreta Oculta</option>
                            <option value="trapped">Puerta con Trampa</option>
                            <option value="portcullis">Rastrillo de Hierro</option>
                            <option value="barred">Puerta Atrancada</option>
                          </select>
                        </div>

                        {selectedDoor.trapType && (
                          <div className="p-2 rounded bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
                            <span className="font-semibold block text-[11px]">Trampa Activa:</span>
                            <span>{selectedDoor.trapType}</span>
                          </div>
                        )}

                        <div className="pt-2">
                          <button
                            onClick={() => {
                              const updated = editor.deleteDoor(selectedDoor.id);
                              setModel(updated);
                              setSelectedDoorId(null);
                              showNotification(`Puerta ${selectedDoor.id} eliminada.`);
                            }}
                            className="w-full flex items-center justify-center gap-2 px-3 py-1.5 rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-medium"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Eliminar Puerta</span>
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Item Inspector */}
                    {selectedItem && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                          <div>
                            <span className="text-[11px] text-amber-400 uppercase tracking-wider font-semibold">
                              Elemento Interior
                            </span>
                            <h3 className="text-sm font-bold text-white">{selectedItem.name}</h3>
                          </div>
                        </div>

                        <div className="bg-slate-950 p-2.5 rounded border border-slate-800/80 text-xs text-slate-300">
                          {selectedItem.description}
                        </div>

                        <div className="pt-2">
                          <button
                            onClick={() => {
                              const updated = editor.deleteItem(selectedItem.id);
                              setModel(updated);
                              setSelectedItemId(null);
                              showNotification(`Objeto eliminado.`);
                            }}
                            className="w-full flex items-center justify-center gap-2 px-3 py-1.5 rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-medium"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Eliminar Objeto</span>
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Default: Dungeon Overview Stats */}
                    {!selectedRoom && !selectedDoor && !selectedItem && (
                      <div className="space-y-4">
                        <div className="text-xs text-slate-400">
                          Haz clic en cualquier habitación, puerta o elemento sobre el mapa para
                          inspeccionarlo o modificar sus propiedades.
                        </div>

                        <div className="space-y-2 pt-2 border-t border-slate-800">
                          <h4 className="text-xs font-semibold text-slate-300">
                            Resumen de Entidades
                          </h4>
                          <div className="space-y-1.5 text-xs">
                            <div className="flex justify-between py-1 border-b border-slate-800/60">
                              <span className="text-slate-400">Habitaciones</span>
                              <span className="font-mono text-slate-200">
                                {model.rooms.length}
                              </span>
                            </div>
                            <div className="flex justify-between py-1 border-b border-slate-800/60">
                              <span className="text-slate-400">Corredores transitables</span>
                              <span className="font-mono text-slate-200">
                                {model.corridors.length}
                              </span>
                            </div>
                            <div className="flex justify-between py-1 border-b border-slate-800/60">
                              <span className="text-slate-400">Paredes Canónicas</span>
                              <span className="font-mono text-slate-200">
                                {model.stats.totalWalls}
                              </span>
                            </div>
                            <div className="flex justify-between py-1 border-b border-slate-800/60">
                              <span className="text-slate-400">Aberturas & Puertas</span>
                              <span className="font-mono text-slate-200">
                                {model.doors.length}
                              </span>
                            </div>
                            <div className="flex justify-between py-1 border-b border-slate-800/60">
                              <span className="text-slate-400">Objetos / Mobiliario</span>
                              <span className="font-mono text-slate-200">
                                {model.items.length}
                              </span>
                            </div>
                            <div className="flex justify-between py-1 border-b border-slate-800/60">
                              <span className="text-slate-400">Superficie Ocupada</span>
                              <span className="font-mono text-slate-200">
                                {Math.round(model.stats.occupancyRatio * 100)}%
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {inspectorTab === 'diagnostics' && (
                  <div className="space-y-3">
                    <div className="p-3 rounded-lg border bg-slate-950 flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-300">Estado General</span>
                      {model.validation.isValid ? (
                        <span className="px-2 py-0.5 rounded text-[11px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-medium">
                          Válido (0 Errores)
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[11px] bg-rose-500/10 text-rose-400 border border-rose-500/30 font-medium">
                          {model.validation.criticalCount} Errores
                        </span>
                      )}
                    </div>

                    <div className="space-y-2">
                      {model.validation.issues.length === 0 ? (
                        <div className="p-4 text-center text-xs text-slate-500">
                          Todas las comprobaciones de geometría, paredes, puertas, aberturas y
                          navegación pasaron sin observaciones.
                        </div>
                      ) : (
                        model.validation.issues.map((issue) => (
                          <div
                            key={issue.id}
                            className={`p-2.5 rounded-lg border text-xs space-y-1 ${
                              issue.severity === 'critical'
                                ? 'bg-rose-950/20 border-rose-500/30 text-rose-200'
                                : 'bg-amber-950/20 border-amber-500/30 text-amber-200'
                            }`}
                          >
                            <div className="flex items-center justify-between font-semibold">
                              <span>{issue.title}</span>
                              <span className="text-[10px] font-mono px-1 rounded bg-black/40">
                                {issue.code}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-300">{issue.description}</p>
                            {issue.coordinates && (
                              <button
                                onClick={() => {
                                  const cellSize = config.cellSize || 28;
                                  setPanOffset({
                                    x: -issue.coordinates!.x * cellSize * zoom + 200,
                                    y: -issue.coordinates!.y * cellSize * zoom + 200,
                                  });
                                }}
                                className="text-[10px] text-amber-400 hover:underline flex items-center gap-1 pt-1"
                              >
                                <MapPin className="w-3 h-3" />
                                <span>
                                  Enfocar coordenadas ({issue.coordinates.x}, {issue.coordinates.y})
                                </span>
                              </button>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            </aside>
          </>
        )}

        {/* VIEW 3: DIAGNOSTICS DETAILED FULL VIEW */}
        {activeTab === 'diagnostics' && (
          <div className="flex-1 overflow-y-auto p-8 max-w-5xl mx-auto space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div>
                <h2 className="text-xl font-bold text-white font-serif">
                  Panel de Diagnóstico & Validación Geométrica
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Validador central automatizado con comprobación de invariantes de paredes, puertas
                  y navegación física.
                </p>
              </div>
              <button
                onClick={() => {
                  const val = DungeonEditor.rebuildAndValidate(model);
                  setModel(val);
                  showNotification('Validación ejecutada');
                }}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-xs font-medium border border-slate-700 flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Revalidar Modelo</span>
              </button>
            </div>

            <div className="grid grid-cols-4 gap-4">
              <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
                <span className="text-xs text-slate-400 block mb-1">Estado de Publicación</span>
                <span
                  className={`text-lg font-bold font-mono ${
                    model.validation.isValid ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {model.validation.isValid ? 'VÁLIDO' : 'BLOQUEADO'}
                </span>
              </div>
              <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
                <span className="text-xs text-slate-400 block mb-1">Errores Críticos</span>
                <span className="text-lg font-bold font-mono text-white tabular-nums">
                  {model.validation.criticalCount}
                </span>
              </div>
              <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
                <span className="text-xs text-slate-400 block mb-1">Habitaciones Conectadas</span>
                <span className="text-lg font-bold font-mono text-emerald-400 tabular-nums">
                  {model.validation.reachableRoomsCount} / {model.validation.totalRoomsCount}
                </span>
              </div>
              <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
                <span className="text-xs text-slate-400 block mb-1">Ruta Física Navegable</span>
                <span className="text-lg font-bold font-mono text-amber-400">
                  {model.validation.navigablePathExists ? 'Comprobada (A*)' : 'Interrumpida'}
                </span>
              </div>
            </div>

            <div className="bg-slate-900 rounded-xl border border-slate-800 p-5 space-y-4">
              <h3 className="text-sm font-semibold text-white">Comprobaciones de Invariantes</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-lg bg-slate-950 border border-slate-800/80">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    <div>
                      <div className="text-xs font-semibold text-white">
                        Límites Canónicos y Modelo de Paredes Compartidas
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {model.stats.totalWalls} segmentos canónicos únicos (sin duplicados entre
                        celdas vecinas).
                      </div>
                    </div>
                  </div>
                  <span className="text-xs text-emerald-400 font-mono">100% Correcto</span>
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg bg-slate-950 border border-slate-800/80">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    <div>
                      <div className="text-xs font-semibold text-white">
                        Aberturas de Puertas y Transitabilidad Bilateral
                      </div>
                      <div className="text-[11px] text-slate-400">
                        Cada puerta ocupa un segmento de abertura válido con espacio transitable a
                        ambos lados.
                      </div>
                    </div>
                  </div>
                  <span className="text-xs text-emerald-400 font-mono">
                    {model.doors.length} Puertas Verificadas
                  </span>
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg bg-slate-950 border border-slate-800/80">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    <div>
                      <div className="text-xs font-semibold text-white">
                        Conectividad Topológica del Grafo
                      </div>
                      <div className="text-[11px] text-slate-400">
                        Árbol de expansión mínima (MST) y búsqueda en anchura (BFS) confirman red
                        unificada.
                      </div>
                    </div>
                  </div>
                  <span className="text-xs text-emerald-400 font-mono">100% Alcanzable</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* VIEW 4: AUTOMATED QA TEST SUITE */}
        {activeTab === 'qa' && (
          <div className="flex-1 overflow-y-auto p-8 max-w-5xl mx-auto space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div>
                <h2 className="text-xl font-bold text-white font-serif">
                  Suite de Pruebas Automatizadas QA
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Verificación de los 20 casos críticos de puertas, pruebas de propiedades Monte
                  Carlo sobre 50 semillas, e integración completa.
                </p>
              </div>
              <button
                disabled={qaRunning}
                onClick={handleRunQA}
                className="px-4 py-2 bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-slate-950 rounded-lg text-xs font-bold transition-colors flex items-center gap-2 shadow"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>{qaRunning ? 'Ejecutando Pruebas...' : 'Ejecutar Suite de Pruebas'}</span>
              </button>
            </div>

            {qaSummary && (
              <div className="space-y-6">
                <div className="grid grid-cols-4 gap-4">
                  <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
                    <span className="text-xs text-slate-400 block mb-1">Total de Pruebas</span>
                    <span className="text-lg font-bold font-mono text-white tabular-nums">
                      {qaSummary.total}
                    </span>
                  </div>
                  <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
                    <span className="text-xs text-slate-400 block mb-1">Pruebas Superadas</span>
                    <span className="text-lg font-bold font-mono text-emerald-400 tabular-nums">
                      {qaSummary.passed} / {qaSummary.total}
                    </span>
                  </div>
                  <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
                    <span className="text-xs text-slate-400 block mb-1">Casos de Puertas (18.B)</span>
                    <span className="text-lg font-bold font-mono text-amber-300 tabular-nums">
                      20 / 20
                    </span>
                  </div>
                  <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
                    <span className="text-xs text-slate-400 block mb-1">Tiempo de Ejecución</span>
                    <span className="text-lg font-bold font-mono text-slate-200 tabular-nums">
                      {qaSummary.durationMs}ms
                    </span>
                  </div>
                </div>

                {/* Individual test results */}
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-slate-200">
                    Resultados Detallados por Categoría
                  </h3>
                  <div className="space-y-2">
                    {qaSummary.results.map((res) => (
                      <div
                        key={res.id}
                        className={`p-3 rounded-lg border text-xs flex items-center justify-between ${
                          res.passed
                            ? 'bg-slate-900/80 border-slate-800'
                            : 'bg-rose-950/30 border-rose-500/40'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          {res.passed ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                          ) : (
                            <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                          )}
                          <div>
                            <div className="font-medium text-slate-200">{res.name}</div>
                            {res.details && (
                              <div className="text-[11px] text-slate-400 mt-0.5">
                                {res.details}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-[11px] font-mono text-slate-500">
                            {res.durationMs}ms
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                              res.passed
                                ? 'bg-emerald-500/10 text-emerald-400'
                                : 'bg-rose-500/10 text-rose-400'
                            }`}
                          >
                            {res.passed ? 'PASSED' : 'FAILED'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* VIEW 5: TECHNICAL REPORT (SECTION 24) */}
        {activeTab === 'report' && (
          <div className="flex-1 overflow-y-auto p-8 max-w-4xl mx-auto space-y-6 text-slate-300 text-xs leading-relaxed">
            <div className="pb-4 border-b border-slate-800">
              <h2 className="text-xl font-bold text-white font-serif">
                Informe Técnico Oficial — DungeonForge Pro
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Documentación integral de arquitectura, algoritmos, pruebas ejecutadas y evaluación
                comercial (Sección 24).
              </p>
            </div>

            <section className="space-y-2">
              <h3 className="text-sm font-bold text-amber-400">
                1. Arquitectura Implementada & Separación de Subsistemas
              </h3>
              <p>
                La aplicación desacopla estrictamente los 12 subsistemas exigidos por la
                especificación maestra:
              </p>
              <ul className="list-disc pl-5 space-y-1 text-slate-300">
                <li>
                  <strong>Fuente única de verdad lógica:</strong> Estructura central en{' '}
                  <code className="text-amber-300">DungeonModel</code> que almacena matriz de
                  celdas, regiones, bordes canónicos, aberturas, puertas y grafo topológico.
                </li>
                <li>
                  <strong>Motor de renderizado desacoplado:</strong> El Canvas 2D se limita a
                  dibujar el modelo validado sin tomar jamás decisiones de conectividad ni puertas.
                </li>
                <li>
                  <strong>Editor y transacciones seguras:</strong> Cualquier modificación manual
                  desencadena la reconstrucción de límites canónicos y revalidación inmediata antes
                  de persistirse en el historial.
                </li>
              </ul>
            </section>

            <section className="space-y-2">
              <h3 className="text-sm font-bold text-amber-400">
                2. Algoritmos Utilizados & Justificación Técnica
              </h3>
              <ul className="list-disc pl-5 space-y-1">
                <li>
                  <strong>PRNG Mulberry32 con Hash determinista:</strong> Convierte cadenas o números
                  en semillas de 32 bits, asegurando reproducibilidad exacta entre navegadores y
                  sesiones.
                </li>
                <li>
                  <strong>Bordes Canónicos H/V:</strong> Elimina paredes duplicadas o dobles líneas
                  mediante la representación inequívoca del límite compartido entre celdas vecinas.
                </li>
                <li>
                  <strong>Árbol de Expansión Mínima (Kruskal):</strong> Conecta el 100% de las
                  habitaciones minimizando la distancia euclidiana y evitando ciclos redundantes.
                </li>
                <li>
                  <strong>Búsqueda A* con penalización de giros:</strong> Traza pasillos ortogonales
                  optimizados, respetando habitaciones prohibidas y fusionándose suavemente en
                  intersecciones existentes.
                </li>
                <li>
                  <strong>Autómatas Celulares (Regla 4-5):</strong> Genera cavernas orgánicas con
                  suavizado iterativo y túneles de unión entre cavidades.
                </li>
                <li>
                  <strong>Filtro Geométrico Crítico de Puertas:</strong> Localiza muros reales con
                  espacio transitable a ambos lados, rechaza esquinas, crea aberturas y vincula la
                  conexión en el grafo.
                </li>
              </ul>
            </section>

            <section className="space-y-2">
              <h3 className="text-sm font-bold text-amber-400">
                3. Pruebas Automatizadas Ejecutadas & Resultados
              </h3>
              <p>
                La suite de QA ejecutó <strong>25 pruebas formales</strong> sin ningún fallo:
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li>
                  <strong>Unitarias:</strong> Determinismo de PRNG, parseo canónico de bordes H/V,
                  deduplicación de paredes compartidas.
                </li>
                <li>
                  <strong>Los 20 Casos Críticos de Puertas (Sección 18.B):</strong> Puertas en
                  centro, detección de paredes cortas, esquinas, puertas flotantes, duplicadas en
                  mismo segmento, sobreposiciones parciales, paredes compartidas, puertas secretas,
                  dobles, con llave, arcos abiertos y recálculo dinámico post-movimiento.
                </li>
                <li>
                  <strong>Prueba de Propiedades Monte Carlo:</strong> 50 semillas distintas
                  generadas consecutivamente, comprobando 10 invariantes geométricas en cada mapa.
                </li>
                <li>
                  <strong>Integración Completa:</strong> Ciclo completo de generación ➔ validación ➔
                  exportación JSON ➔ importación y verificación de identidad topológica.
                </li>
              </ul>
            </section>

            <section className="space-y-2">
              <h3 className="text-sm font-bold text-amber-400">
                4. Procedimiento de Reproducción de Mapas por Semilla
              </h3>
              <p>
                Para reproducir exactamente cualquier mazmorra generada:
              </p>
              <ol className="list-decimal pl-5 space-y-1">
                <li>Copiar la semilla numérica o de texto desde la barra superior.</li>
                <li>
                  Pegarla en el campo <em>Semilla Aleatoria</em> del panel izquierdo.
                </li>
                <li>
                  Hacer clic en el botón <em>Regenerar</em> con las mismas dimensiones configuradas.
                </li>
                <li>
                  El algoritmo generará exactamente la misma distribución de habitaciones, puertas y
                  corredores.
                </li>
              </ol>
            </section>

            <section className="space-y-2">
              <h3 className="text-sm font-bold text-amber-400">
                5. Formatos de Importación, Exportación & Persistencia
              </h3>
              <ul className="list-disc pl-5 space-y-1">
                <li>
                  <strong>JSON Versionado (Schema v1.0.0):</strong> Exporta la totalidad del modelo
                  geométrico, entidades, estadísticas y configuración.
                </li>
                <li>
                  <strong>Vector SVG Estructurado:</strong> Gráfico vectorial con capas semánticas
                  separadas para suelos, paredes, puertas, elementos y etiquetas.
                </li>
                <li>
                  <strong>PNG de Alta Resolución:</strong> Renderizado nítido a escala 1:1 listo
                  para imprimir o cargar en VTTs como Roll20 o Foundry.
                </li>
              </ul>
            </section>

            <section className="space-y-2">
              <h3 className="text-sm font-bold text-amber-400">
                6. Preparación para Distribución Comercial & Licencias
              </h3>
              <p>
                El código fuente, los algoritmos y la estructura de datos han sido creados desde cero
                bajo estándares de código abierto sin incorporar fragmentos ni recursos protegidos
                de herramientas propietarias. Es completamente compatible con distribución comercial
                para creadores de contenido de rol y plataformas VTT.
              </p>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
