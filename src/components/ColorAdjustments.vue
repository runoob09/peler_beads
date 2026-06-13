<script setup lang="ts">
import type { AdjustmentSettings } from '../types'

const props = defineProps<{ modelValue: AdjustmentSettings }>()
const emit = defineEmits<{ 'update:modelValue': [value: AdjustmentSettings] }>()

function update(key: keyof AdjustmentSettings, value: number) {
  emit('update:modelValue', { ...props.modelValue, [key]: value })
}
</script>

<template>
  <div class="adjustments">
    <label class="label">颜色调整</label>
    <div class="slider-row">
      <span class="slider-label">亮度</span>
      <input type="range" min="-100" max="100" :value="modelValue.brightness"
        @input="update('brightness', Number(($event.target as HTMLInputElement).value))" />
      <span class="value">{{ modelValue.brightness }}</span>
    </div>
    <div class="slider-row">
      <span class="slider-label">对比度</span>
      <input type="range" min="-100" max="100" :value="modelValue.contrast"
        @input="update('contrast', Number(($event.target as HTMLInputElement).value))" />
      <span class="value">{{ modelValue.contrast }}</span>
    </div>
    <div class="slider-row">
      <span class="slider-label">饱和度</span>
      <input type="range" min="-100" max="100" :value="modelValue.saturation"
        @input="update('saturation', Number(($event.target as HTMLInputElement).value))" />
      <span class="value">{{ modelValue.saturation }}</span>
    </div>
  </div>
</template>

<style scoped>
.adjustments { display: flex; flex-direction: column; gap: 4px; }
.label { font-size: 13px; color: var(--text); font-weight: 500; }
.slider-row { display: flex; align-items: center; gap: 6px; }
.slider-label { font-size: 12px; color: var(--text); width: 42px; flex-shrink: 0; }
.slider-row input[type="range"] { flex: 1; }
.value { font-size: 12px; color: var(--text); width: 30px; text-align: right; font-family: var(--mono, monospace); }
</style>
