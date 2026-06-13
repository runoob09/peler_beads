# 图片转拼豆工具 — 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现一个 Vue 3 图片转拼豆图案工具，支持色彩匹配、抖动、Canvas 预览和 PNG/PDF 导出。

**Architecture:** Vue 3 SFC + composables 单向数据流。图像处理用离屏 Canvas，网格渲染用 Canvas + 透明交互层。色板数据来自 get-colors-from-beans 预提取的 JSON。

**Tech Stack:** Vue 3, TypeScript, Vite 8, Vitest + @vue/test-utils, pdf-lib

---

## Phase 0: 项目初始化

### Task 0.1: Git 初始化 & .gitignore

**Files:**
- Create: `.gitignore` (已存在，验证)

- [ ] **Step 1: 初始化 git 仓库**

```bash
cd /home/zhang-jiahao/code/perler-beads
git init
git add .
git commit -m "chore: initial Vue 3 + Vite scaffold"
```

### Task 0.2: 安装依赖

**Files:**
- Modify: `package.json`

- [ ] **Step 1: 安装 vitest, @vue/test-utils, happy-dom, pdf-lib**

```bash
cd /home/zhang-jiahao/code/perler-beads
npm install -D vitest @vue/test-utils happy-dom
npm install pdf-lib
```

- [ ] **Step 2: 配置 vitest — 在 vite.config.ts 中添加 test 配置**

```typescript
/// <reference types="vitest" />
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  test: {
    environment: 'happy-dom',
    include: ['src/**/*.{test,spec}.{ts,js}'],
  },
})
```

- [ ] **Step 3: 在 package.json 添加 test 脚本**

在 `scripts` 中添加：
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 4: 验证**

```bash
npx vitest run
# Expected: No test files found (非错误退出)
```

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json vite.config.ts
git commit -m "chore: add vitest, @vue/test-utils, pdf-lib dependencies"
```

### Task 0.3: 复制色板数据 & 创建目录结构

**Files:**
- Create: `src/data/get-colors.json`
- Create: `src/data/colorMap.json`
- Create: `src/data/palettes.ts`
- Create: all empty directories

- [ ] **Step 1: 复制数据文件并创建目录**

```bash
mkdir -p src/{composables,components,utils,types,data}
# 复制数据文件（如果尚未在 src/data/）
cp get-colors-from-beans/get-colors.json src/data/
cp get-colors-from-beans/colorMap.json src/data/
```

- [ ] **Step 2: 创建 `src/data/palettes.ts` — 品牌列表和类型**

```typescript
import getColors from './get-colors.json'

export interface ColorItem {
  'color-name': string
  color: string
}

export interface BrandColorMap {
  [brandName: string]: ColorItem[]
}

const brandData = getColors as BrandColorMap

export const BRAND_NAMES = Object.keys(brandData).sort()

export function getBrandColors(brandName: string): ColorItem[] {
  return brandData[brandName] ?? []
}
```

- [ ] **Step 3: Commit**

```bash
git add src/data/ src/types/ src/composables/ src/components/ src/utils/
git commit -m "chore: copy color palette data and create directory structure"
```

---

## Phase 1: 基础类型定义

### Task 1.1: 核心类型定义

**Files:**
- Create: `src/types/index.ts`

- [ ] **Step 1: 编写类型定义**

```typescript
export interface PaletteColor {
  id: string
  name: string
  hex: string
  brand: string
  symbol?: string
}

export interface BeadCell {
  row: number
  col: number
  colorIndex: number
}

export interface BeadGrid {
  rows: number
  cols: number
  cells: BeadCell[][]
  palette: PaletteColor[]
}

export type DitherAlgorithm = 'none' | 'floydSteinberg' | 'atkinson'
export type RenderMode = 'color' | 'symbol' | 'mixed'

export interface DitherSettings {
  algorithm: DitherAlgorithm
  strength: number  // 0–100
}

export interface AdjustmentSettings {
  brightness: number   // -100 ~ 100
  contrast: number     // -100 ~ 100
  saturation: number   // -100 ~ 100
}

export interface DisplaySettings {
  showGrid: boolean
  gridLineColor: string
  gridLineWidth: number
  boldGridInterval: number
  boldGridColor: string
  boldGridWidth: number
  renderMode: RenderMode
}

export interface BeadSettings {
  gridCols: number
  gridRows: number
  keepAspectRatio: boolean
  dithering: DitherSettings
  adjustments: AdjustmentSettings
  display: DisplaySettings
}

export interface ProjectFile {
  version: 1
  meta: {
    name: string
    createdAt: string
    brandPalette: string
  }
  settings: BeadSettings
  palette: {
    brand: string
    colors: PaletteColor[]
    custom: PaletteColor[]
  }
  image?: string
}

export interface PixelImage {
  imageData: ImageData
  width: number
  height: number
}
```

- [ ] **Step 2: Commit**

```bash
git add src/types/index.ts
git commit -m "feat: define core TypeScript types"
```

---

## Phase 2: 工具函数（纯函数，无 Vue 依赖）

### Task 2.1: 色彩空间转换工具

**Files:**
- Create: `src/utils/colorSpace.ts`
- Create: `src/utils/__tests__/colorSpace.test.ts`

- [ ] **Step 1: 编写测试**

```typescript
import { describe, it, expect } from 'vitest'
import { rgbToLab, hexToRgb, deltaE, rgbToHex } from '../colorSpace'

describe('hexToRgb', () => {
  it('converts #FFFFFF to [255, 255, 255]', () => {
    expect(hexToRgb('#FFFFFF')).toEqual([255, 255, 255])
  })

  it('converts #000000 to [0, 0, 0]', () => {
    expect(hexToRgb('#000000')).toEqual([0, 0, 0])
  })

  it('converts #FF0000 to [255, 0, 0]', () => {
    expect(hexToRgb('#FF0000')).toEqual([255, 0, 0])
  })

  it('converts lowercase #ff8000', () => {
    expect(hexToRgb('#ff8000')).toEqual([255, 128, 0])
  })
})

describe('rgbToHex', () => {
  it('converts (255,255,255) to #FFFFFF', () => {
    expect(rgbToHex(255, 255, 255)).toBe('#FFFFFF')
  })

  it('converts (0,128,64) to #008040', () => {
    expect(rgbToHex(0, 128, 64)).toBe('#008040')
  })

  it('zero-pads single hex digits', () => {
    expect(rgbToHex(0, 0, 0)).toBe('#000000')
  })
})

describe('rgbToLab', () => {
  it('converts black to approx L=0', () => {
    const [L] = rgbToLab(0, 0, 0)
    expect(L).toBeCloseTo(0, 0)
  })

  it('converts white to approx L=100', () => {
    const [L] = rgbToLab(255, 255, 255)
    expect(L).toBeCloseTo(100, 0)
  })

  it('is idempotent for known values', () => {
    const [L1, a1, b1] = rgbToLab(255, 0, 0)
    expect(L1).toBeGreaterThan(40)
    expect(a1).toBeGreaterThan(0)
  })
})

describe('deltaE', () => {
  it('returns 0 for identical colors', () => {
    const lab1 = rgbToLab(128, 128, 128)
    expect(deltaE(lab1, lab1)).toBeCloseTo(0, 1)
  })

  it('returns large value for black vs white', () => {
    const black = rgbToLab(0, 0, 0)
    const white = rgbToLab(255, 255, 255)
    expect(deltaE(black, white)).toBeGreaterThan(50)
  })

  it('returns small value for similar colors', () => {
    const red1 = rgbToLab(255, 0, 0)
    const red2 = rgbToLab(254, 0, 0)
    expect(deltaE(red1, red2)).toBeLessThan(2)
  })
})
```

- [ ] **Step 2: 运行测试，验证失败**

```bash
npx vitest run src/utils/__tests__/colorSpace.test.ts
# Expected: FAIL (模块不存在)
```

- [ ] **Step 3: 实现 `src/utils/colorSpace.ts`**

```typescript
export type LAB = [number, number, number] // [L, a, b]
export type RGB = [number, number, number] // [r, g, b]

export function hexToRgb(hex: string): RGB {
  const h = hex.replace('#', '')
  return [
    parseInt(h.substring(0, 2), 16),
    parseInt(h.substring(2, 4), 16),
    parseInt(h.substring(4, 6), 16),
  ]
}

export function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => {
    const clamped = Math.max(0, Math.min(255, Math.round(n)))
    return clamped.toString(16).padStart(2, '0').toUpperCase()
  }
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

function srgbToLinear(c: number): number {
  const normalized = c / 255
  return normalized <= 0.04045
    ? normalized / 12.92
    : Math.pow((normalized + 0.055) / 1.055, 2.4)
}

function linearToSrgb(c: number): number {
  return c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055
}

// D65 illuminant reference white
const REF_X = 95.047
const REF_Y = 100.0
const REF_Z = 108.883

export function rgbToLab(r: number, g: number, b: number): LAB {
  let rl = srgbToLinear(r)
  let gl = srgbToLinear(g)
  let bl = srgbToLinear(b)

  // RGB → XYZ
  let x = rl * 0.4124564 + gl * 0.3575761 + bl * 0.1804375
  let y = rl * 0.2126729 + gl * 0.7151522 + bl * 0.0721750
  let z = rl * 0.0193339 + gl * 0.1191920 + bl * 0.9503041

  x /= REF_X
  y /= REF_Y
  z /= REF_Z

  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116)

  const fx = f(x)
  const fy = f(y)
  const fz = f(z)

  const L = 116 * fy - 16
  const a = 500 * (fx - fy)
  const bVal = 200 * (fy - fz)

  return [L, a, bVal]
}

export function deltaE(lab1: LAB, lab2: LAB): number {
  const [L1, a1, b1] = lab1
  const [L2, a2, b2] = lab2
  const dL = L1 - L2
  const da = a1 - a2
  const db = b1 - b2
  return Math.sqrt(dL * dL + da * da + db * db)
}
```

- [ ] **Step 4: 运行测试**

```bash
npx vitest run src/utils/__tests__/colorSpace.test.ts
# Expected: 全部 PASS
```

- [ ] **Step 5: Commit**

```bash
git add src/utils/colorSpace.ts src/utils/__tests__/colorSpace.test.ts
git commit -m "feat: add color space conversion utilities (RGB ↔ LAB, ΔE)"
```

### Task 2.2: 抖动算法

**Files:**
- Create: `src/utils/dithering.ts`
- Create: `src/utils/__tests__/dithering.test.ts`

- [ ] **Step 1: 编写测试**

```typescript
import { describe, it, expect } from 'vitest'
import { floydSteinbergDither, atkinsonDither } from '../dithering'

// 创建一个模拟的 ImageData-like 对象用于测试
function createTestImageData(width: number, height: number, fillRgb: [number, number, number]): ImageData {
  const data = new Uint8ClampedArray(width * height * 4)
  for (let i = 0; i < width * height; i++) {
    data[i * 4] = fillRgb[0]
    data[i * 4 + 1] = fillRgb[1]
    data[i * 4 + 2] = fillRgb[2]
    data[i * 4 + 3] = 255
  }
  return { data, width, height, colorSpace: 'srgb' as PredefinedColorSpace }
}

function mockMatchColor(r: number, g: number, b: number): { index: number; rgb: [number, number, number] } {
  // Simple match: return input clamped to 0 or 255
  const rq = r < 128 ? 0 : 255
  const gq = g < 128 ? 0 : 255
  const bq = b < 128 ? 0 : 255
  return { index: 0, rgb: [rq, gq, bq] }
}

