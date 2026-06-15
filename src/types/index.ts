export interface PaletteColor {
  id: string
  name: string
  hex: string
  brand: string
  symbol?: string
}

export interface BeadCell {
  row: number
  col: number
  colorIndex: number | null
}

export interface BeadGrid {
  rows: number
  cols: number
  cells: BeadCell[][]
  palette: PaletteColor[]
  imageCols: number
  imageRows: number
}

export type RenderMode = 'color' | 'symbol' | 'mixed'
export type ColorCalcMethod = 'average' | 'dominant' | 'bucket' | 'median' | 'centerWeighted'
export type ColorMatchMethod = 'deltaE' | 'rgb' | 'weightedRgb' | 'ciede2000'

export interface MergeSettings {
  enabled: boolean
  mergeThreshold: number
}

export interface DisplaySettings {
  showGrid: boolean
  gridLineColor: string
  gridLineWidth: number
  boldGridInterval: number
  boldGridColor: string
  boldGridWidth: number
  renderMode: RenderMode
}

export interface BeadSettings {
  gridCols: number
  gridRows: number
  keepAspectRatio: boolean
  colorCalcMethod: ColorCalcMethod
  colorMatchMethod: ColorMatchMethod
  bucketLevels: number
  tolerance: number
  merge: MergeSettings
  display: DisplaySettings
}

export interface ProjectFile {
  version: 1
  meta: {
    name: string
    createdAt: string
    brandPalette: string
  }
  settings: BeadSettings
  palette: {
    brand: string
    colors: PaletteColor[]
    custom: PaletteColor[]
  }
  image?: string
}

export interface ExportConfig {
  format: 'png' | 'pdf'
  cellSize: number
  filename: string
  showGrid: boolean
  gridLineColor: string
  gridLineWidth: number
  boldGridInterval: number
  boldGridColor: string
  boldGridWidth: number
}

export interface PixelImage {
  imageData: ImageData
  width: number
  height: number
}
