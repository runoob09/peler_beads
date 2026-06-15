<script setup lang="ts">
import type { PaletteColor } from '../types'
import PaletteSelector from './PaletteSelector.vue'
import PaletteEditor from './PaletteEditor.vue'

defineProps<{ brandNames: string[]; selectedBrand: string; palette: PaletteColor[] }>()
const emit = defineEmits<{
  'select-brand': [brand: string]
  'remove-color': [id: string]
}>()
</script>

<template>
  <div class="palette-panel">
    <label class="label">色板</label>
    <PaletteSelector :modelValue="selectedBrand" :brandNames="brandNames" @update:modelValue="emit('select-brand', $event)" />
    <PaletteEditor :palette="palette" @remove-color="emit('remove-color', $event)" />
  </div>
</template>

<style scoped>
.palette-panel { display: flex; flex-direction: column; gap: 6px; }
.label { font-size: 13px; color: var(--text); font-weight: 500; }
.color-count { font-size: 12px; color: var(--text); }
</style>
