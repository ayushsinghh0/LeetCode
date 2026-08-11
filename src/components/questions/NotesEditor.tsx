import { MarkdownNotesEditor } from '@/components/shared/MarkdownNotesEditor';
import { useAppDispatch } from '@/store/hooks';
import { saveNotes } from '@/store/actions';

export interface NotesEditorProps {
  questionId: number;
  initialNotes: string;
}

// Thin persistence wrapper over the shared MarkdownNotesEditor — question notes save through
// the saveNotes thunk. Mount with key={questionId} so switching questions resets the form.
export function NotesEditor({ questionId, initialNotes }: NotesEditorProps) {
  const dispatch = useAppDispatch();
  return (
    <MarkdownNotesEditor
      initialNotes={initialNotes}
      placeholder="Write markdown notes... (supports tables, code blocks, links, images)"
      onSave={(notes) => dispatch(saveNotes(questionId, notes))}
    />
  );
}
