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

export type DitherAlgorithm = 'none' | 'floydSteinberg' | 'atkinson'
export type RenderMode = 'color' | 'symbol' | 'mixed'
export type ColorMappingMode = 'average' | 'cartoon'

export interface DitherSettings {
  algorithm: DitherAlgorithm
  strength: number
}

export interface AdjustmentSettings {
  brightness: number
  contrast: number
  saturation: number
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
  colorMapping: ColorMappingMode
  dithering: DitherSettings
  adjustments: AdjustmentSettings
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

export interface PixelImage {
  imageData: ImageData
  width: number
  height: number
}
