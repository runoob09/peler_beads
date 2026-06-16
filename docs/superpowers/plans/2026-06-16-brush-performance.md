# Brush Stroke Performance Optimization Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate brush stroke lag by reducing per-frame rendering from O(N) full-grid redraw to O(1) incremental updates with RAF throttling.

**Architecture:** Persistent offscreen canvas holds cell colors (no grid lines). Visible canvas blits offscreen + draws grid lines each frame. RAF throttling caps renders at display refresh rate. `continueStroke` returns boolean to skip unnecessary renders. `ColorLegend` defers updates until stroke ends.

**Tech Stack:** Vue 3, TypeScript, Canvas 2D API, Pinia, vitest + happy-dom

---

## Task 1: brushStore — Add isStroking state and continueStroke return boolean

**Files:** Modify `src/stores/brushStore.ts`, Test `src/stores/__tests__/brushStore.test.ts`

- [ ] Step 1: Append failing tests to brushStore.test.ts (isStroking lifecycle + continueStroke return values)
- [ ] Step 2: Run `npx vitest run src/stores/__tests__/brushStore.test.ts` — expect FAIL
- [ ] Step 3: Add `isStroking` ref, make `continueStroke` return `boolean`, update `beginStroke`/`endStroke`/`resetHistory`
- [ ] Step 4: Run tests — expect PASS
- [ ] Step 5: `git commit -m "feat: add isStroking state and return boolean from continueStroke"`

### Step 3 Implementation Details

In `src/stores/brushStore.ts`:

**A)** After line 17 (`const redoStack = ...`), add:
```typescript
const isStroking = ref(false)
```

**B)** In `beginStroke()` (line 46), add as first line:
```typescript
isStroking.value = true
```

**C)** Change `continueStroke` signature and early returns to return `boolean`:
```typescript
function continueStroke(row: number, col: number): boolean {
  // ... each guard clause returns false instead of bare return
  // ... success path returns true at the end
}
```
Every `return` without a value becomes `return false`, and after `cell.colorIndex = activeColorIndex.value` add `return true`.

**D)** In `endStroke()`, add as first line:
```typescript
isStroking.value = false
```

**E)** In `resetHistory()`, add:
```typescript
isStroking.value = false
```

**F)** Export `isStroking` in the return object.

### Step 1 Test Code (append to end of file before last closing `})`)

```typescript
describe('isStroking', () => {
  it('is false by default', () => {
    const brush = useBrushStore()
    expect(brush.isStroking).toBe(false)
  })
  it('becomes true after beginStroke', () => {
    const brush = useBrushStore()
    brush.beginStroke()
    expect(brush.isStroking).toBe(true)
  })
  it('becomes false after endStroke', () => {
    const brush = useBrushStore()
    brush.beginStroke()
    brush.endStroke()
    expect(brush.isStroking).toBe(false)
  })
})

describe('continueStroke return value', () => {
  function setupGrid() {
    const bead = useBeadStore()
    bead.beadGrid = makeTestBeadGrid()
    const brush = useBrushStore()
    brush.setActiveColor(2)
    brush.beginStroke()
    return { bead, brush }
  }
  it('returns true when cell is successfully painted', () => {
    const { brush } = setupGrid()
    expect(brush.continueStroke(0, 0)).toBe(true)
  })
  it('returns false when activeColorIndex is null', () => {
    const bead = useBeadStore()
    bead.beadGrid = makeTestBeadGrid()
    const brush = useBrushStore()
    brush.beginStroke()
    expect(brush.continueStroke(0, 0)).toBe(false)
  })
  it('returns false when beadGrid is null', () => {
    const brush = useBrushStore()
    brush.setActiveColor(2)
    brush.beginStroke()
    expect(brush.continueStroke(0, 0)).toBe(false)
  })
  it('returns false for out-of-bounds cell', () => {
    const { brush } = setupGrid()
    expect(brush.continueStroke(999, 999)).toBe(false)
  })
  it('returns false when cell already has the active color', () => {
    const { brush } = setupGrid()
    brush.continueStroke(0, 0) // paint White(0) -> Red(2)
    expect(brush.continueStroke(0, 0)).toBe(false) // same cell, now Red==Red
  })
  it('returns false for duplicate cell within same stroke', () => {
    const { brush } = setupGrid()
    brush.continueStroke(0, 1) // paint (0,1) Red
    expect(brush.continueStroke(0, 1)).toBe(false) // dedup
  })
})
```

---

## Task 2: useExport — Extract renderAllCells, drawGridLines, renderCell

**Files:** Modify `src/composables/useExport.ts`, Test `src/composables/__tests__/useExport.test.ts`

