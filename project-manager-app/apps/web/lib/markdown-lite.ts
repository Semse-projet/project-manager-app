/**
 * Markdown mínimo y SEGURO para las respuestas del copiloto: se parsea a una estructura de datos y el componente
 * la pinta con elementos React (nunca `innerHTML`), así que ningún texto del modelo puede inyectar HTML.
 * Soporta: encabezados (#–####), párrafos, listas con viñetas o numeradas, tablas, regla horizontal, bloques de
 * código y, en línea, **negrita**, *cursiva*, `código` y [texto](https://enlace).
 */

export type Inline =
  | { type: "text"; text: string }
  | { type: "bold"; text: string }
  | { type: "italic"; text: string }
  | { type: "code"; text: string }
  | { type: "link"; text: string; href: string };

export type Block =
  | { type: "heading"; level: 1 | 2 | 3 | 4; inline: Inline[] }
  | { type: "paragraph"; inline: Inline[] }
  | { type: "list"; ordered: boolean; items: Inline[][] }
  | { type: "table"; header: Inline[][]; rows: Inline[][][] }
  | { type: "code"; text: string }
  | { type: "rule" };

const SAFE_URL = /^https?:\/\/[^\s<>"']+$/i;

export function parseInline(source: string): Inline[] {
  const out: Inline[] = [];
  const pattern = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\[[^\]]+\]\([^)\s]+\))|(\*[^*\s][^*]*\*)/g;
  let last = 0;
  for (const match of source.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index > last) out.push({ type: "text", text: source.slice(last, index) });
    const token = match[0];
    if (match[1]) out.push({ type: "code", text: token.slice(1, -1) });
    else if (match[2]) out.push({ type: "bold", text: token.slice(2, -2) });
    else if (match[3]) {
      const split = token.indexOf("](");
      const text = token.slice(1, split);
      const href = token.slice(split + 2, -1);
      // Solo enlaces http(s): `javascript:` y similares se muestran como texto plano.
      out.push(SAFE_URL.test(href) ? { type: "link", text, href } : { type: "text", text: token });
    } else out.push({ type: "italic", text: token.slice(1, -1) });
    last = index + token.length;
  }
  if (last < source.length) out.push({ type: "text", text: source.slice(last) });
  return out;
}

const isTableRow = (line: string) => /^\s*\|.*\|\s*$/.test(line);
const isTableSeparator = (line: string) => /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(line) && line.includes("-");
const splitRow = (line: string) =>
  line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());

export function parseMarkdown(source: string): Block[] {
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  const blocks: Block[] = [];
  let paragraph: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length > 0) blocks.push({ type: "paragraph", inline: parseInline(paragraph.join(" ")) });
    paragraph = [];
  };

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]!;

    if (/^\s*```/.test(line)) {
      flushParagraph();
      const code: string[] = [];
      i += 1;
      while (i < lines.length && !/^\s*```/.test(lines[i]!)) {
        code.push(lines[i]!);
        i += 1;
      }
      blocks.push({ type: "code", text: code.join("\n") });
      continue;
    }

    if (line.trim() === "") {
      flushParagraph();
      continue;
    }

    const heading = /^(#{1,4})\s+(.*)$/.exec(line);
    if (heading) {
      flushParagraph();
      blocks.push({ type: "heading", level: heading[1]!.length as 1 | 2 | 3 | 4, inline: parseInline(heading[2]!.trim()) });
      continue;
    }

    if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      flushParagraph();
      blocks.push({ type: "rule" });
      continue;
    }

    if (isTableRow(line) && i + 1 < lines.length && isTableSeparator(lines[i + 1]!)) {
      flushParagraph();
      const header = splitRow(line).map(parseInline);
      const rows: Inline[][][] = [];
      i += 2;
      while (i < lines.length && isTableRow(lines[i]!)) {
        rows.push(splitRow(lines[i]!).map(parseInline));
        i += 1;
      }
      i -= 1;
      blocks.push({ type: "table", header, rows });
      continue;
    }

    const bullet = /^\s*[-*•]\s+(.*)$/.exec(line);
    const numbered = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    if (bullet || numbered) {
      flushParagraph();
      const ordered = Boolean(numbered);
      const items: Inline[][] = [];
      while (i < lines.length) {
        const current = lines[i]!;
        const match = ordered ? /^\s*\d+[.)]\s+(.*)$/.exec(current) : /^\s*[-*•]\s+(.*)$/.exec(current);
        if (!match) break;
        items.push(parseInline(match[1]!.trim()));
        i += 1;
      }
      i -= 1;
      blocks.push({ type: "list", ordered, items });
      continue;
    }

    paragraph.push(line.trim());
  }
  flushParagraph();
  return blocks;
}
