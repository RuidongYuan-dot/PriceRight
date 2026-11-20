/**
 * URL for a file in `public/`. `next/image` needs `basePath` included in `src`.
 */
export function publicAssetPath(path: string): string {
  const suffix = path.startsWith("/") ? path : `/${path}`;
  const base = (process.env.NEXT_PUBLIC_BASE_PATH ?? "").trim().replace(/\/$/, "");
  return `${base}${suffix}`;
}
