import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// Split out of MarkdownNotesEditor and loaded lazily: react-markdown drags the whole
// unified/remark tree with it, which belongs in an on-demand chunk, not the initial bundle —
// the preview tab is the only consumer.
export default function MarkdownPreview({ markdown }: { markdown: string }) {
  return <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>;
}
