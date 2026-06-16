export interface BoardPreset {
  label: string
  rows: number
  cols: number
}

export const BOARD_PRESETS: BoardPreset[] = [
  { label: '迷你板 10×10', rows: 10, cols: 10 },
  { label: '小方板 14×14', rows: 14, cols: 14 },
  { label: '大方板 29×29', rows: 29, cols: 29 },
  { label: '中板 20×20', rows: 20, cols: 20 },
  { label: '超大方板 50×50', rows: 50, cols: 50 },
  { label: '100×100', rows: 100, cols: 100 },
  { label: '自定义', rows: 0, cols: 0 },
]
