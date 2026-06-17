# 拼豆图纸工具

将图片转换为拼豆像素图案，支持空白画布自由创作，导出可直接使用的拼豆图纸。

## 功能特性

- **图片转拼豆图案** — 上传图片，使用 5 种颜色计算算法（平均色、主导色、桶量化、中位切分、中心加权）和 4 种颜色匹配方法（Delta E、RGB 距离、加权 RGB、CIEDE2000）将图片转换为拼豆格子图。
- **内置图片编辑器** — 上传图片后可进行裁剪、旋转、翻转和 HSL 滤镜调整，然后再转换为拼豆图案。
- **空白画布模式** — 从空白网格开始，使用画笔、橡皮擦、矩形选区自由绘制，支持撤销/重做。
- **连通区域颜色替换** — 右键任意珠子格子，一键将该颜色所有连通区域替换为其他颜色。
- **多品牌调色板** — 支持切换多个真实拼豆品牌的色板，可添加自定义颜色，随时移除不需要的颜色。
- **导出 PNG / PDF** — 导出拼豆图纸，可配置格子大小和网格线样式。导出的文件中嵌入完整项目数据（网格、调色板、设置），支持再次导入编辑。
- **导入图纸** — 重新导入之前导出的 PNG 或 PDF 文件，恢复完整可编辑的项目状态。
- **专注模式** — 将拼豆图案按颜色分块，支持键盘导航（←/→）、逐格标记、内置计时器，进度自动保存到 localStorage——适合按步骤逐色拼豆。

## 技术栈

| 层级 | 技术 |
|------|------|
| 框架 | Vue 3（Composition API，`<script setup>`） |
| 语言 | TypeScript |
| 构建 | Vite 8 |
| 状态管理 | Pinia |
| 路由 | Vue Router（Hash 模式） |
| PDF 导出 | pdf-lib |
| 测试 | Vitest + @vue/test-utils + happy-dom |

## 快速开始

```bash
# 安装依赖
npm install

# 启动开发服务器（热更新）
npm run dev

# 类型检查 + 生产构建
npm run build

# 预览生产构建
npm run preview
```

## 使用指南

### 图片模式

1. 从下拉菜单选择拼豆品牌色板。
2. 上传图片 — 内置编辑器会自动打开，支持裁剪、旋转、滤镜调整。
3. 调整网格尺寸（行×列）、颜色计算算法、匹配方法和容差。
4. 拼豆预览实时更新。

### 空白画布模式

1. 切换到**空白画布**选项卡。
2. 设置所需的网格尺寸，点击**创建画布**。
3. 开启画笔模式，选择颜色，开始绘制。
4. 使用**撤销**/**重做**回退或重做笔画。
5. 矩形选区：按住鼠标拖拽选区矩形，松开后自动填充。

### 导出与导入

- 点击**导出** → 选择 PNG 或 PDF 格式，配置格子大小和网格线 → 下载。
- 点击**导入图纸** → 选择之前导出的 `.png` 或 `.pdf` 文件，恢复完整项目（网格数据、色板、设置）。

### 专注模式

1. 生成拼豆图案后，点击**专注模式**。
2. 图案将按颜色分块，逐块进行拼豆。
3. 放置珠子时标记对应格子；按**空格键**完成当前颜色块。
4. 使用 **← / →** 方向键切换颜色块。
5. 进度自动保存到 localStorage，关闭浏览器后随时恢复。

## 项目结构

```
src/
├── App.vue                  # 根组件
├── main.ts                  # 应用入口
├── style.css                # 全局样式与 CSS 自定义属性
├── types/
│   └── index.ts             # TypeScript 类型定义
├── data/
│   ├── palettes.ts          # 拼豆色板数据（按品牌）
│   └── boardPresets.ts      # 画板尺寸预设
├── stores/
│   ├── beadStore.ts         # 核心拼豆网格状态与处理
│   ├── brushStore.ts        # 画笔/橡皮擦/选区/撤销重做
│   ├── paletteStore.ts      # 色板选择与自定义颜色
│   └── focusStore.ts        # 专注模式状态与持久化
├── composables/
│   ├── useImageProcessor.ts # 颜色提取算法
│   ├── useColorMatcher.ts   # 颜色匹配方法
│   ├── useImageEditor.ts    # 裁剪/旋转/翻转/HSL 滤镜
│   ├── useClusterer.ts      # 颜色聚类分块生成
│   ├── useExport.ts         # Canvas 渲染与 PNG 导出
│   ├── useZoomPan.ts        # 拼豆预览缩放与平移
│   ├── useCellSize.ts       # 格子尺寸计算
│   ├── useGridInteraction.ts# 鼠标交互辅助
│   ├── useKeyboardShortcuts.ts
│   └── useTimer.ts          # 专注模式计时器
├── utils/
│   ├── exportPdf.ts         # PDF 生成（pdf-lib）
│   ├── embedMetadata.ts     # 项目数据嵌入/提取（PNG/PDF）
│   └── colorSpace.ts        # RGB ↔ Lab 色彩空间转换
├── components/
│   ├── BeadPreview.vue      # 主拼豆网格画布
│   ├── ControlPanel.vue     # 设置与色板控制面板
│   ├── ColorLegend.vue      # 颜色图例与珠子统计
│   ├── ImageUploader.vue    # 文件上传组件
│   ├── ImageEditorModal.vue # 图片编辑弹窗
│   ├── ExportModal.vue      # 导出配置对话框
│   ├── PaletteSelector.vue  # 品牌选择下拉菜单
│   ├── PalettePanel.vue     # 色板颜色列表
│   ├── PaletteEditor.vue    # 自定义颜色编辑器
│   ├── SizeSelector.vue     # 网格尺寸控件
│   ├── ExportButtons.vue    # 导出格式按钮
│   └── focus/               # 专注模式子组件
│       ├── FocusToolbar.vue
│       ├── FocusGrid.vue
│       ├── FocusColorBar.vue
│       ├── FocusColorList.vue
│       └── FocusBottomBar.vue
└── pages/
    ├── DesignPage.vue       # 主设计页面
    └── FocusPage.vue        # 专注模式页面
```

## 开发

```bash
# 运行所有测试
npm run test

# 测试监听模式
npm run test:watch

# 类型检查
npx vue-tsc -b
```

提交遵循 [Conventional Commits](https://www.conventionalcommits.org/) 规范。提交前确保 `npm run test` 通过且 `npx vue-tsc -b` 无类型错误。

## 许可证

基于 [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/) 许可 — 免费使用和修改，但仅限于非商业用途。商业使用需获得作者明确授权。
