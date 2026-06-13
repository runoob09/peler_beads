<script setup lang="ts">
import { ref } from 'vue'
import type { PaletteColor } from '../types'

defineProps<{ palette: PaletteColor[] }>()
const emit = defineEmits<{ 'add-color': [{ hex: string; name: string }]; 'remove-color': [id: string] }>()

const newName = ref('')
const newHex = ref('#000000')

function add() {
  if (newName.value && newHex.value) {
    emit('add-color', { hex: newHex.value, name: newName.value })
    newName.value = ''
  }
}
</script>

<template>
  <div class="palette-editor">
    <div class="add-row">
      <input type="color" v-model="newHex" class="color-picker" />
      <input v-model="newName" placeholder="颜色名" class="name-input" @keyup.enter="add" />
      <button class="add-btn" @click="add">+</button>
    </div>
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
.add-row { display: flex; gap: 6px; align-items: center; }
.color-picker { width: 32px; height: 28px; border: none; cursor: pointer; padding: 0; }
.name-input { flex: 1; padding: 4px 6px; border: 1px solid var(--border); border-radius: 4px; font-size: 13px; }
.add-btn { padding: 4px 10px; border: 1px solid var(--border); border-radius: 4px; background: var(--bg); cursor: pointer; font-size: 16px; }
.custom-colors { max-height: 120px; overflow-y: auto; }
.color-chip-row { display: flex; align-items: center; gap: 6px; padding: 2px 0; }
.color-swatch { width: 18px; height: 18px; border-radius: 3px; border: 1px solid var(--border); flex-shrink: 0; }
.color-name { font-size: 12px; color: var(--text); flex: 1; }
.remove-btn { border: none; background: none; color: #999; cursor: pointer; font-size: 14px; padding: 0 2px; }
</style>
