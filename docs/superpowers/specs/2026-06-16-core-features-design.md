# 核心功能补充设计

## 概述

补充拼豆设计工具缺失的 4 项核心功能：导出用量统计、空白画布模式、连通块颜色替换、底板尺寸预设。

## 1. 导出珠子用量总计

### 功能描述

在 PNG/PDF 导出画布底部的「颜色图例（按数量降序）」末尾追加一行总计，格式为「总计：XXXX 颗」。

### 改动范围

| 文件 | 改动 |
|------|------|
| `src/composables/useExport.ts` | `renderExportCanvas()` 图例渲染尾部追加总计行 |
| `src/utils/exportPdf.ts` | PDF 图例同理追加总计行 |

### 数据来源

复用现有 `countColorUsage(grid)`，对 Map 的 values 求和即可。

### 总计行样式

- 字体大小与图例颜色名一致
- 右对齐或居中，前无可选色块
- 字体加粗

---

## 2. 空白画布模式

### 功能描述

用户可通过顶部 Tab 切换「从图片创建」和「空白画布」两种模式。空白画布模式下，选择底板尺寸和调色板后，创建全空 BeadGrid，自动进入画刷模式。

### UI 设计

```
ControlPanel 顶部：

┌───────────────────────────────┐
│ [🖼 从图片创建]  [✏️ 空白画布]  │
├───────────────────────────────┤
│                               │
│  「从图片创建」：现有 UI        │
│    - 图片上传按钮              │
│    - 尺寸设置                  │
│    - 算法设置                  │
│                               │
│  「空白画布」：                │
│    - 底板预设下拉 + 尺寸输入    │
│    - 调色板选择                │
│    - [创建画布] 按钮           │
│                               │
└───────────────────────────────┘
```

### 状态设计

**BeadStore 新增**：

```ts
creationMode: Ref<'image' | 'blank'>     // 当前创建模式
initEmptyGrid(rows: number, cols: number): void  // 创建空画布
```

**DesignPage 改动**：

- 新增 `pageMode` 响应式状态绑定到 ControlPanel 的 Tab
- 切换到 blank 模式时不清除现有画布
- `initEmptyGrid` 后自动开启 brushMode、关闭 brushMode 的 toggle 为 true

### 空画布创建逻辑

`beadStore.initEmptyGrid(rows, cols)`：

```ts
function initEmptyGrid(rows: number, cols: number) {
  const cells: BeadCell[][] = Array.from({ length: rows }, (_, r) =>
    Array.from({ length: cols }, (_, c) => ({
      row: r, col: c, colorIndex: null,
    })),
  )
  beadGrid.value = {
    rows, cols, cells,
    palette: paletteStore.palette,
    imageCols: cols,
    imageRows: rows,
  }
  imageFile.value = null
  progress.value = 0
}
```

### 空画布的行为

- 所有格子初始 `colorIndex: null`，BeadPreview 渲染为叉号标记
- 画刷模式自动开启
- 可正常导出 PNG/PDF、导入恢复
- 切换到「从图片创建」后上传图片会覆盖空画布

---

## 3. 连通块颜色替换

### 功能描述

在 BeadPreview 画布上右键某个已着色格子，弹出菜单选择「替换为…」，选择目标颜色后，flood-fill 替换该格子所在的整个连通块（同色且相邻的格子集合）。同色但不相连的格子不受影响。

### 交互流程

```
右键画布格子
    │
    ▼
┌──────────────┐
│  🔄 替换为…  │
└──────────────┘
    │ 点击
    ▼
┌──────────────────────────┐
│  替换该连通块             │
│                          │
│  将 X 颗 #A01 白色 替换为 │
│                          │
│  ┌──┬──┬──┬──┐          │
│  │■ │■ │■ │  │  ← 调色板 │
│  └──┴──┴──┴──┘   色块选择 │
│                          │
│       [取消]  [替换]      │
└──────────────────────────┘
```

### 实现要点

**Flood-fill 算法**：

```ts
function floodFill(
  grid: BeadGrid,
  startRow: number, startCol: number,
): { row: number; col: number }[] {
  const sourceIndex = grid.cells[startRow][startCol].colorIndex
  if (sourceIndex === null) return []

  const visited = new Set<string>()
  const result: { row: number; col: number }[] = []
  const queue = [{ row: startRow, col: startCol }]

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

**brushStore 新增**：

```ts
// 状态
showReplaceModal: Ref<boolean>
replaceSourceIndex: Ref<number | null>
replaceCellCount: Ref<number>
replaceCells: Ref<{ row: number; col: number }[]>

// 方法
initReplace(row: number, col: number): void   // 右键触发，计算连通块
confirmReplace(targetIndex: number): void       // 确认替换（并入 undo stack）
cancelReplace(): void                           // 取消
```

**替换确认后**：生成 UndoEntry 推入 undoStack，可撤销。

### 右键菜单位置

- 跟随鼠标点击位置
- 使用绝对定位 + Teleport to body
- 点击画布其他区域自动关闭

---

## 4. 底板尺寸预设

### 功能描述

在尺寸设置区域增加一个下拉选择器，提供常见方形拼豆底板尺寸预设，选择后自动填入行列数。

### 预设列表

```ts
const BOARD_PRESETS = [
  { label: '小方板 14×14', rows: 14, cols: 14 },
  { label: '大方板 29×29', rows: 29, cols: 29 },
  { label: '迷你板 10×10', rows: 10, cols: 10 },
  { label: '中板 20×20', rows: 20, cols: 20 },
  { label: '超大方板 50×50', rows: 50, cols: 50 },
  { label: '自定义', rows: 0, cols: 0 },  // 选择后手动输入
]
```

### 交互

- 下拉选择预设后，行列输入框自动填入对应值并禁用
- 选择「自定义」时，输入框恢复可编辑

### 改动范围

| 文件 | 改动 |
|------|------|
| `src/components/SizeSelector.vue` | 新增预设下拉，自动填入逻辑 |
| `src/data/boardPresets.ts`（新增） | 预设常量定义 |

### SizeSelector 改动

```vue
<div class="preset-row">
  <label>底板预设</label>
  <select v-model="selectedPreset" @change="applyPreset">
    <option v-for="p in BOARD_PRESETS" :key="p.label" :value="p">
      {{ p.label }}
    </option>
  </select>
</div>
<!-- 现有行列输入框，预设模式下 disabled -->
```

---

## 影响范围汇总

| 功能 | 新增文件 | 修改文件 |
|------|---------|---------|
| 用量总计 | - | `useExport.ts`, `exportPdf.ts` |
| 空白画布 | - | `DesignPage.vue`, `ControlPanel.vue`, `beadStore.ts`, `types/index.ts` |
| 颜色替换 | - | `BeadPreview.vue`, `brushStore.ts`, `types/index.ts` |
| 底板预设 | `data/boardPresets.ts` | `SizeSelector.vue`, `ControlPanel.vue` |

## 测试要点

- 用量总计：验证空画布、全填充画布、部分 eraser 画布的导出总计正确
- 空白画布：验证创建、画刷绘制、导出、导入恢复
- 颜色替换：验证单格连通块、多格连通块、不相连同色块、撤销、橡皮擦替换
- 底板预设：验证预设选择填入、自定义模式恢复、行列边界