describe('floydSteinbergDither', () => {
  it('returns same dimensions as input', () => {
    const img = createTestImageData(10, 10, [128, 128, 128])
    const result = floydSteinbergDither(img, mockMatchColor, 100)
    expect(result.length).toBe(10)
    expect(result[0].length).toBe(10)
  })

  it('does not throw on 1x1 image', () => {
    const img = createTestImageData(1, 1, [128, 128, 128])
    expect(() => floydSteinbergDither(img, mockMatchColor, 100)).not.toThrow()
  })

  it('with strength 0 behaves like nearest-neighbor only (no error diffusion)', () => {
    const img = createTestImageData(4, 4, [128, 128, 128])
    const result = floydSteinbergDither(img, mockMatchColor, 0)
    // All cells should have the same quantized value (128 → 0 or 255)
    const firstIndex = result[0][0].colorIndex
    const allSame = result.flat().every(cell => cell.colorIndex === firstIndex)
    expect(allSame).toBe(true)
  })

  it('with strength 100 produces potentially varied results', () => {
    const img = createTestImageData(4, 4, [128, 128, 128])
    const result = floydSteinbergDither(img, mockMatchColor, 100)
    expect(result.flat().length).toBe(16)
    // Just verify it completes without error
  })
})

describe('atkinsonDither', () => {
  it('returns same dimensions as input', () => {
    const img = createTestImageData(5, 5, [128, 128, 128])
    const result = atkinsonDither(img, mockMatchColor, 100)
    expect(result.length).toBe(5)
    expect(result[0].length).toBe(5)
  })
})
```

- [ ] **Step 2: 运行测试，验证失败**

```bash
npx vitest run src/utils/__tests__/dithering.test.ts
# Expected: FAIL
```

- [ ] **Step 3: 实现 `src/utils/dithering.ts`**

```typescript
import type { BeadCell } from '../types'

export type ColorMatchFn = (r: number, g: number, b: number) => { index: number; rgb: [number, number, number] }

interface DitherEntry {
  dr: number
  dc: number
  weight: number // relative weight, will be normalized
}

const FS_DISTRIBUTION: DitherEntry[] = [
  { dr: 0, dc: 1, weight: 7 },
  { dr: 1, dc: -1, weight: 3 },
  { dr: 1, dc: 0, weight: 5 },
  { dr: 1, dc: 1, weight: 1 },
]
const FS_DIVISOR = 16

const ATKINSON_DISTRIBUTION: DitherEntry[] = [
  { dr: 0, dc: 1, weight: 1 },
  { dr: 0, dc: 2, weight: 1 },
  { dr: 1, dc: -1, weight: 1 },
  { dr: 1, dc: 0, weight: 1 },
  { dr: 1, dc: 1, weight: 1 },
  { dr: 2, dc: 0, weight: 1 },
]
const ATKINSON_DIVISOR = 8 // actually 8, but each weight=1 → 1/8 total each

function applyDither(
  imageData: ImageData,
  matchColor: ColorMatchFn,
  strength: number,
  distributions: DitherEntry[],
  divisor: number,
): BeadCell[][] {
  const { data, width, height } = imageData
  const errors = new Float32Array(width * height * 3)
  const result: BeadCell[][] = Array.from({ length: height }, () => [])
  const factor = strength / 100

  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      const idx = (row * width + col) * 4
      const errIdx = (row * width + col) * 3

      let r = Math.round(data[idx] + errors[errIdx] * factor)
      let g = Math.round(data[idx + 1] + errors[errIdx + 1] * factor)
      let b = Math.round(data[idx + 2] + errors[errIdx + 2] * factor)

      r = Math.max(0, Math.min(255, r))
      g = Math.max(0, Math.min(255, g))
      b = Math.max(0, Math.min(255, b))

      const match = matchColor(r, g, b)
      const [qr, qg, qb] = match.rgb

      const errR = r - qr
      const errG = g - qg
      const errB = b - qb

      for (const { dr, dc, weight } of distributions) {
        const nr = row + dr
        const nc = col + dc
        if (nr >= 0 && nr < height && nc >= 0 && nc < width) {
          const nErrIdx = (nr * width + nc) * 3
          errors[nErrIdx] += errR * (weight / divisor)
          errors[nErrIdx + 1] += errG * (weight / divisor)
          errors[nErrIdx + 2] += errB * (weight / divisor)
        }
      }

      result[row].push({ row, col, colorIndex: match.index })
    }
  }

  return result
}

export function floydSteinbergDither(
  imageData: ImageData,
  matchColor: ColorMatchFn,
  strength: number,
): BeadCell[][] {
  return applyDither(imageData, matchColor, strength, FS_DISTRIBUTION, FS_DIVISOR)
}

export function atkinsonDither(
  imageData: ImageData,
  matchColor: ColorMatchFn,
  strength: number,
): BeadCell[][] {
  return applyDither(imageData, matchColor, strength, ATKINSON_DISTRIBUTION, ATKINSON_DIVISOR)
}
```

- [ ] **Step 4: 运行测试**

```bash
npx vitest run src/utils/__tests__/dithering.test.ts
# Expected: 全部 PASS
```

- [ ] **Step 5: Commit**

```bash
git add src/utils/dithering.ts src/utils/__tests__/dithering.test.ts
git commit -m "feat: add Floyd-Steinberg and Atkinson dithering algorithms"
```

---

## Phase 3: Composables

### Task 3.1: usePalette — 色板管理

**Files:**
- Create: `src/composables/usePalette.ts`
- Create: `src/composables/__tests__/usePalette.test.ts`

- [ ] **Step 1: 编写测试**

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { usePalette } from '../usePalette'
import type { PaletteColor } from '../../types'

// Mock the JSON import
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

describe('usePalette', () => {
  it('returns brand names', () => {
    const { brandNames } = usePalette()
    expect(brandNames.value).toContain('TestBrand-3')
    expect(brandNames.value).toContain('TestBrand-4')
    expect(brandNames.value.length).toBe(2)
  })

  it('loads palette for a selected brand, deduplicated by hex', () => {
    const { brandNames, selectBrand, palette } = usePalette()
    selectBrand('TestBrand-3')
    expect(palette.value.length).toBe(3) // 3 unique hex colors
  })

  it('deduplicates by hex within a brand', () => {
    // Add test data with duplicate hex
    const { palette, selectBrand } = usePalette()
    selectBrand('TestBrand-3')
    // #FFFFFF appears once, #000000 once, #FF0000 once
    const hexes = palette.value.map((c: PaletteColor) => c.hex)
    const uniqueHexes = new Set(hexes)
    expect(uniqueHexes.size).toBe(hexes.length)
  })

  it('precomputes LAB values for palette colors', () => {
    const { palette, selectBrand } = usePalette()
    selectBrand('TestBrand-3')
    for (const c of palette.value) {
      expect(c).toHaveProperty('lab')
      expect(Array.isArray(c.lab)).toBe(true)
      expect(c.lab.length).toBe(3)
    }
  })

  it('adds custom color', () => {
    const { palette, addCustomColor } = usePalette()
    addCustomColor({ hex: '#ABCDEF', name: 'Custom Blue' })
    const custom = palette.value.find((c: PaletteColor) => c.brand === 'custom')
    expect(custom).toBeTruthy()
    expect(custom!.hex).toBe('#ABCDEF')
    expect(custom!.name).toBe('Custom Blue')
  })

  it('removes a color', () => {
    const { palette, selectBrand, removeColor } = usePalette()
    selectBrand('TestBrand-3')
    const beforeCount = palette.value.length
    const targetId = palette.value[0].id
    removeColor(targetId)
    expect(palette.value.length).toBe(beforeCount - 1)
    expect(palette.value.find((c: PaletteColor) => c.id === targetId)).toBeUndefined()
  })
})
```

- [ ] **Step 2: 运行测试，验证失败**

```bash
npx vitest run src/composables/__tests__/usePalette.test.ts
# Expected: FAIL
```

- [ ] **Step 3: 实现 `src/composables/usePalette.ts`**

```typescript
import { ref, computed } from 'vue'
import type { PaletteColor } from '../types'
import { getBrandColors, BRAND_NAMES } from '../data/palettes'
import { hexToRgb, rgbToLab } from '../utils/colorSpace'

interface PaletteColorInternal extends PaletteColor {
  lab: [number, number, number]
}

function computeLab(hex: string): [number, number, number] {
  const [r, g, b] = hexToRgb(hex)
  return rgbToLab(r, g, b)
}

function generateId(): string {
  return `c_${Math.random().toString(36).substring(2, 10)}`
}

export function usePalette() {
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
}
```

- [ ] **Step 4: 运行测试**

```bash
npx vitest run src/composables/__tests__/usePalette.test.ts
# Expected: 全部 PASS
```

- [ ] **Step 5: Commit**

```bash
git add src/composables/usePalette.ts src/composables/__tests__/usePalette.test.ts
git commit -m "feat: add usePalette composable with brand selection and custom colors"
```

### Task 3.2: useImageProcessor — 图片加载和调整

**Files:**
- Create: `src/composables/useImageProcessor.ts`
- Create: `src/composables/__tests__/useImageProcessor.test.ts`

- [ ] **Step 1: 编写测试**

```typescript
import { describe, it, expect } from 'vitest'
import { loadImageFromFile, resizeImage, applyAdjustments, createImageDataFromCanvas } from '../useImageProcessor'

// Helper: create a small test canvas
function createTestCanvas(width: number, height: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')!
  // Fill with a gradient to have varied pixels
  const gradient = ctx.createLinearGradient(0, 0, width, height)
  gradient.addColorStop(0, 'red')
  gradient.addColorStop(0.5, 'green')
  gradient.addColorStop(1, 'blue')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, width, height)
  return { canvas, ctx }
}

describe('resizeImage', () => {
  it('resizes canvas to target dimensions (stretch mode)', () => {
    const { canvas } = createTestCanvas(200, 100)
    const result = resizeImage(canvas, 50, 50, false) // stretch
    expect(result.width).toBe(50)
    expect(result.height).toBe(50)
  })

  it('resizes canvas maintaining aspect ratio (fit mode)', () => {
    const { canvas } = createTestCanvas(200, 100)
    const result = resizeImage(canvas, 50, 50, true) // keep aspect ratio → center crop
    expect(result.width).toBe(50)
    expect(result.height).toBe(50)
  })
})

describe('applyAdjustments', () => {
  it('returns ImageData with correct dimensions', () => {
    const { canvas } = createTestCanvas(10, 10)
    const ctx = canvas.getContext('2d')!
    const imageData = ctx.getImageData(0, 0, 10, 10)
    const result = applyAdjustments(imageData, 0, 0, 0)
    expect(result.width).toBe(10)
    expect(result.height).toBe(10)
  })

  it('brightness +100 makes all pixels white', () => {
    const canvas = document.createElement('canvas')
    canvas.width = 4
    canvas.height = 4
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#808080'
    ctx.fillRect(0, 0, 4, 4)
    const imageData = ctx.getImageData(0, 0, 4, 4)
    const result = applyAdjustments(imageData, 100, 0, 0)
    for (let i = 0; i < result.data.length; i += 4) {
      expect(result.data[i]).toBe(255)
      expect(result.data[i + 1]).toBe(255)
      expect(result.data[i + 2]).toBe(255)
    }
  })

  it('brightness -100 makes all pixels black', () => {
    const canvas = document.createElement('canvas')
    canvas.width = 4
    canvas.height = 4
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#808080'
    ctx.fillRect(0, 0, 4, 4)
    const imageData = ctx.getImageData(0, 0, 4, 4)
    const result = applyAdjustments(imageData, -100, 0, 0)
    for (let i = 0; i < result.data.length; i += 4) {
      expect(result.data[i]).toBe(0)
      expect(result.data[i + 1]).toBe(0)
      expect(result.data[i + 2]).toBe(0)
    }
  })

  it('saturation -100 produces grayscale', () => {
    const canvas = document.createElement('canvas')
    canvas.width = 2
    canvas.height = 2
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#FF0000'
    ctx.fillRect(0, 0, 2, 2)
    const imageData = ctx.getImageData(0, 0, 2, 2)
    const result = applyAdjustments(imageData, 0, 0, -100)
    // R, G, B should all be equal (grayscale)
    for (let i = 0; i < result.data.length; i += 4) {
      expect(result.data[i]).toBe(result.data[i + 1])
      expect(result.data[i]).toBe(result.data[i + 2])
    }
  })
})
```

- [ ] **Step 2: 运行测试，验证失败**

```bash
npx vitest run src/composables/__tests__/useImageProcessor.test.ts
# Expected: FAIL
```

