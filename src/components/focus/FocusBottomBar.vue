<script setup lang="ts">
import { computed } from 'vue'
import { useFocusStore } from '../../stores/focusStore'

const focusStore = useFocusStore()

const isFirstBlock = computed(() => focusStore.currentBlockIndex === 0)
const isLastBlock = computed(
  () =>
    focusStore.currentBlockIndex >= focusStore.blocks.length - 1 ||
    focusStore.blocks.every((b) => b.status === 'completed'),
)
const allDone = computed(
  () =>
    focusStore.blocks.length > 0 &&
    focusStore.blocks.every((b) => b.status === 'completed'),
)
</script>

<template>
  <div class="bottom-bar">
    <button
      data-test="prev-block"
      class="nav-btn"
      :disabled="isFirstBlock"
      @click="focusStore.prevBlock()"
    >
      ← 上一块
    </button>
    <button
      v-if="!allDone"
      data-test="complete-block"
      class="complete-btn"
      @click="focusStore.completeBlock()"
    >
      标记完成
    </button>
    <div v-else class="all-done-message">全部完成！</div>
    <button
      data-test="next-block"
      class="nav-btn"
      :disabled="isLastBlock || allDone"
      @click="focusStore.nextBlock()"
    >
      下一块 →
    </button>
  </div>
</template>

<style scoped>
.bottom-bar {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 12px 16px;
  background: var(--accent-bg, rgba(170, 59, 255, 0.06));
  border-top: 1px solid var(--border, #e5e4e7);
  flex-shrink: 0;
}
.nav-btn {
  background: none;
  border: 1px solid var(--border, #e5e4e7);
  color: var(--text, #6b6375);
  padding: 6px 16px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
}
.nav-btn:hover:not(:disabled) {
  background: var(--border, #e5e4e7);
}
.nav-btn:disabled {
  opacity: 0.4;
  cursor: default;
}
.complete-btn {
  background: var(--accent, #aa3bff);
  color: #fff;
  border: none;
  padding: 8px 24px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 600;
}
.complete-btn:hover {
  filter: brightness(1.1);
}
.all-done-message {
  font-size: 16px;
  color: var(--accent, #aa3bff);
  font-weight: 600;
}
</style>
