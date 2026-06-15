<script setup lang="ts">
import { ref, watch } from 'vue'
import ControlPanel from './components/ControlPanel.vue'
import BeadPreview from './components/BeadPreview.vue'
import ColorLegend from './components/ColorLegend.vue'
import { usePalette } from './composables/usePalette'
import { useBeadPipeline } from './composables/useBeadPipeline'
import { exportPNG, downloadBlob } from './composables/useExport'
import { generatePdf } from './utils/exportPdf'
import { extractFromPng, extractFromPdf } from './utils/embedMetadata'
import type { BeadSettings, ProjectFile, ExportConfig } from './types'

const { brandNames, palette, selectedBrand, selectBrand, addCustomColor, removeColor } = usePalette()
const { beadGrid, settings, process, progress, error } = useBeadPipeline()

const imageFile = ref<File | null>(null)

function onUpload(file: File) {
  imageFile.value = file
  triggerProcess()
}

function onUpdateSettings(s: BeadSettings) {
  settings.value = s
  triggerProcess()
}

function onRemoveColor(id: string) {
  removeColor(id)
  triggerProcess()
}

let debounceTimer: ReturnType<typeof setTimeout>
function triggerProcess() {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    process(imageFile.value, palette.value, settings.value)
  }, 300)
}

watch(selectedBrand, () => { triggerProcess() })

async function onExport(config: ExportConfig) {
  if (!beadGrid.value) return
  const gridLines = {
    showGrid: config.showGrid,
    gridLineColor: config.gridLineColor,
    gridLineWidth: config.gridLineWidth,
    boldGridInterval: config.boldGridInterval,
    boldGridColor: config.boldGridColor,
    boldGridWidth: config.boldGridWidth,
  }

  // Build project data for embedding
  const projectJson = JSON.stringify({
    version: 1,
    settings: settings.value,
    palette: {
      brand: selectedBrand.value,
      colors: palette.value.filter(c => c.brand !== 'custom'),
      custom: palette.value.filter(c => c.brand === 'custom'),
    },
  })

  // Get original image bytes
  let imageBytes: Uint8Array | undefined
  if (imageFile.value) {
    const buf = await imageFile.value.arrayBuffer()
    imageBytes = new Uint8Array(buf)
  }

  if (config.format === 'png') {
    const blob = await exportPNG(beadGrid.value, gridLines, config.cellSize, projectJson, imageBytes)
    downloadBlob(blob, `${config.filename}.png`)
  } else {
    const pdfBytes = await generatePdf(
      beadGrid.value, gridLines, config.cellSize, config.filename,
      projectJson, imageBytes, imageFile.value?.type,
    )
    downloadBlob(new Blob([pdfBytes as any], { type: 'application/pdf' }), `${config.filename}.pdf`)
  }
}

function onSaveProject(includeImage: boolean) {
  if (!beadGrid.value) return
  const project: ProjectFile = {
    version: 1,
    meta: {
      name: `拼豆项目_${new Date().toISOString().slice(0, 10)}`,
      createdAt: new Date().toISOString(),
      brandPalette: selectedBrand.value,
    },
    settings: settings.value,
    palette: {
      brand: selectedBrand.value,
      colors: palette.value.filter(c => c.brand !== 'custom'),
      custom: palette.value.filter(c => c.brand === 'custom'),
    },
  }
  if (includeImage && imageFile.value) {
    const reader = new FileReader()
    reader.onload = () => {
      project.image = reader.result as string
      downloadBlob(new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' }), project.meta.name + '.beads.json')
    }
    reader.readAsDataURL(imageFile.value)
  } else {
    downloadBlob(new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' }), project.meta.name + '.beads.json')
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
        settings.value = { ...settings.value, ...project.settings }
      }
      if (project.palette) {
        selectBrand(project.palette.brand || '')
        // Wait for brand palette to load
        await new Promise(r => setTimeout(r, 100))
        for (const c of project.palette.custom || []) {
          addCustomColor({ hex: c.hex, name: c.name })
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

function onLoadProject() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.beads.json,application/json'
  input.onchange = async () => {
    const file = input.files?.[0]
    if (!file) return
    const text = await file.text()
    const project: ProjectFile = JSON.parse(text)
    if (project.version !== 1) { alert('不支持的项目文件版本'); return }
    settings.value = project.settings
    selectBrand(project.palette.brand)
    for (const c of project.palette.custom) {
      addCustomColor({ hex: c.hex, name: c.name })
    }
    if (project.image) {
      const resp = await fetch(project.image)
      const blob = await resp.blob()
      imageFile.value = new File([blob], 'restored.png', { type: 'image/png' })
      triggerProcess()
    }
  }
  input.click()
}
</script>

<template>
  <div class="app-layout">
    <ControlPanel
      :hasGrid="!!beadGrid"
      :settings="settings"
      :brandNames="brandNames"
      :selectedBrand="selectedBrand"
      :palette="palette"
      @upload="onUpload"
      @update:settings="onUpdateSettings"
      @select-brand="selectBrand"
      @remove-color="onRemoveColor"
      @export="onExport"
      @save-project="onSaveProject"
      @load-project="onLoadProject"
      @import-drawing="onImportFromDrawing"
    />
    <div class="preview-wrapper">
      <div v-if="error" class="error-banner">{{ error }}</div>
      <BeadPreview :beadGrid="beadGrid" :display="settings.display" :progress="progress" />
    </div>
    <ColorLegend :beadGrid="beadGrid" />
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
