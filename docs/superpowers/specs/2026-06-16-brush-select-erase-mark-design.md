# 画笔框选 + 空白格子标记 — 设计规格

## 功能 1：矩形框选

### 交互流程

- **默认**：单点/拖拽涂色（当前行为不变）
- **按住 Shift**：切换为框选模式
  - 第一次点击：设起点（格子蓝色高亮）
  - 第二次点击：设终点，矩形内所有格子一次性涂色/擦除（1 个 undo entry）
  - 框选完成自动退回默认模式
  - 中途松开 Shift 取消框选

### brushStore 新增状态

```typescript
const selectMode = ref(false)           // 框选模式激活
const selectStart = ref<CellCoord | null>(null)  // 矩形起点
const previewRect = ref<{ r1:number; c1:number; r2:number; c2:number } | null>(null)
```

### brushStore 新增操作

```typescript
beginSelect(row, col)         // 设起点，compute previewRect (same cell)
updatePreview(row, col)       // mousemove 时更新预览矩形
completeSelect(row, col)      // 设终点，填充矩形单元格 → 1 个 undo entry
cancelSelect()                // 清除状态
```

### BeadPreview 改动

- 监听 `keydown/keyup` 控制 `selectMode`
- 框选模式下：
  - 光标 `crosshair`
  - 首次 click → `beginSelect`
  - 二次 click → `completeSelect`
  - mousemove → `updatePreview`（显示半透明蓝色矩形预览覆盖层）
  - 点击非网格区域 → `cancelSelect`
- canvas 渲染层叠加矩形预览框（蓝色半透明边框 + 填充）

---

## 功能 2：空白格子标记

### 渲染

在 `useExport.ts` 的 `renderCell` 中，当 `colorIndex === null` 时：

- 绘制浅灰色对角交叉线（`#d4d4d8`，线宽 1px）
- 两条线：左上→右下、右上→左下，边缘留 2px 边距

```typescript
if (cell.colorIndex === null) {
  const pad = Math.max(2, cellSize * 0.15)
  ctx.strokeStyle = '#d4d4d8'
  ctx.lineWidth = 1
  // 左上 → 右下
  ctx.beginPath()
  ctx.moveTo(x + pad, y + pad)
  ctx.lineTo(x + cellSize - pad, y + cellSize - pad)
  ctx.stroke()
  // 右上 → 左下
  ctx.beginPath()
  ctx.moveTo(x + cellSize - pad, y + pad)
  ctx.lineTo(x + pad, y + cellSize - pad)
  ctx.stroke()
  return  // 不填充颜色
}
```

### 影响范围

- `useExport.ts:renderCell` — 添加 null 格标记
- BeadPreview — 复用 renderCell，自动生效
- FocusGrid — 复用 renderAllCells，自动生效
- 导出 PNG/PDF — `renderExportCanvas` 调用 `renderCell` 时 `showLabels` 为 true，null 格标记不影响（因为 `renderExportCanvas` 跳过 null 格）

---

## 文件变更

```
修改：
├── src/stores/brushStore.ts        # 框选状态 + beginSelect/updatePreview/completeSelect/cancelSelect
├── src/components/BeadPreview.vue  # Shift 监听 + 框选交互 + 预览渲染
├── src/composables/useExport.ts   # renderCell: null 格标记
```

---

## 测试策略

| 模块 | 新增测试 |
|------|---------|
| brushStore | beginSelect/complteSelect 矩形填充正确、undo 用 1 entry、cancelSelect 清除、previewRect 更新、边界裁剪 |
| BeadPreview | Shift 切换 selectMode、框选模式下点击行为、预览矩形渲染 |
| useExport | null 格渲染斜线标记、非 null 格不渲染标记 |
