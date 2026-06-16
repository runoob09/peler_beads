# Brush Rectangle Select + Null Cell Mark — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Shift-key rectangle selection to brush mode and render null cells with diagonal cross lines.

**Architecture:** brushStore gains selectMode/selectStart/previewRect state + beginSelect/updatePreview/completeSelect/cancelSelect operations. BeadPreview handles Shift key events, click-to-select, and rectangle preview overlay rendering. useExport renderCell renders null cells with light-gray diagonal crosses.

**Tech Stack:** Vue 3, Pinia, Canvas 2D API, Vitest + happy-dom

---

### Task 1: Null Cell Mark in renderCell

**Files:**
- Modify: `src/composables/useExport.ts:88-132`

- [ ] **Step 1: Replace the early return for null cells with cross mark rendering**

Currently line 99: `if (cell.colorIndex === null) return`

Replace with diagonal cross lines:

```typescript
export function renderCell(
  ctx: CanvasRenderingContext2D,
  grid: BeadGrid,
  row: number,
  col: number,
  cellSize: number,
  renderMode: RenderMode,
  symbolMap: Map<number, string> | null,
  showLabels: boolean,
): void {
  const cell = grid.cells[row][col]
  const x = col * cellSize
  const y = row * cellSize

  if (cell.colorIndex === null) {
    // Draw diagonal cross mark to distinguish from white/empty background
    const pad = Math.max(2, cellSize * 0.15)
    ctx.strokeStyle = '#d4d4d8'
    ctx.lineWidth = 1
    // Top-left to bottom-right
    ctx.beginPath()
    ctx.moveTo(x + pad, y + pad)
    ctx.lineTo(x + cellSize - pad, y + cellSize - pad)
    ctx.stroke()
    // Top-right to bottom-left
    ctx.beginPath()
    ctx.moveTo(x + cellSize - pad, y + pad)
    ctx.lineTo(x + pad, y + cellSize - pad)
    ctx.stroke()
    return
  }

  const color = grid.palette[cell.colorIndex]
  // ... rest unchanged
```

- [ ] **Step 2: Run tests**

```bash
npm run test
```
Expected: All 200 tests pass. Existing useExport tests may need update if they assert null cells render nothing — check `src/composables/__tests__/useExport.test.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/composables/useExport.ts
git commit -m "feat: render diagonal cross marks on null cells"
```

---

### Task 2: Rectangle Select State in brushStore

**Files:**
- Modify: `src/stores/brushStore.ts`
- Modify: `src/stores/__tests__/brushStore.test.ts`

- [ ] **Step 1: Add failing tests for rectangle select**

```typescript
// Add to brushStore.test.ts, inside the describe block

describe('rectangle select', () => {
  it('beginSelect sets selectStart and selectMode', () => {
    const brush = useBrushStore()
    brush.beginSelect(1, 2)
    expect(brush.selectMode).toBe(true)
    expect(brush.selectStart).toEqual({ row: 1, col: 2 })
  })

  it('updatePreview sets previewRect from start to current position', () => {
    const brush = useBrushStore()
    brush.beginSelect(1, 2)
    brush.updatePreview(5, 7)
    expect(brush.previewRect).toEqual({ r1: 1, c1: 2, r2: 5, c2: 7 })
  })

  it('cancelSelect clears all select state', () => {
    const brush = useBrushStore()
    brush.beginSelect(1, 2)
    brush.updatePreview(5, 7)
    brush.cancelSelect()
    expect(brush.selectMode).toBe(false)
    expect(brush.selectStart).toBeNull()
    expect(brush.previewRect).toBeNull()
  })

  it('completeSelect fills rectangle and creates one undo entry', () => {
    const bead = useBeadStore()
    bead.beadGrid = makeTestBeadGrid() // 3x3 grid
    const brush = useBrushStore()
    brush.setActiveColor(2) // Red

    brush.completeSelect(0, 0, 2, 2)

    // All cells in 0,0..2,2 should be Red
    for (let r = 0; r <= 2; r++) {
      for (let c = 0; c <= 2; c++) {
        expect(bead.beadGrid!.cells[r][c].colorIndex).toBe(2)
      }
    }
    // Should be one undo entry with 9 cells
    expect(brush.undoStack.length).toBe(1)
    expect(brush.undoStack[0].cells.length).toBe(9)
  })

  it('completeSelect clears select state after filling', () => {
    const bead = useBeadStore()
    bead.beadGrid = makeTestBeadGrid()
    const brush = useBrushStore()
    brush.setActiveColor(2)
    brush.beginSelect(0, 0)

    brush.completeSelect(1, 1)

    expect(brush.selectMode).toBe(false)
    expect(brush.selectStart).toBeNull()
    expect(brush.previewRect).toBeNull()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/stores/__tests__/brushStore.test.ts
```
Expected: FAIL — `beginSelect` not defined

- [ ] **Step 3: Implement select state in brushStore**

Add these refs after `isStroking`:

```typescript
const selectMode = ref(false)
const selectStart = ref<{ row: number; col: number } | null>(null)
const previewRect = ref<{ r1: number; c1: number; r2: number; c2: number } | null>(null)
```

