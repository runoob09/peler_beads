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
  const selectMode = ref(false)
  const selectStart = ref<{ row: number; col: number } | null>(null)
  const previewRect = ref<{ r1: number; c1: number; r2: number; c2: number } | null>(null)

  // ---- Color replace (flood-fill connected component) ----
  const showReplaceModal = ref(false)
  const replaceSourceIndex = ref<number | null>(null)
  const replaceCellCount = ref(0)
  let replaceCellsList: { row: number; col: number }[] = []

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

  function beginSelect(row: number, col: number) {
    selectMode.value = true
    selectStart.value = { row, col }
    previewRect.value = { r1: row, c1: col, r2: row, c2: col }
  }

  function updatePreview(row: number, col: number) {
    if (!selectStart.value) return
    previewRect.value = {
      r1: selectStart.value.row,
      c1: selectStart.value.col,
      r2: row,
      c2: col,
    }
  }

  function completeSelect(
    startRow: number, startCol: number, endRow: number, endCol: number,
  ) {
    const beadStore = useBeadStore()
    const grid = beadStore.beadGrid
    if (!grid || activeColorIndex.value === null) {
      cancelSelect()
      return
    }

    const r1 = Math.max(0, Math.min(startRow, endRow))
    const r2 = Math.min(grid.rows - 1, Math.max(startRow, endRow))
    const c1 = Math.max(0, Math.min(startCol, endCol))
    const c2 = Math.min(grid.cols - 1, Math.max(startCol, endCol))

    const targetIndex = activeColorIndex.value === ERASER_INDEX ? null : activeColorIndex.value
    const changes: CellChange[] = []

    for (let r = r1; r <= r2; r++) {
      for (let c = c1; c <= c2; c++) {
        const cell = grid.cells[r][c]
        if (cell.colorIndex === targetIndex) continue
        changes.push({ row: r, col: c, oldColorIndex: cell.colorIndex })
        cell.colorIndex = targetIndex
      }
    }

    if (changes.length > 0) {
      undoStack.value.push({ cells: changes })
      redoStack.value = []
    }

    cancelSelect()
  }

  function cancelSelect() {
    selectMode.value = false
    selectStart.value = null
    previewRect.value = null
  }

  /** BFS flood-fill: find all cells connected to (startRow, startCol) with same colorIndex */
  function floodFillConnected(
    grid: { rows: number; cols: number; cells: { row: number; col: number; colorIndex: number | null }[][] },
    startRow: number,
    startCol: number,
  ): { row: number; col: number }[] {
    const sourceIndex = grid.cells[startRow][startCol].colorIndex
    if (sourceIndex === null) return []

    const visited = new Set<string>()
    const result: { row: number; col: number }[] = []
    const queue: { row: number; col: number }[] = [{ row: startRow, col: startCol }]

    while (queue.length > 0) {
      const { row, col } = queue.shift()!
      const key = `${row},${col}`
      if (visited.has(key)) continue
      if (row < 0 || row >= grid.rows || col < 0 || col >= grid.cols) continue
      if (grid.cells[row][col].colorIndex !== sourceIndex) continue

      visited.add(key)
      result.push({ row, col })

      queue.push(
        { row: row - 1, col },
        { row: row + 1, col },
        { row, col: col - 1 },
        { row, col: col + 1 },
      )
    }

    return result
  }

  function initReplace(row: number, col: number) {
    const beadStore = useBeadStore()
    const grid = beadStore.beadGrid
    if (!grid) return

    const cells = floodFillConnected(grid, row, col)
    if (cells.length === 0) return

    const sourceIndex = grid.cells[row][col].colorIndex
    replaceSourceIndex.value = sourceIndex
    replaceCellCount.value = cells.length
    replaceCellsList = cells
    showReplaceModal.value = true
  }

  function confirmReplace(targetIndex: number) {
    if (replaceCellsList.length === 0) return
    const beadStore = useBeadStore()
    const grid = beadStore.beadGrid
    if (!grid) return

    const changes: CellChange[] = []
    for (const { row, col } of replaceCellsList) {
      const cell = grid.cells[row][col]
      if (cell.colorIndex === targetIndex) continue
      changes.push({ row, col, oldColorIndex: cell.colorIndex })
      cell.colorIndex = targetIndex
    }

    if (changes.length > 0) {
      undoStack.value.push({ cells: changes })
      redoStack.value = []
    }

    showReplaceModal.value = false
    replaceSourceIndex.value = null
    replaceCellCount.value = 0
    replaceCellsList = []
  }

  function cancelReplace() {
    showReplaceModal.value = false
    replaceSourceIndex.value = null
    replaceCellCount.value = 0
    replaceCellsList = []
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
    selectMode,
    selectStart,
    previewRect,
    undoStack,
    redoStack,
    toggleBrushMode,
    setActiveColor,
    paintCell,
    beginStroke,
    continueStroke,
    endStroke,
    beginSelect,
    updatePreview,
    completeSelect,
    cancelSelect,
    undo,
    redo,
    resetHistory,
    showReplaceModal,
    replaceSourceIndex,
    replaceCellCount,
    initReplace,
    confirmReplace,
    cancelReplace,
  }
})
