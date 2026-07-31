import {
  AIML_COURSE_URL,
  COURSE_WEEKS,
  CORE_WEEKS,
  EXTRA_WEEKS,
  courseWeekById,
  lectureUrl,
} from '@/data/aimlCourse';

const RESOURCE_KINDS = [
  'slides', 'colab', 'excalidraw', 'video', 'article', 'docs', 'github', 'assignment', 'sheet', 'link',
];

test('course has 26 core week-modules (0–26, week 19 cancelled) plus 5 optional extras', () => {
  expect(COURSE_WEEKS).toHaveLength(31);
  expect(CORE_WEEKS).toHaveLength(26);
  expect(EXTRA_WEEKS).toHaveLength(5);

  const coreNumbers = CORE_WEEKS.map((w) => w.week);
  const expected = Array.from({ length: 27 }, (_, i) => i).filter((n) => n !== 19);
  expect(coreNumbers).toEqual(expected);

  EXTRA_WEEKS.forEach((w) => {
    expect(w.optional).toBe(true);
    expect(w.week).toBeNull();
  });
});

test('ids are unique and courseWeekById covers every week', () => {
  const ids = COURSE_WEEKS.map((w) => w.id);
  expect(new Set(ids).size).toBe(ids.length);
  COURSE_WEEKS.forEach((w) => expect(courseWeekById.get(w.id)).toBe(w));
});

test('every core week deep-links to its 100xDevs lecture', () => {
  CORE_WEEKS.forEach((w) => {
    expect(w.contentId).not.toBeNull();
    expect(lectureUrl(w)).toBe(`https://100xdevs.com/new-courses/23/video/${w.contentId}`);
  });
});

test('known content ids match the live course outline', () => {
  expect(courseWeekById.get('w00')!.contentId).toBe('4149');
  expect(courseWeekById.get('w01')!.contentId).toBe('4150');
  expect(courseWeekById.get('w07')!.contentId).toBe('6372');
  expect(courseWeekById.get('w17')!.contentId).toBe('6698');
  expect(courseWeekById.get('w20')!.contentId).toBe('7069');
  expect(courseWeekById.get('w25')!.contentId).toBe('v_2091fb99-2623-4c95-95a6-1464365741ac');
});

test('folder-type extras link to the course content listing, not a video page', () => {
  const part1 = courseWeekById.get('x-agents-1')!;
  expect(part1.contentKind).toBe('folder');
  expect(lectureUrl(part1)).toBe('https://100xdevs.com/new-courses/23/content?parentId=7141');
  expect(AIML_COURSE_URL).toBe('https://100xdevs.com/new-courses/23/content?parentId=4148');
});

test('taught dates are ISO yyyy-MM-dd and strictly ascending across core weeks', () => {
  const dates = CORE_WEEKS.map((w) => w.taughtOn);
  dates.forEach((d) => expect(d).toMatch(/^\d{4}-\d{2}-\d{2}$/));
  for (let i = 1; i < dates.length; i++) {
    expect(dates[i]! > dates[i - 1]!).toBe(true);
  }
  // Week 22's site date (13/12/2026) is a known typo — corrected to the assignment's real date.
  expect(courseWeekById.get('w22')!.taughtOn).toBe('2026-06-13');
});

test('resources are well-formed: known kinds, absolute http(s) urls, non-empty labels', () => {
  const all = COURSE_WEEKS.flatMap((w) => w.resources);
  expect(all.length).toBeGreaterThanOrEqual(60);
  all.forEach((r) => {
    expect(RESOURCE_KINDS).toContain(r.kind);
    expect(r.url).toMatch(/^https?:\/\/\S+$/); // no raw spaces — YC url must be %-encoded
    expect(r.label.trim().length).toBeGreaterThan(0);
  });
});

test('spot-check resources: every core week has slides except the assignment week and Week 26', () => {
  CORE_WEEKS.forEach((w) => {
    if (w.id === 'w26') {
      expect(w.resources).toHaveLength(0);
    } else if (w.id !== 'w22') {
      expect(w.resources.some((r) => r.kind === 'slides')).toBe(true);
    }
  });
  // Week 22 is the assignment week: notion assignment + two github repos, no slides deck.
  expect(courseWeekById.get('w22')!.resources.some((r) => r.kind === 'assignment')).toBe(true);
});
