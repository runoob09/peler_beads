<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, computed } from 'vue'
import { useBeadStore } from '../stores/beadStore'
import { useBrushStore, ERASER_INDEX } from '../stores/brushStore'
import { usePaletteStore } from '../stores/paletteStore'
import { renderAllCells, drawGridLines, drawNullCellMark, getTextColor, cellGap } from '../composables/useExport'
import { getCellFromEvent } from '../composables/useGridInteraction'
import { useZoomPan } from '../composables/useZoomPan'
import { useCellSize } from '../composables/useCellSize'
import { useKeyboardShortcuts } from '../composables/useKeyboardShortcuts'

const beadStore = useBeadStore()
const brushStore = useBrushStore()
const paletteStore = usePaletteStore()

const canvasRef = ref<HTMLCanvasElement>()
const containerRef = ref<HTMLDivElement>()
const hoveredCell = ref<{ row: number; col: number } | null>(null)
const { cellSize, recompute } = useCellSize(containerRef, () => beadStore.beadGrid)

const { zoom, isPanning, transformStyle, onWheel, onPanStart, onPanEnd } = useZoomPan()

// Brush painting state
const isPainting = ref(false)

// ---- Right-click context menu for color replace ----
const contextMenu = ref<{ show: boolean; x: number; y: number; row: number; col: number } | null>(null)

const zoomPercent = computed(() => Math.round(zoom.value * 100))

const cursorStyle = computed(() => {
  return brushStore.brushMode ? 'crosshair' : 'default'
})

// Rectangle select state
let shiftHeld = false

function onKeyDownSelect(e: KeyboardEvent) {
  if (e.key === 'Shift' && brushStore.brushMode) {
    shiftHeld = true
  }
}

function onKeyUpSelect(e: KeyboardEvent) {
  if (e.key === 'Shift') {
    shiftHeld = false
    if (brushStore.selectStart) {
      brushStore.cancelSelect()
      scheduleRender(true)
    }
  }
}

// Persistent offscreen canvas for cell colors (no grid lines)
let offscreenCanvas: HTMLCanvasElement | null = null
let offscreenCtx: CanvasRenderingContext2D | null = null
let needFullRender = true
let renderRafId = 0
const dirtyCells = new Set<string>()

// Floating palette for brush mode
const paletteColors = computed(() => {
  return paletteStore.palette.map((c, i) => ({ ...c, index: i }))
})

const replaceSourceColor = computed(() => {
  const idx = brushStore.replaceSourceIndex
  if (idx === null || !beadStore.beadGrid) return null
  return beadStore.beadGrid.palette[idx] ?? null
})

function resolveCell(event: MouseEvent) {
  if (!canvasRef.value) return null
  return getCellFromEvent(event, canvasRef.value, beadStore.beadGrid, cellSize.value, zoom.value)
}

function onContextMenu(event: MouseEvent) {
  if (!canvasRef.value || !beadStore.beadGrid) return
  event.preventDefault()
  const cell = resolveCell(event)
  if (!cell) return
  const colorIndex = beadStore.beadGrid.cells[cell.row][cell.col].colorIndex
  if (colorIndex === null) return

  contextMenu.value = {
    show: true,
    x: event.clientX,
    y: event.clientY,
    row: cell.row,
    col: cell.col,
  }
}

function closeContextMenu() {
  contextMenu.value = null
}

function onReplaceClick() {
  if (!contextMenu.value) return
  brushStore.initReplace(contextMenu.value.row, contextMenu.value.col)
  closeContextMenu()
}

function onConfirmReplace(targetIndex: number) {
  brushStore.confirmReplace(targetIndex)
  scheduleRender(true)
}

function onCancelReplaceModal() {
  brushStore.cancelReplace()
}

function scheduleRender(forceFull = false) {
  if (forceFull) needFullRender = true
  if (renderRafId) return
  renderRafId = requestAnimationFrame(() => {
    renderRafId = 0
    doRender()
  })
}

