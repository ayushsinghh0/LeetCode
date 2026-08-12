import type { ReactNode } from 'react';
import { Provider } from 'react-redux';
import { renderHook } from '@testing-library/react';
import { makeStore, type AppStore } from '@/store/store';
import { resetDueReminderForTests, useDueReminder } from '@/hooks/useDueReminder';
import { settingsUpdated } from '@/store/slices/settingsSlice';
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
