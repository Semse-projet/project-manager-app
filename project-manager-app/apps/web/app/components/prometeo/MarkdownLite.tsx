import type { CSSProperties, ReactNode } from "react";
import { parseMarkdown, type Block, type Inline } from "../../../lib/markdown-lite";

function renderInline(parts: Inline[]): ReactNode[] {
  return parts.map((part, index) => {
    switch (part.type) {
      case "bold":
        return <strong key={index}>{part.text}</strong>;
      case "italic":
        return <em key={index}>{part.text}</em>;
      case "code":
        return (
          <code key={index} style={{ padding: "1px 5px", borderRadius: 5, background: "rgba(127,127,127,0.18)", fontSize: "0.92em" }}>
            {part.text}
          </code>
        );
      case "link":
        return (
          <a key={index} href={part.href} target="_blank" rel="noopener noreferrer" style={{ color: "#818cf8", textDecoration: "underline" }}>
            {part.text}
          </a>
        );
      default:
        return <span key={index}>{part.text}</span>;
    }
  });
}

const cell: CSSProperties = { padding: "6px 10px", borderBottom: "1px solid var(--border, rgba(127,127,127,0.25))", textAlign: "left", verticalAlign: "top" };

function renderBlock(block: Block, index: number): ReactNode {
  switch (block.type) {
    case "heading": {
      const size = block.level <= 2 ? 15 : 14;
      return (
        <div key={index} role="heading" aria-level={block.level + 1} style={{ fontWeight: 800, fontSize: size, margin: "10px 0 4px" }}>
          {renderInline(block.inline)}
        </div>
      );
    }
    case "list": {
      const Tag = block.ordered ? "ol" : "ul";
      return (
        <Tag key={index} style={{ margin: "4px 0", paddingLeft: 20, listStyleType: block.ordered ? "decimal" : "disc" }}>
          {block.items.map((item, i) => (
            <li key={i} style={{ margin: "2px 0" }}>
              {renderInline(item)}
            </li>
          ))}
        </Tag>
      );
    }
    case "table":
      return (
        <div key={index} style={{ overflowX: "auto", margin: "8px 0" }}>
          <table style={{ borderCollapse: "collapse", fontSize: "0.95em", minWidth: "60%" }}>
            <thead>
              <tr>
                {block.header.map((h, i) => (
                  <th key={i} style={{ ...cell, fontWeight: 800 }}>
                    {renderInline(h)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, r) => (
                <tr key={r}>
                  {row.map((c, i) => (
                    <td key={i} style={cell}>
                      {renderInline(c)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case "code":
      return (
        <pre key={index} style={{ margin: "8px 0", padding: 10, borderRadius: 8, background: "rgba(127,127,127,0.15)", overflowX: "auto", fontSize: "0.9em", whiteSpace: "pre" }}>
          <code>{block.text}</code>
        </pre>
      );
    case "rule":
      return <hr key={index} style={{ border: 0, borderTop: "1px solid var(--border, rgba(127,127,127,0.3))", margin: "10px 0" }} />;
    default:
      return (
        <p key={index} style={{ margin: "4px 0", lineHeight: 1.55 }}>
          {renderInline(block.inline)}
        </p>
      );
  }
}

/** Respuesta del copiloto con formato (negritas, listas, tablas…), pintada con elementos React: sin `innerHTML`. */
export function MarkdownLite({ text }: { text: string }) {
  return <div>{parseMarkdown(text).map(renderBlock)}</div>;
}