- [ ] **Step 3: 实现 `src/composables/useImageProcessor.ts`**

```typescript
export function resizeImage(
  source: HTMLCanvasElement | ImageBitmap,
  targetWidth: number,
  targetHeight: number,
  keepAspectRatio: boolean,
): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = targetWidth
  canvas.height = targetHeight
  const ctx = canvas.getContext('2d')!

  if (!keepAspectRatio) {
    ctx.drawImage(source, 0, 0, targetWidth, targetHeight)
    return canvas
  }

  const srcW = source instanceof HTMLCanvasElement ? source.width : source.width
  const srcH = source instanceof HTMLCanvasElement ? source.height : source.height

  const scale = Math.max(targetWidth / srcW, targetHeight / srcH)
  const scaledW = srcW * scale
  const scaledH = srcH * scale
  const offsetX = (targetWidth - scaledW) / 2
  const offsetY = (targetHeight - scaledH) / 2

  ctx.drawImage(source, offsetX, offsetY, scaledW, scaledH)
  return canvas
}

export async function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = URL.createObjectURL(file)
  })
}

export function applyAdjustments(
  imageData: ImageData,
  brightness: number,
  contrast: number,
  saturation: number,
): ImageData {
  const data = new Uint8ClampedArray(imageData.data)
  const result = new ImageData(imageData.width, imageData.height)

  const bFactor = brightness / 100 // -1 to 1
  const cFactor = (contrast + 100) / 100 // 0 to 2
  const sFactor = (saturation + 100) / 100 // 0 to 2

  for (let i = 0; i < data.length; i += 4) {
    let r = data[i]
    let g = data[i + 1]
    let b = data[i + 2]

    // Brightness
    if (brightness > 0) {
      r = r + (255 - r) * bFactor
      g = g + (255 - g) * bFactor
      b = b + (255 - b) * bFactor
    } else if (brightness < 0) {
      r = r * (1 + bFactor)
      g = g * (1 + bFactor)
      b = b * (1 + bFactor)
    }

    // Contrast
    r = (r - 128) * cFactor + 128
    g = (g - 128) * cFactor + 128
    b = (b - 128) * cFactor + 128

    // Saturation
    const gray = 0.299 * r + 0.587 * g + 0.114 * b
    r = gray + (r - gray) * sFactor
    g = gray + (g - gray) * sFactor
    b = gray + (b - gray) * sFactor

    result.data[i] = Math.max(0, Math.min(255, Math.round(r)))
    result.data[i + 1] = Math.max(0, Math.min(255, Math.round(g)))
    result.data[i + 2] = Math.max(0, Math.min(255, Math.round(b)))
    result.data[i + 3] = data[i + 3] // preserve alpha
  }

  return result
}
```

- [ ] **Step 4: 运行测试**

```bash
npx vitest run src/composables/__tests__/useImageProcessor.test.ts
# Expected: 全部 PASS
```

- [ ] **Step 5: Commit**

```bash
git add src/composables/useImageProcessor.ts src/composables/__tests__/useImageProcessor.test.ts
git commit -m "feat: add useImageProcessor with resize, load, and color adjustments"
```

### Task 3.3: useColorMatcher — 颜色匹配

**Files:**
- Create: `src/composables/useColorMatcher.ts`
- Create: `src/composables/__tests__/useColorMatcher.test.ts`

- [ ] **Step 1: 编写测试**

```typescript
import { describe, it, expect } from 'vitest'
import { createColorMatcher } from '../useColorMatcher'
import type { PaletteColor } from '../../types'

interface TestColor extends PaletteColor {
  lab: [number, number, number]
}

function makeColor(hex: string, name: string): TestColor {
  return {
    id: hex,
    name,
    hex: hex.toUpperCase(),
    brand: 'test',
    lab: [0, 0, 0], // Will be overridden in matcher, but createColorMatcher re-computes it
  }
}

describe('createColorMatcher', () => {
  it('matches pure red to closest red in palette', () => {
    const palette: TestColor[] = [
      makeColor('#FFFFFF', 'White'),
      makeColor('#000000', 'Black'),
      makeColor('#FF0000', 'Red'),
      makeColor('#0000FF', 'Blue'),
    ]
    const match = createColorMatcher(palette)
    const result = match(255, 0, 0)
    expect(result.index).toBe(2) // FF0000
  })

  it('matches pure white', () => {
    const palette: TestColor[] = [
      makeColor('#FFFFFF', 'White'),
      makeColor('#000000', 'Black'),
    ]
    const match = createColorMatcher(palette)
    const result = match(255, 255, 255)
    expect(result.index).toBe(0)
  })

  it('caches repeated lookups', () => {
    const palette: TestColor[] = [
      makeColor('#FFFFFF', 'White'),
      makeColor('#FF0000', 'Red'),
    ]
    const match = createColorMatcher(palette)
    const r1 = match(255, 0, 0)
    const r2 = match(255, 0, 0)
    expect(r1.index).toBe(r2.index)
  })
})
```

- [ ] **Step 2: 运行测试，验证失败**

```bash
npx vitest run src/composables/__tests__/useColorMatcher.test.ts
# Expected: FAIL
```

- [ ] **Step 3: 实现 `src/composables/useColorMatcher.ts`**

```typescript
import type { PaletteColor } from '../types'
import { hexToRgb, rgbToLab, deltaE, type LAB } from '../utils/colorSpace'

interface PaletteEntry {
  index: number
  hex: string
  lab: LAB
  rgb: [number, number, number]
}

export interface MatchResult {
  index: number
  rgb: [number, number, number]
}

export type MatchFunction = (r: number, g: number, b: number) => MatchResult

function quantizeChannel(v: number): number {
  // Quantize to 5 bits per channel for cache key (32 levels per channel)
  return Math.round(v / 8)
}

function makeCacheKey(r: number, g: number, b: number): string {
  return `${quantizeChannel(r)},${quantizeChannel(g)},${quantizeChannel(b)}`
}

export function createColorMatcher(palette: PaletteColor[]): MatchFunction {
  const entries: PaletteEntry[] = palette.map((c, i) => {
    const [r, g, b] = hexToRgb(c.hex)
    return {
      index: i,
      hex: c.hex,
      lab: rgbToLab(r, g, b),
      rgb: [r, g, b],
    }
  })

  const cache = new Map<string, MatchResult>()

  return (r: number, g: number, b: number): MatchResult => {
    const key = makeCacheKey(r, g, b)
    const cached = cache.get(key)
    if (cached) return cached

    const lab = rgbToLab(r, g, b)
    let bestIndex = 0
    let bestDelta = Infinity

    for (let i = 0; i < entries.length; i++) {
      const d = deltaE(lab, entries[i].lab)
      if (d < bestDelta) {
        bestDelta = d
        bestIndex = i
      }
    }

    const result: MatchResult = {
      index: bestIndex,
      rgb: entries[bestIndex].rgb,
    }

    cache.set(key, result)
    return result
  }
}
```

- [ ] **Step 4: 运行测试**

```bash
npx vitest run src/composables/__tests__/useColorMatcher.test.ts
# Expected: 全部 PASS
```

- [ ] **Step 5: Commit**

```bash
git add src/composables/useColorMatcher.ts src/composables/__tests__/useColorMatcher.test.ts
git commit -m "feat: add useColorMatcher with LAB ΔE matching and cache"
```

### Task 3.4: useDither — 抖动 composable

**Files:**
- Create: `src/composables/useDither.ts`
- Create: `src/composables/__tests__/useDither.test.ts`

- [ ] **Step 1: 编写测试**

```typescript
import { describe, it, expect } from 'vitest'
import { applyDithering } from '../useDither'
import type { DitherAlgorithm, PaletteColor, BeadCell } from '../../types'

interface TestColor extends PaletteColor {
  lab: [number, number, number]
}

function makeColor(hex: string): TestColor {
  return {
    id: hex,
    name: hex,
    hex: hex.toUpperCase(),
    brand: 'test',
    lab: [0, 0, 0],
  }
}

// Simple match function that returns black or white
function simpleMatch(r: number, g: number, b: number) {
  const bright = (r + g + b) / 3
  return bright < 128
    ? { index: 1, rgb: [0, 0, 0] as [number, number, number] }
    : { index: 0, rgb: [255, 255, 255] as [number, number, number] }
}

function createTestImageData(): ImageData {
  const w = 4, h = 4
  const data = new Uint8ClampedArray(w * h * 4)
  for (let i = 0; i < w * h; i++) {
    data[i * 4] = 128
    data[i * 4 + 1] = 128
    data[i * 4 + 2] = 128
    data[i * 4 + 3] = 255
  }
  return { data, width: w, height: h, colorSpace: 'srgb' as PredefinedColorSpace }
}

describe('applyDithering', () => {
  it('returns BeadGrid with correct dimensions for none', () => {
    const img = createTestImageData()
    const palette = [makeColor('#FFFFFF'), makeColor('#000000')]
    const result = applyDithering(img, palette, 'none', 0, simpleMatch)
    expect(result.cells.length).toBe(4)
    expect(result.cells[0].length).toBe(4)
  })

  it('returns BeadGrid with correct dimensions for floydSteinberg', () => {
    const img = createTestImageData()
    const palette = [makeColor('#FFFFFF'), makeColor('#000000')]
    const result = applyDithering(img, palette, 'floydSteinberg', 100, simpleMatch)
    expect(result.cells.length).toBe(4)
    expect(result.cells[0].length).toBe(4)
  })

  it('returns BeadGrid with correct dimensions for atkinson', () => {
    const img = createTestImageData()
    const palette = [makeColor('#FFFFFF'), makeColor('#000000')]
    const result = applyDithering(img, palette, 'atkinson', 100, simpleMatch)
    expect(result.cells.length).toBe(4)
    expect(result.cells[0].length).toBe(4)
  })

  it('includes palette in result', () => {
    const img = createTestImageData()
    const palette = [makeColor('#FFFFFF'), makeColor('#000000')]
    const result = applyDithering(img, palette, 'none', 0, simpleMatch)
    expect(result.palette).toBe(palette)
    expect(result.rows).toBe(4)
    expect(result.cols).toBe(4)
  })
})
```

- [ ] **Step 2: 运行测试，验证失败**

```bash
npx vitest run src/composables/__tests__/useDither.test.ts
# Expected: FAIL
```

- [ ] **Step 3: 实现 `src/composables/useDither.ts`**

```typescript
import type { BeadGrid, PaletteColor, DitherAlgorithm } from '../types'
import { floydSteinbergDither, atkinsonDither, type ColorMatchFn } from '../utils/dithering'
import { createColorMatcher } from './useColorMatcher'

export function applyDithering(
  imageData: ImageData,
  palette: PaletteColor[],
  algorithm: DitherAlgorithm,
  strength: number,
  overrideMatch?: ColorMatchFn,
): BeadGrid {
  const matchColor = overrideMatch ?? createColorMatcher(palette)
  const { width, height } = imageData

  let cells
  switch (algorithm) {
    case 'floydSteinberg':
      cells = floydSteinbergDither(imageData, matchColor, strength)
      break
    case 'atkinson':
      cells = atkinsonDither(imageData, matchColor, strength)
      break
    case 'none':
    default:
      cells = nearestNeighbor(imageData, matchColor)
      break
  }

  return {
    rows: height,
    cols: width,
    cells,
    palette,
  }
}

function nearestNeighbor(imageData: ImageData, matchColor: ColorMatchFn) {
  const { data, width, height } = imageData
  const result = Array.from({ length: height }, () => [])
  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      const idx = (row * width + col) * 4
      const match = matchColor(data[idx], data[idx + 1], data[idx + 2])
      result[row].push({ row, col, colorIndex: match.index })
    }
  }
  return result
}
```

- [ ] **Step 4: 运行测试**

```bash
npx vitest run src/composables/__tests__/useDither.test.ts
# Expected: 全部 PASS
```

- [ ] **Step 5: Commit**

```bash
git add src/composables/useDither.ts src/composables/__tests__/useDither.test.ts
git commit -m "feat: add useDither composable for dithering orchestration"
```

