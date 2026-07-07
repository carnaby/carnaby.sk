import DOMPurify from 'isomorphic-dompurify';
import { marked } from 'marked';

// GFM (tables, strikethrough, autolinked URLs, task lists) is what v1's posts were authored
// against (git show carnaby-sk-origin:config/markdown.js) -- keep parity so ported content
// renders the same way.
marked.setOptions({ gfm: true });

/**
 * Post content is trusted-author markdown (only admins can write it — see
 * `apps/api/src/posts/routers.ts`'s `adminProcedure`-gated `create`/`update`), but it's still
 * rendered as raw HTML on a public page, so it's sanitized regardless: a compromised/malicious
 * admin session, or a future import path that isn't as trusted, shouldn't be able to inject a
 * `<script>` or an `onerror` handler into every visitor's browser.
 */
export function renderMarkdown(markdown: string): string {
  const html = marked.parse(markdown, { async: false }) as string;
  return DOMPurify.sanitize(html);
}

export interface PostBodyProps {
  markdown: string;
}

/** Renders sanitized post markdown as HTML, styled by the `.prose-glass` block in
 * `app/globals.css` (headings use `font-display`, code/pre use `font-mono`, links get the
 * accent underline — Tailwind v4 has no official typography plugin yet, so this is hand-rolled
 * rather than pulled in as a dependency). */
export function PostBody({ markdown }: PostBodyProps) {
  // Content is sanitized by renderMarkdown above before it ever reaches dangerouslySetInnerHTML.
  return <div className="prose-glass" dangerouslySetInnerHTML={{ __html: renderMarkdown(markdown) }} />;
}
