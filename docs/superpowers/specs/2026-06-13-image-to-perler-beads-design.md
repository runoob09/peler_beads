# 图片转拼豆工具 — 设计文档

> 创建日期: 2026-06-13

## 1. 概述

一个纯前端的图片转拼豆图案工具。用户上传图片，选择色板和尺寸，经过颜色量化和抖动处理后生成拼豆网格，可在浏览器中预览交互，并导出为 PNG/PDF 用于打印和制作。

### 核心功能

- 图片上传 → 自动缩放裁剪 → 颜色匹配 → 拼豆网格生成
- 内置 31 个品牌色板（2037 种唯一颜色），支持自定义增删颜色
- 多种渲染模式：彩色 / 符号标注 / 混合
- 导出 PNG（高 DPI 打印）和 PDF（A4 排版 + 颜色对照表）
- 项目文件保存/恢复（`.beads.json`）

### 技术栈

- Vue 3 + TypeScript + Vite 8
- 纯前端，无后端依赖，构建产物为纯静态文件
- 唯一 NPM 依赖：Vue、pdf-lib

---

## 2. 总体架构

```
App.vue
├── ControlPanel.vue              # 左侧控制面板容器
│   ├── ImageUploader.vue         # 图片拖拽/点击上传
│   ├── SizeSelector.vue          # 网格尺寸选择 + 宽高比锁定
│   ├── PalettePanel.vue          # 色板管理
│   │   ├── PaletteSelector.vue   # 品牌下拉选择
│   │   └── PaletteEditor.vue     # 自定义颜色增删改
│   ├── ColorAdjustments.vue      # 亮度/对比度/饱和度
│   ├── DitherOptions.vue         # 抖动算法 + 强度
│   ├── DisplayOptions.vue        # 符号/网格线/缩放
│   └── ExportButtons.vue         # 导出 PNG / PDF / 项目文件
│
└── BeadPreview.vue               # 右侧预览区 (Canvas + 交互层)
```

### 布局

```
┌──────────────────────────────────────────────┐
│  控制面板（左侧，~320px）  │  预览区 (剩余空间)  │
│                           │                    │
│  [上传图片]               │  ┌──────────────┐  │
│  [尺寸设置]               │  │              │  │
│  [色板选择]               │  │  Canvas 渲染  │  │
│  [颜色调整]               │  │  + 鼠标交互   │  │
│  [抖动选项]               │  │              │  │
│  [显示选项]               │  └──────────────┘  │
│  [导出按钮]               │                    │
│                           │  [缩放] [尺寸信息]  │
└──────────────────────────────────────────────┘
```

---

## 3. 图片处理

### 尺寸适配

用户选择网格尺寸（如 50×50），图片缩放适配有两种模式：

| 模式 | 行为 | 何时使用 |
|------|------|---------|
| 等比缩放 + 居中裁剪 | 按短边填满，长边超出部分居中裁剪 | 默认，保留原图比例 |
| 拉伸填充 | 直接拉伸到网格尺寸 | 关闭"锁定宽高比"时 |

### 尺寸预设

提供常用底板规格的快捷选项：

```
29×29  (1块小底板)      50×50  (4块小底板)
100×100 (大图)          自定义宽×高
```

### 像素提取流程

```
上传图片 → ImageBitmap → 离屏 Canvas resize → getImageData
    → 逐像素: 亮度/对比度/饱和度调整 → RGB → 颜色匹配
```

---

## 4. 数据模型

### 核心类型