### Task 3.5: useBeadPipeline — 核心流水线

**Files:**
- Create: `src/composables/useBeadPipeline.ts`
- Create: `src/composables/__tests__/useBeadPipeline.test.ts`

- [ ] **Step 1: 编写测试**

```typescript
import { describe, it, expect, vi } from 'vitest'
import { useBeadPipeline } from '../useBeadPipeline'
import type { BeadSettings, PaletteColor } from '../../types'
import { nextTick } from 'vue'

function makeSettings(overrides?: Partial<BeadSettings>): BeadSettings {
  return {
    gridCols: 10,
    gridRows: 10,
    keepAspectRatio: true,
    dithering: { algorithm: 'none', strength: 0 },
    adjustments: { brightness: 0, contrast: 0, saturation: 0 },
    display: {
      showGrid: true,
      gridLineColor: '#ccc',
      gridLineWidth: 1,
      boldGridInterval: 10,
      boldGridColor: '#000',
      boldGridWidth: 2,
      renderMode: 'color',
    },
    ...overrides,
  }
}

describe('useBeadPipeline', () => {
  it('initializes with null beadGrid', () => {
    const { beadGrid, isProcessing } = useBeadPipeline()
    expect(beadGrid.value).toBeNull()
    expect(isProcessing.value).toBe(false)
  })

  it('does not process without image', async () => {
    const pipeline = useBeadPipeline()
    const palette: PaletteColor[] = []
    pipeline.process(null as any, palette, makeSettings())
    await nextTick()
    expect(pipeline.beadGrid.value).toBeNull()
  })

  it('returns settings ref', () => {
    const { settings } = useBeadPipeline()
    expect(settings.value.gridCols).toBe(29)
    expect(settings.value.gridRows).toBe(29)
  })
})
```

- [ ] **Step 2: 运行测试，验证失败**

```bash
npx vitest run src/composables/__tests__/useBeadPipeline.test.ts
# Expected: FAIL
```

- [ ] **Step 3: 实现 `src/composables/useBeadPipeline.ts`**

```typescript
import { ref, reactive } from 'vue'
import type { BeadGrid, BeadSettings, PaletteColor } from '../types'
import { loadImageFromFile, resizeImage, applyAdjustments } from './useImageProcessor'
import { applyDithering } from './useDither'

export function useBeadPipeline() {
  const beadGrid = ref<BeadGrid | null>(null)
  const isProcessing = ref(false)
  const error = ref<string | null>(null)

  const settings = ref<BeadSettings>({
    gridCols: 29,
    gridRows: 29,
    keepAspectRatio: true,
    dithering: { algorithm: 'none', strength: 0 },
    adjustments: { brightness: 0, contrast: 0, saturation: 0 },
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

    isProcessing.value = true
    error.value = null

    try {
      const s = { ...settings.value, ...overrideSettings }

      const img = await loadImageFromFile(imageFile)
      const resized = resizeImage(img, s.gridCols, s.gridRows, s.keepAspectRatio)
      const ctx = resized.getContext('2d')!
      let imageData = ctx.getImageData(0, 0, s.gridCols, s.gridRows)

      imageData = applyAdjustments(
        imageData,
        s.adjustments.brightness,
        s.adjustments.contrast,
        s.adjustments.saturation,
      )

      const grid = applyDithering(imageData, palette, s.dithering.algorithm, s.dithering.strength)
      beadGrid.value = grid
    } catch (e) {
      error.value = e instanceof Error ? e.message : '处理图片时出错'
      beadGrid.value = null
    } finally {
      isProcessing.value = false
    }
  }

  return {
    beadGrid,
    isProcessing,
    error,
    settings,
    process,
  }
}
```

- [ ] **Step 4: 运行测试**

```bash
npx vitest run src/composables/__tests__/useBeadPipeline.test.ts
# Expected: 全部 PASS
```

- [ ] **Step 5: Commit**

```bash
git add src/composables/useBeadPipeline.ts src/composables/__tests__/useBeadPipeline.test.ts
git commit -m "feat: add useBeadPipeline composable - core pipeline orchestration"
```

### Task 3.6: useExport — 导出功能

**Files:**
- Create: `src/composables/useExport.ts`
- Create: `src/composables/__tests__/useExport.test.ts`

- [ ] **Step 1: 编写测试**

```typescript
import { describe, it, expect, vi } from 'vitest'
import { renderGridToCanvas, buildSymbolMap } from '../useExport'
import type { BeadGrid, PaletteColor } from '../../types'

function makeTestGrid(): BeadGrid {
  const palette: PaletteColor[] = [
    { id: 'w', name: 'White', hex: '#FFFFFF', brand: 'test' },
    { id: 'b', name: 'Black', hex: '#000000', brand: 'test' },
  ]
  return {
    rows: 2,
    cols: 2,
    palette,
    cells: [
      [
        { row: 0, col: 0, colorIndex: 0 },
        { row: 0, col: 1, colorIndex: 1 },
      ],
      [
        { row: 1, col: 0, colorIndex: 1 },
        { row: 1, col: 1, colorIndex: 0 },
      ],
    ],
  }
}

describe('renderGridToCanvas', () => {
  it('creates a canvas with correct dimensions in color mode', () => {
    const grid = makeTestGrid()
    const canvas = renderGridToCanvas(grid, 'color', 20, {
      showGrid: false, gridLineColor: '', gridLineWidth: 0,
      boldGridInterval: 0, boldGridColor: '', boldGridWidth: 0,
    })
    expect(canvas.width).toBe(40)
    expect(canvas.height).toBe(40)
  })

  it('creates a canvas with correct dimensions in symbol mode', () => {
    const grid = makeTestGrid()
    const canvas = renderGridToCanvas(grid, 'symbol', 20, {
      showGrid: false, gridLineColor: '', gridLineWidth: 0,
      boldGridInterval: 0, boldGridColor: '', boldGridWidth: 0,
    })
    expect(canvas.width).toBe(40)
    expect(canvas.height).toBe(40)
  })

  it('returns valid canvas for mixed mode', () => {
    const grid = makeTestGrid()
    const canvas = renderGridToCanvas(grid, 'mixed', 20, {
      showGrid: false, gridLineColor: '', gridLineWidth: 0,
      boldGridInterval: 0, boldGridColor: '', boldGridWidth: 0,
    })
    expect(canvas).toBeInstanceOf(HTMLCanvasElement)
  })
})

describe('buildSymbolMap', () => {
  it('assigns unique symbols to each palette color', () => {
    const palette: PaletteColor[] = [
      { id: '1', name: 'A', hex: '#FF0000', brand: 'test' },
      { id: '2', name: 'B', hex: '#00FF00', brand: 'test' },
      { id: '3', name: 'C', hex: '#0000FF', brand: 'test' },
    ]
    const map = buildSymbolMap(palette)
    const symbols = [...map.values()]
    const unique = new Set(symbols)
    expect(unique.size).toBe(3)
  })
})
```

- [ ] **Step 2: 运行测试，验证失败**

```bash
npx vitest run src/composables/__tests__/useExport.test.ts
# Expected: FAIL
```

- [ ] **Step 3: 实现 `src/composables/useExport.ts`**

```typescript
import type { BeadGrid, PaletteColor, RenderMode } from '../types'

interface GridLineSettings {
  showGrid: boolean
  gridLineColor: string
  gridLineWidth: number
  boldGridInterval: number
  boldGridColor: string
  boldGridWidth: number
}

const SYMBOLS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789●▲■◆★♦▼◀▶♠♥♣'

export function buildSymbolMap(palette: PaletteColor[]): Map<number, string> {
  const map = new Map<number, string>()
  palette.forEach((c, i) => {
    map.set(i, SYMBOLS[i % SYMBOLS.length] ?? '?')
  })
  return map
}

function getTextColor(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.5 ? '#000000' : '#FFFFFF'
}

export function renderGridToCanvas(
  grid: BeadGrid,
  renderMode: RenderMode,
  cellSize: number,
  gridLines: GridLineSettings,
  scale = 1,
): HTMLCanvasElement {
  const width = grid.cols * cellSize * scale
  const height = grid.rows * cellSize * scale
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')!
  ctx.scale(scale, scale)

  const symbolMap = renderMode !== 'color' ? buildSymbolMap(grid.palette) : null

  for (let row = 0; row < grid.rows; row++) {
    for (let col = 0; col < grid.cols; col++) {
      const cell = grid.cells[row][col]
      const color = grid.palette[cell.colorIndex]
      const x = col * cellSize
      const y = row * cellSize

      if (renderMode === 'symbol') {
        ctx.fillStyle = '#FFFFFF'
      } else {
        ctx.fillStyle = color.hex
      }
      ctx.fillRect(x, y, cellSize, cellSize)

      if (renderMode === 'symbol' || renderMode === 'mixed') {
        const symbol = symbolMap!.get(cell.colorIndex) ?? '?'
        const fontSize = cellSize * 0.6
        ctx.font = `${fontSize}px monospace`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillStyle = renderMode === 'symbol' ? '#000000' : getTextColor(color.hex)
        ctx.fillText(symbol, x + cellSize / 2, y + cellSize / 2)
      }
    }
  }

  // Grid lines
  if (gridLines.showGrid) {
    // Regular grid lines
    if (gridLines.gridLineWidth > 0) {
      ctx.strokeStyle = gridLines.gridLineColor
      ctx.lineWidth = gridLines.gridLineWidth
      for (let row = 0; row <= grid.rows; row++) {
        ctx.beginPath()
        ctx.moveTo(0, row * cellSize)
        ctx.lineTo(grid.cols * cellSize, row * cellSize)
        ctx.stroke()
      }
      for (let col = 0; col <= grid.cols; col++) {
        ctx.beginPath()
        ctx.moveTo(col * cellSize, 0)
        ctx.lineTo(col * cellSize, grid.rows * cellSize)
        ctx.stroke()
      }
    }

    // Bold interval lines
    if (gridLines.boldGridInterval > 0) {
      ctx.strokeStyle = gridLines.boldGridColor
      ctx.lineWidth = gridLines.boldGridWidth
      for (let row = 0; row <= grid.rows; row += gridLines.boldGridInterval) {
        ctx.beginPath()
        ctx.moveTo(0, row * cellSize)
        ctx.lineTo(grid.cols * cellSize, row * cellSize)
        ctx.stroke()
      }
      for (let col = 0; col <= grid.cols; col += gridLines.boldGridInterval) {
        ctx.beginPath()
        ctx.moveTo(col * cellSize, 0)
        ctx.lineTo(col * cellSize, grid.rows * cellSize)
        ctx.stroke()
      }
    }
  }

  return canvas
}

export async function exportPNG(grid: BeadGrid, gridLines: GridLineSettings, cellSize: number): Promise<Blob> {
  const canvas = renderGridToCanvas(grid, 'color', cellSize, gridLines, 2)
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (blob) resolve(blob)
      else reject(new Error('Canvas toBlob failed'))
    }, 'image/png')
  })
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
```

- [ ] **Step 4: 运行测试**

```bash
npx vitest run src/composables/__tests__/useExport.test.ts
# Expected: 全部 PASS
```

- [ ] **Step 5: Commit**

```bash
git add src/composables/useExport.ts src/composables/__tests__/useExport.test.ts
git commit -m "feat: add useExport with Canvas rendering and PNG export"
```

---

## Phase 4: 组件

### Task 4.1: ImageUploader.vue

**Files:**
- Create: `src/components/ImageUploader.vue`
- Create: `src/components/__tests__/ImageUploader.test.ts`

- [ ] **Step 1: 编写测试**

