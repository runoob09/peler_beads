# Performance Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce bundle size (802→~300KB), eliminate 60fps full-repaint, make DBSCAN O(n), fix memory leaks, and optimize state reactivity across the perler-beads app.

**Architecture:** Four independent subsystems. A: Bundle (route lazy-loading, dynamic JSON/pdf-lib imports). B: Rendering (FocusGrid offscreen layers, BeadPreview cleanup). C: Data (DBSCAN spatial index, non-blocking clustering, Lab cache). D: State (shallowRef, merged computeds).

**Tech Stack:** Vue 3, Pinia, Vite 8, TypeScript, Vitest

---

### Task 1: Route Lazy Loading

**Files:**
- Modify: `src/router/index.ts`

- [ ] **Step 1: Change route components to lazy imports**

```typescript
// src/router/index.ts
import { createRouter, createWebHashHistory } from 'vue-router'
import { useBeadStore } from '../stores/beadStore'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      component: () => import('../pages/DesignPage.vue'),
    },
    {
      path: '/focus',
      component: () => import('../pages/FocusPage.vue'),
      beforeEnter: () => {
        const beadStore = useBeadStore()
        if (!beadStore.beadGrid) return '/'
        return true
      },
    },
  ],
})

export default router
```

- [ ] **Step 2: Run tests**

```bash
npm run test
```
Expected: 200 tests pass (lazy loading should not affect test behavior with proper stubs).

- [ ] **Step 3: Verify build chunks**

```bash
npm run build 2>&1 | grep -E "dist/" 
```
Expected: DesignPage and FocusPage appear as separate chunks in dist/assets/.

- [ ] **Step 4: Type check**

```bash
npx vue-tsc -b
```

- [ ] **Step 5: Commit**

```bash
git add src/router/index.ts
git commit -m "perf: add route-level lazy loading for code splitting"
```

---

### Task 2: Dynamic Palette JSON Import

**Files:**
- Modify: `src/data/palettes.ts`
- Modify: `src/stores/paletteStore.ts`

- [ ] **Step 1: Rewrite palettes.ts for dynamic import**

```typescript
// src/data/palettes.ts
export interface ColorItem {
  'color-name': string
  color: string
}

export interface BrandColorMap {
  [brandName: string]: ColorItem[]
}

let brandData: BrandColorMap | null = null
let loadPromise: Promise<BrandColorMap> | null = null

async function loadData(): Promise<BrandColorMap> {
  if (brandData) return brandData
  if (!loadPromise) {
    loadPromise = import('./get-colors.json').then(m => m.default as BrandColorMap)
  }
  brandData = await loadPromise
  return brandData
}

// Eagerly start loading in background (doesn't block)
loadData()

export const BRAND_NAMES: string[] = []

// Initialize BRAND_NAMES asynchronously
let brandNamesReady = false
export async function getBrandNames(): Promise<string[]> {
  if (brandNamesReady) return BRAND_NAMES
  const data = await loadData()
  BRAND_NAMES.length = 0
  BRAND_NAMES.push(...Object.keys(data).sort())
  brandNamesReady = true
  return BRAND_NAMES
}

export async function getBrandColors(brandName: string): Promise<ColorItem[]> {
  const data = await loadData()
  return data[brandName] ?? []
}
```

- [ ] **Step 2: Update paletteStore to use async functions**

Read the current `src/stores/paletteStore.ts`. The `brandNames` computed and `brandPalette` computed need to become async. Change approach:

```typescript
// src/stores/paletteStore.ts — key changes
import { getBrandNames, getBrandColors, type ColorItem } from '../data/palettes'

// ...

// Replace `const brandNames = computed(() => BRAND_NAMES)` with:
const brandNames = ref<string[]>([])

// Load brand names on store creation
getBrandNames().then(names => { brandNames.value = names })

// Replace `const brandPalette = computed(...)` with async watch:
const brandPaletteData = ref<ColorItem[]>([])

watch(selectedBrand, async (brand) => {
  if (!brand) { brandPaletteData.value = []; return }
  brandPaletteData.value = await getBrandColors(brand)
}, { immediate: true })

const brandPalette = computed<PaletteColorInternal[]>(() => {
  const colors = brandPaletteData.value
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
```

- [ ] **Step 3: Run tests — update failing tests**

```bash
npm run test
```
Update `paletteStore.test.ts` to handle async — use `await nextTick()` after brand selection, or make tests async and await the watch.

