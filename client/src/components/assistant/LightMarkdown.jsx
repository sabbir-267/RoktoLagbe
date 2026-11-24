import { Link } from "react-router-dom";

// Renders the assistant's light markdown as React elements (never as HTML):
//   **bold**, "- " bullet lines, blank line = new paragraph, [label](/internal/path)
// Links become router <Link>s only for same-site paths ("/x", not "//x"); anything else is plain text.

const INLINE = /(\*\*[^*\n]+\*\*|\[[^\]\n]+\]\([^)\s]+\))/g;
const LINK = /^\[([^\]\n]+)\]\(([^)\s]+)\)$/;

const isInternal = (href) => href.startsWith("/") && !href.startsWith("//") && !href.startsWith("/\\");

function inline(text, keyPrefix, onNavigate) {
  return text.split(INLINE).map((part, i) => {
    const key = `${keyPrefix}-${i}`;
    if (!part) return null;
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return <strong key={key} className="font-semibold">{part.slice(2, -2)}</strong>;
    }
    const link = part.match(LINK);
    if (link) {
      const [, label, href] = link;
      if (!isInternal(href)) return <span key={key}>{label}</span>;
      return (
        <Link key={key} to={href} onClick={onNavigate} className="font-semibold text-brand-blue underline underline-offset-2 hover:text-brand-blue-dark">
          {label}
        </Link>
      );
    }
    return <span key={key}>{part}</span>;
  });
}

export default function LightMarkdown({ text, onNavigate }) {
  const paragraphs = String(text || "")
    .replace(/\r\n?/g, "\n")
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  return (
    <div className="space-y-2">
      {paragraphs.map((para, pi) => {
        // Group consecutive bullet lines into one list, other lines into text runs
        const blocks = [];
        para.split("\n").forEach((raw) => {
          const line = raw.trim();
          const bullet = /^[-*•]\s+/.test(line);
          const content = bullet ? line.replace(/^[-*•]\s+/, "") : line;
          const last = blocks[blocks.length - 1];
          if (last && last.bullet === bullet) last.lines.push(content);
          else blocks.push({ bullet, lines: [content] });
        });

        return (
          <div key={pi} className="space-y-1">
            {blocks.map((b, bi) =>
              b.bullet ? (
                <ul key={bi} className="list-disc space-y-0.5 pl-5">
                  {b.lines.map((l, li) => (
                    <li key={li}>{inline(l, `${pi}-${bi}-${li}`, onNavigate)}</li>
                  ))}
                </ul>
              ) : (
                <p key={bi} className="break-words">
                  {b.lines.map((l, li) => (
                    <span key={li}>
                      {li > 0 && <br />}
                      {inline(l, `${pi}-${bi}-${li}`, onNavigate)}
                    </span>
                  ))}
                </p>
              )
            )}
          </div>
        );
      })}
    </div>
  );
}
