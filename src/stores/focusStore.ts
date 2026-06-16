import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { useBeadStore } from './beadStore'
import { clusterGrid } from '../composables/useClusterer'
import type { FocusBlock } from '../types'

const STORAGE_KEY = 'perler-beads:focus-progress'
const SAVE_DEBOUNCE = 300

interface PersistedProgress {
  gridFingerprint: { rows: number; cols: number; colorHash: string }
  blocks: {
    id: string
    status: 'pending' | 'active' | 'completed'
    markedCells: [number, number][]
    startedAt: number | null
    completedAt: number | null
  }[]
  currentBlockIndex: number
  totalElapsed: number
  lastSaveTimestamp: number
}

function hashString(s: string): string {
  let hash = 0
  for (let i = 0; i < s.length; i++) {
    const chr = s.charCodeAt(i)
    hash = ((hash << 5) - hash) + chr
    hash |= 0
  }
  return String(hash)
}

function makeFingerprint(bead: ReturnType<typeof useBeadStore>): string {
  const grid = bead.beadGrid
  if (!grid) return ''
  const counts: number[] = []
  for (const row of grid.cells) {
    for (const cell of row) {
      const idx = cell.colorIndex ?? -1
      counts[idx] = (counts[idx] ?? 0) + 1
    }
  }
  return hashString(
    `${grid.rows}:${grid.cols}:${JSON.stringify(counts)}`,
  )
}

export const useFocusStore = defineStore('focus', () => {
  const blocks = ref<FocusBlock[]>([])
  const currentBlockIndex = ref(0)
  const totalElapsed = ref(0)
  const isTimerRunning = ref(false)

  const currentBlock = computed(() => blocks.value[currentBlockIndex.value] ?? null)
  const currentColorIndex = computed(() => currentBlock.value?.colorIndex ?? -1)

  const progress = computed(() => {
    if (blocks.value.length === 0) return 0
    const completed = blocks.value.filter((b) => b.status === 'completed').length
    return Math.round((completed / blocks.value.length) * 100)
  })

  const completedColors = computed(() => {
    const done = new Set<number>()
    for (const b of blocks.value) {
      if (b.status === 'completed') done.add(b.colorIndex)
    }
    return blocks.value.filter(
      (b) => done.has(b.colorIndex) && b.status === 'completed',
    )
  })

  const pendingColors = computed(() => {
    const done = new Set<number>()
    for (const b of blocks.value) {
      if (b.status === 'completed') done.add(b.colorIndex)
    }
    return blocks.value.filter(
      (b) => !done.has(b.colorIndex) || b.status !== 'completed',
    )
  })

  let saveTimer: ReturnType<typeof setTimeout> | null = null

  function scheduleSave() {
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(() => doSave(), SAVE_DEBOUNCE)
  }

  function doSave() {
    if (blocks.value.length === 0) return
    const allDone = blocks.value.every((b) => b.status === 'completed')
    if (allDone) {
      localStorage.removeItem(STORAGE_KEY)
      return
    }
    const bead = useBeadStore()
    const fingerprint = {
      rows: bead.beadGrid?.rows ?? 0,
      cols: bead.beadGrid?.cols ?? 0,
      colorHash: makeFingerprint(bead),
    }
    const data: PersistedProgress = {
      gridFingerprint: fingerprint,
      blocks: blocks.value.map((b) => ({
        id: b.id,
        status: b.status,
        markedCells: [...b.markedCells].map(
          (k) => k.split(',').map(Number) as [number, number],
        ),
        startedAt: b.startedAt,
        completedAt: b.completedAt,
      })),
      currentBlockIndex: currentBlockIndex.value,
      totalElapsed: totalElapsed.value,
      lastSaveTimestamp: Date.now(),
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  }

  function tryRestore(): boolean {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return false
    try {
      const saved: PersistedProgress = JSON.parse(raw)
      const bead = useBeadStore()
      if (!bead.beadGrid) return false
      const currentFp = makeFingerprint(bead)
      if (saved.gridFingerprint.colorHash !== currentFp) {
        localStorage.removeItem(STORAGE_KEY)
        return false
      }
      // Re-cluster to get proper cell/color data, then merge saved state
      initFromGridFresh()
      for (const sb of saved.blocks) {
        const block = blocks.value.find((b) => b.id === sb.id)
        if (block) {
          block.status = sb.status
          block.markedCells = new Set(sb.markedCells.map(([r, c]) => `${r},${c}`))
          block.startedAt = sb.startedAt
          block.completedAt = sb.completedAt
        }
      }
      currentBlockIndex.value = saved.currentBlockIndex
      totalElapsed.value = saved.totalElapsed
      return true
    } catch {
      localStorage.removeItem(STORAGE_KEY)
      return false
    }
  }

  function initFromGridFresh() {
    const bead = useBeadStore()
    if (!bead.beadGrid) return
    const clustered = clusterGrid(bead.beadGrid)
    blocks.value = clustered
    currentBlockIndex.value = 0
    totalElapsed.value = 0
  }

  function initFromGrid(): boolean {
    const bead = useBeadStore()
    if (!bead.beadGrid) return false

    const restored = tryRestore()
    if (restored) return true

    initFromGridFresh()
    if (blocks.value.length > 0) {
      blocks.value[0].status = 'active'
      blocks.value[0].startedAt = Date.now()
    }
    return true
  }

  function markCell(row: number, col: number) {
    const block = currentBlock.value
    if (!block) return
    const inBlock = block.cells.some((c) => c.row === row && c.col === col)
    if (!inBlock) return

    const key = `${row},${col}`
    if (block.markedCells.has(key)) {
      block.markedCells.delete(key)
    } else {
      block.markedCells.add(key)
    }
    scheduleSave()
  }

  function completeBlock() {
    const block = currentBlock.value
    if (!block) return

    block.status = 'completed'
    block.completedAt = Date.now()

    const nextIdx = blocks.value.findIndex(
      (b, i) => i > currentBlockIndex.value && b.status !== 'completed',
    )
    if (nextIdx === -1) {
      const allDone = blocks.value.every((b) => b.status === 'completed')
      if (allDone) {
        scheduleSave()
        return
      }
      const firstPending = blocks.value.findIndex((b) => b.status !== 'completed')
      if (firstPending === -1) return
      currentBlockIndex.value = firstPending
    } else {
      currentBlockIndex.value = nextIdx
    }

    const newBlock = blocks.value[currentBlockIndex.value]
    newBlock.status = 'active'
    newBlock.startedAt = Date.now()
    scheduleSave()
  }

  function prevBlock() {
    if (currentBlockIndex.value <= 0) return
    currentBlockIndex.value--
    scheduleSave()
  }

  function nextBlock() {
    if (currentBlockIndex.value >= blocks.value.length - 1) return
    currentBlockIndex.value++
    scheduleSave()
  }

  function toggleTimer() {
    isTimerRunning.value = !isTimerRunning.value
  }

  function reset() {
    blocks.value = []
    currentBlockIndex.value = 0
    totalElapsed.value = 0
    isTimerRunning.value = false
    localStorage.removeItem(STORAGE_KEY)
  }

  function _flushSave() {
    if (saveTimer) {
      clearTimeout(saveTimer)
      saveTimer = null
    }
    doSave()
  }

  return {
    blocks,
    currentBlockIndex,
    totalElapsed,
    isTimerRunning,
    currentBlock,
    currentColorIndex,
    progress,
    completedColors,
    pendingColors,
    initFromGrid,
    markCell,
    completeBlock,
    prevBlock,
    nextBlock,
    toggleTimer,
    reset,
    _flushSave,
  }
})
