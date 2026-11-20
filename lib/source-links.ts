export type SourceSegment =
  | { type: "text"; text: string }
  | { type: "link"; text: string; href: string };

const candidatePattern = /https?:\/\/[A-Za-z0-9\-._~:/?#\[\]@!$&()*+,;=%]+/gi;
const sentencePunctuation = /[.,;:!?，。；：！？、]/;
const closers = new Map<string, string>([
  [")", "("],
  ["]", "["],
  ["}", "{"],
  [">", "<"],
  ["》", "《"],
  ["】", "【"],
  ["）", "（"],
  ["」", "「"],
  ["』", "『"],
]);

function peelTrailing(raw: string): { text: string; rest: string } {
  let end = raw.length;
  while (end > 0 && sentencePunctuation.test(raw[end - 1]!)) end -= 1;
  while (end > 0) {
    const closer = raw[end - 1]!;
    const opener = closers.get(closer);
    if (!opener) break;
    const body = raw.slice(0, end - 1);
    const opens = body.split(opener).length - 1;
    const closes = body.split(closer).length - 1;
    if (opens > closes) break;
    end -= 1;
  }
  return { text: raw.slice(0, end), rest: raw.slice(end) };
}

function pushText(segments: SourceSegment[], text: string) {
  if (!text) return;
  const last = segments[segments.length - 1];
  if (last?.type === "text") last.text += text;
  else segments.push({ type: "text", text });
}

function canonicalHttpHref(value: string): string | null {
  if (!/^https?:\/\//i.test(value) || value.length > 2048) return null;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (!url.hostname) return null;
  const href = url.href;
  if (!/^https?:\/\//i.test(href) || /[\s<>"'`\\]/.test(href)) return null;
  return href;
}

export function isSafeLinkHref(href: string): boolean {
  return canonicalHttpHref(href) === href;
}

function toSafeLink(raw: string): { text: string; href: string; rest: string } | null {
  const peeled = peelTrailing(raw);
  const peeledHref = canonicalHttpHref(peeled.text);
  if (peeledHref) return { text: peeled.text, href: peeledHref, rest: peeled.rest };
  const rawHref = canonicalHttpHref(raw);
  if (rawHref) return { text: raw, href: rawHref, rest: "" };
  return null;
}

export function extractSafeSourceLinks(source: string): SourceSegment[] {
  const segments: SourceSegment[] = [];
  let cursor = 0;
  for (const match of source.matchAll(candidatePattern)) {
    const start = match.index ?? 0;
    const raw = match[0];
    const link = toSafeLink(raw);
    if (!link) continue;
    pushText(segments, source.slice(cursor, start));
    segments.push({ type: "link", text: link.text, href: link.href });
    pushText(segments, link.rest);
    cursor = start + raw.length;
  }
  pushText(segments, source.slice(cursor));
  return segments;
}
