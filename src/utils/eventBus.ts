type Callback = (payload?: any) => void;

class EventBus {
  private listeners: Map<string, Set<Callback>> = new Map();

  on(event: string, cb: Callback) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(cb);
  }

  off(event: string, cb: Callback) {
    const s = this.listeners.get(event);
    if (!s) return;
    s.delete(cb);
    if (s.size === 0) this.listeners.delete(event);
  }

  emit(event: string, payload?: any) {
    const s = this.listeners.get(event);
    if (!s) return;
    for (const cb of Array.from(s)) {
      try {
        cb(payload);
      } catch (e) {
        console.warn(`[EventBus] handler for ${event} threw`, e);
      }
    }
  }
}

export default new EventBus();
