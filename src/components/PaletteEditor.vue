<script setup lang="ts">
import type { PaletteColor } from '../types'

const props = defineProps<{
  palette: PaletteColor[]
  brushMode?: boolean
  activeColorIndex?: number | null
}>()

const emit = defineEmits<{
  'remove-color': [id: string]
  'select-color': [index: number]
}>()

function isActive(index: number): boolean {
  return props.brushMode === true && props.activeColorIndex === index
}
</script>

<template>
  <div class="palette-editor">
    <div class="custom-colors">
      <div
        v-for="(c, paletteIndex) in palette.filter(p => p.brand === 'custom')"
        :key="c.id"
        class="color-chip-row"
        :class="{ 'is-active-color': isActive(paletteIndex) }"
      >
        <span
          class="color-swatch"
          :style="{ background: c.hex }"
          @click="emit('select-color', paletteIndex)"
        ></span>
        <span class="color-name">{{ c.name || c.hex }}</span>
        <button class="remove-btn" @click="emit('remove-color', c.id)">×</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.palette-editor { display: flex; flex-direction: column; gap: 6px; margin-top: 8px; }
.custom-colors { max-height: 120px; overflow-y: auto; }
.color-chip-row { display: flex; align-items: center; gap: 6px; padding: 2px 0; }
.color-chip-row.is-active-color { background: var(--accent-bg, rgba(170, 59, 255, 0.1)); border-radius: 4px; }
.color-swatch { width: 18px; height: 18px; border-radius: 3px; border: 1px solid var(--border); flex-shrink: 0; cursor: pointer; }
.color-name { font-size: 12px; color: var(--text); flex: 1; }
.remove-btn { border: none; background: none; color: #999; cursor: pointer; font-size: 14px; padding: 0 2px; }
</style>
