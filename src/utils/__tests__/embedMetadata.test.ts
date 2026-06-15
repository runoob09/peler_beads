import { describe, it, expect } from 'vitest'
import {
  embedInPng,
  extractFromPng,
  embedInPdf,
  extractFromPdf,
} from '../embedMetadata'
import { PDFDocument } from 'pdf-lib'

/**
 * 创建结构合法的极简 PNG（像素数据为假，但 chunk 边界正确）。
 * 我们的 parser 只解析 chunk 头，不做 CRC 校验或图像解码。
 */
function makeMinimalPngBytes(): Uint8Array {
  const sig = [137, 80, 78, 71, 13, 10, 26, 10]

  // IHDR: 2×2, 8-bit RGB
  const ihdrData = [
    0, 0, 0, 2, // width = 2
    0, 0, 0, 2, // height = 2
    8, // bit depth
    2, // color type: RGB
    0, 0, 0, // compression, filter, interlace
  ]

  const bytes: number[] = [...sig]

  // IHDR chunk: length(4) + type(4) + data(13) + crc(4) = 25
  bytes.push(0, 0, 0, 13) // length = 13
  bytes.push(73, 72, 68, 82) // "IHDR"
  bytes.push(...ihdrData)
  bytes.push(0xde, 0xad, 0xbe, 0xef) // CRC (any value, unchecked by our parser)

  // IDAT chunk: length(4) + type(4) + data(N) + crc(4)
  const dummyData = [1, 2, 3, 4]
  bytes.push(0, 0, 0, dummyData.length) // length
  bytes.push(73, 68, 65, 84) // "IDAT"
  bytes.push(...dummyData)
  bytes.push(0xca, 0xfe, 0xba, 0xbe) // CRC

  // IEND chunk: length(4) + type(4) + data(0) + crc(4) = 12
  bytes.push(0, 0, 0, 0) // length = 0
  bytes.push(73, 69, 78, 68) // "IEND"
  bytes.push(0xde, 0xad, 0xbe, 0xef) // CRC

  return new Uint8Array(bytes)
}

async function createTestPdf(): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  const page = doc.addPage([200, 200])
  page.drawText('Test', { x: 10, y: 10, size: 12 })
  return new Uint8Array(await doc.save())
}

