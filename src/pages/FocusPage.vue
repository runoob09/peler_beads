<!-- src/pages/FocusPage.vue -->
<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useFocusStore } from '../stores/focusStore'
import { useKeyboardShortcuts } from '../composables/useKeyboardShortcuts'
import { useTimer } from '../composables/useTimer'
import FocusToolbar from '../components/focus/FocusToolbar.vue'
import FocusGrid from '../components/focus/FocusGrid.vue'
import FocusColorBar from '../components/focus/FocusColorBar.vue'
import FocusColorList from '../components/focus/FocusColorList.vue'
import FocusBottomBar from '../components/focus/FocusBottomBar.vue'

const router = useRouter()
const focusStore = useFocusStore()
const timer = useTimer()

const showExitConfirm = ref(false)

onMounted(() => {
  const ok = focusStore.initFromGrid()
  if (!ok) {
    router.replace('/')
    return
  }
})

function onExit() {
  const hasProgress = focusStore.blocks.some(
    (b) => b.markedCells.size > 0 || b.status === 'completed',
  )
  if (hasProgress) {
    showExitConfirm.value = true
  } else {
    doExit()
  }
}

function doExit() {
  focusStore.reset()
  router.push('/')
}

function confirmExit() {
  showExitConfirm.value = false
  doExit()
}

function cancelExit() {
  showExitConfirm.value = false
}

function onToggleTimer() {
  if (timer.isRunning.value) {
    timer.pause()
  } else {
    timer.start()
  }
}

useKeyboardShortcuts([
  { key: ' ', handler: () => { if (!showExitConfirm.value) focusStore.completeBlock() } },
  { key: 'ArrowLeft', handler: () => focusStore.prevBlock() },
  { key: 'ArrowRight', handler: () => focusStore.nextBlock() },
])
</script>

<template>
  <div class="focus-page">
    <FocusToolbar
      :timer-formatted="timer.formatted.value"
      :timer-running="timer.isRunning.value"
      @exit="onExit"
      @toggle-timer="onToggleTimer"
    />
    <div class="focus-body">
      <FocusColorBar />
      <FocusGrid />
      <FocusColorList />
    </div>
    <FocusBottomBar />

    <Teleport to="body">
      <div v-if="showExitConfirm" class="confirm-overlay" @click.self="cancelExit">
        <div class="confirm-dialog">
          <p>确定要退出专心拼豆模式吗？</p>
          <p class="confirm-hint">退出后当前进度将会丢失</p>
          <div class="confirm-actions">
            <button class="btn-cancel" @click="cancelExit">继续拼豆</button>
            <button class="btn-confirm" @click="confirmExit">退出</button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.focus-page {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: var(--bg);
}
.focus-body {
  flex: 1;
  display: flex;
  overflow: hidden;
}
.confirm-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}
.confirm-dialog {
  background: var(--bg, #fff);
  border-radius: 12px;
  padding: 24px 32px;
  text-align: center;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
  max-width: 340px;
}
.confirm-dialog p { margin: 0 0 4px; font-size: 14px; color: var(--text-h, #1a1a2e); }
.confirm-hint { font-size: 12px !important; color: var(--text, #6b6375) !important; margin-bottom: 16px !important; }
.confirm-actions { display: flex; gap: 12px; justify-content: center; margin-top: 16px; }
.btn-cancel { background: none; border: 1px solid var(--border, #e5e4e7); color: var(--text, #6b6375); padding: 6px 16px; border-radius: 6px; cursor: pointer; font-size: 13px; }
.btn-confirm { background: var(--accent, #aa3bff); color: #fff; border: none; padding: 6px 20px; border-radius: 6px; cursor: pointer; font-size: 13px; }
</style>
