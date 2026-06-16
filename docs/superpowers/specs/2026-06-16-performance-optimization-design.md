# Perler-Beads 性能优化 — 设计规格

## 概述

对 perler-beads 项目进行全面性能优化，覆盖打包体积、渲染管线、数据处理、状态管理四个维度。采用允许架构变更的全面改造策略。

## 子系统 A：打包体积优化

### A.1 路由级代码分割

`src/router/index.ts` — 改为懒加载：

```typescript
const routes = [
  { path: '/', component: () => import('../pages/DesignPage.vue') },
  { path: '/focus', component: () => import('../pages/FocusPage.vue') },
]
```

DesignPage 和 FocusPage 各自独立 chunk，首屏只加载当前路由。

### A.2 get-colors.json 按需加载

当前 `src/data/palettes.ts` 顶部 `import getColors from './get-colors.json'` 将 382KB 全部打入主 bundle。

改为动态 import + 按品牌缓存：

```typescript
const brandCache = new Map<string, BrandColor[]>()
const allColorsPromise: Promise<any> | null = null

export async function loadBrandColors(brand: string): Promise<BrandColor[]> {
  if (brandCache.has(brand)) return brandCache.get(brand)!
  if (!allColorsPromise) allColorsPromise = import('./get-colors.json')
  const all = await allColorsPromise
  // 首次加载后缓存所有品牌（或按需提取单个品牌）
  // ...
}
```

`BRAND_NAMES` 从 JSON keys 提取或写入独立小的常量文件。

### A.3 pdf-lib 全动态导入

`src/utils/exportPdf.ts` 当前顶部 `import { PDFDocument, ... } from 'pdf-lib'` 阻止代码分割。

改为函数内动态 import：
```typescript
export async function generatePdf(...) {
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib')
  // 其余不变
}
```

### A.4 删除未使用的 colorMap.json

`src/data/colorMap.json`（621KB）未被任何文件 import，直接删除。

### 预期效果

主 bundle 从 802KB → ~300KB，首屏加载减少 60%+。

---

## 子系统 B：渲染管线优化

### B.1 FocusGrid 离屏 + 分层渲染

当前每帧在可见 canvas 上全量重绘（底层格子 + 网格线 + 高亮覆盖层），60fps 持续运行。

改为两层离屏架构：

- **静态层**（离屏 Canvas）：底色格子和网格线。仅在 grid/blocks 变化时重绘。
- **覆盖层**（离屏 Canvas）：脉冲高亮边框 + 已标记绿底打勾。降频到 4fps（250ms 间隔），无活跃 block 时停 RAF。
- **可见 Canvas**：每帧从两个离屏层合成。

```typescript
let staticLayer: HTMLCanvasElement  // renderAllCells + drawGridLines
let overlayLayer: HTMLCanvasElement // pulse borders + checkmarks
let lastOverlayUpdate = 0
const OVERLAY_INTERVAL = 250  // 4fps

function animLoop(timestamp: number) {
  const ctx = visibleCanvas.getContext('2d')
  ctx.drawImage(staticLayer, 0, 0)
  if (focusStore.currentBlock && timestamp - lastOverlayUpdate > OVERLAY_INTERVAL) {
    updateOverlay()  // 重绘覆盖层
    lastOverlayUpdate = timestamp
  }
  ctx.drawImage(overlayLayer, 0, 0)
  if (focusStore.currentBlock) {
    animRafId = requestAnimationFrame(animLoop)
  }
}
```

### B.2 BeadPreview 内存泄漏修复

`src/components/BeadPreview.vue:293-297` — `onUnmounted` 补充清理：

```typescript
onUnmounted(() => {
  cancelAnimationFrame(renderRafId)
  renderRafId = 0
  document.removeEventListener('mousemove', onPanMove)
  document.removeEventListener('mouseup', onDocumentMouseUp)
  document.removeEventListener('keydown', onKeyDown)
})
```

### B.3 Canvas style 条件设置

`BeadPreview.vue:138-139` — 仅在尺寸变化时设置，避免每次渲染触发强制 reflow：

```typescript
if (sizeChanged) {
  canvasRef.value.style.width = w + 'px'
  canvasRef.value.style.height = h + 'px'
}
```

### 预期效果

FocusGrid CPU 从 ~60% → ~2%（空闲时 0%），BeadPreview 无泄漏，路由切换不残留 RAF。

---

## 子系统 C：数据处理优化

### C.1 DBSCAN 空间网格索引

当前 `useClusterer.ts:23,38-40` 每次找邻居都 `points.filter(...)` 全量扫描（O(n per point)）。

