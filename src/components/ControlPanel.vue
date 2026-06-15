<script setup lang="ts">
import type { BeadSettings, PaletteColor, ExportConfig } from '../types'
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
  'export': [config: ExportConfig]
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
    <div class="scheme-section">
      <label class="label">色彩计算</label>
      <select
        :value="settings.colorCalcMethod"
        @change="emit('update:settings', { ...settings, colorCalcMethod: ($event.target as HTMLSelectElement).value as any })"
      >
        <option value="average">平均色彩</option>
        <option value="dominant">主导色彩</option>
      </select>
      <label class="label" style="margin-top:8px">映射方式</label>
      <select
        :value="settings.colorMatchMethod"
        @change="emit('update:settings', { ...settings, colorMatchMethod: ($event.target as HTMLSelectElement).value as any })"
      >
        <option value="deltaE">Delta E (感知)</option>
        <option value="rgb">RGB 距离</option>
      </select>
    </div>

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
      :defaultDisplay="settings.display"
      :gridCols="settings.gridCols"
      :gridRows="settings.gridRows"
      @export="config => emit('export', config)"
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
.scheme-section { display: flex; flex-direction: column; gap: 6px; }
.scheme-section select {
  padding: 6px 10px; border: 1px solid var(--border); border-radius: 6px;
  font-size: 13px; background: var(--bg); color: var(--text-h);
}
</style>
