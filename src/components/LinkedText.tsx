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

// Admin notes: **bold**, __underline__ and links (line breaks are kept by the .notes style).
// Built as React elements, never as HTML, so nothing typed can inject markup.
const FORMAT_RE = /\*\*([^*\n]+)\*\*|__([^_\n]+)__|(https?:\/\/[^\s<>"]+)/g;

export function formatNotes(text: string) {
  const parts: ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(FORMAT_RE)) {
    let whole = m[0];
    let node: ReactNode;
    if (m[1] !== undefined) node = <strong key={m.index}>{m[1]}</strong>;
    else if (m[2] !== undefined) node = <u key={m.index}>{m[2]}</u>;
    else {
      whole = m[3].replace(/[.,!?;:)\]'"]+$/, "");
      node = (
        <a key={m.index} href={whole} target="_blank" rel="noopener">
          {whole}
        </a>
      );
    }
    parts.push(text.slice(last, m.index), node);
    last = m.index + whole.length;
  }
  parts.push(text.slice(last));
  return parts;
}