```typescript
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import ImageUploader from '../ImageUploader.vue'

describe('ImageUploader', () => {
  it('renders upload area', () => {
    const wrapper = mount(ImageUploader)
    expect(wrapper.find('.upload-area').exists()).toBe(true)
  })

  it('renders placeholder text', () => {
    const wrapper = mount(ImageUploader)
    expect(wrapper.text()).toContain('上传图片')
  })

  it('emits upload event when file selected', async () => {
    const wrapper = mount(ImageUploader)
    const file = new File(['dummy'], 'test.png', { type: 'image/png' })
    const input = wrapper.find('input[type="file"]')
    Object.defineProperty(input.element, 'files', { value: [file] })
    await input.trigger('change')
    expect(wrapper.emitted('upload')).toBeTruthy()
    expect(wrapper.emitted('upload')![0][0]).toBe(file)
  })

  it('shows file name after upload', async () => {
    const wrapper = mount(ImageUploader)
    const file = new File(['dummy'], 'test.png', { type: 'image/png' })
    const input = wrapper.find('input[type="file"]')
    Object.defineProperty(input.element, 'files', { value: [file] })
    await input.trigger('change')
    expect(wrapper.text()).toContain('test.png')
  })
})
```

- [ ] **Step 2: 运行测试，验证失败**

```bash
npx vitest run src/components/__tests__/ImageUploader.test.ts
# Expected: FAIL
```

- [ ] **Step 3: 实现 `src/components/ImageUploader.vue`**

```vue
<script setup lang="ts">
import { ref } from 'vue'

const emit = defineEmits<{
  upload: [file: File]
}>()

const fileName = ref<string>('')
const fileInput = ref<HTMLInputElement>()

function onFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) {
    fileName.value = file.name
    emit('upload', file)
  }
}

function onDrop(event: DragEvent) {
  event.preventDefault()
  const file = event.dataTransfer?.files?.[0]
  if (file) {
    fileName.value = file.name
    emit('upload', file)
  }
}

function onDragOver(event: DragEvent) {
  event.preventDefault()
}

function triggerUpload() {
  fileInput.value?.click()
}
</script>

<template>
  <div
    class="upload-area"
    :class="{ 'has-file': !!fileName }"
    @click="triggerUpload"
    @drop="onDrop"
    @dragover="onDragOver"
  >
    <input
      ref="fileInput"
      type="file"
      accept="image/*"
      class="file-input"
      @change="onFileChange"
    />
    <span v-if="fileName" class="file-name">{{ fileName }}</span>
    <span v-else class="placeholder">拖拽或点击上传图片</span>
  </div>
</template>

<style scoped>
.upload-area {
  border: 2px dashed var(--border, #ccc);
  border-radius: 8px;
  padding: 24px;
  text-align: center;
  cursor: pointer;
  transition: border-color 0.2s;
}
.upload-area:hover {
  border-color: var(--accent, #aa3bff);
}
.upload-area.has-file {
  border-style: solid;
  border-color: var(--accent, #aa3bff);
}
.file-input {
  display: none;
}
.file-name {
  color: var(--text-h, #08060d);
  font-weight: 500;
}
.placeholder {
  color: var(--text, #6b6375);
}
</style>
```

- [ ] **Step 4: 运行测试**

```bash
npx vitest run src/components/__tests__/ImageUploader.test.ts
# Expected: 全部 PASS
```

- [ ] **Step 5: Commit**

```bash
git add src/components/ImageUploader.vue src/components/__tests__/ImageUploader.test.ts
git commit -m "feat: add ImageUploader component with drag-and-drop"
```

### Task 4.2: SizeSelector.vue

**Files:**
- Create: `src/components/SizeSelector.vue`
- Create: `src/components/__tests__/SizeSelector.test.ts`

- [ ] **Step 1: 编写测试**

```typescript
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import SizeSelector from '../SizeSelector.vue'

describe('SizeSelector', () => {
  it('renders preset buttons', () => {
    const wrapper = mount(SizeSelector, {
      props: { modelValue: { cols: 29, rows: 29, keepAspectRatio: true } },
    })
    expect(wrapper.text()).toContain('29×29')
    expect(wrapper.text()).toContain('50×50')
  })

  it('emits update on preset click', async () => {
    const wrapper = mount(SizeSelector, {
      props: { modelValue: { cols: 29, rows: 29, keepAspectRatio: true } },
    })
    await wrapper.find('button').trigger('click')
    expect(wrapper.emitted('update:modelValue')).toBeTruthy()
  })

  it('renders custom inputs', () => {
    const wrapper = mount(SizeSelector, {
      props: { modelValue: { cols: 29, rows: 29, keepAspectRatio: true } },
    })
    const inputs = wrapper.findAll('input[type="number"]')
    expect(inputs.length).toBe(2)
  })

  it('renders aspect ratio lock toggle', () => {
    const wrapper = mount(SizeSelector, {
      props: { modelValue: { cols: 29, rows: 29, keepAspectRatio: true } },
    })
    expect(wrapper.find('input[type="checkbox"]').exists()).toBe(true)
  })
})
```

- [ ] **Step 2: 运行测试，验证失败**

```bash
npx vitest run src/components/__tests__/SizeSelector.test.ts
# Expected: FAIL
```

- [ ] **Step 3: 实现 `src/components/SizeSelector.vue`**

```vue
<script setup lang="ts">
import { computed } from 'vue'

interface SizeValue {
  cols: number
  rows: number
  keepAspectRatio: boolean
}

const props = defineProps<{
  modelValue: SizeValue
}>()

const emit = defineEmits<{
  'update:modelValue': [value: SizeValue]
}>()

const PRESETS = [
  { cols: 29, rows: 29, label: '29×29' },
  { cols: 50, rows: 50, label: '50×50' },
  { cols: 100, rows: 100, label: '100×100' },
]

const cols = computed({
  get: () => props.modelValue.cols,
  set: (v: number) => emit('update:modelValue', { ...props.modelValue, cols: v }),
})

const rows = computed({
  get: () => props.modelValue.rows,
  set: (v: number) => emit('update:modelValue', { ...props.modelValue, rows: v }),
})

const keepAspectRatio = computed({
  get: () => props.modelValue.keepAspectRatio,
  set: (v: boolean) => emit('update:modelValue', { ...props.modelValue, keepAspectRatio: v }),
})

function selectPreset(preset: { cols: number; rows: number }) {
  emit('update:modelValue', { ...props.modelValue, cols: preset.cols, rows: preset.rows })
}
</script>

<template>
  <div class="size-selector">
    <label class="label">网格尺寸</label>
    <div class="presets">
      <button
        v-for="p in PRESETS"
        :key="p.label"
        class="preset-btn"
        :class="{ active: modelValue.cols === p.cols && modelValue.rows === p.rows }"
        @click="selectPreset(p)"
      >
        {{ p.label }}
      </button>
    </div>
    <div class="custom-size">
      <input type="number" v-model="cols" min="1" max="500" class="size-input" />
      <span>×</span>
      <input type="number" v-model="rows" min="1" max="500" class="size-input" />
    </div>
    <label class="aspect-toggle">
      <input type="checkbox" v-model="keepAspectRatio" />
      锁定宽高比
    </label>
  </div>
</template>

<style scoped>
.size-selector {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.label {
  font-size: 13px;
  color: var(--text, #6b6375);
  font-weight: 500;
}
.presets {
  display: flex;
  gap: 6px;
}
.preset-btn {
  flex: 1;
  padding: 6px 8px;
  border: 1px solid var(--border, #e5e4e7);
  border-radius: 4px;
  background: var(--bg, #fff);
  color: var(--text-h, #08060d);
  cursor: pointer;
  font-size: 13px;
  transition: border-color 0.2s;
}
.preset-btn.active {
  border-color: var(--accent, #aa3bff);
  background: var(--accent-bg, rgba(170, 59, 255, 0.1));
}
.custom-size {
  display: flex;
  align-items: center;
  gap: 6px;
}
.size-input {
  width: 70px;
  padding: 4px 8px;
  border: 1px solid var(--border, #e5e4e7);
  border-radius: 4px;
  text-align: center;
  font-size: 14px;
}
.aspect-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--text, #6b6375);
  cursor: pointer;
}
</style>
```

- [ ] **Step 4: 运行测试**

```bash
npx vitest run src/components/__tests__/SizeSelector.test.ts
# Expected: 全部 PASS
```

- [ ] **Step 5: Commit**

```bash
git add src/components/SizeSelector.vue src/components/__tests__/SizeSelector.test.ts
git commit -m "feat: add SizeSelector component with presets and custom input"
```

### Task 4.3: PalettePanel 组件组

**Files:**
- Create: `src/components/PaletteSelector.vue`
- Create: `src/components/PaletteEditor.vue`
- Create: `src/components/PalettePanel.vue`
- Create: `src/components/__tests__/PalettePanel.test.ts`

- [ ] **Step 1: 编写测试**

```typescript
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import PalettePanel from '../PalettePanel.vue'

describe('PalettePanel', () => {
  it('renders brand selector and palette info', () => {
    const wrapper = mount(PalettePanel, {
      props: {
        brandNames: ['Brand-A', 'Brand-B'],
        selectedBrand: 'Brand-A',
        palette: [],
      },
    })
    expect(wrapper.text()).toContain('Brand-A')
    expect(wrapper.find('select').exists()).toBe(true)
  })

  it('emits brand change', async () => {
    const wrapper = mount(PalettePanel, {
      props: {
        brandNames: ['Brand-A', 'Brand-B'],
        selectedBrand: 'Brand-A',
        palette: [],
      },
    })
    const select = wrapper.find('select')
    await select.setValue('Brand-B')
    expect(wrapper.emitted('select-brand')![0]).toEqual(['Brand-B'])
  })

  it('shows palette color count', () => {
    const palette = [
      { id: '1', name: 'Red', hex: '#FF0000', brand: 'test' },
      { id: '2', name: 'Blue', hex: '#0000FF', brand: 'test' },
    ]
    const wrapper = mount(PalettePanel, {
      props: {
        brandNames: ['test'],
        selectedBrand: 'test',
        palette,
      },
    })
    expect(wrapper.text()).toContain('2')
  })
})
```

- [ ] **Step 2: 运行测试，验证失败**

```bash
npx vitest run src/components/__tests__/PalettePanel.test.ts
# Expected: FAIL
```

- [ ] **Step 3: 实现组件**

**`src/components/PaletteSelector.vue`:**

```vue
<script setup lang="ts">
defineProps<{
  brandNames: string[]
  modelValue: string
}>()

defineEmits<{
  'update:modelValue': [value: string]
}>()
</script>

<template>
  <select
    class="brand-select"
    :value="modelValue"
    @change="$emit('update:modelValue', ($event.target as HTMLSelectElement).value)"
  >
    <option v-for="name in brandNames" :key="name" :value="name">{{ name }}</option>
  </select>
</template>

<style scoped>
.brand-select {
  width: 100%;
  padding: 6px 8px;
  border: 1px solid var(--border, #e5e4e7);
  border-radius: 4px;
  background: var(--bg, #fff);
  color: var(--text-h, #08060d);
  font-size: 14px;
}
</style>
```

**`src/components/PaletteEditor.vue`:**

```vue
<script setup lang="ts">
import { ref } from 'vue'
import type { PaletteColor } from '../types'

defineProps<{
  palette: PaletteColor[]
}>()

const emit = defineEmits<{
  'add-color': [{ hex: string; name: string }]
  'remove-color': [id: string]
}>()

const newName = ref('')
const newHex = ref('#000000')

function add() {
  if (newName.value && newHex.value) {
    emit('add-color', { hex: newHex.value, name: newName.value })
    newName.value = ''
  }
}
</script>

<template>
  <div class="palette-editor">
    <div class="add-row">
      <input type="color" v-model="newHex" class="color-picker" />
      <input
        v-model="newName"
        placeholder="颜色名（可选）"
        class="name-input"
        @keyup.enter="add"
      />
      <button class="add-btn" @click="add">+</button>
    </div>
    <div class="custom-colors">
      <div
        v-for="c in palette.filter(p => p.brand === 'custom')"
        :key="c.id"
        class="color-chip-row"
      >
        <span class="color-swatch" :style="{ background: c.hex }"></span>
        <span class="color-name">{{ c.name || c.hex }}</span>
        <button class="remove-btn" @click="emit('remove-color', c.id)">×</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.palette-editor { display: flex; flex-direction: column; gap: 6px; margin-top: 8px; }
.add-row { display: flex; gap: 6px; align-items: center; }
.color-picker { width: 32px; height: 28px; border: none; cursor: pointer; padding: 0; }
.name-input { flex: 1; padding: 4px 6px; border: 1px solid var(--border); border-radius: 4px; font-size: 13px; }
.add-btn { padding: 4px 10px; border: 1px solid var(--border); border-radius: 4px; background: var(--bg); cursor: pointer; font-size: 16px; }
.custom-colors { max-height: 120px; overflow-y: auto; }
.color-chip-row { display: flex; align-items: center; gap: 6px; padding: 2px 0; }
.color-swatch { width: 18px; height: 18px; border-radius: 3px; border: 1px solid var(--border); flex-shrink: 0; }
.color-name { font-size: 12px; color: var(--text); flex: 1; }
.remove-btn { border: none; background: none; color: #999; cursor: pointer; font-size: 14px; padding: 0 2px; }
</style>
```

