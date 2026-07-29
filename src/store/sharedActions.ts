// Shared lifecycle actions dispatched by thunks in actions.ts and consumed by every slice's
// `extraReducers`. Living in their own file (rather than in one slice) avoids the circular
// import that would otherwise occur if, say, progressSlice imported gamificationSlice (or vice
// versa) just to share these two action types.
import { createAction } from '@reduxjs/toolkit';
import type { PersistedStateV1 } from '@/types';

export const stateImported = createAction<PersistedStateV1>('shared/stateImported');
export const progressReset = createAction('shared/progressReset');