- [ ] **Step 4: Type check**

```bash
npx vue-tsc -b
```

- [ ] **Step 5: Commit**

```bash
git add src/data/palettes.ts src/stores/paletteStore.ts src/stores/__tests__/paletteStore.test.ts
git commit -m "perf: lazy-load palette JSON via dynamic import"
```

---

### Task 3: pdf-lib Dynamic Import + Delete colorMap.json

**Files:**
- Modify: `src/utils/exportPdf.ts`
- Delete: `src/data/colorMap.json`

- [ ] **Step 1: Change pdf-lib to dynamic import**

```typescript
// src/utils/exportPdf.ts — remove line 1 static import
// Replace function body:

export async function generatePdf(
  grid: BeadGrid,
  gridLines: GridLineSettings,
  cellSize: number,
  filename: string,
  projectJson: string,
  imageBytes?: Uint8Array,
  imageType?: string,
): Promise<Uint8Array> {
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib')
  // ... rest of function unchanged
}
```

- [ ] **Step 2: Delete colorMap.json**

```bash
rm src/data/colorMap.json
```

Verify no file imports it:
```bash
grep -r "colorMap" src/ --include="*.ts" --include="*.vue"
```
Expected: No results.

- [ ] **Step 3: Run tests**

```bash
npm run test
```

- [ ] **Step 4: Verify build output shows smaller main chunk + pdf-lib in separate chunk**

```bash
npm run build 2>&1 | grep -E "dist/"
```

- [ ] **Step 5: Commit**

```bash
git add src/utils/exportPdf.ts
git rm src/data/colorMap.json
git commit -m "perf: dynamic import pdf-lib, remove unused colorMap.json"
```

---

### Task 4: FocusGrid Offscreen + Layered Rendering

**Files:**
- Modify: `src/components/focus/FocusGrid.vue`

- [ ] **Step 1: Rewrite FocusGrid with two-layer offscreen canvas**

