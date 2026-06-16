<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useBeadStore } from '../../stores/beadStore'
import { useFocusStore } from '../../stores/focusStore'
import { renderAllCells, drawGridLines } from '../../composables/useExport'
import { getCellFromEvent } from '../../composables/useGridInteraction'
import { useZoomPan } from '../../composables/useZoomPan'
import { useCellSize } from '../../composables/useCellSize'

const beadStore = useBeadStore()
const focusStore = useFocusStore()

const canvasRef = ref<HTMLCanvasElement>()
const containerRef = ref<HTMLDivElement>()
const { cellSize, recompute } = useCellSize(containerRef, beadStore.beadGrid)

function updateCanvasTransform(_px: number, _py: number, _z: number) {
  if (canvasRef.value) {
    canvasRef.value.style.transform = `translate(${_px}px, ${_py}px) scale(${_z})`
  }
}

const { zoom, panX, panY, isPanning, onWheel, onPanStart } = useZoomPan({
  onTransformChanged: updateCanvasTransform,
})

let animRafId = 0
let staticLayer: HTMLCanvasElement | null = null
let overlayLayer: HTMLCanvasElement | null = null
let lastOverlayUpdate = 0
const OVERLAY_INTERVAL = 250
let needStaticRedraw = true

function resolveCell(event: MouseEvent) {
  if (!canvasRef.value) return null
  return getCellFromEvent(event, canvasRef.value, beadStore.beadGrid, cellSize.value, zoom.value)
}

function ensureLayers(w: number, h: number) {
  if (!staticLayer) staticLayer = document.createElement('canvas')
  if (staticLayer.width !== w || staticLayer.height !== h || needStaticRedraw) {
    staticLayer.width = w
    staticLayer.height = h
    drawStatic()
    needStaticRedraw = false
  }
  if (!overlayLayer) {
    overlayLayer = document.createElement('canvas')
    overlayLayer.width = w
    overlayLayer.height = h
  }
}

function drawStatic() {
  if (!staticLayer || !beadStore.beadGrid) return
  const ctx = staticLayer.getContext('2d')
  if (!ctx) return
  ctx.clearRect(0, 0, staticLayer.width, staticLayer.height)
  renderAllCells(ctx, beadStore.beadGrid, cellSize.value, 'color', false)
  const d = beadStore.settings.display
  drawGridLines(ctx, beadStore.beadGrid.cols, beadStore.beadGrid.rows, cellSize.value, {
    showGrid: d.showGrid, gridLineColor: d.gridLineColor,
    gridLineWidth: d.gridLineWidth, boldGridInterval: d.boldGridInterval,
    boldGridColor: d.boldGridColor, boldGridWidth: d.boldGridWidth,
  })
}

function drawOverlay() {
  if (!overlayLayer || !beadStore.beadGrid) return
  const ctx = overlayLayer.getContext('2d')
  if (!ctx) return
  ctx.clearRect(0, 0, overlayLayer.width, overlayLayer.height)

  const block = focusStore.currentBlock
  if (!block) return

  const marked = block.markedCells
  for (const { row, col } of block.cells) {
    const x = col * cellSize.value
    const y = row * cellSize.value
    if (marked.has(`${row},${col}`)) {
      ctx.fillStyle = 'rgba(76, 175, 80, 0.35)'
      ctx.fillRect(x, y, cellSize.value, cellSize.value)
      const cx = x + cellSize.value / 2
      const cy = y + cellSize.value / 2
      const sz = cellSize.value * 0.35
      ctx.strokeStyle = '#2e7d32'
      ctx.lineWidth = Math.max(1.5, cellSize.value * 0.08)
      ctx.beginPath()
      ctx.moveTo(cx - sz * 0.4, cy)
      ctx.lineTo(cx - sz * 0.1, cy + sz * 0.35)
      ctx.lineTo(cx + sz * 0.5, cy - sz * 0.3)
      ctx.stroke()
    } else {
      const pulse = 0.3 + 0.2 * Math.sin(Date.now() / 800)
      ctx.strokeStyle = `rgba(170, 59, 255, ${pulse})`
      ctx.lineWidth = Math.max(2, cellSize.value * 0.12)
      ctx.strokeRect(x + 1, y + 1, cellSize.value - 2, cellSize.value - 2)
    }
  }
}

function composite(timestamp: number) {
  if (!canvasRef.value || !staticLayer || !overlayLayer) return
  const ctx = canvasRef.value.getContext('2d')
  if (!ctx) return
  ctx.clearRect(0, 0, canvasRef.value.width, canvasRef.value.height)
  ctx.drawImage(staticLayer, 0, 0)
  if (focusStore.currentBlock && timestamp - lastOverlayUpdate > OVERLAY_INTERVAL) {
    drawOverlay()
    lastOverlayUpdate = timestamp
  }
  ctx.drawImage(overlayLayer, 0, 0)
}

function animLoop(timestamp: number) {
  if (!beadStore.beadGrid) return
  const w = beadStore.beadGrid.cols * cellSize.value
  const h = beadStore.beadGrid.rows * cellSize.value
  ensureLayers(w, h)
  composite(timestamp)
  if (focusStore.currentBlock) {
    animRafId = requestAnimationFrame(animLoop)
  }
}

function startAnimIfNeeded() {
  if (animRafId) return
  if (focusStore.currentBlock) {
    animRafId = requestAnimationFrame(animLoop)
  }
}

function stopAnim() {
  if (animRafId) { cancelAnimationFrame(animRafId); animRafId = 0 }
}

function setup() {
  if (!canvasRef.value || !beadStore.beadGrid) return
  const container = containerRef.value
  if (!container) return
  const prevSize = cellSize.value
  recompute()
  const sizeChanged = cellSize.value !== prevSize

  const w = beadStore.beadGrid.cols * cellSize.value
  const h = beadStore.beadGrid.rows * cellSize.value

  if (sizeChanged) {
    canvasRef.value.width = w
    canvasRef.value.height = h
    needStaticRedraw = true
  }
  startAnimIfNeeded()
}

function onClick(event: MouseEvent) {
  const cell = resolveCell(event)
  if (!cell) return
  focusStore.markCell(cell.row, cell.col)
  lastOverlayUpdate = 0
  startAnimIfNeeded()
}

function handleWheel(e: WheelEvent) {
  if (containerRef.value) onWheel(e, containerRef.value)
}

watch(() => focusStore.currentBlockIndex, () => {
  needStaticRedraw = false
  lastOverlayUpdate = 0
  startAnimIfNeeded()
})

onMounted(async () => {
  await nextTick()
  // Wait for browser layout (flex container may not have dimensions in nextTick alone)
  await new Promise(resolve => requestAnimationFrame(resolve))
  setup()
})

onUnmounted(() => {
  stopAnim()
  staticLayer = null
  overlayLayer = null
  needStaticRedraw = true
})
</script>

<template>
  <div ref="containerRef" class="focus-grid" @wheel="handleWheel" @click="onClick" @mousedown="onPanStart">
    <canvas ref="canvasRef" style="transform-origin: 0 0; cursor: pointer" />
  </div>
</template>

<style scoped>
.focus-grid { flex: 1; display: flex; align-items: center; justify-content: center; overflow: hidden; background: var(--bg); }
canvas { transform-origin: 0 0; }
</style>
