import { useForm } from 'react-hook-form';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { useAppDispatch } from '@/store/hooks';
import { saveNotes } from '@/store/actions';

export interface NotesEditorProps {
  questionId: number;
  initialNotes: string;
}

interface NotesFormValues {
  notes: string;
}

export function NotesEditor({ questionId, initialNotes }: NotesEditorProps) {
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
    dispatch(saveNotes(questionId, values.notes));
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
            placeholder="Write markdown notes... (supports tables, code blocks, links, images)"
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
