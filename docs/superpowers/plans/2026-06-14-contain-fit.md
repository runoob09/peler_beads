# 保持原图比例的网格映射 — 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将网格映射从 cover 模式改为 contain 模式，保持原图比例不变形

**Architecture:** `resizeImage` 改用 `Math.min` 缩放、居中绘制，返回图片边界。Pipeline 根据边界将区域外单元格设为 `colorIndex: null`。渲染层跳过 null 单元格。

**Tech Stack:** Vue 3 + TypeScript + Canvas + Vitest

---

### Task 1: 类型定义变更

**Files:**
- Modify: `src/types/index.ts:9-21`

- [ ] **Step 1: 修改 BeadCell.colorIndex 为 nullable，BeadGrid 加 imageCols/imageRows**

```typescript
export interface BeadCell {
  row: number
  col: number
  colorIndex: number | null
}

export interface BeadGrid {
  rows: number
  cols: number
  cells: BeadCell[][]
  palette: PaletteColor[]
  imageCols: number
  imageRows: number
}
```

- [ ] **Step 2: 运行全部测试，收集类型错误**

```bash
npx vue-tsc -b 2>&1
```
预期：多处类型错误（colorIndex 为 `number` 但被赋为 `number | null` 等）

- [ ] **Step 3: 提交类型变更**

```bash
git add src/types/index.ts
git commit -m "feat: BeadCell.colorIndex 改为 number|null，BeadGrid 加 imageCols/imageRows"
```

---

### Task 2: resizeImage 改为 contain 模式并返回图片边界

**Files:**
- Modify: `src/composables/useImageProcessor.ts:1-29`
- Test: `src/composables/__tests__/useImageProcessor.test.ts` (追加)

- [ ] **Step 1: 编写 resizeImage 测试**

在 `src/composables/__tests__/useImageProcessor.test.ts` 末尾追加：

```typescript
import { resizeImage } from '../useImageProcessor'

function createTestImage(w: number, h: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  return canvas
}

describe('resizeImage', () => {
  it('contain fits wide image within square bounds', () => {
    const src = createTestImage(200, 100)
    const { canvas, imageX, imageY, imageW, imageH } = resizeImage(src, 30, 30, true)
    expect(canvas.width).toBe(30)
    expect(canvas.height).toBe(30)
    // 200:100 → 30:15 fits in 30×30
    expect(imageW).toBe(30)
    expect(imageH).toBe(15)
    // centered vertically → offsetY = (30-15)/2 = 7.5 → 7
    expect(imageX).toBe(0)
    expect(imageY).toBe(7)
  })

  it('contain fits tall image within square bounds', () => {
    const src = createTestImage(100, 200)
    const { canvas, imageX, imageY, imageW, imageH } = resizeImage(src, 30, 30, true)
    expect(canvas.width).toBe(30)
    expect(canvas.height).toBe(30)
    // 100:200 → 15:30 fits in 30×30
    expect(imageW).toBe(15)
    expect(imageH).toBe(30)
    expect(imageX).toBe(7)
    expect(imageY).toBe(0)
  })

  it('contain same-aspect fits exactly', () => {
    const src = createTestImage(100, 100)
    const { canvas, imageX, imageY, imageW, imageH } = resizeImage(src, 30, 30, true)
    expect(imageW).toBe(30)
    expect(imageH).toBe(30)
    expect(imageX).toBe(0)
    expect(imageY).toBe(0)
  })

  it('keepAspectRatio false stretches to exact size', () => {
    const src = createTestImage(200, 100)
    const { canvas, imageX, imageY, imageW, imageH } = resizeImage(src, 30, 30, false)
    expect(canvas.width).toBe(30)
    expect(canvas.height).toBe(30)
    // No centering when not keeping aspect ratio
    expect(imageW).toBe(30)
    expect(imageH).toBe(30)
    expect(imageX).toBe(0)
    expect(imageY).toBe(0)
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

```bash
npx vitest run src/composables/__tests__/useImageProcessor.test.ts 2>&1
```
预期：`resizeImage is not a function` 或 `TypeError: resizeImage(...).canvas is undefined`

- [ ] **Step 3: 实现新的 resizeImage**

修改 `src/composables/useImageProcessor.ts:1-29`：

```typescript
export interface ResizeResult {
  canvas: HTMLCanvasElement
  imageX: number
  imageY: number
  imageW: number
  imageH: number
}

