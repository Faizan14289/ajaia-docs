import sanitizeHtml from "sanitize-html";

const ALLOWED_TAGS = [
  "h1",
  "h2",
  "h3",
  "p",
  "br",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "s",
  "del",
  "code",
  "pre",
  "ul",
  "ol",
  "li",
  "blockquote",
  "hr",
  "a",
];

export function sanitizeRichHtml(rawHtml: string): string {
  const cleaned = sanitizeHtml(rawHtml ?? "", {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: {
      a: ["href", "target", "rel"],
    },
    allowedSchemes: ["http", "https", "mailto"],
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", {
        rel: "noopener noreferrer",
        target: "_blank",
      }),
    },
    disallowedTagsMode: "discard",
  }).trim();

  return cleaned.length > 0 ? cleaned : "<p></p>";
}

function decodeBasicEntities(text: string): string {
  return text
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&#x27;/gi, "'");
}

export function extractPlainTextExcerpt(html: string, maxLength = 150): string {
  const spacedHtml = (html ?? "")
    .replace(/<(br|hr)\s*\/?>/gi, " ")
    .replace(/<\/(h[1-6]|p|li|blockquote|div|pre)>/gi, " ");

  const stripped = sanitizeHtml(spacedHtml, {
    allowedTags: [],
    allowedAttributes: {},
  });

  const text = decodeBasicEntities(stripped).replace(/\s+/g, " ").trim();

  if (!text) return "Empty document";
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1).trimEnd()}…`;
}
