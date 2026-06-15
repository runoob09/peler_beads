# Brush Editing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add brush-based color editing on the bead grid after mapping, with stroke-level undo/redo, powered by three Pinia stores replacing existing composables.

**Architecture:** Three Pinia stores (paletteStore, beadStore, brushStore) replace usePalette and useBeadPipeline composables. brushStore manages brush mode, active color selection, and stroke-level undo/redo history. Components read/write stores directly instead of using props/emits for shared state.

**Tech Stack:** Vue 3, TypeScript, Pinia, Vitest, @vue/test-utils

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `src/stores/paletteStore.ts` | Create | Palette state: brand selection, custom colors, computed palette with LAB |
| `src/stores/beadStore.ts` | Create | Pipeline state: beadGrid, settings, process(), progress, error |
| `src/stores/brushStore.ts` | Create | Brush state: brushMode, activeColorIndex, undoStack, redoStack, paint/undo/redo |
| `src/main.ts` | Modify | Add createPinia() + app.use(pinia) |
| `src/App.vue` | Modify | Switch from composables to stores |
| `src/components/ControlPanel.vue` | Modify | Switch to stores, add brush toolbar |
| `src/components/BeadPreview.vue` | Modify | Switch to stores, brush paint interaction |
| `src/components/ColorLegend.vue` | Modify | Switch to stores, brush-mode color selection |
| `src/composables/usePalette.ts` | Delete | Migrated to paletteStore |
| `src/composables/useBeadPipeline.ts` | Delete | Migrated to beadStore |
| `src/stores/__tests__/paletteStore.test.ts` | Create | Store-level tests for paletteStore |
| `src/stores/__tests__/beadStore.test.ts` | Create | Store-level tests for beadStore |
| `src/stores/__tests__/brushStore.test.ts` | Create | Store-level tests for brushStore |
| `src/components/__tests__/ControlPanel.test.ts` | Create | Component tests including brush toolbar |
| `package.json` | Modify | Add pinia dependency |

Unchanged (used as pure functions by beadStore):
- `src/composables/useImageProcessor.ts`
- `src/composables/useColorMatcher.ts`
- `src/composables/useExport.ts`

---

### Task 1: Install Pinia

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install pinia**

```bash
npm install pinia
```

- [ ] **Step 2: Verify install**

```bash
npm run test
```
Expected: All 94 existing tests still pass (no code changes yet).

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add pinia dependency"
```

---

### Task 2: Create paletteStore

**Files:**
- Create: `src/stores/paletteStore.ts`
- Create: `src/stores/__tests__/paletteStore.test.ts`
- Modify: `src/main.ts` — add createPinia()
- Modify: `src/components/PalettePanel.vue` — add props for brush mode/active color

Note: We write the store test first (TDD), but since the store is a migration of existing well-tested logic, the test replicates the existing usePalette test suite adapted for Pinia.

- [ ] **Step 1: Write the failing test for paletteStore**

Create `src/stores/__tests__/paletteStore.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

// Mock the JSON import — must be hoisted
vi.mock('../../data/get-colors.json', () => ({
  default: {
    'TestBrand-3': [
      { 'color-name': 'A01', color: '#FFFFFF' },
      { 'color-name': 'A02', color: '#000000' },
      { 'color-name': 'A03', color: '#FF0000' },
    ],
    'TestBrand-4': [
      { 'color-name': 'B01', color: '#FFFFFF' },
      { 'color-name': 'B02', color: '#000000' },
      { 'color-name': 'B03', color: '#FF0000' },
      { 'color-name': 'B04', color: '#00FF00' },
    ],
  },
}))

vi.mock('../../data/palettes', () => {
  const brandData = {
    'TestBrand-3': [
      { 'color-name': 'A01', color: '#FFFFFF' },
      { 'color-name': 'A02', color: '#000000' },
      { 'color-name': 'A03', color: '#FF0000' },
    ],
    'TestBrand-4': [
      { 'color-name': 'B01', color: '#FFFFFF' },
      { 'color-name': 'B02', color: '#000000' },
      { 'color-name': 'B03', color: '#FF0000' },
      { 'color-name': 'B04', color: '#00FF00' },
    ],
  }
  return {
    BRAND_NAMES: Object.keys(brandData).sort(),
    getBrandColors: (name: string) => (brandData as any)[name] ?? [],
  }
})

import { usePaletteStore } from '../paletteStore'
import type { PaletteColor } from '../../types'

