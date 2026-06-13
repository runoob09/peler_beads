<script setup lang="ts">
import { ref, watch } from 'vue'
import ControlPanel from './components/ControlPanel.vue'
import BeadPreview from './components/BeadPreview.vue'
import { usePalette } from './composables/usePalette'
import { useBeadPipeline } from './composables/useBeadPipeline'
import { exportPNG, downloadBlob } from './composables/useExport'
import { generatePdf } from './utils/exportPdf'
import type { BeadSettings, ProjectFile } from './types'

const { brandNames, palette, selectedBrand, selectBrand, addCustomColor, removeColor } = usePalette()
const { beadGrid, settings, process } = useBeadPipeline()

const imageFile = ref<File | null>(null)

function onUpload(file: File) {
  imageFile.value = file
  triggerProcess()
}

function onUpdateSettings(s: BeadSettings) {
  settings.value = s
  triggerProcess()
}

function onAddColor(color: { hex: string; name: string }) {
  addCustomColor(color)
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

async function onExportPng() {
  if (!beadGrid.value) return
  const blob = await exportPNG(beadGrid.value, {
    showGrid: settings.value.display.showGrid,
    gridLineColor: settings.value.display.gridLineColor,
    gridLineWidth: settings.value.display.gridLineWidth,
    boldGridInterval: settings.value.display.boldGridInterval,
    boldGridColor: settings.value.display.boldGridColor,
    boldGridWidth: settings.value.display.boldGridWidth,
  }, 20)
  downloadBlob(blob, 'perler-beads.png')
}

async function onExportPdf() {
  if (!beadGrid.value) return
  const pdfBytes = await generatePdf(
    beadGrid.value,
    {
      showGrid: settings.value.display.showGrid,
      gridLineColor: settings.value.display.gridLineColor,
      gridLineWidth: settings.value.display.gridLineWidth,
      boldGridInterval: settings.value.display.boldGridInterval,
      boldGridColor: settings.value.display.boldGridColor,
      boldGridWidth: settings.value.display.boldGridWidth,
    },
    20,
    `拼豆图案 ${beadGrid.value.cols}×${beadGrid.value.rows}`,
  )
  downloadBlob(new Blob([pdfBytes as any], { type: 'application/pdf' }), 'perler-beads.pdf')
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
      @add-color="onAddColor"
      @remove-color="onRemoveColor"
      @export-png="onExportPng"
      @export-pdf="onExportPdf"
      @save-project="onSaveProject"
      @load-project="onLoadProject"
    />
    <BeadPreview :beadGrid="beadGrid" :display="settings.display" />
  </div>
</template>

<style>
.app-layout { display: flex; height: 100vh; overflow: hidden; }
</style>
