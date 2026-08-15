import type { LucideIcon } from 'lucide-react';
import {
  BookOpen,
  ClipboardList,
  FileText,
  FlaskConical,
  Github,
  Link2,
  PenTool,
  Presentation,
  Table2,
  Video,
} from 'lucide-react';
import type { CourseResource, CourseResourceKind } from '@/data/aimlCourse';

const KIND_ICON: Record<CourseResourceKind, LucideIcon> = {
  slides: Presentation,
  colab: FlaskConical,
  excalidraw: PenTool,
  video: Video,
  article: FileText,
  docs: BookOpen,
  github: Github,
  assignment: ClipboardList,
  sheet: Table2,
  link: Link2,
};

// Hairline resource chips that deep-link out (slides, colabs, excalidraws, …). Labels wear
// text tokens, never ink — the icon alone carries the kind.
export function CourseResourceChips({ resources }: { resources: CourseResource[] }) {
  if (resources.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5">
      {resources.map((resource) => {
        const Icon = KIND_ICON[resource.kind];
        return (
          <a
            key={resource.url}
            href={resource.url}
            target="_blank"
            rel="noreferrer"
            // `min-h-6` (24px) is the WCAG 2.5.8 AA floor for a pointer target. At `py-0.5` these
            // chips computed to 22px — two pixels under it — and there are several on every one of
            // the 31 syllabus rows, so it was the most-repeated undersized target in the app. 24px
            // rather than 44px on purpose: these are inline deep-links inside a list row that
            // already offers full-height controls, and 44px here would add ~20px back to every row
            // the line above was merged to save.
            className="inline-flex min-h-6 items-center gap-1 rounded border border-border px-1.5 py-0.5 text-xs font-medium text-muted-foreground transition-colors duration-150 ease-swift hover:border-primary/40 hover:text-foreground"
          >
            <Icon className="h-3 w-3 shrink-0" aria-hidden="true" />
            {resource.label}
          </a>
        );
      })}
    </div>
  );
}
