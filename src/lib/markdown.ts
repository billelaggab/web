/**
 * عارض Markdown مصغّر وآمن: يهرّب كل HTML أولاً (حصانة XSS) ثم يطبّق تنسيقات محدودة.
 * لا يُسمح بأي وسوم أو سمات أو روابط خطرة (javascript:, data:).
 */

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function safeHref(raw: string): string | null {
  const url = raw.trim();
  if (/^(https?:\/\/|mailto:)/i.test(url)) return url;
  return null;
}

function inline(text: string): string {
  let out = escapeHtml(text);
  out = out.replace(/`([^`]+)`/g, '<code class="bg-body-secondary px-1 rounded">$1</code>');
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/(^|[\s(])\*([^*]+)\*/g, "$1<em>$2</em>");
  out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, label: string, href: string) => {
    const safe = safeHref(href);
    return safe
      ? `<a href="${safe}" rel="noreferrer noopener" target="_blank">${label}</a>`
      : `<span>${label} <small class="text-body-secondary">(${escapeHtml(href)})</small></span>`;
  });
  return out;
}

/** يحوّل نص Markdown إلى HTML آمن. كل المدخلات تُهرَّب قبل أي تنسيق. */
export function renderMarkdown(source: string): string {
  if (!source) return "";
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const html: string[] = [];
  let listOpen = false;

  const closeList = () => {
    if (listOpen) {
      html.push("</ul>");
      listOpen = false;
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (!line.trim()) {
      closeList();
      continue;
    }
    const heading = line.match(/^(#{1,4})\s+(.*)$/);
    if (heading) {
      closeList();
      const level = Math.min(heading[1].length + 2, 6);
      html.push(
        `<h${level} class="mt-3 mb-2 fs-6 fw-semibold">${inline(heading[2])}</h${level}>`,
      );
      continue;
    }
    if (/^([-*___])\1{2,}$/.test(line.trim())) {
      closeList();
      html.push('<hr class="my-3" />');
      continue;
    }
    const quote = line.match(/^>\s?(.*)$/);
    if (quote) {
      closeList();
      html.push(
        `<blockquote class="blockquote border-end ps-3 my-2 text-body-secondary">${inline(quote[1])}</blockquote>`,
      );
      continue;
    }
    const bullet = line.match(/^\s*[-*+]\s+(.*)$/);
    if (bullet) {
      if (!listOpen) {
        html.push('<ul class="mb-2">');
        listOpen = true;
      }
      html.push(`<li>${inline(bullet[1])}</li>`);
      continue;
    }
    closeList();
    html.push(`<p class="mb-2">${inline(line)}</p>`);
  }
  closeList();
  return html.join("\n");
}

/** نص عادي آمن لعرضه داخل HTML (يُستخدم في قوالب الملف المطبوع) */
export function escapeText(input: string | null | undefined): string {
  return escapeHtml(input ?? "");
}
