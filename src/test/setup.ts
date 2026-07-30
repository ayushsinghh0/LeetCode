import '@testing-library/jest-dom/vitest';

// jsdom doesn't implement window.scrollTo; framer-motion's layout-animation engine calls it
// internally while measuring "auto" height keyframes (e.g. RoadmapPage's expand/collapse row),
// which otherwise logs a noisy "Not implemented: window.scrollTo" error to the console on every
// such test. Stubbing it out keeps test output pristine without touching application code —
// application code never calls window.scrollTo itself (RoadmapPage guards element.scrollIntoView
// instead, which jsdom also lacks).
window.scrollTo = vi.fn();
