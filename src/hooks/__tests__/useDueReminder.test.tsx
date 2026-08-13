import type { ReactNode } from 'react';
import { Provider } from 'react-redux';
import { renderHook } from '@testing-library/react';
import { makeStore, type AppStore } from '@/store/store';
import { resetDueReminderForTests, useDueReminder } from '@/hooks/useDueReminder';
import { settingsUpdated } from '@/store/slices/settingsSlice';
import { selectDueRevisionIds, selectRevisionQueueIds } from '@/store/selectors';
import { initialProgress } from '@/utils/engine/spacedRepetition';
import type { QuestionProgress } from '@/types';

const TODAY = '2026-07-30';

// Minimal Notification stand-in — jsdom ships none. Instances record constructor calls;
// `permission` is mutable per test.
const notificationCalls: { title: string; body?: string }[] = [];
class FakeNotification {
  static permission: NotificationPermission = 'granted';
  constructor(title: string, options?: NotificationOptions) {
    notificationCalls.push({ title, body: options?.body });
  }
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(`${TODAY}T12:00:00`));
  vi.stubGlobal('Notification', FakeNotification);
  FakeNotification.permission = 'granted';
  notificationCalls.length = 0;
  resetDueReminderForTests();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function storeWithDueRevision(notifications: boolean): AppStore {
  const byId: Record<number, QuestionProgress> = {
    1: { ...initialProgress(), status: 'solved', revisionStage: 1, nextRevision: TODAY },
  };
  const store = makeStore({ progress: { byId, dayLogs: {}, startDate: '2026-07-01' } });
  store.dispatch(settingsUpdated({ notifications }));
  return store;
}

function renderReminder(store: AppStore) {
  const wrapper = ({ children }: { children: ReactNode }) => <Provider store={store}>{children}</Provider>;
  return renderHook(() => useDueReminder(), { wrapper });
}

test('fires one notification when enabled, permitted, and revision work is due — and only once per day', () => {
  const store = storeWithDueRevision(true);
  const { unmount } = renderReminder(store);

  expect(notificationCalls).toHaveLength(1);
  expect(notificationCalls[0]!.body).toBe('1 item is due for review today.');

  // Remounting (e.g. navigating to /focus and back unmounts AppShell) must not re-fire.
  unmount();
  renderReminder(store);
  expect(notificationCalls).toHaveLength(1);
});

test('silent when the notifications setting is off', () => {
  renderReminder(storeWithDueRevision(false));
  expect(notificationCalls).toHaveLength(0);
});

test('silent when browser permission was not granted', () => {
  FakeNotification.permission = 'denied';
  renderReminder(storeWithDueRevision(true));
  expect(notificationCalls).toHaveLength(0);
});

test('silent when nothing is due', () => {
  const store = makeStore();
  store.dispatch(settingsUpdated({ notifications: true }));
  renderReminder(store);
  expect(notificationCalls).toHaveLength(0);
});

test('silent on a weekly revision day whose queue is nothing but pulled-forward top-ups', () => {
  // 48 solves puts the roadmap on day 7 — a weekly revision day — and every one of them has a
  // next review in the future, so nothing is genuinely due. The weekly top-up still pads the
  // queue to 15; those items are an offer, not a debt, and the phone must stay quiet.
  const byId: Record<number, QuestionProgress> = {};
  for (let id = 1; id <= 48; id++) {
    byId[id] = {
      ...initialProgress(),
      status: 'solved',
      revisionStage: 1,
      nextRevision: '2026-08-20',
      completedAt: '2026-07-29',
    };
  }
  const store = makeStore({ progress: { byId, dayLogs: {}, startDate: '2026-07-01' } });
  store.dispatch(settingsUpdated({ notifications: true }));

  // Guard the premise: the queue really is padded, and none of it is due.
  expect(selectDueRevisionIds(store.getState(), TODAY)).toEqual([]);
  expect(selectRevisionQueueIds(store.getState(), TODAY)).toHaveLength(15);

  renderReminder(store);
  expect(notificationCalls).toHaveLength(0);
});

test('silent when revision is switched off, even with due items', () => {
  const store = storeWithDueRevision(true);
  store.dispatch(settingsUpdated({ revisionEnabled: false }));
  renderReminder(store);
  expect(notificationCalls).toHaveLength(0);
});
