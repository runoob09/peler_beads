<script setup lang="ts">
interface SizeValue {
  cols: number
  rows: number
  keepAspectRatio: boolean
}

const props = defineProps<{ modelValue: SizeValue }>()
const emit = defineEmits<{ 'update:modelValue': [value: SizeValue] }>()

const PRESETS = [
  { cols: 29, rows: 29, label: '29×29' },
  { cols: 50, rows: 50, label: '50×50' },
  { cols: 100, rows: 100, label: '100×100' },
]

function selectPreset(preset: { cols: number; rows: number }) {
  emit('update:modelValue', { ...props.modelValue, cols: preset.cols, rows: preset.rows })
}

function updateCols(ev: Event) {
  const v = Number((ev.target as HTMLInputElement).value)
  emit('update:modelValue', { ...props.modelValue, cols: v })
}

function updateRows(ev: Event) {
  const v = Number((ev.target as HTMLInputElement).value)
  emit('update:modelValue', { ...props.modelValue, rows: v })
}

function toggleAspect(ev: Event) {
  const checked = (ev.target as HTMLInputElement).checked
  emit('update:modelValue', { ...props.modelValue, keepAspectRatio: checked })
}
</script>

<template>
  <div class="size-selector">
    <label class="label">网格尺寸</label>
    <div class="presets">
      <button
        v-for="p in PRESETS"
        :key="p.label"
        class="preset-btn"
        :class="{ active: modelValue.cols === p.cols && modelValue.rows === p.rows }"
        @click="selectPreset(p)"
      >
        {{ p.label }}
      </button>
    </div>
    <div class="custom-size">
      <input type="number" :value="modelValue.cols" min="1" max="500" class="size-input" @input="updateCols" />
      <span>×</span>
      <input type="number" :value="modelValue.rows" min="1" max="500" class="size-input" @input="updateRows" />
    </div>
    <label class="aspect-toggle">
      <input type="checkbox" :checked="modelValue.keepAspectRatio" @change="toggleAspect" />
      锁定宽高比
    </label>
  </div>
</template>

<style scoped>
.size-selector { display: flex; flex-direction: column; gap: 8px; }
.label { font-size: 13px; color: var(--text); font-weight: 500; }
.presets { display: flex; gap: 6px; }
.preset-btn { flex: 1; padding: 6px 8px; border: 1px solid var(--border); border-radius: 4px; background: var(--bg); color: var(--text-h); cursor: pointer; font-size: 13px; }
.preset-btn.active { border-color: var(--accent); background: var(--accent-bg); }
.custom-size { display: flex; align-items: center; gap: 6px; }
.size-input { width: 70px; padding: 4px 8px; border: 1px solid var(--border); border-radius: 4px; text-align: center; font-size: 14px; }
.aspect-toggle { display: flex; align-items: center; gap: 6px; font-size: 13px; color: var(--text); cursor: pointer; }
</style>
