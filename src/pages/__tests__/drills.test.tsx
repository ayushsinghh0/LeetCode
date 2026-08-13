import { describe, expect, test, vi, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithStore } from '@/test/renderWithStore';
import DrillsPage from '@/pages/DrillsPage';
import questionsData from '@/data/questions.json';
import { FAMILIES, familyById } from '@/data/curriculum';
import { patternById } from '@/data/patterns';
import { buildDrill } from '@/utils/engine/drills';
import type { Question } from '@/types';

const questions = questionsData as Question[];
const questionById = new Map(questions.map((q) => [q.id, q]));

// The page seeds its drill with todayISO(), so the pinned clock makes the whole run
// reproducible; the test recomputes the same drill to know each correct answer.
const TODAY = '2026-07-30';
const drill = buildDrill(FAMILIES, questionById, TODAY, 8);

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(new Date('2026-07-30T12:00:00'));
});
afterEach(() => {
  vi.useRealTimers();
});

function optionButton(name: string) {
  const group = screen.getByRole('group', { name: 'Technique options' });
  const btn = [...group.querySelectorAll('button')].find((b) => b.textContent?.includes(name));
  expect(btn).toBeDefined();
  return btn!;
}

describe('DrillsPage', () => {
  test('presents the day\'s first drill question with four technique options', () => {
    renderWithStore(<DrillsPage />);
    expect(screen.getByText('Recognition drill')).toBeInTheDocument();
    expect(screen.getByText('1 / 8')).toBeInTheDocument();

    const first = drill[0]!;
    const q = questionById.get(first.questionId)!;
    expect(screen.getByRole('heading', { level: 2, name: q.title })).toBeInTheDocument();
    const group = screen.getByRole('group', { name: 'Technique options' });
    expect(group.querySelectorAll('button')).toHaveLength(4);
  });

  test('a correct pick reveals the family teaching block and advances', () => {
    renderWithStore(<DrillsPage />);
    const first = drill[0]!;

    fireEvent.click(optionButton(patternById[first.pattern]!.name));
    expect(screen.getByText('Recognized.')).toBeInTheDocument();
    expect(screen.getByText(/Watch out:/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    expect(screen.getByText('2 / 8')).toBeInTheDocument();
  });

  test('a wrong pick names the actual technique', () => {
    renderWithStore(<DrillsPage />);
    const first = drill[0]!;
    const wrong = first.options.find((o) => o !== first.pattern)!;

    fireEvent.click(optionButton(patternById[wrong]!.name));
    expect(screen.getByText(new RegExp(`This one is ${patternById[first.pattern]!.name}`))).toBeInTheDocument();
  });

  test('finishing shows the score and offers a rerun', () => {
    renderWithStore(<DrillsPage />);
    for (let i = 0; i < drill.length; i++) {
      fireEvent.click(optionButton(patternById[drill[i]!.pattern]!.name));
      fireEvent.click(screen.getByRole('button', { name: i === drill.length - 1 ? /finish/i : /next/i }));
    }
    expect(screen.getByText('8 of 8 recognized')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /run it again/i }));
    expect(screen.getByText('1 / 8')).toBeInTheDocument();
  });

  test('answering keeps focus on the chosen option and announces the verdict', () => {
    renderWithStore(<DrillsPage />);
    const first = drill[0]!;
    const chosen = optionButton(patternById[first.pattern]!.name);

    chosen.focus();
    fireEvent.click(chosen);

    // aria-disabled, not `disabled`: disabling the button the learner just activated drops it out
    // of the focus order, which throws keyboard focus to <body> the moment they answer.
    expect(chosen).not.toBeDisabled();
    expect(chosen).toHaveAttribute('aria-disabled', 'true');
    expect(document.activeElement).toBe(chosen);

    expect(screen.getByRole('status')).toHaveTextContent(
      `Correct — ${familyById[first.familyId]!.name}.`,
    );
  });

  test('a revealed answer is final — picking again does not change the verdict', () => {
    renderWithStore(<DrillsPage />);
    const first = drill[0]!;
    const wrong = first.options.find((o) => o !== first.pattern)!;

    fireEvent.click(optionButton(patternById[first.pattern]!.name));
    fireEvent.click(optionButton(patternById[wrong]!.name));

    expect(screen.getByText('Recognized.')).toBeInTheDocument();
    expect(screen.getByText('1 correct')).toBeInTheDocument();
  });

  test('the drill is the page\'s one plate — options are bordered buttons, not surfaces', () => {
    const { container } = renderWithStore(<DrillsPage />);

    // DESIGN.md § The plate rule: one `Lead` per page, and never a plate inside a plate. This
    // page used to stack a header plate, a question plate, four option plates and a tonal box.
    expect(container.querySelectorAll('.glass')).toHaveLength(1);

    const group = screen.getByRole('group', { name: 'Technique options' });
    for (const button of group.querySelectorAll('button')) {
      expect(button.className).not.toMatch(/(^|\s)glass(\s|$)/);
    }
  });
});