export function resizeImage(
  source: HTMLImageElement | HTMLCanvasElement | ImageBitmap,
  targetWidth: number,
  targetHeight: number,
  keepAspectRatio: boolean,
): ResizeResult {
  const canvas = document.createElement('canvas')
  canvas.width = targetWidth
  canvas.height = targetHeight
  const ctx = canvas.getContext('2d')
  if (!ctx) return { canvas, imageX: 0, imageY: 0, imageW: targetWidth, imageH: targetHeight }

  if (!keepAspectRatio) {
    ctx.drawImage(source, 0, 0, targetWidth, targetHeight)
    return { canvas, imageX: 0, imageY: 0, imageW: targetWidth, imageH: targetHeight }
  }

  const srcW = source.width
  const srcH = source.height

  const scale = Math.min(targetWidth / srcW, targetHeight / srcH)
  const imageW = Math.round(srcW * scale)
  const imageH = Math.round(srcH * scale)
  const imageX = Math.floor((targetWidth - imageW) / 2)
  const imageY = Math.floor((targetHeight - imageH) / 2)

  ctx.drawImage(source, imageX, imageY, imageW, imageH)
  return { canvas, imageX, imageY, imageW, imageH }
}
```

- [ ] **Step 4: 运行测试确认通过**

```bash
npx vitest run src/composables/__tests__/useImageProcessor.test.ts 2>&1
```
预期：全部测试 PASS

- [ ] **Step 5: 提交**

```bash
git add src/composables/useImageProcessor.ts src/composables/__tests__/useImageProcessor.test.ts
git commit -m "feat: resizeImage contain 模式，返回图片边界信息"
```

---

### Task 3: 适配 useBeadPipeline 处理空单元格

**Files:**
- Modify: `src/composables/useBeadPipeline.ts:29-80`
- Test: `src/composables/__tests__/useBeadPipeline.test.ts`

- [ ] **Step 1: 确认现有测试仍可编译后失败**

```bash
npx vitest run src/composables/__tests__/useBeadPipeline.test.ts 2>&1
```
预期：类型或运行时错误（resizeImage 返回类型变了）

- [ ] **Step 2: 修改 useBeadPipeline.ts**

在 `process` 函数中，将 `resizeImage` 调用改为解构新返回类型，并在 dithering 后 nullify 区域外单元格：

```typescript
import { loadImageFromFile, resizeImage, applyAdjustments, posterize, type ResizeResult } from './useImageProcessor'
```

修改 `process` 函数中的 resize 处理部分（约第 48 行）：

```typescript
const { canvas: resized, imageX, imageY, imageW, imageH } = resizeImage(img, s.gridCols, s.gridRows, s.keepAspectRatio)
progress.value = 50

const ctx = resized.getContext('2d')
if (!ctx) {
  error.value = 'Canvas 上下文不可用'
  beadGrid.value = null
  progress.value = 0
  return
}
let imageData = ctx.getImageData(0, 0, s.gridCols, s.gridRows)

imageData = applyAdjustments(
  imageData,
  s.adjustments.brightness,
  s.adjustments.contrast,
  s.adjustments.saturation,
)
progress.value = 70

if (s.colorMapping === 'cartoon') {
  imageData = posterize(imageData)
}
progress.value = 80

const grid = applyDithering(imageData, palette, s.dithering.algorithm, s.dithering.strength)
progress.value = 95

// Nullify cells outside the actual image area
for (let row = 0; row < grid.rows; row++) {
  for (let col = 0; col < grid.cols; col++) {
    if (col < imageX || col >= imageX + imageW || row < imageY || row >= imageY + imageH) {
      grid.cells[row][col].colorIndex = null
    }
  }
}
grid.imageCols = imageW
grid.imageRows = imageH