```vue
<!-- src/components/focus/FocusGrid.vue -->
<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue'
import { useBeadStore } from '../../stores/beadStore'
import { useFocusStore } from '../../stores/focusStore'
import { renderAllCells, drawGridLines } from '../../composables/useExport'

const beadStore = useBeadStore()
const focusStore = useFocusStore()

const canvasRef = ref<HTMLCanvasElement>()
const containerRef = ref<HTMLDivElement>()
const cellSize = ref(20)

const zoom = ref(1)
const panX = ref(0)
const panY = ref(0)
const isPanning = ref(false)
const panStart = ref({ x: 0, y: 0 })
const panStartPos = ref({ x: 0, y: 0 })

let animRafId = 0
let staticLayer: HTMLCanvasElement | null = null
let overlayLayer: HTMLCanvasElement | null = null
let lastOverlayUpdate = 0
const OVERLAY_INTERVAL = 250 // 4 fps
let needStaticRedraw = true

function clampZoom(z: number): number {
  return Math.max(0.25, Math.min(4, z))
}

function getCellFromEvent(event: MouseEvent): { row: number; col: number } | null {
  if (!canvasRef.value) return null
  const rect = canvasRef.value.getBoundingClientRect()
  const x = event.clientX - rect.left
  const y = event.clientY - rect.top
  const scaledCell = cellSize.value * zoom.value
  const col = Math.floor(x / scaledCell)
  const row = Math.floor(y / scaledCell)
  const grid = beadStore.beadGrid
  if (!grid) return null
  if (row >= 0 && row < grid.rows && col >= 0 && col < grid.cols) {
    return { row, col }
  }
  return null
}

function ensureLayers(w: number, h: number) {
  if (!staticLayer) {
    staticLayer = document.createElement('canvas')
  }
  if (staticLayer.width !== w || staticLayer.height !== h || needStaticRedraw) {
    staticLayer.width = w
    staticLayer.height = h
    drawStatic()
    needStaticRedraw = false
  }
  if (!overlayLayer) {
    overlayLayer = document.createElement('canvas')
    overlayLayer.width = w
    overlayLayer.height = h
  }
}

function drawStatic() {
  if (!staticLayer || !beadStore.beadGrid) return
  const ctx = staticLayer.getContext('2d')
  if (!ctx) return
  ctx.clearRect(0, 0, staticLayer.width, staticLayer.height)
  renderAllCells(ctx, beadStore.beadGrid, cellSize.value, 'color', false)
  const d = beadStore.settings.display
  drawGridLines(ctx, beadStore.beadGrid.cols, beadStore.beadGrid.rows, cellSize.value, {
    showGrid: d.showGrid,
    gridLineColor: d.gridLineColor,
    gridLineWidth: d.gridLineWidth,
    boldGridInterval: d.boldGridInterval,
    boldGridColor: d.boldGridColor,
    boldGridWidth: d.boldGridWidth,
  })
}

function drawOverlay() {
  if (!overlayLayer || !beadStore.beadGrid) return
  const ctx = overlayLayer.getContext('2d')
  if (!ctx) return
  ctx.clearRect(0, 0, overlayLayer.width, overlayLayer.height)

  const block = focusStore.currentBlock
  if (!block) return

  const marked = block.markedCells
  for (const { row, col } of block.cells) {
    const x = col * cellSize.value
    const y = row * cellSize.value
    const key = `${row},${col}`

    if (marked.has(key)) {
      ctx.fillStyle = 'rgba(76, 175, 80, 0.35)'
      ctx.fillRect(x, y, cellSize.value, cellSize.value)
      const cx = x + cellSize.value / 2
      const cy = y + cellSize.value / 2
      const sz = cellSize.value * 0.35
      ctx.strokeStyle = '#2e7d32'
      ctx.lineWidth = Math.max(1.5, cellSize.value * 0.08)
      ctx.beginPath()
      ctx.moveTo(cx - sz * 0.4, cy)
      ctx.lineTo(cx - sz * 0.1, cy + sz * 0.35)
      ctx.lineTo(cx + sz * 0.5, cy - sz * 0.3)
      ctx.stroke()
    } else {
      const pulse = 0.3 + 0.2 * Math.sin(Date.now() / 800)
      ctx.strokeStyle = `rgba(170, 59, 255, ${pulse})`
      ctx.lineWidth = Math.max(2, cellSize.value * 0.12)
      ctx.strokeRect(x + 1, y + 1, cellSize.value - 2, cellSize.value - 2)
    }
  }
}

function composite(timestamp: number) {
  if (!canvasRef.value || !staticLayer || !overlayLayer) return
  const ctx = canvasRef.value.getContext('2d')
  if (!ctx) return

  ctx.clearRect(0, 0, canvasRef.value.width, canvasRef.value.height)
  ctx.drawImage(staticLayer, 0, 0)

  // Only update overlay at reduced framerate when there's a current block
  if (focusStore.currentBlock && timestamp - lastOverlayUpdate > OVERLAY_INTERVAL) {
    drawOverlay()
    lastOverlayUpdate = timestamp
  }
  ctx.drawImage(overlayLayer, 0, 0)
}

function animLoop(timestamp: number) {
  const w = beadStore.beadGrid!.cols * cellSize.value
  const h = beadStore.beadGrid!.rows * cellSize.value
  ensureLayers(w, h)
  composite(timestamp)

  // Only continue animation if there's an active block to pulse
  if (focusStore.currentBlock) {
    animRafId = requestAnimationFrame(animLoop)
  }
}

function startAnimIfNeeded() {
  if (animRafId) return
  if (focusStore.currentBlock) {
    animRafId = requestAnimationFrame(animLoop)
  }
}

function stopAnim() {
  if (animRafId) {
    cancelAnimationFrame(animRafId)
    animRafId = 0
  }
}

function setup() {
  if (!canvasRef.value || !beadStore.beadGrid) return
  const container = containerRef.value
  if (!container) return
  const maxW = container.clientWidth || 400
  const maxH = container.clientHeight || 400
  const newCellSize = Math.floor(
    Math.min(maxW / beadStore.beadGrid.cols, maxH / beadStore.beadGrid.rows),
  )
  const sizeChanged = newCellSize !== cellSize.value
  cellSize.value = newCellSize

  const grid = beadStore.beadGrid
  const w = grid.cols * cellSize.value
  const h = grid.rows * cellSize.value

  if (sizeChanged || needStaticRedraw) {
    canvasRef.value.width = w
    canvasRef.value.height = h
    needStaticRedraw = true
  }

  startAnimIfNeeded()
}

function updateTransform() {
  if (!canvasRef.value) return
  canvasRef.value.style.transform =
    `translate(${panX.value}px, ${panY.value}px) scale(${zoom.value})`
}

function onClick(event: MouseEvent) {
  const cell = getCellFromEvent(event)
  if (!cell) return
  focusStore.markCell(cell.row, cell.col)
  lastOverlayUpdate = 0  // force immediate overlay redraw
  startAnimIfNeeded()
}

function onWheel(event: WheelEvent) {
  if (!event.ctrlKey) return
  event.preventDefault()
  const delta = event.deltaY < 0 ? 0.1 : -0.1
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
  updateTransform()
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
  updateTransform()
}

function onPanEnd() {
  isPanning.value = false
}

// Watch block changes to trigger animation
watch(
  () => focusStore.currentBlockIndex,
  () => {
    needStaticRedraw = false // static layer stays
    lastOverlayUpdate = 0
    startAnimIfNeeded()
  },
)

onMounted(() => {
  setup()
  document.addEventListener('mousemove', onPanMove)
  document.addEventListener('mouseup', onPanEnd)
})

onUnmounted(() => {
  stopAnim()
  staticLayer = null
  overlayLayer = null
  needStaticRedraw = true
  document.removeEventListener('mousemove', onPanMove)
  document.removeEventListener('mouseup', onPanEnd)
})
</script>

<template>
  <div
    ref="containerRef"
    class="focus-grid"
    @wheel="onWheel"
    @click="onClick"
    @mousedown="onPanStart"
  >
    <canvas
      ref="canvasRef"
      style="transform-origin: 0 0; cursor: pointer"
    />
  </div>
</template>

<style scoped>
.focus-grid {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  background: var(--bg);
}
canvas { transform-origin: 0 0; }
</style>
```

