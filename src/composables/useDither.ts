import type { BeadGrid, PaletteColor, DitherAlgorithm, BeadCell } from '../types'
import { floydSteinbergDither, atkinsonDither, type ColorMatchFn } from '../utils/dithering'
import { createColorMatcher } from './useColorMatcher'

export function applyDithering(
  imageData: ImageData,
  palette: PaletteColor[],
  algorithm: DitherAlgorithm,
  strength: number,
  overrideMatch?: ColorMatchFn,
): BeadGrid {
  const matchColor = overrideMatch ?? createColorMatcher(palette)
  const { width, height } = imageData

  let cells: BeadCell[][]
  switch (algorithm) {
    case 'floydSteinberg':
      cells = floydSteinbergDither(imageData, matchColor, strength)
      break
    case 'atkinson':
      cells = atkinsonDither(imageData, matchColor, strength)
      break
    case 'none':
    default:
      cells = nearestNeighbor(imageData, matchColor)
      break
  }

  return {
    rows: height,
    cols: width,
    cells,
    palette,
    imageCols: width,
    imageRows: height,
  }
}

function nearestNeighbor(imageData: ImageData, matchColor: ColorMatchFn): BeadCell[][] {
  const { data, width, height } = imageData
  const result: BeadCell[][] = Array.from({ length: height }, () => [])
  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      const idx = (row * width + col) * 4
      const match = matchColor(data[idx], data[idx + 1], data[idx + 2])
      result[row].push({ row, col, colorIndex: match.index })
    }
  }
  return result
}