beadGrid.value = grid
progress.value = 100
```

- [ ] **Step 3: 运行测试确认通过**

```bash
npx vitest run src/composables/__tests__/useBeadPipeline.test.ts 2>&1
```
预期：全部测试 PASS

- [ ] **Step 4: 运行全部测试**

```bash
npm run test 2>&1
```

- [ ] **Step 5: 提交**

```bash
git add src/composables/useBeadPipeline.ts
git commit -m "feat: pipeline 适配 contain 模式，区域外单元格 colorIndex 设为 null"
```

---

### Task 4: 适配 dithering 和 useColorMatcher

**Files:**
- Modify: `src/composables/useDither.ts:72` (cell 创建处，colorIndex 类型适配)
- Modify: `src/utils/dithering.ts:38-76` (cell 创建处)
- Test: `src/composables/__tests__/useDither.test.ts`，`src/utils/__tests__/dithering.test.ts`

- [ ] **Step 1: 修改 useDither.ts applyDithering 返回值类型**

`applyDithering` 返回的 `BeadGrid` 还没有 `imageCols`/`imageRows`。需要在返回对象中加上（Task 3 的 pipeline 会覆盖它们，这里给初始值）：

```typescript
return {
  rows: height,
  cols: width,
  cells,
  palette,
  imageCols: width,
  imageRows: height,
}
```

注意：`applyDithering` 中所有 cell 创建的 `colorIndex` 都是 `number`（不是 null），这些赋值兼容 `number | null` 类型，无需改动 cell 创建处。

- [ ] **Step 2: 运行测试确认类型和测试都通过**

```bash
npx vitest run src/composables/__tests__/useDither.test.ts src/utils/__tests__/dithering.test.ts 2>&1
```

- [ ] **Step 3: 提交**

```bash
git add src/composables/useDither.ts
git commit -m "feat: applyDithering 返回带 imageCols/imageRows 的 BeadGrid"
```

---

### Task 5: 适配渲染层跳过空单元格

**Files:**
- Modify: `src/composables/useExport.ts:49-84` (renderGridToCanvas) 和 `src/composables/useExport.ts:132-301` (renderExportCanvas) 和 `src/composables/useExport.ts:131-140` (countColorUsage)

- [ ] **Step 1: 修改 renderGridToCanvas 跳过 null 单元格**

在 `renderGridToCanvas` 的 cell 渲染循环中（约第 49-84 行），每个 cell 处理前加 null check：

```typescript
for (let row = 0; row < grid.rows; row++) {
  for (let col = 0; col < grid.cols; col++) {
    const cell = grid.cells[row][col]
    if (cell.colorIndex === null) continue
    const color = grid.palette[cell.colorIndex]
    // ... 后续渲染逻辑不变
  }
}
```

- [ ] **Step 2: 修改 renderExportCanvas 跳过 null 单元格**

在 `renderExportCanvas` 的 cell 渲染循环中（约第 212-230 行），同样在 cell 访问 colorIndex 前加 null check：

```typescript
for (let row = 0; row < grid.rows; row++) {
  for (let col = 0; col < grid.cols; col++) {
    const cell = grid.cells[row][col]
    if (cell.colorIndex === null) continue
    const color = grid.palette[cell.colorIndex]
    // ... 后续渲染逻辑不变
  }
}
```

- [ ] **Step 3: 修改 countColorUsage 跳过 null 单元格**

```typescript
export function countColorUsage(grid: BeadGrid): Map<number, number> {
  const counts = new Map<number, number>()
  for (const row of grid.cells) {
    for (const cell of row) {
      if (cell.colorIndex === null) continue
      counts.set(cell.colorIndex, (counts.get(cell.colorIndex) ?? 0) + 1)
    }
  }
  return counts
}
```

- [ ] **Step 4: 运行全部测试**

```bash
npm run test 2>&1
```

- [ ] **Step 5: 提交**

```bash
git add src/composables/useExport.ts
git commit -m "feat: 渲染层跳过 colorIndex 为 null 的空单元格"
```

---

### Task 6: 适配 BeadPreview tooltip 处理空单元格

**Files:**
- Modify: `src/components/BeadPreview.vue:92-95`

- [ ] **Step 1: 修改 hoveredColor computed**

```typescript
const hoveredColor = computed(() => {
  if (!hoveredCell.value || !props.beadGrid) return null
  const { row, col } = hoveredCell.value
  const colorIndex = props.beadGrid.cells[row][col].colorIndex
  if (colorIndex === null) return null
  return props.beadGrid.palette[colorIndex]
})
```

- [ ] **Step 2: 运行测试**

```bash
npx vitest run src/components/__tests__/BeadPreview.test.ts 2>&1
```

- [ ] **Step 3: 提交**

```bash
git add src/components/BeadPreview.vue
git commit -m "feat: BeadPreview tooltip 适配 null colorIndex"
```

---

### Task 7: 最终验证

- [ ] **Step 1: 运行全部测试**

```bash
npm run test 2>&1
```
预期：所有 93+ 测试 PASS

- [ ] **Step 2: 类型检查**

```bash
npx vue-tsc -b 2>&1
```
预期：无错误

- [ ] **Step 3: 提交最终调整（如有）**

```bash
git add -A
git commit -m "chore: contain 模式最终验证通过"
```