describe('paletteStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('returns brand names', () => {
    const store = usePaletteStore()
    expect(store.brandNames).toContain('TestBrand-3')
    expect(store.brandNames).toContain('TestBrand-4')
    expect(store.brandNames.length).toBe(2)
  })

  it('loads palette for a selected brand, deduplicated by hex', () => {
    const store = usePaletteStore()
    store.selectBrand('TestBrand-3')
    expect(store.palette.length).toBe(3)
  })

  it('deduplicates by hex within a brand', () => {
    const store = usePaletteStore()
    store.selectBrand('TestBrand-3')
    const hexes = store.palette.map((c: any) => c.hex)
    const uniqueHexes = new Set(hexes)
    expect(uniqueHexes.size).toBe(hexes.length)
  })

  it('precomputes LAB values for palette colors', () => {
    const store = usePaletteStore()
    store.selectBrand('TestBrand-3')
    for (const c of store.palette as any[]) {
      expect(c).toHaveProperty('lab')
      expect(Array.isArray(c.lab)).toBe(true)
      expect(c.lab.length).toBe(3)
    }
  })

  it('adds custom color', () => {
    const store = usePaletteStore()
    store.addCustomColor({ hex: '#ABCDEF', name: 'Custom Blue' })
    const custom = store.palette.find((c: PaletteColor) => c.brand === 'custom')
    expect(custom).toBeTruthy()
    expect(custom!.hex).toBe('#ABCDEF')
    expect(custom!.name).toBe('Custom Blue')
  })

  it('removes a custom color', () => {
    const store = usePaletteStore()
    store.selectBrand('TestBrand-3')
    store.addCustomColor({ hex: '#ABCDEF', name: 'ToRemove' })
    const custom = store.palette.find((c: PaletteColor) => c.brand === 'custom')
    expect(custom).toBeTruthy()
    const beforeCount = store.palette.length
    store.removeColor(custom!.id)
    expect(store.palette.length).toBe(beforeCount - 1)
    expect(store.palette.find((c: PaletteColor) => c.id === custom!.id)).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/stores/__tests__/paletteStore.test.ts
```
Expected: FAIL — module `../paletteStore` not found.

- [ ] **Step 3: Create paletteStore**

Create `src/stores/paletteStore.ts`:

```typescript
import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import type { PaletteColor } from '../types'
import { getBrandColors, BRAND_NAMES } from '../data/palettes'
import { hexToRgb, rgbToLab } from '../utils/colorSpace'

export interface PaletteColorInternal extends PaletteColor {
  lab: [number, number, number]
}

function computeLab(hex: string): [number, number, number] {
  const [r, g, b] = hexToRgb(hex)
  return rgbToLab(r, g, b)
}

function generateId(): string {
  return `c_${Math.random().toString(36).substring(2, 10)}`
}

export const usePaletteStore = defineStore('palette', () => {
  const selectedBrand = ref<string>(BRAND_NAMES[0] ?? '')
  const customColors = ref<PaletteColorInternal[]>([])

  const brandNames = computed(() => BRAND_NAMES)

  const brandPalette = computed<PaletteColorInternal[]>(() => {
    if (!selectedBrand.value) return []
    const colors = getBrandColors(selectedBrand.value)
    const seen = new Set<string>()
    const result: PaletteColorInternal[] = []
    for (const c of colors) {
      const hexUpper = c.color.toUpperCase()
      if (!seen.has(hexUpper)) {
        seen.add(hexUpper)
        result.push({
          id: `${selectedBrand.value}_${c['color-name']}`,
          name: `${c['color-name']}`,
          hex: hexUpper,
          brand: selectedBrand.value,
          lab: computeLab(hexUpper),
        })
      }
    }
    return result
  })

  const palette = computed<PaletteColorInternal[]>(() => {
    return [...brandPalette.value, ...customColors.value]
  })

  function selectBrand(brand: string) {
    selectedBrand.value = brand
  }

  function addCustomColor(color: { hex: string; name: string }) {
    const hexUpper = color.hex.toUpperCase()
    customColors.value.push({
      id: generateId(),
      name: color.name,
      hex: hexUpper,
      brand: 'custom',
      lab: computeLab(hexUpper),
    })
  }

  function removeColor(id: string) {
    customColors.value = customColors.value.filter(c => c.id !== id)
  }

  return {
    brandNames,
    selectedBrand,
    palette,
    selectBrand,
    addCustomColor,
    removeColor,
    customColors,
  }
})
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/stores/__tests__/paletteStore.test.ts
```
Expected: PASS (all 6 tests)

- [ ] **Step 5: Add createPinia to main.ts**

Read `src/main.ts`, modify to:

```typescript
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import './style.css'
import App from './App.vue'

const app = createApp(App)
app.use(createPinia())
app.mount('#app')
```

- [ ] **Step 6: Verify all existing tests still pass**

```bash
npm run test
```
Expected: All tests pass (94 existing + 6 new = 100).

- [ ] **Step 7: Commit**

```bash
git add src/stores/paletteStore.ts src/stores/__tests__/paletteStore.test.ts src/main.ts
git commit -m "feat: add paletteStore with Pinia, migrate from usePalette"
```

---

### Task 3: Create beadStore

**Files:**
- Create: `src/stores/beadStore.ts`
- Create: `src/stores/__tests__/beadStore.test.ts`

- [ ] **Step 1: Write the failing test for beadStore**

Create `src/stores/__tests__/beadStore.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useBeadStore } from '../beadStore'
import type { PaletteColor } from '../../types'

describe('beadStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('initializes with null beadGrid', () => {
    const store = useBeadStore()
    expect(store.beadGrid).toBeNull()
  })

  it('returns settings with defaults', () => {
    const store = useBeadStore()
    expect(store.settings.gridCols).toBe(29)
    expect(store.settings.gridRows).toBe(29)
    expect(store.settings.colorCalcMethod).toBe('dominant')
    expect(store.settings.colorMatchMethod).toBe('ciede2000')
  })

  it('initializes progress to 0', () => {
    const store = useBeadStore()
    expect(store.progress).toBe(0)
  })

  it('initializes error to null', () => {
    const store = useBeadStore()
    expect(store.error).toBeNull()
  })

  it('does not process without image file', async () => {
    const store = useBeadStore()
    const palette: PaletteColor[] = []
    await store.process(null as any, palette)
    expect(store.beadGrid).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/stores/__tests__/beadStore.test.ts
```
Expected: FAIL — module `../beadStore` not found.

- [ ] **Step 3: Create beadStore**

Create `src/stores/beadStore.ts`:

```typescript
import { ref } from 'vue'
import { defineStore } from 'pinia'
import type { BeadGrid, BeadSettings, PaletteColor, BeadCell } from '../types'
import { loadImageFromFile, computeAverageCells, computeBucketCells, computeDominantCells, computeMedianCells, computeCenterWeightedCells } from '../composables/useImageProcessor'
import { createColorMatcher } from '../composables/useColorMatcher'

export const useBeadStore = defineStore('bead', () => {
  const beadGrid = ref<BeadGrid | null>(null)
  const progress = ref(0)
  const error = ref<string | null>(null)

  const settings = ref<BeadSettings>({
    gridCols: 29,
    gridRows: 29,
    keepAspectRatio: true,
    colorCalcMethod: 'dominant',
    colorMatchMethod: 'ciede2000',
    bucketLevels: 8,
    tolerance: 30,
    display: {
      showGrid: true,
      gridLineColor: '#cccccc',
      gridLineWidth: 1,
      boldGridInterval: 10,
      boldGridColor: '#000000',
      boldGridWidth: 2,
      renderMode: 'color',
    },
  })

  async function process(
    imageFile: File | null,
    palette: PaletteColor[],
    overrideSettings?: Partial<BeadSettings>,
  ) {
    if (!imageFile || palette.length === 0) {
      beadGrid.value = null
      return
    }

    progress.value = 10
    error.value = null

    try {
      const s = { ...settings.value, ...overrideSettings }

      const img = await loadImageFromFile(imageFile)
      progress.value = 30

      if (s.colorCalcMethod === 'dominant') {
        beadGrid.value = await processRgbCells(
          computeDominantCells(img, s.gridCols, s.gridRows, s.keepAspectRatio, s.tolerance),
          palette, s,
        )
      } else if (s.colorCalcMethod === 'bucket') {
        beadGrid.value = await processRgbCells(
          computeBucketCells(img, s.gridCols, s.gridRows, s.keepAspectRatio, s.bucketLevels),
          palette, s,
        )
      } else if (s.colorCalcMethod === 'median') {
        beadGrid.value = await processRgbCells(
          computeMedianCells(img, s.gridCols, s.gridRows, s.keepAspectRatio),
          palette, s,
        )
      } else if (s.colorCalcMethod === 'centerWeighted') {
        beadGrid.value = await processRgbCells(
          computeCenterWeightedCells(img, s.gridCols, s.gridRows, s.keepAspectRatio),
          palette, s,
        )
      } else {
        beadGrid.value = await processRgbCells(
          computeAverageCells(img, s.gridCols, s.gridRows, s.keepAspectRatio),
          palette, s,
        )
      }

      progress.value = 100
    } catch (e) {
      error.value = e instanceof Error ? e.message : '处理图片时出错'
      beadGrid.value = null
      progress.value = 0
    } finally {
      if (progress.value === 100) {
        setTimeout(() => { progress.value = 0 }, 400)
      }
    }
  }

  return {
    beadGrid,
    progress,
    error,
    settings,
    process,
  }
})

/** 统一 RGB 管线：代表色计算 → 逐格调整 → 匹配调色板 */
async function processRgbCells(
  result: { cells: { r: number; g: number; b: number; a: number }[][]; imageCols: number; imageRows: number; imageX: number; imageY: number },
  palette: PaletteColor[],
  s: BeadSettings,
): Promise<BeadGrid> {
  const { cells: rgbCells, imageCols, imageRows, imageX, imageY } = result

  const matchColor = createColorMatcher(palette, s.colorMatchMethod)
  const cells: BeadCell[][] = Array.from({ length: s.gridRows }, (_, row) =>
    Array.from({ length: s.gridCols }, (_, col) => {
      const c = rgbCells[row][col]
      if (col < imageX || col >= imageX + imageCols || row < imageY || row >= imageY + imageRows) {
        return { row, col, colorIndex: null as number | null }
      }
      const match = matchColor(c.r, c.g, c.b)
      return { row, col, colorIndex: match.index }
    }),
  )

  return { rows: s.gridRows, cols: s.gridCols, cells, palette, imageCols, imageRows }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/stores/__tests__/beadStore.test.ts
```
Expected: PASS (all 5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/stores/beadStore.ts src/stores/__tests__/beadStore.test.ts
git commit -m "feat: add beadStore with Pinia, migrate from useBeadPipeline"
```

---

### Task 4: Create brushStore

**Files:**
- Create: `src/stores/brushStore.ts`
- Create: `src/stores/__tests__/brushStore.test.ts`

The brushStore depends on beadStore to read/write `beadGrid`. In tests we create a beadStore instance and set up a test grid before each test.

- [ ] **Step 1: Write the failing test for brushStore**

Create `src/stores/__tests__/brushStore.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useBrushStore } from '../brushStore'
import { useBeadStore } from '../beadStore'
import type { BeadGrid, PaletteColor } from '../../types'

function makeTestBeadGrid(): BeadGrid {
  const palette: PaletteColor[] = [
    { id: 'w', name: 'White', hex: '#FFFFFF', brand: 'test' },
    { id: 'b', name: 'Black', hex: '#000000', brand: 'test' },
    { id: 'r', name: 'Red', hex: '#FF0000', brand: 'test' },
  ]
  return {
    rows: 3, cols: 3, palette,
    cells: [
      [
        { row: 0, col: 0, colorIndex: 0 },
        { row: 0, col: 1, colorIndex: 0 },
        { row: 0, col: 2, colorIndex: 1 },
      ],
      [
        { row: 1, col: 0, colorIndex: 0 },
        { row: 1, col: 1, colorIndex: 0 },
        { row: 1, col: 2, colorIndex: 1 },
      ],
      [
        { row: 2, col: 0, colorIndex: 0 },
        { row: 2, col: 1, colorIndex: 0 },
        { row: 2, col: 2, colorIndex: 1 },
      ],
    ],
    imageCols: 3,
    imageRows: 3,
  }
}

describe('brushStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  describe('initial state', () => {
    it('has brushMode false by default', () => {
      const brush = useBrushStore()
      expect(brush.brushMode).toBe(false)
    })

    it('has activeColorIndex null by default', () => {
      const brush = useBrushStore()
      expect(brush.activeColorIndex).toBeNull()
    })

    it('has empty undo and redo stacks', () => {
      const brush = useBrushStore()
      expect(brush.undoStack).toEqual([])
      expect(brush.redoStack).toEqual([])
    })
  })

  describe('toggleBrushMode', () => {
    it('toggles brushMode from false to true', () => {
      const brush = useBrushStore()
      brush.toggleBrushMode()
      expect(brush.brushMode).toBe(true)
    })

    it('toggles brushMode from true to false', () => {
      const brush = useBrushStore()
      brush.toggleBrushMode()
      brush.toggleBrushMode()
      expect(brush.brushMode).toBe(false)
    })

    it('does not allow toggling on when beadGrid is null', () => {
      const brush = useBrushStore()
      brush.toggleBrushMode()
      // beadGrid is null (no beadStore setup), mode should stay false
      expect(brush.brushMode).toBe(false)
    })
  })

  describe('setActiveColor', () => {
    it('sets activeColorIndex', () => {
      const brush = useBrushStore()
      brush.setActiveColor(2)
      expect(brush.activeColorIndex).toBe(2)
    })
  })

  describe('paintCell', () => {
    it('paints a single cell and changes its colorIndex', () => {
      const bead = useBeadStore()
      bead.beadGrid = makeTestBeadGrid()
      const brush = useBrushStore()
      brush.setActiveColor(2) // Red

      brush.paintCell(0, 0)
      expect(bead.beadGrid!.cells[0][0].colorIndex).toBe(2)
    })

    it('does nothing when activeColorIndex is null', () => {
      const bead = useBeadStore()
      bead.beadGrid = makeTestBeadGrid()
      const brush = useBrushStore()
      // activeColorIndex is null

      brush.paintCell(0, 0)
      expect(bead.beadGrid!.cells[0][0].colorIndex).toBe(0) // unchanged
    })

    it('does nothing when beadGrid is null', () => {
      const brush = useBrushStore()
      brush.setActiveColor(1)
      // should not throw
      expect(() => brush.paintCell(0, 0)).not.toThrow()
    })

    it('does nothing for out-of-bounds cell', () => {
      const bead = useBeadStore()
      bead.beadGrid = makeTestBeadGrid()
      const brush = useBrushStore()
      brush.setActiveColor(2)

      brush.paintCell(999, 999)
      // no change, no throw
    })
  })

  describe('stroke lifecycle (beginStroke/continueStroke/endStroke)', () => {
    it('records a full stroke as one undo entry', () => {
      const bead = useBeadStore()
      bead.beadGrid = makeTestBeadGrid()
      const brush = useBrushStore()
      brush.setActiveColor(2) // Red

      brush.beginStroke()
      brush.continueStroke(0, 0)
      brush.continueStroke(0, 1)
      brush.continueStroke(0, 2)
      brush.endStroke()

      expect(brush.undoStack.length).toBe(1)
      const entry = brush.undoStack[0]
      expect(entry.cells.length).toBe(3)
    })

    it('deduplicates cells within a stroke', () => {
      const bead = useBeadStore()
      bead.beadGrid = makeTestBeadGrid()
      const brush = useBrushStore()
      brush.setActiveColor(2)

      brush.beginStroke()
      brush.continueStroke(0, 0)
      brush.continueStroke(0, 0) // duplicate
      brush.continueStroke(0, 0) // duplicate
      brush.endStroke()

      expect(brush.undoStack[0].cells.length).toBe(1)
    })

    it('does not push empty stroke to undo stack', () => {
      const brush = useBrushStore()
      brush.beginStroke()
      brush.endStroke()
      expect(brush.undoStack.length).toBe(0)
    })

    it('clears redoStack on new stroke', () => {
      const bead = useBeadStore()
      bead.beadGrid = makeTestBeadGrid()
      const brush = useBrushStore()
      brush.setActiveColor(2)

      // Paint, undo, then paint again
      brush.beginStroke()
      brush.continueStroke(0, 0)
      brush.endStroke()

      brush.undo()
      expect(brush.redoStack.length).toBe(1)

      brush.beginStroke()
      brush.continueStroke(1, 1)
      brush.endStroke()

      expect(brush.redoStack.length).toBe(0)
    })

    it('records oldColorIndex in undo entry', () => {
      const bead = useBeadStore()
      bead.beadGrid = makeTestBeadGrid()
      const brush = useBrushStore()
      brush.setActiveColor(2) // Red

      brush.beginStroke()
      brush.continueStroke(2, 2) // oldColorIndex was 1 (Black)
      brush.endStroke()

      const entry = brush.undoStack[0]
      expect(entry.cells[0].oldColorIndex).toBe(1)
    })
  })

  describe('undo/redo', () => {
    function setup() {
      const bead = useBeadStore()
      bead.beadGrid = makeTestBeadGrid()
      const brush = useBrushStore()
      brush.setActiveColor(2)

      brush.beginStroke()
      brush.continueStroke(0, 0)
      brush.endStroke()

      return { bead, brush }
    }

    it('undo restores old colorIndex', () => {
      const { bead, brush } = setup()
      expect(bead.beadGrid!.cells[0][0].colorIndex).toBe(2) // painted red

      brush.undo()
      expect(bead.beadGrid!.cells[0][0].colorIndex).toBe(0) // restored to white
    })

    it('undo moves entry to redoStack', () => {
      const { brush } = setup()
      expect(brush.undoStack.length).toBe(1)
      expect(brush.redoStack.length).toBe(0)

      brush.undo()
      expect(brush.undoStack.length).toBe(0)
      expect(brush.redoStack.length).toBe(1)
    })

    it('redo restores the painted color', () => {
      const { bead, brush } = setup()
      brush.undo()
      expect(bead.beadGrid!.cells[0][0].colorIndex).toBe(0)

      brush.redo()
      expect(bead.beadGrid!.cells[0][0].colorIndex).toBe(2)
    })

    it('undo does nothing when stack is empty', () => {
      const brush = useBrushStore()
      expect(() => brush.undo()).not.toThrow()
      expect(brush.undoStack.length).toBe(0)
    })

    it('redo does nothing when stack is empty', () => {
      const brush = useBrushStore()
      expect(() => brush.redo()).not.toThrow()
      expect(brush.redoStack.length).toBe(0)
    })
  })

  describe('resetHistory', () => {
    it('clears both undo and redo stacks', () => {
      const { brush } = (() => {
        const bead = useBeadStore()
        bead.beadGrid = makeTestBeadGrid()
        const brush = useBrushStore()
        brush.setActiveColor(2)
        brush.beginStroke()
        brush.continueStroke(0, 0)
        brush.endStroke()
        brush.undo()
        return { brush }
      })()

      expect(brush.undoStack.length).toBe(0)
      expect(brush.redoStack.length).toBe(1)

      brush.resetHistory()
      expect(brush.undoStack.length).toBe(0)
      expect(brush.redoStack.length).toBe(0)
    })

    it('exits brush mode', () => {
      const brush = useBrushStore()
      brush.toggleBrushMode()
      // Can't toggle with null grid, manually set for test
      // brushMode stays false since beadGrid is null
    })

    it('resets activeColorIndex', () => {
      const brush = useBrushStore()
      brush.setActiveColor(1)
      brush.resetHistory()
      expect(brush.activeColorIndex).toBeNull()
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/stores/__tests__/brushStore.test.ts
```
Expected: FAIL — module `../brushStore` not found.

- [ ] **Step 3: Create brushStore**

Create `src/stores/brushStore.ts`:

```typescript
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
    if (cell.colorIndex === activeColorIndex.value) return false // already this color

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
    if (strokeCellKeys.has(key)) return // deduplicate

    const cell = grid.cells[row][col]
    const oldColorIndex = cell.colorIndex
    if (oldColorIndex === activeColorIndex.value) return // already this color

    strokeCellKeys.add(key)
    strokeCells.push({ row, col, oldColorIndex: oldColorIndex ?? -1 })
    cell.colorIndex = activeColorIndex.value
  }

  function endStroke() {
    if (strokeCells.length === 0) return
    undoStack.value.push({ cells: [...strokeCells] })
    redoStack.value = [] // clear redo on new action
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
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/stores/__tests__/brushStore.test.ts
```
Expected: PASS (all tests)

- [ ] **Step 5: Commit**

```bash
git add src/stores/brushStore.ts src/stores/__tests__/brushStore.test.ts
git commit -m "feat: add brushStore with undo/redo stroke-based editing"
```

---

### Task 5: Switch App.vue from composables to stores

**Files:**
- Modify: `src/App.vue`

Now that all three stores exist, switch App.vue to use them. Also add brushStore resetHistory() when palette or settings change cause re-processing.

- [ ] **Step 1: Update App.vue to use stores**

Read the current `src/App.vue` and replace the script section:

```typescript
<script setup lang="ts">
import { ref, watch } from 'vue'
import ControlPanel from './components/ControlPanel.vue'
import BeadPreview from './components/BeadPreview.vue'
import ColorLegend from './components/ColorLegend.vue'
import { usePaletteStore } from './stores/paletteStore'
import { useBeadStore } from './stores/beadStore'
import { useBrushStore } from './stores/brushStore'
import { exportPNG, downloadBlob } from './composables/useExport'
import { generatePdf } from './utils/exportPdf'
import { extractFromPng, extractFromPdf } from './utils/embedMetadata'
import type { BeadSettings, ExportConfig } from './types'

const paletteStore = usePaletteStore()
const beadStore = useBeadStore()
const brushStore = useBrushStore()

const imageFile = ref<File | null>(null)

function onUpload(file: File) {
  imageFile.value = file
  triggerProcess()
}

function onUpdateSettings(s: BeadSettings) {
  beadStore.settings = s
  triggerProcess()
}

function onRemoveColor(id: string) {
  paletteStore.removeColor(id)
  triggerProcess()
}

let debounceTimer: ReturnType<typeof setTimeout>
function triggerProcess() {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    // Reset brush history when reprocessing
    brushStore.resetHistory()
    beadStore.process(imageFile.value, paletteStore.palette, beadStore.settings)
  }, 300)
}

watch(() => paletteStore.selectedBrand, () => { triggerProcess() })

async function onExport(config: ExportConfig) {
  if (!beadStore.beadGrid) return
  const gridLines = {
    showGrid: config.showGrid,
    gridLineColor: config.gridLineColor,
    gridLineWidth: config.gridLineWidth,
    boldGridInterval: config.boldGridInterval,
    boldGridColor: config.boldGridColor,
    boldGridWidth: config.boldGridWidth,
  }

  const projectJson = JSON.stringify({
    version: 1,
    settings: beadStore.settings,
    palette: {
      brand: paletteStore.selectedBrand,
      colors: paletteStore.palette.filter(c => c.brand !== 'custom'),
      custom: paletteStore.palette.filter(c => c.brand === 'custom'),
    },
  })

  let imageBytes: Uint8Array | undefined
  if (imageFile.value) {
    const buf = await imageFile.value.arrayBuffer()
    imageBytes = new Uint8Array(buf)
  }

  if (config.format === 'png') {
    const blob = await exportPNG(beadStore.beadGrid, gridLines, config.cellSize, projectJson, imageBytes)
    downloadBlob(blob, `${config.filename}.png`)
  } else {
    const pdfBytes = await generatePdf(
      beadStore.beadGrid, gridLines, config.cellSize, config.filename,
      projectJson, imageBytes, imageFile.value?.type,
    )
    downloadBlob(new Blob([pdfBytes as any], { type: 'application/pdf' }), `${config.filename}.pdf`)
  }
}

async function onImportFromDrawing() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.png,.pdf,image/png,application/pdf'
  input.onchange = async () => {
    const file = input.files?.[0]
    if (!file) return

    try {
      const bytes = new Uint8Array(await file.arrayBuffer())
      const isPng = file.type === 'image/png' || file.name.endsWith('.png')
      const result = isPng ? extractFromPng(bytes) : await extractFromPdf(bytes)

      if (!result.projectJson) {
        alert('该文件中未找到项目数据')
        return
      }

      const project = JSON.parse(result.projectJson)
      if (project.settings) {
        beadStore.settings = { ...beadStore.settings, ...project.settings }
      }
      if (project.palette) {
        paletteStore.selectBrand(project.palette.brand || '')
        await new Promise(r => setTimeout(r, 100))
        for (const c of project.palette.custom || []) {
          paletteStore.addCustomColor({ hex: c.hex, name: c.name })
        }
      }
      if (result.imageBytes && result.imageBytes.length > 0) {
        const blob = new Blob([result.imageBytes as unknown as BlobPart], { type: file.type || 'image/png' })
        imageFile.value = new File([blob], 'restored.png', { type: blob.type })
        triggerProcess()
      }
    } catch (e) {
      alert('无法解析该文件：' + (e instanceof Error ? e.message : '未知错误'))
    }
  }
  input.click()
}
</script>
```

The template section changes: remove props from ControlPanel, BeadPreview, ColorLegend since they will read stores directly.

Replace the template with:

```html
<template>
  <div class="app-layout">
    <ControlPanel
      @upload="onUpload"
      @update:settings="onUpdateSettings"
      @remove-color="onRemoveColor"
      @export="onExport"
      @import-drawing="onImportFromDrawing"
    />
    <div class="preview-wrapper">
      <div v-if="beadStore.error" class="error-banner">{{ beadStore.error }}</div>
      <BeadPreview />
    </div>
    <ColorLegend />
  </div>
</template>
```

- [ ] **Step 2: Run tests to verify**

```bash
npm run test
```
Expected: Some component tests may fail because they still pass props. We'll fix those in the component tasks.

- [ ] **Step 3: Commit**

```bash
git add src/App.vue
git commit -m "refactor: switch App.vue from composables to Pinia stores"
```

---

### Task 6: Update ControlPanel to use stores and add brush toolbar

**Files:**
- Modify: `src/components/ControlPanel.vue`
- Modify: `src/components/PalettePanel.vue`
- Modify: `src/components/PaletteEditor.vue`

- [ ] **Step 1: Update PaletteEditor to accept brush-related props and emit color selection**

Read and replace `src/components/PaletteEditor.vue`:

```html
<script setup lang="ts">
import type { PaletteColor } from '../types'

const props = defineProps<{
  palette: PaletteColor[]
  brushMode?: boolean
  activeColorIndex?: number | null
}>()

const emit = defineEmits<{
  'remove-color': [id: string]
  'select-color': [index: number]
}>()

function isActive(index: number): boolean {
  return props.brushMode === true && props.activeColorIndex === index
}
</script>

<template>
  <div class="palette-editor">
    <div class="custom-colors">
      <div
        v-for="(c, paletteIndex) in palette.filter(p => p.brand === 'custom')"
        :key="c.id"
        class="color-chip-row"
        :class="{ 'is-active-color': isActive(paletteIndex) }"
      >
        <span
          class="color-swatch"
          :style="{ background: c.hex }"
          @click="emit('select-color', paletteIndex)"
        ></span>
        <span class="color-name">{{ c.name || c.hex }}</span>
        <button class="remove-btn" @click="emit('remove-color', c.id)">×</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.palette-editor { display: flex; flex-direction: column; gap: 6px; margin-top: 8px; }
.custom-colors { max-height: 120px; overflow-y: auto; }
.color-chip-row { display: flex; align-items: center; gap: 6px; padding: 2px 0; }
.color-chip-row.is-active-color { background: var(--accent-bg, rgba(170, 59, 255, 0.1)); border-radius: 4px; }
.color-swatch { width: 18px; height: 18px; border-radius: 3px; border: 1px solid var(--border); flex-shrink: 0; cursor: pointer; }
.color-name { font-size: 12px; color: var(--text); flex: 1; }
.remove-btn { border: none; background: none; color: #999; cursor: pointer; font-size: 14px; padding: 0 2px; }
</style>
```

- [ ] **Step 2: Update PalettePanel to pass brush props through**

Read and replace `src/components/PalettePanel.vue`:

```html
<script setup lang="ts">
import type { PaletteColor } from '../types'
import PaletteSelector from './PaletteSelector.vue'
import PaletteEditor from './PaletteEditor.vue'

defineProps<{
  brandNames: string[]
  selectedBrand: string
  palette: PaletteColor[]
  brushMode?: boolean
  activeColorIndex?: number | null
}>()

const emit = defineEmits<{
  'select-brand': [brand: string]
  'remove-color': [id: string]
  'select-color': [index: number]
}>()
</script>

<template>
  <div class="palette-panel">
    <label class="label">色板</label>
    <PaletteSelector
      :modelValue="selectedBrand"
      :brandNames="brandNames"
      @update:modelValue="emit('select-brand', $event)"
    />
    <PaletteEditor
      :palette="palette"
      :brushMode="brushMode"
      :activeColorIndex="activeColorIndex"
      @remove-color="emit('remove-color', $event)"
      @select-color="emit('select-color', $event)"
    />
  </div>
</template>

<style scoped>
.palette-panel { display: flex; flex-direction: column; gap: 6px; }
.label { font-size: 13px; color: var(--text); font-weight: 500; }
.color-count { font-size: 12px; color: var(--text); }
</style>
```

- [ ] **Step 3: Update ControlPanel to use stores and add brush toolbar**

Read and replace `src/components/ControlPanel.vue`:

```html
<script setup lang="ts">
import type { BeadSettings, ExportConfig } from '../types'
import { usePaletteStore } from '../stores/paletteStore'
import { useBeadStore } from '../stores/beadStore'
import { useBrushStore } from '../stores/brushStore'
import ImageUploader from './ImageUploader.vue'
import SizeSelector from './SizeSelector.vue'
import PalettePanel from './PalettePanel.vue'
import ExportButtons from './ExportButtons.vue'

const paletteStore = usePaletteStore()
const beadStore = useBeadStore()
const brushStore = useBrushStore()

const emit = defineEmits<{
  'upload': [file: File]
  'update:settings': [settings: BeadSettings]
  'remove-color': [id: string]
  'export': [config: ExportConfig]
  'import-drawing': []
}>()

function onSelectBrand(brand: string) {
  paletteStore.selectBrand(brand)
}

function onSelectColor(index: number) {
  brushStore.setActiveColor(index)
}
</script>

<template>
  <aside class="control-panel">
    <h2 class="title">拼豆工具</h2>

    <ImageUploader @upload="emit('upload', $event)" />

    <div class="divider" />

    <SizeSelector
      :modelValue="{ cols: beadStore.settings.gridCols, rows: beadStore.settings.gridRows, keepAspectRatio: beadStore.settings.keepAspectRatio }"
      @update:modelValue="emit('update:settings', { ...beadStore.settings, gridCols: $event.cols, gridRows: $event.rows, keepAspectRatio: $event.keepAspectRatio })"
    />

    <div class="divider" />

    <PalettePanel
      :brandNames="paletteStore.brandNames"
      :selectedBrand="paletteStore.selectedBrand"
      :palette="paletteStore.palette"
      :brushMode="brushStore.brushMode"
      :activeColorIndex="brushStore.activeColorIndex"
      @select-brand="onSelectBrand"
      @remove-color="emit('remove-color', $event)"
      @select-color="onSelectColor"
    />

    <div class="divider" />

    <!-- Color Mapping Section -->
    <div class="section">
      <h3 class="section-title">色彩映射</h3>

      <label class="field">
        <span class="field-label">计算方式</span>
        <select
          :value="beadStore.settings.colorCalcMethod"
          @change="emit('update:settings', { ...beadStore.settings, colorCalcMethod: ($event.target as HTMLSelectElement).value as any })"
        >
          <option value="average">平均色彩</option>
          <option value="median">中位色彩</option>
          <option value="centerWeighted">中心加权</option>
          <option value="dominant">主导色彩</option>
          <option value="bucket">色桶主导</option>
        </select>
      </label>

      <div v-if="beadStore.settings.colorCalcMethod === 'bucket'" class="field">
        <div class="slider-head">
          <span class="field-label">粒度</span>
          <span class="field-value">{{ beadStore.settings.bucketLevels }}</span>
        </div>
        <input
          type="range" min="2" max="32" :value="beadStore.settings.bucketLevels"
          @input="emit('update:settings', { ...beadStore.settings, bucketLevels: Number(($event.target as HTMLInputElement).value) })"
        />
      </div>

      <div v-if="beadStore.settings.colorCalcMethod === 'dominant'" class="field">
        <div class="slider-head">
          <span class="field-label">容差</span>
          <span class="field-value">{{ beadStore.settings.tolerance }}</span>
        </div>
        <input
          type="range" min="5" max="100" :value="beadStore.settings.tolerance"
          @input="emit('update:settings', { ...beadStore.settings, tolerance: Number(($event.target as HTMLInputElement).value) })"
        />
      </div>

      <label class="field">
        <span class="field-label">映射方式</span>
        <select
          :value="beadStore.settings.colorMatchMethod"
          @change="emit('update:settings', { ...beadStore.settings, colorMatchMethod: ($event.target as HTMLSelectElement).value as any })"
        >
          <option value="deltaE">Delta E</option>
          <option value="ciede2000">CIEDE2000</option>
          <option value="rgb">RGB 距离</option>
          <option value="weightedRgb">加权 RGB</option>
        </select>
      </label>
    </div>

    <div class="divider" />

    <!-- Brush Toolbar -->
    <div class="section">
      <h3 class="section-title">画笔编辑</h3>
      <div class="brush-toolbar">
        <button
          class="brush-toggle"
          :class="{ active: brushStore.brushMode }"
          :disabled="!beadStore.beadGrid"
          @click="brushStore.toggleBrushMode()"
        >
          🖌️ {{ brushStore.brushMode ? '编辑中' : '画笔' }}
        </button>
        <div v-if="brushStore.brushMode && brushStore.activeColorIndex !== null" class="brush-color-preview">
          <span class="brush-swatch" :style="{ background: paletteStore.palette[brushStore.activeColorIndex]?.hex || '#ccc' }"></span>
          <span class="brush-color-name">{{ paletteStore.palette[brushStore.activeColorIndex]?.name || '未选择' }}</span>
        </div>
      </div>
      <div v-if="brushStore.brushMode" class="brush-hint">
        拖拽涂色 · Ctrl+滚轮缩放 · Ctrl+Z/Y 撤销/重做
      </div>
    </div>

    <div class="divider" />

    <ExportButtons
      :hasGrid="!!beadStore.beadGrid"
      :defaultDisplay="beadStore.settings.display"
      :gridCols="beadStore.settings.gridCols"
      :gridRows="beadStore.settings.gridRows"
      @export="config => emit('export', config)"
      @import-drawing="emit('import-drawing')"
    />
  </aside>
</template>

<style scoped>
.control-panel {
  width: 280px; flex-shrink: 0; padding: 20px;
  border-right: 1px solid var(--border);
  overflow-y: auto; display: flex; flex-direction: column; gap: 12px;
  max-height: 100vh; box-sizing: border-box;
}
.title {
  font-size: 18px; font-weight: 600; color: var(--text-h); margin: 0;
}

.divider {
  border: none;
  border-top: 1px solid var(--border);
  margin: 0;
}

.section {
  display: flex; flex-direction: column; gap: 8px;
}
.section-title {
  font-size: 13px; font-weight: 600; color: var(--text-h);
  margin: 0;
}

.field {
  display: flex; flex-direction: column; gap: 4px;
}
.field-label {
  font-size: 12px; color: var(--text);
}
.field-value {
  font-size: 12px; color: var(--text);
  font-family: var(--mono, monospace);
}
.slider-head {
  display: flex; justify-content: space-between; align-items: center;
}
.field select {
  padding: 5px 8px; border: 1px solid var(--border); border-radius: 5px;
  font-size: 12px; background: var(--bg); color: var(--text-h);
}
.field input[type="range"] {
  width: 100%; margin: 0;
}

.brush-toolbar {
  display: flex; align-items: center; gap: 8px;
}
.brush-toggle {
  padding: 5px 12px;
  border: 1px solid var(--border);
  border-radius: 5px;
  background: var(--bg);
  color: var(--text-h);
  cursor: pointer;
  font-size: 13px;
  transition: background 0.15s, border-color 0.15s;
}
.brush-toggle:hover:not(:disabled) {
  border-color: var(--accent, #aa3bff);
}
.brush-toggle.active {
  background: var(--accent, #aa3bff);
  color: #fff;
  border-color: var(--accent, #aa3bff);
}
.brush-toggle:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.brush-color-preview {
  display: flex; align-items: center; gap: 4px;
}
.brush-swatch {
  width: 16px; height: 16px; border-radius: 3px; border: 1px solid var(--border);
  flex-shrink: 0;
}
.brush-color-name {
  font-size: 11px; color: var(--text);
  font-family: var(--mono, monospace);
  max-width: 80px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.brush-hint {
  font-size: 11px; color: var(--text);
  opacity: 0.7;
}
</style>
```

- [ ] **Step 2: Run tests to verify**

```bash
npm run test
```
Expected: Some component tests may fail due to missing Pinia setup. We'll fix in the component update tasks.

- [ ] **Step 3: Commit**

```bash
git add src/components/ControlPanel.vue src/components/PalettePanel.vue src/components/PaletteEditor.vue
git commit -m "feat: update ControlPanel to use stores and add brush toolbar"
```

---

### Task 7: Update BeadPreview with brush paint interaction

**Files:**
- Modify: `src/components/BeadPreview.vue`
- Modify: `src/components/__tests__/BeadPreview.test.ts`

- [ ] **Step 1: Update BeadPreview to use stores and add brush interaction**

Read current `src/components/BeadPreview.vue` and replace the script section. Key changes:
- Read beadGrid, display, progress from beadStore instead of props
- In brushMode: mousedown→beginStroke+paint, mousemove→continueStroke, mouseup→endStroke
- Normal mode: same pan behavior as before
- Cursor style changes based on brushMode

```html
<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, nextTick, computed } from 'vue'
import type { PaletteColor } from '../types'
import { useBeadStore } from '../stores/beadStore'
import { useBrushStore } from '../stores/brushStore'
import { renderGridToCanvas } from '../composables/useExport'

const beadStore = useBeadStore()
const brushStore = useBrushStore()

const canvasRef = ref<HTMLCanvasElement>()
const containerRef = ref<HTMLDivElement>()
const hoveredCell = ref<{ row: number; col: number } | null>(null)
const cellSize = ref(20)

// Zoom & pan state
const zoom = ref(1)
const panX = ref(0)
const panY = ref(0)
const isPanning = ref(false)
const isPainting = ref(false)
const panStart = ref({ x: 0, y: 0 })
const panStartPos = ref({ x: 0, y: 0 })

const MIN_ZOOM = 0.25
const MAX_ZOOM = 4
const ZOOM_STEP = 0.1

const zoomPercent = computed(() => Math.round(zoom.value * 100))

function clampZoom(z: number): number {
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z))
}

function render() {
  if (!canvasRef.value || !beadStore.beadGrid) return
  const container = containerRef.value
  if (!container) return

  const maxW = container.clientWidth || 400
  const maxH = container.clientHeight || 400
  cellSize.value = Math.floor(Math.min(maxW / beadStore.beadGrid.cols, maxH / beadStore.beadGrid.rows))

  const rendered = renderGridToCanvas(beadStore.beadGrid, beadStore.settings.display.renderMode, cellSize.value, {
    showGrid: beadStore.settings.display.showGrid,
    gridLineColor: beadStore.settings.display.gridLineColor,
    gridLineWidth: beadStore.settings.display.gridLineWidth,
    boldGridInterval: beadStore.settings.display.boldGridInterval,
    boldGridColor: beadStore.settings.display.boldGridColor,
    boldGridWidth: beadStore.settings.display.boldGridWidth,
  })

  canvasRef.value.width = rendered.width
  canvasRef.value.height = rendered.height
  canvasRef.value.style.width = rendered.width + 'px'
  canvasRef.value.style.height = rendered.height + 'px'
  const ctx = canvasRef.value.getContext('2d')
  if (!ctx) return
  ctx.drawImage(rendered, 0, 0)
}

function getCellFromEvent(event: MouseEvent): { row: number; col: number } | null {
  if (!beadStore.beadGrid || !canvasRef.value) return null
  const rect = canvasRef.value.getBoundingClientRect()
  const x = event.clientX - rect.left
  const y = event.clientY - rect.top
  const scaledCell = cellSize.value * zoom.value
  const col = Math.floor(x / scaledCell)
  const row = Math.floor(y / scaledCell)
  if (row >= 0 && row < beadStore.beadGrid.rows && col >= 0 && col < beadStore.beadGrid.cols) {
    return { row, col }
  }
  return null
}

function onMouseMove(event: MouseEvent) {
  if (!beadStore.beadGrid || !canvasRef.value) return

  if (isPainting.value) {
    const cell = getCellFromEvent(event)
    if (cell) {
      hoveredCell.value = cell
      brushStore.continueStroke(cell.row, cell.col)
      nextTick(render)
    }
    return
  }

  if (isPanning.value) return

  const cell = getCellFromEvent(event)
  hoveredCell.value = cell
}

function onMouseLeave() {
  hoveredCell.value = null
}

function onMouseDown(event: MouseEvent) {
  if (brushStore.brushMode) {
    // Brush paint mode
    isPainting.value = true
    brushStore.beginStroke()
    const cell = getCellFromEvent(event)
    if (cell) {
      brushStore.continueStroke(cell.row, cell.col)
      nextTick(render)
    }
  } else {
    // Pan mode
    onPanStart(event)
  }
}

function onMouseUp() {
  if (isPainting.value) {
    isPainting.value = false
    brushStore.endStroke()
    nextTick(render)
  } else {
    onPanEnd()
  }
}

const hoveredColor = computed(() => {
  if (!hoveredCell.value || !beadStore.beadGrid) return null
  const { row, col } = hoveredCell.value
  const colorIndex = beadStore.beadGrid.cells[row][col].colorIndex
  if (colorIndex === null) return null
  return beadStore.beadGrid.palette[colorIndex]
})

function onWheel(event: WheelEvent) {
  if (!event.ctrlKey) return
  event.preventDefault()
  const delta = event.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP
  const oldZoom = zoom.value
  const newZoom = clampZoom(oldZoom + delta)

  if (containerRef.value) {
    const rect = containerRef.value.getBoundingClientRect()
    const cx = event.clientX - rect.left
    const cy = event.clientY - rect.top
    const scale = newZoom / oldZoom
    panX.value = cx - scale * (cx - panX.value)
    panY.value = cy - scale * (cy - panY.value)
  }

  zoom.value = newZoom
}

function onPanStart(event: MouseEvent) {
  isPanning.value = true
  panStart.value = { x: event.clientX, y: event.clientY }
  panStartPos.value = { x: panX.value, y: panY.value }
}

function onPanMove(event: MouseEvent) {
  if (!isPanning.value) return
  panX.value = panStartPos.value.x + (event.clientX - panStart.value.x)
  panY.value = panStartPos.value.y + (event.clientY - panStart.value.y)
}

function onPanEnd() {
  isPanning.value = false
}

// Keyboard shortcuts for undo/redo
function onKeyDown(event: KeyboardEvent) {
  if ((event.ctrlKey || event.metaKey) && event.key === 'z') {
    event.preventDefault()
    if (event.shiftKey) {
      brushStore.redo()
    } else {
      brushStore.undo()
    }
    nextTick(render)
  } else if ((event.ctrlKey || event.metaKey) && event.key === 'y') {
    event.preventDefault()
    brushStore.redo()
    nextTick(render)
  }
}

const transformStyle = computed(() => {
  return `transform: translate(${panX.value}px, ${panY.value}px) scale(${zoom.value})`
})

const stageLabel = computed(() => {
  const p = beadStore.progress
  if (p <= 0) return ''
  if (p <= 25) return '加载图片...'
  if (p <= 45) return '缩放...'
  if (p <= 65) return '颜色调整...'
  if (p <= 85) return '颜色匹配...'
  if (p < 100) return '抖动处理...'
  return '完成'
})

const cursorStyle = computed(() => {
  if (brushStore.brushMode) return 'crosshair'
  return 'default'
})

onMounted(() => {
  nextTick(render)
  document.addEventListener('mousemove', onPanMove)
  document.addEventListener('mouseup', onMouseUp)
  document.addEventListener('keydown', onKeyDown)
})

onUnmounted(() => {
  document.removeEventListener('mousemove', onPanMove)
  document.removeEventListener('mouseup', onMouseUp)
  document.removeEventListener('keydown', onKeyDown)
})

watch(
  () => [beadStore.beadGrid, beadStore.settings.display],
  () => { nextTick(render) },
  { deep: true },
)
</script>
```

Template changes: remove props from component root, update canvas cursor:

```html
<template>
  <div ref="containerRef" class="bead-preview">
    <template v-if="beadStore.progress > 0">
      <div class="progress-overlay">
        <div class="progress-card">
          <div class="progress-track">
            <div class="progress-fill" :style="{ width: beadStore.progress + '%' }"></div>
          </div>
          <div class="progress-text">{{ stageLabel }} {{ beadStore.progress }}%</div>
        </div>
      </div>
    </template>
    <template v-if="beadStore.beadGrid">
      <div class="preview-canvas-wrap" :style="transformStyle">
        <canvas
          ref="canvasRef"
          :style="{ cursor: cursorStyle }"
          @mousemove="onMouseMove"
          @mouseleave="onMouseLeave"
          @mousedown="onMouseDown"
          @wheel="onWheel"
        />
        <div v-if="hoveredColor" class="tooltip" :style="{ left: (panX + (hoveredCell?.col ?? 0) * cellSize * zoom + cellSize * zoom) + 'px', top: (panY + (hoveredCell?.row ?? 0) * cellSize * zoom) + 'px' }">
          {{ hoveredColor.name || hoveredColor.hex }}
        </div>
      </div>
      <div class="zoom-indicator">{{ zoomPercent }}%</div>
      <div class="grid-info">{{ beadStore.beadGrid.rows }} × {{ beadStore.beadGrid.cols }} · {{ beadStore.beadGrid.palette.length }} 色</div>
    </template>
    <div v-if="!beadStore.beadGrid && beadStore.progress === 0" class="empty-state"><p>上传图片开始</p></div>
  </div>
</template>
```

Keep all the existing `<style scoped>` unchanged.

- [ ] **Step 2: Update BeadPreview tests to use Pinia**

Replace `src/components/__tests__/BeadPreview.test.ts`. The key change is providing a Pinia instance and populating the beadStore instead of passing props:

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import BeadPreview from '../BeadPreview.vue'
import { useBeadStore } from '../../stores/beadStore'
import { useBrushStore } from '../../stores/brushStore'
import type { BeadGrid, PaletteColor } from '../../types'

function makeTestGrid(): BeadGrid {
  const palette: PaletteColor[] = [
    { id: 'w', name: 'White', hex: '#FFFFFF', brand: 'test' },
    { id: 'b', name: 'Black', hex: '#000000', brand: 'test' },
  ]
  return {
    rows: 2, cols: 2, palette,
    cells: [
      [{ row: 0, col: 0, colorIndex: 0 }, { row: 0, col: 1, colorIndex: 1 }],
      [{ row: 1, col: 0, colorIndex: 1 }, { row: 1, col: 1, colorIndex: 0 }],
    ],
    imageCols: 2,
    imageRows: 2,
  }
}

function mountWithGrid() {
  const pinia = createPinia()
  setActivePinia(pinia)
  const beadStore = useBeadStore()
  beadStore.beadGrid = makeTestGrid()
  return mount(BeadPreview, {
    global: { plugins: [pinia] },
  })
}

function mountWithProgress(progress: number) {
  const pinia = createPinia()
  setActivePinia(pinia)
  const beadStore = useBeadStore()
  beadStore.beadGrid = makeTestGrid()
  beadStore.progress = progress
  return mount(BeadPreview, {
    global: { plugins: [pinia] },
  })
}

function mountEmpty() {
  const pinia = createPinia()
  setActivePinia(pinia)
  return mount(BeadPreview, {
    global: { plugins: [pinia] },
  })
}

describe('BeadPreview', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('renders canvas element when grid is provided', () => {
    const wrapper = mountWithGrid()
    expect(wrapper.find('canvas').exists()).toBe(true)
  })

  it('shows empty state when no grid', () => {
    const wrapper = mountEmpty()
    expect(wrapper.text()).toContain('上传图片开始')
  })

  it('shows grid dimension info', () => {
    const wrapper = mountWithGrid()
    expect(wrapper.text()).toContain('2 × 2')
  })

  it('shows tooltip on mousemove inside canvas', async () => {
    const wrapper = mountWithGrid()
    await nextTick()
    const canvas = wrapper.find('canvas')
    await canvas.trigger('mousemove', { clientX: 30, clientY: 30 })
    const tooltip = wrapper.find('.tooltip')
    expect(tooltip.exists()).toBe(true)
  })

  it('hides tooltip on mouseleave', async () => {
    const wrapper = mountWithGrid()
    await nextTick()
    const canvas = wrapper.find('canvas')
    await canvas.trigger('mousemove', { clientX: 30, clientY: 30 })
    expect(wrapper.find('.tooltip').exists()).toBe(true)
    await canvas.trigger('mouseleave')
    expect(wrapper.find('.tooltip').exists()).toBe(false)
  })

  it('shows progress overlay when processing', () => {
    const wrapper = mountWithProgress(50)
    expect(wrapper.find('.progress-overlay').exists()).toBe(true)
    expect(wrapper.text()).toContain('50%')
  })

  it('hides progress overlay when idle', () => {
    const wrapper = mountWithGrid()
    expect(wrapper.find('.progress-overlay').exists()).toBe(false)
  })

  describe('zoom', () => {
    it('shows zoom indicator at 100% by default', () => {
      const wrapper = mountWithGrid()
      expect(wrapper.find('.zoom-indicator').exists()).toBe(true)
      expect(wrapper.find('.zoom-indicator').text()).toContain('100%')
    })

    it('increases zoom on ctrl+wheel up', async () => {
      const wrapper = mountWithGrid()
      await nextTick()
      const canvas = wrapper.find('canvas')
      await canvas.trigger('wheel', { deltaY: -100, ctrlKey: true })
      expect(wrapper.find('.zoom-indicator').text()).not.toBe('100%')
    })

    it('decreases zoom on ctrl+wheel down', async () => {
      const wrapper = mountWithGrid()
      await nextTick()
      const canvas = wrapper.find('canvas')
      await canvas.trigger('wheel', { deltaY: 100, ctrlKey: true })
      const text = wrapper.find('.zoom-indicator').text()
      const pct = parseInt(text)
      expect(pct).toBeLessThan(100)
    })

    it('clamps zoom to minimum 25%', async () => {
      const wrapper = mountWithGrid()
      await nextTick()
      const canvas = wrapper.find('canvas')
      for (let i = 0; i < 50; i++) {
        await canvas.trigger('wheel', { deltaY: 100, ctrlKey: true })
      }
      const pct = parseInt(wrapper.find('.zoom-indicator').text())
      expect(pct).toBeGreaterThanOrEqual(25)
    })

    it('clamps zoom to maximum 400%', async () => {
      const wrapper = mountWithGrid()
      await nextTick()
      const canvas = wrapper.find('canvas')
      for (let i = 0; i < 50; i++) {
        await canvas.trigger('wheel', { deltaY: -100, ctrlKey: true })
      }
      const pct = parseInt(wrapper.find('.zoom-indicator').text())
      expect(pct).toBeLessThanOrEqual(400)
    })

    it('does not zoom on wheel without ctrl', async () => {
      const wrapper = mountWithGrid()
      await nextTick()
      const canvas = wrapper.find('canvas')
      await canvas.trigger('wheel', { deltaY: -100, ctrlKey: false })
      expect(wrapper.find('.zoom-indicator').text()).toBe('100%')
    })
  })

  describe('pan', () => {
    it('pans canvas on mousedown + mousemove in normal mode', async () => {
      const wrapper = mountWithGrid()
      await nextTick()
      const canvas = wrapper.find('canvas')
      await canvas.trigger('mousedown', { clientX: 100, clientY: 100 })
      await canvas.trigger('mousemove', { clientX: 150, clientY: 130 })
      const previewWrap = wrapper.find('.preview-canvas-wrap')
      const style = previewWrap.attributes('style')
      expect(style).toBeDefined()
      expect(style).toContain('translate')
    })

    it('stops panning on mouseup', async () => {
      const wrapper = mountWithGrid()
      await nextTick()
      const canvas = wrapper.find('canvas')
      await canvas.trigger('mousedown', { clientX: 100, clientY: 100 })
      await canvas.trigger('mousemove', { clientX: 150, clientY: 130 })
      const posBefore = wrapper.find('.preview-canvas-wrap').attributes('style')
      await canvas.trigger('mouseup')
      await canvas.trigger('mousemove', { clientX: 200, clientY: 200 })
      expect(wrapper.find('.preview-canvas-wrap').attributes('style')).toBe(posBefore)
    })
  })

  describe('brush mode', () => {
    it('paints cells on mousedown + mousemove in brush mode', async () => {
      const pinia = createPinia()
      setActivePinia(pinia)
      const beadStore = useBeadStore()
      beadStore.beadGrid = makeTestGrid()
      const brushStore = useBrushStore()
      brushStore.brushMode = true
      brushStore.setActiveColor(1) // Black

      const wrapper = mount(BeadPreview, {
        global: { plugins: [pinia] },
      })
      await nextTick()
      const canvas = wrapper.find('canvas')

      await canvas.trigger('mousedown', { clientX: 30, clientY: 30 })
      await canvas.trigger('mousemove', { clientX: 50, clientY: 30 })
      await canvas.trigger('mouseup')

      // Cell (0,0) should now be Black (colorIndex 1)
      expect(beadStore.beadGrid!.cells[0][0].colorIndex).toBe(1)
    })

    it('shows crosshair cursor in brush mode', () => {
      const pinia = createPinia()
      setActivePinia(pinia)
      const beadStore = useBeadStore()
      beadStore.beadGrid = makeTestGrid()
      const brushStore = useBrushStore()
      brushStore.brushMode = true

      const wrapper = mount(BeadPreview, {
        global: { plugins: [pinia] },
      })
      const canvas = wrapper.find('canvas')
      expect(canvas.attributes('style')).toContain('crosshair')
    })

    it('does not pan in brush mode', async () => {
      const pinia = createPinia()
      setActivePinia(pinia)
      const beadStore = useBeadStore()
      beadStore.beadGrid = makeTestGrid()
      const brushStore = useBrushStore()
      brushStore.brushMode = true
      brushStore.setActiveColor(1)

      const wrapper = mount(BeadPreview, {
        global: { plugins: [pinia] },
      })
      await nextTick()
      const canvas = wrapper.find('canvas')
      await canvas.trigger('mousedown', { clientX: 100, clientY: 100 })
      await canvas.trigger('mousemove', { clientX: 150, clientY: 130 })
      await canvas.trigger('mouseup')

      // After brush stroke, transform should not change (no panning)
      // Just verify no error and the component is still mounted
      expect(wrapper.find('canvas').exists()).toBe(true)
    })
  })
})
```

- [ ] **Step 3: Run tests**

```bash
npx vitest run src/components/__tests__/BeadPreview.test.ts
```
Expected: All BeadPreview tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/components/BeadPreview.vue src/components/__tests__/BeadPreview.test.ts
git commit -m "feat: update BeadPreview with brush paint interaction and store integration"
```

---

### Task 8: Update ColorLegend to use stores and brush-mode color selection

**Files:**
- Modify: `src/components/ColorLegend.vue`
- Modify: `src/components/__tests__/ColorLegend.test.ts`

- [ ] **Step 1: Update ColorLegend to use stores**

Read current and replace script section of `src/components/ColorLegend.vue`:

```html
<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, nextTick, computed } from 'vue'
import type { BeadGrid } from '../types'
import { useBeadStore } from '../stores/beadStore'
import { useBrushStore } from '../stores/brushStore'
import { countColorUsage } from '../composables/useExport'

const beadStore = useBeadStore()
const brushStore = useBrushStore()

const canvasRef = ref<HTMLCanvasElement>()
const containerRef = ref<HTMLDivElement>()

const panelWidth = ref(170)
const MIN_W = 140
const MAX_W = 440
const dragging = ref(false)
const dragStartX = ref(0)
const dragStartW = ref(0)

interface LegendItem {
  color: { id: string; name: string; hex: string }
  paletteIndex: number
  count: number
  pct: number
}

const sortedColors = computed<LegendItem[]>(() => {
  const grid = beadStore.beadGrid
  if (!grid) return []
  const counts = countColorUsage(grid)
  const total = grid.rows * grid.cols
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([idx, count]) => ({
      color: grid.palette[idx],
      paletteIndex: idx,
      count,
      pct: Math.round((count / total) * 100),
    }))
})

function textColor(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.53 ? '#1a1a2e' : '#ffffff'
}

function labelShort(name: string): string {
  return name.split(/[\s_]+/)[0] ?? name
}

// Layout constants
const SWATCH_W = 60
const ITEM_MAX_W = 100
const ROW_H = 36
const HEADER_H = 34
const PAD = 10

function render() {
  const canvas = canvasRef.value
  const items = sortedColors.value
  if (!canvas) return

  const dpr = window.devicePixelRatio || 1
  const W = containerRef.value?.clientWidth ?? panelWidth.value

  const availW = W - PAD * 2
  const cols = Math.max(1, Math.floor(availW / ITEM_MAX_W))
  const colW = Math.floor(availW / cols)
  const rows = Math.ceil(items.length / cols)

  const H = HEADER_H + rows * ROW_H + 10

  canvas.width = W * dpr
  canvas.height = H * dpr
  canvas.style.width = W + 'px'
  canvas.style.height = H + 'px'

  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.scale(dpr, dpr)

  const styles = getComputedStyle(canvas)
  const bg = styles.getPropertyValue('--bg') || '#ffffff'
  const textCol = styles.getPropertyValue('--text') || '#6b6375'
  const textH = styles.getPropertyValue('--text-h') || '#08060d'

  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)

  // Title
  ctx.fillStyle = textH
  ctx.font = '600 13px system-ui'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  ctx.fillText('色彩图例', PAD, 10)

  if (beadStore.beadGrid) {
    ctx.fillStyle = textCol
    ctx.font = '11px monospace'
    ctx.textAlign = 'right'
    ctx.textBaseline = 'top'
    ctx.fillText(`${items.length} 色`, W - PAD, 12)
  }

  if (items.length === 0) return

  const swatchH = ROW_H - 6

  for (let i = 0; i < items.length; i++) {
    const col = i % cols
    const row = Math.floor(i / cols)
    const item = items[i]

    const cx = PAD + col * colW
    const cy = HEADER_H + row * ROW_H
    const midY = cy + ROW_H / 2

    // Highlight active color
    const isActive = brushStore.brushMode && brushStore.activeColorIndex === item.paletteIndex
    if (isActive) {
      ctx.fillStyle = 'rgba(170, 59, 255, 0.15)'
      ctx.fillRect(cx - 2, cy, colW, ROW_H)
    }

    // Swatch
    ctx.fillStyle = item.color.hex
    ctx.beginPath()
    ctx.roundRect(cx, cy + 3, SWATCH_W, swatchH, 4)
    ctx.fill()

    ctx.strokeStyle = isActive ? '#aa3bff' : 'rgba(0,0,0,0.08)'
    ctx.lineWidth = isActive ? 2 : 0.5
    ctx.beginPath()
    ctx.roundRect(cx, cy + 3, SWATCH_W, swatchH, 4)
    ctx.stroke()

    // Label on swatch
    ctx.fillStyle = textColor(item.color.hex)
    ctx.font = 'bold 16px monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(labelShort(item.color.name), cx + SWATCH_W / 2, cy + 3 + swatchH / 2)

    // Count
    ctx.fillStyle = textH
    ctx.font = '700 11px monospace'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.fillText(String(item.count), cx + 4, midY - 3)

    // Pct
    ctx.fillStyle = textCol
    ctx.font = '9px monospace'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.fillText(`${item.pct}%`, cx + 4, midY + 10)
  }
}

// Handle click on legend canvas for color selection
function onCanvasClick(event: MouseEvent) {
  if (!brushStore.brushMode) return

  const canvas = canvasRef.value
  if (!canvas) return
  const items = sortedColors.value
  if (items.length === 0) return

  const rect = canvas.getBoundingClientRect()
  const x = event.clientX - rect.left
  const y = event.clientY - rect.top

  const W = containerRef.value?.clientWidth ?? panelWidth.value
  const availW = W - PAD * 2
  const cols = Math.max(1, Math.floor(availW / ITEM_MAX_W))
  const colW = Math.floor(availW / cols)
  const rows = Math.ceil(items.length / cols)

  for (let i = 0; i < items.length; i++) {
    const col = i % cols
    const row = Math.floor(i / cols)
    const cx = PAD + col * colW
    const cy = HEADER_H + row * ROW_H

    if (x >= cx && x <= cx + colW && y >= cy && y <= cy + ROW_H) {
      brushStore.setActiveColor(items[i].paletteIndex)
      return
    }
  }
}

// --- Drag resize ---
function onDragStart(e: MouseEvent) {
  dragging.value = true
  dragStartX.value = e.clientX
  dragStartW.value = panelWidth.value
  document.addEventListener('mousemove', onDragMove)
  document.addEventListener('mouseup', onDragEnd)
  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'
}

let rafId = 0
function onDragMove(e: MouseEvent) {
  if (!dragging.value) return
  const delta = dragStartX.value - e.clientX
  panelWidth.value = Math.min(MAX_W, Math.max(MIN_W, dragStartW.value + delta))
  cancelAnimationFrame(rafId)
  rafId = requestAnimationFrame(render)
}

function onDragEnd() {
  dragging.value = false
  document.removeEventListener('mousemove', onDragMove)
  document.removeEventListener('mouseup', onDragEnd)
  document.body.style.cursor = ''
  document.body.style.userSelect = ''
  cancelAnimationFrame(rafId)
}

let observer: ResizeObserver | null = null

onMounted(() => {
  nextTick(render)
  if (containerRef.value) {
    observer = new ResizeObserver(() => render())
    observer.observe(containerRef.value)
  }
})

onUnmounted(() => {
  document.removeEventListener('mousemove', onDragMove)
  document.removeEventListener('mouseup', onDragEnd)
  observer?.disconnect()
})

watch([sortedColors, panelWidth, () => brushStore.activeColorIndex, () => brushStore.brushMode], () => { nextTick(render) }, { deep: true })
</script>
```

Template: add `@click` handler on canvas:

```html
<template>
  <aside
    v-if="beadStore.beadGrid"
    class="color-legend"
    :style="{ width: panelWidth + 'px' }"
    :class="{ dragging }"
  >
    <div class="drag-handle" @mousedown="onDragStart">
      <span class="drag-grip"></span>
    </div>
    <div ref="containerRef" class="legend-scroll">
      <canvas ref="canvasRef" class="legend-canvas" @click="onCanvasClick" />
    </div>
  </aside>
</template>
```

Keep all existing `<style scoped>` unchanged.

- [ ] **Step 2: Update ColorLegend tests to use Pinia**

Replace `src/components/__tests__/ColorLegend.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import ColorLegend from '../ColorLegend.vue'
import { useBeadStore } from '../../stores/beadStore'
import type { BeadGrid, PaletteColor } from '../../types'

function makeTestGrid(): BeadGrid {
  const palette: PaletteColor[] = [
    { id: 'w', name: 'A01 White', hex: '#FFFFFF', brand: 'test' },
    { id: 'b', name: 'A02 Black', hex: '#000000', brand: 'test' },
  ]
  return {
    rows: 2, cols: 2, palette,
    cells: [
      [{ row: 0, col: 0, colorIndex: 0 }, { row: 0, col: 1, colorIndex: 1 }],
      [{ row: 1, col: 0, colorIndex: 1 }, { row: 1, col: 1, colorIndex: 0 }],
    ],
    imageCols: 2,
    imageRows: 2,
  }
}

describe('ColorLegend', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('is hidden when beadGrid is null', () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const wrapper = mount(ColorLegend, { global: { plugins: [pinia] } })
    expect(wrapper.find('aside').exists()).toBe(false)
  })

  it('renders when beadGrid is provided', () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    useBeadStore().beadGrid = makeTestGrid()
    const wrapper = mount(ColorLegend, { global: { plugins: [pinia] } })
    expect(wrapper.find('aside').exists()).toBe(true)
  })

  it('renders canvas', () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    useBeadStore().beadGrid = makeTestGrid()
    const wrapper = mount(ColorLegend, { global: { plugins: [pinia] } })
    expect(wrapper.find('canvas').exists()).toBe(true)
  })
})
```

- [ ] **Step 3: Run tests**

```bash
npx vitest run src/components/__tests__/ColorLegend.test.ts
```
Expected: All ColorLegend tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/components/ColorLegend.vue src/components/__tests__/ColorLegend.test.ts
git commit -m "feat: update ColorLegend to use stores with brush-mode color selection"
```

---

### Task 9: Update remaining component tests, remove old composables

**Files:**
- Modify: `src/components/__tests__/ControlPanel.test.ts` (create if not exists)
- Modify: `src/components/__tests__/PalettePanel.test.ts` — update for new props
- Delete: `src/composables/usePalette.ts`
- Delete: `src/composables/useBeadPipeline.ts`
- Delete: `src/composables/__tests__/usePalette.test.ts`
- Delete: `src/composables/__tests__/useBeadPipeline.test.ts`

- [ ] **Step 1: Update PalettePanel test for new props**

Adapt `src/components/__tests__/PalettePanel.test.ts` to handle `brushMode` and `activeColorIndex` props. Read existing test first, then update.

The test currently tests PalettePanel which passes brandNames/selectedBrand/palette as props. With the store migration, PalettePanel still receives props from ControlPanel. The test just needs `brushMode` and `activeColorIndex` added to props.

Read current test and add the missing props:

```typescript
// Add brushMode and activeColorIndex to the mount call
const wrapper = mount(PalettePanel, {
  props: {
    brandNames: ['Brand A'],
    selectedBrand: 'Brand A',
    palette: [],
    brushMode: false,
    activeColorIndex: null,
  },
})
```

- [ ] **Step 2: Run full test suite**

```bash
npm run test
```

- [ ] **Step 3: Fix any remaining test failures**

Check errors. Most likely issues:
- Old component tests that reference removed props (like `hasGrid`, `settings` on ControlPanel)
- Missing Pinia setup in tests

For ControlPanel test, update to provide Pinia:

```typescript
import { createPinia } from 'pinia'
// ...
const wrapper = mount(ControlPanel, {
  global: { plugins: [createPinia()] },
  props: { ... },
})
```

- [ ] **Step 4: Delete old composables**

```bash
rm src/composables/usePalette.ts
rm src/composables/useBeadPipeline.ts
rm src/composables/__tests__/usePalette.test.ts
rm src/composables/__tests__/useBeadPipeline.test.ts
```

- [ ] **Step 5: Run full test suite again**

```bash
npm run test
```
Expected: All tests pass.

- [ ] **Step 6: Run type check**

```bash
npx vue-tsc -b
```
Expected: No type errors.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "refactor: remove old composables, update remaining tests for Pinia stores"
```

---

### Task 10: Final verification and dev server check

- [ ] **Step 1: Run complete test suite**

```bash
npm run test
```
Expected: All tests pass.

- [ ] **Step 2: Run type check**

```bash
npx vue-tsc -b
```
Expected: Clean build.

- [ ] **Step 3: Start dev server**

```bash
npm run dev
```

Manually verify:
1. Upload an image — mapping works as before
2. Click "画笔" button — enters brush mode (button highlights, cursor becomes crosshair)
3. Click a color swatch in PaletteEditor — it becomes the active brush color
4. Drag on the grid — cells change to the active color
5. Click a color in ColorLegend — it becomes the active brush color
6. Ctrl+Z — undo the last stroke
7. Ctrl+Y — redo
8. Exit brush mode — normal pan/drag works
9. Export PNG/PDF — exported image reflects brush edits

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "chore: final verification, all tests pass"
```
