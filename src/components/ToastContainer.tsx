import React, { useState, useEffect } from 'react';
import { toast, ToastItem } from '../utils/toastService';
import { CheckCircle2, AlertTriangle, AlertOctagon, Info, RefreshCw, X } from 'lucide-react';

export const ToastContainer: React.FC = () => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    const unsubscribe = toast.subscribe(setToasts);
    return () => unsubscribe();
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div
      id="toast-notification-region"
      aria-live="polite"
      className="fixed bottom-12 right-4 sm:bottom-14 sm:right-6 z-50 flex flex-col gap-2 pointer-events-none max-w-sm w-full"
    >
      {toasts.map(t => {
        let Icon = Info;
        let iconColor = 'text-[var(--accent)]';
        let bgStyle = 'bg-[var(--surface-elevated)] border-[var(--border-default)]';
        let badgeColor = 'bg-blue-500/10 text-blue-400 border-blue-500/20';

        if (t.type === 'success') {
          Icon = CheckCircle2;
          iconColor = 'text-[var(--status-success)]';
          bgStyle = 'bg-[var(--surface-elevated)] border-[var(--status-success-border)]';
          badgeColor = 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
        } else if (t.type === 'warning') {
          Icon = AlertTriangle;
          iconColor = 'text-[var(--status-warning)]';
          bgStyle = 'bg-[var(--surface-elevated)] border-[var(--status-warning-border)]';
          badgeColor = 'bg-amber-500/15 text-amber-400 border-amber-500/30';
        } else if (t.type === 'error') {
          Icon = AlertOctagon;
          iconColor = 'text-[var(--status-danger)]';
          bgStyle = 'bg-[var(--surface-elevated)] border-[var(--status-danger-border)]';
          badgeColor = 'bg-rose-500/15 text-rose-400 border-rose-500/30';
        } else if (t.type === 'progress') {
          Icon = RefreshCw;
          iconColor = 'text-[var(--accent)]';
          bgStyle = 'bg-[var(--surface-elevated)] border-[var(--accent-border)]';
          badgeColor = 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30';
        }

        return (
          <div
            key={t.id}
            role="status"
            className={`pointer-events-auto flex items-start gap-3 p-3 sm:p-3.5 rounded-xl border shadow-xl backdrop-blur-md transition-all duration-200 transform translate-y-0 opacity-100 ${bgStyle}`}
            style={{
              boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3), 0 8px 10px -6px rgba(0, 0, 0, 0.3)',
            }}
          >
            <div className={`p-1 rounded-lg ${badgeColor} flex-shrink-0 mt-0.5`}>
              <Icon className={`w-4 h-4 ${iconColor} ${t.type === 'progress' ? 'animate-spin' : ''}`} />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-xs sm:text-sm font-bold text-[var(--text-primary)] leading-snug">
                  {t.title}
                </h4>
                <button
                  onClick={() => toast.dismiss(t.id)}
                  aria-label="Закрыть уведомление"
                  className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)] p-0.5 rounded transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {t.description && (
                <p className="text-[11px] sm:text-xs text-[var(--text-secondary)] mt-0.5 leading-relaxed font-sans">
                  {t.description}
                </p>
              )}

              {typeof t.progress === 'number' && (
                <div className="w-full bg-[var(--surface-sunken)] rounded-full h-1.5 mt-2 overflow-hidden">
                  <div
                    className="bg-[var(--accent)] h-full transition-all duration-300 rounded-full"
                    style={{ width: `${Math.max(0, Math.min(100, t.progress))}%` }}
                  />
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