**`src/components/PalettePanel.vue`:**

```vue
<script setup lang="ts">
import type { PaletteColor } from '../types'
import PaletteSelector from './PaletteSelector.vue'
import PaletteEditor from './PaletteEditor.vue'

defineProps<{
  brandNames: string[]
  selectedBrand: string
  palette: PaletteColor[]
}>()

const emit = defineEmits<{
  'select-brand': [brand: string]
  'add-color': [{ hex: string; name: string }]
  'remove-color': [id: string]
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
    <div class="color-count">{{ palette.length }} 种颜色</div>
    <PaletteEditor
      :palette="palette"
      @add-color="emit('add-color', $event)"
      @remove-color="emit('remove-color', $event)"
    />
  </div>
</template>

<style scoped>
.palette-panel { display: flex; flex-direction: column; gap: 6px; }
.label { font-size: 13px; color: var(--text); font-weight: 500; }
.color-count { font-size: 12px; color: var(--text); }
</style>
```

- [ ] **Step 4: 运行测试**

```bash
npx vitest run src/components/__tests__/PalettePanel.test.ts
# Expected: 全部 PASS
```

- [ ] **Step 5: Commit**

```bash
git add src/components/PaletteSelector.vue src/components/PaletteEditor.vue src/components/PalettePanel.vue src/components/__tests__/PalettePanel.test.ts
git commit -m "feat: add PalettePanel, PaletteSelector, PaletteEditor components"
```

### Task 4.4: 设置控件组件（ColorAdjustments, DitherOptions, DisplayOptions）

**Files:**
- Create: `src/components/ColorAdjustments.vue`
- Create: `src/components/DitherOptions.vue`
- Create: `src/components/DisplayOptions.vue`
- Create: `src/components/__tests__/SettingsControls.test.ts`

- [ ] **Step 1: 编写测试**

```typescript
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ColorAdjustments from '../ColorAdjustments.vue'
import DitherOptions from '../DitherOptions.vue'
import DisplayOptions from '../DisplayOptions.vue'
import type { AdjustmentSettings, RenderMode } from '../../types'

describe('ColorAdjustments', () => {
  it('renders three sliders', () => {
    const settings: AdjustmentSettings = { brightness: 0, contrast: 0, saturation: 0 }
    const wrapper = mount(ColorAdjustments, { props: { modelValue: settings } })
    const ranges = wrapper.findAll('input[type="range"]')
    expect(ranges.length).toBe(3)
  })

  it('emits update on slider change', async () => {
    const settings: AdjustmentSettings = { brightness: 0, contrast: 0, saturation: 0 }
    const wrapper = mount(ColorAdjustments, { props: { modelValue: settings } })
    const firstRange = wrapper.find('input[type="range"]')
    // Set to 50
    await firstRange.setValue(50)
    const emitted = wrapper.emitted('update:modelValue')
    expect(emitted).toBeTruthy()
    expect(emitted![0][0].brightness).toBe(50)
  })
})

describe('DitherOptions', () => {
  it('renders algorithm selector', () => {
    const wrapper = mount(DitherOptions, {
      props: { modelValue: { algorithm: 'none', strength: 50 } },
    })
    expect(wrapper.find('select').exists()).toBe(true)
  })
})

describe('DisplayOptions', () => {
  it('renders render mode selector', () => {
    const wrapper = mount(DisplayOptions, {
      props: {
        modelValue: {
          showGrid: true, gridLineColor: '#ccc', gridLineWidth: 1,
          boldGridInterval: 10, boldGridColor: '#000', boldGridWidth: 2,
          renderMode: 'color' as RenderMode,
        },
      },
    })
    expect(wrapper.find('select').exists()).toBe(true)
  })

  it('shows grid interval input', () => {
    const wrapper = mount(DisplayOptions, {
      props: {
        modelValue: {
          showGrid: true, gridLineColor: '#ccc', gridLineWidth: 1,
          boldGridInterval: 10, boldGridColor: '#000', boldGridWidth: 2,
          renderMode: 'color' as RenderMode,
        },
      },
    })
    expect(wrapper.text()).toContain('粗线间隔')
  })
})
```

- [ ] **Step 2: 运行测试，验证失败**

```bash
npx vitest run src/components/__tests__/SettingsControls.test.ts
# Expected: FAIL
```

- [ ] **Step 3: 实现组件**

**`src/components/ColorAdjustments.vue`:**

```vue
<script setup lang="ts">
import type { AdjustmentSettings } from '../types'

const props = defineProps<{ modelValue: AdjustmentSettings }>()
const emit = defineEmits<{ 'update:modelValue': [value: AdjustmentSettings] }>()

function update(key: keyof AdjustmentSettings, value: number) {
  emit('update:modelValue', { ...props.modelValue, [key]: value })
}
</script>

<template>
  <div class="adjustments">
    <label class="label">颜色调整</label>
    <div class="slider-row">
      <span class="slider-label">亮度</span>
      <input type="range" min="-100" max="100" :value="modelValue.brightness"
        @input="update('brightness', Number(($event.target as HTMLInputElement).value))" />
      <span class="value">{{ modelValue.brightness }}</span>
    </div>
    <div class="slider-row">
      <span class="slider-label">对比度</span>
      <input type="range" min="-100" max="100" :value="modelValue.contrast"
        @input="update('contrast', Number(($event.target as HTMLInputElement).value))" />
      <span class="value">{{ modelValue.contrast }}</span>
    </div>
    <div class="slider-row">
      <span class="slider-label">饱和度</span>
      <input type="range" min="-100" max="100" :value="modelValue.saturation"
        @input="update('saturation', Number(($event.target as HTMLInputElement).value))" />
      <span class="value">{{ modelValue.saturation }}</span>
    </div>
  </div>
</template>

<style scoped>
.adjustments { display: flex; flex-direction: column; gap: 4px; }
.label { font-size: 13px; color: var(--text); font-weight: 500; }
.slider-row { display: flex; align-items: center; gap: 6px; }
.slider-label { font-size: 12px; color: var(--text); width: 42px; flex-shrink: 0; }
.slider-row input[type="range"] { flex: 1; }
.value { font-size: 12px; color: var(--text); width: 30px; text-align: right; font-family: var(--mono, monospace); }
</style>
```

**`src/components/DitherOptions.vue`:**

```vue
<script setup lang="ts">
import type { DitherSettings, DitherAlgorithm } from '../types'

const props = defineProps<{ modelValue: DitherSettings }>()
const emit = defineEmits<{ 'update:modelValue': [value: DitherSettings] }>()

function updateAlgo(algorithm: DitherAlgorithm) {
  emit('update:modelValue', { ...props.modelValue, algorithm })
}

function updateStrength(strength: number) {
  emit('update:modelValue', { ...props.modelValue, strength })
}
</script>

<template>
  <div class="dither-options">
    <label class="label">抖动</label>
    <select :value="modelValue.algorithm" @change="updateAlgo(($event.target as HTMLSelectElement).value as DitherAlgorithm)">
      <option value="none">无</option>
      <option value="floydSteinberg">Floyd-Steinberg</option>
      <option value="atkinson">Atkinson</option>
    </select>
    <div v-if="modelValue.algorithm !== 'none'" class="slider-row">
      <span class="slider-label">强度</span>
      <input type="range" min="0" max="100" :value="modelValue.strength"
        @input="updateStrength(Number(($event.target as HTMLInputElement).value))" />
      <span class="value">{{ modelValue.strength }}%</span>
    </div>
  </div>
</template>

<style scoped>
.dither-options { display: flex; flex-direction: column; gap: 6px; }
.label { font-size: 13px; color: var(--text); font-weight: 500; }
select {
  padding: 4px 8px; border: 1px solid var(--border); border-radius: 4px;
  font-size: 13px; background: var(--bg); color: var(--text-h);
}
.slider-row { display: flex; align-items: center; gap: 6px; }
.slider-label { font-size: 12px; color: var(--text); width: 30px; }
.slider-row input[type="range"] { flex: 1; }
.value { font-size: 12px; color: var(--text); font-family: var(--mono, monospace); width: 30px; text-align: right; }
</style>
```

**`src/components/DisplayOptions.vue`:**

```vue
<script setup lang="ts">
import type { DisplaySettings, RenderMode } from '../types'

const props = defineProps<{ modelValue: DisplaySettings }>()
const emit = defineEmits<{ 'update:modelValue': [value: DisplaySettings] }>()

function update<K extends keyof DisplaySettings>(key: K, value: DisplaySettings[K]) {
  emit('update:modelValue', { ...props.modelValue, [key]: value })
}
</script>

<template>
  <div class="display-options">
    <label class="label">显示选项</label>
    <select :value="modelValue.renderMode" @change="update('renderMode', ($event.target as HTMLSelectElement).value as RenderMode)">
      <option value="color">彩色</option>
      <option value="symbol">符号</option>
      <option value="mixed">混合</option>
    </select>
    <label class="checkbox-row">
      <input type="checkbox" :checked="modelValue.showGrid" @change="update('showGrid', ($event.target as HTMLInputElement).checked)" />
      显示网格线
    </label>
    <div v-if="modelValue.showGrid">
      <div class="inline-row">
        <span class="inline-label">粗线间隔</span>
        <input type="number" min="0" max="100" :value="modelValue.boldGridInterval" class="num-input"
          @input="update('boldGridInterval', Number(($event.target as HTMLInputElement).value))" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.display-options { display: flex; flex-direction: column; gap: 6px; }
.label { font-size: 13px; color: var(--text); font-weight: 500; }
select {
  padding: 4px 8px; border: 1px solid var(--border); border-radius: 4px;
  font-size: 13px; background: var(--bg); color: var(--text-h);
}
.checkbox-row { display: flex; align-items: center; gap: 6px; font-size: 13px; color: var(--text); cursor: pointer; }
.inline-row { display: flex; align-items: center; gap: 6px; }
.inline-label { font-size: 12px; color: var(--text); }
.num-input { width: 50px; padding: 2px 4px; border: 1px solid var(--border); border-radius: 4px; text-align: center; font-size: 13px; }
</style>
```

- [ ] **Step 4: 运行测试**

```bash
npx vitest run src/components/__tests__/SettingsControls.test.ts
# Expected: 全部 PASS
```

- [ ] **Step 5: Commit**

```bash
git add src/components/ColorAdjustments.vue src/components/DitherOptions.vue src/components/DisplayOptions.vue src/components/__tests__/SettingsControls.test.ts
git commit -m "feat: add ColorAdjustments, DitherOptions, DisplayOptions components"
```

### Task 4.5: ExportButtons.vue

**Files:**
- Create: `src/components/ExportButtons.vue`
- Create: `src/components/__tests__/ExportButtons.test.ts`

- [ ] **Step 1: 编写测试**

