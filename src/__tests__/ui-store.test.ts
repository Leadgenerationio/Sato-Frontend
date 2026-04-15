import { describe, it, expect, beforeEach } from 'vitest';
import { useUiStore } from '../stores/ui-store';

describe('UI Store', () => {
  beforeEach(() => {
    useUiStore.setState({ sidebarOpen: true });
  });

  it('sidebar is open by default', () => {
    expect(useUiStore.getState().sidebarOpen).toBe(true);
  });

  it('toggleSidebar flips state', () => {
    useUiStore.getState().toggleSidebar();
    expect(useUiStore.getState().sidebarOpen).toBe(false);

    useUiStore.getState().toggleSidebar();
    expect(useUiStore.getState().sidebarOpen).toBe(true);
  });

  it('setSidebarOpen sets specific value', () => {
    useUiStore.getState().setSidebarOpen(false);
    expect(useUiStore.getState().sidebarOpen).toBe(false);

    useUiStore.getState().setSidebarOpen(true);
    expect(useUiStore.getState().sidebarOpen).toBe(true);
  });
});
