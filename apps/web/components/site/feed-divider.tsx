/** Small-caps hairline divider ("— FEED —") used to introduce a post list. Shared by the
 * homepage's featured section and the category page's post list so both stay visually
 * identical. */
export function FeedDivider({ label }: { label: string }) {
  return (
    <div className="mx-auto mt-6 flex max-w-5xl items-center gap-4 px-4 text-xs font-semibold uppercase tracking-widest text-white/40">
      <span className="h-px flex-1 bg-line" />
      <span>{label}</span>
      <span className="h-px flex-1 bg-line" />
    </div>
  );
}
