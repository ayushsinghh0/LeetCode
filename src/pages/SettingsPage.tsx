import { useState, type ChangeEvent, type ReactNode } from 'react';
import { Controller, useForm } from 'react-hook-form';
import questionsData from '@/data/questions.json';
import { Page, PageHeader, Section } from '@/components/layout/Page';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useAppDispatch, useAppSelector, useAppStore } from '@/store/hooks';
import { importProgress, resetProgress, updateSettings } from '@/store/actions';
import { SESSION_PRESETS } from '@/utils/engine/nextAction';
import { useTheme } from '@/contexts/ThemeContext';
import { exportAsJson, validatePersisted } from '@/services/storage/serialize';
import { totalDays } from '@/utils/engine/roadmap';
import { todayISO } from '@/utils/dates';
import type { PersistedStateV1, Question } from '@/types';

const TOTAL_QUESTIONS = (questionsData as Question[]).length;
const PER_DAY_OPTIONS = Array.from({ length: 13 }, (_, i) => i + 4); // 4..16
/**
 * Study budget the daily plan sums against.
 *
 * This is `SESSION_PRESETS` — the exact list the Today and Revision chips write — plus the longer
 * budgets only this page offers. It used to start at 60 while the chips started at 15, and the
 * two are one setting: tapping "15m" on Today then opening Settings left the Select with a value
 * matching no option, so the one control whose job is to STATE the budget rendered empty. The
 * reverse held too — picking a Settings-only value left every chip unchecked on Today.
 *
 * A value here that no chip offers is fine (the chips are a quick subset); a value a chip can
 * write that is missing here is not.
 */
const CAPACITY_OPTIONS = [...SESSION_PRESETS, 240, 300, 360, 480];
const RESET_CONFIRM_TEXT = 'RESET';

interface SettingsFormValues {
  questionsPerDay: number;
  revisionEnabled: boolean;
  notifications: boolean;
  dailyCapacityMin: number;
}

interface SettingRowProps {
  label: string;
  /** When present the label is a real `<Label htmlFor>`, so clicking it focuses the control. */
  htmlFor?: string;
  description?: ReactNode;
  children: ReactNode;
}

/**
 * One setting: what it is on the left, the control that changes it on the right.
 *
 * This page previously ran two grammars at once — selects stacked under their labels, switches
 * pushed to the far edge of a 1152px plate, and a lone `border-t` on the third danger-zone row.
 * One row shape plus hairlines between them is the whole form's structure now. `justify-between`
 * with a single item on a wrapped line lays it out flush left, so at 375px the control simply
 * drops under its label instead of hugging the right gutter.
 */
