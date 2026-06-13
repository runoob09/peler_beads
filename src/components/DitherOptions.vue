<script setup lang="ts">
import type { DitherSettings, DitherAlgorithm } from '../types'

const props = defineProps<{ modelValue: DitherSettings }>()
const emit = defineEmits<{ 'update:modelValue': [value: DitherSettings] }>()

function updateAlgo(ev: Event) {
  emit('update:modelValue', { ...props.modelValue, algorithm: (ev.target as HTMLSelectElement).value as DitherAlgorithm })
}

function updateStrength(ev: Event) {
  emit('update:modelValue', { ...props.modelValue, strength: Number((ev.target as HTMLInputElement).value) })
}
</script>

<template>
  <div class="dither-options">
    <label class="label">抖动</label>
    <select :value="modelValue.algorithm" @change="updateAlgo">
      <option value="none">无</option>
      <option value="floydSteinberg">Floyd-Steinberg</option>
      <option value="atkinson">Atkinson</option>
    </select>
    <div v-if="modelValue.algorithm !== 'none'" class="slider-row">
      <span class="slider-label">强度</span>
      <input type="range" min="0" max="100" :value="modelValue.strength" @input="updateStrength" />
      <span class="value">{{ modelValue.strength }}%</span>
    </div>
  </div>
</template>

<style scoped>
.dither-options { display: flex; flex-direction: column; gap: 6px; }
.label { font-size: 13px; color: var(--text); font-weight: 500; }
select { padding: 4px 8px; border: 1px solid var(--border); border-radius: 4px; font-size: 13px; background: var(--bg); color: var(--text-h); }
.slider-row { display: flex; align-items: center; gap: 6px; }
.slider-label { font-size: 12px; color: var(--text); width: 30px; }
.slider-row input[type="range"] { flex: 1; }
.value { font-size: 12px; color: var(--text); font-family: var(--mono, monospace); width: 30px; text-align: right; }
</style>
