import { screen, fireEvent } from '@testing-library/react';
import { renderWithStore } from '@/test/renderWithStore';
import { CourseRecallList } from '@/components/course/CourseRecallList';
import type { RecallPrompt } from '@/data/courseRecall';

const prompts: RecallPrompt[] = [
  { id: 'w00-r1', weekId: 'w00', prompt: 'What does a learning rate control?', answer: 'Step size.', depth: 'core' },
  { id: 'w00-r2', weekId: 'w00', prompt: 'Why normalize inputs?', answer: 'Conditioning.', depth: 'stretch' },
];

describe('CourseRecallList — self-grading (wave F)', () => {
  test('the answer stays hidden until revealed — the recall attempt is the exercise', () => {
    renderWithStore(<CourseRecallList prompts={prompts} />);

    expect(screen.queryByText('Step size.')).not.toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: /Reveal answer/i })[0]!);
    expect(screen.getByText('Step size.')).toBeInTheDocument();
  });

  test('offers Got it / Not yet per prompt and records the aggregate once every prompt is graded', () => {
    const onRecord = vi.fn();
    renderWithStore(<CourseRecallList prompts={prompts} onRecord={onRecord} />);

    // No premature record: the action appears only once every prompt has a verdict.
    expect(screen.queryByRole('button', { name: /Record result/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('button', { name: 'Got it' })[0]!);
    fireEvent.click(screen.getAllByRole('button', { name: 'Not yet' })[1]!);

    fireEvent.click(screen.getByRole('button', { name: /Record result/i }));
    expect(onRecord).toHaveBeenCalledTimes(1);
    expect(onRecord).toHaveBeenCalledWith(1, 2); // one recalled of two
  });

  test('a check already recorded today says so and offers no second save', () => {
    renderWithStore(<CourseRecallList prompts={prompts} recordedToday onRecord={vi.fn()} />);

    expect(screen.getByText(/already recorded/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Record result/i })).not.toBeInTheDocument();
  });

  test('the recording copy stays feedback, not judgment', () => {
    const { container } = renderWithStore(<CourseRecallList prompts={prompts} onRecord={vi.fn()} />);

    fireEvent.click(screen.getAllByRole('button', { name: 'Got it' })[0]!);
    fireEvent.click(screen.getAllByRole('button', { name: 'Got it' })[1]!);
    fireEvent.click(screen.getByRole('button', { name: /Record result/i }));

    expect(container.textContent ?? '').not.toMatch(/failed|wrong|bad|behind|should have/i);
  });
});
