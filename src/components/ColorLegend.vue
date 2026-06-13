<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, nextTick, computed } from 'vue'
import type { BeadGrid } from '../types'
import { countColorUsage } from '../composables/useExport'

const props = defineProps<{ beadGrid: BeadGrid | null }>()
const canvasRef = ref<HTMLCanvasElement>()
const containerRef = ref<HTMLDivElement>()

const panelWidth = ref(170)
const MIN_W = 140
const MAX_W = 280
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

const ROW_H = 28
const HEADER_H = 34

function render() {
  const canvas = canvasRef.value
  const items = sortedColors.value
  if (!canvas) return

  const dpr = window.devicePixelRatio || 1
  const W = canvas.clientWidth
  const H = HEADER_H + items.length * ROW_H + 10

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
  const PAD = 12
  ctx.fillStyle = textH
  ctx.font = '600 13px system-ui'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  ctx.fillText('色彩图例', PAD, 10)

  if (props.beadGrid) {
    const total = props.beadGrid.rows * props.beadGrid.cols
    ctx.fillStyle = textCol
    ctx.font = '11px monospace'
    ctx.textAlign = 'right'
    ctx.textBaseline = 'top'
    ctx.fillText(`${items.length} 色 · ${total} 珠`, W - PAD, 12)
  }

  if (items.length === 0) return

  const swatchW = W - PAD * 2 - 52

  items.forEach((item, i) => {
    const y = HEADER_H + i * ROW_H
    const swatchH = ROW_H - 8
    const swatchY = y + 4

    // Swatch
    ctx.fillStyle = item.color.hex
    ctx.beginPath()
    ctx.roundRect(PAD, swatchY, swatchW, swatchH, 4)
    ctx.fill()

    // Subtle inner border
    ctx.strokeStyle = 'rgba(0,0,0,0.08)'
    ctx.lineWidth = 0.5
    ctx.beginPath()
    ctx.roundRect(PAD, swatchY, swatchW, swatchH, 4)
    ctx.stroke()

    // Label on swatch — centered, larger
    ctx.fillStyle = textColor(item.color.hex)
    ctx.font = '600 10px monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(labelShort(item.color.name), PAD + swatchW / 2, swatchY + swatchH / 2)

    // Count — right side, bold
    ctx.fillStyle = textH
    ctx.font = '700 12px monospace'
    ctx.textAlign = 'right'
    ctx.textBaseline = 'middle'
    ctx.fillText(String(item.count), W - PAD - 22, swatchY + swatchH / 2)

    // Pct — right side, subtle
    ctx.fillStyle = textCol
    ctx.font = '10px monospace'
    ctx.textAlign = 'right'
    ctx.textBaseline = 'middle'
    ctx.fillText(`${item.pct}%`, W - PAD, swatchY + swatchH / 2)
  })
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
