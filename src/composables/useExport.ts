import type { BeadGrid, PaletteColor, RenderMode } from '../types'
import { embedInPng } from '../utils/embedMetadata'

export interface GridLineSettings {
  showGrid: boolean
  gridLineColor: string
  gridLineWidth: number
  boldGridInterval: number
  boldGridColor: string
  boldGridWidth: number
}

const SYMBOLS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789●▲■◆★♦▼◀▶♠♥♣'

export function buildSymbolMap(palette: PaletteColor[]): Map<number, string> {
  const map = new Map<number, string>()
  palette.forEach((_c, i) => {
    map.set(i, SYMBOLS[i % SYMBOLS.length] ?? '?')
  })
  return map
}

export function drawGridLines(
  ctx: CanvasRenderingContext2D,
  cols: number,
  rows: number,
  cellSize: number,
  gridLines: GridLineSettings,
  offsetX = 0,
  offsetY = 0,
): void {
  if (!gridLines.showGrid) return

  const totalW = cols * cellSize
  const totalH = rows * cellSize

  if (gridLines.gridLineWidth > 0) {
    ctx.strokeStyle = gridLines.gridLineColor
    ctx.lineWidth = gridLines.gridLineWidth
    for (let row = 0; row <= rows; row++) {
      ctx.beginPath()
      ctx.moveTo(offsetX, offsetY + row * cellSize)
      ctx.lineTo(offsetX + totalW, offsetY + row * cellSize)
      ctx.stroke()
    }
    for (let col = 0; col <= cols; col++) {
      ctx.beginPath()
      ctx.moveTo(offsetX + col * cellSize, offsetY)
      ctx.lineTo(offsetX + col * cellSize, offsetY + totalH)
      ctx.stroke()
    }
  }

  if (gridLines.boldGridInterval > 0) {
    ctx.strokeStyle = gridLines.boldGridColor
    ctx.lineWidth = gridLines.boldGridWidth
    for (let row = 0; row <= rows; row += gridLines.boldGridInterval) {
      ctx.beginPath()
      ctx.moveTo(offsetX, offsetY + row * cellSize)
      ctx.lineTo(offsetX + totalW, offsetY + row * cellSize)
      ctx.stroke()
    }
    for (let col = 0; col <= cols; col += gridLines.boldGridInterval) {
      ctx.beginPath()
      ctx.moveTo(offsetX + col * cellSize, offsetY)
      ctx.lineTo(offsetX + col * cellSize, offsetY + totalH)
      ctx.stroke()
    }
  }
}

export function renderAllCells(
  ctx: CanvasRenderingContext2D,
  grid: BeadGrid,
  cellSize: number,
  renderMode: RenderMode,
  showLabels = false,
): void {
  const symbolMap = renderMode !== 'color' ? buildSymbolMap(grid.palette) : null

  for (let row = 0; row < grid.rows; row++) {
    for (let col = 0; col < grid.cols; col++) {
      renderCell(ctx, grid, row, col, cellSize, renderMode, symbolMap, showLabels)
    }
  }
}

export function renderCell(
  ctx: CanvasRenderingContext2D,
  grid: BeadGrid,
  row: number,
  col: number,
  cellSize: number,
  renderMode: RenderMode,
  symbolMap: Map<number, string> | null,
  showLabels: boolean,
): void {
  const cell = grid.cells[row][col]
  const x = col * cellSize
  const y = row * cellSize

  if (cell.colorIndex === null) {
    drawNullCellMark(ctx, x, y, cellSize)
    return
  }

  const color = grid.palette[cell.colorIndex]

  if (renderMode === 'symbol') {
    ctx.fillStyle = '#FFFFFF'
  } else {
    ctx.fillStyle = color.hex
  }
  ctx.fillRect(x, y, cellSize, cellSize)

  // Render color label inside cell
  if (showLabels) {
    const label = getColorLabel(color)
    const fontSize = Math.max(6, cellSize * 0.35)
    ctx.font = `bold ${fontSize}px monospace`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = getTextColor(color.hex)
    ctx.fillText(label, x + cellSize / 2, y + cellSize / 2)
  }

  if (renderMode === 'symbol' || renderMode === 'mixed') {
    const sym = symbolMap!.get(cell.colorIndex!) ?? '?'
    const fontSize = cellSize * 0.6
    ctx.font = `${fontSize}px monospace`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = renderMode === 'symbol' ? '#000000' : getTextColor(color.hex)
    ctx.fillText(sym, x + cellSize / 2, y + cellSize / 2)
  }
}

export function getTextColor(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.5 ? '#000000' : '#FFFFFF'
}

