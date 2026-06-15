<script setup lang="ts">
import type { BeadSettings, PaletteColor } from '../types'
import ImageUploader from './ImageUploader.vue'
import SizeSelector from './SizeSelector.vue'
import PalettePanel from './PalettePanel.vue'
import ColorAdjustments from './ColorAdjustments.vue'
import DisplayOptions from './DisplayOptions.vue'
import ExportButtons from './ExportButtons.vue'

defineProps<{
  hasGrid: boolean
  settings: BeadSettings
  brandNames: string[]
  selectedBrand: string
  palette: PaletteColor[]
}>()

const emit = defineEmits<{
  'upload': [file: File]
  'update:settings': [settings: BeadSettings]
  'select-brand': [brand: string]
  'add-color': [{ hex: string; name: string }]
  'remove-color': [id: string]
  'export-png': []
  'export-pdf': []
  'save-project': [withImage: boolean]
  'load-project': []
}>()
</script>

<template>
  <aside class="control-panel">
    <h2 class="title">拼豆工具</h2>
    <ImageUploader @upload="emit('upload', $event)" />
    <SizeSelector
      :modelValue="{ cols: settings.gridCols, rows: settings.gridRows, keepAspectRatio: settings.keepAspectRatio }"
      @update:modelValue="emit('update:settings', { ...settings, gridCols: $event.cols, gridRows: $event.rows, keepAspectRatio: $event.keepAspectRatio })"
    />
    <PalettePanel
      :brandNames="brandNames"
      :selectedBrand="selectedBrand"
      :palette="palette"
      @select-brand="emit('select-brand', $event)"
      @add-color="emit('add-color', $event)"
      @remove-color="emit('remove-color', $event)"
    />
    <ColorAdjustments
      :modelValue="settings.adjustments"
      @update:modelValue="emit('update:settings', { ...settings, adjustments: $event })"
    />
    <DisplayOptions
      :modelValue="settings.display"
      @update:modelValue="emit('update:settings', { ...settings, display: $event })"
    />
    <ExportButtons
      :hasGrid="hasGrid"
      @export-png="emit('export-png')"
      @export-pdf="emit('export-pdf')"
      @save-project="emit('save-project', $event)"
      @load-project="emit('load-project')"
    />
  </aside>
</template>

<style scoped>
.control-panel {
  width: 280px; flex-shrink: 0; padding: 20px;
  border-right: 1px solid var(--border);
  overflow-y: auto; display: flex; flex-direction: column; gap: 16px;
  max-height: 100vh; box-sizing: border-box;
}
.title { font-size: 20px; font-weight: 600; color: var(--text-h); margin: 0; }
.label { font-size: 13px; color: var(--text); font-weight: 500; }
</style>
