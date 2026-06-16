# Core Features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 4 core features: board size presets, blank canvas mode, export bead count total, and connected-component color replace via right-click.

**Architecture:** Implement in dependency order — presets (standalone data) → blank canvas (uses presets) → export total (standalone) → color replace (complex, uses brushStore flood-fill). Each feature has its own TDD cycle with tests written first.

**Tech Stack:** Vue 3 + Pinia + TypeScript + Vitest + happy-dom

---

## File Structure

| File | Role |
|------|------|
| `src/data/boardPresets.ts` (new) | Constant list of board size presets |
| `src/components/SizeSelector.vue` | Add preset dropdown, disable inputs on preset select |
| `src/stores/beadStore.ts` | Add `initEmptyGrid(rows, cols, palette)` method |
| `src/components/ControlPanel.vue` | Add creation mode tabs (`image` / `blank`), conditional sections |
| `src/pages/DesignPage.vue` | Manage `creationMode` state, call `initEmptyGrid` |
| `src/composables/useExport.ts` | Append total bead count line after legend |
| `src/utils/exportPdf.ts` | Append total bead count line after legend |
| `src/stores/brushStore.ts` | Add flood-fill replace state and methods |
| `src/components/BeadPreview.vue` | Right-click context menu + replace modal |

---

### Task 1: Board Size Presets

**Files:**
- Create: `src/data/boardPresets.ts`
- Modify: `src/components/SizeSelector.vue`
- Test: `src/components/__tests__/SizeSelector.test.ts`

- [ ] **Step 1: Create board presets data file**

```ts
// src/data/boardPresets.ts
export interface BoardPreset {
  label: string
  rows: number
  cols: number
}

export const BOARD_PRESETS: BoardPreset[] = [
  { label: '迷你板 10×10', rows: 10, cols: 10 },
  { label: '小方板 14×14', rows: 14, cols: 14 },
  { label: '大方板 29×29', rows: 29, cols: 29 },
  { label: '中板 20×20', rows: 20, cols: 20 },
  { label: '超大方板 50×50', rows: 50, cols: 50 },
  { label: '100×100', rows: 100, cols: 100 },
  { label: '自定义', rows: 0, cols: 0 },
]
```

- [ ] **Step 2: Write the failing test for SizeSelector preset dropdown**

```ts
// Add to src/components/__tests__/SizeSelector.test.ts, after existing imports:

import { BOARD_PRESETS } from '../../data/boardPresets'

// Add after existing describe block, inside the same file:

describe('SizeSelector board presets', () => {
  it('renders preset dropdown with board options', () => {
    const wrapper = mount(SizeSelector, {
      props: { modelValue: { cols: 29, rows: 29, keepAspectRatio: true } },
    })
    const select = wrapper.find('select.preset-select')
    expect(select.exists()).toBe(true)
    const options = select.findAll('option')
    expect(options.length).toBe(BOARD_PRESETS.length)
    expect(options[0].text()).toContain('迷你板')
  })

  it('emits preset values when dropdown changes', async () => {
    const wrapper = mount(SizeSelector, {
      props: { modelValue: { cols: 29, rows: 29, keepAspectRatio: true } },
    })
    const select = wrapper.find('select.preset-select')
    // Select "小方板 14×14" (index 1)
    await select.setValue('1')
    const emitted = wrapper.emitted('update:modelValue')! as any
    expect(emitted[0][0].cols).toBe(14)
    expect(emitted[0][0].rows).toBe(14)
  })

  it('disables custom inputs when a preset (non-custom) is selected', async () => {
    const wrapper = mount(SizeSelector, {
      props: { modelValue: { cols: 29, rows: 29, keepAspectRatio: true } },
    })
    const select = wrapper.find('select.preset-select')
    await select.setValue('0') // 迷你板 10×10 (non-custom)
    const inputs = wrapper.findAll('input[type="number"]')
    for (const input of inputs) {
      expect((input.element as HTMLInputElement).disabled).toBe(true)
    }
  })

  it('enables custom inputs when "自定义" is selected', async () => {
    const wrapper = mount(SizeSelector, {
      props: { modelValue: { cols: 29, rows: 29, keepAspectRatio: true } },
    })
    const select = wrapper.find('select.preset-select')
    const customIndex = BOARD_PRESETS.findIndex(p => p.label === '自定义')
    await select.setValue(String(customIndex))
    const inputs = wrapper.findAll('input[type="number"]')
    for (const input of inputs) {
      expect((input.element as HTMLInputElement).disabled).toBe(false)
    }
  })
})
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
npx vitest run src/components/__tests__/SizeSelector.test.ts
```

Expected: 4 new tests FAIL — select element and options not found.

- [ ] **Step 4: Modify SizeSelector to add preset dropdown**

Replace the existing SizeSelector `<script setup>` with:

```vue
<script setup lang="ts">
import { computed } from 'vue'
import { BOARD_PRESETS } from '../data/boardPresets'

interface SizeValue {
  cols: number
  rows: number
  keepAspectRatio: boolean
}

const props = defineProps<{ modelValue: SizeValue }>()
const emit = defineEmits<{ 'update:modelValue': [value: SizeValue] }>()

const selectedPresetIndex = computed({
  get: () => {
    if (!props.modelValue) return BOARD_PRESETS.length - 1 // default to custom
    const idx = BOARD_PRESETS.findIndex(
      p => p.rows === props.modelValue.rows && p.cols === props.modelValue.cols
    )
    return idx >= 0 ? idx : BOARD_PRESETS.length - 1
  },
  set: (idx: number) => {
    const preset = BOARD_PRESETS[idx]
    if (!preset) return
    if (preset.rows > 0 && preset.cols > 0) {
      emit('update:modelValue', { ...props.modelValue, cols: preset.cols, rows: preset.rows })
    }
    // "自定义" (rows=0, cols=0) — do nothing, let user type
  },
})

const isCustom = computed(() => {
  const idx = selectedPresetIndex.value
  if (idx < 0 || idx >= BOARD_PRESETS.length) return true
  const p = BOARD_PRESETS[idx]
  return p.rows === 0 && p.cols === 0
})

function updateCols(ev: Event) {
  const v = Number((ev.target as HTMLInputElement).value)
  emit('update:modelValue', { ...props.modelValue, cols: v })
}

function updateRows(ev: Event) {
  const v = Number((ev.target as HTMLInputElement).value)
  emit('update:modelValue', { ...props.modelValue, rows: v })
}

function toggleAspect(ev: Event) {
  const checked = (ev.target as HTMLInputElement).checked
  emit('update:modelValue', { ...props.modelValue, keepAspectRatio: checked })
}
</script>
```

Replace the template:

```vue
<template>
  <div class="size-selector">
    <label class="label">网格尺寸</label>
    <div class="preset-row">
      <select
        class="preset-select"
        :value="selectedPresetIndex"
        @change="selectedPresetIndex = Number(($event.target as HTMLSelectElement).value)"
      >
        <option
          v-for="(p, i) in BOARD_PRESETS"
          :key="p.label"
          :value="i"
        >
          {{ p.label }}
        </option>
      </select>
    </div>
    <div class="custom-size">
      <input
        type="number"
        :value="modelValue.cols"
        min="1" max="500"
        class="size-input"
        :disabled="!isCustom"
        @input="updateCols"
      />
      <span>×</span>
      <input
        type="number"
        :value="modelValue.rows"
        min="1" max="500"
        class="size-input"
        :disabled="!isCustom"
        @input="updateRows"
      />
    </div>
    <label class="aspect-toggle">
      <input type="checkbox" :checked="modelValue.keepAspectRatio" @change="toggleAspect" />
      锁定宽高比
    </label>
  </div>
</template>
```

Add new styles (append to existing `<style scoped>`):

```css
.preset-row { margin-bottom: 4px; }
.preset-select {
  width: 100%;
  padding: 5px 8px;
  border: 1px solid var(--border);
  border-radius: 5px;
  font-size: 13px;
  background: var(--bg);
  color: var(--text-h);
}
```

Remove the old `PRESETS` constant and `selectPreset` function and the old `.presets` / `.preset-btn` template block.

- [ ] **Step 5: Run tests to verify they pass**

```bash
npx vitest run src/components/__tests__/SizeSelector.test.ts
```

