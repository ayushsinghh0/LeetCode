import { useDispatch, useSelector, useStore } from 'react-redux';
import type { TypedUseSelectorHook } from 'react-redux';
import type { AppDispatch, AppStore, RootState } from '@/store/store';

export const useAppDispatch: () => AppDispatch = useDispatch;
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
// For one-off reads of the full store (e.g. building an export snapshot) that shouldn't subscribe
// the component to every state change the way `useAppSelector((s) => s)` would.
export const useAppStore: () => AppStore = useStore;
