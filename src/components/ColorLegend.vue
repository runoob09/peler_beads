<script setup lang="ts">
import { ref, watch, onMounted, nextTick, computed } from 'vue'
import type { BeadGrid } from '../types'
import { countColorUsage } from '../composables/useExport'

const props = defineProps<{ beadGrid: BeadGrid | null }>()
const canvasRef = ref<HTMLCanvasElement>()
const containerRef = ref<HTMLDivElement>()

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
const PAD = 10
const SWATCH_W = 58

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

  // Background
  ctx.fillStyle = getComputedStyle(canvas).getPropertyValue('--bg') || '#ffffff'
  ctx.fillRect(0, 0, W, H)

  const textStyle = getComputedStyle(canvas)
  const textColorVal = textStyle.getPropertyValue('--text') || '#6b6375'
  const textHColor = textStyle.getPropertyValue('--text-h') || '#08060d'
  const borderColor = textStyle.getPropertyValue('--border') || '#e5e4e7'

  // Title
  ctx.fillStyle = textHColor
  ctx.font = '600 14px system-ui'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  ctx.fillText('色彩图例', PAD, 6)

  // Summary line
  const totalBeads = props.beadGrid ? props.beadGrid.rows * props.beadGrid.cols : 0
  ctx.fillStyle = textColorVal
  ctx.font = '12px system-ui'
  ctx.fillText(`${items.length} 色 · ${totalBeads} 珠`, PAD, 6)

  if (items.length === 0) return

  const barAreaLeft = PAD + SWATCH_W + 38 + 28

  items.forEach((item, i) => {
    const y = HEADER_H + i * ROW_H

    // Swatch background
    ctx.fillStyle = item.color.hex
    ctx.beginPath()
    ctx.roundRect(PAD, y, SWATCH_W, ROW_H - 6, 3)
    ctx.fill()

    // Swatch border
    ctx.strokeStyle = borderColor
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
    ctx.fillStyle = textHColor
    ctx.font = '600 11px monospace'
    ctx.textAlign = 'right'
    ctx.textBaseline = 'middle'
    ctx.fillText(String(item.count), PAD + SWATCH_W + 34, y + (ROW_H - 6) / 2)

    // Percentage
    ctx.fillStyle = textColorVal
    ctx.font = '10px monospace'
    ctx.textAlign = 'right'
    ctx.fillText(`${item.pct}%`, PAD + SWATCH_W + 60, y + (ROW_H - 6) / 2)

    // Mini bar background
    const barY = y + ROW_H - 8
    const barMaxW = W - barAreaLeft - PAD
    ctx.fillStyle = borderColor
    ctx.beginPath()
    ctx.roundRect(barAreaLeft, barY, barMaxW, 3, 1)
    ctx.fill()

    // Mini bar fill
    if (item.pct > 0) {
      ctx.fillStyle = item.color.hex
      ctx.beginPath()
      ctx.roundRect(barAreaLeft, barY, Math.max(2, barMaxW * item.pct / 100), 3, 1)
      ctx.fill()
    }
  })
}

// ResizeObserver for responsive canvas width
let observer: ResizeObserver | null = null

onMounted(() => {
  nextTick(render)
  if (containerRef.value) {
    observer = new ResizeObserver(() => render())
    observer.observe(containerRef.value)
  }
})

watch(sortedColors, () => { nextTick(render) }, { deep: true })
</script>

<template>
  <aside ref="containerRef" class="color-legend">
    <template v-if="!beadGrid">
      <h3 class="legend-title">色彩图例</h3>
      <div class="legend-empty">上传图片后将显示颜色统计</div>
    </template>
    <canvas v-else ref="canvasRef" class="legend-canvas" />
  </aside>
</template>

<style scoped>
.color-legend {
  width: 220px; flex-shrink: 0; padding: 8px 0;
  border-left: 1px solid var(--border, #e5e4e7);
  overflow-y: auto; max-height: 100vh; box-sizing: border-box;
  background: color-mix(in srgb, var(--bg, #fff) 98%, var(--text, #6b6375));
}
.legend-title {
  font-size: 14px; font-weight: 600; color: var(--text-h, #08060d);
  margin: 0 0 8px; padding: 0 12px;
}
.legend-empty {
  font-size: 12px; color: var(--text, #6b6375); padding: 0 12px;
}
.legend-canvas {
  display: block; width: 100%;
}
</style>