Expected: All tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/data/boardPresets.ts src/components/SizeSelector.vue src/components/__tests__/SizeSelector.test.ts
git commit -m "feat: add board size preset dropdown to SizeSelector"
```

---

### Task 2: Blank Canvas Mode

**Files:**
- Modify: `src/stores/beadStore.ts`
- Modify: `src/components/ControlPanel.vue`
- Modify: `src/pages/DesignPage.vue`
- Test: `src/stores/__tests__/beadStore.test.ts`

- [ ] **Step 1: Write failing test for initEmptyGrid**

```ts
// Add to src/stores/__tests__/beadStore.test.ts, inside the existing describe block:

  describe('initEmptyGrid', () => {
    it('creates a beadGrid with all null cells', () => {
      const store = useBeadStore()
      const palette: PaletteColor[] = [
        { id: 'w', name: 'White', hex: '#FFFFFF', brand: 'test' },
        { id: 'b', name: 'Black', hex: '#000000', brand: 'test' },
      ]
      store.initEmptyGrid(5, 3, palette)
      const grid = store.beadGrid
      expect(grid).not.toBeNull()
      expect(grid!.rows).toBe(5)
      expect(grid!.cols).toBe(3)
      expect(grid!.cells.length).toBe(5)
      expect(grid!.cells[0].length).toBe(3)
      expect(grid!.imageCols).toBe(3)
      expect(grid!.imageRows).toBe(5)
      // All cells should be null
      for (const row of grid!.cells) {
        for (const cell of row) {
          expect(cell.colorIndex).toBeNull()
        }
      }
    })

    it('sets palette on the grid', () => {
      const store = useBeadStore()
      const palette: PaletteColor[] = [
        { id: 'w', name: 'White', hex: '#FFFFFF', brand: 'test' },
      ]
      store.initEmptyGrid(2, 2, palette)
      expect(store.beadGrid!.palette).toEqual(palette)
    })

    it('resets progress and error', () => {
      const store = useBeadStore()
      store.progress = 50
      store.error = 'some error'
      store.initEmptyGrid(2, 2, [])
      expect(store.progress).toBe(0)
      expect(store.error).toBeNull()
    })
  })
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/stores/__tests__/beadStore.test.ts -t "initEmptyGrid"
```

Expected: 3 tests FAIL — `store.initEmptyGrid is not a function`.

- [ ] **Step 3: Add initEmptyGrid to beadStore**

Add inside `useBeadStore` function, before the `return` statement:

```ts
function initEmptyGrid(rows: number, cols: number, palette: PaletteColor[]) {
  const cells: BeadCell[][] = Array.from({ length: rows }, (_, r) =>
    Array.from({ length: cols }, (_, c) => ({
      row: r,
      col: c,
      colorIndex: null as number | null,
    })),
  )
  beadGrid.value = {
    rows,
    cols,
    cells,
    palette,
    imageCols: cols,
    imageRows: rows,
  }
  progress.value = 0
  error.value = null
}
```

Add to the `return` object:

```ts
initEmptyGrid,
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/stores/__tests__/beadStore.test.ts -t "initEmptyGrid"
```

Expected: 3 tests PASS.

- [ ] **Step 5: Modify ControlPanel to add creation mode tabs**

Replace the `<script setup>` section:

```vue
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

const props = defineProps<{
  hasGrid: boolean
  settings: BeadSettings
  brandNames: string[]
  selectedBrand: string
  palette: any[]
  creationMode: 'image' | 'blank'
}>()

const emit = defineEmits<{
  'upload': [file: File]
  'update:settings': [settings: BeadSettings]
  'remove-color': [id: string]
  'export': [config: ExportConfig]
  'import-drawing': []
  'update:creationMode': [mode: 'image' | 'blank']
  'create-blank': []
}>()