改为空间网格索引，按 EPS 粒度分桶：

```typescript
function buildSpatialIndex(points: Point[], eps: number): Map<string, Point[]> {
  const grid = new Map<string, Point[]>()
  for (const p of points) {
    const key = `${Math.floor(p.row / eps)},${Math.floor(p.col / eps)}`
    if (!grid.has(key)) grid.set(key, [])
    grid.get(key)!.push(p)
  }
  return grid
}

function getNeighbors(p: Point, index: Map<string, Point[]>, eps: number): Point[] {
  const result: Point[] = []
  const gr = Math.floor(p.row / eps)
  const gc = Math.floor(p.col / eps)
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      const bucket = index.get(`${gr + dr},${gc + dc}`)
      if (bucket) {
        for (const q of bucket) {
          if (q !== p && manhattan(p, q) <= eps) result.push(q)
        }
      }
    }
  }
  return result
}
```

每个点只查 9 个桶而非全量 N 个点。复杂度从 O(n² per color) → O(n per color)。

### C.2 非阻塞 clusterGrid

`focusStore.ts:166` — `clusterGrid()` 同步调用在 `onMounted` 中阻塞 UI。

```typescript
async function initFromGridFresh(): Promise<void> {
  const bead = useBeadStore()
  if (!bead.beadGrid) return
  
  const totalCells = bead.beadGrid.rows * bead.beadGrid.cols
  if (totalCells < 5000) {
    // 小网格：同步执行
    blocks.value = clusterGrid(bead.beadGrid)
  } else {
    // 大网格：分片执行
    blocks.value = await clusterGridAsync(bead.beadGrid)
  }
}
```

`clusterGridAsync` 对每个颜色的聚类用 `requestIdleCallback` 或 `setTimeout(0)` 分片。

### C.3 Lab 颜色缓存

`src/utils/colorSpace.ts` — 新增 `Map<hex, LAB>` 缓存，paletteStore 的 `computeLab` 改用缓存版本。同一颜色只算一次 Lab 转换。

### C.4 图像处理分片（评估后实施）

对 dominant/bucket 算法中 `toleranceDominantBlock` 的 O(n×pixels×clusters) 循环，如果 C.1-C.3 后仍是大网格瓶颈，考虑 Web Worker 方案。

### 预期效果

DBSCAN 10000 点从 ~2s → ~50ms，品牌切换即时响应。

---

## 子系统 D：状态管理优化

### D.1 focusStore 合并冗余 computed

当前 `completedColors` 和 `pendingColors` 各自构建 `done` Set（两次遍历 + 冗余判断）。

改为：`completedColors` 直接按 `status === 'completed'` 过滤，`pendingColors` 按 `status !== 'completed'` 过滤。移除冗余 Set 构建。

### D.2 shallowRef 优化不变数据

`blocks` 数组在 `initFromGrid` 后结构不变（仅 status/markedCells 变化）。使用 `shallowRef` 避免深度响应式追踪：

```typescript
const blocks = shallowRef<FocusBlock[]>([])
```

FocusGrid 使用 RAF 主动读取状态，不依赖深层响应式追踪。

---

## 文件变更汇总

```
修改文件：
├── src/router/index.ts                    # A.1 路由懒加载
├── src/data/palettes.ts                   # A.2 动态 import JSON
├── src/utils/exportPdf.ts                 # A.3 pdf-lib 动态导入
├── src/components/focus/FocusGrid.vue     # B.1 离屏分层渲染
├── src/components/BeadPreview.vue         # B.2+B.3 泄漏修复+条件设置
├── src/composables/useClusterer.ts        # C.1 空间索引
├── src/stores/focusStore.ts               # C.2 非阻塞+D.1+D.2
├── src/utils/colorSpace.ts               # C.3 Lab 缓存
├── src/stores/paletteStore.ts             # C.3 使用缓存 Lab

删除文件：
├── src/data/colorMap.json                 # A.4 未使用
```

---

## 测试策略

| 子系统 | 新增测试 | 现有测试保持 |
|--------|---------|------------|
| A — 打包 | 验证动态 import 正确解析品牌颜色 | 全部 |
| B — 渲染 | FocusGrid 离屏层合成正确、RAF 启停逻辑、BeadPreview unmount 清理 | BeadPreview 3 个 |
| C — 数据 | DBSCAN 空间索引输出与原实现一致、颜色缓存 hit/miss | useClusterer 9 个 |
| D — 状态 | focusStore computed 合并后值一致、shallowRef 行为 | focusStore 18 个 |
