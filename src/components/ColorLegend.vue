<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, nextTick, computed } from 'vue'
import { countColorUsage, getTextColor, colorCodeFromName } from '../composables/useExport'
import { useBeadStore } from '../stores/beadStore'
import { useBrushStore } from '../stores/brushStore'

const beadStore = useBeadStore()
const brushStore = useBrushStore()
const canvasRef = ref<HTMLCanvasElement>()
const containerRef = ref<HTMLDivElement>()

const panelWidth = ref(170)
const MIN_W = 140
const MAX_W = 440
const dragging = ref(false)
const dragStartX = ref(0)
const dragStartW = ref(0)

interface LegendItem {
  color: { id: string; name: string; hex: string }
  paletteIndex: number
  count: number
  pct: number
}

const sortedColors = computed<LegendItem[]>(() => {
  if (!beadStore.beadGrid) return []
  const counts = countColorUsage(beadStore.beadGrid)
  const total = beadStore.beadGrid.rows * beadStore.beadGrid.cols
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([idx, count]) => ({
      color: beadStore.beadGrid!.palette[idx],
      paletteIndex: idx,
      count,
      pct: Math.round((count / total) * 100),
    }))
})

// Layout constants
const SWATCH_W = 60       // fixed swatch width
const ITEM_MAX_W = 100    // max total item width (swatch + text area)
const ROW_H = 36           // row height per item
const HEADER_H = 34        // title + summary height
const PAD = 10             // horizontal padding

function render() {
  const canvas = canvasRef.value
  const items = sortedColors.value
  if (!canvas) return

  const dpr = window.devicePixelRatio || 1
  const W = containerRef.value?.clientWidth ?? panelWidth.value

  // Calculate columns based on available width
  const availW = W - PAD * 2
  const cols = Math.max(1, Math.floor(availW / ITEM_MAX_W))
  const colW = Math.floor(availW / cols)
  const rows = Math.ceil(items.length / cols)

  const H = HEADER_H + rows * ROW_H + 10

  canvas.width = W * dpr
  canvas.height = H * dpr
  canvas.style.width = W + 'px'
  canvas.style.height = H + 'px'

  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.scale(dpr, dpr)

  const styles = getComputedStyle(canvas)
  const bg = styles.getPropertyValue('--bg') || '#ffffff'
  const textCol = styles.getPropertyValue('--text') || '#6b6375'
  const textH = styles.getPropertyValue('--text-h') || '#08060d'

  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)

  // Title
  ctx.fillStyle = textH
  ctx.font = '600 13px system-ui'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  ctx.fillText('色彩图例', PAD, 10)

  if (beadStore.beadGrid) {
    ctx.fillStyle = textCol
    ctx.font = '11px monospace'
    ctx.textAlign = 'right'
    ctx.textBaseline = 'top'
    ctx.fillText(`${items.length} 色`, W - PAD, 12)
  }

  if (items.length === 0) return

  const swatchH = ROW_H - 6
  const countX = SWATCH_W + 4  // count offset within item

  for (let i = 0; i < items.length; i++) {
    const col = i % cols
    const row = Math.floor(i / cols)
    const item = items[i]

    const cx = PAD + col * colW
    const cy = HEADER_H + row * ROW_H
    const midY = cy + ROW_H / 2

    // Highlight active brush color row
    const isActive = brushStore.brushMode && brushStore.activeColorIndex === item.paletteIndex
    if (isActive) {
      ctx.fillStyle = 'rgba(170, 59, 255, 0.15)'
      ctx.fillRect(cx - 2, cy, colW, ROW_H)
    }

    // Swatch — fixed 60px, height ROW_H-6
    ctx.fillStyle = item.color.hex
    ctx.beginPath()
    ctx.roundRect(cx, cy + 3, SWATCH_W, swatchH, 4)
    ctx.fill()

    ctx.strokeStyle = isActive ? '#aa3bff' : 'rgba(0,0,0,0.08)'
    ctx.lineWidth = isActive ? 2 : 0.5
    ctx.beginPath()
    ctx.roundRect(cx, cy + 3, SWATCH_W, swatchH, 4)
    ctx.stroke()

    // Label on swatch — 20px bold
    ctx.fillStyle = getTextColor(item.color.hex)
    ctx.font = 'bold 16px monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(colorCodeFromName(item.color.name), cx + SWATCH_W / 2, cy + 3 + swatchH / 2)

    // Count
    ctx.fillStyle = textH
    ctx.font = '700 11px monospace'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.fillText(String(item.count), cx + countX, midY - 3)

    // Pct
    ctx.fillStyle = textCol
    ctx.font = '9px monospace'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.fillText(`${item.pct}%`, cx + countX, midY + 10)
  }
}

