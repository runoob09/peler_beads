# 图片编辑功能 — 设计文档

## 概述

上传图片后在弹窗中对图片进行裁剪、旋转、翻转、亮度/对比度/饱和度调整，确认后再进入颜色处理管线。纯 Canvas 2D 实现，零外部依赖。

## 架构

### 新增文件

```
src/composables/useImageEditor.ts   # 图片编辑逻辑 composable
src/components/ImageEditorModal.vue  # 编辑弹窗 UI
```

### 改动文件

```
src/pages/DesignPage.vue  # 上传后弹出编辑弹窗，确认后进入处理管线
```

### 弹窗布局

```
┌──────────────────────────────────────────────────┐
│  [✕]                    图片编辑                 │
├──────────┬───────────────────────┬───────────────┤
│          │                       │               │
│  裁剪    │                       │  亮度   ─●─   │
│  旋转↻  │     图片预览区         │  对比度 ─●─   │
│  旋转↺  │     (Canvas)          │  饱和度 ─●─   │
│  水平翻转│                       │               │
│  垂直翻转│                       │               │
│          │                       │               │
│  重置    │                       │               │
│          │                       │               │
├──────────┴───────────────────────┴───────────────┤
│                  [取消]  [确认]                   │
└──────────────────────────────────────────────────┘
```

- **左侧**：工具按钮（裁剪、旋转、翻转、重置）
- **中央**：Canvas 预览，裁剪模式下可拖拽选框
- **右侧**：亮度/对比度/饱和度滑块
- **底部**：取消（用原图）/ 确认（用编辑后的图）

### 数据流

```
ImageUploader → emit file
    ↓
DesignPage 收到 file → 打开 ImageEditorModal
    ↓
用户在弹窗中编辑（操作全部在 Canvas 上完成）
    ↓
用户点击「确认」
    ↓
Canvas.toBlob() → new File(blob, filename) → imageFile → triggerProcess()
    ↓
后续管线不变（beadStore.process）

用户点击「取消」→ imageFile 不变 → triggerProcess()（使用原图）
```

## useImageEditor Composable API

```typescript
// src/composables/useImageEditor.ts

export interface CropRect {
  x: number         // 裁剪框左上角 x（相对原图坐标）
  y: number
  w: number         // 裁剪框宽
  h: number
}

export interface ImageEditState {
  sourceImage: HTMLImageElement | null
  cropEnabled: boolean
  cropRect: CropRect | null
  rotation: 0 | 90 | 180 | 270
  flipH: boolean
  flipV: boolean
  brightness: number   // 0-200, 默认 100
  contrast: number     // 0-200, 默认 100
  saturation: number   // 0-200, 默认 100
}

export function useImageEditor() {
  const state: ImageEditState
  const previewCanvas: Ref<HTMLCanvasElement | null>

  function loadImage(file: File): Promise<void>
  function setCropEnabled(v: boolean): void
  function setCropRect(rect: CropRect): void
  function rotate(direction: 'cw' | 'ccw'): void
  function flip(direction: 'h' | 'v'): void
  function setFilter(type: 'brightness' | 'contrast' | 'saturation', value: number): void
  function reset(): void
  function render(): void
  function getEditedBlob(): Promise<Blob>
}
```

### 渲染管线（render 内部）

```
原图 → [裁剪] → [旋转] → [翻转] → [滤镜] → 预览 Canvas
```

- 裁剪/旋转/翻转：通过 `ctx.save/restore` + `ctx.translate/rotate/scale` + `ctx.drawImage` 完成
- 滤镜：`getImageData()` → 逐像素计算 → `putImageData()`

### 滤镜公式

- 亮度（乘性）：`clamp(pixel * (value / 100), 0, 255)`
- 对比度：`clamp(((pixel - 128) * (value / 100)) + 128, 0, 255)`
- 饱和度：RGB → HSL → 调整 S → HSL → RGB

## ImageEditorModal 组件

### Props & Emits

```typescript
props: { show: boolean; imageFile: File | null }
emits: { confirm(file: File); cancel() }
```

### 裁剪交互

- 点击左侧「裁剪」按钮进入裁剪模式
- Canvas 上显示裁剪框（默认全图），背景半透明遮罩
- 拖拽裁剪框内任意位置可移动，拖拽四角/四边调整大小
- 按住 Shift 拖拽角时锁定当前宽高比
- 裁剪框外鼠标 `crosshair`，框内 `move`，边角 `nwse-resize`/`nesw-resize`
- 再次点击「裁剪」退出裁剪模式（保留裁剪区域）

### 旋转/翻转

- 点击「顺时针旋转 90°」→ rotation + 90，宽高互换，裁剪框同步更新
- 点击「逆时针旋转 90°」→ rotation - 90
- 点击「水平翻转」/「垂直翻转」→ flipH/flipV 切换
- 翻转后裁剪框坐标根据翻转轴重新映射

### 滤镜滑块

- 滑块拖动时实时更新预览，防抖 50ms
- 范围 0-200，默认 100，步长 1

### 边界处理

| 情况 | 处理 |
|------|------|
| 图片极小（< 50px）| 裁剪框最小 10×10 px |
| 裁剪框超出图片 | clamp 到图片边界内 |
| 旋转后裁剪框坐标 | 根据旋转矩阵重新计算 |
| 弹窗打开时切换路由 | `onUnmounted` 清理 Canvas 和 Blob URL |
| 确认后导出失败 | 捕获异常，toast 提示，关闭弹窗用原图 |
| 窗口缩放 | Canvas 按容器自适应，保持图片居中 |

## DesignPage 集成改动

```typescript
const showEditor = ref(false)

function onUpload(file: File) {
  imageFile.value = file
  showEditor.value = true     // 打开编辑弹窗
  // 不立即 triggerProcess()
}

function onEditorConfirm(file: File) {
  imageFile.value = file
  showEditor.value = false
  triggerProcess()
}

function onEditorCancel() {
  showEditor.value = false
  triggerProcess()            // 用原图处理
}
```

## 测试

### useImageEditor 测试

| 测试 | 验证点 |
|------|--------|
| loadImage | 传入 File → sourceImage 加载成功，cropRect 默认为全图 |
| setCropRect | 裁剪框 clamp 到图片边界内 |
| setCropRect 最小尺寸 | 裁剪框不可缩到 < 10×10 |
| rotate('cw') | 连续调用 4 次 cw 回到 0° |
| rotate('ccw') | 逆时针同理 |
| flip('h') | 切换状态正确 |
| flip('v') | 切换状态正确 |
| setFilter | 值在 0-200 范围内有效，超出 clamp |
| reset | 所有参数回到默认值 |
| getEditedBlob | 返回非空 Blob，type image/png |
| 裁剪 + 旋转组合 | 旋转后裁剪框坐标重新计算正确 |
| 无效输入 | 非图片 File → 抛异常 |

### ImageEditorModal 测试

| 测试 | 验证点 |
|------|--------|
| show=true | 弹窗可见 |
| show=false | 弹窗不可见 |
| 加载图片 | Canvas 渲染图片 |
| 裁剪拖拽 | mousedown/move/up → 裁剪框更新 |
| 旋转按钮 | Canvas 显示旋转后图片 |
| 翻转按钮 | Canvas 显示翻转后图片 |
| 滤镜滑块 | Canvas 像素变化 |
| 确认按钮 | emit confirm 触发 |
| 取消按钮 | emit cancel 触发 |
| 重置按钮 | 状态回到初始值 |
| 清理 | hide 后 blob URL 被 revoke |
