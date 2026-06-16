<script setup lang="ts">
import { useFocusStore } from '../../stores/focusStore'
const focusStore = useFocusStore()
</script>

<template>
  <div class="color-list">
    <div class="list-title">颜色进度</div>
    <div class="color-items">
      <div
        v-for="block in focusStore.blocks"
        :key="block.id"
        class="color-item"
        :class="{
          completed: block.status === 'completed',
          active: block.status === 'active',
        }"
      >
        <span class="status-icon">
          {{ block.status === 'completed' ? '✅' : block.status === 'active' ? '⏳' : '⬜' }}
        </span>
        <span class="color-swatch" :style="{ background: block.colorHex }"></span>
        <span class="color-label">{{ block.colorName }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.color-list {
  display: flex; flex-direction: column;
  background: color-mix(in srgb, var(--bg, #fff) 97%, var(--text, #6b6375));
  border-left: 1px solid var(--border, #e5e4e7);
  padding: 12px;
  overflow-y: auto;
}
.list-title { font-size: 13px; font-weight: 600; color: var(--text-h); margin-bottom: 8px; }
.color-items { display: flex; flex-direction: column; gap: 4px; }
.color-item { display: flex; align-items: center; gap: 6px; font-size: 12px; padding: 3px 6px; border-radius: 4px; }
.color-item.active { background: var(--accent-bg, rgba(170, 59, 255, 0.08)); }
.color-item.completed { opacity: 0.6; }
.status-icon { font-size: 12px; flex-shrink: 0; }
.color-swatch { width: 14px; height: 14px; border-radius: 3px; border: 1px solid rgba(0,0,0,0.1); flex-shrink: 0; }
.color-label { color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
</style>
