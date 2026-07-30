import { render, screen, fireEvent } from '@testing-library/react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Heatmap, type HeatmapDatum } from '@/components/shared/Heatmap';
import { addDays } from '@/utils/dates';

// 365-cell fixture, oldest first ending "today" — same shape selectHeatmapData produces.
// Index 200 is deliberately given a high count so it lands in level 4 (heatmapLevel: >8 -> 4),
// giving us a deterministic cell to spot-check the level->class mapping and click behavior on.
function buildFixture(): HeatmapDatum[] {
  const today = '2026-07-30';
  const data: HeatmapDatum[] = [];
  for (let i = 364; i >= 0; i--) {
    const date = addDays(today, -i);
    const index = 364 - i;
    if (index === 200) {
      data.push({ date, count: 12, level: 4 });
    } else if (index % 5 === 0) {
      data.push({ date, count: 1, level: 1 });
    } else {
      data.push({ date, count: 0, level: 0 });
    }
  }
  return data;
}

function renderHeatmap(data: HeatmapDatum[], onSelectDate?: (date: string) => void) {
  return render(
    <TooltipProvider>
      <Heatmap data={data} onSelectDate={onSelectDate} />
    </TooltipProvider>,
  );
}

describe('Heatmap', () => {
  test('renders exactly 365 cell buttons from a 365-day fixture', () => {
    renderHeatmap(buildFixture());
    expect(screen.getAllByRole('button')).toHaveLength(365);
  });

  test('applies the level-4 class to the level-4 cell', () => {
    const data = buildFixture();
    renderHeatmap(data);

    const target = data[200];
    const cell = screen.getByRole('button', { name: `${target.count} activities on ${target.date}` });
    expect(cell.className).toContain('bg-primary');
  });

  test('applies the level-0 class to a zero-activity cell', () => {
    const data = buildFixture();
    renderHeatmap(data);

    const target = data[1]; // index 1: not a multiple of 5, not 200 -> level 0
    const cell = screen.getByRole('button', { name: `${target.count} activities on ${target.date}` });
    expect(cell.className).toContain('bg-muted/40');
  });

  test('clicking a cell calls onSelectDate with that cell\'s date', () => {
    const data = buildFixture();
    const onSelectDate = vi.fn();
    renderHeatmap(data, onSelectDate);

    const target = data[200];
    const cell = screen.getByRole('button', { name: `${target.count} activities on ${target.date}` });
    fireEvent.click(cell);

    expect(onSelectDate).toHaveBeenCalledTimes(1);
    expect(onSelectDate).toHaveBeenCalledWith(target.date);
  });

  test('wraps the grid in a horizontal scroll container so it never overflows the page', () => {
    const { container } = renderHeatmap(buildFixture());
    expect(container.querySelector('.overflow-x-auto')).not.toBeNull();
  });
});
