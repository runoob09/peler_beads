import getColors from './get-colors.json'

export interface ColorItem {
  'color-name': string
  color: string
}

export interface BrandColorMap {
  [brandName: string]: ColorItem[]
}

const brandData = getColors as BrandColorMap

export const BRAND_NAMES = Object.keys(brandData).sort()

export function getBrandColors(brandName: string): ColorItem[] {
  return brandData[brandName] ?? []
}
