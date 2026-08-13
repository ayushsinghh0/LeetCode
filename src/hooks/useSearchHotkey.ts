import { useEffect } from 'react';
import { useAppDispatch } from '@/store/hooks';
import { searchOpenSet } from '@/store/slices/uiSlice';

/**
 * Global Ctrl/Cmd+K → open the command palette. Lives here — in the eager shell — rather than
 * inside SearchDialog, because the dialog itself is lazy-loaded on first open: a hotkey owned by
 * a component that only mounts after the hotkey fires would never fire. AppShell mounts this
 * once; every other trigger (Sidebar's search button, MobileNav's "More" sheet) just dispatches
 * searchOpenSet(true).
 */
export function useSearchHotkey(): void {
  const dispatch = useAppDispatch();

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        dispatch(searchOpenSet(true));
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [dispatch]);
}
