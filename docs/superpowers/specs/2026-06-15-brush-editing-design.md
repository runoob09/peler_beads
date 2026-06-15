# Brush Editing Feature Design

**Date**: 2026-06-15
**Status**: Approved

## Overview

在图片映射为拼豆网格后，用户可以通过画笔工具对单个格子进行颜色修改。支持拖拽涂色、调色板/图例选色、多步撤销/重做。引入 Pinia 统一管理应用状态。

## Architecture: Three Pinia Stores

```
┌─────────────────────────────────────────────────────────┐
│                      Pinia Stores                        │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │ paletteStore │  │  beadStore   │  │  brushStore   │  │
│  │ - brandNames │  │ - beadGrid   │  │ - brushMode   │  │
│  │ - selected   │  │ - progress   │  │ - activeColor │  │
│  │ - palette    │  │ - error      │  │ - undoStack   │  │
│  │ - custom     │  │ - settings   │  │ - redoStack   │  │
│  │              │  │ - process()  │  │ - paintCell() │  │
│  │              │  │              │  │ - undo/redo() │  │
│  └──────────────┘  └──────────────┘  └───────────────┘  │
└─────────────────────────────────────────────────────────┘
                           ▲
    ┌──────────────────────┼──────────────────────┐
    │                      │                      │
 ControlPanel          BeadPreview           ColorLegend
```

### paletteStore

从 `usePalette.ts` 迁移，职责不变：
- `customColors`, `selectedBrand`, `palette`(computed), `brandNames`(computed)
- `selectBrand(name)`, `addCustomColor(color)`, `removeCustomColor(hex)`

### beadStore

从 `useBeadPipeline.ts` 迁移，职责不变：
- `beadGrid`, `progress`, `error`, `settings`
- `process(imageFile, palette)`
- 内部调用 `useImageProcessor` 和 `useColorMatcher` 的纯函数

### brushStore

全新 store，管理编辑状态：

```typescript
export const useBrushStore = defineStore('brush', () => {
  const brushMode = ref(false)
  const activeColorIndex = ref<number | null>(null)
  const undoStack = ref<UndoEntry[]>([])
  const redoStack = ref<UndoEntry[]>([])

  // 一次笔画（mousedown→mouseup）记为一个 UndoEntry
  type UndoEntry = {
    cells: { row: number; col: number; oldColorIndex: number }[]
  }

  function toggleBrushMode()
  function setActiveColor(index: number)
  function paintCell(row: number, col: number)        // 内部调用，修改 beadStore.beadGrid
  function beginStroke()                               // mousedown
  function continueStroke(row: number, col: number)    // mousemove（去重）
  function endStroke()                                 // mouseup: push undoStack, clear redoStack
  function undo()                                      // Ctrl+Z
  function redo()                                      // Ctrl+Y / Ctrl+Shift+Z
})
```

## Component Changes

### ControlPanel

- 新增画笔工具栏（在映射选项区下方）：
  - 画笔模式切换按钮（Toggle），激活时高亮
  - 当前画笔颜色小色块预览
- PaletteEditor 色块：画笔模式下可点击选色
- 用 paletteStore / beadStore / brushStore 替代 props/emits

### BeadPreview

| 操作 | 画笔模式 | 普通模式 |
|------|---------|---------|
| 拖拽（无 Ctrl） | 涂色 | 平移 |
| Ctrl+滚轮 | 缩放 | 缩放 |
| 悬停 | 画笔颜色预览浮层 | 格子信息浮层 |
| 光标 | crosshair/画笔图标 | 默认 |

- `mousedown` → brushStore.beginStroke() + 涂当前格子
- `mousemove`（按住）→ brushStore.continueStroke(row, col)（去重：同一格子不重复涂）
- `mouseup` → brushStore.endStroke()
- 用 beadStore / brushStore 替代 props

### ColorLegend

- 画笔模式下色块可点击选色
- 非画笔模式色块不可点击
- 计数/百分比实时更新：beadStore.beadGrid 变化 → 重新 countColorUsage → 图例刷新
- 用 beadStore / brushStore 替代 props

### 键盘快捷键

| 快捷键 | 功能 |
|--------|------|
| `Ctrl+Z` | undo |
| `Ctrl+Y` / `Ctrl+Shift+Z` | redo |

## Migration: Composables → Stores

| 操作 | 文件 |
|------|------|
| **新建** | `src/stores/paletteStore.ts` |
| **新建** | `src/stores/beadStore.ts` |
| **新建** | `src/stores/brushStore.ts` |
| **删除** | `src/composables/usePalette.ts` |
| **删除** | `src/composables/useBeadPipeline.ts` |
| **修改** | `src/main.ts` — 添加 `createPinia()` |
| **修改** | `src/App.vue` — 用 store 替代 composable |
| **修改** | `src/components/ControlPanel.vue` — 用 store 替代 props/emits |
| **修改** | `src/components/BeadPreview.vue` — 用 store + 画笔交互 |
| **修改** | `src/components/ColorLegend.vue` — 用 store + 画笔选色 |
| **修改** | `package.json` — 添加 `pinia` 依赖 |

以下文件保持纯函数不变（被 beadStore 引用）：
- `src/composables/useImageProcessor.ts`
- `src/composables/useColorMatcher.ts`
- `src/composables/useExport.ts`

## Edge Cases & Error Handling

- **未映射时开画笔**：开关应禁用（无网格不可编辑），按钮灰色
- **画笔模式下切换调色板**：重新映射 → 清空 undo/redo 栈 → 退出画笔模式
- **画笔模式下修改设置（网格尺寸等）**：重新映射 → 清空 undo/redo 栈 → 退出画笔模式
- **涂色到 imageCols/imageRows 外的格子**：不应发生（预览只渲染有效区域），但需在 paintCell 中校验边界
- **重复涂同一格子**：continueStroke 需去重，但 mousedown 立即涂的那个格子也要记录旧的 colorIndex（不能丢）
- **地图色板为空**：activeColorIndex 为 null 时涂色无效
- **undo 栈空时按 Ctrl+Z**：无操作（不报错）
- **redo 栈空时按 Ctrl+Y**：无操作（不报错）
- **键盘快捷键冲突**：Ctrl+Z/Y 仅在画笔模式下生效？还是全局？——全局捕获，但仅在 undo/redo 栈非空时生效

## Testing

需要编写测试用例覆盖：

1. **brushStore 单元测试**
   - 初始状态（brushMode=false, activeColorIndex=null, 空栈）
   - toggleBrushMode 切换
   - setActiveColor 设置/切换颜色
   - paintCell 修改 beadStore 中的 colorIndex
   - beginStroke/continueStroke/endStroke 一笔画的完整流程
   - continueStroke 去重
   - undo 恢复旧颜色，redo 恢复新颜色
   - undo 栈空时 undo 无效果
   - redo 栈空时 redo 无效果
   - 新笔画清空 redoStack
   - 重新映射清空 undo/redo 栈

2. **store 迁移测试**
   - paletteStore 保持原有 usePalette 的行为
   - beadStore 保持原有 useBeadPipeline 的行为
   - 重新映射产生相同的 BeadGrid 结果

3. **组件交互测试**
   - ControlPanel 画笔按钮切换 brushMode
   - PaletteEditor 色块点击设置 activeColorIndex
   - ColorLegend 色块在画笔模式下可点击选色
   - ColorLegend 色块在非画笔模式下不可点击
   - BeadPreview 画笔模式下拖拽涂色
   - BeadPreview 普通模式下拖拽平移
