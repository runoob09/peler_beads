<script setup lang="ts">
import type { BeadSettings, PaletteColor, ExportConfig } from '../types'
import ImageUploader from './ImageUploader.vue'
import SizeSelector from './SizeSelector.vue'
import PalettePanel from './PalettePanel.vue'
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

    <div class="divider" />

    <SizeSelector
      :modelValue="{ cols: settings.gridCols, rows: settings.gridRows, keepAspectRatio: settings.keepAspectRatio }"
      @update:modelValue="emit('update:settings', { ...settings, gridCols: $event.cols, gridRows: $event.rows, keepAspectRatio: $event.keepAspectRatio })"
    />

    <div class="divider" />

    <PalettePanel
      :brandNames="brandNames"
      :selectedBrand="selectedBrand"
      :palette="palette"
      @select-brand="emit('select-brand', $event)"
      @remove-color="emit('remove-color', $event)"
    />

    <div class="divider" />

    <div class="section">
      <h3 class="section-title">色彩映射</h3>

      <label class="field">
        <span class="field-label">计算方式</span>
        <select
          :value="settings.colorCalcMethod"
          @change="emit('update:settings', { ...settings, colorCalcMethod: ($event.target as HTMLSelectElement).value as any })"
        >
          <option value="average">平均色彩</option>
          <option value="median">中位色彩</option>
          <option value="centerWeighted">中心加权</option>
          <option value="dominant">主导色彩</option>
          <option value="bucket">色桶主导</option>
        </select>
      </label>

      <div v-if="settings.colorCalcMethod === 'bucket'" class="field">
        <div class="slider-head">
          <span class="field-label">粒度</span>
          <span class="field-value">{{ settings.bucketLevels }}</span>
        </div>
        <input
          type="range" min="2" max="32" :value="settings.bucketLevels"
          @input="emit('update:settings', { ...settings, bucketLevels: Number(($event.target as HTMLInputElement).value) })"
        />
      </div>

      <div v-if="settings.colorCalcMethod === 'dominant'" class="field">
        <div class="slider-head">
          <span class="field-label">容差</span>
          <span class="field-value">{{ settings.tolerance }}</span>
        </div>
        <input
          type="range" min="5" max="100" :value="settings.tolerance"
          @input="emit('update:settings', { ...settings, tolerance: Number(($event.target as HTMLInputElement).value) })"
        />
      </div>

      <label class="field">
        <span class="field-label">映射方式</span>
        <select
          :value="settings.colorMatchMethod"
          @change="emit('update:settings', { ...settings, colorMatchMethod: ($event.target as HTMLSelectElement).value as any })"
        >
          <option value="deltaE">Delta E</option>
          <option value="ciede2000">CIEDE2000</option>
          <option value="rgb">RGB 距离</option>
          <option value="weightedRgb">加权 RGB</option>
        </select>
      </label>
    </div>

    <div class="divider" />

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
  overflow-y: auto; display: flex; flex-direction: column; gap: 12px;
  max-height: 100vh; box-sizing: border-box;
}
.title {
  font-size: 18px; font-weight: 600; color: var(--text-h); margin: 0;
}

.divider {
  border: none;
  border-top: 1px solid var(--border);
  margin: 0;
}

.section {
  display: flex; flex-direction: column; gap: 8px;
}
.section-title {
  font-size: 13px; font-weight: 600; color: var(--text-h);
  margin: 0;
}
.toggle {
  display: flex; align-items: center; gap: 6px; cursor: pointer;
}
.toggle input[type="checkbox"] {
  margin: 0; accent-color: var(--accent);
}

.field {
  display: flex; flex-direction: column; gap: 4px;
}
.field-label {
  font-size: 12px; color: var(--text);
}
.field-value {
  font-size: 12px; color: var(--text);
  font-family: var(--mono, monospace);
}
.slider-head {
  display: flex; justify-content: space-between; align-items: center;
}
.field select {
  padding: 5px 8px; border: 1px solid var(--border); border-radius: 5px;
  font-size: 12px; background: var(--bg); color: var(--text-h);
}
.field input[type="range"] {
  width: 100%; margin: 0;
}
</style>
