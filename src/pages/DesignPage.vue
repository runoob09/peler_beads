<script setup lang="ts">
import { ref, watch } from 'vue'
import ControlPanel from '../components/ControlPanel.vue'
import ImageEditorModal from '../components/ImageEditorModal.vue'
import BeadPreview from '../components/BeadPreview.vue'
import ColorLegend from '../components/ColorLegend.vue'
import { usePaletteStore } from '../stores/paletteStore'
import { useBeadStore } from '../stores/beadStore'
import { useBrushStore } from '../stores/brushStore'
import { exportPNG, downloadBlob } from '../composables/useExport'
import { generatePdf } from '../utils/exportPdf'
import { extractFromPng, extractFromPdf } from '../utils/embedMetadata'
import type { BeadSettings, ExportConfig } from '../types'

const paletteStore = usePaletteStore()
const beadStore = useBeadStore()
const brushStore = useBrushStore()

const creationMode = ref<'image' | 'blank'>('image')
const imageFile = ref<File | null>(null)
const showEditor = ref(false)

function onUpload(file: File) {
  imageFile.value = file
  showEditor.value = true
}

function onEditorConfirm(file: File) {
  imageFile.value = file
  showEditor.value = false
  triggerProcess()
}

function onEditorCancel() {
  showEditor.value = false
  triggerProcess()
}

function onUpdateSettings(s: BeadSettings) {
  beadStore.settings = s
  triggerProcess()
}

function onRemoveColor(id: string) {
  paletteStore.removeColor(id)
  triggerProcess()
}

let debounceTimer: ReturnType<typeof setTimeout>
function triggerProcess() {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    brushStore.resetHistory()
    beadStore.process(imageFile.value, paletteStore.palette, beadStore.settings)
  }, 300)
}

watch(() => paletteStore.selectedBrand, () => { triggerProcess() })

function onCreateBlank() {
  const s = beadStore.settings
  beadStore.initEmptyGrid(s.gridRows, s.gridCols, paletteStore.palette)
  brushStore.brushMode = true
}

async function onExport(config: ExportConfig) {
  if (!beadStore.beadGrid) return
  const gridLines = {
    showGrid: config.showGrid,
    gridLineColor: config.gridLineColor,
    gridLineWidth: config.gridLineWidth,
    boldGridInterval: config.boldGridInterval,
    boldGridColor: config.boldGridColor,
    boldGridWidth: config.boldGridWidth,
  }

  // Compact grid data: flat row-major array of colorIndex | null
  const grid = beadStore.beadGrid
  const gridData: (number | null)[] = []
  for (let r = 0; r < grid.rows; r++) {
    for (let c = 0; c < grid.cols; c++) {
      gridData.push(grid.cells[r][c].colorIndex)
    }
  }

  const projectJson = JSON.stringify({
    version: 2,
    grid: { rows: grid.rows, cols: grid.cols, data: gridData },
    settings: beadStore.settings,
    palette: {
      brand: paletteStore.selectedBrand,
      colors: paletteStore.palette.filter(c => c.brand !== 'custom'),
      custom: paletteStore.palette.filter(c => c.brand === 'custom'),
    },
  })

  let imageBytes: Uint8Array | undefined
  if (imageFile.value) {
    const buf = await imageFile.value.arrayBuffer()
    imageBytes = new Uint8Array(buf)
  }

  if (config.format === 'png') {
    const blob = await exportPNG(beadStore.beadGrid, gridLines, config.cellSize, projectJson, imageBytes)
    downloadBlob(blob, `${config.filename}.png`)
  } else {
    const pdfBytes = await generatePdf(
      beadStore.beadGrid, gridLines, config.cellSize, config.filename,
      projectJson, imageBytes, imageFile.value?.type,
    )
    downloadBlob(new Blob([pdfBytes as any], { type: 'application/pdf' }), `${config.filename}.pdf`)
  }
}

async function onImportFromDrawing() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.png,.pdf,image/png,application/pdf'
  input.onchange = async () => {
    const file = input.files?.[0]
    if (!file) return

    try {
      const bytes = new Uint8Array(await file.arrayBuffer())
      const isPng = file.type === 'image/png' || file.name.endsWith('.png')
      const result = isPng ? extractFromPng(bytes) : await extractFromPdf(bytes)

      if (!result.projectJson) {
        alert('该文件中未找到项目数据')
        return
      }

      const project = JSON.parse(result.projectJson)
      if (project.settings) {
        beadStore.settings = { ...beadStore.settings, ...project.settings }
      }
      if (project.palette) {
        paletteStore.selectBrand(project.palette.brand || '')
        await new Promise(r => setTimeout(r, 100))
        for (const c of project.palette.custom || []) {
          paletteStore.addCustomColor({ hex: c.hex, name: c.name })
        }
      }

      // Restore grid data directly if present (v2+), preserving brush edits
      if (project.grid && project.grid.data && project.grid.rows && project.grid.cols) {
        const { rows, cols, data } = project.grid
        const cells = Array.from({ length: rows }, (_, r) =>
          Array.from({ length: cols }, (_, c) => ({
            row: r,
            col: c,
            colorIndex: data[r * cols + c] as number | null,
          })),
        )
        beadStore.beadGrid = {
          rows,
          cols,
          cells,
          palette: paletteStore.palette,
          imageCols: cols,
          imageRows: rows,
        }
        brushStore.resetHistory()
      } else if (result.imageBytes && result.imageBytes.length > 0) {
        // v1 fallback: re-process original image
        const blob = new Blob([result.imageBytes as unknown as BlobPart], { type: file.type || 'image/png' })
        imageFile.value = new File([blob], 'restored.png', { type: blob.type })
        triggerProcess()
      }
    } catch (e) {
      alert('无法解析该文件：' + (e instanceof Error ? e.message : '未知错误'))
    }
  }
  input.click()
}

</script>

<template>
  <div class="app-layout">
    <ControlPanel
      :hasGrid="!!beadStore.beadGrid"
      :settings="beadStore.settings"
      :brandNames="paletteStore.brandNames"
      :selectedBrand="paletteStore.selectedBrand"
      :palette="paletteStore.palette"
      :creationMode="creationMode"
      @upload="onUpload"
      @update:settings="onUpdateSettings"
      @remove-color="onRemoveColor"
      @export="onExport"
      @import-drawing="onImportFromDrawing"
      @update:creationMode="creationMode = $event"
      @create-blank="onCreateBlank"
    />
    <div class="preview-wrapper">
      <div v-if="beadStore.error" class="error-banner">{{ beadStore.error }}</div>
      <div v-if="!beadStore.beadGrid && beadStore.progress === 0" class="empty-state">
        <p v-if="creationMode === 'image'">上传图片开始</p>
        <p v-else>点击「创建画布」开始自由创作</p>
      </div>
      <BeadPreview />
    </div>
    <ColorLegend />
    <ImageEditorModal
      :show="showEditor"
      :imageFile="imageFile"
      @confirm="onEditorConfirm"
      @cancel="onEditorCancel"
    />
  </div>
</template>

<style scoped>
.app-layout { display: flex; height: 100vh; overflow: hidden; }

.preview-wrapper { flex: 1; display: flex; flex-direction: column; position: relative; }
.error-banner { background: #fee2e2; color: #dc2626; padding: 8px 16px; font-size: 13px; }
.loading-bar { background: var(--accent-bg, rgba(170, 59, 255, 0.1)); color: var(--accent, #aa3bff); padding: 4px 16px; font-size: 12px; }
.empty-state { flex: 1; display: flex; align-items: center; justify-content: center; color: var(--text); opacity: 0.5; font-size: 16px; }
</style>
