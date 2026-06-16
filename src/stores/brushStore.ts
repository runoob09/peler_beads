import { ref } from 'vue'
import { defineStore } from 'pinia'
import { useBeadStore } from './beadStore'

export const ERASER_INDEX = -1

interface CellChange {
  row: number
  col: number
  oldColorIndex: number | null
}

interface UndoEntry {
  cells: CellChange[]
}

export const useBrushStore = defineStore('brush', () => {
  const brushMode = ref(false)
  const activeColorIndex = ref<number | null>(null)
  const undoStack = ref<UndoEntry[]>([])
  const redoStack = ref<UndoEntry[]>([])
  const isStroking = ref(false)

  // Per-stroke accumulators (not reactive — only used during a stroke)
  let strokeCells: CellChange[] = []
  let strokeCellKeys = new Set<string>()

  function toggleBrushMode() {
    const beadStore = useBeadStore()
    if (!beadStore.beadGrid) return
    brushMode.value = !brushMode.value
  }

  function setActiveColor(index: number) {
    activeColorIndex.value = activeColorIndex.value === index ? null : index
  }

  function paintCell(row: number, col: number): boolean {
    const beadStore = useBeadStore()
    const grid = beadStore.beadGrid
    if (!grid || activeColorIndex.value === null) return false
    if (row < 0 || row >= grid.rows || col < 0 || col >= grid.cols) return false
    const cell = grid.cells[row][col]
    const targetIndex = activeColorIndex.value === ERASER_INDEX ? null : activeColorIndex.value
    if (cell.colorIndex === targetIndex) return false
    grid.cells[row][col].colorIndex = targetIndex
    return true
  }

  function beginStroke() {
    isStroking.value = true
    strokeCells = []
    strokeCellKeys = new Set()
  }

  function continueStroke(row: number, col: number): boolean {
    const beadStore = useBeadStore()
    const grid = beadStore.beadGrid
    if (!grid || activeColorIndex.value === null) return false
    if (row < 0 || row >= grid.rows || col < 0 || col >= grid.cols) return false

    const key = `${row},${col}`
    if (strokeCellKeys.has(key)) return false

    const cell = grid.cells[row][col]
    const oldColorIndex = cell.colorIndex
    const targetIndex = activeColorIndex.value === ERASER_INDEX ? null : activeColorIndex.value
    if (oldColorIndex === targetIndex) return false

    strokeCellKeys.add(key)
    strokeCells.push({ row, col, oldColorIndex })
    cell.colorIndex = targetIndex
    return true
  }

  function endStroke() {
    isStroking.value = false
    if (strokeCells.length === 0) return
    undoStack.value.push({ cells: [...strokeCells] })
    redoStack.value = []
    strokeCells = []
    strokeCellKeys = new Set()
  }

  function undo() {
    if (undoStack.value.length === 0) return
    const beadStore = useBeadStore()
    const grid = beadStore.beadGrid
    if (!grid) return

    const entry = undoStack.value.pop()!
    const redoCells: CellChange[] = []

    for (const { row, col, oldColorIndex } of entry.cells) {
      const cell = grid.cells[row][col]
      redoCells.push({ row, col, oldColorIndex: cell.colorIndex })
      cell.colorIndex = oldColorIndex
    }

    redoStack.value.push({ cells: redoCells })
  }

  function redo() {
    if (redoStack.value.length === 0) return
    const beadStore = useBeadStore()
    const grid = beadStore.beadGrid
    if (!grid) return

    const entry = redoStack.value.pop()!
    const undoCells: CellChange[] = []

    for (const { row, col, oldColorIndex } of entry.cells) {
      const cell = grid.cells[row][col]
      undoCells.push({ row, col, oldColorIndex: cell.colorIndex })
      cell.colorIndex = oldColorIndex
    }

    undoStack.value.push({ cells: undoCells })
  }

  function resetHistory() {
    undoStack.value = []
    redoStack.value = []
    brushMode.value = false
    activeColorIndex.value = null
    isStroking.value = false
  }

  return {
    brushMode,
    activeColorIndex,
    isStroking,
    undoStack,
    redoStack,
    toggleBrushMode,
    setActiveColor,
    paintCell,
    beginStroke,
    continueStroke,
    endStroke,
    undo,
    redo,
    resetHistory,
  }
})
