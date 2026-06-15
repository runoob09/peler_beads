import { ref } from 'vue'
import type { BeadGrid, BeadSettings, PaletteColor, BeadCell } from '../types'
import { loadImageFromFile, computeAverageCells } from './useImageProcessor'
import { createColorMatcher } from './useColorMatcher'

export function useBeadPipeline() {
  const beadGrid = ref<BeadGrid | null>(null)
  const progress = ref(0) // 0 = idle, 1–100 = processing
  const error = ref<string | null>(null)

  const settings = ref<BeadSettings>({
    gridCols: 29,
    gridRows: 29,
    keepAspectRatio: true,
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

    progress.value = 10
    error.value = null

    try {
      const s = { ...settings.value, ...overrideSettings }

      const img = await loadImageFromFile(imageFile)
      progress.value = 30

      // 分块平均采样：每个珠子格子对应原图一块区域，取区域内所有像素的均值作为代表色
      const { cells: avgCells, imageCols, imageRows, imageX, imageY } =
        computeAverageCells(img, s.gridCols, s.gridRows, s.keepAspectRatio)
      progress.value = 60

      // 对每个格子的平均色进行亮度/对比度/饱和度调整
      for (const row of avgCells) {
        for (const cell of row) {
          const adj = applyAdjustmentsToPixel(
            cell.r, cell.g, cell.b,
            s.adjustments.brightness,
            s.adjustments.contrast,
            s.adjustments.saturation,
          )
          cell.r = adj.r
          cell.g = adj.g
          cell.b = adj.b
        }
      }
      progress.value = 80

      // 用 Delta E 最近邻匹配到调色板
      const matchColor = createColorMatcher(palette)
      const cells: BeadCell[][] = Array.from({ length: s.gridRows }, () =>
        Array.from({ length: s.gridCols }, () => ({ row: 0, col: 0, colorIndex: null as number | null })),
      )

      for (let row = 0; row < s.gridRows; row++) {
        for (let col = 0; col < s.gridCols; col++) {
          const avg = avgCells[row][col]
          cells[row][col] = { row, col, colorIndex: null }

          // 检查格子是否在图片区域内（contain 模式边界外）
          if (col < imageX || col >= imageX + imageCols || row < imageY || row >= imageY + imageRows) {
            continue
          }

          if (avg.a === 0) continue // 完全透明

          const match = matchColor(avg.r, avg.g, avg.b)
          cells[row][col] = { row, col, colorIndex: match.index }
        }
      }

      const grid: BeadGrid = {
        rows: s.gridRows,
        cols: s.gridCols,
        cells,
        palette,
        imageCols,
        imageRows,
      }

      beadGrid.value = grid
      progress.value = 100
    } catch (e) {
      error.value = e instanceof Error ? e.message : '处理图片时出错'
      beadGrid.value = null
      progress.value = 0
    } finally {
      if (progress.value === 100) {
        setTimeout(() => { progress.value = 0 }, 400)
      }
    }
  }

  return {
    beadGrid,
    progress,
    error,
    settings,
    process,
  }
}

function applyAdjustmentsToPixel(
  r: number, g: number, b: number,
  brightness: number, contrast: number, saturation: number,
): { r: number; g: number; b: number } {
  const bFactor = brightness / 100
  const cFactor = (contrast + 100) / 100
  const sFactor = (saturation + 100) / 100

  let nr = r, ng = g, nb = b

  // Brightness
  if (brightness > 0) {
    nr = nr + (255 - nr) * bFactor
    ng = ng + (255 - ng) * bFactor
    nb = nb + (255 - nb) * bFactor
  } else if (brightness < 0) {
    nr = nr * (1 + bFactor)
    ng = ng * (1 + bFactor)
    nb = nb * (1 + bFactor)
  }

  // Contrast
  nr = (nr - 128) * cFactor + 128
  ng = (ng - 128) * cFactor + 128
  nb = (nb - 128) * cFactor + 128

  // Saturation
  const gray = 0.299 * nr + 0.587 * ng + 0.114 * nb
  nr = gray + (nr - gray) * sFactor
  ng = gray + (ng - gray) * sFactor
  nb = gray + (nb - gray) * sFactor

  return {
    r: Math.max(0, Math.min(255, Math.round(nr))),
    g: Math.max(0, Math.min(255, Math.round(ng))),
    b: Math.max(0, Math.min(255, Math.round(nb))),
  }
}
