<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { BOARD_PRESETS } from '../data/boardPresets'

interface SizeValue {
  cols: number
  rows: number
  keepAspectRatio: boolean
}

const props = defineProps<{ modelValue: SizeValue }>()
const emit = defineEmits<{ 'update:modelValue': [value: SizeValue] }>()

const selectedPresetIndex = ref(BOARD_PRESETS.length - 1)

function updatePresetIndex(idx: number) {
  selectedPresetIndex.value = idx
  const preset = BOARD_PRESETS[idx]
  if (!preset) return
  if (preset.rows > 0 && preset.cols > 0) {
    emit('update:modelValue', { ...props.modelValue, cols: preset.cols, rows: preset.rows })
  }
}

watch(() => props.modelValue, () => {
  if (!props.modelValue) {
    selectedPresetIndex.value = BOARD_PRESETS.length - 1
    return
  }
  const idx = BOARD_PRESETS.findIndex(
    p => p.rows === props.modelValue.rows && p.cols === props.modelValue.cols
  )
  selectedPresetIndex.value = idx >= 0 ? idx : BOARD_PRESETS.length - 1
}, { immediate: true })

const isCustom = computed(() => {
  const idx = selectedPresetIndex.value
  if (idx < 0 || idx >= BOARD_PRESETS.length) return true
  const p = BOARD_PRESETS[idx]
  return p.rows === 0 && p.cols === 0
})

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
    <div class="preset-row">
      <select
        class="preset-select"
        :value="selectedPresetIndex"
        @change="updatePresetIndex(Number(($event.target as HTMLSelectElement).value))"
      >
        <option
          v-for="(p, i) in BOARD_PRESETS"
          :key="p.label"
          :value="i"
        >
          {{ p.label }}
        </option>
      </select>
    </div>
    <div class="custom-size">
      <input
        type="number"
        :value="modelValue.cols"
        min="1" max="500"
        class="size-input"
        :disabled="!isCustom"
        @input="updateCols"
      />
      <span>×</span>
      <input
        type="number"
        :value="modelValue.rows"
        min="1" max="500"
        class="size-input"
        :disabled="!isCustom"
        @input="updateRows"
      />
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
.preset-row { margin-bottom: 4px; }
.preset-select {
  width: 100%;
  padding: 5px 8px;
  border: 1px solid var(--border);
  border-radius: 5px;
  font-size: 13px;
  background: var(--bg);
  color: var(--text-h);
}
.custom-size { display: flex; align-items: center; gap: 6px; }
.size-input { width: 70px; padding: 4px 8px; border: 1px solid var(--border); border-radius: 4px; text-align: center; font-size: 14px; }
.aspect-toggle { display: flex; align-items: center; gap: 6px; font-size: 13px; color: var(--text); cursor: pointer; }
</style>
