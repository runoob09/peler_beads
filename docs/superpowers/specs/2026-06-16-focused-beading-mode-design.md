# 专心拼豆模式 (Focused Beading Mode) — 设计规格

## 概述

为 perler-beads 应用增加"专心拼豆模式"，进入后按**颜色优先、颜色内按块**的策略，引导用户逐步完成拼豆。同一颜色按空间邻近度聚类为"块"，逐块引导用户放置，配合计时和进度追踪。

## 架构概览

### 引入 vue-router

当前应用无路由（单页），需要新增路由层。两条路由：

- `/` — 设计页，现有三栏布局（现有 App.vue 内容）
- `/focus` — 专心拼豆页，全新的独立页面布局

Pinia 天然跨路由持久化，`beadGrid` 和 `palette` 无需额外传递。

路由使用 **hash mode**（`createWebHashHistory`），项目是纯静态 SPA，hash 模式无需服务端配置。

### 文件变更

```
新增依赖：
├── vue-router

新增文件：
├── src/router/index.ts                 # 路由配置
├── src/pages/DesignPage.vue            # 重构：将当前 App.vue 内容移入此页
├── src/pages/FocusPage.vue             # 专心拼豆页（独立布局）
├── src/pages/__tests__/
│   ├── DesignPage.test.ts
│   └── FocusPage.test.ts
├── src/stores/focusStore.ts            # 专注模式所有状态
├── src/stores/__tests__/
│   └── focusStore.test.ts
├── src/composables/useClusterer.ts     # 颜色-空间聚类算法
├── src/composables/useTimer.ts         # 计时器
├── src/composables/__tests__/
│   ├── useClusterer.test.ts
│   └── useTimer.test.ts
├── src/components/focus/
│   ├── FocusToolbar.vue                # 顶部工具栏
│   ├── FocusGrid.vue                   # 专注模式网格视图
│   ├── FocusColorBar.vue               # 左侧：当前颜色 + 块进度
│   ├── FocusColorList.vue              # 右侧：已完成/待完成颜色列表
│   ├── FocusBottomBar.vue              # 底部操作栏
│   └── __tests__/
│       ├── FocusToolbar.test.ts
│       ├── FocusGrid.test.ts
│       └── FocusBottomBar.test.ts

修改文件：
├── src/main.ts                         # 注册 router
├── src/App.vue                         # 简化为 <RouterView />
├── src/components/BeadPreview.vue      # 添加"进入专注模式"入口按钮
```

### 数据流

1. 用户在 `/` 设计页上传图片、选择调色板、调整设置 → `beadGrid` 存入 `beadStore`
2. 用户点击"进入专心拼豆" → `router.push('/focus')`
3. `FocusPage` mount 时从 `beadStore` 读取 `beadGrid`，运行聚类 → 生成 `ColorBlock[]` 序列存入 `focusStore`
4. 用户在 `/focus` 中的所有进度操作只修改 `focusStore`，**原始 beadGrid 不变**
5. 用户完成或退出 → `router.push('/')`，回到设计页

### 路由守卫

`/focus` 进入前检查 `beadStore.beadGrid !== null`，不存在则重定向到 `/`。

---

## 聚类算法设计

### 算法选择：DBSCAN

- **自动确定块数**：不需要预设 K 值，根据密度自动发现簇
- **天然处理噪声**：孤立点自动标记为噪声
- **对不规则形状友好**：能识别任意形状的块

### 参数

- `eps`（邻域半径）= 2 格。距离度量使用曼哈顿距离（`|dx| + |dy|`）：
  - 距离 1：上下左右直接邻居（4 邻域）
  - 距离 2：对角线邻居 + 跳两格的轴向邻居（8 邻域外的扩展）
  - 此设置使得 DBSCAN 能将间隙 ≤ 1 个格子的同色区域识别为同一块
- `minPts`（最小点数）= 10，形成一个块至少需要 10 个相邻同色格子

### 流程

```
输入: beadGrid (BeadGrid), paletteColors (调色板颜色数组)
输出: ColorBlock[] (有序的块序列)

1. 按颜色分组所有单元格 → Map<colorIndex, {row, col}[]>
2. 按每个颜色的单元格数量从少到多排序（先完成少量颜色，增强成就感）
3. 对每种颜色:
   a. 对其所有坐标运行 DBSCAN → 划分为若干块
   b. 每个块内部按行优先排序
   c. 不足 minPts（< 10）的零星格子合并为"零星块"，放在该颜色最后
4. 生成最终序列: ColorBlock[]
```

