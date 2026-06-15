import { ref } from 'vue'
import type { BeadGrid, BeadSettings, PaletteColor, BeadCell } from '../types'
import { loadImageFromFile, resizeImage, applyAdjustments } from './useImageProcessor'
import { createColorMatcher } from './useColorMatcher'

export function useBeadPipeline() {
  const beadGrid = ref<BeadGrid | null>(null)
  const progress = ref(0) // 0 = idle, 1–100 = processing
  const error = ref<string | null>(null)

  const settings = ref<BeadSettings>({
    gridCols: 29,
    gridRows: 29,
    keepAspectRatio: true,
    colorMatchScheme: 'deltaE',
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

      const { canvas: resized, imageX, imageY, imageW, imageH } = resizeImage(img, s.gridCols, s.gridRows, s.keepAspectRatio)
      progress.value = 50

      const ctx = resized.getContext('2d')
      if (!ctx) {
        error.value = 'Canvas 上下文不可用'
        beadGrid.value = null
        progress.value = 0
        return
      }
      let imageData = ctx.getImageData(0, 0, s.gridCols, s.gridRows)

      imageData = applyAdjustments(
        imageData,
        s.adjustments.brightness,
        s.adjustments.contrast,
        s.adjustments.saturation,
      )
      progress.value = 70

      progress.value = 80

      // Nearest-neighbor color matching
      const matchColor = createColorMatcher(palette, s.colorMatchScheme)
      const { data: imgBytes, width: imgW, height: imgH } = imageData
      const cells: BeadCell[][] = Array.from({ length: imgH }, () => [])
      for (let row = 0; row < imgH; row++) {
        for (let col = 0; col < imgW; col++) {
          const idx = (row * imgW + col) * 4
          const match = matchColor(imgBytes[idx], imgBytes[idx + 1], imgBytes[idx + 2])
          cells[row].push({ row, col, colorIndex: match.index })
        }
      }
      const grid: BeadGrid = {
        rows: imgH,
        cols: imgW,
        cells,
        palette,
        imageCols: imgW,
        imageRows: imgH,
      }
      progress.value = 95

      // Nullify cells outside the actual image area (contain mode)
      for (let row = 0; row < grid.rows; row++) {
        for (let col = 0; col < grid.cols; col++) {
          if (col < imageX || col >= imageX + imageW || row < imageY || row >= imageY + imageH) {
            grid.cells[row][col].colorIndex = null
          }
        }
      }
      grid.imageCols = imageW
      grid.imageRows = imageH

      beadGrid.value = grid
      progress.value = 100
    } catch (e) {
      error.value = e instanceof Error ? e.message : '处理图片时出错'
      beadGrid.value = null
      progress.value = 0
    } finally {
      // briefly show 100% then reset
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
