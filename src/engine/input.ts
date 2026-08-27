import type { InputState } from './types'

export class InputManager {
  state: InputState = {
    pitch: 0, yaw: 0, roll: 0, lateral: 0, vertical: 0,
    throttle: 0, throttleUpHeld: false, throttleDownHeld: false,
    boost: false, faToggle: false, scToggle: false, jump: false, help: false
  }

  private held = new Set<string>()
  private edges = new Set<string>()
  private onKeyDown = (e: KeyboardEvent) => {
    if (e.repeat) return
    if (['Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter'].includes(e.code)) e.preventDefault()
    this.held.add(e.code)
    if (e.code === 'KeyX') this.edges.add('faToggle')
    if (e.code === 'KeyJ') this.edges.add('scToggle')
    if (e.code === 'Enter') this.edges.add('jump')
    if (e.code === 'KeyH') this.edges.add('help')
  }
  private onKeyUp = (e: KeyboardEvent) => { this.held.delete(e.code) }
  private onBlur = () => { this.held.clear() }

  constructor() {
    window.addEventListener('keydown', this.onKeyDown)
    window.addEventListener('keyup', this.onKeyUp)
    window.addEventListener('blur', this.onBlur)
  }

  refresh(): void {
    const h = this.held
    this.state.pitch = (h.has('KeyS') ? 1 : 0) + (h.has('KeyW') ? -1 : 0)
    this.state.yaw = (h.has('KeyD') ? 1 : 0) + (h.has('KeyA') ? -1 : 0)
    this.state.roll = (h.has('KeyE') ? 1 : 0) + (h.has('KeyQ') ? -1 : 0)
    this.state.lateral = (h.has('ArrowRight') ? 1 : 0) + (h.has('ArrowLeft') ? -1 : 0)
    this.state.vertical = (h.has('ArrowUp') ? 1 : 0) + (h.has('ArrowDown') ? -1 : 0)
    this.state.throttleUpHeld = h.has('ShiftLeft') || h.has('ShiftRight')
    this.state.throttleDownHeld = h.has('KeyZ')
    this.state.boost = h.has('Tab')
  }

  consume(edge: 'faToggle' | 'scToggle' | 'jump' | 'help'): boolean {
    if (this.edges.has(edge)) { this.edges.delete(edge); return true }
    return false
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown)
    window.removeEventListener('keyup', this.onKeyUp)
    window.removeEventListener('blur', this.onBlur)
  }
}