### 边界情况

- 单一颜色有大量连续区域 → DBSCAN 自动切分为多个可管理的块
- 某种颜色只有 1-2 个孤立格子 → 合并为一个"零星块"
- 全图只有一种颜色 → 仍然按空间聚类分块

---

## 界面布局

FocusPage 为独立全屏布局，与设计页完全不同：

```
┌─────────────────────────────────────────────────────┐
│  ← 退出   拼豆进度 ████░░░░ 45%    ⏱ 12:34        │  FocusToolbar
├────────┬────────────────────────────────┬───────────┤
│        │                                │           │
│ 当前   │                                │  完成     │
│ 颜色   │      网格视图                  │  的颜色   │
│ 指示   │   (可缩放/平移)               │  列表     │
│        │                                │           │
│ ● #FF  │   当前块高亮（脉冲动画）       │  ✅ 白色  │
│        │   已标记格子打勾               │  ✅ 黑色  │
│ 块进度 │                                │  ⏳ 红色  │
│ 3/12   │                                │  ⬜ 蓝色  │
│        │                                │           │
├────────┴────────────────────────────────┴───────────┤
│  [← 上一块]    [标记当前块完成 ✓]    [下一块 →]    │  FocusBottomBar
└─────────────────────────────────────────────────────┘
```

### 交互细节

- **当前块高亮**：目标格子有柔和的脉冲/呼吸动画边框
- **点击格子**：切换"已标记/未标记"状态，已标记格子变为半透明灰色并打勾
- **快捷键**：Space = 标记当前块完成，← → = 上/下一块切换
- **退出确认**：如果有进度，弹出确认对话框提示进度丢失
- **颜色切换**：当前颜色所有块完成后，自动跳转到下一种颜色的第一个块

---

## 状态管理 (focusStore)

```typescript
interface CellCoord {
  row: number
  col: number
}

interface ColorBlock {
  id: string                          // 唯一标识
  colorIndex: number                  // 调色板索引
  colorName: string                   // 颜色名称
  colorHex: string                    // 十六进制颜色
  cells: CellCoord[]                  // 块内所有格子
  status: 'pending' | 'active' | 'completed'
  markedCells: Set<string>            // "row,col" 已标记的格子
  startedAt: number | null            // 开始时间戳
  completedAt: number | null          // 完成时间戳
}

// Store 状态
focusStore {
  blocks: ColorBlock[]
  currentBlockIndex: number

  // 计时
  totalElapsed: number
  isTimerRunning: boolean
  blockStartTime: number | null

  // 计算属性
  currentBlock: ColorBlock
  currentColorIndex: number
  progress: number                    // 已完成块 / 总块数 * 100
  completedColors: ColorBlock[]
  pendingColors: ColorBlock[]

  // 操作
  initFromGrid(beadGrid, palette)
  markCell(row, col)
  completeBlock()
  prevBlock() / nextBlock()
  toggleTimer()
  reset()
}
```

### 数据派生

- `blocks` 在 `initFromGrid()` 时一次性生成，后续不可变
- `markedCells` 是唯一用户写入的状态（per-block）
- `progress`、`completedColors` 等为计算属性，实时反映

### 与 beadStore 的关系

- 只读依赖：读取 `beadGrid` 和 `palette` 用于初始化和渲染
- **不修改 beadStore**：专注模式是"消费"已生成的网格

---

## 持久化

### 方式：localStorage

进度数据量不大，localStorage 是最简单的方案。

### 策略

- **自动保存**：每次 `markCell()`、`completeBlock()`、`prevBlock()`/`nextBlock()` 后自动写入
- **防抖**：写入使用 300ms 防抖
- **键名**：`perler-beads:focus-progress`，存储 JSON
- **恢复检查**：进入 `/focus` 时检查 localStorage。进度数据存在且与当前 `beadGrid` 匹配（通过网格尺寸 + 颜色分布哈希校验），弹出"检测到未完成的拼豆进度，是否继续？"；不匹配则丢弃
- **清除时机**：所有块 `completed` 后自动清除

### 持久化数据结构

