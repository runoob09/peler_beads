import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { useTimer } from '../useTimer'

describe('useTimer', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('starts with totalElapsed=0 and isRunning=false', () => {
    const timer = useTimer()
    expect(timer.totalElapsed.value).toBe(0)
    expect(timer.isRunning.value).toBe(false)
  })

  it('starts timer and tracks elapsed', () => {
    const timer = useTimer()
    timer.start()
    expect(timer.isRunning.value).toBe(true)
    vi.advanceTimersByTime(5000)
    expect(timer.totalElapsed.value).toBe(5000)
  })

  it('pauses timer', () => {
    const timer = useTimer()
    timer.start()
    vi.advanceTimersByTime(3000)
    timer.pause()
    expect(timer.isRunning.value).toBe(false)
    const elapsed = timer.totalElapsed.value
    vi.advanceTimersByTime(2000)
    expect(timer.totalElapsed.value).toBe(elapsed)
  })

  it('resumes timer after pause', () => {
    const timer = useTimer()
    timer.start()
    vi.advanceTimersByTime(3000)
    timer.pause()
    timer.resume()
    vi.advanceTimersByTime(2000)
    expect(timer.totalElapsed.value).toBe(5000)
  })

  it('resets timer to zero', () => {
    const timer = useTimer()
    timer.start()
    vi.advanceTimersByTime(10000)
    timer.reset()
    expect(timer.totalElapsed.value).toBe(0)
    expect(timer.isRunning.value).toBe(false)
  })

  it('startBlock resets blockElapsed', () => {
    const timer = useTimer()
    timer.start()
    vi.advanceTimersByTime(5000)
    expect(timer.blockElapsed.value).toBe(5000)
    timer.startBlock()
    expect(timer.blockElapsed.value).toBe(0)
    vi.advanceTimersByTime(3000)
    expect(timer.blockElapsed.value).toBe(3000)
  })

  it('getBlockTime returns current block elapsed', () => {
    const timer = useTimer()
    timer.start()
    timer.startBlock()
    vi.advanceTimersByTime(1500)
    expect(timer.getBlockTime()).toBe(1500)
  })

  it('pauses on visibilitychange to hidden', () => {
    const timer = useTimer()
    timer.start()
    vi.advanceTimersByTime(1000)
    Object.defineProperty(document, 'visibilityState', {
      value: 'hidden',
      writable: true,
    })
    document.dispatchEvent(new Event('visibilitychange'))
    const elapsed = timer.totalElapsed.value
    document.dispatchEvent(new Event('visibilitychange'))
    vi.advanceTimersByTime(3000)
    expect(timer.totalElapsed.value).toBeLessThanOrEqual(elapsed + 50)
  })

  it('formats totalElapsed as MM:SS', () => {
    const timer = useTimer()
    timer.start()
    vi.advanceTimersByTime(125000) // 2:05
    expect(timer.formatted.value).toBe('02:05')
  })

  it('formats totalElapsed as HH:MM:SS when over 1 hour', () => {
    const timer = useTimer()
    timer.start()
    vi.advanceTimersByTime(3661000) // 1:01:01
    expect(timer.formatted.value).toBe('01:01:01')
  })

  it('sets initial elapsed from external value for restore', () => {
    const timer = useTimer()
    timer.setElapsed(180000) // 3 minutes
    expect(timer.totalElapsed.value).toBe(180000)
    expect(timer.formatted.value).toBe('03:00')
  })
})
