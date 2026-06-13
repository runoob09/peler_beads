<script setup lang="ts">
import { ref, watch, onMounted, nextTick, computed } from 'vue'
import type { BeadGrid, DisplaySettings, PaletteColor } from '../types'
import { renderGridToCanvas } from '../composables/useExport'

const props = defineProps<{
  beadGrid: BeadGrid | null
  display: DisplaySettings
  progress: number
}>()

const emit = defineEmits<{
  'cell-click': [cell: { row: number; col: number; color: PaletteColor }]
}>()

const canvasRef = ref<HTMLCanvasElement>()
const containerRef = ref<HTMLDivElement>()
const hoveredCell = ref<{ row: number; col: number } | null>(null)
const cellSize = ref(20)

function render() {
  if (!canvasRef.value || !props.beadGrid) return
  const container = containerRef.value
  if (!container) return

  const maxW = container.clientWidth || 400
  const maxH = container.clientHeight || 400
  cellSize.value = Math.floor(Math.min(maxW / props.beadGrid.cols, maxH / props.beadGrid.rows))

  const rendered = renderGridToCanvas(props.beadGrid, props.display.renderMode, cellSize.value, {
    showGrid: props.display.showGrid,
    gridLineColor: props.display.gridLineColor,
    gridLineWidth: props.display.gridLineWidth,
    boldGridInterval: props.display.boldGridInterval,
    boldGridColor: props.display.boldGridColor,
    boldGridWidth: props.display.boldGridWidth,
  })

  canvasRef.value.width = rendered.width
  canvasRef.value.height = rendered.height
  canvasRef.value.style.width = rendered.width + 'px'
  canvasRef.value.style.height = rendered.height + 'px'
  const ctx = canvasRef.value.getContext('2d')
  if (!ctx) return
  ctx.drawImage(rendered, 0, 0)
}

function onMouseMove(event: MouseEvent) {
  if (!props.beadGrid || !canvasRef.value) return
  const rect = canvasRef.value.getBoundingClientRect()
  const x = event.clientX - rect.left
  const y = event.clientY - rect.top
  const col = Math.floor(x / cellSize.value)
  const row = Math.floor(y / cellSize.value)
  if (row >= 0 && row < props.beadGrid.rows && col >= 0 && col < props.beadGrid.cols) {
    hoveredCell.value = { row, col }
  } else {
    hoveredCell.value = null
  }
}

function onMouseLeave() {
  hoveredCell.value = null
}

function onClick() {
  if (!props.beadGrid || !hoveredCell.value) return
  const { row, col } = hoveredCell.value
  const color = props.beadGrid.palette[props.beadGrid.cells[row][col].colorIndex]
  emit('cell-click', { row, col, color })
}

const hoveredColor = computed(() => {
  if (!hoveredCell.value || !props.beadGrid) return null
  const { row, col } = hoveredCell.value
  return props.beadGrid.palette[props.beadGrid.cells[row][col].colorIndex]
})

const stageLabel = computed(() => {
  const p = props.progress
  if (p <= 0) return ''
  if (p <= 25) return '加载图片...'
  if (p <= 45) return '缩放...'
  if (p <= 65) return '颜色调整...'
  if (p <= 85) return '颜色匹配...'
  if (p < 100) return '抖动处理...'
  return '完成'
})

onMounted(() => { nextTick(render) })
watch(() => [props.beadGrid, props.display], () => { nextTick(render) }, { deep: true })
</script>

<template>
  <div ref="containerRef" class="bead-preview">
    <template v-if="progress > 0">
      <div class="progress-overlay">
        <div class="progress-card">
          <div class="progress-track">
            <div class="progress-fill" :style="{ width: progress + '%' }"></div>
          </div>
          <div class="progress-text">{{ stageLabel }} {{ progress }}%</div>
        </div>
      </div>
    </template>
    <template v-if="beadGrid">
      <div class="preview-canvas-wrap" style="position:relative">
        <canvas ref="canvasRef" @mousemove="onMouseMove" @mouseleave="onMouseLeave" @click="onClick" />
        <div v-if="hoveredColor" class="tooltip" :style="{ left: ((hoveredCell?.col ?? 0) * cellSize + cellSize) + 'px', top: ((hoveredCell?.row ?? 0) * cellSize) + 'px' }">
          {{ hoveredColor.name || hoveredColor.hex }}
        </div>
      </div>
      <div class="grid-info">{{ beadGrid.rows }} × {{ beadGrid.cols }} · {{ beadGrid.palette.length }} 色</div>
    </template>
    <div v-if="!beadGrid && progress === 0" class="empty-state"><p>上传图片开始</p></div>
  </div>
</template>

<style scoped>
.bead-preview { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 400px; background: var(--bg); position: relative; overflow: auto; }
.tooltip { position: absolute; background: rgba(0,0,0,0.8); color: #fff; padding: 2px 8px; border-radius: 4px; font-size: 12px; white-space: nowrap; pointer-events: none; transform: translate(8px, -50%); z-index: 10; }
.grid-info { margin-top: 8px; font-size: 12px; color: var(--text); font-family: var(--mono, monospace); }
.empty-state { color: var(--text); font-size: 16px; }

.progress-overlay {
  position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
  background: var(--bg, #fff); z-index: 20;
}
.progress-card {
  text-align: center; width: 260px;
}
.progress-track {
  height: 8px; background: var(--border, #e5e4e7); border-radius: 4px; overflow: hidden;
}
.progress-fill {
  height: 100%; background: var(--accent, #aa3bff); border-radius: 4px;
  transition: width 0.25s ease;
}
.progress-text {
  margin-top: 10px; font-size: 13px; color: var(--text, #6b6375); font-family: var(--mono, monospace);
}
</style>
