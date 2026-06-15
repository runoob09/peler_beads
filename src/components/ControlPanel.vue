<script setup lang="ts">
import type { BeadSettings, ExportConfig } from '../types'
import { usePaletteStore } from '../stores/paletteStore'
import { useBeadStore } from '../stores/beadStore'
import { useBrushStore } from '../stores/brushStore'
import ImageUploader from './ImageUploader.vue'
import SizeSelector from './SizeSelector.vue'
import PalettePanel from './PalettePanel.vue'
import ExportButtons from './ExportButtons.vue'

const paletteStore = usePaletteStore()
const beadStore = useBeadStore()
const brushStore = useBrushStore()

// Still accept some props from App.vue for backward compat
defineProps<{
  hasGrid: boolean
  settings: BeadSettings
  brandNames: string[]
  selectedBrand: string
  palette: any[]
}>()

const emit = defineEmits<{
  'upload': [file: File]
  'update:settings': [settings: BeadSettings]
  'remove-color': [id: string]
  'export': [config: ExportConfig]
  'import-drawing': []
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
      :brushMode="brushStore.brushMode"
      :activeColorIndex="brushStore.activeColorIndex"
      @select-brand="paletteStore.selectBrand($event)"
      @remove-color="emit('remove-color', $event)"
      @select-color="brushStore.setActiveColor($event)"
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

    <!-- Brush Toolbar -->
    <div class="section">
      <h3 class="section-title">画笔编辑</h3>
      <div class="brush-toolbar">
        <button
          class="brush-toggle"
          :class="{ active: brushStore.brushMode }"
          :disabled="!beadStore.beadGrid"
          @click="brushStore.toggleBrushMode()"
        >
          🖌️ {{ brushStore.brushMode ? '编辑中' : '画笔' }}
        </button>
        <div v-if="brushStore.brushMode && brushStore.activeColorIndex !== null" class="brush-color-preview">
          <span class="brush-swatch" :style="{ background: paletteStore.palette[brushStore.activeColorIndex]?.hex || '#ccc' }"></span>
          <span class="brush-color-name">{{ paletteStore.palette[brushStore.activeColorIndex]?.name || '未选择' }}</span>
        </div>
      </div>
      <div v-if="brushStore.brushMode" class="brush-hint">
        拖拽涂色 · Ctrl+滚轮缩放 · Ctrl+Z/Y 撤销/重做
      </div>
    </div>

    <div class="divider" />

    <ExportButtons
      :hasGrid="hasGrid"
      :defaultDisplay="settings.display"
      :gridCols="settings.gridCols"
      :gridRows="settings.gridRows"
      @export="config => emit('export', config)"
      @import-drawing="emit('import-drawing')"
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

.brush-toolbar {
  display: flex; align-items: center; gap: 8px;
}
.brush-toggle {
  padding: 5px 12px;
  border: 1px solid var(--border);
  border-radius: 5px;
  background: var(--bg);
  color: var(--text-h);
  cursor: pointer;
  font-size: 13px;
  transition: background 0.15s, border-color 0.15s;
}
.brush-toggle:hover:not(:disabled) {
  border-color: var(--accent, #aa3bff);
}
.brush-toggle.active {
  background: var(--accent, #aa3bff);
  color: #fff;
  border-color: var(--accent, #aa3bff);
}
.brush-toggle:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.brush-color-preview {
  display: flex; align-items: center; gap: 4px;
}
.brush-swatch {
  width: 16px; height: 16px; border-radius: 3px; border: 1px solid var(--border);
  flex-shrink: 0;
}
.brush-color-name {
  font-size: 11px; color: var(--text);
  font-family: var(--mono, monospace);
  max-width: 80px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.brush-hint {
  font-size: 11px; color: var(--text);
  opacity: 0.7;
}
</style>
