import { useState, type ChangeEvent } from 'react';
import { Controller, useForm } from 'react-hook-form';
import questionsData from '@/data/questions.json';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
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
import { settingsUpdated } from '@/store/slices/settingsSlice';
import { importProgress, resetProgress } from '@/store/actions';
import { useTheme } from '@/contexts/ThemeContext';
import { exportAsJson, validatePersisted } from '@/services/storage/serialize';
import { totalDays } from '@/utils/engine/roadmap';
import { todayISO } from '@/utils/dates';
import type { PersistedStateV1, Question } from '@/types';

const TOTAL_QUESTIONS = (questionsData as Question[]).length;
const PER_DAY_OPTIONS = Array.from({ length: 13 }, (_, i) => i + 4); // 4..16
const RESET_CONFIRM_TEXT = 'RESET';

interface SettingsFormValues {
  questionsPerDay: number;
  revisionEnabled: boolean;
  notifications: boolean;
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
    },
  });

  const watchedPerDay = watch('questionsPerDay');

  // Deliberately bypasses react-hook-form's handleSubmit — it always resolves asynchronously
  // (even with no resolver/validation configured, mirroring the reasoning documented on
  // NotesEditor's autosave-on-blur handler), and this Save button has no validation to run
  // before committing. getValues()/reset() give the same result synchronously.
  function handleSave() {
    const values = getValues();
    dispatch(settingsUpdated(values));
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
    <div className="flex flex-col gap-6">
      <header className="glass p-6">
        <h1 className="text-2xl font-bold text-gradient">Settings</h1>
      </header>

      {/* A real <form> ancestor (even with no onSubmit wired to it) matters here: Radix Select
          only renders its visually-hidden native <select> fallback — used for native form/
          autofill compatibility, and by this app's tests to drive perDay changes without needing
          jsdom to support the visual popper listbox's ResizeObserver/scrollIntoView APIs — when
          it detects a form ancestor (or an explicit `form` prop). Save stays a plain button that
          calls handleSave() directly, so this onSubmit is just a safety net against an accidental
          native submit (e.g. Enter inside a future text field). */}
      <form onSubmit={(e) => e.preventDefault()}>
        <Card>
          <CardHeader>
            <CardTitle>Preferences</CardTitle>
            <CardDescription>Tune your daily pace and revision behavior.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <Label htmlFor="questionsPerDay">Questions per day</Label>
              <Controller
                control={control}
                name="questionsPerDay"
                render={({ field }) => (
                  <Select value={String(field.value)} onValueChange={(v) => field.onChange(Number(v))}>
                    <SelectTrigger id="questionsPerDay" aria-label="Questions per day" className="w-32">
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
              <p className="text-sm text-muted-foreground">
                At this pace, you&apos;ll finish all {TOTAL_QUESTIONS} questions in{' '}
                {totalDays(TOTAL_QUESTIONS, watchedPerDay)} days.
              </p>
            </div>

            <div className="flex items-center justify-between gap-4">
              <div>
                <Label htmlFor="revisionEnabled">Spaced revision</Label>
                <p className="text-sm text-muted-foreground">
                  Show due revisions on the Today and Revision pages.
                </p>
              </div>
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
            </div>

            <div className="flex items-center justify-between gap-4">
              <div>
                <Label htmlFor="theme">Dark mode</Label>
                <p className="text-sm text-muted-foreground">Applies immediately, no need to save.</p>
              </div>
              <Switch
                id="theme"
                checked={theme === 'dark'}
                onCheckedChange={toggleTheme}
                aria-label="Dark mode"
              />
            </div>

            <div className="flex items-center justify-between gap-4">
              <div>
                <Label htmlFor="notifications">Notifications</Label>
                <p className="text-sm text-muted-foreground">
                  A browser notification when revisions are due — at most once a day, while the app is open.
                </p>
              </div>
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
            </div>
          </CardContent>
          <CardFooter className="justify-end">
            <Button type="button" onClick={handleSave} disabled={!isDirty}>
              Save
            </Button>
          </CardFooter>
        </Card>
      </form>

      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle>Danger Zone</CardTitle>
          <CardDescription>Export a backup, restore from one, or wipe everything.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="font-medium">Export progress</p>
              <p className="text-sm text-muted-foreground">Download a JSON backup of everything.</p>
            </div>
            <Button type="button" variant="outline" onClick={handleExport}>
              Export
            </Button>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="font-medium">Import progress</p>
              <p className="text-sm text-muted-foreground">Restore from a previously exported backup file.</p>
            </div>
            <Input
              type="file"
              accept="application/json"
              aria-label="Import backup file"
              className="w-auto"
              onChange={handleFileChange}
            />
          </div>
          {importError && (
            <p role="alert" className="text-sm text-destructive">
              {importError}
            </p>
          )}

          <div className="flex flex-wrap items-center justify-between gap-4 border-t pt-4">
            <div>
              <p className="font-medium">Reset progress</p>
              <p className="text-sm text-muted-foreground">Erase all progress. This cannot be undone.</p>
            </div>
            <Button type="button" variant="destructive" onClick={() => setResetDialogOpen(true)}>
              Reset Progress
            </Button>
          </div>
        </CardContent>
      </Card>

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
    </div>
  );
}
