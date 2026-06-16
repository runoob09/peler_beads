import { onMounted, onUnmounted } from 'vue'

export interface Shortcut {
  key: string
  ctrl?: boolean
  shift?: boolean
  handler: (event: KeyboardEvent) => void
}

export function useKeyboardShortcuts(shortcuts: Shortcut[]) {
  function onKeyDown(event: KeyboardEvent) {
    for (const s of shortcuts) {
      const ctrlOk = s.ctrl === undefined || s.ctrl === (event.ctrlKey || event.metaKey)
      const shiftOk = s.shift === undefined || s.shift === event.shiftKey
      if (event.key === s.key && ctrlOk && shiftOk) {
        event.preventDefault()
        s.handler(event)
      }
    }
  }

  onMounted(() => document.addEventListener('keydown', onKeyDown))
  onUnmounted(() => document.removeEventListener('keydown', onKeyDown))
}