- [ ] Step 1: Replace useExport.test.ts with new tests
- [ ] Step 2: Run tests — expect FAIL (missing exports)
- [ ] Step 3: Add `drawGridLines`, `renderAllCells`, `renderCell` functions; refactor `renderGridToCanvas` to use them
- [ ] Step 4: Run tests — expect PASS
- [ ] Step 5: Run `npx vitest run` — verify no regressions
- [ ] Step 6: `git commit -m "feat: extract renderCell, renderAllCells, drawGridLines from renderGridToCanvas"`

### Step 3 Implementation Details

In `src/composables/useExport.ts`, after `buildSymbolMap` (after line 21):

**New function `drawGridLines`** — extracted grid line drawing logic:
```typescript
export function drawGridLines(
  ctx: CanvasRenderingContext2D,
  cols: number,
  rows: number,
  cellSize: number,
  gridLines: GridLineSettings,
  offsetX = 0,
  offsetY = 0,
): void {
  if (!gridLines.showGrid) return
  const totalW = cols * cellSize
  const totalH = rows * cellSize
  if (gridLines.gridLineWidth > 0) {
    ctx.strokeStyle = gridLines.gridLineColor
    ctx.lineWidth = gridLines.gridLineWidth
    for (let row = 0; row <= rows; row++) {
      ctx.beginPath(); ctx.moveTo(offsetX, offsetY + row * cellSize); ctx.lineTo(offsetX + totalW, offsetY + row * cellSize); ctx.stroke()
    }
    for (let col = 0; col <= cols; col++) {
      ctx.beginPath(); ctx.moveTo(offsetX + col * cellSize, offsetY); ctx.lineTo(offsetX + col * cellSize, offsetY + totalH); ctx.stroke()
    }
  }
  if (gridLines.boldGridInterval > 0) {
    ctx.strokeStyle = gridLines.boldGridColor
    ctx.lineWidth = gridLines.boldGridWidth
    for (let row = 0; row <= rows; row += gridLines.boldGridInterval) {
      ctx.beginPath(); ctx.moveTo(offsetX, offsetY + row * cellSize); ctx.lineTo(offsetX + totalW, offsetY + row * cellSize); ctx.stroke()
    }
    for (let col = 0; col <= cols; col += gridLines.boldGridInterval) {
      ctx.beginPath(); ctx.moveTo(offsetX + col * cellSize, offsetY); ctx.lineTo(offsetX + col * cellSize, offsetY + totalH); ctx.stroke()
    }
  }
}
```

**New function `renderAllCells`** — renders all cells without grid lines:
```typescript
export function renderAllCells(
  ctx: CanvasRenderingContext2D, grid: BeadGrid, cellSize: number,
  renderMode: RenderMode, showLabels = false,
): void {
  const symbolMap = renderMode !== 'color' ? buildSymbolMap(grid.palette) : null
  for (let row = 0; row < grid.rows; row++)
    for (let col = 0; col < grid.cols; col++)
      renderCell(ctx, grid, row, col, cellSize, renderMode, symbolMap, showLabels)
}
```

**New function `renderCell`** — renders a single cell:
```typescript
export function renderCell(
  ctx: CanvasRenderingContext2D, grid: BeadGrid, row: number, col: number,
  cellSize: number, renderMode: RenderMode,
  symbolMap: Map<number, string> | null, showLabels: boolean,
): void {
  const cell = grid.cells[row][col]
  if (cell.colorIndex === null) return
  const color = grid.palette[cell.colorIndex]
  const x = col * cellSize, y = row * cellSize
  ctx.fillStyle = renderMode === 'symbol' ? '#FFFFFF' : color.hex
  ctx.fillRect(x, y, cellSize, cellSize)
  if (showLabels) {
    const label = getColorLabel(color)
    const fs = Math.max(6, cellSize * 0.35)
    ctx.font = `bold ${fs}px monospace`
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillStyle = getTextColor(color.hex)
    ctx.fillText(label, x + cellSize / 2, y + cellSize / 2)
  }
  if (renderMode === 'symbol' || renderMode === 'mixed') {
    const sym = symbolMap!.get(cell.colorIndex!) ?? '?'
    const fs = cellSize * 0.6
    ctx.font = `${fs}px monospace`
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillStyle = renderMode === 'symbol' ? '#000000' : getTextColor(color.hex)
    ctx.fillText(sym, x + cellSize / 2, y + cellSize / 2)
  }
}
```

