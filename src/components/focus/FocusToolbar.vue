<script setup lang="ts">
import { useFocusStore } from '../../stores/focusStore'

defineProps<{
  timerFormatted: string
  timerRunning: boolean
}>()

const emit = defineEmits<{
  exit: []
  toggleTimer: []
}>()

const focusStore = useFocusStore()
</script>

<template>
  <div class="focus-toolbar">
    <button class="exit-btn" data-test="exit-btn" @click="emit('exit')">
      ← 退出
    </button>
    <div class="toolbar-center">
      <span class="color-name">
        <span
          class="color-dot"
          :style="{ background: focusStore.currentBlock?.colorHex }"
        ></span>
        {{ focusStore.currentBlock?.colorName?.split(/[\s_]+/)[0] ?? '' }}
      </span>
      <div class="progress-bar">
        <div
          class="progress-fill"
          :style="{ width: focusStore.progress + '%' }"
        ></div>
      </div>
      <span class="progress-text">{{ focusStore.progress }}%</span>
    </div>
    <button
      class="timer-btn"
      @click="emit('toggleTimer')"
      :class="{ running: timerRunning }"
    >
      ⏱ {{ timerFormatted }}
    </button>
  </div>
</template>

<style scoped>
.focus-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
  background: var(--accent-bg, rgba(170, 59, 255, 0.06));
  border-bottom: 1px solid var(--border, #e5e4e7);
  flex-shrink: 0;
  gap: 16px;
}
.exit-btn {
  background: none;
  border: 1px solid var(--border, #e5e4e7);
  color: var(--text, #6b6375);
  padding: 4px 12px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  flex-shrink: 0;
}
.exit-btn:hover { background: var(--border, #e5e4e7); }
.toolbar-center {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
  justify-content: center;
  min-width: 0;
}
.color-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-h, #1a1a2e);
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}
.color-dot {
  display: inline-block;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 1px solid rgba(0,0,0,0.1);
}
.progress-bar {
  width: 200px;
  max-width: 30vw;
  height: 6px;
  background: var(--border, #e5e4e7);
  border-radius: 3px;
  overflow: hidden;
}
.progress-fill {
  height: 100%;
  background: var(--accent, #aa3bff);
  border-radius: 3px;
  transition: width 0.3s ease;
}
.progress-text {
  font-size: 12px;
  color: var(--text, #6b6375);
  font-family: var(--mono, monospace);
  min-width: 32px;
  text-align: right;
}
.timer-btn {
  background: none;
  border: 1px solid var(--border, #e5e4e7);
  color: var(--text, #6b6375);
  padding: 4px 12px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  font-family: var(--mono, monospace);
  flex-shrink: 0;
}
.timer-btn.running {
  color: var(--accent, #aa3bff);
  border-color: var(--accent, #aa3bff);
}
</style>