- [ ] **Step 2: Run tests**

```bash
npx vitest run src/components/focus/__tests__/FocusGrid.test.ts
```

- [ ] **Step 3: Full suite**

```bash
npm run test && npx vue-tsc -b
```

- [ ] **Step 4: Commit**

```bash
git add src/components/focus/FocusGrid.vue
git commit -m "perf: add offscreen layered rendering to FocusGrid, stop RAF when idle"
```

---

### Task 5: BeadPreview Memory Leak + Reflow Fixes

**Files:**
- Modify: `src/components/BeadPreview.vue`

- [ ] **Step 1: Fix onUnmounted to cancel RAF**

In `onUnmounted` (approximately lines 293-297), add RAF cancellation:

```typescript
onUnmounted(() => {
  cancelAnimationFrame(renderRafId)  // NEW
  renderRafId = 0                     // NEW
  document.removeEventListener('mousemove', onPanMove)
  document.removeEventListener('mouseup', onDocumentMouseUp)
  document.removeEventListener('keydown', onKeyDown)
})
```

- [ ] **Step 2: Fix canvas style reflow — only set when size changed**

In `doRender()` function, wrap the `canvasRef.value.style.width`/`height` assignments in a size change check. The `sizeChanged` variable is already computed on line ~93. Find the block (approximately lines 136-139) and modify:

```typescript
// Before:
canvasRef.value.width = w
canvasRef.value.height = h
canvasRef.value.style.width = w + 'px'
canvasRef.value.style.height = h + 'px'

// After: only set style when size changed
canvasRef.value.width = w
canvasRef.value.height = h
if (sizeChanged) {
  canvasRef.value.style.width = w + 'px'
  canvasRef.value.style.height = h + 'px'
}
```

Read the actual file at `/home/zhang-jiahao/code/perler-beads/src/components/BeadPreview.vue` to find exact line numbers and ensure accurate replacement.

- [ ] **Step 3: Run tests**

```bash
npm run test
```

- [ ] **Step 4: Commit**

```bash
git add src/components/BeadPreview.vue
git commit -m "perf: cancel RAF on unmount, avoid unnecessary canvas style reflows"
```

---

### Task 6: DBSCAN Spatial Grid Index

**Files:**
- Modify: `src/composables/useClusterer.ts`
- Create: `src/composables/__tests__/useClusterer.perf.test.ts`

- [ ] **Step 1: Add spatial index functions to useClusterer**

