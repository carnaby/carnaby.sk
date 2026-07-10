import { renderMarkdown } from '../post/markdown';

export interface MarkdownPreviewProps {
  markdown: string;
}

/**
 * Live preview pane for `<PostEditor>` (Task 21): renders the ACTIVE language tab's markdown
 * through the exact same `marked` + DOMPurify pipeline as the public post page (`renderMarkdown`
 * in `components/post/markdown.tsx`), styled by the same `.prose-glass` block — what an editor
 * sees here is what a visitor will see.
 */
export function MarkdownPreview({ markdown }: MarkdownPreviewProps) {
  if (markdown.trim() === '') {
    return <p className="text-sm text-white/40">Náhľad sa zobrazí po zadaní obsahu.</p>;
  }

  // `markdown` is authored by a signed-in admin (same trust boundary as the public post body),
  // and `renderMarkdown` still sanitizes it before it reaches `dangerouslySetInnerHTML`.
  return <div className="prose-glass" dangerouslySetInnerHTML={{ __html: renderMarkdown(markdown) }} />;
}
