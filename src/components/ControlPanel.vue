<script setup lang="ts">
import type { BeadSettings, PaletteColor, ExportConfig } from '../types'
import ImageUploader from './ImageUploader.vue'
import SizeSelector from './SizeSelector.vue'
import PalettePanel from './PalettePanel.vue'
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
    <div class="scheme-section">
      <label class="label">色彩计算</label>
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
      <div v-if="settings.colorCalcMethod === 'bucket'" class="slider-row">
        <span class="slider-label">粒度</span>
        <input
          type="range" min="2" max="16" :value="settings.bucketLevels"
          @input="emit('update:settings', { ...settings, bucketLevels: Number(($event.target as HTMLInputElement).value) })"
        />
        <span class="val">{{ settings.bucketLevels }}</span>
      </div>
      <div v-if="settings.colorCalcMethod === 'dominant'" class="slider-row">
        <span class="slider-label">容差</span>
        <input
          type="range" min="5" max="100" :value="settings.tolerance"
          @input="emit('update:settings', { ...settings, tolerance: Number(($event.target as HTMLInputElement).value) })"
        />
        <span class="val">{{ settings.tolerance }}</span>
      </div>
      <label class="label" style="margin-top:8px">映射方式</label>
      <select
        :value="settings.colorMatchMethod"
        @change="emit('update:settings', { ...settings, colorMatchMethod: ($event.target as HTMLSelectElement).value as any })"
      >
        <option value="deltaE">Delta E</option>
        <option value="ciede2000">CIEDE2000</option>
        <option value="rgb">RGB 距离</option>
        <option value="weightedRgb">加权 RGB</option>
      </select>
    </div>

    <div class="scheme-section">
      <label class="checkbox-label">
        <input
          type="checkbox" :checked="settings.merge.enabled"
          @change="emit('update:settings', { ...settings, merge: { ...settings.merge, enabled: ($event.target as HTMLInputElement).checked } })"
        />
        <span>后处理（合并相近色）</span>
      </label>
      <template v-if="settings.merge.enabled">
        <div class="slider-row">
          <span class="slider-label">孤岛</span>
          <input
            type="range" min="1" max="20" :value="settings.merge.minIslandSize"
            @input="emit('update:settings', { ...settings, merge: { ...settings.merge, minIslandSize: Number(($event.target as HTMLInputElement).value) } })"
          />
          <span class="val">{{ settings.merge.minIslandSize }}</span>
        </div>
        <div class="slider-row">
          <span class="slider-label">色差</span>
          <input
            type="range" min="1" max="20" :value="settings.merge.mergeThreshold"
            @input="emit('update:settings', { ...settings, merge: { ...settings.merge, mergeThreshold: Number(($event.target as HTMLInputElement).value) } })"
          />
          <span class="val">{{ settings.merge.mergeThreshold }}</span>
        </div>
      </template>
    </div>

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
.slider-row { display: flex; align-items: center; gap: 6px; }
.slider-label { font-size: 12px; color: var(--text); width: 28px; }
.slider-row input[type="range"] { flex: 1; }
.val { font-size: 12px; color: var(--text); font-family: var(--mono, monospace); width: 16px; text-align: right; }
.checkbox-label { display: flex; align-items: center; gap: 6px; font-size: 13px; color: var(--text-h); cursor: pointer; }
</style>
