import { ref, computed, onUnmounted } from 'vue'

export function useTimer() {
  const totalElapsed = ref(0)
  const isRunning = ref(false)
  const blockElapsed = ref(0)
  const blockStartTime = ref<number | null>(null)
  const lastPauseTimestamp = ref<number | null>(null)

  let intervalId: ReturnType<typeof setInterval> | null = null

  const formatted = computed(() => {
    const totalSec = Math.floor(totalElapsed.value / 1000)
    const hours = Math.floor(totalSec / 3600)
    const minutes = Math.floor((totalSec % 3600) / 60)
    const seconds = totalSec % 60
    const pad = (n: number) => String(n).padStart(2, '0')
    if (hours > 0) {
      return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
    }
    return `${pad(minutes)}:${pad(seconds)}`
  })

  function tick() {
    if (isRunning.value) {
      totalElapsed.value += 1000
      if (blockStartTime.value !== null) {
        blockElapsed.value = Date.now() - blockStartTime.value
      }
    }
  }

  function start() {
    if (isRunning.value) return
    isRunning.value = true
    if (blockStartTime.value === null) {
      blockStartTime.value = Date.now()
    }
    if (!intervalId) {
      intervalId = setInterval(tick, 1000)
    }
  }

  function pause() {
    isRunning.value = false
    lastPauseTimestamp.value = Date.now()
  }

  function resume() {
    if (isRunning.value) return
    start()
  }

  function reset() {
    isRunning.value = false
    totalElapsed.value = 0
    blockElapsed.value = 0
    blockStartTime.value = null
    lastPauseTimestamp.value = null
  }

  function startBlock() {
    blockStartTime.value = Date.now()
    blockElapsed.value = 0
  }

  function getBlockTime(): number {
    if (blockStartTime.value === null) return 0
    if (isRunning.value) {
      return Date.now() - blockStartTime.value
    }
    return blockElapsed.value
  }

  function setElapsed(ms: number) {
    totalElapsed.value = ms
  }

  function getLastPauseTimestamp(): number | null {
    return lastPauseTimestamp.value
  }

  function onVisibilityChange() {
    if (document.visibilityState === 'hidden' && isRunning.value) {
      pause()
    }
  }

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', onVisibilityChange)
  }

  onUnmounted(() => {
    if (intervalId) clearInterval(intervalId)
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  })

  return {
    totalElapsed,
    isRunning,
    blockElapsed,
    formatted,
    start,
    pause,
    resume,
    reset,
    startBlock,
    getBlockTime,
    setElapsed,
    getLastPauseTimestamp,
  }
}
