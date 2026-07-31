import { useForm } from 'react-hook-form';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { useAppDispatch } from '@/store/hooks';
import { saveCourseNotes } from '@/store/actions';

export interface CourseNotesEditorProps {
  weekId: string;
  initialNotes: string;
}

interface NotesFormValues {
  notes: string;
}

// Mirrors questions/NotesEditor (same write/preview tabs, same autosave-on-blur contract),
// but persists through saveCourseNotes. Mount with key={weekId} so switching modules resets
// the form baseline.
export function CourseNotesEditor({ weekId, initialNotes }: CourseNotesEditorProps) {
  const dispatch = useAppDispatch();
  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { isDirty },
  } = useForm<NotesFormValues>({ defaultValues: { notes: initialNotes } });

  const notes = watch('notes');
  const { onBlur: fieldOnBlur, ...notesField } = register('notes');

  function persist(values: NotesFormValues) {
    dispatch(saveCourseNotes(weekId, values.notes));
    reset({ notes: values.notes }); // re-baseline so isDirty clears (Save disables again)
  }

  return (
    <div className="space-y-2">
      <Tabs defaultValue="write">
        <TabsList>
          <TabsTrigger value="write">Write</TabsTrigger>
          <TabsTrigger value="preview">Preview</TabsTrigger>
        </TabsList>
        <TabsContent value="write">
          <Textarea
            {...notesField}
            onBlur={(e) => {
              fieldOnBlur(e);
              // Same synchronous autosave as questions/NotesEditor — handleSubmit resolves
              // async, which would let blur return before the dispatch ran.
              if (isDirty) {
                persist({ notes });
              }
            }}
            rows={8}
            placeholder="What stuck from this module? Markdown supported."
            aria-label="Notes"
          />
        </TabsContent>
        <TabsContent value="preview">
          <div className="prose prose-sm prose-invert min-h-[8rem] max-w-none rounded-md border border-input p-3">
            {notes.trim() === '' ? (
              <p className="text-muted-foreground">Nothing to preview yet.</p>
            ) : (
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{notes}</ReactMarkdown>
            )}
          </div>
        </TabsContent>
      </Tabs>
      <div className="flex justify-end">
        <Button size="sm" onClick={handleSubmit(persist)} disabled={!isDirty}>
          Save
        </Button>
      </div>
    </div>
  );
}