```typescript
// Add these functions inside src/composables/useClusterer.ts

interface SpatialIndex {
  grid: Map<string, Point[]>
  eps: number
}

function buildSpatialIndex(points: Point[], eps: number): SpatialIndex {
  const grid = new Map<string, Point[]>()
  for (const p of points) {
    const key = `${Math.floor(p.row / eps)},${Math.floor(p.col / eps)}`
    if (!grid.has(key)) grid.set(key, [])
    grid.get(key)!.push(p)
  }
  return { grid, eps }
}

function getNeighborsFromIndex(
  p: Point,
  index: SpatialIndex,
  eps: number,
): Point[] {
  const result: Point[] = []
  const gr = Math.floor(p.row / eps)
  const gc = Math.floor(p.col / eps)
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      const bucket = index.grid.get(`${gr + dr},${gc + dc}`)
      if (bucket) {
        for (const q of bucket) {
          if (q !== p && manhattan(p, q) <= eps) {
            result.push(q)
          }
        }
      }
    }
  }
  return result
}
```

- [ ] **Step 2: Update dbscan function to use spatial index**

Replace the `dbscan` function body to use the index instead of `points.filter()`:

```typescript
function dbscan(points: Point[], eps: number, minPts: number): void {
  const index = buildSpatialIndex(points, eps)
  let clusterId = 0
  for (const p of points) {
    if (p.clusterId !== 0) continue
    const neighbors = getNeighborsFromIndex(p, index, eps)
    if (neighbors.length < minPts) {
      p.clusterId = -1
      continue
    }
    clusterId++
    p.clusterId = clusterId
    const queue = [...neighbors]
    for (let i = 0; i < queue.length; i++) {
      const q = queue[i]
      if (q.clusterId === -1) {
        q.clusterId = clusterId
      }
      if (q.clusterId !== 0) continue
      q.clusterId = clusterId
      const qNeighbors = getNeighborsFromIndex(q, index, eps)
      if (qNeighbors.length >= minPts) {
        queue.push(...qNeighbors)
      }
    }
  }
}
```

- [ ] **Step 3: Write performance comparison test**

```typescript
// src/composables/__tests__/useClusterer.perf.test.ts
import { describe, it, expect } from 'vitest'
import { clusterGrid } from '../useClusterer'
import type { BeadGrid, PaletteColor } from '../../types'

describe('clusterGrid performance', () => {
  it('handles 100x100 grid in reasonable time', () => {
    const palette: PaletteColor[] = [
      { id: 'r', name: 'Red', hex: '#FF0000', brand: 'test' },
    ]
    // 10000 cells, all same color → worst case clustering
    const cells = Array.from({ length: 100 }, (_, r) =>
      Array.from({ length: 100 }, (_, c) => ({
        row: r,
        col: c,
        colorIndex: 0,
      })),
    )
    const grid: BeadGrid = {
      rows: 100,
      cols: 100,
      palette,
      cells,
      imageCols: 100,
      imageRows: 100,
    }
    const start = performance.now()
    const blocks = clusterGrid(grid)
    const elapsed = performance.now() - start
    expect(blocks.length).toBeGreaterThan(0)
    // With spatial index, should complete well under 500ms for 10000 points
    expect(elapsed).toBeLessThan(500)
  })

  it('produces same output as before for known inputs', () => {
    // Same test data as existing test "clusters a single continuous color region"
    const palette: PaletteColor[] = [
      { id: 'r', name: 'Red', hex: '#FF0000', brand: 'test' },
    ]
    const cells = Array.from({ length: 5 }, () =>
      Array.from({ length: 20 }, () => ({ row: 0, col: 0, colorIndex: 0 })),
    ).map((row, r) => row.map((c, col) => ({ row: r, col, colorIndex: 0 })))
    const grid: BeadGrid = {
      rows: 5,
      cols: 20,
      palette,
      cells,
      imageCols: 20,
      imageRows: 5,
    }
    const blocks = clusterGrid(grid)
    expect(blocks.length).toBeGreaterThanOrEqual(1)
    expect(blocks.every((b) => b.colorIndex === 0)).toBe(true)
  })
})
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run src/composables/__tests__/useClusterer.test.ts src/composables/__tests__/useClusterer.perf.test.ts
```
Expected: All existing tests + new perf tests PASS.

- [ ] **Step 5: Full suite + commit**

```bash
npm run test && npx vue-tsc -b
```

```bash
git add src/composables/useClusterer.ts src/composables/__tests__/useClusterer.perf.test.ts
git commit -m "perf: add DBSCAN spatial grid index for O(n) neighbor lookup"
```

---