```typescript
interface PersistedProgress {
  gridFingerprint: {
    rows: number
    cols: number
    colorHash: string           // 各颜色索引 + 格子计数的 JSON 字符串快速哈希（browser-native，非加密级）
  }
  blocks: {
    id: string
    status: 'pending' | 'active' | 'completed'
    markedCells: [number, number][]
    startedAt: number | null
    completedAt: number | null
  }[]
  currentBlockIndex: number
  totalElapsed: number
  lastSaveTimestamp: number     // 用于计算离线时间
}
```

### 恢复计时处理

如果 `lastSaveTimestamp` 与当前时间有差距（用户关闭了页面），弹出对话框询问是否将离线时间计入总计时。

---

## 计时器设计 (useTimer)

### 状态

```typescript
totalElapsed: number          // 总已用时间（毫秒）
isRunning: boolean
blockStartTime: number | null // Date.now()
blockElapsed: number          // 当前块已用时间（毫秒）
```

### 操作

```typescript
start() / pause() / resume()
reset()                       // 全部归零
startBlock()                  // 记录 blockStartTime，blockElapsed 归零
getBlockTime(): number        // 当前块用时
```

### 行为规则

1. 进入专注模式 → 计时器默认暂停，用户手动开始
2. 完成一个块 → 自动记录该块用时
3. 退出/页面隐藏（`visibilitychange`）→ 计时器暂停
4. 恢复进度 → 计时器从 `lastSaveTimestamp` 恢复

### 显示格式

`HH:MM:SS`（超过 1 小时）或 `MM:SS`（1 小时内），在 FocusToolbar 右侧显示。

---

## 组件职责

### 新增组件

| 组件 | 职责 | 关键依赖 |
|------|------|---------|
| `FocusPage.vue` | 组合所有子组件，初始化 focusStore | focusStore, useTimer |
| `FocusToolbar.vue` | 顶部固定栏：退出按钮、进度条、当前颜色名、计时器 | focusStore, useTimer |
| `FocusGrid.vue` | 网格渲染 + 块高亮 + 格子点击交互 | focusStore.beadGrid，复用 useExport 渲染函数 |
| `FocusColorBar.vue` | 左侧：当前颜色指示 + 块进度（m/N） | focusStore |
| `FocusColorList.vue` | 右侧：已完成/待完成颜色列表（可滚动） | focusStore |
| `FocusBottomBar.vue` | 底部操作栏：上一块、完成按钮、下一块 | focusStore |

### 现有组件适配

| 组件 | 变更 |
|------|------|
| `BeadPreview.vue` | 在工具栏区域添加"进入专注模式"按钮，有 beadGrid 时显示 |
| `App.vue` | 简化为 `<RouterView />` 外壳 |
| `main.ts` | 注册 router |

---

## 路由配置

```typescript
// src/router/index.ts
const routes = [
  { path: '/', component: DesignPage },
  { path: '/focus', component: FocusPage, beforeEnter: requireBeadGrid },
]
```

`requireBeadGrid` 守卫：检查 `beadStore.beadGrid !== null`，否则重定向 `/`。

---

## 测试策略

按 TDD 先写测试，后实现。

### useClusterer

- 空网格返回空块序列
- 单一颜色全部连续 → 形成一个或多个块
- 单一颜色分散分布 → DBSCAN 正确划分，验证块数
- 多种颜色 → 按数量从少到多排序
- 孤立格子（< minPts=10）→ 合并为"零星块"放在该颜色最后
- 最小块大小边界：刚好 9/10/11 格的区域

### focusStore

- `initFromGrid()` 生成正确数量的 blocks
- `markCell()` 正确添加/移除标记
- `completeBlock()` 状态推进 + 自动切换到下一颜色
- `prevBlock()`/`nextBlock()` 边界处理（第一块/最后一块）
- `progress` 计算属性正确
- 持久化：保存 → 恢复 → 状态一致
- 恢复时网格指纹不匹配 → 丢弃旧进度

### useTimer

- 启动/暂停/恢复状态转换
- `startBlock()` 重置块计时
- 页面隐藏时自动暂停
- 恢复时离线时间询问逻辑

### 组件测试

- `FocusPage`: 无 beadGrid 时重定向、blocks 初始化、退出确认、恢复对话框
- `FocusGrid`: 格子点击切换标记、块高亮正确
- `FocusBottomBar`: 完成按钮推进进度、上下块导航、边界禁用
- `FocusToolbar`: 进度百分比正确、计时器显示
