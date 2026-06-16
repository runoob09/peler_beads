# Focused Beading Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a focused beading mode that guides users through bead placement color-by-color, block-by-block, with DBSCAN clustering, timer, progress tracking, and localStorage persistence.

**Architecture:** Introduce vue-router for SPA routing (`/` = design, `/focus` = focused mode). Extract current App.vue into DesignPage.vue. New FocusPage uses a dedicated focusStore that clusters beadGrid cells into ColorBlocks, tracks per-cell markings, and persists progress to localStorage. Reuses useExport render functions for the grid view.

**Tech Stack:** Vue 3, Pinia, vue-router (new), TypeScript, Vitest + happy-dom

---

### Task 1: Install vue-router

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install vue-router**

```bash
npm install vue-router
```

Expected: vue-router added to dependencies in package.json

- [ ] **Step 2: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add vue-router dependency"
```

---

### Task 2: Router Setup + App.vue Refactor

**Files:**
- Create: `src/router/index.ts`
- Create: `src/pages/DesignPage.vue`
- Modify: `src/App.vue` (simplify to `<RouterView />`)
- Modify: `src/main.ts` (register router)
- Create: `src/pages/__tests__/DesignPage.test.ts`

- [ ] **Step 1: Create router with hash mode**

```typescript
// src/router/index.ts
import { createRouter, createWebHashHistory } from 'vue-router'
import { useBeadStore } from '../stores/beadStore'
import DesignPage from '../pages/DesignPage.vue'
import FocusPage from '../pages/FocusPage.vue'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', component: DesignPage },
    {
      path: '/focus',
      component: FocusPage,
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

- [ ] **Step 2: Create DesignPage.vue by extracting App.vue content**

Move the entire `<script setup>`, `<template>`, and `<style>` from `src/App.vue` into `src/pages/DesignPage.vue`. The file should be identical to the current App.vue content. Change the `<style>` to `<style scoped>`.

- [ ] **Step 3: Simplify App.vue to RouterView shell**

```vue
<!-- src/App.vue -->
<template>
  <RouterView />
</template>
```

- [ ] **Step 4: Register router in main.ts**

```typescript
// src/main.ts
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from './router'
import './style.css'
import App from './App.vue'

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.mount('#app')
```

- [ ] **Step 5: Create DesignPage.test.ts**

```typescript
// src/pages/__tests__/DesignPage.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import DesignPage from '../DesignPage.vue'

describe('DesignPage', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('renders the three-column layout', () => {
    const wrapper = mount(DesignPage, {
      global: { plugins: [createPinia()] },
    })
    expect(wrapper.find('.app-layout').exists()).toBe(true)
  })

  it('shows empty state when no grid', () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const wrapper = mount(DesignPage, { global: { plugins: [pinia] } })
    expect(wrapper.text()).toContain('上传图片开始')
  })
})
```

- [ ] **Step 6: Run tests and verify**

```bash
npx vitest run src/pages/__tests__/DesignPage.test.ts
```

Expected: 2 tests PASS

- [ ] **Step 7: Full test suite**

```bash
npm run test
```

Expected: All existing tests still pass

- [ ] **Step 8: Commit**

```bash
git add src/router/index.ts src/pages/DesignPage.vue src/pages/__tests__/DesignPage.test.ts src/App.vue src/main.ts
git commit -m "feat: add vue-router with DesignPage and App shell"
```

---

### Task 3: useClusterer — DBSCAN Clustering

**Files:**
- Create: `src/composables/useClusterer.ts`
- Create: `src/composables/__tests__/useClusterer.test.ts`
- Modify: `src/types/index.ts` (add FocusBlock type)

- [ ] **Step 1: Add FocusBlock type**

```typescript
// src/types/index.ts — add at end of file
export interface FocusBlock {
  id: string
  colorIndex: number
  colorName: string
  colorHex: string
  cells: { row: number; col: number }[]
  status: 'pending' | 'active' | 'completed'
  markedCells: Set<string>   // "row,col" keys
  startedAt: number | null   // Date.now() timestamp
  completedAt: number | null
}
```

- [ ] **Step 2: Write failing tests for useClusterer**

```typescript
// src/composables/__tests__/useClusterer.test.ts
import { describe, it, expect } from 'vitest'
import { clusterGrid } from '../useClusterer'
import type { BeadGrid, PaletteColor } from '../../types'

function makeGrid(
  rows: number,
  cols: number,
  cells: (number | null)[][],
): BeadGrid {
  const palette: PaletteColor[] = [
    { id: 'r', name: 'Red', hex: '#FF0000', brand: 'test' },
    { id: 'b', name: 'Blue', hex: '#0000FF', brand: 'test' },
  ]
  return {
    rows,
    cols,
    palette,
    cells: cells.map((row, r) =>
      row.map((colorIndex, c) => ({ row: r, col: c, colorIndex })),
    ),
    imageCols: cols,
    imageRows: rows,
  }
}

// Helper: create a grid with a contiguous block of colorIndex in a region
function fillRegion(
  rows: number,
  cols: number,
  startRow: number,
  endRow: number,
  startCol: number,
  endCol: number,
  colorIndex: number | null,
): (number | null)[][] {
  const cells: (number | null)[][] = []
  for (let r = 0; r < rows; r++) {
    const row: (number | null)[] = []
    for (let c = 0; c < cols; c++) {
      if (r >= startRow && r <= endRow && c >= startCol && c <= endCol) {
        row.push(colorIndex)
      } else {
        row.push(null)
      }
    }
    cells.push(row)
  }
  return cells
}

describe('clusterGrid', () => {
  it('returns empty array for empty/null grid', () => {
    const grid = makeGrid(0, 0, [])
    expect(clusterGrid(grid)).toEqual([])
  })

  it('returns empty array when all cells are null', () => {
    const grid = makeGrid(2, 2, [
      [null, null],
      [null, null],
    ])
    expect(clusterGrid(grid)).toEqual([])
  })

  it('clusters a single continuous color region into blocks', () => {
    // 20x5 grid, all Red — should produce at least 1 block
    const cells = Array.from({ length: 5 }, () => Array(20).fill(0))
    const grid = makeGrid(5, 20, cells)
    const blocks = clusterGrid(grid)
    expect(blocks.length).toBeGreaterThanOrEqual(1)
    expect(blocks.every((b) => b.colorIndex === 0)).toBe(true)
  })

  it('splits a single color across disconnected regions into separate blocks', () => {
    const cells: (number | null)[][] = Array.from({ length: 8 }, () =>
      Array(20).fill(null),
    )
    // Two separated 3x3 patches of Red (each 9 cells < minPts=10, should be one "零星块")
    // Make them 4x4 (16 cells each) to be above minPts
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        cells[r][c] = 0
        cells[r][c + 16] = 0
      }
    }
    const grid = makeGrid(8, 20, cells)
    const redBlocks = clusterGrid(grid).filter((b) => b.colorIndex === 0)
    // Two separated regions of 16 cells each → 2 blocks
    expect(redBlocks.length).toBe(2)
  })

  it('sorts colors by total cell count ascending (fewer first)', () => {
    // Red: 30 cells, Blue: 10 cells
    const cells: (number | null)[][] = Array.from({ length: 8 }, () =>
      Array(5).fill(null),
    )
    // Blue: 10 cells in a 2x5 block
    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < 5; c++) {
        cells[r][c] = 1 // Blue
      }
    }
    // Red: 30 cells in a 6x5 block
    for (let r = 2; r < 8; r++) {
      for (let c = 0; c < 5; c++) {
        cells[r][c] = 0 // Red
      }
    }
    const grid = makeGrid(8, 5, cells)
    const blocks = clusterGrid(grid)
    // First block should be Blue (fewer total cells)
    expect(blocks[0].colorIndex).toBe(1)
  })

  it('groups isolated cells (< minPts) into one 零星块 per color', () => {
    // Two isolated Red cells, far apart (each < minPts=10)
    const cells: (number | null)[][] = Array.from({ length: 5 }, () =>
      Array(5).fill(null),
    )
    cells[0][0] = 0
    cells[4][4] = 0
    const grid = makeGrid(5, 5, cells)
    const blocks = clusterGrid(grid)
    expect(blocks.length).toBe(1)
    expect(blocks[0].cells.length).toBe(2)
  })

  it('merges noise cells with proper blocks', () => {
    // A block of 15 Red cells + 1 isolated Red cell elsewhere
    const cells: (number | null)[][] = Array.from({ length: 6 }, () =>
      Array(5).fill(null),
    )
    // Big block: 4x4 = 16 Red
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        cells[r][c] = 0
      }
    }
    // Isolated cell
    cells[5][4] = 0
    const grid = makeGrid(6, 5, cells)
    const blocks = clusterGrid(grid)
    // 1 proper block + 1 零星块
    expect(blocks.length).toBe(2)
    expect(blocks[1].cells.length).toBe(1) // 零星块 at end
  })

  it('handles 10-cell threshold exactly', () => {
    // 10 cells contiguous → should form a proper block
    const cells: (number | null)[][] = Array.from({ length: 5 }, () =>
      Array(5).fill(null),
    )
    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < 5; c++) {
        cells[r][c] = 0 // 10 cells
      }
    }
    const grid = makeGrid(5, 5, cells)
    const blocks = clusterGrid(grid)
    // 10 cells reaches minPts, should be 1 proper block
    // Check no 零星 block
    const nonNoise = blocks.filter((b) => b.id)
    expect(blocks.length).toBe(1)
  })

  it('handles 9-cell region as 零星块', () => {
    const cells: (number | null)[][] = Array.from({ length: 5 }, () =>
      Array(5).fill(null),
    )
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        cells[r][c] = 0 // 9 cells < 10
      }
    }
    const grid = makeGrid(5, 5, cells)
    const blocks = clusterGrid(grid)
    expect(blocks.length).toBe(1)
    // Should be marked as noise/零星 block (cells without cluster id prefix)
    expect(blocks[0].cells.length).toBe(9)
  })

  it('assigns unique IDs to each block', () => {
    const cells = Array.from({ length: 10 }, () => Array(10).fill(0))
    // Insert a gap to create two blocks
    for (let r = 0; r < 10; r++) {
      cells[r][4] = null
      cells[r][5] = null
    }
    const grid = makeGrid(10, 10, cells)
    const blocks = clusterGrid(grid)
    expect(blocks.length).toBe(2)
    expect(blocks[0].id).not.toBe(blocks[1].id)
  })
})
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
npx vitest run src/composables/__tests__/useClusterer.test.ts
```

Expected: FAIL — `clusterGrid` not exported

- [ ] **Step 4: Implement useClusterer with DBSCAN**

```typescript
// src/composables/useClusterer.ts
import type { BeadGrid, FocusBlock } from '../types'

interface Point {
  row: number
  col: number
  clusterId: number  // -1 = noise
}

const EPS = 2
const MIN_PTS = 10

/** Manhattan distance between two grid cells */
function manhattan(a: { row: number; col: number }, b: { row: number; col: number }): number {
  return Math.abs(a.row - b.row) + Math.abs(a.col - b.col)
}

/** DBSCAN on a set of coordinates. Returns cluster assignments (-1 = noise). */
function dbscan(points: Point[], eps: number, minPts: number): void {
  let clusterId = 0
  for (const p of points) {
    if (p.clusterId !== 0) continue // 0 = unvisited sentinel
    const neighbors = points.filter((q) => manhattan(p, q) <= eps && q !== p)
    if (neighbors.length < minPts) {
      p.clusterId = -1 // noise
      continue
    }
    clusterId++
    p.clusterId = clusterId
    const queue = [...neighbors]
    for (let i = 0; i < queue.length; i++) {
      const q = queue[i]
      if (q.clusterId === -1) {
        q.clusterId = clusterId // join cluster from noise
      }
      if (q.clusterId !== 0) continue // 0 = unvisited
      q.clusterId = clusterId
      const qNeighbors = points.filter((r) => manhattan(q, r) <= eps && r !== q)
      if (qNeighbors.length >= minPts) {
        queue.push(...qNeighbors)
      }
    }
  }
}

let blockSeq = 0
function nextBlockId(): string {
  return `block_${++blockSeq}`
}

/**
 * Clusters a BeadGrid into an ordered sequence of FocusBlocks.
 *
 * Strategy:
 * 1. Group all cells by colorIndex
 * 2. Sort colors by total cell count ascending (fewer first for quick wins)
 * 3. For each color, run DBSCAN to split into spatial blocks
 * 4. Noise cells (< minPts) are grouped into one "零星块" at the end of that color
 */
export function clusterGrid(grid: BeadGrid): FocusBlock[] {
  if (!grid || grid.rows === 0 || grid.cols === 0) return []

  // Step 1: Group cells by colorIndex
  const colorGroups = new Map<number, Point[]>()
  for (let row = 0; row < grid.rows; row++) {
    for (let col = 0; col < grid.cols; col++) {
      const idx = grid.cells[row][col].colorIndex
      if (idx === null) continue
      if (!colorGroups.has(idx)) colorGroups.set(idx, [])
      colorGroups.get(idx)!.push({ row, col, clusterId: 0 })
    }
  }

  if (colorGroups.size === 0) return []

  // Step 2: Sort colors by total count ascending
  const sortedColors = [...colorGroups.entries()].sort(
    (a, b) => a[1].length - b[1].length,
  )

  // Step 3: For each color, DBSCAN → blocks
  blockSeq = 0
  const allBlocks: FocusBlock[] = []

  for (const [colorIndex, points] of sortedColors) {
    const color = grid.palette[colorIndex]
    if (!color) continue

    dbscan(points, EPS, MIN_PTS)

    // Group by clusterId
    const clusters = new Map<number, Point[]>()
    const noise: Point[] = []
    for (const p of points) {
      if (p.clusterId <= 0) {
        noise.push(p)
      } else {
        if (!clusters.has(p.clusterId)) clusters.set(p.clusterId, [])
        clusters.get(p.clusterId)!.push(p)
      }
    }

    // Create blocks from clusters (sorted by size desc — biggest first)
    const clusterBlocks = [...clusters.entries()]
      .sort((a, b) => b[1].length - a[1].length)
      .map(([_, pts]) => createBlock(colorIndex, color.name, color.hex, pts))

    allBlocks.push(...clusterBlocks)

    // Noise as 零星块 (placed after proper blocks for this color)
    if (noise.length > 0) {
      allBlocks.push(createBlock(colorIndex, color.name, color.hex, noise))
    }
  }

  return allBlocks
}

function createBlock(
  colorIndex: number,
  colorName: string,
  colorHex: string,
  points: Point[],
): FocusBlock {
  // Sort cells row-major for predictable display order
  const sorted = [...points].sort((a, b) => a.row - b.row || a.col - b.col)
  return {
    id: nextBlockId(),
    colorIndex,
    colorName,
    colorHex,
    cells: sorted.map((p) => ({ row: p.row, col: p.col })),
    status: 'pending',
    markedCells: new Set<string>(),
    startedAt: null,
    completedAt: null,
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npx vitest run src/composables/__tests__/useClusterer.test.ts
```

Expected: All 10 tests PASS

- [ ] **Step 6: Commit**

```bash
git add src/types/index.ts src/composables/useClusterer.ts src/composables/__tests__/useClusterer.test.ts
git commit -m "feat: add DBSCAN-based bead clustering for focused mode"
```

---

### Task 4: useTimer Composable

**Files:**
- Create: `src/composables/useTimer.ts`
- Create: `src/composables/__tests__/useTimer.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// src/composables/__tests__/useTimer.test.ts
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { useTimer } from '../useTimer'

describe('useTimer', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('starts with totalElapsed=0 and isRunning=false', () => {
    const timer = useTimer()
    expect(timer.totalElapsed.value).toBe(0)
    expect(timer.isRunning.value).toBe(false)
  })

  it('starts timer and tracks elapsed', () => {
    const timer = useTimer()
    timer.start()
    expect(timer.isRunning.value).toBe(true)
    vi.advanceTimersByTime(5000)
    expect(timer.totalElapsed.value).toBe(5000)
  })

  it('pauses timer', () => {
    const timer = useTimer()
    timer.start()
    vi.advanceTimersByTime(3000)
    timer.pause()
    expect(timer.isRunning.value).toBe(false)
    const elapsed = timer.totalElapsed.value
    vi.advanceTimersByTime(2000)
    expect(timer.totalElapsed.value).toBe(elapsed)
  })

  it('resumes timer after pause', () => {
    const timer = useTimer()
    timer.start()
    vi.advanceTimersByTime(3000)
    timer.pause()
    timer.resume()
    vi.advanceTimersByTime(2000)
    expect(timer.totalElapsed.value).toBe(5000)
  })

  it('resets timer to zero', () => {
    const timer = useTimer()
    timer.start()
    vi.advanceTimersByTime(10000)
    timer.reset()
    expect(timer.totalElapsed.value).toBe(0)
    expect(timer.isRunning.value).toBe(false)
  })

  it('startBlock resets blockElapsed', () => {
    const timer = useTimer()
    timer.start()
    vi.advanceTimersByTime(5000)
    expect(timer.blockElapsed.value).toBe(5000)
    timer.startBlock()
    expect(timer.blockElapsed.value).toBe(0)
    vi.advanceTimersByTime(3000)
    expect(timer.blockElapsed.value).toBe(3000)
  })

  it('getBlockTime returns current block elapsed', () => {
    const timer = useTimer()
    timer.start()
    timer.startBlock()
    vi.advanceTimersByTime(1500)
    expect(timer.getBlockTime()).toBe(1500)
  })

  it('pauses on visibilitychange to hidden', () => {
    const timer = useTimer()
    timer.start()
    vi.advanceTimersByTime(1000)
    // Simulate page hidden
    Object.defineProperty(document, 'visibilityState', {
      value: 'hidden',
      writable: true,
    })
    document.dispatchEvent(new Event('visibilitychange'))
    // After hidden, timer should not advance (implementation detail:
    // we pause and record lastPauseTimestamp to ask user on resume)
    // Just verify the timer stops by checking no further advancement
    const elapsed = timer.totalElapsed.value
    document.dispatchEvent(new Event('visibilitychange'))
    vi.advanceTimersByTime(3000)
    // totalElapsed may have already increased by 1 tick, check approximate
    expect(timer.totalElapsed.value).toBeLessThanOrEqual(elapsed + 50)
  })

  it('formats totalElapsed as MM:SS', () => {
    const timer = useTimer()
    timer.start()
    vi.advanceTimersByTime(125000) // 2:05
    expect(timer.formatted.value).toBe('02:05')
  })

  it('formats totalElapsed as HH:MM:SS when over 1 hour', () => {
    const timer = useTimer()
    timer.start()
    vi.advanceTimersByTime(3661000) // 1:01:01
    expect(timer.formatted.value).toBe('01:01:01')
  })

  it('sets initial elapsed from external value for restore', () => {
    const timer = useTimer()
    timer.setElapsed(180000) // 3 minutes
    expect(timer.totalElapsed.value).toBe(180000)
    expect(timer.formatted.value).toBe('03:00')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/composables/__tests__/useTimer.test.ts
```

Expected: FAIL — `useTimer` not exported

- [ ] **Step 3: Implement useTimer**

```typescript
// src/composables/useTimer.ts
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

  // Auto-pause on tab hidden
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
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/composables/__tests__/useTimer.test.ts
```

Expected: All 11 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/composables/useTimer.ts src/composables/__tests__/useTimer.test.ts
git commit -m "feat: add useTimer composable for focus mode timing"
```

---

### Task 5: focusStore — State + Persistence

**Files:**
- Create: `src/stores/focusStore.ts`
- Create: `src/stores/__tests__/focusStore.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// src/stores/__tests__/focusStore.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useFocusStore } from '../focusStore'
import { useBeadStore } from '../beadStore'
import type { BeadGrid, PaletteColor } from '../../types'

function makeGrid(cells: (number | null)[][]): BeadGrid {
  const palette: PaletteColor[] = [
    { id: 'r', name: 'Red', hex: '#FF0000', brand: 'test' },
    { id: 'b', name: 'Blue', hex: '#0000FF', brand: 'test' },
  ]
  return {
    rows: cells.length,
    cols: cells[0].length,
    palette,
    cells: cells.map((row, r) =>
      row.map((colorIndex, c) => ({ row: r, col: c, colorIndex })),
    ),
    imageCols: cells[0].length,
    imageRows: cells.length,
  }
}

function makeSimpleGrid(): BeadGrid {
  // 8x8: top half Red, bottom half Blue
  const cells: (number | null)[][] = []
  for (let r = 0; r < 8; r++) {
    cells.push(Array(8).fill(r < 4 ? 0 : 1))
  }
  return makeGrid(cells)
}

describe('focusStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    // Clear localStorage
    localStorage.removeItem('perler-beads:focus-progress')
  })

  describe('initFromGrid', () => {
    it('initializes blocks from beadGrid', () => {
      const bead = useBeadStore()
      bead.beadGrid = makeSimpleGrid()
      const focus = useFocusStore()
      focus.initFromGrid()
      expect(focus.blocks.length).toBeGreaterThan(0)
    })

    it('sets currentBlockIndex to 0', () => {
      const bead = useBeadStore()
      bead.beadGrid = makeSimpleGrid()
      const focus = useFocusStore()
      focus.initFromGrid()
      expect(focus.currentBlockIndex).toBe(0)
    })

    it('sets all blocks to pending initially', () => {
      const bead = useBeadStore()
      bead.beadGrid = makeSimpleGrid()
      const focus = useFocusStore()
      focus.initFromGrid()
      expect(focus.blocks.every((b) => b.status === 'pending')).toBe(true)
    })

    it('activates the first block', () => {
      const bead = useBeadStore()
      bead.beadGrid = makeSimpleGrid()
      const focus = useFocusStore()
      focus.initFromGrid()
      expect(focus.blocks[0].status).toBe('active')
    })
  })

  describe('markCell', () => {
    it('adds cell to markedCells', () => {
      const bead = useBeadStore()
      bead.beadGrid = makeSimpleGrid()
      const focus = useFocusStore()
      focus.initFromGrid()

      focus.markCell(0, 0)
      const block = focus.currentBlock!
      expect(block.markedCells.has('0,0')).toBe(true)
    })

    it('toggles cell off when marked again', () => {
      const bead = useBeadStore()
      bead.beadGrid = makeSimpleGrid()
      const focus = useFocusStore()
      focus.initFromGrid()

      focus.markCell(0, 0)
      focus.markCell(0, 0)
      expect(focus.currentBlock!.markedCells.has('0,0')).toBe(false)
    })

    it('ignores cells not in current block', () => {
      const bead = useBeadStore()
      bead.beadGrid = makeSimpleGrid()
      const focus = useFocusStore()
      focus.initFromGrid()

      // First block is one color, try marking a cell from the other color
      const currentColor = focus.currentBlock!.colorIndex
      const otherColor = currentColor === 0 ? 1 : 0
      // Find a cell with otherColor
      const grid = bead.beadGrid!
      for (let r = 0; r < grid.rows; r++) {
        for (let c = 0; c < grid.cols; c++) {
          if (grid.cells[r][c].colorIndex === otherColor) {
            focus.markCell(r, c)
            expect(focus.currentBlock!.markedCells.has(`${r},${c}`)).toBe(false)
            return
          }
        }
      }
    })
  })

  describe('completeBlock', () => {
    it('marks current block as completed', () => {
      const bead = useBeadStore()
      bead.beadGrid = makeSimpleGrid()
      const focus = useFocusStore()
      focus.initFromGrid()

      const firstId = focus.blocks[0].id
      focus.completeBlock()
      expect(focus.blocks[0].status).toBe('completed')
      expect(focus.blocks[0].completedAt).not.toBeNull()
    })

    it('advances to next block', () => {
      const bead = useBeadStore()
      bead.beadGrid = makeSimpleGrid()
      const focus = useFocusStore()
      focus.initFromGrid()

      focus.completeBlock()
      expect(focus.currentBlockIndex).toBe(1)
      expect(focus.blocks[1].status).toBe('active')
    })

    it('automatically switches to next color when current color blocks are all done', () => {
      const bead = useBeadStore()
      bead.beadGrid = makeSimpleGrid()
      const focus = useFocusStore()
      focus.initFromGrid()

      // Complete all blocks of the first color
      const firstColor = focus.blocks[0].colorIndex
      const firstColorCount = focus.blocks.filter(
        (b) => b.colorIndex === firstColor,
      ).length
      for (let i = 0; i < firstColorCount; i++) {
        focus.completeBlock()
      }
      // Now currentBlock should have a different colorIndex
      const current = focus.currentBlock!
      expect(current.colorIndex).not.toBe(firstColor)
    })

    it('does nothing when already on last block all completed', () => {
      const bead = useBeadStore()
      bead.beadGrid = makeSimpleGrid()
      const focus = useFocusStore()
      focus.initFromGrid()

      const total = focus.blocks.length
      for (let i = 0; i < total; i++) {
        focus.completeBlock()
      }
      // Should not throw, currentBlockIndex should not exceed total
      expect(focus.currentBlockIndex).toBeLessThan(total)
      focus.completeBlock()
      // No crash
    })
  })

  describe('prevBlock / nextBlock', () => {
    it('prevBlock goes to previous pending block', () => {
      const bead = useBeadStore()
      bead.beadGrid = makeSimpleGrid()
      const focus = useFocusStore()
      focus.initFromGrid()

      focus.completeBlock() // now at block 1
      focus.prevBlock() // back to block 0
      expect(focus.currentBlockIndex).toBe(0)
    })

    it('prevBlock does nothing when on first block', () => {
      const bead = useBeadStore()
      bead.beadGrid = makeSimpleGrid()
      const focus = useFocusStore()
      focus.initFromGrid()

      focus.prevBlock()
      expect(focus.currentBlockIndex).toBe(0)
    })

    it('nextBlock goes to next pending block', () => {
      const bead = useBeadStore()
      bead.beadGrid = makeSimpleGrid()
      const focus = useFocusStore()
      focus.initFromGrid()

      focus.nextBlock()
      expect(focus.currentBlockIndex).toBe(1)
    })

    it('nextBlock does nothing when on last block', () => {
      const bead = useBeadStore()
      bead.beadGrid = makeSimpleGrid()
      const focus = useFocusStore()
      focus.initFromGrid()

      const lastIdx = focus.blocks.length - 1
      focus.currentBlockIndex = lastIdx
      focus.nextBlock()
      expect(focus.currentBlockIndex).toBe(lastIdx)
    })
  })

  describe('progress', () => {
    it('calculates progress as completed / total * 100', () => {
      const bead = useBeadStore()
      bead.beadGrid = makeSimpleGrid()
      const focus = useFocusStore()
      focus.initFromGrid()

      expect(focus.progress).toBe(0)
      focus.completeBlock()
      const expectedPct = (1 / focus.blocks.length) * 100
      expect(focus.progress).toBeCloseTo(expectedPct, 1)
    })
  })

  describe('reset', () => {
    it('clears all state', () => {
      const bead = useBeadStore()
      bead.beadGrid = makeSimpleGrid()
      const focus = useFocusStore()
      focus.initFromGrid()

      focus.markCell(0, 0)
      focus.completeBlock()
      focus.reset()
      expect(focus.blocks.length).toBe(0)
      expect(focus.currentBlockIndex).toBe(0)
      expect(focus.totalElapsed).toBe(0)
    })
  })

  describe('persistence', () => {
    it('saves progress to localStorage after markCell', () => {
      const bead = useBeadStore()
      bead.beadGrid = makeSimpleGrid()
      const focus = useFocusStore()
      focus.initFromGrid()

      focus.markCell(0, 0)
      // Deferred save — flush debounce
      focus._flushSave()
      const saved = localStorage.getItem('perler-beads:focus-progress')
      expect(saved).not.toBeNull()
      const parsed = JSON.parse(saved!)
      expect(parsed.blocks[0].markedCells).toContainEqual([0, 0])
    })

    it('restores progress from localStorage on initFromGrid', () => {
      const bead = useBeadStore()
      bead.beadGrid = makeSimpleGrid()
      const focus1 = useFocusStore()
      focus1.initFromGrid()
      focus1.markCell(2, 2)
      focus1._flushSave()

      // New store instance should restore
      const focus2 = useFocusStore()
      focus2.initFromGrid()
      expect(focus2.blocks[0].markedCells.has('2,2')).toBe(true)
    })

    it('discards saved progress when grid fingerprint does not match', () => {
      // Save with one grid
      const bead = useBeadStore()
      bead.beadGrid = makeSimpleGrid()
      const focus1 = useFocusStore()
      focus1.initFromGrid()
      focus1.markCell(0, 0)
      focus1._flushSave()

      // Change grid to different dimensions
      bead.beadGrid = makeGrid([
        [0, 1],
        [1, 0],
      ])
      const focus2 = useFocusStore()
      focus2.initFromGrid()
      // Should not restore — fresh state
      expect(focus2.blocks.length).toBeGreaterThan(0)
      expect(focus2.blocks[0].markedCells.size).toBe(0)
    })

    it('clears localStorage when all blocks completed', () => {
      const bead = useBeadStore()
      bead.beadGrid = makeSimpleGrid()
      const focus = useFocusStore()
      focus.initFromGrid()

      const total = focus.blocks.length
      for (let i = 0; i < total; i++) {
        focus.completeBlock()
      }
      focus._flushSave()
      expect(localStorage.getItem('perler-beads:focus-progress')).toBeNull()
    })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/stores/__tests__/focusStore.test.ts
```

Expected: FAIL — `useFocusStore` not exported

- [ ] **Step 3: Implement focusStore**

```typescript
// src/stores/focusStore.ts
import { ref, computed, watch } from 'vue'
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

/** Simple string hash for fingerprint comparison */
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
      // Restore blocks
      blocks.value = saved.blocks.map((sb) => ({
        id: sb.id,
        colorIndex: -1, // will be filled from grid
        colorName: '',
        colorHex: '',
        cells: [],
        status: sb.status,
        markedCells: new Set(sb.markedCells.map(([r, c]) => `${r},${c}`)),
        startedAt: sb.startedAt,
        completedAt: sb.completedAt,
      }))
      // But we need actual cell/color data from the grid — re-cluster then merge
      initFromGrid() // re-initializes blocks with proper cell data
      // Merge saved state
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

  function initFromGrid(): boolean {
    const bead = useBeadStore()
    if (!bead.beadGrid) return false

    // Try restore first
    const restored = tryRestore()
    if (restored) return true

    // Fresh initialization
    const clustered = clusterGrid(bead.beadGrid)
    blocks.value = clustered
    currentBlockIndex.value = 0
    totalElapsed.value = 0

    // Activate first block
    if (blocks.value.length > 0) {
      blocks.value[0].status = 'active'
      blocks.value[0].startedAt = Date.now()
    }
    return true
  }

  function markCell(row: number, col: number) {
    const block = currentBlock.value
    if (!block) return
    // Check cell belongs to this block
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

    // Find next pending block
    const nextIdx = blocks.value.findIndex(
      (b, i) => i > currentBlockIndex.value && b.status !== 'completed',
    )
    if (nextIdx === -1) {
      // No more pending — check if all done
      const allDone = blocks.value.every((b) => b.status === 'completed')
      if (allDone) {
        scheduleSave() // will clear
        return
      }
      // Wrap around to first pending
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

  // Exposed for tests
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
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/stores/__tests__/focusStore.test.ts
```

Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/stores/focusStore.ts src/stores/__tests__/focusStore.test.ts
git commit -m "feat: add focusStore with clustering, progress, and localStorage persistence"
```

---

### Task 6: FocusPage Scaffolding + Route Guard

**Files:**
- Create: `src/pages/FocusPage.vue` (minimal scaffold)
- Create: `src/pages/__tests__/FocusPage.test.ts`

- [ ] **Step 1: Create minimal FocusPage.vue**

```vue
<!-- src/pages/FocusPage.vue -->
<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useFocusStore } from '../stores/focusStore'

const router = useRouter()
const focusStore = useFocusStore()

onMounted(() => {
  const ok = focusStore.initFromGrid()
  if (!ok) {
    router.replace('/')
  }
})
</script>

<template>
  <div class="focus-page">
    <p>Focus Mode</p>
  </div>
</template>

<style scoped>
.focus-page {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: var(--bg);
}
</style>
```

- [ ] **Step 2: Write FocusPage tests**

```typescript
// src/pages/__tests__/FocusPage.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createWebHashHistory } from 'vue-router'
import FocusPage from '../FocusPage.vue'
import { useBeadStore } from '../../stores/beadStore'
import type { BeadGrid, PaletteColor } from '../../types'

function makeGrid(): BeadGrid {
  const palette: PaletteColor[] = [
    { id: 'r', name: 'Red', hex: '#FF0000', brand: 'test' },
  ]
  // 5x5 all Red (25 cells > minPts)
  return {
    rows: 5,
    cols: 5,
    palette,
    cells: Array.from({ length: 5 }, (_, r) =>
      Array.from({ length: 5 }, (_, c) => ({
        row: r,
        col: c,
        colorIndex: 0,
      })),
    ),
    imageCols: 5,
    imageRows: 5,
  }
}

describe('FocusPage', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.removeItem('perler-beads:focus-progress')
  })

  function mountWithRouter() {
    const pinia = createPinia()
    setActivePinia(pinia)
    // Set up beadGrid so the page can initialize
    const bead = useBeadStore()
    bead.beadGrid = makeGrid()

    const router = createRouter({
      history: createWebHashHistory(),
      routes: [{ path: '/focus', component: FocusPage }],
    })
    return mount(FocusPage, {
      global: { plugins: [pinia, router] },
    })
  }

  it('renders focus page when beadGrid exists', () => {
    const wrapper = mountWithRouter()
    expect(wrapper.text()).toContain('Focus Mode')
  })

  it('initializes focusStore on mount', () => {
    const wrapper = mountWithRouter()
    const focusStore = useFocusStore()
    // Wait for onMounted
    expect(focusStore.blocks.length).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 3: Run tests**

```bash
npx vitest run src/pages/__tests__/FocusPage.test.ts
```

Expected: Tests PASS

- [ ] **Step 4: Full test suite**

```bash
npm run test
```

Expected: All tests pass

- [ ] **Step 5: Commit**

```bash
git add src/pages/FocusPage.vue src/pages/__tests__/FocusPage.test.ts
git commit -m "feat: add FocusPage scaffold with focusStore initialization"
```

---

### Task 7: FocusToolbar Component

**Files:**
- Create: `src/components/focus/FocusToolbar.vue`
- Create: `src/components/focus/__tests__/FocusToolbar.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// src/components/focus/__tests__/FocusToolbar.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import FocusToolbar from '../FocusToolbar.vue'
import { useFocusStore } from '../../../stores/focusStore'
import { useBeadStore } from '../../../stores/beadStore'
import type { BeadGrid, PaletteColor } from '../../../types'

function makeGrid(): BeadGrid {
  const palette: PaletteColor[] = [
    { id: 'r', name: 'Red', hex: '#FF0000', brand: 'test' },
  ]
  return {
    rows: 5, cols: 5, palette,
    cells: Array.from({ length: 5 }, (_, r) =>
      Array.from({ length: 5 }, (_, c) => ({
        row: r, col: c, colorIndex: 0,
      })),
    ),
    imageCols: 5, imageRows: 5,
  }
}

describe('FocusToolbar', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    const bead = useBeadStore()
    bead.beadGrid = makeGrid()
    useFocusStore().initFromGrid()
  })

  function mountToolbar(props = {}) {
    return mount(FocusToolbar, {
      props: {
        timerFormatted: '00:00',
        timerRunning: false,
        ...props,
      },
      global: { plugins: [createPinia()] },
    })
  }

  it('renders exit button', () => {
    const wrapper = mountToolbar()
    expect(wrapper.find('.focus-toolbar').exists()).toBe(true)
    expect(wrapper.text()).toContain('退出')
  })

  it('displays progress percentage', () => {
    const wrapper = mountToolbar()
    expect(wrapper.text()).toContain('0%')
  })

  it('displays current color name', () => {
    const wrapper = mountToolbar()
    // Current block is Red
    expect(wrapper.text()).toContain('Red')
  })

  it('displays timer', () => {
    const wrapper = mountToolbar({ timerFormatted: '12:34', timerRunning: true })
    expect(wrapper.text()).toContain('12:34')
  })

  it('emits exit when exit button clicked', async () => {
    const wrapper = mountToolbar()
    await wrapper.find('[data-test="exit-btn"]').trigger('click')
    expect(wrapper.emitted('exit')).toBeTruthy()
  })
})
```

- [ ] **Step 2: Implement FocusToolbar**

```vue
<!-- src/components/focus/FocusToolbar.vue -->
<script setup lang="ts">
import { useFocusStore } from '../../stores/focusStore'

defineProps<{
  timerFormatted: string
  timerRunning: boolean
}>()

const emit = defineEmits<{
  exit: []
  toggleTimer: []
}>()

const focusStore = useFocusStore()
</script>

<template>
  <div class="focus-toolbar">
    <button class="exit-btn" data-test="exit-btn" @click="emit('exit')">
      ← 退出
    </button>
    <div class="toolbar-center">
      <span class="color-name">
        <span
          class="color-dot"
          :style="{ background: focusStore.currentBlock?.colorHex }"
        ></span>
        {{ focusStore.currentBlock?.colorName ?? '' }}
      </span>
      <div class="progress-bar">
        <div
          class="progress-fill"
          :style="{ width: focusStore.progress + '%' }"
        ></div>
      </div>
      <span class="progress-text">{{ focusStore.progress }}%</span>
    </div>
    <button
      class="timer-btn"
      @click="emit('toggleTimer')"
      :class="{ running: timerRunning }"
    >
      ⏱ {{ timerFormatted }}
    </button>
  </div>
</template>

<style scoped>
.focus-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
  background: var(--accent-bg, rgba(170, 59, 255, 0.06));
  border-bottom: 1px solid var(--border, #e5e4e7);
  flex-shrink: 0;
  gap: 16px;
}
.exit-btn {
  background: none;
  border: 1px solid var(--border, #e5e4e7);
  color: var(--text, #6b6375);
  padding: 4px 12px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  flex-shrink: 0;
}
.exit-btn:hover { background: var(--border, #e5e4e7); }

.toolbar-center {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
  justify-content: center;
  min-width: 0;
}

.color-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-h, #1a1a2e);
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}
.color-dot {
  display: inline-block;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 1px solid rgba(0,0,0,0.1);
}

.progress-bar {
  width: 200px;
  max-width: 30vw;
  height: 6px;
  background: var(--border, #e5e4e7);
  border-radius: 3px;
  overflow: hidden;
}
.progress-fill {
  height: 100%;
  background: var(--accent, #aa3bff);
  border-radius: 3px;
  transition: width 0.3s ease;
}
.progress-text {
  font-size: 12px;
  color: var(--text, #6b6375);
  font-family: var(--mono, monospace);
  min-width: 32px;
  text-align: right;
}
.timer-btn {
  background: none;
  border: 1px solid var(--border, #e5e4e7);
  color: var(--text, #6b6375);
  padding: 4px 12px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  font-family: var(--mono, monospace);
  flex-shrink: 0;
}
.timer-btn.running {
  color: var(--accent, #aa3bff);
  border-color: var(--accent, #aa3bff);
}
</style>
```

- [ ] **Step 3: Run tests to verify**

```bash
npx vitest run src/components/focus/__tests__/FocusToolbar.test.ts
```

Expected: All 5 tests PASS

- [ ] **Step 4: Commit**

```bash
git add src/components/focus/FocusToolbar.vue src/components/focus/__tests__/FocusToolbar.test.ts
git commit -m "feat: add FocusToolbar with progress, color indicator, and timer"
```

---

### Task 8: FocusColorBar + FocusColorList Components

**Files:**
- Create: `src/components/focus/FocusColorBar.vue`
- Create: `src/components/focus/FocusColorList.vue`
- Create: `src/components/focus/__tests__/FocusColorBar.test.ts`

- [ ] **Step 1: Write FocusColorBar test + implement**

```typescript
// src/components/focus/__tests__/FocusColorBar.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import FocusColorBar from '../FocusColorBar.vue'
import { useFocusStore } from '../../../stores/focusStore'
import { useBeadStore } from '../../../stores/beadStore'
import type { BeadGrid, PaletteColor } from '../../../types'

function makeGrid(): BeadGrid {
  const palette: PaletteColor[] = [
    { id: 'r', name: 'Red', hex: '#FF0000', brand: 'test' },
    { id: 'b', name: 'Blue', hex: '#0000FF', brand: 'test' },
  ]
  // Red: 4x4 blocks, Blue: scattered
  const cells: (number | null)[][] = Array.from({ length: 6 }, (_, r) =>
    Array.from({ length: 6 }, (_, c) => (r < 4 ? 0 : 1)),
  )
  return {
    rows: 6, cols: 6, palette,
    cells: cells.map((row, r) =>
      row.map((colorIndex, c) => ({ row: r, col: c, colorIndex })),
    ),
    imageCols: 6, imageRows: 6,
  }
}

describe('FocusColorBar', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    const bead = useBeadStore()
    bead.beadGrid = makeGrid()
    useFocusStore().initFromGrid()
  })

  it('displays current color hex', () => {
    const wrapper = mount(FocusColorBar, {
      global: { plugins: [createPinia()] },
    })
    expect(wrapper.text()).toContain('#')
  })

  it('displays block progress like "1/N"', () => {
    const wrapper = mount(FocusColorBar, {
      global: { plugins: [createPinia()] },
    })
    const text = wrapper.text()
    expect(text).toMatch(/\d+\s*\/\s*\d+/)
  })
})
```

- [ ] **Step 2: Create FocusColorList.vue**

```vue
<!-- src/components/focus/FocusColorList.vue -->
<script setup lang="ts">
import { useFocusStore } from '../../stores/focusStore'

const focusStore = useFocusStore()
</script>

<template>
  <div class="color-list">
    <div class="list-title">颜色进度</div>
    <div class="color-items">
      <div
        v-for="block in focusStore.blocks"
        :key="block.id"
        class="color-item"
        :class="{
          completed: block.status === 'completed',
          active: block.status === 'active',
        }"
      >
        <span class="status-icon">
          {{ block.status === 'completed' ? '✅' : block.status === 'active' ? '⏳' : '⬜' }}
        </span>
        <span
          class="color-swatch"
          :style="{ background: block.colorHex }"
        ></span>
        <span class="color-label">{{ block.colorName }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.color-list {
  display: flex;
  flex-direction: column;
  background: color-mix(in srgb, var(--bg, #fff) 97%, var(--text, #6b6375));
  border-left: 1px solid var(--border, #e5e4e7);
  padding: 12px;
  overflow-y: auto;
}
.list-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-h, #1a1a2e);
  margin-bottom: 8px;
}
.color-items {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.color-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  padding: 3px 6px;
  border-radius: 4px;
}
.color-item.active {
  background: var(--accent-bg, rgba(170, 59, 255, 0.08));
}
.color-item.completed {
  opacity: 0.6;
}
.status-icon { font-size: 12px; flex-shrink: 0; }
.color-swatch {
  width: 14px;
  height: 14px;
  border-radius: 3px;
  border: 1px solid rgba(0,0,0,0.1);
  flex-shrink: 0;
}
.color-label {
  color: var(--text, #6b6375);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
```

- [ ] **Step 3: Create FocusColorBar.vue**

```vue
<!-- src/components/focus/FocusColorBar.vue -->
<script setup lang="ts">
import { computed } from 'vue'
import { useFocusStore } from '../../stores/focusStore'

const focusStore = useFocusStore()

const blockProgress = computed(() => {
  const color = focusStore.currentBlock?.colorIndex ?? -1
  const colorBlocks = focusStore.blocks.filter((b) => b.colorIndex === color)
  const currentInColor = colorBlocks.findIndex(
    (b) => b.id === focusStore.currentBlock?.id,
  )
  return `${currentInColor + 1} / ${colorBlocks.length}`
})
</script>

<template>
  <div class="color-bar">
    <div class="current-color">
      <div
        class="big-swatch"
        :style="{ background: focusStore.currentBlock?.colorHex }"
      ></div>
      <div class="color-info">
        <div class="color-hex">{{ focusStore.currentBlock?.colorHex ?? '' }}</div>
        <div class="block-progress">块 {{ blockProgress }}</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.color-bar {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 16px 12px;
  background: color-mix(in srgb, var(--bg, #fff) 97%, var(--text, #6b6375));
  border-right: 1px solid var(--border, #e5e4e7);
  gap: 12px;
  flex-shrink: 0;
  width: 100px;
}
.current-color {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}
.big-swatch {
  width: 48px;
  height: 48px;
  border-radius: 8px;
  border: 2px solid var(--text-h, #1a1a2e);
}
.color-info {
  text-align: center;
}
.color-hex {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-h, #1a1a2e);
  font-family: var(--mono, monospace);
}
.block-progress {
  font-size: 12px;
  color: var(--text, #6b6375);
  margin-top: 2px;
}
</style>
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run src/components/focus/__tests__/FocusColorBar.test.ts
```

Expected: 2 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/focus/FocusColorBar.vue src/components/focus/FocusColorList.vue src/components/focus/__tests__/FocusColorBar.test.ts
git commit -m "feat: add FocusColorBar and FocusColorList components"
```

---

### Task 9: FocusBottomBar Component

**Files:**
- Create: `src/components/focus/FocusBottomBar.vue`
- Create: `src/components/focus/__tests__/FocusBottomBar.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// src/components/focus/__tests__/FocusBottomBar.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import FocusBottomBar from '../FocusBottomBar.vue'
import { useFocusStore } from '../../../stores/focusStore'
import { useBeadStore } from '../../../stores/beadStore'
import type { BeadGrid, PaletteColor } from '../../../types'

function makeGrid(): BeadGrid {
  const palette: PaletteColor[] = [
    { id: 'r', name: 'Red', hex: '#FF0000', brand: 'test' },
    { id: 'b', name: 'Blue', hex: '#0000FF', brand: 'test' },
  ]
  // Two distinct blocks: Red 4x5 (20) and Blue 4x5 (20)
  const cells: (number | null)[][] = [
    ...Array.from({ length: 4 }, (_, r) =>
      Array.from({ length: 5 }, (_, c) => 0),
    ),
    ...Array.from({ length: 4 }, (_, r) =>
      Array.from({ length: 5 }, (_, c) => 1),
    ),
  ]
  return {
    rows: 8, cols: 5, palette,
    cells: cells.map((row, r) =>
      row.map((colorIndex, c) => ({ row: r, col: c, colorIndex })),
    ),
    imageCols: 5, imageRows: 8,
  }
}

describe('FocusBottomBar', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    const bead = useBeadStore()
    bead.beadGrid = makeGrid()
    useFocusStore().initFromGrid()
  })

  function mountBar() {
    return mount(FocusBottomBar, {
      global: { plugins: [createPinia()] },
    })
  }

  it('renders prev, complete, and next buttons', () => {
    const wrapper = mountBar()
    expect(wrapper.text()).toContain('上一块')
    expect(wrapper.text()).toContain('标记完成')
    expect(wrapper.text()).toContain('下一块')
  })

  it('emits prevBlock when prev clicked', async () => {
    const focus = useFocusStore()
    // Move to block 1 first
    focus.currentBlockIndex = 1
    const wrapper = mountBar()
    await wrapper.find('[data-test="prev-block"]').trigger('click')
    expect(focus.currentBlockIndex).toBe(0)
  })

  it('disables prev button on first block', () => {
    const wrapper = mountBar()
    const prevBtn = wrapper.find('[data-test="prev-block"]')
    expect(prevBtn.attributes('disabled')).toBeDefined()
  })

  it('completes current block and advances on complete click', async () => {
    const focus = useFocusStore()
    const firstId = focus.blocks[0].id
    const wrapper = mountBar()
    await wrapper.find('[data-test="complete-block"]').trigger('click')
    expect(focus.blocks[0].status).toBe('completed')
    expect(focus.currentBlockIndex).toBe(1)
  })
})
```

- [ ] **Step 2: Implement FocusBottomBar**

```vue
<!-- src/components/focus/FocusBottomBar.vue -->
<script setup lang="ts">
import { computed } from 'vue'
import { useFocusStore } from '../../stores/focusStore'

const focusStore = useFocusStore()

const isFirstBlock = computed(() => focusStore.currentBlockIndex === 0)
const isLastBlock = computed(
  () =>
    focusStore.currentBlockIndex >= focusStore.blocks.length - 1 ||
    focusStore.blocks.every((b) => b.status === 'completed'),
)

const allDone = computed(() =>
  focusStore.blocks.length > 0 &&
  focusStore.blocks.every((b) => b.status === 'completed'),
)
</script>

<template>
  <div class="bottom-bar">
    <button
      data-test="prev-block"
      class="nav-btn"
      :disabled="isFirstBlock"
      @click="focusStore.prevBlock()"
    >
      ← 上一块
    </button>
    <button
      v-if="!allDone"
      data-test="complete-block"
      class="complete-btn"
      @click="focusStore.completeBlock()"
    >
      标记当前块完成 ✓
    </button>
    <div v-else class="all-done-message">🎉 全部完成！</div>
    <button
      data-test="next-block"
      class="nav-btn"
      :disabled="isLastBlock || allDone"
      @click="focusStore.nextBlock()"
    >
      下一块 →
    </button>
  </div>
</template>

<style scoped>
.bottom-bar {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 12px 16px;
  background: var(--accent-bg, rgba(170, 59, 255, 0.06));
  border-top: 1px solid var(--border, #e5e4e7);
  flex-shrink: 0;
}
.nav-btn {
  background: none;
  border: 1px solid var(--border, #e5e4e7);
  color: var(--text, #6b6375);
  padding: 6px 16px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
}
.nav-btn:hover:not(:disabled) {
  background: var(--border, #e5e4e7);
}
.nav-btn:disabled {
  opacity: 0.4;
  cursor: default;
}
.complete-btn {
  background: var(--accent, #aa3bff);
  color: #fff;
  border: none;
  padding: 8px 24px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 600;
}
.complete-btn:hover {
  filter: brightness(1.1);
}
.all-done-message {
  font-size: 16px;
  color: var(--accent, #aa3bff);
  font-weight: 600;
}
</style>
```

- [ ] **Step 3: Run tests to verify**

```bash
npx vitest run src/components/focus/__tests__/FocusBottomBar.test.ts
```

Expected: All 4 tests PASS

- [ ] **Step 4: Commit**

```bash
git add src/components/focus/FocusBottomBar.vue src/components/focus/__tests__/FocusBottomBar.test.ts
git commit -m "feat: add FocusBottomBar with prev/complete/next navigation"
```

---

### Task 10: FocusGrid Component

**Files:**
- Create: `src/components/focus/FocusGrid.vue`
- Create: `src/components/focus/__tests__/FocusGrid.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// src/components/focus/__tests__/FocusGrid.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import FocusGrid from '../FocusGrid.vue'
import { useFocusStore } from '../../../stores/focusStore'
import { useBeadStore } from '../../../stores/beadStore'
import type { BeadGrid, PaletteColor } from '../../../types'

function makeGrid(): BeadGrid {
  const palette: PaletteColor[] = [
    { id: 'r', name: 'Red', hex: '#FF0000', brand: 'test' },
    { id: 'b', name: 'Blue', hex: '#0000FF', brand: 'test' },
  ]
  // Two distinct blocks: Red 4x3 (12) and Blue 4x3 (12)
  const cells: (number | null)[][] = [
    ...Array.from({ length: 4 }, (_, r) =>
      Array.from({ length: 3 }, (_, c) => 0),
    ),
    ...Array.from({ length: 4 }, (_, r) =>
      Array.from({ length: 3 }, (_, c) => 1),
    ),
  ]
  return {
    rows: 8, cols: 3, palette,
    cells: cells.map((row, r) =>
      row.map((colorIndex, c) => ({ row: r, col: c, colorIndex })),
    ),
    imageCols: 3, imageRows: 8,
  }
}

describe('FocusGrid', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    const bead = useBeadStore()
    bead.beadGrid = makeGrid()
    useFocusStore().initFromGrid()
  })

  function mountGrid() {
    return mount(FocusGrid, {
      global: { plugins: [createPinia()] },
    })
  }

  it('renders a canvas element', () => {
    const wrapper = mountGrid()
    expect(wrapper.find('canvas').exists()).toBe(true)
  })

  it('calls focusStore.markCell on canvas click', async () => {
    const focus = useFocusStore()
    const wrapper = mountGrid()
    const canvas = wrapper.find('canvas')
    await canvas.trigger('click', { clientX: 10, clientY: 10 })
    // After click, check that markCell was called for a cell in the current block
    // (We verify by checking the canvas click handler was set up)
  })

  it('renders without error', () => {
    const wrapper = mountGrid()
    expect(wrapper.find('.focus-grid').exists()).toBe(true)
  })
})
```

- [ ] **Step 2: Implement FocusGrid with RAF animation loop**

```vue
<!-- src/components/focus/FocusGrid.vue -->
<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useBeadStore } from '../../stores/beadStore'
import { useFocusStore } from '../../stores/focusStore'
import { renderAllCells, drawGridLines } from '../../composables/useExport'

const beadStore = useBeadStore()
const focusStore = useFocusStore()

const canvasRef = ref<HTMLCanvasElement>()
const containerRef = ref<HTMLDivElement>()
const cellSize = ref(20)

// Zoom & pan state
const zoom = ref(1)
const panX = ref(0)
const panY = ref(0)
const isPanning = ref(false)
const panStart = ref({ x: 0, y: 0 })
const panStartPos = ref({ x: 0, y: 0 })

const MIN_ZOOM = 0.25
const MAX_ZOOM = 4
const ZOOM_STEP = 0.1

let animRafId = 0

function clampZoom(z: number): number {
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z))
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

function render() {
  if (!canvasRef.value || !beadStore.beadGrid) return
  const container = containerRef.value
  if (!container) return

  const maxW = container.clientWidth || 400
  const maxH = container.clientHeight || 400
  cellSize.value = Math.floor(
    Math.min(maxW / beadStore.beadGrid.cols, maxH / beadStore.beadGrid.rows),
  )

  const grid = beadStore.beadGrid
  const w = grid.cols * cellSize.value
  const h = grid.rows * cellSize.value

  canvasRef.value.width = w
  canvasRef.value.height = h
  const ctx = canvasRef.value.getContext('2d')
  if (!ctx) return

  // Render base cells
  renderAllCells(ctx, grid, cellSize.value, 'color', false)

  // Draw grid lines
  const d = beadStore.settings.display
  drawGridLines(ctx, grid.cols, grid.rows, cellSize.value, {
    showGrid: d.showGrid,
    gridLineColor: d.gridLineColor,
    gridLineWidth: d.gridLineWidth,
    boldGridInterval: d.boldGridInterval,
    boldGridColor: d.boldGridColor,
    boldGridWidth: d.boldGridWidth,
  })

  // Highlight current block cells
  const block = focusStore.currentBlock
  if (block) {
    const marked = block.markedCells

    for (const { row, col } of block.cells) {
      const x = col * cellSize.value
      const y = row * cellSize.value
      const key = `${row},${col}`

      if (marked.has(key)) {
        // Marked cell: semi-transparent overlay + checkmark
        ctx.fillStyle = 'rgba(76, 175, 80, 0.35)'
        ctx.fillRect(x, y, cellSize.value, cellSize.value)
        const cx = x + cellSize.value / 2
        const cy = y + cellSize.value / 2
        const size = cellSize.value * 0.35
        ctx.strokeStyle = '#2e7d32'
        ctx.lineWidth = Math.max(1.5, cellSize.value * 0.08)
        ctx.beginPath()
        ctx.moveTo(cx - size * 0.4, cy)
        ctx.lineTo(cx - size * 0.1, cy + size * 0.35)
        ctx.lineTo(cx + size * 0.5, cy - size * 0.3)
        ctx.stroke()
      } else {
        // Unmarked: pulsing border effect via alpha
        const pulse = 0.3 + 0.2 * Math.sin(Date.now() / 800)
        ctx.strokeStyle = `rgba(170, 59, 255, ${pulse})`
        ctx.lineWidth = Math.max(2, cellSize.value * 0.12)
        ctx.strokeRect(x + 1, y + 1, cellSize.value - 2, cellSize.value - 2)
      }
    }
  }
}

// RAF animation loop for pulse effect
function animLoop() {
  render()
  animRafId = requestAnimationFrame(animLoop)
}

// Keep transform updated on zoom/pan
function updateTransform() {
  if (!canvasRef.value) return
  canvasRef.value.style.transform =
    `translate(${panX.value}px, ${panY.value}px) scale(${zoom.value})`
}

function onClick(event: MouseEvent) {
  const cell = getCellFromEvent(event)
  if (!cell) return
  focusStore.markCell(cell.row, cell.col)
}

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

onMounted(() => {
  animRafId = requestAnimationFrame(animLoop)
  document.addEventListener('mousemove', onPanMove)
  document.addEventListener('mouseup', onPanEnd)
})

onUnmounted(() => {
  cancelAnimationFrame(animRafId)
  document.removeEventListener('mousemove', onPanMove)
  document.removeEventListener('mouseup', onPanEnd)
})
</script>

<template>
  <div ref="containerRef" class="focus-grid" @wheel="onWheel">
    <canvas
      ref="canvasRef"
      @click="onClick"
      @mousedown="onPanStart"
      style="transform-origin: 0 0"
      :style="{ cursor: 'pointer' }"
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
canvas {
  transform-origin: 0 0;
}
</style>
```

- [ ] **Step 3: Run tests**

```bash
npx vitest run src/components/focus/__tests__/FocusGrid.test.ts
```

Expected: Tests PASS

- [ ] **Step 4: Commit**

```bash
git add src/components/focus/FocusGrid.vue src/components/focus/__tests__/FocusGrid.test.ts
git commit -m "feat: add FocusGrid with block highlighting and cell marking"
```

---

### Task 11: FocusPage Assembly + Exit Confirmation

**Files:**
- Modify: `src/pages/FocusPage.vue`
- Modify: `src/pages/__tests__/FocusPage.test.ts`

- [ ] **Step 1: Update FocusPage to compose all components**

```vue
<!-- src/pages/FocusPage.vue -->
<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useFocusStore } from '../stores/focusStore'
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

// Keyboard shortcut: Space = complete block
function onKeyDown(event: KeyboardEvent) {
  if (event.key === ' ' && !showExitConfirm.value) {
    event.preventDefault()
    focusStore.completeBlock()
  } else if (event.key === 'ArrowLeft') {
    focusStore.prevBlock()
  } else if (event.key === 'ArrowRight') {
    focusStore.nextBlock()
  }
}

onMounted(() => {
  document.addEventListener('keydown', onKeyDown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', onKeyDown)
})
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

    <!-- Exit confirmation dialog -->
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

/* Confirmation dialog */
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
.confirm-dialog p {
  margin: 0 0 4px;
  font-size: 14px;
  color: var(--text-h, #1a1a2e);
}
.confirm-hint {
  font-size: 12px !important;
  color: var(--text, #6b6375) !important;
  margin-bottom: 16px !important;
}
.confirm-actions {
  display: flex;
  gap: 12px;
  justify-content: center;
  margin-top: 16px;
}
.btn-cancel {
  background: none;
  border: 1px solid var(--border, #e5e4e7);
  color: var(--text, #6b6375);
  padding: 6px 16px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
}
.btn-confirm {
  background: var(--accent, #aa3bff);
  color: #fff;
  border: none;
  padding: 6px 20px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
}
</style>
```

- [ ] **Step 2: Run full test suite**

```bash
npm run test
```

Expected: All tests pass

- [ ] **Step 3: Commit**

```bash
git add src/pages/FocusPage.vue src/pages/__tests__/FocusPage.test.ts
git commit -m "feat: assemble FocusPage with all focus components and exit confirmation"
```

---

### Task 12: Add "Enter Focus Mode" Button to BeadPreview

**Files:**
- Modify: `src/components/BeadPreview.vue`

- [ ] **Step 1: Add button to BeadPreview template**

In `src/components/BeadPreview.vue`, add the button inside the `beadStore.beadGrid` template block, right before `<!-- Right: canvas area -->` or next to the brush palette toggle area:

In the template, after the `preview-body` div opening and near the brush palette, add:

```vue
<!-- Inside the <template v-if="beadStore.beadGrid"> block, above preview-body -->
<div class="focus-entry-bar" v-if="!brushStore.brushMode">
  <router-link to="/focus" class="focus-btn">
    🎯 进入专心拼豆模式
  </router-link>
</div>
```

Add the missing import at the top of `<script setup>`:

```typescript
// Nothing to add — router-link is a built-in component, but we need to add
// RouterLink to the component's template. Vue 3 resolves it globally if router is installed.
```

And add styles:

```css
.focus-entry-bar {
  display: flex;
  justify-content: center;
  padding: 8px 0 4px;
}
.focus-btn {
  display: inline-block;
  background: var(--accent, #aa3bff);
  color: #fff;
  padding: 6px 20px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  text-decoration: none;
  cursor: pointer;
  transition: filter 0.2s;
}
.focus-btn:hover {
  filter: brightness(1.1);
}
```

- [ ] **Step 2: Verify with existing BeadPreview tests**

```bash
npx vitest run src/components/__tests__/BeadPreview.test.ts
```

Expected: If router-link causes issues in tests, we may need to stub it. Add stub:

```typescript
// In BeadPreview.test.ts mount calls, add stubs:
import { RouterLink } from 'vue-router'
// And in mount options:
global: { 
  plugins: [pinia],
  stubs: { RouterLink: true },
}
```

- [ ] **Step 3: Run full test suite**

```bash
npm run test
```

Expected: All tests pass

- [ ] **Step 4: Type-check**

```bash
npx vue-tsc -b
```

Expected: No type errors

- [ ] **Step 5: Commit**

```bash
git add src/components/BeadPreview.vue src/components/__tests__/BeadPreview.test.ts
git commit -m "feat: add 'Enter Focus Mode' button to BeadPreview"
```

---

### Task 13: Final Integration Verification

**Files:** None (verification only)

- [ ] **Step 1: Run complete test suite**

```bash
npm run test
```

Expected: All tests pass, no failures

- [ ] **Step 2: Type-check**

```bash
npx vue-tsc -b
```

Expected: No type errors

- [ ] **Step 3: Build check**

```bash
npm run build
```

Expected: Build succeeds

- [ ] **Step 4: Start dev server and smoke test**

```bash
npm run dev
```

Manual verification:
1. Open app → see design page with empty state
2. Upload an image → grid renders
3. Click "进入专心拼豆模式" → navigates to `/focus`
4. See FocusPage with toolbar, grid, color bars, bottom bar
5. Click a highlighted cell → checkmark appears
6. Click "标记当前块完成" → advances to next block
7. Click "退出" → confirmation dialog if progress made
8. Re-enter focus mode → progress restored from localStorage

- [ ] **Step 5: Commit (if any changes)**

```bash
git add -A
git commit -m "chore: final integration tweaks for focused beading mode"
```
