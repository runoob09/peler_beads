<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, nextTick, computed } from 'vue'
import { useBeadStore } from '../stores/beadStore'
import { useBrushStore } from '../stores/brushStore'
import { usePaletteStore } from '../stores/paletteStore'
import { renderGridToCanvas } from '../composables/useExport'

const beadStore = useBeadStore()
const brushStore = useBrushStore()
const paletteStore = usePaletteStore()

const canvasRef = ref<HTMLCanvasElement>()
const containerRef = ref<HTMLDivElement>()
const hoveredCell = ref<{ row: number; col: number } | null>(null)
const cellSize = ref(20)

// Zoom & pan state
const zoom = ref(1)
const panX = ref(0)
const panY = ref(0)
const isPanning = ref(false)
const panStart = ref({ x: 0, y: 0 })
const panStartPos = ref({ x: 0, y: 0 })

// Brush painting state
const isPainting = ref(false)

const MIN_ZOOM = 0.25
const MAX_ZOOM = 4
const ZOOM_STEP = 0.1

const zoomPercent = computed(() => Math.round(zoom.value * 100))

const cursorStyle = computed(() => {
  return brushStore.brushMode ? 'crosshair' : 'default'
})

function swatchTextColor(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.53 ? '#1a1a2e' : '#ffffff'
}

// Floating palette for brush mode
const paletteColors = computed(() => {
  return paletteStore.palette.map((c, i) => ({ ...c, index: i }))
})

function clampZoom(z: number): number {
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z))
}

function getCellFromEvent(event: MouseEvent): { row: number; col: number } | null {
  if (!canvasRef.value) return null
  const rect = canvasRef.value.getBoundingClientRect()
  const x = event.clientX - rect.left
  const y = event.clientY - rect.top
  const scaledCell = cellSize.value * zoom.value
  const col = Math.floor(x / scaledCell)
  const row = Math.floor(y / scaledCell)
  const grid = beadStore.beadGrid
  if (!grid) return null
  if (row >= 0 && row < grid.rows && col >= 0 && col < grid.cols) {
    return { row, col }
  }
  return null
}

function render() {
  if (!canvasRef.value || !beadStore.beadGrid) return
  const container = containerRef.value
  if (!container) return

  const maxW = container.clientWidth || 400
  const maxH = container.clientHeight || 400
  cellSize.value = Math.floor(Math.min(maxW / beadStore.beadGrid.cols, maxH / beadStore.beadGrid.rows))

  const rendered = renderGridToCanvas(beadStore.beadGrid, beadStore.settings.display.renderMode, cellSize.value, {
    showGrid: beadStore.settings.display.showGrid,
    gridLineColor: beadStore.settings.display.gridLineColor,
    gridLineWidth: beadStore.settings.display.gridLineWidth,
    boldGridInterval: beadStore.settings.display.boldGridInterval,
    boldGridColor: beadStore.settings.display.boldGridColor,
    boldGridWidth: beadStore.settings.display.boldGridWidth,
  })

  canvasRef.value.width = rendered.width
  canvasRef.value.height = rendered.height
  canvasRef.value.style.width = rendered.width + 'px'
  canvasRef.value.style.height = rendered.height + 'px'
  const ctx = canvasRef.value.getContext('2d')
  if (!ctx) return
  ctx.drawImage(rendered, 0, 0)
}

function onMouseDown(event: MouseEvent) {
  if (brushStore.brushMode) {
    isPainting.value = true
    brushStore.beginStroke()
    const cell = getCellFromEvent(event)
    if (cell) {
      brushStore.continueStroke(cell.row, cell.col)
      nextTick(render)
    }
  } else {
    onPanStart(event)
  }
}