Add these functions:

```typescript
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

function completeSelect(startRow: number, startCol: number, endRow: number, endCol: number) {
  const beadStore = useBeadStore()
  const grid = beadStore.beadGrid
  if (!grid || activeColorIndex.value === null) {
    cancelSelect()
    return
  }

  // Clamp to grid bounds
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
```

Also add to the return statement:

```typescript
selectMode,
selectStart,
previewRect,
beginSelect,
updatePreview,
completeSelect,
cancelSelect,
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/stores/__tests__/brushStore.test.ts
```
Expected: New tests PASS (plus all existing tests)

- [ ] **Step 5: Full suite**

```bash
npm run test
```

- [ ] **Step 6: Commit**

```bash
git add src/stores/brushStore.ts src/stores/__tests__/brushStore.test.ts
git commit -m "feat: add rectangle select state and operations to brushStore"
```

---

### Task 3: BeadPreview Shift + Rectangle Select Integration

**Files:**
- Modify: `src/components/BeadPreview.vue`

- [ ] **Step 1: Add Shift key handling and select mode logic**

Add to `<script setup>` (after existing refs, before event handlers):

```typescript
// Rectangle select state (from store for template access)
const selectMode = computed(() => brushStore.selectMode)
const previewRect = computed(() => brushStore.previewRect)

// Shift key tracking
let shiftHeld = false

function onKeyDownSelect(event: KeyboardEvent) {
  if (event.key === 'Shift' && brushStore.brushMode) {
    shiftHeld = true
    brushStore.selectMode.value = true
  }
}

function onKeyUpSelect(event: KeyboardEvent) {
  if (event.key === 'Shift') {
    shiftHeld = false
    if (brushStore.selectStart.value) {
      brushStore.cancelSelect()
    }
  }
}
```

Register in `onMounted`:
```typescript
document.addEventListener('keydown', onKeyDownSelect)
document.addEventListener('keyup', onKeyUpSelect)
```

Register in `onUnmounted`:
```typescript
document.removeEventListener('keydown', onKeyDownSelect)
document.removeEventListener('keyup', onKeyUpSelect)
```

- [ ] **Step 2: Modify canvas click and mousemove for select mode**

In `onMouseDown`, wrap existing brush logic:

```typescript
function onMouseDown(event: MouseEvent) {
  if (brushStore.brushMode) {
    // Shift-select: click sets start point
    if (shiftHeld) {
      const cell = getCellFromEvent(event)
      if (!cell) return
      if (!brushStore.selectStart.value) {
        brushStore.beginSelect(cell.row, cell.col)
      } else {
        brushStore.completeSelect(
          brushStore.selectStart.value.row,
          brushStore.selectStart.value.col,
          cell.row,
          cell.col,
        )
        scheduleRender(true)
      }
      return
    }

    // Normal brush
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

In `onMouseMove`, add select preview update:

```typescript
// Inside onMouseMove, after the isPainting.value check:
if (shiftHeld && brushStore.selectStart.value) {
  const cell = getCellFromEvent(event)
  if (cell) {
    brushStore.updatePreview(cell.row, cell.col)
    scheduleRender(true)
  }
  return
}
```

- [ ] **Step 3: Add rectangle preview overlay rendering**

In `doRender()`, after drawing grid lines, add:

```typescript
// Draw rectangle select preview
const rect = brushStore.previewRect
if (rect && brushStore.brushMode && brushStore.selectStart.value) {
  const r1 = Math.min(rect.r1, rect.r2)
  const r2 = Math.max(rect.r1, rect.r2)
  const c1 = Math.min(rect.c1, rect.c2)
  const c2 = Math.max(rect.c1, rect.c2)
  const x1 = c1 * cellSize.value
  const y1 = r1 * cellSize.value
  const x2 = (c2 + 1) * cellSize.value
  const y2 = (r2 + 1) * cellSize.value

  ctx.fillStyle = 'rgba(59, 130, 246, 0.15)'
  ctx.fillRect(x1, y1, x2 - x1, y2 - y1)
  ctx.strokeStyle = 'rgba(59, 130, 246, 0.7)'
  ctx.lineWidth = 2
  ctx.strokeRect(x1, y1, x2 - x1, y2 - y1)
}
```

- [ ] **Step 4: Update cursor and template**

In template, update the canvas cursor style:
```html
:style="{ cursor: selectMode ? 'crosshair' : brushStore.brushMode ? 'crosshair' : 'default' }"
```

- [ ] **Step 5: Run tests**

```bash
npm run test
```
Update BeadPreview tests if needed.

- [ ] **Step 6: Commit**

```bash
git add src/components/BeadPreview.vue src/components/__tests__/BeadPreview.test.ts
git commit -m "feat: integrate Shift rectangle select in BeadPreview"
```

---

### Task 4: Final Integration Verification

**Files:** None

- [ ] **Step 1: Full test suite**

```bash
npm run test
```
Expected: All 205+ tests pass.

- [ ] **Step 2: Type check**

```bash
npx vue-tsc -b
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "chore: final integration verification for rectangle select"
```