function doRender() {
  if (!canvasRef.value || !beadStore.beadGrid) return
  const container = containerRef.value
  if (!container) return

  const prevSize = cellSize.value
  recompute()
  const sizeChanged = cellSize.value !== prevSize

  const grid = beadStore.beadGrid
  const w = grid.cols * cellSize.value
  const h = grid.rows * cellSize.value

  if (!offscreenCanvas) {
    offscreenCanvas = document.createElement('canvas')
    offscreenCtx = offscreenCanvas.getContext('2d')
    if (!offscreenCtx) return // no canvas support (e.g. test env)
    needFullRender = true
  }

  if (sizeChanged || needFullRender) {
    if (!offscreenCtx) return
    offscreenCanvas.width = w
    offscreenCanvas.height = h
    offscreenCtx = offscreenCanvas.getContext('2d')!
    // Fill background for gap visibility
    offscreenCtx.fillStyle = '#f5f0ff'
    offscreenCtx.fillRect(0, 0, w, h)
    const mode = beadStore.settings.display.renderMode
    renderAllCells(offscreenCtx, grid, cellSize.value, mode, false)
    needFullRender = false
    dirtyCells.clear()
  } else if (offscreenCtx && dirtyCells.size > 0) {
    const gap = cellGap(cellSize.value)
    for (const key of dirtyCells) {
      const [r, c] = key.split(',').map(Number)
      if (r < 0 || r >= grid.rows || c < 0 || c >= grid.cols) continue
      const x = c * cellSize.value
      const y = r * cellSize.value
      // Clear cell area and fill background
      offscreenCtx.fillStyle = '#f5f0ff'
      offscreenCtx.fillRect(x, y, cellSize.value, cellSize.value)
      const colorIndex = grid.cells[r][c].colorIndex
      if (colorIndex !== null) {
        offscreenCtx.fillStyle = grid.palette[colorIndex].hex
        offscreenCtx.fillRect(x + gap, y + gap, cellSize.value - gap * 2, cellSize.value - gap * 2)
      } else {
        drawNullCellMark(offscreenCtx, x, y, cellSize.value)
      }
    }
    dirtyCells.clear()
  }

  if (!offscreenCtx) return

  canvasRef.value.width = w
  canvasRef.value.height = h
  if (sizeChanged) {
    canvasRef.value.style.width = w + 'px'
    canvasRef.value.style.height = h + 'px'
  }
  const ctx = canvasRef.value.getContext('2d')
  if (!ctx) return
  ctx.drawImage(offscreenCanvas!, 0, 0)

  const d = beadStore.settings.display
  drawGridLines(ctx, grid.cols, grid.rows, cellSize.value, {
    showGrid: d.showGrid,
    gridLineColor: d.gridLineColor,
    gridLineWidth: d.gridLineWidth,
    boldGridInterval: d.boldGridInterval,
    boldGridColor: d.boldGridColor,
    boldGridWidth: d.boldGridWidth,
  })

  // Draw rectangle select preview
  const rect = brushStore.previewRect
  if (rect && brushStore.selectStart) {
    const rr1 = Math.min(rect.r1, rect.r2)
    const rr2 = Math.max(rect.r1, rect.r2)
    const cc1 = Math.min(rect.c1, rect.c2)
    const cc2 = Math.max(rect.c1, rect.c2)
    const rx = cc1 * cellSize.value
    const ry = rr1 * cellSize.value
    const rw = (cc2 - cc1 + 1) * cellSize.value
    const rh = (rr2 - rr1 + 1) * cellSize.value
    ctx.fillStyle = 'rgba(59, 130, 246, 0.15)'
    ctx.fillRect(rx, ry, rw, rh)
    ctx.strokeStyle = 'rgba(59, 130, 246, 0.7)'
    ctx.lineWidth = 2
    ctx.strokeRect(rx, ry, rw, rh)
  }
}

function onMouseDown(event: MouseEvent) {
  if (brushStore.brushMode) {
    // Shift-rectangle select mode
    if (shiftHeld) {
      const cell = resolveCell(event)
      if (!cell) return
      if (!brushStore.selectStart) {
        brushStore.beginSelect(cell.row, cell.col)
        scheduleRender(true)
      } else {
        brushStore.completeSelect(
          brushStore.selectStart.row,
          brushStore.selectStart.col,
          cell.row,
          cell.col,
        )
        scheduleRender(true)
      }
      return
    }

    // Normal brush painting
    isPainting.value = true
    brushStore.beginStroke()
    const cell = resolveCell(event)
    if (cell) {
      if (brushStore.continueStroke(cell.row, cell.col)) {
        dirtyCells.add(`${cell.row},${cell.col}`)
      }
      scheduleRender()
    }
  } else {
    onPanStart(event)
  }
}

