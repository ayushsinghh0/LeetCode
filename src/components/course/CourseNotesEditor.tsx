import { MarkdownNotesEditor } from '@/components/shared/MarkdownNotesEditor';
import { useAppDispatch } from '@/store/hooks';
import { saveCourseNotes } from '@/store/actions';

export interface CourseNotesEditorProps {
  weekId: string;
  initialNotes: string;
}

// Thin persistence wrapper over the shared MarkdownNotesEditor — course notes save through
// the saveCourseNotes thunk. Mount with key={weekId} so switching modules resets the form.
export function CourseNotesEditor({ weekId, initialNotes }: CourseNotesEditorProps) {
  const dispatch = useAppDispatch();
  return (
    <MarkdownNotesEditor
      initialNotes={initialNotes}
      placeholder="What stuck from this module? Markdown supported."
      onSave={(notes) => dispatch(saveCourseNotes(weekId, notes))}
    />
  );
}
