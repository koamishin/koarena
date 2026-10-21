/**
 * Turn a name into a URL-safe slug.
 *
 * Pure and client-safe, so the wizard can preview a slug without a round trip.
 */
export function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}
