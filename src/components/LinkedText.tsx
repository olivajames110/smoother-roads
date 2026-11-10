import type { ReactNode } from "react";

const URL_RE = /https?:\/\/[^\s<>"]+/g;

// Only for admin comments: the database sets dev, so visitors can't make their links clickable
export function withLinks(text: string) {
  const parts: ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(URL_RE)) {
    const url = m[0].replace(/[.,!?;:)\]'"]+$/, "");
    parts.push(text.slice(last, m.index));
    parts.push(
      <a key={m.index} href={url} target="_blank" rel="noopener">
        {url}
      </a>,
    );
    last = m.index + url.length;
  }
  parts.push(text.slice(last));
  return parts;
}