```typescript
interface PaletteColor {
  id: string              // 唯一标识
  name: string            // "A01 白色"
  hex: string             // "#FFFFFF"
  brand: string           // "COCO-291"
  symbol?: string         // 标注符号，自动生成
}

interface BeadCell {
  row: number
  col: number
  colorIndex: number      // 指向 working palette
}

interface BeadGrid {
  rows: number
  cols: number
  cells: BeadCell[][]     // [row][col]
  palette: PaletteColor[] // 本次使用的色板
}

interface ProjectFile {
  version: 1
  meta: {
    name: string
    createdAt: string
    brandPalette: string
  }
  settings: {
    gridCols: number
    gridRows: number
    keepAspectRatio: boolean
    dithering: {
      algorithm: 'none' | 'floydSteinberg' | 'atkinson'
      strength: number      // 0-100
    }
    adjustments: {
      brightness: number    // -100 ~ 100
      contrast: number      // -100 ~ 100
      saturation: number    // -100 ~ 100
    }
    display: {
      showGrid: boolean
      gridLineColor: string
      gridLineWidth: number
      boldGridInterval: number  // 每N格加粗，0=不启用
      boldGridColor: string
      boldGridWidth: number
      renderMode: 'color' | 'symbol' | 'mixed'
    }
  }
  palette: {
    brand: string
    colors: PaletteColor[]
    custom: PaletteColor[]   // 用户增删
  }
  image?: string            // Base64，轻量模式不含
}
```

---

## 5. Composable 设计

### 数据流

```
                         ┌──────────────────────┐
  [图片上传] ──────────→ │                      │
  [尺寸设置] ──────────→ │   useBeadPipeline     │──→ beadGrid ──→ BeadPreview
  [色板变更] ──────────→ │   (核心 composable)    │──→ palette  ──→ PalettePanel
  [颜色调整] ──────────→ │                      │──→ ExportButtons
  [抖动设置] ──────────→ │   依赖:               │
  [显示选项] ──────────→ │   useImageProcessor   │
                         │   useColorMatcher     │
                         │   useDither           │
                         │   usePalette          │
                         └──────────────────────┘
```

### 各 Composable 职责

**`usePalette(brandName: string, customColors: PaletteColor[])`**
- 从 `get-colors.json` 按品牌提取颜色
- 按 hex 去重（同品牌同色不同色号只留一个）
- 合并用户自定义颜色
- 预计算所有颜色的 LAB 值
- 输出：`ref<PaletteColor[]>` + 品牌列表

**`useImageProcessor(image: File, gridCols: number, gridRows: number)`**
- 加载图片到 ImageBitmap
- 按目标网格尺寸缩放（保持或拉伸，取决于宽高比锁定）
- 提取像素为 `ImageData`
- 应用亮度/对比度/饱和度调整
- 输出：处理后的 `ImageData`

**`useColorMatcher(palette: PaletteColor[])`**
- 为每个源像素在色板中找最近 LAB ΔE* 颜色
- RGB → LAB 转换
- 结果缓存 `Map<string, number>`（量化 RGB key → 色板索引）
- 输出：匹配函数 `matchColor(r: number, g: number, b: number): number`

**`useDither(imageData: ImageData, palette: PaletteColor[], algorithm, strength)`**
- Floyd-Steinberg 误差扩散
- Atkinson 误差扩散
- 强度参数控制扩散比例（0 = 仅最近邻，100 = 全扩散）
- 输出：量化后的 `ImageData` + `BeadGrid`

**`useBeadPipeline(image, settings)`**
- 串联上述 composable
- 对参数变化做 debounce（300ms），避免频繁重算
- 输出：`ref<BeadGrid>` + `isProcessing` 状态

**`useExport(beadGrid, canvasEl, settings)`**
- PNG：渲染到离屏 Canvas → `canvas.toBlob()`
- PDF：使用 pdf-lib 组装页面
- 触发浏览器下载

---

## 6. Canvas 渲染 & 交互

### 渲染模式

| 模式 | 渲染方式 | 场景 |
|------|---------|------|
| 彩色 | 纯色块 | 屏幕预览 |
| 符号 | 白色底 + 黑色符号字符 | 黑白打印、色盲友好 |
| 混合 | 色块上叠加白色/黑色符号 | 兼顾 |

### 渲染参数

```
cellSize = min(canvasWidth / cols, canvasHeight / rows)
canvas 实际渲染尺寸 = cellSize × cols × cellSize × rows
```

### 网格线

- 常规线：每个珠子之间，`ctx.lineWidth = gridLineWidth`
- 粗线间隔：每 `boldGridInterval` 格绘制加粗线（`boldGridWidth`）
- 典型设置：每 10 格加粗，对应常见底板的视觉分区

