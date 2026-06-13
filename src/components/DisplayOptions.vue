<script setup lang="ts">
import type { DisplaySettings, RenderMode } from '../types'

const props = defineProps<{ modelValue: DisplaySettings }>()
const emit = defineEmits<{ 'update:modelValue': [value: DisplaySettings] }>()

function update<K extends keyof DisplaySettings>(key: K, value: DisplaySettings[K]) {
  emit('update:modelValue', { ...props.modelValue, [key]: value })
}
</script>

<template>
  <div class="display-options">
    <label class="label">显示选项</label>
    <select :value="modelValue.renderMode" @change="update('renderMode', ($event.target as HTMLSelectElement).value as RenderMode)">
      <option value="color">彩色</option>
      <option value="symbol">符号</option>
      <option value="mixed">混合</option>
    </select>
    <label class="checkbox-row">
      <input type="checkbox" :checked="modelValue.showGrid" @change="update('showGrid', ($event.target as HTMLInputElement).checked)" />
      显示网格线
    </label>
    <div v-if="modelValue.showGrid">
      <div class="inline-row">
        <span class="inline-label">粗线间隔</span>
        <input type="number" min="0" max="100" :value="modelValue.boldGridInterval" class="num-input"
          @input="update('boldGridInterval', Number(($event.target as HTMLInputElement).value))" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.display-options { display: flex; flex-direction: column; gap: 6px; }
.label { font-size: 13px; color: var(--text); font-weight: 500; }
select { padding: 4px 8px; border: 1px solid var(--border); border-radius: 4px; font-size: 13px; background: var(--bg); color: var(--text-h); }
.checkbox-row { display: flex; align-items: center; gap: 6px; font-size: 13px; color: var(--text); cursor: pointer; }
.inline-row { display: flex; align-items: center; gap: 6px; }
.inline-label { font-size: 12px; color: var(--text); }
.num-input { width: 50px; padding: 2px 4px; border: 1px solid var(--border); border-radius: 4px; text-align: center; font-size: 13px; }
</style>
