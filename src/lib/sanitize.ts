const ALLOWED_TAGS = new Set([
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
]);

const VOID_TAGS = new Set(["br", "hr"]);

const DROP_CONTENT_TAGS = new Set([
  "script",
  "style",
  "iframe",
  "object",
  "embed",
  "svg",
  "math",
  "noscript",
  "template",
]);

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
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

function extractSafeHref(attrString: string): string | null {
  const match = attrString.match(
    /\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/i
  );
  if (!match) return null;
  const raw = decodeBasicEntities((match[1] ?? match[2] ?? match[3] ?? "").trim());
  if (!raw) return null;

  // Strip control characters and whitespace before checking protocol
  const normalized = raw.replace(/[\u0000-\u001f\u007f\s]+/g, "").toLowerCase();
  if (
    normalized.startsWith("https://") ||
    normalized.startsWith("http://") ||
    normalized.startsWith("mailto:")
  ) {
    return raw;
  }
  return null;
}

export function sanitizeRichHtml(rawHtml: string): string {
  if (!rawHtml || typeof rawHtml !== "string") return "<p></p>";

  // Remove HTML comments first
  const withoutComments = rawHtml.replace(/<!--[\s\S]*?-->/g, "");

  // Tokenize HTML into tags and text nodes
  const tokenRegex = /<\/?([a-zA-Z][a-zA-Z0-9:-]*)(\s[^<>]*)?\/?>|[^<]+|</g;
  const output: string[] = [];
  const dropStack: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = tokenRegex.exec(withoutComments)) !== null) {
    const token = match[0];
    const tagNameRaw = match[1];
    const attrPart = match[2] ?? "";

    // Plain text or stray '<'
    if (!tagNameRaw) {
      if (dropStack.length === 0) {
        output.push(token === "<" ? "&lt;" : token);
      }
      continue;
    }

    const tagName = tagNameRaw.toLowerCase();
    const isClosing = token.startsWith("</");
    const isSelfClosing = token.endsWith("/>") || VOID_TAGS.has(tagName);

    if (DROP_CONTENT_TAGS.has(tagName)) {
      if (isClosing) {
        const idx = dropStack.lastIndexOf(tagName);
        if (idx !== -1) dropStack.splice(idx, 1);
      } else if (!isSelfClosing) {
        dropStack.push(tagName);
      }
      continue;
    }

    if (dropStack.length > 0) {
      continue;
    }

    if (!ALLOWED_TAGS.has(tagName)) {
      continue;
    }

    if (isClosing) {
      if (!VOID_TAGS.has(tagName)) {
        output.push(`</${tagName}>`);
      }
      continue;
    }

    if (VOID_TAGS.has(tagName)) {
      output.push(`<${tagName} />`);
      continue;
    }

    if (tagName === "a") {
      const safeHref = extractSafeHref(attrPart);
      if (safeHref) {
        output.push(
          `<a href="${escapeAttr(safeHref)}" target="_blank" rel="noopener noreferrer">`
        );
      } else {
        output.push("<a>");
      }
      continue;
    }

    output.push(`<${tagName}>`);
  }

  const cleaned = output.join("").trim();
  return cleaned.length > 0 ? cleaned : "<p></p>";
}

export function extractPlainTextExcerpt(html: string, maxLength = 150): string {
  const safeHtml = sanitizeRichHtml(html ?? "");
  const spaced = safeHtml
    .replace(/<(br|hr)\s*\/?>/gi, " ")
    .replace(/<\/(h[1-6]|p|li|blockquote|div|pre)>/gi, " ")
    .replace(/<[^>]+>/g, "");

  const text = decodeBasicEntities(spaced).replace(/\s+/g, " ").trim();

  if (!text) return "Empty document";
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1).trimEnd()}…`;
}
