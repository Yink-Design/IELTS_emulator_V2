/** Resolve a bundled-asset path against the app's base URL so it works both at
 *  the dev root and under the GitHub Pages subpath. Absolute URLs, data URIs
 *  and in-memory blob URLs are passed through unchanged. */
export function asset(path: string): string {
  if (/^(https?:)?\/\//.test(path) || path.startsWith('data:') || path.startsWith('blob:')) return path
  return import.meta.env.BASE_URL + path.replace(/^\//, '')
}
