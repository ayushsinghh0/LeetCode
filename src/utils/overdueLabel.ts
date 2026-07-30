// Shared "N day(s) overdue" formatter — used by both TodayPage and RevisionPage's revision-due
// badges so the pluralization is consistent everywhere a nextRevision-vs-today gap is shown.
export function overdueLabel(days: number): string {
  return `${days} day${days === 1 ? '' : 's'} overdue`;
}
