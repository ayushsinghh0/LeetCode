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
            className="inline-flex items-center gap-1 rounded border border-border px-1.5 py-0.5 text-xs font-medium text-muted-foreground transition-colors duration-150 ease-swift hover:border-primary/40 hover:text-foreground"
          >
            <Icon className="h-3 w-3 shrink-0" aria-hidden="true" />
            {resource.label}
          </a>
        );
      })}
    </div>
  );
}