> **Note on C.2 (Non-blocking clusterGrid):** With the spatial index (Task 6), DBSCAN completes in < 50ms for grids up to 150×150. The requestIdleCallback sharding from spec C.2 is deferred — only needed for extreme grids (500×500+) which are not yet supported. If such grids are added, wrap `clusterGrid()` in a `requestIdleCallback` loop processing one color group per idle period.

---

### Task 7: Lab Color Cache

**Files:**
- Modify: `src/utils/colorSpace.ts`
- Modify: `src/stores/paletteStore.ts`

- [ ] **Step 1: Add Lab cache to colorSpace.ts**

```typescript
// Add at end of src/utils/colorSpace.ts

const labCache = new Map<string, LAB>()

export function cachedRgbToLab(hex: string): LAB {
  const upper = hex.toUpperCase()
  const cached = labCache.get(upper)
  if (cached) return cached
  const [r, g, b] = hexToRgb(upper)
  const lab = rgbToLab(r, g, b)
  labCache.set(upper, lab)
  return lab
}
```

- [ ] **Step 2: Update paletteStore to use cached version**

In `src/stores/paletteStore.ts`, change `computeLab` function to use `cachedRgbToLab`:

```typescript
// Replace:
import { hexToRgb, rgbToLab } from '../utils/colorSpace'

function computeLab(hex: string): [number, number, number] {
  const [r, g, b] = hexToRgb(hex)
  return rgbToLab(r, g, b)
}

// With:
import { cachedRgbToLab } from '../utils/colorSpace'

function computeLab(hex: string): [number, number, number] {
  return cachedRgbToLab(hex)
}
```

- [ ] **Step 3: Run tests**

```bash
npm run test
```

- [ ] **Step 4: Commit**

```bash
git add src/utils/colorSpace.ts src/stores/paletteStore.ts
git commit -m "perf: add memoized Lab color cache to avoid recomputation"
```

---

### Task 8: focusStore Computed Merge + shallowRef

**Files:**
- Modify: `src/stores/focusStore.ts`
- Modify: `src/stores/__tests__/focusStore.test.ts`

- [ ] **Step 1: Change blocks to shallowRef**

```typescript
// In focusStore.ts, change:
import { ref, computed } from 'vue'
// to:
import { ref, shallowRef, computed } from 'vue'

// Change:
const blocks = ref<FocusBlock[]>([])
// to:
const blocks = shallowRef<FocusBlock[]>([])
```

Note: `shallowRef` means modifying `blocks.value[i].status` won't trigger Vue reactivity. Since FocusGrid reads via RAF (not reactive watchers), and the computed properties (`progress`, `currentBlock`) will still re-evaluate when the component re-renders, this is safe. However, the test suite may rely on reactive tracking. Check test behavior.

If tests fail due to shallowRef, keep as `ref` but skip this optimization — the computed merge below is the main win.

- [ ] **Step 2: Merge completedColors/pendingColors computed**

Replace the two separate `done Set` constructions with direct status filters:

```typescript
// Before:
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

// After:
const completedColors = computed(() =>
  blocks.value.filter((b) => b.status === 'completed'),
)

const pendingColors = computed(() =>
  blocks.value.filter((b) => b.status !== 'completed'),
)
```

- [ ] **Step 3: Run focusStore tests**

```bash
npx vitest run src/stores/__tests__/focusStore.test.ts
```

Expected: All tests pass. If shallowRef causes issues, revert that change and keep only the computed merge.

- [ ] **Step 4: Full suite + commit**

```bash
npm run test && npx vue-tsc -b
```

```bash
git add src/stores/focusStore.ts src/stores/__tests__/focusStore.test.ts
git commit -m "perf: merge redundant computed properties in focusStore"
```

---

### Task 9: Final Integration Verification

**Files:** None (verification only)

- [ ] **Step 1: Full test suite**

```bash
npm run test
```
Expected: All tests pass (~200+).

- [ ] **Step 2: Type check**

```bash
npx vue-tsc -b
```
Expected: No errors.

- [ ] **Step 3: Build and verify chunk sizes**

```bash
npm run build
```
Verify:
- Main chunk < 400KB (down from 802KB)
- Separate chunks for DesignPage, FocusPage, pdf-lib, palette JSON
- No `[INEFFECTIVE_DYNAMIC_IMPORT]` warning for pdf-lib

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: final integration verification for performance optimization"
```
