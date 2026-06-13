<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, nextTick, computed } from 'vue'
import type { BeadGrid } from '../types'
import { countColorUsage } from '../composables/useExport'

const props = defineProps<{ beadGrid: BeadGrid | null }>()
const canvasRef = ref<HTMLCanvasElement>()
const containerRef = ref<HTMLDivElement>()

const panelWidth = ref(170)
const MIN_W = 140
const MAX_W = 360
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
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.53 ? '#1a1a2e' : '#ffffff'
}

function labelShort(name: string): string {
  return name.split(/[\s_]+/)[0] ?? name
}

// Layout constants
const SWATCH_W = 40       // fixed swatch width
const ROW_H = 22           // row height per item
const HEADER_H = 34        // title + summary height
const PAD = 10             // horizontal padding
const ITEM_GAP = 6         // gap between columns
const TEXT_W = 40          // space for count + pct

function render() {
  const canvas = canvasRef.value
  const items = sortedColors.value
  if (!canvas) return

  const dpr = window.devicePixelRatio || 1
  const W = containerRef.value?.clientWidth ?? panelWidth.value

  // Calculate columns based on available width
  const availW = W - PAD * 2
  const perItemW = SWATCH_W + ITEM_GAP + TEXT_W
  const cols = Math.max(1, Math.floor(availW / perItemW))
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

  if (props.beadGrid) {
    ctx.fillStyle = textCol
    ctx.font = '11px monospace'
    ctx.textAlign = 'right'
    ctx.textBaseline = 'top'
    ctx.fillText(`${items.length} 色 · ${cols} 列`, W - PAD, 12)
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

    // Swatch — fixed 40px
    ctx.fillStyle = item.color.hex
    ctx.beginPath()
    ctx.roundRect(cx, cy + 2, SWATCH_W, swatchH, 3)
    ctx.fill()

    ctx.strokeStyle = 'rgba(0,0,0,0.08)'
    ctx.lineWidth = 0.5
    ctx.beginPath()
    ctx.roundRect(cx, cy + 2, SWATCH_W, swatchH, 3)
    ctx.stroke()

    // Label on swatch
    ctx.fillStyle = textColor(item.color.hex)
    ctx.font = '600 9px monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(labelShort(item.color.name), cx + SWATCH_W / 2, cy + 2 + swatchH / 2)

    // Count
    ctx.fillStyle = textH
    ctx.font = '700 11px monospace'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.fillText(String(item.count), cx + countX, midY - 1)

    // Pct
    ctx.fillStyle = textCol
    ctx.font = '9px monospace'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.fillText(`${item.pct}%`, cx + countX, midY + 9)
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
  flex-shrink: 0; padding: 12px 0; position: relative;
  border-left: 1px solid var(--border, #e5e4e7);
  overflow-y: auto; max-height: 100vh; box-sizing: border-box;
  background: color-mix(in srgb, var(--bg, #fff) 97%, var(--text, #6b6375));
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