/** Draw diagonal cross marks for null (erased) cells */
export function drawNullCellMark(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, cellSize: number,
): void {
  const pad = Math.max(2, cellSize * 0.15)
  ctx.strokeStyle = '#000'
  ctx.lineWidth = Math.max(1.5, cellSize * 0.06)
  ctx.beginPath()
  ctx.moveTo(x + pad, y + pad)
  ctx.lineTo(x + cellSize - pad, y + cellSize - pad)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(x + cellSize - pad, y + pad)
  ctx.lineTo(x + pad, y + cellSize - pad)
  ctx.stroke()
}

export function renderGridToCanvas(
  grid: BeadGrid,
  renderMode: RenderMode,
  cellSize: number,
  gridLines: GridLineSettings,
  scale = 1,
  showLabels = false,
): HTMLCanvasElement {
  const width = grid.cols * cellSize * scale
  const height = grid.rows * cellSize * scale
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas
  ctx.scale(scale, scale)

  renderAllCells(ctx, grid, cellSize, renderMode, showLabels)
  drawGridLines(ctx, grid.cols, grid.rows, cellSize, gridLines)

  return canvas
}

export function getColorLabel(color: PaletteColor): string {
  // Extract short code from name (e.g., "A01" from "A01 白色", or just use name)
  return colorCodeFromName(color.name) ?? color.hex
}

/** Extract short color code from name (e.g. "A01" from "A01 白色") */
export function colorCodeFromName(name: string): string {
  return name.split(/[\s_]+/)[0] ?? name
}

export function countColorUsage(grid: BeadGrid): Map<number, number> {
  const counts = new Map<number, number>()
  for (const row of grid.cells) {
    for (const cell of row) {
      if (cell.colorIndex === null) continue
      counts.set(cell.colorIndex, (counts.get(cell.colorIndex) ?? 0) + 1)
    }
  }
  return counts
}

