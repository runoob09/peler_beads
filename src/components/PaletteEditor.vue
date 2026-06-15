<script setup lang="ts">
import type { PaletteColor } from '../types'

defineProps<{ palette: PaletteColor[] }>()
const emit = defineEmits<{ 'remove-color': [id: string] }>()
</script>

<template>
  <div class="palette-editor">
    <div class="custom-colors">
      <div v-for="c in palette.filter(p => p.brand === 'custom')" :key="c.id" class="color-chip-row">
        <span class="color-swatch" :style="{ background: c.hex }"></span>
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
.color-swatch { width: 18px; height: 18px; border-radius: 3px; border: 1px solid var(--border); flex-shrink: 0; }
.color-name { font-size: 12px; color: var(--text); flex: 1; }
.remove-btn { border: none; background: none; color: #999; cursor: pointer; font-size: 14px; padding: 0 2px; }
</style>
