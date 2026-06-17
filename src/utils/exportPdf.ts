import type { BeadGrid } from '../types'
import { renderGridToCanvas } from '../composables/useExport'
import { embedInPdf } from './embedMetadata'

interface GridLineSettings {
  showGrid: boolean
  gridLineColor: string
  gridLineWidth: number
  boldGridInterval: number
  boldGridColor: string
  boldGridWidth: number
}

export async function generatePdf(
  grid: BeadGrid,
  gridLines: GridLineSettings,
  cellSize: number,
  title: string,
  projectJson?: string,
  imageBytes?: Uint8Array,
  imageType?: string,
): Promise<Uint8Array> {
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib')
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const boldFont = await doc.embedFont(StandardFonts.HelveticaBold)

  let page = doc.addPage([595, 842]) // A4
  const margin = 40
  let y = 842 - margin

  // Title
  page.drawText(title, { x: margin, y, size: 16, font: boldFont })
  y -= 30

  // Grid info
  page.drawText(`尺寸: ${grid.cols} × ${grid.rows}  |  颜色数: ${grid.palette.length}`, {
    x: margin, y, size: 10, font,
  })
  y -= 20

  // Render grid and embed as PNG
  const canvas = renderGridToCanvas(grid, 'color', cellSize, gridLines, 2)
  const canvasBlob = await new Promise<Blob>((resolve) => canvas.toBlob(b => resolve(b!), 'image/png'))
  const arrayBuffer = await canvasBlob.arrayBuffer()
  const pngImage = await doc.embedPng(new Uint8Array(arrayBuffer))

  const maxWidth = 595 - margin * 2
  const maxHeight = y - margin - 60
  const scale = Math.min(maxWidth / canvas.width, maxHeight / canvas.height)
  const imgW = canvas.width * scale
  const imgH = canvas.height * scale

  page.drawImage(pngImage, { x: margin, y: y - imgH, width: imgW, height: imgH })
  y -= imgH + 20

  // Color legend — max 8 per row, swatch 40% / gap 30% / name 30%
  const legendFontSize = cellSize * 0.8
  const colorsPerRow = Math.min(grid.palette.length, 8)
  const itemW = (595 - margin * 2) / colorsPerRow
  const legendSwatchW = itemW * 0.4
  const legendSwatchH = legendSwatchW * 0.618

  page.drawText('色彩清单', { x: margin, y, size: legendFontSize, font: boldFont })
  y -= legendFontSize + 6

  for (let i = 0; i < grid.palette.length; i += colorsPerRow) {
    const row = grid.palette.slice(i, i + colorsPerRow)
    for (let j = 0; j < row.length; j++) {
      const x = margin + j * itemW
      const hex = row[j].hex.replace('#', '')
      const r = parseInt(hex.slice(0, 2), 16) / 255
      const g = parseInt(hex.slice(2, 4), 16) / 255
      const b = parseInt(hex.slice(4, 6), 16) / 255
      page.drawRectangle({ x, y: y - legendSwatchH, width: legendSwatchW, height: legendSwatchH, color: rgb(r, g, b) })
      page.drawText(`${row[j].name || row[j].hex}`, { x: x + itemW * 0.7, y: y - legendSwatchH + 2, size: legendFontSize, font })
    }
    y -= Math.max(10, legendSwatchH + 4)
    if (y < margin) {
      page = doc.addPage([595, 842])
      y = 842 - margin
    }
  }

  // Total bead count
  const colorCounts = new Map<number, number>()
  for (const row of grid.cells) {
    for (const cell of row) {
      if (cell.colorIndex !== null) {
        colorCounts.set(cell.colorIndex, (colorCounts.get(cell.colorIndex) ?? 0) + 1)
      }
    }
  }
  let totalBeads = 0
  for (const c of colorCounts.values()) totalBeads += c

  y -= 4
  page.drawText(`总计：${totalBeads} 颗`, {
    x: margin, y, size: cellSize * 0.6, font: boldFont,
  })

  const pdfBytes = new Uint8Array(await doc.save())

  if (projectJson) {
    return embedInPdf(pdfBytes, projectJson, imageBytes, imageType)
  }
  return pdfBytes
}
