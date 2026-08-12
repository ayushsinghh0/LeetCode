import { makeStore } from '@/store/store';
import { addTask, deferTaskToTomorrow, deleteTask, importProgress, resetProgress, toggleTask } from '@/store/actions';
import { nextTaskId, selectTasksForDate } from '@/store/slices/tasksSlice';
import { selectPersistedState, validatePersisted } from '@/services/storage/serialize';

const TODAY = '2026-07-30';
const TOMORROW = '2026-07-31';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-07-30T12:00:00'));
});

afterEach(() => {
  vi.useRealTimers();
});

test('addTask: creates a task for today with a deterministic sequential id; blank titles are rejected', () => {
  const store = makeStore();

  store.dispatch(addTask({ title: 'Send referral follow-up', category: 'communication', estMinutes: 10 }));
  store.dispatch(addTask({ title: '   ' , category: 'admin' })); // whitespace-only — dropped
  store.dispatch(addTask({ title: 'Project milestone', category: 'project' }));

  const tasks = selectTasksForDate(store.getState(), TODAY);
  expect(tasks.map((t) => t.id)).toEqual(['t1', 't2']);
  expect(tasks[0]).toMatchObject({
    title: 'Send referral follow-up',
    category: 'communication',
    date: TODAY,
    done: false,
    completedOn: null,
    estMinutes: 10,
  });
  expect(tasks[1]!.estMinutes).toBeNull(); // no estimate given -> planner default applies later
});

test('toggleTask: stamps completedOn today, and un-toggling clears it; completed tasks sort after open ones', () => {
  const store = makeStore();
  store.dispatch(addTask({ title: 'A', category: 'study' }));
  store.dispatch(addTask({ title: 'B', category: 'study' }));

  store.dispatch(toggleTask('t1'));
  let tasks = selectTasksForDate(store.getState(), TODAY);
  expect(tasks.map((t) => t.title)).toEqual(['B', 'A']); // open first
  expect(tasks[1]).toMatchObject({ done: true, completedOn: TODAY });

  store.dispatch(toggleTask('t1'));
  tasks = selectTasksForDate(store.getState(), TODAY);
  expect(tasks.find((t) => t.id === 't1')).toMatchObject({ done: false, completedOn: null });
});

test('deferTaskToTomorrow: moves an OPEN task off today; completed tasks stay put (they are history)', () => {
  const store = makeStore();
  store.dispatch(addTask({ title: 'Open one', category: 'admin' }));
  store.dispatch(addTask({ title: 'Done one', category: 'admin' }));
  store.dispatch(toggleTask('t2'));

  store.dispatch(deferTaskToTomorrow('t1'));
  store.dispatch(deferTaskToTomorrow('t2')); // no-op on a completed task

  expect(selectTasksForDate(store.getState(), TODAY).map((t) => t.id)).toEqual(['t2']);
  expect(selectTasksForDate(store.getState(), TOMORROW).map((t) => t.id)).toEqual(['t1']);
});

test('deleteTask removes the task entirely', () => {
  const store = makeStore();
  store.dispatch(addTask({ title: 'Ephemeral', category: 'study' }));
  store.dispatch(deleteTask('t1'));
  expect(store.getState().tasks.byId).toEqual({});
});

test('nextTaskId: survives import — new ids never collide with imported ones', () => {
  expect(nextTaskId({})).toBe('t1');
  expect(nextTaskId({ t3: {} as never, t12: {} as never, weird: {} as never })).toBe('t13');
});

test('tasks persist: round-trip through selectPersistedState -> validatePersisted -> import', () => {
  const store = makeStore();
  store.dispatch(addTask({ title: 'Survive the round trip', category: 'project', estMinutes: 45 }));
  store.dispatch(toggleTask('t1'));

  const persisted = selectPersistedState(store.getState());
  expect(persisted.tasks?.byId.t1).toMatchObject({ title: 'Survive the round trip', done: true });

  const validated = validatePersisted(JSON.parse(JSON.stringify(persisted)));
  expect(validated).not.toBeNull();

  const fresh = makeStore();
  fresh.dispatch(importProgress(validated!));
  expect(selectTasksForDate(fresh.getState(), TODAY)).toHaveLength(1);
});

test('a store with no tasks persists without a tasks section (pre-tasks payloads stay byte-identical)', () => {
  const store = makeStore();
  store.dispatch(addTask({ title: 'temp', category: 'study' }));
  store.dispatch(resetProgress()); // reset clears tasks too

  const persisted = selectPersistedState(store.getState());
  expect(persisted).not.toHaveProperty('tasks');
});

test('validatePersisted rejects malformed task entries wholesale', () => {
  const store = makeStore();
  store.dispatch(addTask({ title: 'ok', category: 'study' }));
  const base = JSON.parse(JSON.stringify(selectPersistedState(store.getState())));

  const badCategory = structuredClone(base);
  badCategory.tasks.byId.t1.category = 'urgent';
  expect(validatePersisted(badCategory)).toBeNull();

  const badDate = structuredClone(base);
  badDate.tasks.byId.t1.date = 'tomorrow';
  expect(validatePersisted(badDate)).toBeNull();

  const keyMismatch = structuredClone(base);
  keyMismatch.tasks.byId.t9 = { ...keyMismatch.tasks.byId.t1 }; // id still says t1
  expect(validatePersisted(keyMismatch)).toBeNull();

  const badEstimate = structuredClone(base);
  badEstimate.tasks.byId.t1.estMinutes = -5;
  expect(validatePersisted(badEstimate)).toBeNull();
});

test('validatePersisted: dailyCapacityMin optional, validated when present', () => {
  const store = makeStore();
  const base = JSON.parse(JSON.stringify(selectPersistedState(store.getState())));

  expect(validatePersisted(base)).not.toBeNull(); // carries the store default (180)

  const absent = structuredClone(base);
  delete absent.settings.dailyCapacityMin;
  expect(validatePersisted(absent)).not.toBeNull(); // pre-plan payloads keep loading

  const invalid = structuredClone(base);
  invalid.settings.dailyCapacityMin = 5; // below any sane budget
  expect(validatePersisted(invalid)).toBeNull();
});