function setMode(mode: 'image' | 'blank') {
  emit('update:creationMode', mode)
}
</script>
```

Replace the template:

```vue
<template>
  <aside class="control-panel">
    <h2 class="title">拼豆工具</h2>

    <!-- Creation Mode Tabs -->
    <div class="mode-tabs">
      <button
        class="mode-tab"
        :class="{ active: creationMode === 'image' }"
        @click="setMode('image')"
      >
        🖼️ 从图片创建
      </button>
      <button
        class="mode-tab"
        :class="{ active: creationMode === 'blank' }"
        @click="setMode('blank')"
      >
        ✏️ 空白画布
      </button>
    </div>

    <div class="divider" />

    <!-- Image mode content -->
    <template v-if="creationMode === 'image'">
      <ImageUploader @upload="emit('upload', $event)" />

      <div class="divider" />

      <SizeSelector
        :modelValue="{ cols: settings.gridCols, rows: settings.gridRows, keepAspectRatio: settings.keepAspectRatio }"
        @update:modelValue="emit('update:settings', { ...settings, gridCols: $event.cols, gridRows: $event.rows, keepAspectRatio: $event.keepAspectRatio })"
      />

      <div class="divider" />

      <PalettePanel
        :brandNames="brandNames"
        :selectedBrand="selectedBrand"
        :palette="palette"
        :brushMode="brushStore.brushMode"
        :activeColorIndex="brushStore.activeColorIndex"
        @select-brand="paletteStore.selectBrand($event)"
        @remove-color="emit('remove-color', $event)"
        @select-color="brushStore.setActiveColor($event)"
      />

      <div class="divider" />

      <div class="section">
        <h3 class="section-title">色彩映射</h3>

        <label class="field">
          <span class="field-label">计算方式</span>
          <select
            :value="settings.colorCalcMethod"
            @change="emit('update:settings', { ...settings, colorCalcMethod: ($event.target as HTMLSelectElement).value as any })"
          >
            <option value="average">平均色彩</option>
            <option value="median">中位色彩</option>
            <option value="centerWeighted">中心加权</option>
            <option value="dominant">主导色彩</option>
            <option value="bucket">色桶主导</option>
          </select>
        </label>

        <div v-if="settings.colorCalcMethod === 'bucket'" class="field">
          <div class="slider-head">
            <span class="field-label">粒度</span>
            <span class="field-value">{{ settings.bucketLevels }}</span>
          </div>
          <input
            type="range" min="2" max="32" :value="settings.bucketLevels"
            @input="emit('update:settings', { ...settings, bucketLevels: Number(($event.target as HTMLInputElement).value) })"
          />
        </div>

        <div v-if="settings.colorCalcMethod === 'dominant'" class="field">
          <div class="slider-head">
            <span class="field-label">容差</span>
            <span class="field-value">{{ settings.tolerance }}</span>
          </div>
          <input
            type="range" min="5" max="100" :value="settings.tolerance"
            @input="emit('update:settings', { ...settings, tolerance: Number(($event.target as HTMLInputElement).value) })"
          />
        </div>

        <label class="field">
          <span class="field-label">映射方式</span>
          <select
            :value="settings.colorMatchMethod"
            @change="emit('update:settings', { ...settings, colorMatchMethod: ($event.target as HTMLSelectElement).value as any })"
          >
            <option value="deltaE">Delta E</option>
            <option value="ciede2000">CIEDE2000</option>
            <option value="rgb">RGB 距离</option>
            <option value="weightedRgb">加权 RGB</option>
          </select>
        </label>
      </div>
    </template>

    <!-- Blank mode content -->
    <template v-if="creationMode === 'blank'">
      <SizeSelector
        :modelValue="{ cols: settings.gridCols, rows: settings.gridRows, keepAspectRatio: settings.keepAspectRatio }"
        @update:modelValue="emit('update:settings', { ...settings, gridCols: $event.cols, gridRows: $event.rows, keepAspectRatio: $event.keepAspectRatio })"
      />

      <div class="divider" />

      <PalettePanel
        :brandNames="brandNames"
        :selectedBrand="selectedBrand"
        :palette="palette"
        :brushMode="false"
        :activeColorIndex="null"
        @select-brand="paletteStore.selectBrand($event)"
        @remove-color="emit('remove-color', $event)"
      />

      <div class="divider" />

      <button
        class="create-blank-btn"
        :disabled="!palette.length"
        @click="emit('create-blank')"
      >
        创建画布
      </button>
      <p v-if="!palette.length" class="hint">请先选择调色板</p>
    </template>

    <div class="divider" />

    <!-- Brush Toolbar (shared) -->
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

    <div v-if="beadStore.beadGrid" class="section">
      <RouterLink to="/focus" class="focus-entry-btn">
        🎯 进入专心拼豆模式
      </RouterLink>
    </div>

    <ExportButtons
      :hasGrid="hasGrid"
      :defaultDisplay="settings.display"
      :gridCols="settings.gridCols"
      :gridRows="settings.gridRows"
      @export="config => emit('export', config)"
      @import-drawing="emit('import-drawing')"
    />
  </aside>
</template>
```

Add new styles (append to existing `<style scoped>`):

```css
.mode-tabs {
  display: flex;
  gap: 0;
  border: 1px solid var(--border);
  border-radius: 6px;
  overflow: hidden;
}
.mode-tab {
  flex: 1;
  padding: 6px 8px;
  border: none;
  background: var(--bg);
  color: var(--text);
  font-size: 12px;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}
