import { NAV_ITEMS } from '@/components/layout/navItems';

test('the nav registry keeps exactly five primary mobile tabs, both learning tracks among them', () => {
  const primary = NAV_ITEMS.filter((item) => item.mobile === 'primary').map((item) => item.label);
  expect(primary).toEqual(['Dashboard', 'Today', 'Roadmap', 'AI/ML', 'Revision']);
});

test('every registry entry has a unique path and label', () => {
  expect(new Set(NAV_ITEMS.map((item) => item.to)).size).toBe(NAV_ITEMS.length);
  expect(new Set(NAV_ITEMS.map((item) => item.label)).size).toBe(NAV_ITEMS.length);
});