function onMouseMove(event: MouseEvent) {
  if (!beadStore.beadGrid || !canvasRef.value) return

  // Shift-rectangle preview
  if (shiftHeld && brushStore.selectStart) {
    const cell = resolveCell(event)
    if (cell) {
      brushStore.updatePreview(cell.row, cell.col)
      scheduleRender()
    }
    return
  }

  if (isPainting.value) {
    const cell = resolveCell(event)
    if (cell) {
      hoveredCell.value = cell
      if (brushStore.continueStroke(cell.row, cell.col)) {
        dirtyCells.add(`${cell.row},${cell.col}`)
      }
      scheduleRender()
    }
    return
  }
  if (isPanning.value) return
  // Existing hover logic
  const rect = canvasRef.value.getBoundingClientRect()
  const x = event.clientX - rect.left
  const y = event.clientY - rect.top
  const scaledCell = cellSize.value * zoom.value
  const col = Math.floor(x / scaledCell)
  const row = Math.floor(y / scaledCell)
  if (row >= 0 && row < beadStore.beadGrid.rows && col >= 0 && col < beadStore.beadGrid.cols) {
    hoveredCell.value = { row, col }
  } else {
    hoveredCell.value = null
  }
}

function onMouseLeave() {
  hoveredCell.value = null
}

useKeyboardShortcuts([
  { key: 'z', ctrl: true, handler: () => { brushStore.undo(); scheduleRender(true) } },
  { key: 'z', ctrl: true, shift: true, handler: () => { brushStore.redo(); scheduleRender(true) } },
  { key: 'y', ctrl: true, handler: () => { brushStore.redo(); scheduleRender(true) } },
])

const hoveredColor = computed(() => {
  if (!hoveredCell.value || !beadStore.beadGrid) return null
  const { row, col } = hoveredCell.value
  const colorIndex = beadStore.beadGrid.cells[row][col].colorIndex
  if (colorIndex === null) return null
  return beadStore.beadGrid.palette[colorIndex]
})

function handleWheel(e: WheelEvent) {
  if (containerRef.value) onWheel(e, containerRef.value)
}

const stageLabel = computed(() => {
  const p = beadStore.progress
  if (p <= 0) return ''
  if (p <= 25) return '加载图片...'
  if (p <= 45) return '缩放...'
  if (p <= 65) return '颜色调整...'
  if (p <= 85) return '颜色匹配...'
  if (p < 100) return '抖动处理...'
  return '完成'
})

function onDocumentMouseUp() {
  if (isPainting.value) {
    isPainting.value = false
    brushStore.endStroke()
    scheduleRender()
  }
  onPanEnd()
}

onMounted(() => {
  scheduleRender(true)
  document.addEventListener('mouseup', onDocumentMouseUp)
  document.addEventListener('keydown', onKeyDownSelect)
  document.addEventListener('keyup', onKeyUpSelect)
  document.addEventListener('click', closeContextMenu)
})
onUnmounted(() => {
  cancelAnimationFrame(renderRafId)
  renderRafId = 0
  document.removeEventListener('mouseup', onDocumentMouseUp)
  document.removeEventListener('keydown', onKeyDownSelect)
  document.removeEventListener('keyup', onKeyUpSelect)
  document.removeEventListener('click', closeContextMenu)
})
// Full re-render when grid identity changes (new image loaded)
watch(
  () => beadStore.beadGrid,
  () => { if (beadStore.beadGrid) scheduleRender(true) },
)
// Full re-render when display settings change
watch(
  () => beadStore.settings.display,
  () => { if (beadStore.beadGrid) scheduleRender(true) },
)
</script>

