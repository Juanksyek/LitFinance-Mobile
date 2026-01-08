type EventName = 'recurrentes:changed' | 'subcuentas:changed';

type Listener = () => void;

class DashboardRefreshBus {
  private listeners: Record<EventName, Set<Listener>> = {
    'recurrentes:changed': new Set<Listener>(),
    'subcuentas:changed': new Set<Listener>(),
  };

  on(event: EventName, listener: Listener) {
    this.listeners[event].add(listener);
    return () => this.listeners[event].delete(listener);
  }

  emit(event: EventName) {
    for (const listener of this.listeners[event]) {
      try {
        listener();
      } catch {
        // ignore listener errors
      }
    }
  }
}

export const dashboardRefreshBus = new DashboardRefreshBus();

export const emitRecurrentesChanged = () => dashboardRefreshBus.emit('recurrentes:changed');
export const emitSubcuentasChanged = () => dashboardRefreshBus.emit('subcuentas:changed');
