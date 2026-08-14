import { useState } from 'react';
import { X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAppDispatch, useAppSelector, useAppStore } from '@/store/hooks';
import { setIntentions } from '@/store/actions';
import { MAX_INTENTIONS, PRACTICE_ACTIONS } from '@/utils/engine/practice';

interface Row {
  cue: string;
  action: string;
}

/**
 * Author up to MAX_INTENTIONS implementation intentions — "After [cue], I will [action]".
 *
 * The whole feature is autonomy: the app SUGGESTS a structure, the learner chooses whether to use
 * it, and nothing here is tracked or scored (design record feature B, copy rules § 4). The cue is
 * free text (a routine the learner already has); the action is a real app action from the shared
 * PRACTICE_ACTIONS registry, so the Today rail can deep-link it. The Save thunk normalizes the
 * whole list (blank cues and unknown actions dropped, capped), so this editor stays a plain draft.
 *
 * Its own <form> (never nested in SettingsPage's) lets the Radix Select render its native fallback
 * for form/autofill/test compatibility, matching the rest of the Settings page.
 */
export function IntentionsEditor() {
  const dispatch = useAppDispatch();
  const store = useAppStore();
  const saved = useAppSelector((s) => s.practice.intentions);
  const [rows, setRows] = useState<Row[]>(saved.map((i) => ({ cue: i.cue, action: i.action })));
  const [justSaved, setJustSaved] = useState(false);

  function addRow() {
    if (rows.length >= MAX_INTENTIONS) return;
    setRows((r) => [...r, { cue: '', action: '' }]);
    setJustSaved(false);
  }
  function updateRow(index: number, patch: Partial<Row>) {
    setRows((r) => r.map((row, i) => (i === index ? { ...row, ...patch } : row)));
    setJustSaved(false);
  }
  function removeRow(index: number) {
    setRows((r) => r.filter((_, i) => i !== index));
    setJustSaved(false);
  }
  function save() {
    dispatch(setIntentions(rows));
    // Re-seed from the normalized result so the editor shows exactly what persisted (blank/invalid
    // rows the thunk dropped disappear). Thunks resolve synchronously, so the store is current.
    setRows(store.getState().practice.intentions.map((i) => ({ cue: i.cue, action: i.action })));
    setJustSaved(true);
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="max-w-prose text-sm text-muted-foreground">
        Optional. Pair a routine you already have with a practice action — the app quietly reminds
        you of it on Today, and never tracks whether you followed through. Up to {MAX_INTENTIONS}.
      </p>

      <form onSubmit={(e) => e.preventDefault()} className="flex flex-col gap-3">
        {rows.map((row, i) => (
          <div key={i} className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground">After</span>
            <Input
              aria-label={`Intention ${i + 1} cue`}
              value={row.cue}
              onChange={(e) => updateRow(i, { cue: e.target.value })}
              placeholder="my morning coffee"
              className="w-44"
            />
            <span className="text-sm text-muted-foreground">, I will</span>
            {/* Controlled with '' (never undefined) throughout, so the native fallback never
                flips uncontrolled→controlled; '' matches no item, so the placeholder shows. */}
            <Select value={row.action} onValueChange={(v) => updateRow(i, { action: v })}>
              <SelectTrigger aria-label={`Intention ${i + 1} action`} className="w-56">
                <SelectValue placeholder="choose an action" />
              </SelectTrigger>
              <SelectContent>
                {PRACTICE_ACTIONS.map((a) => (
                  <SelectItem key={a.key} value={a.key}>
                    {a.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`Remove intention ${i + 1}`}
              onClick={() => removeRow(i)}
            >
              <X />
            </Button>
          </div>
        ))}

        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addRow}
            disabled={rows.length >= MAX_INTENTIONS}
          >
            Add an intention
          </Button>
          <Button type="button" size="sm" onClick={save}>
            Save intentions
          </Button>
          {justSaved && <span className="text-xs text-muted-foreground">Saved.</span>}
        </div>
      </form>
    </div>
  );
}
