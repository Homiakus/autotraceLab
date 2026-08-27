export type ToastType = 'success' | 'info' | 'warning' | 'error' | 'progress';

export interface ToastItem {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
  durationMs?: number;
  progress?: number;
}

type ToastListener = (toasts: ToastItem[]) => void;

class ToastManager {
  private toasts: ToastItem[] = [];
  private listeners: Set<ToastListener> = new Set();

  subscribe(listener: ToastListener) {
    this.listeners.add(listener);
    listener(this.toasts);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    this.listeners.forEach(l => l([...this.toasts]));
  }

  show(toast: Omit<ToastItem, 'id'>): string {
    const id = `toast_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const duration = toast.durationMs ?? (toast.type === 'error' ? 5000 : 3500);
    const newToast: ToastItem = { ...toast, id };

    // Prevent duplicate toast storms
    this.toasts = [...this.toasts.filter(t => t.title !== toast.title || t.type !== toast.type), newToast];
    this.notify();

    if (duration > 0) {
      setTimeout(() => {
        this.dismiss(id);
      }, duration);
    }

    return id;
  }

  success(title: string, description?: string, durationMs?: number) {
    return this.show({ type: 'success', title, description, durationMs });
  }

  info(title: string, description?: string, durationMs?: number) {
    return this.show({ type: 'info', title, description, durationMs });
  }

  warning(title: string, description?: string, durationMs?: number) {
    return this.show({ type: 'warning', title, description, durationMs });
  }

  error(title: string, description?: string, durationMs?: number) {
    return this.show({ type: 'error', title, description, durationMs });
  }

  progress(title: string, progress: number, description?: string) {
    return this.show({ type: 'progress', title, description, progress, durationMs: 4000 });
  }

  dismiss(id: string) {
    this.toasts = this.toasts.filter(t => t.id !== id);
    this.notify();
  }

  clear() {
    this.toasts = [];
    this.notify();
  }
}

export const toast = new ToastManager();