### 交互

Canvas 上方覆盖透明 `<div>`，监听鼠标事件：

- **Hover**：高亮当前格子边框 + 浮窗显示颜色名/色号
- **Click**：选中格子，面板显示详情（RGB、色号、所属品牌）
- **坐标计算**：`col = floor(offsetX / cellSize)`, `row = floor(offsetY / cellSize)`

---

## 7. 色板系统

### 数据源

使用项目内的 `get-colors-from-beans/` 数据。**构建时处理**：

```
get-colors-from-beans/get-colors.json ──→ src/data/get-colors.json (复制)
get-colors-from-beans/colorMap.json  ──→ src/data/colorMap.json  (复制)
```

复制在 `prebuild` 阶段执行（或手动一次性复制）。两个 JSON 通过 Vite 的 JSON import 内联到 bundle。

| 文件 | 内容 | 体积 |
|------|------|------|
| `get-colors.json` | 31 品牌，品牌名 → `[{color-name, color}]` | 374KB |
| `colorMap.json` | 2037 唯一 hex → `[{color-name, color-title, color}]` | 607KB |

### 品牌选择流程

```
用户选品牌 → 从 get-colors.json 提取 → hex 去重 → 预计算 LAB → 工作色板
```

### 自定义颜色

- 用户可在当前色板中添加新颜色（色号 + Hex 或取色器）
- 可删除不需要的颜色
- 修改后触发重匹配，debounce 300ms
- 自定义色板随项目文件保存/恢复

### 颜色匹配

- 使用 CIE LAB 色彩空间 + CIE76 ΔE* 最近邻匹配
- 色板 LAB 值一次预计算，匹配时直接查找
- 查找结果缓存到 `Map<quantizedRGB, colorIndex>`

---

## 8. 导出

### PNG

- 离屏 Canvas 渲染，2x 或 4x 缩放入以保证打印清晰度
- `canvas.toBlob('image/png')` → 下载

### PDF

- 使用 pdf-lib，A4 纵向
- 页面内容：标题 → 网格主图 → 尺寸/颜色数信息 → 颜色对照表（■ 色号 颜色名）
- 网格过大时自动分页

### 项目文件 `.beads.json`

- 保存全部设置和色板
- 可选包含 Base64 原图
- 导入后自动恢复状态并重算网格

---

## 9. 目录结构（规划）

```
src/
├── main.ts
├── App.vue
├── style.css
├── composables/
│   ├── useImageProcessor.ts
│   ├── usePalette.ts
│   ├── useColorMatcher.ts
│   ├── useDither.ts
│   ├── useBeadPipeline.ts
│   └── useExport.ts
├── components/
│   ├── ControlPanel.vue
│   │   ├── ImageUploader.vue
│   │   ├── SizeSelector.vue
│   │   ├── PalettePanel.vue
│   │   │   ├── PaletteSelector.vue
│   │   │   └── PaletteEditor.vue
│   │   ├── ColorAdjustments.vue
│   │   ├── DitherOptions.vue
│   │   ├── DisplayOptions.vue
│   │   └── ExportButtons.vue
│   └── BeadPreview.vue
├── data/
│   ├── get-colors.json         # 从 get-colors-from-beans 复制
│   ├── colorMap.json           # 从 get-colors-from-beans 复制
│   └── palettes.ts             # 品牌列表、类型导出
├── utils/
│   ├── colorSpace.ts           # RGB ↔ XYZ ↔ LAB 转换
│   ├── dithering.ts            # Floyd-Steinberg, Atkinson 算法
│   └── exportPdf.ts            # pdf-lib PDF 组装
└── types/
    └── index.ts                # 所有类型定义
```

---

## 10. 构建 & 部署

- **`npm run dev`** — 开发服务器（Vite HMR）
- **`npm run build`** — 类型检查 + 产出 `dist/` 纯静态文件
- **`npm run preview`** — 本地预览生产构建
- 构建前需确保 `src/data/get-colors.json` 和 `src/data/colorMap.json` 已从 `get-colors-from-beans/` 复制到位
- 构建产物可直接浏览器打开，也可部署到任意静态托管
