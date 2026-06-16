<script setup lang="ts">
import { computed } from 'vue'
import { useFocusStore } from '../../stores/focusStore'

const focusStore = useFocusStore()

const blockProgress = computed(() => {
  const color = focusStore.currentBlock?.colorIndex ?? -1
  const colorBlocks = focusStore.blocks.filter((b) => b.colorIndex === color)
  const currentInColor = colorBlocks.findIndex(
    (b) => b.id === focusStore.currentBlock?.id,
  )
  return `${currentInColor + 1} / ${colorBlocks.length}`
})
</script>

<template>
  <div class="color-bar">
    <div class="current-color">
      <div
        class="big-swatch"
        :style="{ background: focusStore.currentBlock?.colorHex }"
      ></div>
      <div class="color-info">
        <div class="color-code">{{ focusStore.currentBlock?.colorName?.split(/[\s_]+/)[0] ?? '' }}</div>
        <div class="block-progress">块 {{ blockProgress }}</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.color-bar {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 16px 12px;
  background: color-mix(in srgb, var(--bg, #fff) 97%, var(--text, #6b6375));
  border-right: 1px solid var(--border, #e5e4e7);
  gap: 12px;
  flex-shrink: 0;
  width: 100px;
}
.current-color { display: flex; flex-direction: column; align-items: center; gap: 8px; }
.big-swatch {
  width: 48px; height: 48px;
  border-radius: 8px;
  border: 2px solid var(--text-h, #1a1a2e);
}
.color-info { text-align: center; }
.color-code {
  font-size: 14px; font-weight: 700;
  color: var(--text-h, #1a1a2e);
  font-family: var(--mono, monospace);
}
.block-progress {
  font-size: 12px; color: var(--text, #6b6375);
  margin-top: 2px;
}
</style>