```typescript
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ExportButtons from '../ExportButtons.vue'

describe('ExportButtons', () => {
  it('renders export buttons', () => {
    const wrapper = mount(ExportButtons, {
      props: { hasGrid: true },
    })
    expect(wrapper.text()).toContain('PNG')
    expect(wrapper.text()).toContain('PDF')
  })

  it('emits png export', async () => {
    const wrapper = mount(ExportButtons, {
      props: { hasGrid: true },
    })
    // Find the PNG button
    const buttons = wrapper.findAll('button')
    const pngBtn = buttons.find(b => b.text().includes('PNG'))
    await pngBtn!.trigger('click')
    expect(wrapper.emitted('export-png')).toBeTruthy()
  })

  it('emits pdf export', async () => {
    const wrapper = mount(ExportButtons, {
      props: { hasGrid: true },
    })
    const buttons = wrapper.findAll('button')
    const pdfBtn = buttons.find(b => b.text().includes('PDF'))
    await pdfBtn!.trigger('click')
    expect(wrapper.emitted('export-pdf')).toBeTruthy()
  })

  it('emits save project', async () => {
    const wrapper = mount(ExportButtons, {
      props: { hasGrid: true },
    })
    const buttons = wrapper.findAll('button')
    const saveBtn = buttons.find(b => b.text().includes('保存项目'))
    await saveBtn!.trigger('click')
    expect(wrapper.emitted('save-project')).toBeTruthy()
  })

  it('disables export when no grid', () => {
    const wrapper = mount(ExportButtons, {
      props: { hasGrid: false },
    })
    const buttons = wrapper.findAll('button')
    const pngBtn = buttons.find(b => b.text().includes('PNG'))
    expect(pngBtn!.element.disabled).toBe(true)
  })
})
```

- [ ] **Step 2: 运行测试，验证失败**

```bash
npx vitest run src/components/__tests__/ExportButtons.test.ts
# Expected: FAIL
```

- [ ] **Step 3: 实现 `src/components/ExportButtons.vue`**

```vue
<script setup lang="ts">
defineProps<{
  hasGrid: boolean
}>()

defineEmits<{
  'export-png': []
  'export-pdf': []
  'save-project': [withImage: boolean]
  'load-project': []
}>()
</script>

<template>
  <div class="export-buttons">
    <label class="label">导出</label>
    <button class="btn export-btn" :disabled="!hasGrid" @click="$emit('export-png')">导出 PNG</button>
    <button class="btn export-btn" :disabled="!hasGrid" @click="$emit('export-pdf')">导出 PDF</button>
    <hr class="divider" />
    <button class="btn save-btn" :disabled="!hasGrid" @click="$emit('save-project', true)">保存项目</button>
    <button class="btn save-btn" :disabled="!hasGrid" @click="$emit('save-project', false)">保存项目（不含图片）</button>
    <button class="btn load-btn" @click="$emit('load-project')">加载项目</button>
  </div>
</template>

<style scoped>
.export-buttons { display: flex; flex-direction: column; gap: 6px; }
.label { font-size: 13px; color: var(--text); font-weight: 500; }
.btn { padding: 8px; border-radius: 6px; border: 1px solid var(--border); cursor: pointer; font-size: 13px; }
.btn:disabled { opacity: 0.4; cursor: not-allowed; }
.export-btn { background: var(--accent, #aa3bff); color: #fff; border-color: var(--accent); }
.save-btn { background: var(--bg); color: var(--text-h); }
.load-btn { background: var(--bg); color: var(--text-h); }
.divider { border: none; border-top: 1px solid var(--border); margin: 4px 0; }
</style>
```

- [ ] **Step 4: 运行测试**

```bash
npx vitest run src/components/__tests__/ExportButtons.test.ts
# Expected: 全部 PASS
```

- [ ] **Step 5: Commit**

```bash
git add src/components/ExportButtons.vue src/components/__tests__/ExportButtons.test.ts
git commit -m "feat: add ExportButtons component with PNG/PDF/Project export"
```

### Task 4.6: BeadPreview.vue — Canvas 预览

**Files:**
- Create: `src/components/BeadPreview.vue`
- Create: `src/components/__tests__/BeadPreview.test.ts`

- [ ] **Step 1: 编写测试**

```typescript
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import BeadPreview from '../BeadPreview.vue'
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
  }
}

describe('BeadPreview', () => {
  it('renders canvas element', () => {
    const wrapper = mount(BeadPreview, {
      props: {
        beadGrid: makeTestGrid(),
        display: {
          showGrid: true, gridLineColor: '#ccc', gridLineWidth: 1,
          boldGridInterval: 10, boldGridColor: '#000', boldGridWidth: 2,
          renderMode: 'color',
        },
      },
    })
    expect(wrapper.find('canvas').exists()).toBe(true)
  })

  it('shows empty state when no grid', () => {
    const wrapper = mount(BeadPreview, {
      props: {
        beadGrid: null,
        display: {
          showGrid: true, gridLineColor: '#ccc', gridLineWidth: 1,
          boldGridInterval: 10, boldGridColor: '#000', boldGridWidth: 2,
          renderMode: 'color',
        },
      },
    })
    expect(wrapper.text()).toContain('上传图片开始')
  })

  it('shows grid info', () => {
    const wrapper = mount(BeadPreview, {
      props: {
        beadGrid: makeTestGrid(),
        display: {
          showGrid: true, gridLineColor: '#ccc', gridLineWidth: 1,
          boldGridInterval: 10, boldGridColor: '#000', boldGridWidth: 2,
          renderMode: 'color',
        },
      },
    })
    expect(wrapper.text()).toContain('2 × 2')
  })

  it('emits cell-click on canvas click', async () => {
    const wrapper = mount(BeadPreview, {
      props: {
        beadGrid: makeTestGrid(),
        display: {
          showGrid: true, gridLineColor: '#ccc', gridLineWidth: 1,
          boldGridInterval: 10, boldGridColor: '#000', boldGridWidth: 2,
          renderMode: 'color',
        },
      },
    })
    const canvas = wrapper.find('canvas')
    await canvas.trigger('click', { offsetX: 10, offsetY: 10 })
    // Cell click should be emitted (coordinates depend on canvas size)
    expect(wrapper.emitted('cell-click')).toBeTruthy()
  })
})
```

- [ ] **Step 2: 运行测试，验证失败**

```bash
npx vitest run src/components/__tests__/BeadPreview.test.ts
# Expected: FAIL
```

- [ ] **Step 3: 实现 `src/components/BeadPreview.vue`**

```vue
<script setup lang="ts">
import { ref, watch, onMounted, nextTick, computed } from 'vue'
import type { BeadGrid, DisplaySettings, PaletteColor } from '../types'
import { renderGridToCanvas } from '../composables/useExport'

const props = defineProps<{
  beadGrid: BeadGrid | null
  display: DisplaySettings
}>()

const emit = defineEmits<{
  'cell-click': [cell: { row: number; col: number; color: PaletteColor }]
}>()

const canvasRef = ref<HTMLCanvasElement>()
const containerRef = ref<HTMLDivElement>()
const hoveredCell = ref<{ row: number; col: number } | null>(null)
const cellSize = ref(20)

function render() {
  if (!canvasRef.value || !props.beadGrid) return
  const canvas = canvasRef.value
  const container = containerRef.value
  if (!container) return

  const maxW = container.clientWidth
  const maxH = container.clientHeight
  cellSize.value = Math.floor(Math.min(maxW / props.beadGrid.cols, maxH / props.beadGrid.rows))

  const targetW = cellSize.value * props.beadGrid.cols
  const targetH = cellSize.value * props.beadGrid.rows

  canvas.width = targetW
  canvas.height = targetH
  canvas.style.width = targetW + 'px'
  canvas.style.height = targetH + 'px'

  // Use renderGridToCanvas for the rendering
  const rendered = renderGridToCanvas(props.beadGrid, props.display.renderMode, cellSize.value, {
    showGrid: props.display.showGrid,
    gridLineColor: props.display.gridLineColor,
    gridLineWidth: props.display.gridLineWidth,
    boldGridInterval: props.display.boldGridInterval,
    boldGridColor: props.display.boldGridColor,
    boldGridWidth: props.display.boldGridWidth,
  })

  const ctx = canvas.getContext('2d')!
  ctx.drawImage(rendered, 0, 0)
}

function onMouseMove(event: MouseEvent) {
  if (!props.beadGrid) return
  const rect = canvasRef.value?.getBoundingClientRect()
  if (!rect) return
  const x = event.clientX - rect.left
  const y = event.clientY - rect.top
  const col = Math.floor(x / cellSize.value)
  const row = Math.floor(y / cellSize.value)
  if (row >= 0 && row < props.beadGrid.rows && col >= 0 && col < props.beadGrid.cols) {
    hoveredCell.value = { row, col }
  } else {
    hoveredCell.value = null
  }
}

function onClick(event: MouseEvent) {
  if (!props.beadGrid || !hoveredCell.value) return
  const { row, col } = hoveredCell.value
  const color = props.beadGrid.palette[props.beadGrid.cells[row][col].colorIndex]
  emit('cell-click', { row, col, color })
}

const hoveredColor = computed(() => {
  if (!hoveredCell.value || !props.beadGrid) return null
  const { row, col } = hoveredCell.value
  return props.beadGrid.palette[props.beadGrid.cells[row][col].colorIndex]
})

onMounted(() => {
  nextTick(render)
})

watch(() => [props.beadGrid, props.display], render, { deep: true })

defineExpose({ canvasRef })
</script>

<template>
  <div ref="containerRef" class="bead-preview">
    <template v-if="beadGrid">
      <div class="preview-canvas-wrap">
        <canvas
          ref="canvasRef"
          @mousemove="onMouseMove"
          @click="onClick"
        />
        <div v-if="hoveredColor" class="tooltip" :style="{
          left: ((hoveredCell?.col ?? 0) * cellSize + cellSize) + 'px',
          top: ((hoveredCell?.row ?? 0) * cellSize) + 'px',
        }">
          {{ hoveredColor.name || hoveredColor.hex }}
        </div>
      </div>
      <div class="grid-info">
        {{ beadGrid.rows }} × {{ beadGrid.cols }} · {{ beadGrid.palette.length }} 色
      </div>
    </template>
    <div v-else class="empty-state">
      <p>上传图片开始</p>
    </div>
  </div>
</template>

<style scoped>
.bead-preview {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 400px;
  background: var(--bg, #fff);
  position: relative;
  overflow: auto;
}
.preview-canvas-wrap {
  position: relative;
}
.tooltip {
  position: absolute;
  background: rgba(0,0,0,0.8);
  color: #fff;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
  white-space: nowrap;
  pointer-events: none;
  transform: translate(8px, -50%);
  z-index: 10;
}
.grid-info {
  margin-top: 8px;
  font-size: 12px;
  color: var(--text);
  font-family: var(--mono, monospace);
}
.empty-state {
  color: var(--text);
  font-size: 16px;
}
</style>
```

- [ ] **Step 4: 运行测试**

```bash
npx vitest run src/components/__tests__/BeadPreview.test.ts
# Expected: 全部 PASS
```

- [ ] **Step 5: Commit**

```bash
git add src/components/BeadPreview.vue src/components/__tests__/BeadPreview.test.ts
git commit -m "feat: add BeadPreview component with Canvas rendering and tooltip"
```

### Task 4.7: ControlPanel.vue — 面板容器 & App.vue — 集成

**Files:**
- Create: `src/components/ControlPanel.vue`
- Modify: `src/App.vue`

- [ ] **Step 1: 实现 ControlPanel.vue**

