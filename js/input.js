// -----------------------------------------------------------------------------
// input.js — unified keyboard / touch / swipe input manager.
// Purpose: expose a small event-based API { on(event, cb) } for game actions:
//          'left' | 'right' | 'jump' | 'slide' | 'pause' | 'confirm'
// -----------------------------------------------------------------------------
export class Input {
  constructor() {
    this.listeners = new Map();
    this._installKeyboard();
    this._installTouch();
  }
  on(evt, cb) {
    if (!this.listeners.has(evt)) this.listeners.set(evt, []);
    this.listeners.get(evt).push(cb);
  }
  emit(evt) {
    const ls = this.listeners.get(evt);
    if (ls) for (const cb of ls) cb();
  }
  _installKeyboard() {
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      switch (e.code) {
        case 'ArrowLeft': case 'KeyA': this.emit('left'); break;
        case 'ArrowRight': case 'KeyD': this.emit('right'); break;
        case 'ArrowUp': case 'Space': case 'KeyW': this.emit('jump'); this.emit('confirm'); break;
        case 'ArrowDown': case 'ShiftLeft': case 'ShiftRight': case 'KeyS': this.emit('slide'); break;
        case 'KeyP': case 'Escape': this.emit('pause'); break;
        case 'Enter': this.emit('confirm'); break;
      }
    });
  }
  _installTouch() {
    // tap zones
    document.querySelectorAll('.tz').forEach(zone => {
      zone.addEventListener('touchstart', (e) => {
        e.preventDefault();
        this.emit(zone.dataset.action);
      }, { passive: false });
    });
    // swipe on whole canvas
    let sx = 0, sy = 0, st = 0;
    const canvas = document.getElementById('game');
    canvas.addEventListener('touchstart', (e) => {
      const t = e.changedTouches[0];
      sx = t.clientX; sy = t.clientY; st = performance.now();
    }, { passive: true });
    canvas.addEventListener('touchend', (e) => {
      const t = e.changedTouches[0];
      const dx = t.clientX - sx, dy = t.clientY - sy;
      const dt = performance.now() - st;
      if (dt > 600) return;
      if (Math.hypot(dx, dy) < 30) return;
      if (Math.abs(dx) > Math.abs(dy)) this.emit(dx > 0 ? 'right' : 'left');
      else this.emit(dy > 0 ? 'slide' : 'jump');
    }, { passive: true });
  }
}