function onMouseMove(event: MouseEvent) {
  if (!beadStore.beadGrid || !canvasRef.value) return
  if (isPainting.value) {
    const cell = getCellFromEvent(event)
    if (cell) {
      hoveredCell.value = cell
      brushStore.continueStroke(cell.row, cell.col)
      nextTick(render)
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

function onKeyDown(event: KeyboardEvent) {
  if ((event.ctrlKey || event.metaKey) && event.key === 'z') {
    event.preventDefault()
    if (event.shiftKey) {
      brushStore.redo()
    } else {
      brushStore.undo()
    }
    nextTick(render)
  } else if ((event.ctrlKey || event.metaKey) && event.key === 'y') {
    event.preventDefault()
    brushStore.redo()
    nextTick(render)
  }
}

const hoveredColor = computed(() => {
  if (!hoveredCell.value || !beadStore.beadGrid) return null
  const { row, col } = hoveredCell.value
  const colorIndex = beadStore.beadGrid.cells[row][col].colorIndex
  if (colorIndex === null) return null
  return beadStore.beadGrid.palette[colorIndex]
})

function onWheel(event: WheelEvent) {
  if (!event.ctrlKey) return
  event.preventDefault()
  const delta = event.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP
  const oldZoom = zoom.value
  const newZoom = clampZoom(oldZoom + delta)

  // Zoom toward cursor position
  if (containerRef.value) {
    const rect = containerRef.value.getBoundingClientRect()
    const cx = event.clientX - rect.left
    const cy = event.clientY - rect.top
    const scale = newZoom / oldZoom
    panX.value = cx - scale * (cx - panX.value)
    panY.value = cy - scale * (cy - panY.value)
  }

  zoom.value = newZoom
}

function onPanStart(event: MouseEvent) {
  isPanning.value = true
  panStart.value = { x: event.clientX, y: event.clientY }
  panStartPos.value = { x: panX.value, y: panY.value }
}

function onPanMove(event: MouseEvent) {
  if (!isPanning.value) return
  panX.value = panStartPos.value.x + (event.clientX - panStart.value.x)
  panY.value = panStartPos.value.y + (event.clientY - panStart.value.y)
}

function onPanEnd() {
  isPanning.value = false
}

const transformStyle = computed(() => {
  return `transform: translate(${panX.value}px, ${panY.value}px) scale(${zoom.value})`
})

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
    nextTick(render)
  }
  onPanEnd()
}

onMounted(() => {
  nextTick(render)
  document.addEventListener('mousemove', onPanMove)
  document.addEventListener('mouseup', onDocumentMouseUp)
  document.addEventListener('keydown', onKeyDown)
})
onUnmounted(() => {
  document.removeEventListener('mousemove', onPanMove)
  document.removeEventListener('mouseup', onDocumentMouseUp)
  document.removeEventListener('keydown', onKeyDown)
})
watch(
  () => [beadStore.beadGrid, beadStore.settings.display],
  () => { nextTick(render) },
  { deep: true },
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
            <div
              v-for="c in paletteColors"
              :key="c.index"
              class="brush-palette-swatch"
              :class="{ active: brushStore.activeColorIndex === c.index }"
              :style="{ background: c.hex, color: swatchTextColor(c.hex) }"
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
            <canvas ref="canvasRef" :style="{ cursor: cursorStyle }" @mousemove="onMouseMove" @mouseleave="onMouseLeave" @wheel="onWheel" @mousedown="onMouseDown" />
            <div v-if="hoveredColor" class="tooltip" :style="{ left: (panX + (hoveredCell?.col ?? 0) * cellSize * zoom + cellSize * zoom) + 'px', top: (panY + (hoveredCell?.row ?? 0) * cellSize * zoom) + 'px' }">
              {{ hoveredColor.name || hoveredColor.hex }}
            </div>
          </div>
          <div class="zoom-indicator">{{ zoomPercent }}%</div>
          <div class="grid-info">{{ beadStore.beadGrid.rows }} × {{ beadStore.beadGrid.cols }} · {{ beadStore.beadGrid.palette.length }} 色</div>
        </div>
      </div>
    </template>
    <div v-if="!beadStore.beadGrid && beadStore.progress === 0" class="empty-state"><p>上传图片开始</p></div>
  </div>
</template>

<style scoped>
.bead-preview {
  flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center;
  min-height: 400px; background: var(--bg); position: relative; overflow: hidden;
}
.preview-body {
  display: flex; align-items: flex-start; justify-content: center; gap: 0;
  width: 100%; height: 100%;
}
.preview-body.has-palette {
  justify-content: flex-start;
}
.preview-canvas-area {
  display: flex; flex-direction: column; align-items: center;
  flex: 1; min-width: 0;
}
.preview-canvas-wrap { transform-origin: 0 0; }
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
</style>
