<script setup lang="ts">
import { ref, watch } from 'vue'
import ControlPanel from './components/ControlPanel.vue'
import BeadPreview from './components/BeadPreview.vue'
import ColorLegend from './components/ColorLegend.vue'
import { usePaletteStore } from './stores/paletteStore'
import { useBeadStore } from './stores/beadStore'
import { useBrushStore } from './stores/brushStore'
import { exportPNG, downloadBlob } from './composables/useExport'
import { generatePdf } from './utils/exportPdf'
import { extractFromPng, extractFromPdf } from './utils/embedMetadata'
import type { BeadSettings, ExportConfig } from './types'

const paletteStore = usePaletteStore()
const beadStore = useBeadStore()
const brushStore = useBrushStore()

const imageFile = ref<File | null>(null)

function onUpload(file: File) {
  imageFile.value = file
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

  const projectJson = JSON.stringify({
    version: 1,
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
      if (result.imageBytes && result.imageBytes.length > 0) {
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
      @upload="onUpload"
      @update:settings="onUpdateSettings"
      @remove-color="onRemoveColor"
      @export="onExport"
      @import-drawing="onImportFromDrawing"
    />
    <div class="preview-wrapper">
      <div v-if="beadStore.error" class="error-banner">{{ beadStore.error }}</div>
      <BeadPreview />
    </div>
    <ColorLegend :beadGrid="beadStore.beadGrid" />
  </div>
</template>

<style>
.app-layout { display: flex; height: 100vh; overflow: hidden; }

#app { width: 100%; max-width: 100%; }

.preview-wrapper { flex: 1; display: flex; flex-direction: column; position: relative; }
.error-banner { background: #fee2e2; color: #dc2626; padding: 8px 16px; font-size: 13px; }
.loading-bar { background: var(--accent-bg, rgba(170, 59, 255, 0.1)); color: var(--accent, #aa3bff); padding: 4px 16px; font-size: 12px; }

/* Beautified scrollbar */
::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: var(--border, #d4d4d8); border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: var(--text, #9ca3af); }

/* Firefox */
* { scrollbar-width: thin; scrollbar-color: var(--border, #d4d4d8) transparent; }
</style>
