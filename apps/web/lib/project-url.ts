/** Short label for a project link: host (with port, if any) without a leading "www.". */
export function projectHost(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, '');
  } catch {
    return url;
  }
}
