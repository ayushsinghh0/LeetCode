import '@testing-library/jest-dom/vitest';

// jsdom doesn't implement window.scrollTo; framer-motion's layout-animation engine calls it
// internally while measuring "auto" height keyframes (e.g. RoadmapPage's expand/collapse row),
// which otherwise logs a noisy "Not implemented: window.scrollTo" error to the console on every
// such test. Stubbing it out keeps test output pristine without touching application code —
// application code never calls window.scrollTo itself (RoadmapPage guards element.scrollIntoView
// instead, which jsdom also lacks).
window.scrollTo = vi.fn();

// jsdom has no ResizeObserver. Radix Switch renders a hidden native-input "bubble" fallback (used
// for native form/autofill compatibility) that calls the internal `useSize` hook, which
// instantiates a ResizeObserver unconditionally as soon as the Switch is mounted inside a <form>
// ancestor — unrelated to whether the test actually opens/interacts with the widget. A minimal
// observe/unobserve/disconnect stub is enough; nothing in this app's tests asserts on actual
// resize notifications.
if (typeof window.ResizeObserver === 'undefined') {
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  window.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
}
