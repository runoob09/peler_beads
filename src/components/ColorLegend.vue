<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, nextTick, computed } from 'vue'
import type { BeadGrid } from '../types'
import { countColorUsage } from '../composables/useExport'

const props = defineProps<{ beadGrid: BeadGrid | null }>()
const canvasRef = ref<HTMLCanvasElement>()
const containerRef = ref<HTMLDivElement>()

const panelWidth = ref(220)
const MIN_W = 160
const MAX_W = 400
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
const HEADER_H = 28

function render() {
  const canvas = canvasRef.value
  const items = sortedColors.value
  if (!canvas) return

  const dpr = window.devicePixelRatio || 1
  const W = canvas.clientWidth
  const H = HEADER_H + items.length * ROW_H + 8

  canvas.width = W * dpr
  canvas.height = H * dpr
  canvas.style.width = W + 'px'
  canvas.style.height = H + 'px'

  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.scale(dpr, dpr)

  const styles = getComputedStyle(canvas)
  const bg = styles.getPropertyValue('--bg') || '#ffffff'
  const textColorVal = styles.getPropertyValue('--text') || '#6b6375'
  const textH = styles.getPropertyValue('--text-h') || '#08060d'
  const borderCol = styles.getPropertyValue('--border') || '#e5e4e7'

  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)

  // Title row — left: title, right: summary
  ctx.fillStyle = textH
  ctx.font = '600 13px system-ui'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  ctx.fillText('色彩图例', 12, 6)

  if (props.beadGrid) {
    const total = props.beadGrid.rows * props.beadGrid.cols
    ctx.fillStyle = textColorVal
    ctx.font = '11px monospace'
    ctx.textAlign = 'right'
    ctx.fillText(`${items.length} 色 · ${total} 珠`, W - 12, 8)
  }

  if (items.length === 0) return

  const PAD = 12
  const SWATCH_W = Math.max(40, W - PAD * 2 - 100)
  const barAreaL = PAD + SWATCH_W + 44

  items.forEach((item, i) => {
    const y = HEADER_H + i * ROW_H

    // Swatch
    ctx.fillStyle = item.color.hex
    ctx.beginPath()
    ctx.roundRect(PAD, y, SWATCH_W, ROW_H - 6, 3)
    ctx.fill()

    ctx.strokeStyle = borderCol
    ctx.lineWidth = 0.5
    ctx.beginPath()
    ctx.roundRect(PAD, y, SWATCH_W, ROW_H - 6, 3)
    ctx.stroke()

    // Label on swatch
    ctx.fillStyle = textColor(item.color.hex)
    ctx.font = 'bold 8px monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(labelShort(item.color.name), PAD + SWATCH_W / 2, y + (ROW_H - 6) / 2)

    // Count
    ctx.fillStyle = textH
    ctx.font = '600 10px monospace'
    ctx.textAlign = 'right'
    ctx.textBaseline = 'middle'
    ctx.fillText(String(item.count), PAD + SWATCH_W + 36, y + (ROW_H - 6) / 2)

    // Bar bg
    const barW = Math.max(20, W - barAreaL - PAD)
    const barY = y + ROW_H - 7
    ctx.fillStyle = borderCol
    ctx.beginPath()
    ctx.roundRect(barAreaL, barY, barW, 2, 1)
    ctx.fill()

    if (item.pct > 0) {
      ctx.fillStyle = item.color.hex
      ctx.beginPath()
      ctx.roundRect(barAreaL, barY, Math.max(2, barW * item.pct / 100), 2, 1)
      ctx.fill()
    }
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

watch(sortedColors, () => { nextTick(render) }, { deep: true })
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
  transition: none;
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
