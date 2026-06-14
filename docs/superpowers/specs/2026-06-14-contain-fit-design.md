# 保持原图比例的网格映射方案

**日期**: 2026-06-14
**状态**: 已批准

## 问题

当前 `resizeImage` 在 `keepAspectRatio: true` 时使用 cover 模式（`Math.max`），将图片缩放到填满整个网格，超出部分被裁切。导致原图比例丢失，内容被裁剪。

## 方案

将映射模式从 cover 改为 contain：

- `gridCols`/`gridRows` 作为**上限约束**，实际图片按原图比例适配，不超出任意上限
- 图片居中放置，四周可能产生无珠子区域
- 无珠子区域的单元格用 `colorIndex: null` 表示
- 渲染时光跳过空单元格，导出时显示为透明/白色

## 核心改动

### 1. 类型变更 (`src/types/index.ts`)

```typescript
// BeadCell.colorIndex 改为 nullable
colorIndex: number | null

// BeadGrid 新增字段记录实际图片区域
imageCols: number
imageRows: number
```

### 2. resizeImage 算法变更 (`src/composables/useImageProcessor.ts`)

`keepAspectRatio: true` 时：

- scale 从 `Math.max(targetW/srcW, targetH/srcH)` 改为 `Math.min(targetW/srcW, targetH/srcH)`
- 图片缩放后居中绘制到目标 canvas，空白区域保留透明

### 3. 渲染适配 (`src/composables/useExport.ts`)

`renderGridToCanvas` / `renderExportCanvas`：
- `colorIndex === null` 的单元格跳过填充和格子绘制
- `buildSymbolMap` 只统计有效 colorIndex
- `countColorUsage` 只统计有效 colorIndex

### 4. Preview 适配 (`src/components/BeadPreview.vue`)

- tooltip：空单元格不显示颜色信息

## 改动文件

| 文件 | 改动 |
|---|---|
| `src/types/index.ts` | `colorIndex: number \| null`，`BeadGrid` 加 `imageCols`/`imageRows` |
| `src/composables/useImageProcessor.ts` | `resizeImage`：scale 改为 min，居中绘制 |
| `src/composables/useBeadPipeline.ts` | 设置 `imageCols`/`imageRows` |
| `src/composables/useExport.ts` | 跳过 `colorIndex === null` 的单元格 |
| `src/components/BeadPreview.vue` | tooltip 空单元格处理 |
| 各测试文件 | 适配 nullable colorIndex |

## 不变

- `ColorLegend`：`countColorUsage` 已只统计有效 colorIndex（null 不是 palette index，自然跳过）
- `keepAspectRatio: false` 的行为不变
- 导出功能接口不变
