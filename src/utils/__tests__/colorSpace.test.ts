import { describe, it, expect } from 'vitest'
import { rgbToLab, hexToRgb, deltaE, rgbToHex } from '../colorSpace'

describe('hexToRgb', () => {
  it('converts #FFFFFF to [255, 255, 255]', () => {
    expect(hexToRgb('#FFFFFF')).toEqual([255, 255, 255])
  })

  it('converts #000000 to [0, 0, 0]', () => {
    expect(hexToRgb('#000000')).toEqual([0, 0, 0])
  })

  it('converts #FF0000 to [255, 0, 0]', () => {
    expect(hexToRgb('#FF0000')).toEqual([255, 0, 0])
  })

  it('converts lowercase #ff8000', () => {
    expect(hexToRgb('#ff8000')).toEqual([255, 128, 0])
  })
})

describe('rgbToHex', () => {
  it('converts (255,255,255) to #FFFFFF', () => {
    expect(rgbToHex(255, 255, 255)).toBe('#FFFFFF')
  })

  it('converts (0,128,64) to #008040', () => {
    expect(rgbToHex(0, 128, 64)).toBe('#008040')
  })

  it('zero-pads single hex digits', () => {
    expect(rgbToHex(0, 0, 0)).toBe('#000000')
  })
})

describe('rgbToLab', () => {
  it('converts black to approx L=0', () => {
    const [L] = rgbToLab(0, 0, 0)
    expect(L).toBeCloseTo(0, 0)
  })

  it('converts white to approx L=100', () => {
    const [L] = rgbToLab(255, 255, 255)
    expect(L).toBeCloseTo(100, 0)
  })

  it('returns values for pure red', () => {
    const [L1, a1] = rgbToLab(255, 0, 0)
    expect(L1).toBeGreaterThan(40)
    expect(a1).toBeGreaterThan(0)
  })
})

describe('deltaE', () => {
  it('returns 0 for identical colors', () => {
    const lab1 = rgbToLab(128, 128, 128)
    expect(deltaE(lab1, lab1)).toBeCloseTo(0, 1)
  })

  it('returns large value for black vs white', () => {
    const black = rgbToLab(0, 0, 0)
    const white = rgbToLab(255, 255, 255)
    expect(deltaE(black, white)).toBeGreaterThan(50)
  })

  it('returns small value for similar colors', () => {
    const red1 = rgbToLab(255, 0, 0)
    const red2 = rgbToLab(254, 0, 0)
    expect(deltaE(red1, red2)).toBeLessThan(2)
  })
})