function SettingRow({ label, htmlFor, description, children }: SettingRowProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 py-4">
      <div className="flex min-w-0 flex-col gap-1.5">
        {htmlFor ? (
          <Label htmlFor={htmlFor}>{label}</Label>
        ) : (
          <p className="text-sm font-medium leading-none">{label}</p>
        )}
        {description && (
          <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">{description}</p>
        )}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

/** The hairline-ruled stack a group of `SettingRow`s lives in. No plate — a form is not a card. */
function SettingRows({ children }: { children: ReactNode }) {
  return <div className="flex flex-col divide-y divide-border border-y border-border">{children}</div>;
}

export default function SettingsPage() {
  const dispatch = useAppDispatch();
  const store = useAppStore();
  const settings = useAppSelector((state) => state.settings);
  const { theme, toggle: toggleTheme } = useTheme();

  // `values` (not `defaultValues`) keeps the form synced whenever the store's settings change out
  // from under it — in particular after a successful Import, which replaces the whole settings
  // slice via stateImported. `defaultValues` alone is only read once at mount, so the form would
  // otherwise keep showing pre-import values, and a subsequent Save's getValues() would silently
  // revert the just-imported fields back to that stale baseline. RHF re-baselines (isDirty resets
  // to false) whenever this object changes, which is also exactly what we want here: the imported
  // values become the new "unsaved changes" baseline.
  const { control, watch, getValues, reset, formState: { isDirty } } = useForm<SettingsFormValues>({
    values: {
      questionsPerDay: settings.questionsPerDay,
      revisionEnabled: settings.revisionEnabled,
      notifications: settings.notifications,
      dailyCapacityMin: settings.dailyCapacityMin,
    },
  });

  const watchedPerDay = watch('questionsPerDay');

  // Deliberately bypasses react-hook-form's handleSubmit — it always resolves asynchronously
  // (even with no resolver/validation configured, mirroring the reasoning documented on
  // NotesEditor's autosave-on-blur handler), and this Save button has no validation to run
  // before committing. getValues()/reset() give the same result synchronously.
  function handleSave() {
    const values = getValues();
    // Through the thunk, not the slice action: `store/actions.ts` is the only public mutation API
    // (the `ui` slice is the documented exception), and it is where the capacity range guard
    // lives — one guard instead of one per call site.
    dispatch(updateSettings(values));
    reset(values);
  }

  // --- Export --------------------------------------------------------------------------------

  function handleExport() {
    const json = exportAsJson(store.getState());
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `dsa-roadmap-backup-${todayISO()}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }

  // --- Import --------------------------------------------------------------------------------

  const [importError, setImportError] = useState<string | null>(null);
  const [pendingImport, setPendingImport] = useState<PersistedStateV1 | null>(null);

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file to re-trigger onChange
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed: unknown = JSON.parse(String(reader.result));
        const valid = validatePersisted(parsed);
        if (valid) {
          setImportError(null);
          setPendingImport(valid);
        } else {
          setPendingImport(null);
          setImportError('This file is not a valid DSA Roadmap backup.');
        }
      } catch {
        setPendingImport(null);
        setImportError('This file is not valid JSON.');
      }
    };
    reader.readAsText(file);
  }

  function confirmImport() {
    if (!pendingImport) return;
    dispatch(importProgress(pendingImport));
    setPendingImport(null);
  }

  const importSolvedCount = pendingImport
    ? Object.values(pendingImport.progress.byId).filter((p) => p.status === 'solved').length
    : 0;
  const importXp = pendingImport ? pendingImport.gamification.xp : 0;
  // Course sessions in the backup — import replaces the course slice wholesale too, so the
  // preview must say what happens to that track (0 for pre-course backups is the honest answer).
  const importCourseSessions = pendingImport?.course
    ? Object.values(pendingImport.course.byWeekId).reduce(
        (sum, week) => sum + (week.day1DoneOn !== null ? 1 : 0) + (week.day2DoneOn !== null ? 1 : 0),
        0,
      )
    : 0;

  // --- Reset ---------------------------------------------------------------------------------

  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [resetText, setResetText] = useState('');

  function handleResetDialogChange(open: boolean) {
    setResetDialogOpen(open);
    if (!open) setResetText('');
  }

  function confirmReset() {
    dispatch(resetProgress());
    setResetDialogOpen(false);
    setResetText('');
  }

  return (
    // `reading` because this is a form: a 46rem column keeps every label, its help text and its
    // control inside one glance instead of stranding a w-32 select at the left edge of 1152px.
    <Page width="reading">
      <PageHeader
        eyebrow="This device only"
        title="Settings"
        support="Everything you do is stored in this browser. Nothing is uploaded, so a backup file is the only way to move it."
      />

      <Section title="Preferences" support="Tune your daily pace and revision behavior.">
        {/* A real <form> ancestor (even with no onSubmit wired to it) matters here: Radix Select
            only renders its visually-hidden native <select> fallback — used for native form/
            autofill compatibility, and by this app's tests to drive perDay changes without needing
            jsdom to support the visual popper listbox's ResizeObserver/scrollIntoView APIs — when
            it detects a form ancestor (or an explicit `form` prop). Save stays a plain button that
            calls handleSave() directly, so this onSubmit is just a safety net against an accidental
            native submit (e.g. Enter inside a future text field). */}
        <form onSubmit={(e) => e.preventDefault()} className="flex flex-col gap-4">
          <SettingRows>
            <SettingRow
              label="Questions per day"
              htmlFor="questionsPerDay"
              description={
                <>
                  At this pace, you&apos;ll finish all {TOTAL_QUESTIONS} questions in{' '}
                  {totalDays(TOTAL_QUESTIONS, watchedPerDay)} days.
                </>
              }
            >
              <Controller
                control={control}
                name="questionsPerDay"
                render={({ field }) => (
                  <Select value={String(field.value)} onValueChange={(v) => field.onChange(Number(v))}>
                    <SelectTrigger id="questionsPerDay" aria-label="Questions per day" className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PER_DAY_OPTIONS.map((n) => (
                        <SelectItem key={n} value={String(n)}>
                          {n}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </SettingRow>

            <SettingRow
              label="Daily study capacity"
              htmlFor="dailyCapacityMin"
              description="The Today plan sums its estimates against this budget — it never schedules more for you, it just tells you when the day is overfull."
            >
              <Controller
                control={control}
                name="dailyCapacityMin"
                render={({ field }) => (
                  <Select value={String(field.value)} onValueChange={(v) => field.onChange(Number(v))}>
                    <SelectTrigger id="dailyCapacityMin" aria-label="Daily study capacity" className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CAPACITY_OPTIONS.map((min) => (
                        <SelectItem key={min} value={String(min)}>
                          {min % 60 === 0 ? `${min / 60} hour${min === 60 ? '' : 's'}` : `${Math.floor(min / 60)}h ${min % 60}m`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </SettingRow>

            <SettingRow
              label="Spaced revision"
              htmlFor="revisionEnabled"
              description="Show due revisions on the Today and Revision pages."
            >
              <Controller
                control={control}
                name="revisionEnabled"
                render={({ field }) => (
                  <Switch
                    id="revisionEnabled"
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    aria-label="Spaced revision"
                  />
                )}
              />
            </SettingRow>

            <SettingRow
              label="Dark mode"
              htmlFor="theme"
              description="Applies immediately, no need to save."
            >
              <Switch
                id="theme"
                checked={theme === 'dark'}
                onCheckedChange={toggleTheme}
                aria-label="Dark mode"
              />
            </SettingRow>

            <SettingRow
              label="Notifications"
              htmlFor="notifications"
              description="A browser notification when revisions are due — at most once a day, while the app is open."
            >
              <Controller
                control={control}
                name="notifications"
                render={({ field }) => (
                  <Switch
                    id="notifications"
                    checked={field.value}
                    onCheckedChange={(checked) => {
                      // Ask for browser permission on the enabling gesture itself — the only
                      // moment browsers reliably allow the prompt.
                      if (checked && typeof Notification !== 'undefined' && Notification.permission === 'default') {
                        void Notification.requestPermission();
                      }
                      field.onChange(checked);
                    }}
                    aria-label="Notifications"
                  />
                )}
              />
            </SettingRow>
          </SettingRows>

          <div className="flex justify-end">
            <Button type="button" onClick={handleSave} disabled={!isDirty}>
              Save
            </Button>
          </div>
        </form>
      </Section>

      <Section
        title="Danger Zone"
        support="Export a backup, restore from one, or wipe everything."
        divider
      >
        <SettingRows>
          <SettingRow label="Export progress" description="Download a JSON backup of everything.">
            <Button type="button" variant="outline" onClick={handleExport}>
              Export
            </Button>
          </SettingRow>

          <SettingRow
            label="Import progress"
            description="Restore from a previously exported backup file."
          >
            <Input
              type="file"
              accept="application/json"
              aria-label="Import backup file"
              className="w-auto"
              onChange={handleFileChange}
            />
          </SettingRow>

          <SettingRow label="Reset progress" description="Erase all progress. This cannot be undone.">
            <Button type="button" variant="destructive" onClick={() => setResetDialogOpen(true)}>
              Reset Progress
            </Button>
          </SettingRow>
        </SettingRows>

        {importError && (
          <p role="alert" className="text-sm text-destructive">
            {importError}
          </p>
        )}
      </Section>

      <Dialog open={pendingImport !== null} onOpenChange={(open) => !open && setPendingImport(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import this backup?</DialogTitle>
            <DialogDescription>
              This will replace your current progress with {importSolvedCount} solved, {importCourseSessions} course
              session{importCourseSessions === 1 ? '' : 's'}, {importXp} XP. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPendingImport(null)}>
              Cancel
            </Button>
            <Button type="button" onClick={confirmImport}>
              Import
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={resetDialogOpen} onOpenChange={handleResetDialogChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset all progress?</DialogTitle>
            <DialogDescription>
              This permanently erases every solved question, streak, and revision record. Type RESET to
              confirm.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={resetText}
            onChange={(e) => setResetText(e.target.value)}
            aria-label="Type RESET to confirm"
            autoComplete="off"
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleResetDialogChange(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={resetText !== RESET_CONFIRM_TEXT}
              onClick={confirmReset}
            >
              Yes, reset everything
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Page>
  );
}