// --- Canvas click for color selection ---
function onCanvasClick(event: MouseEvent) {
  if (!brushStore.brushMode) return
  const canvas = canvasRef.value
  if (!canvas) return
  const items = sortedColors.value
  if (items.length === 0) return

  const rect = canvas.getBoundingClientRect()
  const x = event.clientX - rect.left
  const y = event.clientY - rect.top

  const W = containerRef.value?.clientWidth ?? panelWidth.value
  const availW = W - PAD * 2
  const cols = Math.max(1, Math.floor(availW / ITEM_MAX_W))
  const colW = Math.floor(availW / cols)

  for (let i = 0; i < items.length; i++) {
    const col = i % cols
    const row = Math.floor(i / cols)
    const cx = PAD + col * colW
    const cy = HEADER_H + row * ROW_H

    if (x >= cx && x <= cx + colW && y >= cy && y <= cy + ROW_H) {
      brushStore.setActiveColor(items[i].paletteIndex)
      return
    }
  }
}

// --- Drag resize ---
function onDragStart(e: MouseEvent) {
  dragging.value = true
  dragStartX.value = e.clientX
  dragStartW.value = panelWidth.value
  document.addEventListener('mousemove', onDragMove)
  document.addEventListener('mouseup', onDragEnd)
  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'
}

let rafId = 0
function onDragMove(e: MouseEvent) {
  if (!dragging.value) return
  const delta = dragStartX.value - e.clientX
  panelWidth.value = Math.min(MAX_W, Math.max(MIN_W, dragStartW.value + delta))
  cancelAnimationFrame(rafId)
  rafId = requestAnimationFrame(render)
}

function onDragEnd() {
  dragging.value = false
  document.removeEventListener('mousemove', onDragMove)
  document.removeEventListener('mouseup', onDragEnd)
  document.body.style.cursor = ''
  document.body.style.userSelect = ''
  cancelAnimationFrame(rafId)
}

let observer: ResizeObserver | null = null

onMounted(() => {
  nextTick(render)
  if (containerRef.value) {
    observer = new ResizeObserver(() => render())
    observer.observe(containerRef.value)
  }
})

onUnmounted(() => {
  document.removeEventListener('mousemove', onDragMove)
  document.removeEventListener('mouseup', onDragEnd)
  observer?.disconnect()
})

watch(
  [sortedColors, panelWidth, () => brushStore.activeColorIndex, () => brushStore.brushMode],
  () => {
    if (brushStore.isStroking) return
    nextTick(render)
  },
  { deep: true },
)

// Re-render when stroke ends to catch up with accumulated changes
watch(
  () => brushStore.isStroking,
  (stroking) => {
    if (!stroking) nextTick(render)
  },
)
</script>

<template>
  <aside
    v-if="beadStore.beadGrid"
    class="color-legend"
    :style="{ width: panelWidth + 'px' }"
    :class="{ dragging }"
  >
    <div class="drag-handle" @mousedown="onDragStart">
      <span class="drag-grip"></span>
    </div>
    <div ref="containerRef" class="legend-scroll">
      <canvas ref="canvasRef" class="legend-canvas" @click="onCanvasClick" />
    </div>
  </aside>
</template>

<style scoped>
.color-legend {
  flex-shrink: 0; position: relative;
  border-left: 1px solid var(--border, #e5e4e7);
  overflow: visible; max-height: 100vh; box-sizing: border-box;
  background: color-mix(in srgb, var(--bg, #fff) 97%, var(--text, #6b6375));
}
.color-legend.dragging { transition: none; }
.legend-scroll {
  overflow-y: auto; max-height: 100vh; padding: 12px 0;
  box-sizing: border-box;
}
.legend-canvas { display: block; width: 100%; }
.drag-handle {
  position: absolute; left: -3px; top: 0; bottom: 0; width: 7px;
  cursor: col-resize; z-index: 30; display: flex; align-items: center; justify-content: center;
}
.drag-handle:hover .drag-grip,
.dragging .drag-grip { opacity: 1; }
.drag-grip {
  width: 3px; height: 32px; border-radius: 2px;
  background: var(--accent, #aa3bff); opacity: 0;
  transition: opacity 0.15s;
}
</style>
