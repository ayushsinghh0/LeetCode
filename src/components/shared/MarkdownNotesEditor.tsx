import { useForm } from 'react-hook-form';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';

export interface MarkdownNotesEditorProps {
  initialNotes: string;
  placeholder: string;
  onSave: (notes: string) => void;
}

interface NotesFormValues {
  notes: string;
}

// The one markdown notes editor (write/preview tabs, autosave-on-blur, explicit Save).
// questions/NotesEditor and course/CourseNotesEditor are thin wrappers that supply the
// persistence dispatch — mount with a key (question id / week id) so switching subjects
// resets the form baseline.
export function MarkdownNotesEditor({ initialNotes, placeholder, onSave }: MarkdownNotesEditorProps) {
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
    onSave(values.notes);
    // Re-baseline defaultValues to what was just saved so isDirty clears (Save disables again).
    reset({ notes: values.notes });
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
              // Autosave synchronously off the live watch()'d value — deliberately bypassing
              // handleSubmit here (it always resolves async, even with no resolver/validation),
              // which would let the blur handler return before the dispatch actually ran.
              if (isDirty) {
                persist({ notes });
              }
            }}
            rows={8}
            placeholder={placeholder}
            aria-label="Notes"
          />
        </TabsContent>
        <TabsContent value="preview">
          {/* Theme-aware prose colors come from tailwind.config's typography override — no
              prose-invert, which would hardcode dark-theme grays into the light theme. */}
          <div className="prose prose-sm min-h-[8rem] max-w-none rounded-md border border-input p-3">
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
