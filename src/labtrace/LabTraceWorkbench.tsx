import React, { useState } from 'react';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import type { LabTraceWorkbenchControls } from './types';

export interface LabTraceWorkbenchProps {
  brand: React.ReactNode;
  headerActions?: React.ReactNode;
  sidebar?: React.ReactNode;
  toolbar?: React.ReactNode | ((controls: LabTraceWorkbenchControls) => React.ReactNode);
  children: React.ReactNode;
  overlays?: React.ReactNode;
  sidebarWidth?: number;
  initialSidebarOpen?: boolean;
  className?: string;
}

/**
 * Embeddable LabTrace UI shell. The host owns domain data and fills stable zones;
 * LabTrace owns the editor geometry, responsive shell and zone boundaries.
 */
export function LabTraceWorkbench({
  brand,
  headerActions,
  sidebar,
  toolbar,
  children,
  overlays,
  sidebarWidth = 294,
  initialSidebarOpen = true,
  className = '',
}: LabTraceWorkbenchProps) {
  const [sidebarOpen, setSidebarOpen] = useState(initialSidebarOpen);
  const controls: LabTraceWorkbenchControls = {
    sidebarOpen,
    toggleSidebar: () => setSidebarOpen((value) => !value),
    openSidebar: () => setSidebarOpen(true),
    closeSidebar: () => setSidebarOpen(false),
  };

  return (
    <div className={`min-h-[100dvh] bg-[var(--surface-canvas)] text-[var(--text-primary)] flex flex-col overflow-hidden ${className}`} data-labtrace-root>
      <header
        className="h-[68px] shrink-0 border-b border-[var(--border-subtle)] bg-[var(--surface-primary)] flex items-center gap-3 px-3 sm:px-5"
        data-labtrace-zone="header"
      >
        <div className="min-w-0 flex flex-1 items-center gap-3">{brand}</div>
        {headerActions && <div className="ml-auto flex items-center gap-2">{headerActions}</div>}
      </header>

      <div className="flex min-h-0 flex-1">
        {sidebar && (
          <aside
            className="relative shrink-0 overflow-hidden border-r border-[var(--border-subtle)] bg-[var(--surface-primary)] transition-[width] duration-200"
            style={{ width: sidebarOpen ? sidebarWidth : 0 }}
            data-labtrace-zone="sidebar"
            aria-hidden={!sidebarOpen}
          >
            <div className="h-full" style={{ width: sidebarWidth }}>{sidebar}</div>
          </aside>
        )}

        <main className="relative min-w-0 flex-1 flex flex-col bg-[var(--surface-canvas)]" data-labtrace-zone="workspace">
          <div
            className="h-11 shrink-0 border-b border-[var(--border-subtle)] bg-[var(--surface-primary)]/80 px-3 flex items-center gap-2 text-[11px] text-[var(--text-tertiary)]"
            data-labtrace-zone="toolbar"
          >
            {sidebar && (
              <button
                type="button"
                onClick={controls.toggleSidebar}
                className="interactive-btn h-8 w-8 grid place-items-center rounded-lg hover:bg-[var(--surface-secondary)] text-[var(--text-secondary)]"
                title={sidebarOpen ? 'Скрыть панель' : 'Показать панель'}
              >
                {sidebarOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
              </button>
            )}
            {typeof toolbar === 'function' ? toolbar(controls) : toolbar}
          </div>

          <div className="min-h-0 flex-1 p-2 sm:p-3" data-labtrace-zone="canvas">
            {children}
          </div>
        </main>
      </div>

      {overlays && <div data-labtrace-zone="overlays">{overlays}</div>}
    </div>
  );
}