```vue
<script setup lang="ts">
import type { BeadSettings, PaletteColor, AdjustmentSettings, DitherSettings, DisplaySettings } from '../types'
import ImageUploader from './ImageUploader.vue'
import SizeSelector from './SizeSelector.vue'
import PalettePanel from './PalettePanel.vue'
import ColorAdjustments from './ColorAdjustments.vue'
import DitherOptions from './DitherOptions.vue'
import DisplayOptions from './DisplayOptions.vue'
import ExportButtons from './ExportButtons.vue'

defineProps<{
  hasGrid: boolean
  settings: BeadSettings
  brandNames: string[]
  selectedBrand: string
  palette: PaletteColor[]
}>()

const emit = defineEmits<{
  'upload': [file: File]
  'update:settings': [settings: BeadSettings]
  'select-brand': [brand: string]
  'add-color': [{ hex: string; name: string }]
  'remove-color': [id: string]
  'export-png': []
  'export-pdf': []
  'save-project': [withImage: boolean]
  'load-project': []
}>()

function updateSize(val: { cols: number; rows: number; keepAspectRatio: boolean }) {
  emit('update:settings', { ...(arguments[1] as any), gridCols: val.cols, gridRows: val.rows, keepAspectRatio: val.keepAspectRatio } as any)
}
</script>

<template>
  <aside class="control-panel">
    <h2 class="title">拼豆工具</h2>
    <ImageUploader @upload="emit('upload', $event)" />
    <SizeSelector
      :modelValue="{ cols: settings.gridCols, rows: settings.gridRows, keepAspectRatio: settings.keepAspectRatio }"
      @update:modelValue="emit('update:settings', { ...settings, gridCols: $event.cols, gridRows: $event.rows, keepAspectRatio: $event.keepAspectRatio })"
    />
    <PalettePanel
      :brandNames="brandNames"
      :selectedBrand="selectedBrand"
      :palette="palette"
      @select-brand="emit('select-brand', $event)"
      @add-color="emit('add-color', $event)"
      @remove-color="emit('remove-color', $event)"
    />
    <ColorAdjustments
      :modelValue="settings.adjustments"
      @update:modelValue="emit('update:settings', { ...settings, adjustments: $event })"
    />
    <DitherOptions
      :modelValue="settings.dithering"
      @update:modelValue="emit('update:settings', { ...settings, dithering: $event })"
    />
    <DisplayOptions
      :modelValue="settings.display"
      @update:modelValue="emit('update:settings', { ...settings, display: $event })"
    />
    <ExportButtons
      :hasGrid="hasGrid"
      @export-png="emit('export-png')"
      @export-pdf="emit('export-pdf')"
      @save-project="emit('save-project', $event)"
      @load-project="emit('load-project')"
    />
  </aside>
</template>

<style scoped>
.control-panel {
  width: 320px;
  flex-shrink: 0;
  padding: 20px;
  border-right: 1px solid var(--border, #e5e4e7);
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-height: 100vh;
  box-sizing: border-box;
}
.title {
  font-size: 20px;
  font-weight: 600;
  color: var(--text-h);
  margin: 0;
}
</style>
```

- [ ] **Step 2: 更新 App.vue**

```vue
<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import ControlPanel from './components/ControlPanel.vue'
import BeadPreview from './components/BeadPreview.vue'
import { usePalette } from './composables/usePalette'
import { useBeadPipeline } from './composables/useBeadPipeline'
import { exportPNG, downloadBlob } from './composables/useExport'
import type { BeadSettings, ProjectFile } from './types'

const { brandNames, palette, selectedBrand, selectBrand, addCustomColor, removeColor } = usePalette()
const { beadGrid, isProcessing, settings, process } = useBeadPipeline()

const imageFile = ref<File | null>(null)

function onUpload(file: File) {
  imageFile.value = file
  triggerProcess()
}

function onUpdateSettings(s: BeadSettings) {
  settings.value = s
  triggerProcess()
}

function onSelectBrand(brand: string) {
  selectBrand(brand)
}

function onAddColor(color: { hex: string; name: string }) {
  addCustomColor(color)
  triggerProcess()
}

function onRemoveColor(id: string) {
  removeColor(id)
  triggerProcess()
}

let debounceTimer: ReturnType<typeof setTimeout>
function triggerProcess() {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    process(imageFile.value, palette.value, settings.value)
  }, 300)
}

watch([selectedBrand], () => {
  // When brand changes, the palette changes → need to reprocess
  triggerProcess()
})

async function onExportPng() {
  if (!beadGrid.value) return
  const blob = await exportPNG(beadGrid.value, {
    showGrid: settings.value.display.showGrid,
    gridLineColor: settings.value.display.gridLineColor,
    gridLineWidth: settings.value.display.gridLineWidth,
    boldGridInterval: settings.value.display.boldGridInterval,
    boldGridColor: settings.value.display.boldGridColor,
    boldGridWidth: settings.value.display.boldGridWidth,
  }, 20)
  downloadBlob(blob, 'perler-beads.png')
}

function onExportPdf() {
  // PDF export will be implemented later with pdf-lib
  alert('PDF 导出功能待实现')
}

function onSaveProject(includeImage: boolean) {
  if (!beadGrid.value) return
  const project: ProjectFile = {
    version: 1,
    meta: {
      name: `拼豆项目_${new Date().toISOString().slice(0, 10)}`,
      createdAt: new Date().toISOString(),
      brandPalette: selectedBrand.value,
    },
    settings: settings.value,
    palette: {
      brand: selectedBrand.value,
      colors: palette.value.filter(c => c.brand !== 'custom'),
      custom: palette.value.filter(c => c.brand === 'custom'),
    },
  }
  if (includeImage && imageFile.value) {
    const reader = new FileReader()
    reader.onload = () => {
      project.image = reader.result as string
      downloadBlob(new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' }), project.meta.name + '.beads.json')
    }
    reader.readAsDataURL(imageFile.value)
  } else {
    downloadBlob(new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' }), project.meta.name + '.beads.json')
  }
}

function onLoadProject() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.beads.json,application/json'
  input.onchange = async () => {
    const file = input.files?.[0]
    if (!file) return
    const text = await file.text()
    const project: ProjectFile = JSON.parse(text)
    if (project.version !== 1) {
      alert('不支持的项目文件版本')
      return
    }
    settings.value = project.settings
    selectBrand(project.palette.brand)
    // Restore custom colors
    for (const c of project.palette.custom) {
      addCustomColor({ hex: c.hex, name: c.name })
    }
    // Restore image if present
    if (project.image) {
      const resp = await fetch(project.image)
      const blob = await resp.blob()
      imageFile.value = new File([blob], 'restored.png', { type: 'image/png' })
      triggerProcess()
    }
  }
  input.click()
}
</script>

<template>
  <div class="app-layout">
    <ControlPanel
      :hasGrid="!!beadGrid"
      :settings="settings"
      :brandNames="brandNames"
      :selectedBrand="selectedBrand"
      :palette="palette"
      @upload="onUpload"
      @update:settings="onUpdateSettings"
      @select-brand="onSelectBrand"
      @add-color="onAddColor"
      @remove-color="onRemoveColor"
      @export-png="onExportPng"
      @export-pdf="onExportPdf"
      @save-project="onSaveProject"
      @load-project="onLoadProject"
    />
    <BeadPreview
      :beadGrid="beadGrid"
      :display="settings.display"
    />
  </div>
</template>

<style scoped>
.app-layout {
  display: flex;
  height: 100vh;
  overflow: hidden;
}
</style>
```

- [ ] **Step 3: Commit**

```bash
git add src/components/ControlPanel.vue src/App.vue
git commit -m "feat: add ControlPanel container and integrate all components in App.vue"
```

---

## Phase 5: PDF 导出 & 收尾

### Task 5.1: PDF 导出实现

**Files:**
- Create: `src/utils/exportPdf.ts`
- Modify: `src/composables/useExport.ts`
- Modify: `src/App.vue` (update onExportPdf)

- [ ] **Step 1: 实现 `src/utils/exportPdf.ts`**

```typescript
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import type { BeadGrid, PaletteColor } from '../types'
import { renderGridToCanvas } from '../composables/useExport'

interface GridLineSettings {
  showGrid: boolean
  gridLineColor: string
  gridLineWidth: number
  boldGridInterval: number
  boldGridColor: string
  boldGridWidth: number
}

export async function generatePdf(
  grid: BeadGrid,
  gridLines: GridLineSettings,
  cellSize: number,
  title: string,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const boldFont = await doc.embedFont(StandardFonts.HelveticaBold)

  let page = doc.addPage([595, 842]) // A4

  const margin = 40
  let y = 842 - margin

  // Title
  page.drawText(title, { x: margin, y, size: 16, font: boldFont })
  y -= 30

  // Grid info
  page.drawText(`尺寸: ${grid.cols} × ${grid.rows}  |  颜色数: ${grid.palette.length}`, {
    x: margin, y, size: 10, font,
  })
  y -= 20

  // Render grid to canvas and embed as image
  const canvas = renderGridToCanvas(grid, 'color', cellSize, gridLines, 2)
  const dataUrl = canvas.toDataURL('image/png')
  const pngBytes = Uint8Array.from(atob(dataUrl.split(',')[1]), c => c.charCodeAt(0))

  // The actual PNG is too large to decode directly; we'll convert from canvas blob instead
  // For simplicity, embed the canvas directly
  const canvasBlob = await new Promise<Blob>((resolve) => canvas.toBlob(b => resolve(b!), 'image/png'))
  const arrayBuffer = await canvasBlob.arrayBuffer()
  const pngImage = await doc.embedPng(new Uint8Array(arrayBuffer))

  const maxWidth = 595 - margin * 2
  const maxHeight = y - margin - 60 // leave room for legend
  const scale = Math.min(maxWidth / canvas.width, maxHeight / canvas.height)
  const imgW = canvas.width * scale
  const imgH = canvas.height * scale

  page.drawImage(pngImage, {
    x: margin, y: y - imgH,
    width: imgW, height: imgH,
  })
  y -= imgH + 20

  // Color legend
  page.drawText('颜色对照表', { x: margin, y, size: 10, font: boldFont })
  y -= 16

  const colorsPerRow = 8
  const swatchSize = 10
  for (let i = 0; i < grid.palette.length; i += colorsPerRow) {
    const row = grid.palette.slice(i, i + colorsPerRow)
    for (let j = 0; j < row.length; j++) {
      const x = margin + j * 70
      // Draw color swatch
      const hex = row[j].hex.replace('#', '')
      const r = parseInt(hex.slice(0, 2), 16) / 255
      const g = parseInt(hex.slice(2, 4), 16) / 255
      const b = parseInt(hex.slice(4, 6), 16) / 255
      page.drawRectangle({ x, y: y - swatchSize, width: swatchSize, height: swatchSize, color: rgb(r, g, b) })
      page.drawText(`${row[j].name || row[j].hex}`, { x: x + swatchSize + 4, y: y - swatchSize + 2, size: 7, font })
    }
    y -= 14
    if (y < margin) {
      page = doc.addPage([595, 842])
      y = 842 - margin
    }
  }

  return doc.save()
}
```

- [ ] **Step 2: 更新 App.vue 中的 onExportPdf 函数**

将 App.vue 中的 `onExportPdf` 替换为：

```typescript
import { generatePdf } from './utils/exportPdf'

async function onExportPdf() {
  if (!beadGrid.value) return
  const pdfBytes = await generatePdf(
    beadGrid.value,
    {
      showGrid: settings.value.display.showGrid,
      gridLineColor: settings.value.display.gridLineColor,
      gridLineWidth: settings.value.display.gridLineWidth,
      boldGridInterval: settings.value.display.boldGridInterval,
      boldGridColor: settings.value.display.boldGridColor,
      boldGridWidth: settings.value.display.boldGridWidth,
    },
    20,
    `拼豆图案 ${beadGrid.value.cols}×${beadGrid.value.rows}`,
  )
  downloadBlob(new Blob([pdfBytes], { type: 'application/pdf' }), 'perler-beads.pdf')
}
```

- [ ] **Step 3: 验证构建**

```bash
npm run build
# Expected: 构建成功
```

- [ ] **Step 4: Commit**

```bash
git add src/utils/exportPdf.ts src/App.vue
git commit -m "feat: add PDF export with pdf-lib (A4 layout + color legend)"
```

---

## 自审检查清单

- [x] Spec coverage: 图片上传 ✓、尺寸选择 ✓、色板管理 ✓、颜色调整 ✓、抖动 ✓、Canvas 渲染 ✓、符号标注 ✓、网格线 ✓、PNG 导出 ✓、PDF 导出 ✓、项目文件 ✓
- [x] Placeholder scan: 所有代码步骤包含完整实现
- [x] Type consistency: PixelImage 在 useImageProcessor 中定义，所有 composable 使用统一的类型导入
- [x] 所有 Task 自包含，可独立执行
