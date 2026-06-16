<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useBeadStore } from '../../stores/beadStore'
import { useFocusStore } from '../../stores/focusStore'
import { renderAllCells, drawGridLines } from '../../composables/useExport'

const beadStore = useBeadStore()
const focusStore = useFocusStore()

const canvasRef = ref<HTMLCanvasElement>()
const containerRef = ref<HTMLDivElement>()
const cellSize = ref(20)

const zoom = ref(1)
const panX = ref(0)
const panY = ref(0)
const isPanning = ref(false)
const panStart = ref({ x: 0, y: 0 })
const panStartPos = ref({ x: 0, y: 0 })

let animRafId = 0

function clampZoom(z: number): number {
  return Math.max(0.25, Math.min(4, z))
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
  cellSize.value = Math.floor(
    Math.min(maxW / beadStore.beadGrid.cols, maxH / beadStore.beadGrid.rows),
  )

  const grid = beadStore.beadGrid
  const w = grid.cols * cellSize.value
  const h = grid.rows * cellSize.value

  canvasRef.value.width = w
  canvasRef.value.height = h
  const ctx = canvasRef.value.getContext('2d')
  if (!ctx) return

  // Render base cells
  renderAllCells(ctx, grid, cellSize.value, 'color', false)

  // Draw grid lines
  const d = beadStore.settings.display
  drawGridLines(ctx, grid.cols, grid.rows, cellSize.value, {
    showGrid: d.showGrid,
    gridLineColor: d.gridLineColor,
    gridLineWidth: d.gridLineWidth,
    boldGridInterval: d.boldGridInterval,
    boldGridColor: d.boldGridColor,
    boldGridWidth: d.boldGridWidth,
  })

  // Highlight current block cells
  const block = focusStore.currentBlock
  if (block) {
    const marked = block.markedCells
    for (const { row, col } of block.cells) {
      const x = col * cellSize.value
      const y = row * cellSize.value
      const key = `${row},${col}`

      if (marked.has(key)) {
        // Marked: green overlay + checkmark
        ctx.fillStyle = 'rgba(76, 175, 80, 0.35)'
        ctx.fillRect(x, y, cellSize.value, cellSize.value)
        const cx = x + cellSize.value / 2
        const cy = y + cellSize.value / 2
        const size = cellSize.value * 0.35
        ctx.strokeStyle = '#2e7d32'
        ctx.lineWidth = Math.max(1.5, cellSize.value * 0.08)
        ctx.beginPath()
        ctx.moveTo(cx - size * 0.4, cy)
        ctx.lineTo(cx - size * 0.1, cy + size * 0.35)
        ctx.lineTo(cx + size * 0.5, cy - size * 0.3)
        ctx.stroke()
      } else {
        // Unmarked: pulsing purple border
        const pulse = 0.3 + 0.2 * Math.sin(Date.now() / 800)
        ctx.strokeStyle = `rgba(170, 59, 255, ${pulse})`
        ctx.lineWidth = Math.max(2, cellSize.value * 0.12)
        ctx.strokeRect(x + 1, y + 1, cellSize.value - 2, cellSize.value - 2)
      }
    }
  }
}

function animLoop() {
  render()
  animRafId = requestAnimationFrame(animLoop)
}

function updateTransform() {
  if (!canvasRef.value) return
  canvasRef.value.style.transform =
    `translate(${panX.value}px, ${panY.value}px) scale(${zoom.value})`
}

function onClick(event: MouseEvent) {
  const cell = getCellFromEvent(event)
  if (!cell) return
  focusStore.markCell(cell.row, cell.col)
}

function onWheel(event: WheelEvent) {
  if (!event.ctrlKey) return
  event.preventDefault()
  const delta = event.deltaY < 0 ? 0.1 : -0.1
  const oldZoom = zoom.value
  const newZoom = clampZoom(oldZoom + delta)
  if (containerRef.value) {
    const rect = containerRef.value.getBoundingClientRect()
    const cx = event.clientX - rect.left
    const cy = event.clientY - rect.top
    const scale = newZoom / oldZoom
    panX.value = cx - scale * (cx - panX.value)
    panY.value = cy - scale * (cy - panY.value)
  }
  zoom.value = newZoom
  updateTransform()
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
  updateTransform()
}

function onPanEnd() {
  isPanning.value = false
}

onMounted(() => {
  animRafId = requestAnimationFrame(animLoop)
  document.addEventListener('mousemove', onPanMove)
  document.addEventListener('mouseup', onPanEnd)
})

onUnmounted(() => {
  cancelAnimationFrame(animRafId)
  document.removeEventListener('mousemove', onPanMove)
  document.removeEventListener('mouseup', onPanEnd)
})
</script>

<template>
  <div
    ref="containerRef"
    class="focus-grid"
    @wheel="onWheel"
    @click="onClick"
    @mousedown="onPanStart"
  >
    <canvas
      ref="canvasRef"
      style="transform-origin: 0 0; cursor: pointer"
    />
  </div>
</template>

<style scoped>
.focus-grid {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  background: var(--bg);
}
canvas { transform-origin: 0 0; }
</style>