export function renderExportCanvas(
  grid: BeadGrid,
  cellSize: number,
  gridLines: GridLineSettings,
  scale = 2,
): HTMLCanvasElement {
  const PADDING = 20 // outer margin
  const MARGIN = cellSize // space for column headers and row labels
  const gridW = grid.cols * cellSize
  const gridH = grid.rows * cellSize
  const originX = PADDING + MARGIN
  const originY = PADDING + MARGIN
  const canvasW = PADDING * 2 + MARGIN + gridW

  // Calculate legend dimensions
  const counts = countColorUsage(grid)
  const sortedColors = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([idx, count]) => ({ paletteIndex: idx, color: grid.palette[idx], count }))

  const legendItemH = Math.max(10, cellSize * 0.8)
  const legendCols = Math.min(8, Math.max(1, Math.floor(gridW / (cellSize * 5))))
  const legendRows = Math.ceil(sortedColors.length / legendCols)
  const legendH = legendRows * (legendItemH + 2) + 30

  const canvasH = originY + gridH + legendH + PADDING

  const canvas = document.createElement('canvas')
  canvas.width = canvasW * scale
  canvas.height = canvasH * scale
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas
  ctx.scale(scale, scale)

  // Background
  ctx.fillStyle = '#FFFFFF'
  ctx.fillRect(0, 0, canvasW, canvasH)

  // --- Column headers ---
  const headerLarge = cellSize * 0.8
  const headerSmall = headerLarge * 0.6
  ctx.fillStyle = '#333333'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  for (let col = 0; col < grid.cols; col++) {
    const num = col + 1
    const large = num % 10 === 0
    ctx.font = `bold ${large ? headerLarge : headerSmall}px monospace`
    const x = originX + col * cellSize + cellSize / 2
    ctx.fillText(String(num), x, PADDING + MARGIN / 2)
  }

  // --- Row headers ---
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  for (let row = 0; row < grid.rows; row++) {
    const num = row + 1
    const large = num % 10 === 0
    ctx.font = `bold ${large ? headerLarge : headerSmall}px monospace`
    const y = originY + row * cellSize + cellSize / 2
    ctx.fillText(String(num), originX - MARGIN / 2, y)
  }

  // --- Header border lines ---
  ctx.strokeStyle = '#333333'
  ctx.lineWidth = 1
  // Top-left corner
  ctx.strokeRect(PADDING, PADDING, MARGIN, MARGIN)
  // Vertical separator
  ctx.beginPath()
  ctx.moveTo(originX, PADDING)
  ctx.lineTo(originX, originY + gridH)
  ctx.stroke()
  // Horizontal separator
  ctx.beginPath()
  ctx.moveTo(PADDING, originY)
  ctx.lineTo(originX + gridW, originY)
  ctx.stroke()

  // --- Grid cells with color labels ---
  for (let row = 0; row < grid.rows; row++) {
    for (let col = 0; col < grid.cols; col++) {
      const cell = grid.cells[row][col]
      if (cell.colorIndex === null) continue
      const color = grid.palette[cell.colorIndex]
      const x = originX + col * cellSize
      const y = originY + row * cellSize

      ctx.fillStyle = color.hex
      ctx.fillRect(x, y, cellSize, cellSize)

      // Color label inside cell — centered
      const label = getColorLabel(color)
      const fontSize = cellSize * 0.35
      ctx.font = `bold ${fontSize}px monospace`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillStyle = getTextColor(color.hex)
      ctx.fillText(label, x + cellSize / 2, y + cellSize / 2)
    }
  }

  // --- Grid lines ---
  if (gridLines.showGrid && gridLines.gridLineWidth > 0) {
    ctx.strokeStyle = gridLines.gridLineColor
    ctx.lineWidth = gridLines.gridLineWidth
    for (let row = 0; row <= grid.rows; row++) {
      ctx.beginPath()
      ctx.moveTo(originX, originY + row * cellSize)
      ctx.lineTo(originX + gridW, originY + row * cellSize)
      ctx.stroke()
    }
    for (let col = 0; col <= grid.cols; col++) {
      ctx.beginPath()
      ctx.moveTo(originX + col * cellSize, originY)
      ctx.lineTo(originX + col * cellSize, originY + gridH)
      ctx.stroke()
    }
  }

  if (gridLines.boldGridInterval > 0) {
    ctx.strokeStyle = gridLines.boldGridColor
    ctx.lineWidth = gridLines.boldGridWidth
    for (let row = 0; row <= grid.rows; row += gridLines.boldGridInterval) {
      ctx.beginPath()
      ctx.moveTo(originX, originY + row * cellSize)
      ctx.lineTo(originX + gridW, originY + row * cellSize)
      ctx.stroke()
    }
    for (let col = 0; col <= grid.cols; col += gridLines.boldGridInterval) {
      ctx.beginPath()
      ctx.moveTo(originX + col * cellSize, originY)
      ctx.lineTo(originX + col * cellSize, originY + gridH)
      ctx.stroke()
    }
  }

  // --- Legend ---
  const legendY = originY + gridH + 10
  ctx.fillStyle = '#333333'
  const legendTitleFontSize = cellSize * 0.8
  ctx.font = `bold ${legendTitleFontSize}px sans-serif`
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  ctx.fillText('颜色图例（按数量降序）', originX, legendY)

  const legendStartY = legendY + cellSize * 1.2
  const colWidth = Math.floor((canvasW - originX - PADDING) / legendCols)

  for (let i = 0; i < sortedColors.length; i++) {
    const lCol = i % legendCols
    const lRow = Math.floor(i / legendCols)
    const item = sortedColors[i]
    const lx = originX + lCol * colWidth
    const ly = legendStartY + lRow * (legendItemH + 2)

    // Color swatch — 40% column width, 90% row height
    const swatchW = colWidth * 0.4
    const swatchH = legendItemH * 0.9
    ctx.fillStyle = item.color.hex
    ctx.fillRect(lx, ly, swatchW, swatchH)
    ctx.strokeStyle = '#999999'
    ctx.lineWidth = 0.5
    ctx.strokeRect(lx, ly, swatchW, swatchH)

    // Color code inside swatch — centered, 80% of swatch height
    const code = getColorLabel(item.color)
    ctx.font = `bold ${swatchH * 0.8}px monospace`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = getTextColor(item.color.hex)
    ctx.fillText(code, lx + swatchW / 2, ly + swatchH / 2)

    // Count to the right of swatch
    ctx.font = `${cellSize * 0.8}px sans-serif`
    ctx.fillStyle = '#333333'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.fillText(`${item.count}`, lx + swatchW + 4, ly + swatchH / 2)
  }

  return canvas
}

export async function exportPNG(
  grid: BeadGrid,
  gridLines: GridLineSettings,
  cellSize: number,
  projectJson?: string,
  imageBytes?: Uint8Array,
): Promise<Blob> {
  const canvas = renderExportCanvas(grid, cellSize, gridLines, 2)
  const pngBlob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(blob => {
      if (blob) resolve(blob)
      else reject(new Error('Canvas toBlob failed'))
    }, 'image/png')
  })

  if (projectJson) {
    return embedInPng(pngBlob, projectJson, imageBytes)
  }
  return pngBlob
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
