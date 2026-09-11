/**
 * Minimal Markdown renderer for the code-generated report (headings, lists,
 * tables, blockquotes, bold, hr, paragraphs). No external dependency, no HTML
 * passthrough.
 */
import type { ReactNode } from "react";

function inline(text: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) =>
    p.startsWith("**") && p.endsWith("**") ? <strong key={i}>{p.slice(2, -2)}</strong> : <span key={i}>{p}</span>,
  );
}

export function ReportMarkdown({ markdown }: { markdown: string }) {
  const lines = markdown.split("\n");
  const out: ReactNode[] = [];
  let i = 0;
  let key = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
      continue;
    }
    if (line.startsWith("# ")) {
      out.push(<h2 key={key++} className="mt-2 text-xl font-bold">{inline(line.slice(2))}</h2>);
      i++;
    } else if (line.startsWith("## ")) {
      out.push(<h3 key={key++} className="mt-5 text-lg font-bold">{inline(line.slice(3))}</h3>);
      i++;
    } else if (line.startsWith("### ")) {
      out.push(<h4 key={key++} className="mt-3 font-bold">{inline(line.slice(4))}</h4>);
      i++;
    } else if (line.startsWith("> ")) {
      out.push(
        <blockquote key={key++} className="my-2 border-l-4 border-accent pl-3 text-muted">
          {inline(line.slice(2))}
        </blockquote>,
      );
      i++;
    } else if (line.trim() === "---") {
      out.push(<hr key={key++} className="my-4 border-border" />);
      i++;
    } else if (line.startsWith("- ")) {
      const items: string[] = [];
      while (i < lines.length && lines[i].startsWith("- ")) items.push(lines[i++].slice(2));
      out.push(
        <ul key={key++} className="my-1 list-disc space-y-0.5 pl-5">
          {items.map((it, j) => (
            <li key={j}>{inline(it)}</li>
          ))}
        </ul>,
      );
    } else if (line.startsWith("|")) {
      const rows: string[] = [];
      while (i < lines.length && lines[i].startsWith("|")) rows.push(lines[i++]);
      const cells = (r: string) => r.split("|").slice(1, -1).map((c) => c.trim());
      const header = cells(rows[0]);
      const body = rows.slice(2).map(cells);
      out.push(
        <div key={key++} className="my-2 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted">
              <tr>
                {header.map((h, j) => (
                  <th key={j} className="py-1 pr-2 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {body.map((r, j) => (
                <tr key={j} className="border-t border-border">
                  {r.map((c, k) => (
                    <td key={k} className="py-1 pr-2">
                      {inline(c)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
    } else {
      out.push(<p key={key++} className="my-1">{inline(line)}</p>);
      i++;
    }
  }
  return <div className="text-sm leading-relaxed">{out}</div>;
}
