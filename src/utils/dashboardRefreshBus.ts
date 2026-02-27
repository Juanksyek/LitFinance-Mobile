type EventName =
  | 'recurrentes:changed'
  | 'subcuentas:changed'
  | 'transacciones:changed'
  | 'viewer:changed'
  | 'blocs:changed';

type Listener = () => void;

class DashboardRefreshBus {
  private listeners: Record<EventName, Set<Listener>> = {
    'recurrentes:changed': new Set<Listener>(),
    'subcuentas:changed': new Set<Listener>(),
    'transacciones:changed': new Set<Listener>(),
    'viewer:changed': new Set<Listener>(),
    'blocs:changed': new Set<Listener>(),
  };

  on(event: EventName, listener: Listener) {
    this.listeners[event].add(listener);
    return () => {
      this.listeners[event].delete(listener);
    };
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
export const emitTransaccionesChanged = () => dashboardRefreshBus.emit('transacciones:changed');
export const emitViewerChanged = () => dashboardRefreshBus.emit('viewer:changed');
export const emitBlocsChanged = () => dashboardRefreshBus.emit('blocs:changed');