**Refactor `renderGridToCanvas`** to use extracted functions (replace body lines 39-125):
```typescript
export function renderGridToCanvas(
  grid: BeadGrid, renderMode: RenderMode, cellSize: number,
  gridLines: GridLineSettings, scale = 1, showLabels = false,
): HTMLCanvasElement {
  const width = grid.cols * cellSize * scale, height = grid.rows * cellSize * scale
  const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height
  const ctx = canvas.getContext('2d'); if (!ctx) return canvas
  ctx.scale(scale, scale)
  renderAllCells(ctx, grid, cellSize, renderMode, showLabels)
  drawGridLines(ctx, grid.cols, grid.rows, cellSize, gridLines)
  return canvas
}
```

**Keep `getColorLabel` as private helper** (rename or keep as-is — it's used by renderCell).

---

## Task 3: BeadPreview — RAF throttle + persistent offscreen + remove deep watcher + incremental updates

**Files:** Modify `src/components/BeadPreview.vue`

This is the main optimization. Key changes:
1. Import `renderAllCells`, `drawGridLines` (keep `renderGridToCanvas` for export)
2. Add persistent offscreen canvas + dirtyCells set + RAF throttle
3. Replace `nextTick(render)` with `scheduleRender()`
4. Remove deep watcher, replace with shallow identity watch
5. Split grid lines drawing from cell rendering for incremental updates

- [ ] Step 1: Run existing tests — verify they pass before changes
- [ ] Step 2: Apply changes to BeadPreview.vue (detailed below)
- [ ] Step 3: Run `npx vitest run` — verify no regressions
- [ ] Step 4: `npx vue-tsc -b` — verify no type errors
- [ ] Step 5: `git commit -m "perf: RAF-throttled incremental rendering for brush strokes"`

### Step 2: Complete BeadPreview.vue changes

**Change import (line 6):**
```typescript
import { renderGridToCanvas, renderAllCells, drawGridLines } from '../composables/useExport'
```

**Add after line 33 (after cursorStyle computed):**
```typescript
// Persistent offscreen canvas for cell colors (no grid lines)
let offscreenCanvas: HTMLCanvasElement | null = null
let offscreenCtx: CanvasRenderingContext2D | null = null
let needFullRender = true
let renderRafId = 0
const dirtyCells = new Set<string>()
```

**Replace `render()` function (lines 70-95) with:**
```typescript
function scheduleRender(forceFull = false) {
  if (forceFull) needFullRender = true
  if (renderRafId) return
  renderRafId = requestAnimationFrame(() => {
    renderRafId = 0
    doRender()
  })
}

function doRender() {
  if (!canvasRef.value || !beadStore.beadGrid) return
  const container = containerRef.value
  if (!container) return
  const maxW = container.clientWidth || 400
  const maxH = container.clientHeight || 400
  const newCellSize = Math.floor(Math.min(maxW / beadStore.beadGrid.cols, maxH / beadStore.beadGrid.rows))
  const sizeChanged = newCellSize !== cellSize.value
  cellSize.value = newCellSize

  const grid = beadStore.beadGrid
  const w = grid.cols * cellSize.value
  const h = grid.rows * cellSize.value

  if (!offscreenCanvas) {
    offscreenCanvas = document.createElement('canvas')
    offscreenCtx = offscreenCanvas.getContext('2d')!
    needFullRender = true
  }

  if (sizeChanged || needFullRender) {
    offscreenCanvas.width = w
    offscreenCanvas.height = h
    offscreenCtx = offscreenCanvas.getContext('2d')!
    offscreenCtx.clearRect(0, 0, w, h)
    const mode = beadStore.settings.display.renderMode
    renderAllCells(offscreenCtx, grid, cellSize.value, mode, false)
    needFullRender = false
    dirtyCells.clear()
  } else if (dirtyCells.size > 0) {
    for (const key of dirtyCells) {
      const [r, c] = key.split(',').map(Number)
      if (r < 0 || r >= grid.rows || c < 0 || c >= grid.cols) continue
      const x = c * cellSize.value, y = r * cellSize.value
      offscreenCtx!.clearRect(x, y, cellSize.value, cellSize.value)
      const colorIndex = grid.cells[r][c].colorIndex
      if (colorIndex !== null) {
        offscreenCtx!.fillStyle = grid.palette[colorIndex].hex
        offscreenCtx!.fillRect(x, y, cellSize.value, cellSize.value)
      }
    }
    dirtyCells.clear()
  }

  canvasRef.value.width = w
  canvasRef.value.height = h
  canvasRef.value.style.width = w + 'px'
  canvasRef.value.style.height = h + 'px'
  const ctx = canvasRef.value.getContext('2d')
  if (!ctx) return
  ctx.drawImage(offscreenCanvas!, 0, 0)

  const d = beadStore.settings.display
  drawGridLines(ctx, grid.cols, grid.rows, cellSize.value, {
    showGrid: d.showGrid, gridLineColor: d.gridLineColor,
    gridLineWidth: d.gridLineWidth, boldGridInterval: d.boldGridInterval,
    boldGridColor: d.boldGridColor, boldGridWidth: d.boldGridWidth,
  })
}
```

**Replace `onMouseDown` (lines 97-109):**
```typescript
function onMouseDown(event: MouseEvent) {
  if (brushStore.brushMode) {
    isPainting.value = true
    brushStore.beginStroke()
    const cell = getCellFromEvent(event)
    if (cell) {
      if (brushStore.continueStroke(cell.row, cell.col)) {
        dirtyCells.add(`${cell.row},${cell.col}`)
      }
      scheduleRender()
    }
  } else {
    onPanStart(event)
  }
}
```

**Replace `onMouseMove` paining block (lines 111-120):**
```typescript
function onMouseMove(event: MouseEvent) {
  if (!beadStore.beadGrid || !canvasRef.value) return
  if (isPainting.value) {
    const cell = getCellFromEvent(event)
    if (cell) {
      hoveredCell.value = cell
      if (brushStore.continueStroke(cell.row, cell.col)) {
        dirtyCells.add(`${cell.row},${cell.col}`)
      }
      scheduleRender()
    }
    return
  }
  // ... rest unchanged (hover logic lines 122-134)
}
```

**Replace `onKeyDown` undo/redo renders (lines 140-154):**
```typescript
function onKeyDown(event: KeyboardEvent) {
  if ((event.ctrlKey || event.metaKey) && event.key === 'z') {
    event.preventDefault()
    if (event.shiftKey) { brushStore.redo() } else { brushStore.undo() }
    scheduleRender(true) // force full render for undo/redo
  } else if ((event.ctrlKey || event.metaKey) && event.key === 'y') {
    event.preventDefault()
    brushStore.redo()
    scheduleRender(true)
  }
}
```

**Replace `onDocumentMouseUp` render (line 216-223):**
```typescript
function onDocumentMouseUp() {
  if (isPainting.value) {
    isPainting.value = false
    brushStore.endStroke()
    scheduleRender()
  }
  onPanEnd()
}
```

**Replace `onMounted` (line 225-230):**
```typescript
onMounted(() => {
  scheduleRender(true)
  document.addEventListener('mousemove', onPanMove)
  document.addEventListener('mouseup', onDocumentMouseUp)
  document.addEventListener('keydown', onKeyDown)
})
```

**Replace deep watcher (lines 236-240) with:**
```typescript
// Full re-render when display settings or grid identity change
watch(
  () => beadStore.beadGrid,
  () => { if (beadStore.beadGrid) scheduleRender(true) },
)
watch(
  () => beadStore.settings.display,
  () => { if (beadStore.beadGrid) scheduleRender(true) },
)
```

---

## Task 4: ColorLegend — Skip updates during active stroke

**Files:** Modify `src/components/ColorLegend.vue`

- [ ] Step 1: Guard the watcher to skip re-render during stroke
- [ ] Step 2: Add a watch on `brushStore.isStroking` to re-render when stroke ends
- [ ] Step 3: Run `npx vitest run src/components/__tests__/ColorLegend.test.ts`
- [ ] Step 4: `git commit -m "perf: defer ColorLegend updates until brush stroke ends"`

### Step 1+2: ColorLegend.vue changes

**Add after the existing watcher (line 241), modify the watcher:**

Replace lines 237-241:
```typescript
watch(
  [sortedColors, panelWidth, () => brushStore.activeColorIndex, () => brushStore.brushMode],
  () => { nextTick(render) },
  { deep: true },
)
```

With:
```typescript
watch(
  [sortedColors, panelWidth, () => brushStore.activeColorIndex, () => brushStore.brushMode],
  () => {
    if (brushStore.isStroking) return // skip during stroke
    nextTick(render)
  },
  { deep: true },
)

// Re-render when stroke ends
watch(
  () => brushStore.isStroking,
  (stroking) => {
    if (!stroking) nextTick(render)
  },
)
```

---

## Task 5: Export function compatibility check

**Files:** No changes needed (verify only)

`renderExportCanvas` in `useExport.ts` already does its own full rendering inline — it doesn't call `renderGridToCanvas`. However, `renderGridToCanvas` is used by `exportPNG`. Since we refactored `renderGridToCanvas` to use the extracted functions internally, the public API is unchanged. Verify:

- [ ] Step 1: Run `npx vitest run src/composables/__tests__/useExport.test.ts`
- [ ] Step 2: Run `npx vue-tsc -b`

---

## Task 6: Final verification

- [ ] Step 1: Run all tests: `npm run test`
- [ ] Step 2: Run type check: `npx vue-tsc -b`
- [ ] Step 3: `git add -A && git commit -m "perf: optimize brush stroke rendering with RAF throttle and incremental updates"`