.mode-tab:first-child {
  border-right: 1px solid var(--border);
}
.mode-tab.active {
  background: var(--accent, #aa3bff);
  color: #fff;
}
.create-blank-btn {
  width: 100%;
  padding: 10px;
  border: none;
  border-radius: 6px;
  background: var(--accent, #aa3bff);
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: filter 0.2s;
}
.create-blank-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.create-blank-btn:hover:not(:disabled) {
  filter: brightness(1.1);
}
.hint {
  font-size: 11px;
  color: var(--text);
  opacity: 0.7;
  margin: 0;
}
```

- [ ] **Step 6: Modify DesignPage to handle creation mode**

In `src/pages/DesignPage.vue`, add to the `<script setup>`:

```ts
const creationMode = ref<'image' | 'blank'>('image')

function onCreateBlank() {
  const s = beadStore.settings
  beadStore.initEmptyGrid(s.gridRows, s.gridCols, paletteStore.palette)
  brushStore.brushMode = true
}
```

Update the `ControlPanel` usage in template — add props and event handlers:

```vue
<ControlPanel
  :hasGrid="!!beadStore.beadGrid"
  :settings="beadStore.settings"
  :brandNames="paletteStore.brandNames"
  :selectedBrand="paletteStore.selectedBrand"
  :palette="paletteStore.palette"
  :creationMode="creationMode"
  @upload="onUpload"
  @update:settings="onUpdateSettings"
  @remove-color="onRemoveColor"
  @export="onExport"
  @import-drawing="onImportFromDrawing"
  @update:creationMode="creationMode = $event"
  @create-blank="onCreateBlank"
/>
```

Update the empty state text to be contextual:

```vue
<div v-if="!beadStore.beadGrid && beadStore.progress === 0" class="empty-state">
  <p v-if="creationMode === 'image'">上传图片开始</p>
  <p v-else>点击「创建画布」开始自由创作</p>
</div>
```

- [ ] **Step 7: Run all tests**

```bash
npx vitest run
```

Expected: All tests PASS (existing + new initEmptyGrid tests).

- [ ] **Step 8: Commit**

```bash
git add src/stores/beadStore.ts src/stores/__tests__/beadStore.test.ts src/components/ControlPanel.vue src/pages/DesignPage.vue
git commit -m "feat: add blank canvas mode with image/blank tab switching"
```

---

### Task 3: Export Bead Count Total

**Files:**
- Modify: `src/composables/useExport.ts`
- Modify: `src/utils/exportPdf.ts`
- Test: `src/composables/__tests__/useExport.test.ts`

- [ ] **Step 1: Write failing test for total line in renderExportCanvas**

```ts
// Add to src/composables/__tests__/useExport.test.ts, after existing imports:
import { renderExportCanvas, countColorUsage } from '../useExport'

// Add new describe block:
describe('renderExportCanvas total count', () => {
  it('includes total bead count in the legend area', () => {
    const grid = makeTestGrid() // 2x2 grid, 3 colored cells + 1 null
    const gridLines = makeGridLines()
    const canvas = renderExportCanvas(grid, 20, gridLines, 1)
    const ctx = canvas.getContext('2d')!
    // Collect fillText calls to find the "总计" line
    const texts: string[] = []
    const origFillText = ctx.fillText
    ctx.fillText = function (text: string, ...args: any[]) {
      texts.push(text)
      return origFillText.call(this, text, ...args as any)
    }
    renderExportCanvas(grid, 20, gridLines, 1)
    const totalLine = texts.find(t => t.includes('总计'))
    expect(totalLine).toBeDefined()
    expect(totalLine).toContain('3') // 3 colored cells
  })
})

describe('countColorUsage', () => {
  it('returns total count of colored cells', () => {
    const grid = makeTestGrid()
    const counts = countColorUsage(grid)
    let total = 0
    for (const c of counts.values()) total += c
    expect(total).toBe(3)
  })

  it('excludes null cells from count', () => {
    const grid = makeTestGrid()
    const counts = countColorUsage(grid)
    for (const [idx] of counts) {
      expect(idx).not.toBeNull()
    }
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/composables/__tests__/useExport.test.ts -t "total"
```

Expected: Tests referencing "总计" fail.

- [ ] **Step 3: Add total line to renderExportCanvas**

In `src/composables/useExport.ts`, in `renderExportCanvas()`, after the legend rendering loop (after line ~399, after the last `ctx.fillText` in the legend loop), add:

```ts
  // --- Total bead count ---
  const totalBeads = [...counts.values()].reduce((sum, c) => sum + c, 0)
  const totalY = legendStartY + legendRows * (legendItemH + 2) + 4
  ctx.font = `bold ${cellSize * 0.8}px sans-serif`
  ctx.fillStyle = '#333333'
  ctx.textAlign = 'left'
  ctx.fillText(`总计：${totalBeads} 颗`, originX, totalY)
```

- [ ] **Step 4: Add total line to exportPdf**

In `src/utils/exportPdf.ts`, after the legend rendering loop (after `y -= Math.max(10, legendSwatchSize + 4)` inside the `for` loop), add a total line at `y`. Insert after the legend loop closes, before the `pdfBytes` variable:

```ts
  // Total bead count — compute from grid
  const colorCounts = new Map<number, number>()
  for (const row of grid.cells) {
    for (const cell of row) {
      if (cell.colorIndex !== null) {
        colorCounts.set(cell.colorIndex, (colorCounts.get(cell.colorIndex) ?? 0) + 1)
      }
    }
  }
  let totalBeads = 0
  for (const c of colorCounts.values()) totalBeads += c

  y -= 4
  page.drawText(`总计：${totalBeads} 颗`, {
    x: margin, y, size: legendFontSize, font: boldFont,
  })
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npx vitest run src/composables/__tests__/useExport.test.ts -t "total"
```

Expected: Tests PASS.

- [ ] **Step 6: Run full test suite**

```bash
npx vitest run
```

Expected: All tests PASS.

- [ ] **Step 7: Commit**

```bash
git add src/composables/useExport.ts src/utils/exportPdf.ts src/composables/__tests__/useExport.test.ts
git commit -m "feat: add total bead count line to export legend"
```

---

### Task 4: Connected-Component Color Replace

**Files:**
- Modify: `src/stores/brushStore.ts`
- Modify: `src/components/BeadPreview.vue`
- Test: `src/stores/__tests__/brushStore.test.ts`

- [ ] **Step 1: Write failing tests for flood-fill replace**

```ts
// Add to src/stores/__tests__/brushStore.test.ts, after the last describe block:

  describe('floodReplace', () => {
    function makeReplaceTestGrid(): BeadGrid {
      const palette: PaletteColor[] = [
        { id: 'w', name: 'White', hex: '#FFFFFF', brand: 'test' },
        { id: 'b', name: 'Black', hex: '#000000', brand: 'test' },
        { id: 'r', name: 'Red', hex: '#FF0000', brand: 'test' },
      ]
      // 4x4 grid: White block in top-left 2x2, separated White in bottom-right
      // Layout:
      //   W W B B
      //   W W B B
      //   B B W B   <-- isolated White at [2][2], NOT connected to top-left block
      //   B B B W
      return {
        rows: 4, cols: 4, palette,
        cells: [
          [
            { row: 0, col: 0, colorIndex: 0 },
            { row: 0, col: 1, colorIndex: 0 },
            { row: 0, col: 2, colorIndex: 1 },
            { row: 0, col: 3, colorIndex: 1 },
          ],
          [
            { row: 1, col: 0, colorIndex: 0 },
            { row: 1, col: 1, colorIndex: 0 },
            { row: 1, col: 2, colorIndex: 1 },
            { row: 1, col: 3, colorIndex: 1 },
          ],
          [
            { row: 2, col: 0, colorIndex: 1 },
            { row: 2, col: 1, colorIndex: 1 },
            { row: 2, col: 2, colorIndex: 0 }, // isolated White
            { row: 2, col: 3, colorIndex: 1 },
          ],
          [
            { row: 3, col: 0, colorIndex: 1 },
            { row: 3, col: 1, colorIndex: 1 },
            { row: 3, col: 2, colorIndex: 1 },
            { row: 3, col: 3, colorIndex: 0 }, // isolated White
          ],
        ],
        imageCols: 4,
        imageRows: 4,
      }
    }

    it('initReplace computes connected component cells', () => {
      const bead = useBeadStore()
      bead.beadGrid = makeReplaceTestGrid()
      const brush = useBrushStore()

      brush.initReplace(0, 0) // top-left White block
      expect(brush.replaceCellCount).toBe(4) // 2x2 block
      expect(brush.showReplaceModal).toBe(true)
      expect(brush.replaceSourceIndex).toBe(0)
    })

    it('initReplace only captures connected cells, not all same-color cells', () => {
      const bead = useBeadStore()
      bead.beadGrid = makeReplaceTestGrid()
      const brush = useBrushStore()

      brush.initReplace(0, 0) // top-left White
      expect(brush.replaceCellCount).toBe(4) // NOT 6 (the two isolated whites)

      // The isolated White at [2][2] should still be White after replace
      brush.confirmReplace(2) // Replace with Red
      expect(bead.beadGrid!.cells[2][2].colorIndex).toBe(0) // unchanged
    })

    it('confirmReplace changes the entire connected component', () => {
      const bead = useBeadStore()
      bead.beadGrid = makeReplaceTestGrid()
      const brush = useBrushStore()

      brush.initReplace(0, 0) // top-left 2x2 White block
      brush.confirmReplace(2) // Replace with Red

      // Top-left 2x2 should now be Red
      expect(bead.beadGrid!.cells[0][0].colorIndex).toBe(2)
      expect(bead.beadGrid!.cells[0][1].colorIndex).toBe(2)
      expect(bead.beadGrid!.cells[1][0].colorIndex).toBe(2)
      expect(bead.beadGrid!.cells[1][1].colorIndex).toBe(2)
    })

    it('confirmReplace pushes an undo entry', () => {
      const bead = useBeadStore()
      bead.beadGrid = makeReplaceTestGrid()
      const brush = useBrushStore()

      brush.initReplace(0, 0)
      brush.confirmReplace(2)

      expect(brush.undoStack.length).toBe(1)
      expect(brush.undoStack[0].cells.length).toBe(4)
    })

    it('undo after confirmReplace restores original colors', () => {
      const bead = useBeadStore()
      bead.beadGrid = makeReplaceTestGrid()
      const brush = useBrushStore()

      brush.initReplace(0, 0)
      brush.confirmReplace(2)
      brush.undo()

      expect(bead.beadGrid!.cells[0][0].colorIndex).toBe(0)
      expect(bead.beadGrid!.cells[0][1].colorIndex).toBe(0)
    })

    it('initReplace does nothing for null cell', () => {
      const bead = useBeadStore()
      bead.beadGrid = {
        rows: 2, cols: 2,
        palette: [{ id: 'w', name: 'White', hex: '#FFFFFF', brand: 'test' }],
        cells: [
          [{ row: 0, col: 0, colorIndex: null }, { row: 0, col: 1, colorIndex: 0 }],
          [{ row: 1, col: 0, colorIndex: 0 }, { row: 1, col: 1, colorIndex: 0 }],
        ],
        imageCols: 2,
        imageRows: 2,
      }
      const brush = useBrushStore()
      brush.initReplace(0, 0)
      expect(brush.showReplaceModal).toBe(false)
      expect(brush.replaceCellCount).toBe(0)
    })

    it('cancelReplace resets state', () => {
      const bead = useBeadStore()
      bead.beadGrid = makeReplaceTestGrid()
      const brush = useBrushStore()

      brush.initReplace(0, 0)
      expect(brush.showReplaceModal).toBe(true)

      brush.cancelReplace()
      expect(brush.showReplaceModal).toBe(false)
      expect(brush.replaceSourceIndex).toBeNull()
      expect(brush.replaceCellCount).toBe(0)
    })

    it('confirmReplace does nothing when no replace is active', () => {
      const bead = useBeadStore()
      bead.beadGrid = makeReplaceTestGrid()
      const brush = useBrushStore()

      expect(() => brush.confirmReplace(2)).not.toThrow()
      expect(brush.undoStack.length).toBe(0)
    })

    it('flood fill respects grid boundaries (single cell)', () => {
      const bead = useBeadStore()
      bead.beadGrid = makeReplaceTestGrid()
      const brush = useBrushStore()

      brush.initReplace(2, 2) // isolated White, single cell
      expect(brush.replaceCellCount).toBe(1)

      brush.confirmReplace(1) // Replace with Black
      expect(bead.beadGrid!.cells[2][2].colorIndex).toBe(1)
    })

    it('clearReplaceState resets all replace-related state', () => {
      const bead = useBeadStore()
      bead.beadGrid = makeReplaceTestGrid()
      const brush = useBrushStore()

      brush.initReplace(0, 0)
      brush.cancelReplace()

      expect(brush.showReplaceModal).toBe(false)
      expect(brush.replaceSourceIndex).toBeNull()
      expect(brush.replaceCellCount).toBe(0)
    })
  })
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/stores/__tests__/brushStore.test.ts -t "floodReplace"
```

Expected: All tests FAIL — `brush.initReplace is not a function`.

- [ ] **Step 3: Add flood-fill state and methods to brushStore**

In `src/stores/brushStore.ts`, add new state after existing ref declarations:

```ts
  // ---- Color replace (flood-fill connected component) ----
  const showReplaceModal = ref(false)
  const replaceSourceIndex = ref<number | null>(null)
  const replaceCellCount = ref(0)
  let replaceCellsList: { row: number; col: number }[] = []
```

Add flood-fill helper function (inside the `useBrushStore` function, before the methods):

```ts
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
```

Add replace methods (before the `return` statement):

```ts
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
```

Add to the `return` object:

```ts
    showReplaceModal,
    replaceSourceIndex,
    replaceCellCount,
    initReplace,
    confirmReplace,
    cancelReplace,
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/stores/__tests__/brushStore.test.ts -t "floodReplace"
```

Expected: All tests PASS.

- [ ] **Step 5: Add right-click context menu and replace modal to BeadPreview**

Add to `<script setup>` in `src/components/BeadPreview.vue`, after existing state:

```ts
// ---- Right-click context menu for color replace ----
const contextMenu = ref<{ show: boolean; x: number; y: number; row: number; col: number } | null>(null)

function onContextMenu(event: MouseEvent) {
  if (!canvasRef.value || !beadStore.beadGrid) return
  event.preventDefault()
  const cell = resolveCell(event)
  if (!cell) return
  const colorIndex = beadStore.beadGrid.cells[cell.row][cell.col].colorIndex
  if (colorIndex === null) return // only show menu for colored cells

  const rect = canvasRef.value.getBoundingClientRect()
  contextMenu.value = {
    show: true,
    x: event.clientX,
    y: event.clientY,
    row: cell.row,
    col: cell.col,
  }
}

function closeContextMenu() {
  contextMenu.value = null
}

function onReplaceClick() {
  if (!contextMenu.value) return
  brushStore.initReplace(contextMenu.value.row, contextMenu.value.col)
  closeContextMenu()

  // Auto-open brush mode so user sees the palette for target selection
  if (!brushStore.brushMode) {
    brushStore.toggleBrushMode()
  }
}

function onConfirmReplace(targetIndex: number) {
  brushStore.confirmReplace(targetIndex)
  scheduleRender(true)
}

function onCancelReplaceModal() {
  brushStore.cancelReplace()
}

const replaceSourceColor = computed(() => {
  const idx = brushStore.replaceSourceIndex
  if (idx === null || !beadStore.beadGrid) return null
  return beadStore.beadGrid.palette[idx] ?? null
})
```

Add `@contextmenu` to the canvas element — update the `<canvas>` tag:

```vue
<canvas ref="canvasRef" :style="{ cursor: cursorStyle }" @mousemove="onMouseMove" @mouseleave="onMouseLeave" @wheel="handleWheel" @mousedown="onMouseDown" @contextmenu="onContextMenu" />
```

Add context menu and replace modal templates — append inside the `.preview-canvas-wrap` div, after the canvas element:

```vue
            <!-- Right-click context menu -->
            <Teleport to="body">
              <div
                v-if="contextMenu?.show"
                class="context-menu"
                :style="{ left: contextMenu.x + 'px', top: contextMenu.y + 'px' }"
              >
                <button class="context-menu-item" @click="onReplaceClick">
                  🔄 替换为…
                </button>
              </div>
            </Teleport>

            <!-- Replace target color modal -->
            <Teleport to="body">
              <div v-if="brushStore.showReplaceModal" class="replace-overlay" @click.self="onCancelReplaceModal">
                <div class="replace-modal">
                  <p class="replace-title">
                    替换连通块
                  </p>
                  <p class="replace-info" v-if="replaceSourceColor">
                    将 <span class="color-tag" :style="{ background: replaceSourceColor.hex }">{{ replaceSourceColor.name }}</span>
                    的 {{ brushStore.replaceCellCount }} 颗珠子替换为：
                  </p>
                  <div class="replace-palette">
                    <div
                      v-for="(c, i) in paletteColors"
                      :key="c.index"
                      class="replace-swatch"
                      :style="{ background: c.hex }"
                      :title="c.name || c.hex"
                      @click="onConfirmReplace(c.index)"
                    >
                      <span class="replace-swatch-label" :style="{ color: getTextColor(c.hex) }">
                        {{ c.name.split(/[\s_]+/)[0] || c.hex }}
                      </span>
                    </div>
                  </div>
                  <div class="replace-actions">
                    <button class="btn-cancel" @click="onCancelReplaceModal">取消</button>
                  </div>
                </div>
              </div>
            </Teleport>
```

Add styles (append to `<style scoped>`):

```css
/* Context menu */
.context-menu {
  position: fixed;
  z-index: 200;
  background: var(--bg, #fff);
  border: 1px solid var(--border, #e5e4e7);
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
  padding: 4px 0;
  min-width: 140px;
}
.context-menu-item {
  display: block;
  width: 100%;
  padding: 8px 16px;
  border: none;
  background: none;
  font-size: 13px;
  color: var(--text-h, #1a1a2e);
  cursor: pointer;
  text-align: left;
}
.context-menu-item:hover {
  background: var(--accent-bg, rgba(170, 59, 255, 0.1));
}

/* Replace modal */
.replace-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 150;
}
.replace-modal {
  background: var(--bg, #fff);
  border-radius: 12px;
  padding: 24px;
  max-width: 360px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
}
.replace-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-h, #1a1a2e);
  margin: 0 0 8px;
}
.replace-info {
  font-size: 13px;
  color: var(--text, #6b6375);
  margin: 0 0 12px;
}
.color-tag {
  display: inline-block;
  padding: 1px 8px;
  border-radius: 4px;
  color: #fff;
  font-size: 12px;
}
.replace-palette {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 16px;
  max-height: 200px;
  overflow-y: auto;
}
.replace-swatch {
  width: 48px;
  height: 32px;
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.15s, box-shadow 0.15s;
  border: 1px solid var(--border, #e5e4e7);
}
.replace-swatch:hover {
  transform: scale(1.15);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}
.replace-swatch-label {
  font-size: 10px;
  font-family: monospace;
  font-weight: 700;
  pointer-events: none;
}
.replace-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
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
```

- [ ] **Step 6: Close context menu on outside click**

Add to `onMounted`:

```ts
document.addEventListener('click', closeContextMenu)
```

Add to `onUnmounted`:

```ts
document.removeEventListener('click', closeContextMenu)
```

- [ ] **Step 7: Run all tests**

```bash
npx vitest run
```

Expected: All tests PASS.

- [ ] **Step 8: Type-check**

```bash
npx vue-tsc -b
```

Expected: No errors.

- [ ] **Step 9: Commit**

```bash
git add src/stores/brushStore.ts src/stores/__tests__/brushStore.test.ts src/components/BeadPreview.vue
git commit -m "feat: add connected-component color replace via right-click context menu"
```

---

## Summary

| Task | Feature | New Files | Changed Files |
|------|---------|-----------|---------------|
| 1 | Board presets | `src/data/boardPresets.ts` | `SizeSelector.vue`, test |
| 2 | Blank canvas | - | `beadStore.ts`, `ControlPanel.vue`, `DesignPage.vue`, test |
| 3 | Export total | - | `useExport.ts`, `exportPdf.ts`, test |
| 4 | Color replace | - | `brushStore.ts`, `BeadPreview.vue`, test |

After all 4 tasks: `npm run test && npx vue-tsc -b` must pass.