<template>
  <div ref="containerRef" class="bead-preview">
    <template v-if="beadStore.progress > 0">
      <div class="progress-overlay">
        <div class="progress-card">
          <div class="progress-track">
            <div class="progress-fill" :style="{ width: beadStore.progress + '%' }"></div>
          </div>
          <div class="progress-text">{{ stageLabel }} {{ beadStore.progress }}%</div>
        </div>
      </div>
    </template>
    <template v-if="beadStore.beadGrid">
      <div class="preview-body" :class="{ 'has-palette': brushStore.brushMode }">
        <!-- Left: brush color card -->
        <div v-if="brushStore.brushMode" class="brush-palette">
          <div class="palette-title">色卡</div>
          <div class="brush-palette-scroll">
            <!-- Eraser -->
            <div
              class="brush-palette-swatch eraser-swatch"
              :class="{ active: brushStore.activeColorIndex === ERASER_INDEX }"
              @click="brushStore.setActiveColor(ERASER_INDEX)"
              title="橡皮擦"
            >
              <span class="swatch-code">🧹</span>
            </div>
            <div
              v-for="c in paletteColors"
              :key="c.index"
              class="brush-palette-swatch"
              :class="{ active: brushStore.activeColorIndex === c.index }"
              :style="{ background: c.hex, color: getTextColor(c.hex) }"
              :title="c.name || c.hex"
              @click="brushStore.setActiveColor(c.index)"
            >
              <span class="swatch-code">{{ c.name.split(/[\s_]+/)[0] || c.hex }}</span>
            </div>
          </div>
        </div>

        <!-- Right: canvas area -->
        <div class="preview-canvas-area">
          <div class="preview-canvas-wrap" :style="transformStyle">
            <canvas ref="canvasRef" :style="{ cursor: cursorStyle }" @mousemove="onMouseMove" @mouseleave="onMouseLeave" @wheel="handleWheel" @mousedown="onMouseDown" @contextmenu="onContextMenu" />
            <div v-if="hoveredColor" class="tooltip" :style="{ left: ((hoveredCell?.col ?? 0) + 1) * cellSize + 'px', top: (hoveredCell?.row ?? 0) * cellSize + 'px' }">
              {{ hoveredColor.name || hoveredColor.hex }}
            </div>

            <!-- Right-click context menu -->
            <Teleport to="body">
              <div
                v-if="contextMenu?.show"
                class="context-menu"
                :style="{ left: contextMenu.x + 'px', top: contextMenu.y + 'px' }"
              >
                <button class="context-menu-item" @click="onReplaceClick">
                  🔄 替换为…
                </button>
              </div>
            </Teleport>

            <!-- Replace target color modal -->
            <Teleport to="body">
              <div v-if="brushStore.showReplaceModal" class="replace-overlay" @click.self="onCancelReplaceModal">
                <div class="replace-modal">
                  <p class="replace-title">替换连通块</p>
                  <p class="replace-info" v-if="replaceSourceColor">
                    将 <span class="color-tag" :style="{ background: replaceSourceColor.hex }">{{ replaceSourceColor.name }}</span>
                    的 {{ brushStore.replaceCellCount }} 颗珠子替换为：
                  </p>
                  <div class="replace-palette">
                    <div
                      v-for="c in paletteColors"
                      :key="c.index"
                      class="replace-swatch"
                      :style="{ background: c.hex }"
                      :title="c.name || c.hex"
                      @click="onConfirmReplace(c.index)"
                    >
                      <span class="replace-swatch-label" :style="{ color: getTextColor(c.hex) }">
                        {{ c.name.split(/[\s_]+/)[0] || c.hex }}
                      </span>
                    </div>
                  </div>
                  <div class="replace-actions">
                    <button class="btn-cancel" @click="onCancelReplaceModal">取消</button>
                  </div>
                </div>
              </div>
            </Teleport>
          </div>
          <div class="zoom-indicator">{{ zoomPercent }}%</div>
          <div class="grid-info">{{ beadStore.beadGrid.rows }} × {{ beadStore.beadGrid.cols }} · {{ beadStore.beadGrid.palette.length }} 色</div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.bead-preview {
  flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center;
  min-height: 400px; background: var(--bg); position: relative; overflow: hidden;
}
.preview-body {
  display: flex; align-items: stretch; justify-content: center; gap: 0;
  width: 100%; height: 100%;
}
.preview-body.has-palette {
  justify-content: flex-start;
}
.preview-canvas-area {
  display: flex; flex-direction: column; align-items: center;
  flex: 1; min-width: 0; overflow: hidden;
}
.preview-canvas-wrap { transform-origin: 0 0; }
.preview-canvas-wrap canvas {
  image-rendering: pixelated;
  image-rendering: crisp-edges;
}
.tooltip { position: absolute; background: rgba(0,0,0,0.8); color: #fff; padding: 2px 8px; border-radius: 4px; font-size: 12px; white-space: nowrap; pointer-events: none; transform: translate(8px, -50%); z-index: 10; }
.zoom-indicator { margin-top: 8px; font-size: 12px; color: var(--accent, #aa3bff); font-family: var(--mono, monospace); }
.grid-info { margin-top: 4px; font-size: 12px; color: var(--text); font-family: var(--mono, monospace); }
.empty-state { color: var(--text); font-size: 16px; }

.progress-overlay {
  position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
  background: var(--bg, #fff); z-index: 20;
}
.progress-card { text-align: center; width: 260px; }
.progress-track { height: 8px; background: var(--border, #e5e4e7); border-radius: 4px; overflow: hidden; }
.progress-fill {
  height: 100%; background: var(--accent, #aa3bff); border-radius: 4px;
  transition: width 0.25s ease;
}
.progress-text {
  margin-top: 10px; font-size: 13px; color: var(--text, #6b6375); font-family: var(--mono, monospace);
}

/* Left color card */
.brush-palette {
  flex-shrink: 0;
  width: 160px;
  max-height: calc(100vh - 40px);
  background: color-mix(in srgb, var(--bg, #fff) 97%, var(--text, #6b6375));
  border-right: 1px solid var(--border, #e5e4e7);
  display: flex;
  flex-direction: column;
}
.palette-title {
  font-size: 13px; font-weight: 600; color: var(--text-h);
  padding: 10px 12px 6px;
  flex-shrink: 0;
}
.brush-palette-scroll {
  flex: 1; overflow-y: auto;
  display: flex; flex-wrap: wrap;
  gap: 3px;
  padding: 4px 8px 8px;
  align-content: flex-start;
}
.brush-palette-swatch {
  display: flex; align-items: center; justify-content: center;
  width: calc(40px * 1.618);   /* golden ratio */
  height: 40px;
  border-radius: 4px;
  cursor: pointer;
  transition: box-shadow 0.2s ease, transform 0.2s ease, filter 0.15s;
  flex-shrink: 0;
}
.brush-palette-swatch:hover {
  filter: brightness(0.9);
  transform: scale(1.12);
  z-index: 1;
}
.brush-palette-swatch.active {
  box-shadow:
    0 0 0 2px rgba(170, 59, 255, 0.4),
    0 2px 8px rgba(170, 59, 255, 0.25);
  transform: scale(1.1);
  z-index: 1;
}
.swatch-code {
  font-size: 16px;
  font-family: monospace;
  font-weight: 700;
  text-align: center;
  line-height: 1;
  pointer-events: none;
}
.eraser-swatch {
  background: #fff;
  border: 2px dashed var(--border, #d4d4d8);
}
.eraser-swatch:hover {
  border-color: var(--accent, #aa3bff);
  filter: none;
  transform: scale(1.12);
}
.eraser-swatch.active {
  border-style: solid;
  border-color: var(--accent, #aa3bff);
  box-shadow:
    0 0 0 2px rgba(170, 59, 255, 0.4),
    0 2px 8px rgba(170, 59, 255, 0.25);
}

/* Context menu */
.context-menu { position: fixed; z-index: 200; background: var(--bg, #fff); border: 1px solid var(--border, #e5e4e7); border-radius: 8px; box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12); padding: 4px 0; min-width: 140px; }
.context-menu-item { display: block; width: 100%; padding: 8px 16px; border: none; background: none; font-size: 13px; color: var(--text-h, #1a1a2e); cursor: pointer; text-align: left; }
.context-menu-item:hover { background: var(--accent-bg, rgba(170, 59, 255, 0.1)); }

/* Replace modal */
.replace-overlay { position: fixed; inset: 0; background: rgba(0, 0, 0, 0.4); display: flex; align-items: center; justify-content: center; z-index: 150; }
.replace-modal { background: var(--bg, #fff); border-radius: 12px; padding: 24px; max-width: 360px; box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2); }
.replace-title { font-size: 16px; font-weight: 600; color: var(--text-h, #1a1a2e); margin: 0 0 8px; }
.replace-info { font-size: 13px; color: var(--text, #6b6375); margin: 0 0 12px; }
.color-tag { display: inline-block; padding: 1px 8px; border-radius: 4px; color: #fff; font-size: 12px; }
.replace-palette { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 16px; max-height: 200px; overflow-y: auto; }
.replace-swatch { width: 48px; height: 32px; border-radius: 4px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: transform 0.15s, box-shadow 0.15s; border: 1px solid var(--border, #e5e4e7); }
.replace-swatch:hover { transform: scale(1.15); box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15); }
.replace-swatch-label { font-size: 10px; font-family: monospace; font-weight: 700; pointer-events: none; }
.replace-actions { display: flex; justify-content: flex-end; gap: 8px; }
.btn-cancel { background: none; border: 1px solid var(--border, #e5e4e7); color: var(--text, #6b6375); padding: 6px 16px; border-radius: 6px; cursor: pointer; font-size: 13px; }
</style>
