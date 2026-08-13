import { ML_STAGE_ORDER, ML_TRACKS, mlTrackById, totalFailureModes } from '@/data/mlTracks';
import { ML_PROJECTS, ML_PROJECTS_IN_ORDER, ML_TIER_ORDER, mlProjectById } from '@/data/mlProjects';
import { courseWeekById } from '@/data/aimlCourse';

// These mirror the generator's closed-world gates (scripts/generate-questions.mjs) and the
// offline validator, one layer closer to the app: the JSON the UI actually imports is the thing
// under test here, so a hand-edit to src/data/*.json fails the suite even if nobody re-ran either
// script.

describe('ML implementation tracks', () => {
  test('every track carries all five stages, non-empty, in the documented order', () => {
    expect(ML_TRACKS.length).toBeGreaterThan(0);
    for (const track of ML_TRACKS) {
      expect(Object.keys(track.stages).sort(), track.id).toEqual([...ML_STAGE_ORDER].sort());
      expect(track.stages.math.summary.trim(), track.id).not.toBe('');
      expect(track.stages.math.detail.trim(), track.id).not.toBe('');
      expect(track.stages.math.symbols.length, track.id).toBeGreaterThanOrEqual(4);
      expect(track.stages.scratch.checklist.length, track.id).toBeGreaterThanOrEqual(5);
      expect(track.stages.scratch.shapes.length, track.id).toBeGreaterThanOrEqual(3);
      expect(track.stages.library.api.length, track.id).toBeGreaterThanOrEqual(3);
      expect(track.stages.library.version.trim(), track.id).not.toBe('');
      expect(track.stages.experiment.dataset.trim(), track.id).not.toBe('');
      expect(track.stages.experiment.metric.trim(), track.id).not.toBe('');
    }
  });

  test('every experiment states a measured figure rather than a recollection', () => {
    for (const track of ML_TRACKS) {
      expect(track.stages.experiment.expect, track.id).toMatch(/\d/);
    }
  });

  test('every track documents at least two failure modes, each with symptom, cause and fix', () => {
    for (const track of ML_TRACKS) {
      expect(track.stages.failure.length, track.id).toBeGreaterThanOrEqual(2);
      for (const f of track.stages.failure) {
        expect(f.symptom.trim(), track.id).not.toBe('');
        expect(f.cause.trim(), track.id).not.toBe('');
        expect(f.fix.trim(), track.id).not.toBe('');
      }
    }
    expect(totalFailureModes()).toBe(ML_TRACKS.reduce((s, t) => s + t.stages.failure.length, 0));
  });

  test('ids are unique and every prereq resolves to a real track', () => {
    expect(Object.keys(mlTrackById)).toHaveLength(ML_TRACKS.length);
    for (const track of ML_TRACKS) {
      for (const prereq of track.prereqs) {
        expect(mlTrackById[prereq], `${track.id} -> ${prereq}`).toBeDefined();
      }
      expect(track.prereqs).not.toContain(track.id);
    }
  });

  test('the prereq graph is acyclic, so the ladder can be ordered', () => {
    const state = new Map<string, 'open' | 'done'>();
    const cycles: string[] = [];
    const visit = (id: string, stack: string[]) => {
      if (state.get(id) === 'done') return;
      if (state.get(id) === 'open') {
        cycles.push([...stack, id].join(' -> '));
        return;
      }
      state.set(id, 'open');
      for (const next of mlTrackById[id]?.prereqs ?? []) visit(next, [...stack, id]);
      state.set(id, 'done');
    };
    for (const track of ML_TRACKS) visit(track.id, []);
    expect(cycles).toEqual([]);
  });

  test('weekIds are real course weeks or an explicit null — never a near miss', () => {
    for (const track of ML_TRACKS) {
      expect('weekId' in track, track.id).toBe(true);
      if (track.weekId !== null) {
        expect(courseWeekById.has(track.weekId), `${track.id}: ${track.weekId}`).toBe(true);
      }
    }
    // The classical-ML tracks have nowhere honest to attach — the 26-week course never covers
    // them, and this null is the claim the dataset is making.
    expect(mlTrackById['k-means']!.weekId).toBeNull();
    expect(mlTrackById['pca']!.weekId).toBeNull();
    expect(mlTrackById['decision-tree']!.weekId).toBeNull();
    expect(mlTrackById['naive-bayes']!.weekId).toBeNull();
  });
});

describe('ML project ladder', () => {
  test('every project states a baseline model, and a null score carries the note that names who measures it', () => {
    expect(ML_PROJECTS.length).toBeGreaterThan(0);
    for (const project of ML_PROJECTS) {
      expect(project.baseline.model.trim(), project.id).not.toBe('');
      expect(project.baseline.metric.trim(), project.id).not.toBe('');
      if (project.baseline.score === null) {
        expect(project.baseline.note?.trim().length ?? 0, project.id).toBeGreaterThan(120);
      } else {
        expect(project.baseline.score, project.id).toMatch(/\d/);
      }
    }
  });

  test('every metric argues against its obvious alternative', () => {
    for (const project of ML_PROJECTS) {
      expect(project.metric.name.trim(), project.id).not.toBe('');
      expect(project.metric.why.trim().length, project.id).toBeGreaterThan(120);
    }
  });

  test('projects carry experiments, error analysis and unanswered retrospective questions', () => {
    for (const project of ML_PROJECTS) {
      expect(project.experiments.length, project.id).toBeGreaterThanOrEqual(2);
      expect(project.errorAnalysis.length, project.id).toBeGreaterThanOrEqual(3);
      expect(project.retrospective.length, project.id).toBeGreaterThanOrEqual(3);
      expect(project.hours, project.id).toBeGreaterThan(0);
      // No answer key, ever: the answers are properties of the learner's own runs.
      expect(project).not.toHaveProperty('solution');
      expect(project).not.toHaveProperty('walkthrough');
    }
  });

  test('prereqTracks resolve to real tracks and weekIds are real or explicitly null', () => {
    for (const project of ML_PROJECTS) {
      expect(project.prereqTracks.length, project.id).toBeGreaterThan(0);
      for (const trackId of project.prereqTracks) {
        expect(mlTrackById[trackId], `${project.id} -> ${trackId}`).toBeDefined();
      }
      expect('weekId' in project, project.id).toBe(true);
      if (project.weekId !== null) {
        expect(courseWeekById.has(project.weekId), `${project.id}: ${project.weekId}`).toBe(true);
      }
    }
  });

  test('the reading order is tier sequence then order within the tier', () => {
    expect(ML_PROJECTS_IN_ORDER).toHaveLength(ML_PROJECTS.length);
    expect(Object.keys(mlProjectById)).toHaveLength(ML_PROJECTS.length);
    const rank = (tier: string) => ML_TIER_ORDER.indexOf(tier as never);
    for (let i = 1; i < ML_PROJECTS_IN_ORDER.length; i++) {
      const prev = ML_PROJECTS_IN_ORDER[i - 1]!;
      const curr = ML_PROJECTS_IN_ORDER[i]!;
      const ordered =
        rank(prev.tier) < rank(curr.tier) ||
        (prev.tier === curr.tier && prev.order < curr.order);
      expect(ordered, `${prev.id} before ${curr.id}`).toBe(true);
    }
    for (const project of ML_PROJECTS) expect(ML_TIER_ORDER).toContain(project.tier);
  });
});
