import { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { celebrationShown } from '@/store/slices/uiSlice';

// Narrowed to just the call signature (not the full `typeof confetti`, which also carries
// static members like `.reset`/`.create`) so tests can inject a plain vi.fn() in place of the
// real canvas-confetti (which needs a real <canvas> — jsdom has none). Production code never
// touches this setter.
type ConfettiFn = (options?: Parameters<typeof confetti>[0]) => ReturnType<typeof confetti>;

let confettiImpl: ConfettiFn = confetti;

export function __setConfettiForTests(fn: ConfettiFn): void {
  confettiImpl = fn;
}

function fire(options: Parameters<typeof confetti>[0]): void {
  try {
    confettiImpl(options);
  } catch {
    // canvas-confetti throws in environments without real canvas support (e.g. jsdom without
    // a canvas polyfill) — celebrations are decorative, never worth crashing the app over.
  }
}

const FIREWORK_BURSTS = [
  { delay: 0, x: 0.3 },
  { delay: 300, x: 0.7 },
  { delay: 600, x: 0.5 },
] as const;

/**
 * Subscribes to ui.celebration and plays the corresponding canvas-confetti animation:
 * 'confetti' = one burst, 'fireworks' = 3 staggered bursts. Mounted once in AppShell — every
 * page shares this single subscription rather than each page wiring its own.
 */
export function useCelebration(): void {
  const celebration = useAppSelector((state) => state.ui.celebration);
  const dispatch = useAppDispatch();

  useEffect(() => {
    if (!celebration) return;

    if (celebration === 'confetti') {
      fire({ particleCount: 120, spread: 70, origin: { y: 0.7 } });
    } else {
      for (const burst of FIREWORK_BURSTS) {
        setTimeout(() => {
          fire({ particleCount: 120, spread: 70, origin: { x: burst.x, y: 0.7 } });
        }, burst.delay);
      }
    }

    // Clear immediately after scheduling — the staggered fireworks timers legitimately outlive
    // this clear and still fire; ui.celebration only needs to be reset so the next solve can
    // trigger a fresh celebration.
    dispatch(celebrationShown(null));
  }, [celebration, dispatch]);
}
