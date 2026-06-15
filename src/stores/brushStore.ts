import { ref } from 'vue'
import { defineStore } from 'pinia'
import { useBeadStore } from './beadStore'

interface CellChange {
  row: number
  col: number
  oldColorIndex: number
}

interface UndoEntry {
  cells: CellChange[]
}

export const useBrushStore = defineStore('brush', () => {
  const brushMode = ref(false)
  const activeColorIndex = ref<number | null>(null)
  const undoStack = ref<UndoEntry[]>([])
  const redoStack = ref<UndoEntry[]>([])

  // Per-stroke accumulators (not reactive — only used during a stroke)
  let strokeCells: CellChange[] = []
  let strokeCellKeys = new Set<string>()

  function toggleBrushMode() {
    const beadStore = useBeadStore()
    if (!beadStore.beadGrid) return
    brushMode.value = !brushMode.value
  }

  function setActiveColor(index: number) {
    activeColorIndex.value = index
  }

  function paintCell(row: number, col: number): boolean {
    const beadStore = useBeadStore()
    const grid = beadStore.beadGrid
    if (!grid || activeColorIndex.value === null) return false
    if (row < 0 || row >= grid.rows || col < 0 || col >= grid.cols) return false
    const cell = grid.cells[row][col]
    if (cell.colorIndex === activeColorIndex.value) return false
    grid.cells[row][col].colorIndex = activeColorIndex.value
    return true
  }

  function beginStroke() {
    strokeCells = []
    strokeCellKeys = new Set()
  }

  function continueStroke(row: number, col: number) {
    const beadStore = useBeadStore()
    const grid = beadStore.beadGrid
    if (!grid || activeColorIndex.value === null) return
    if (row < 0 || row >= grid.rows || col < 0 || col >= grid.cols) return

    const key = `${row},${col}`
    if (strokeCellKeys.has(key)) return

    const cell = grid.cells[row][col]
    const oldColorIndex = cell.colorIndex
    if (oldColorIndex === activeColorIndex.value) return

    strokeCellKeys.add(key)
    strokeCells.push({ row, col, oldColorIndex: oldColorIndex ?? -1 })
    cell.colorIndex = activeColorIndex.value
  }

  function endStroke() {
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
      redoCells.push({ row, col, oldColorIndex: cell.colorIndex ?? -1 })
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
      undoCells.push({ row, col, oldColorIndex: cell.colorIndex ?? -1 })
      cell.colorIndex = oldColorIndex
    }

    undoStack.value.push({ cells: undoCells })
  }

  function resetHistory() {
    undoStack.value = []
    redoStack.value = []
    brushMode.value = false
    activeColorIndex.value = null
  }

  return {
    brushMode,
    activeColorIndex,
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