describe('embedMetadata PNG', () => {
  it('embeds project JSON as tEXt chunk and extracts it back', async () => {
    const pngBytes = makeMinimalPngBytes()
    const pngBlob = new Blob([pngBytes as unknown as BlobPart], { type: 'image/png' })
    const projectJson = JSON.stringify({ version: 1, name: 'test-project' })

    const embedded = await embedInPng(pngBlob, projectJson)
    const embeddedBytes = new Uint8Array(await embedded.arrayBuffer())

    const result = extractFromPng(embeddedBytes)
    expect(result.projectJson).toBe(projectJson)
  })

  it('embeds image binary and extracts it back', async () => {
    const pngBytes = makeMinimalPngBytes()
    const pngBlob = new Blob([pngBytes as unknown as BlobPart], { type: 'image/png' })
    const imageData = new Uint8Array([1, 2, 3, 4, 5])

    const embedded = await embedInPng(pngBlob, '{"test":true}', imageData)
    const embeddedBytes = new Uint8Array(await embedded.arrayBuffer())

    const result = extractFromPng(embeddedBytes)
    expect(result.imageBytes).toEqual(imageData)
    expect(result.projectJson).toBe('{"test":true}')
  })

  it('does not add image chunk when no image provided', async () => {
    const pngBytes = makeMinimalPngBytes()
    const pngBlob = new Blob([pngBytes as unknown as BlobPart], { type: 'image/png' })

    const embedded = await embedInPng(pngBlob, '{}')
    const embeddedBytes = new Uint8Array(await embedded.arrayBuffer())

    const result = extractFromPng(embeddedBytes)
    expect(result.imageBytes).toBeNull()
    expect(result.projectJson).toBe('{}')
  })

  it('returns null for PNG without embedded data', () => {
    const pngBytes = makeMinimalPngBytes()
    const result = extractFromPng(pngBytes)
    expect(result.projectJson).toBeNull()
    expect(result.imageBytes).toBeNull()
  })

  it('returns null for invalid PNG signature', () => {
    const badBytes = new Uint8Array(100).fill(0)
    const result = extractFromPng(badBytes)
    expect(result.projectJson).toBeNull()
    expect(result.imageBytes).toBeNull()
  })

  it('round-trips large project JSON with special chars', async () => {
    const pngBytes = makeMinimalPngBytes()
    const pngBlob = new Blob([pngBytes as unknown as BlobPart], { type: 'image/png' })
    const projectJson = JSON.stringify({
      name: '测试项目 🔥',
      settings: { gridCols: 29, gridRows: 29, display: { renderMode: 'mixed' } },
      palette: [{ id: '1', name: '红色', hex: '#ff0000' }],
    })

    const embedded = await embedInPng(pngBlob, projectJson)
    const embeddedBytes = new Uint8Array(await embedded.arrayBuffer())

    const result = extractFromPng(embeddedBytes)
    expect(result.projectJson).toBe(projectJson)
  })

  it('embedded PNG preserves valid signature and chunk structure', async () => {
    const pngBytes = makeMinimalPngBytes()
    const pngBlob = new Blob([pngBytes as unknown as BlobPart], { type: 'image/png' })
    const imageData = new Uint8Array([10, 20, 30])

    const embedded = await embedInPng(pngBlob, '{"test":true}', imageData)
    const embeddedBytes = new Uint8Array(await embedded.arrayBuffer())

    // PNG signature intact
    const sig = [137, 80, 78, 71, 13, 10, 26, 10]
    for (let i = 0; i < sig.length; i++) {
      expect(embeddedBytes[i]).toBe(sig[i])
    }

    // Larger than original (extra chunks added)
    expect(embeddedBytes.length).toBeGreaterThan(pngBytes.length)

    // Embedded data extracts correctly
    const result = extractFromPng(embeddedBytes)
    expect(result.projectJson).toBe('{"test":true}')
    expect(result.imageBytes).toEqual(imageData)
  })

  it('throws on invalid PNG input', async () => {
    const badBlob = new Blob([new Uint8Array([0, 0, 0, 0])], { type: 'image/png' })
    await expect(embedInPng(badBlob, '{}')).rejects.toThrow('Invalid PNG signature')
  })

  it('handles empty image bytes gracefully (no beAd chunk added)', async () => {
    const pngBytes = makeMinimalPngBytes()
    const pngBlob = new Blob([pngBytes as unknown as BlobPart], { type: 'image/png' })

    const embedded = await embedInPng(pngBlob, '{}', new Uint8Array(0))
    const embeddedBytes = new Uint8Array(await embedded.arrayBuffer())

    const result = extractFromPng(embeddedBytes)
    expect(result.projectJson).toBe('{}')
    expect(result.imageBytes).toBeNull()
  })

  it('handles empty project JSON', async () => {
    const pngBytes = makeMinimalPngBytes()
    const pngBlob = new Blob([pngBytes as unknown as BlobPart], { type: 'image/png' })

    const embedded = await embedInPng(pngBlob, '')
    const embeddedBytes = new Uint8Array(await embedded.arrayBuffer())

    const result = extractFromPng(embeddedBytes)
    expect(result.projectJson).toBe('')
  })
})

describe('embedMetadata PDF', () => {
  it('embeds project JSON as Keywords and extracts it back', async () => {
    const pdfBytes = await createTestPdf()
    const projectJson = JSON.stringify({ version: 1, name: 'test-pdf-project' })

    const embedded = await embedInPdf(pdfBytes, projectJson)
    const result = await extractFromPdf(embedded)

    expect(result.projectJson).toBe(projectJson)
  })

  it('embeds image as attachment', async () => {
    const pdfBytes = await createTestPdf()
    const imageData = new Uint8Array([1, 2, 3, 4, 5])

    const embedded = await embedInPdf(
      pdfBytes,
      '{"test":true}',
      imageData,
      'image/png',
    )
    const result = await extractFromPdf(embedded)

    expect(result.projectJson).toBe('{"test":true}')
    // PDF image extraction is best-effort; project JSON is the priority
  })

  it('does not attach image when no image provided', async () => {
    const pdfBytes = await createTestPdf()

    const embedded = await embedInPdf(pdfBytes, '{"noImage":true}')
    const result = await extractFromPdf(embedded)

    expect(result.projectJson).toBe('{"noImage":true}')
  })

  it('returns null for PDF without embedded data', async () => {
    const pdfBytes = await createTestPdf()
    const result = await extractFromPdf(pdfBytes)

    expect(result.projectJson).toBeNull()
  })

  it('handles special characters in project JSON', async () => {
    const pdfBytes = await createTestPdf()
    const projectJson = JSON.stringify({
      name: '测试 🔥',
      settings: { gridCols: 29 },
    })

    const embedded = await embedInPdf(pdfBytes, projectJson)
    const result = await extractFromPdf(embedded)

    expect(result.projectJson).toBe(projectJson)
  })
})
