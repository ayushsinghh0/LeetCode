import { ICON_MAP } from '@/components/shared/iconMap';
import { PATTERNS } from '@/data/patterns';
import { ACHIEVEMENTS } from '@/utils/engine/achievements';

// ICON_MAP imports icons explicitly (tree-shaking); these tests pin that every icon name the
// string-keyed datasets reference actually resolves — adding a name to a dataset without adding
// it to the map fails here instead of silently falling back at runtime.

test('every pattern icon name resolves in ICON_MAP', () => {
  const missing = PATTERNS.filter((p) => !(p.icon in ICON_MAP)).map((p) => `${p.id}: ${p.icon}`);
  expect(missing).toEqual([]);
});

test('every achievement icon name resolves in ICON_MAP', () => {
  const missing = ACHIEVEMENTS.filter((a) => !(a.icon in ICON_MAP)).map((a) => `${a.id}: ${a.icon}`);
  expect(missing).toEqual([]);
});
