<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, nextTick, computed } from 'vue'
import type { BeadGrid } from '../types'
import { countColorUsage } from '../composables/useExport'

const props = defineProps<{ beadGrid: BeadGrid | null }>()
const canvasRef = ref<HTMLCanvasElement>()
const containerRef = ref<HTMLDivElement>()

const panelWidth = ref(220)
const MIN_W = 160
const MAX_W = 420
const dragging = ref(false)
const dragStartX = ref(0)
const dragStartW = ref(0)

interface LegendItem {
  color: { id: string; name: string; hex: string }
  count: number
  pct: number
}

const sortedColors = computed<LegendItem[]>(() => {
  if (!props.beadGrid) return []
  const counts = countColorUsage(props.beadGrid)
  const total = props.beadGrid.rows * props.beadGrid.cols
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([idx, count]) => ({
      color: props.beadGrid!.palette[idx],
      count,
      pct: Math.round((count / total) * 100),
    }))
})

function textColor(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.55 ? '#1a1a2e' : '#ffffff'
}

function labelShort(name: string): string {
  return name.split(/[\s_]+/)[0] ?? name
}

const ROW_H = 26
const HEADER_H = 30
const PAD = 10
const ITEM_MIN_W = 150

function render() {
  const canvas = canvasRef.value
  const items = sortedColors.value
  if (!canvas) return

  const dpr = window.devicePixelRatio || 1
  const W = canvas.clientWidth
  const availW = W - PAD * 2

  // Calculate columns
  const cols = Math.max(1, Math.floor(availW / ITEM_MIN_W))
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
  const borderCol = styles.getPropertyValue('--border') || '#e5e4e7'

  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)

  // Title
  ctx.fillStyle = textH
  ctx.font = '600 13px system-ui'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  ctx.fillText('色彩图例', PAD, 6)

  if (props.beadGrid) {
    const total = props.beadGrid.rows * props.beadGrid.cols
    ctx.fillStyle = textCol
    ctx.font = '10px monospace'
    ctx.textAlign = 'right'
    ctx.fillText(`${items.length} 色 · ${total} 珠`, W - PAD, 8)
  }

  if (items.length === 0) return

  const gap = 6
  const swatchW = colW - gap - 50 // leave room for count + pct

  for (let i = 0; i < items.length; i++) {
    const col = i % cols
    const row = Math.floor(i / cols)
    const item = items[i]

    const cx = PAD + col * colW
    const cy = HEADER_H + row * ROW_H
    const barW = Math.max(20, swatchW - 4)

    // Swatch
    ctx.fillStyle = item.color.hex
    ctx.beginPath()
    ctx.roundRect(cx, cy, swatchW, ROW_H - 8, 3)
    ctx.fill()

    ctx.strokeStyle = borderCol
    ctx.lineWidth = 0.5
    ctx.beginPath()
    ctx.roundRect(cx, cy, swatchW, ROW_H - 8, 3)
    ctx.stroke()

    // Label on swatch
    ctx.fillStyle = textColor(item.color.hex)
    ctx.font = 'bold 8px monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(labelShort(item.color.name), cx + swatchW / 2, cy + (ROW_H - 8) / 2)

    // Count
    ctx.fillStyle = textH
    ctx.font = '600 10px monospace'
    ctx.textAlign = 'right'
    ctx.textBaseline = 'middle'
    ctx.fillText(String(item.count), cx + swatchW + 24, cy + (ROW_H - 8) / 2)

    // Pct
    ctx.fillStyle = textCol
    ctx.font = '9px monospace'
    ctx.textAlign = 'right'
    ctx.textBaseline = 'middle'
    ctx.fillText(`${item.pct}%`, cx + swatchW + 42, cy + (ROW_H - 8) / 2)

    // Bar
    const barY = cy + ROW_H - 5
    ctx.fillStyle = borderCol
    ctx.beginPath()
    ctx.roundRect(cx + 1, barY, barW, 2, 1)
    ctx.fill()

    if (item.pct > 0) {
      ctx.fillStyle = item.color.hex
      ctx.beginPath()
      ctx.roundRect(cx + 1, barY, Math.max(2, barW * item.pct / 100), 2, 1)
      ctx.fill()
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

function onDragMove(e: MouseEvent) {
  if (!dragging.value) return
  const delta = dragStartX.value - e.clientX
  panelWidth.value = Math.min(MAX_W, Math.max(MIN_W, dragStartW.value + delta))
}

function onDragEnd() {
  dragging.value = false
  document.removeEventListener('mousemove', onDragMove)
  document.removeEventListener('mouseup', onDragEnd)
  document.body.style.cursor = ''
  document.body.style.userSelect = ''
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

watch([sortedColors, panelWidth], () => { nextTick(render) }, { deep: true })
</script>

<template>
  <aside
    v-if="beadGrid"
    ref="containerRef"
    class="color-legend"
    :style="{ width: panelWidth + 'px' }"
    :class="{ dragging }"
  >
    <div class="drag-handle" @mousedown="onDragStart">
      <span class="drag-grip"></span>
    </div>
    <canvas ref="canvasRef" class="legend-canvas" />
  </aside>
</template>

<style scoped>
.color-legend {
  flex-shrink: 0; padding: 8px 0; position: relative;
  border-left: 1px solid var(--border, #e5e4e7);
  overflow-y: auto; max-height: 100vh; box-sizing: border-box;
  background: color-mix(in srgb, var(--bg, #fff) 98%, var(--text, #6b6375));
}
.color-legend.dragging { transition: none; }
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
