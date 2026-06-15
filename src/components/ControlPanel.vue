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

    <SizeSelector
      :modelValue="{ cols: settings.gridCols, rows: settings.gridRows, keepAspectRatio: settings.keepAspectRatio }"
      @update:modelValue="emit('update:settings', { ...settings, gridCols: $event.cols, gridRows: $event.rows, keepAspectRatio: $event.keepAspectRatio })"
    />

    <PalettePanel
      :brandNames="brandNames"
      :selectedBrand="selectedBrand"
      :palette="palette"
      @select-brand="emit('select-brand', $event)"
      @remove-color="emit('remove-color', $event)"
    />

    <div class="divider" />

    <details class="section" open>
      <summary class="section-title">色彩映射</summary>
      <div class="section-body">
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
          <div class="field-row">
            <span class="field-label">粒度</span>
            <span class="field-value">{{ settings.bucketLevels }}</span>
          </div>
          <input
            type="range" min="2" max="32" :value="settings.bucketLevels"
            @input="emit('update:settings', { ...settings, bucketLevels: Number(($event.target as HTMLInputElement).value) })"
          />
        </div>

        <div v-if="settings.colorCalcMethod === 'dominant'" class="field">
          <div class="field-row">
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
    </details>

    <details class="section" :open="settings.merge.enabled">
      <summary class="section-title">后处理</summary>
      <div class="section-body">
        <label class="field inline">
          <input
            type="checkbox" :checked="settings.merge.enabled"
            @change="emit('update:settings', { ...settings, merge: { ...settings.merge, enabled: ($event.target as HTMLInputElement).checked } })"
          />
          <span>合并相近色</span>
        </label>

        <div v-if="settings.merge.enabled" class="field">
          <div class="field-row">
            <span class="field-label">色差阈值</span>
            <span class="field-value">{{ settings.merge.mergeThreshold }}</span>
          </div>
          <input
            type="range" min="1" max="20" :value="settings.merge.mergeThreshold"
            @input="emit('update:settings', { ...settings, merge: { ...settings.merge, mergeThreshold: Number(($event.target as HTMLInputElement).value) } })"
          />
        </div>
      </div>
    </details>

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
  font-size: 18px; font-weight: 600; color: var(--text-h); margin: 0 0 4px;
}

/* Dividers */
.divider {
  border: none; border-top: 1px solid var(--border);
  margin: 2px 0;
}

/* Collapsible sections */
.section {
  margin: 0;
}
.section-title {
  font-size: 13px; font-weight: 600; color: var(--text-h);
  cursor: pointer; padding: 4px 0; user-select: none;
  list-style: none;
}
.section-title::-webkit-details-marker { display: none; }
.section-title::before {
  content: '▾ '; font-size: 10px; vertical-align: middle;
  transition: transform 0.15s;
}
.section[open] .section-title::before { content: '▾ '; }
.section:not([open]) .section-title::before { content: '▸ '; }

.section-body {
  display: flex; flex-direction: column; gap: 8px;
  padding: 4px 0 4px 8px;
}

/* Form fields */
.field {
  display: flex; flex-direction: column; gap: 4px;
}
.field.inline {
  flex-direction: row; align-items: center; gap: 6px;
}
.field-label {
  font-size: 12px; color: var(--text);
}
.field-value {
  font-size: 12px; color: var(--text);
  font-family: var(--mono, monospace);
}
.field-row {
  display: flex; justify-content: space-between; align-items: center;
}
.field select {
  padding: 5px 8px; border: 1px solid var(--border); border-radius: 5px;
  font-size: 12px; background: var(--bg); color: var(--text-h);
}
.field input[type="range"] {
  width: 100%; margin: 0;
}
.field input[type="checkbox"] {
  margin: 0; accent-color: var(--accent);
}
</style>
