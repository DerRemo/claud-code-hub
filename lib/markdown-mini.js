// Tiny Markdown subset renderer. Supports: ## h3, ### h4, **bold**, *italic*,
// _italic_, `inline code`, [text](url) links, - / * unordered lists,
// blank-line-separated paragraphs. All plain-text content is HTML-escaped.
// Links render with target="_blank" rel="noopener". Designed for GitHub
// Release bodies rendered client-side in the Settings About panel.

export function renderMarkdownMini(src) {
  if (!src || typeof src !== 'string') return '';
  const lines = src.replace(/\r\n?/g, '\n').split('\n');

  // Group lines into blocks: headings, list items, paragraphs, blanks.
  const blocks = [];
  let buffer = [];
  let mode = null; // 'para' | 'ul' | null

  const flushBuffer = () => {
    if (buffer.length === 0) return;
    if (mode === 'ul') {
      const items = buffer.map(line => line.replace(/^[-*]\s+/, ''));
      blocks.push({ kind: 'ul', items });
    } else if (mode === 'para') {
      blocks.push({ kind: 'para', text: buffer.join('\n') });
    }
    buffer = [];
    mode = null;
  };

  for (const raw of lines) {
    const line = raw;
    const h3 = line.match(/^###\s+(.*)$/);
    const h2 = line.match(/^##\s+(.*)$/);
    const li = line.match(/^[-*]\s+.+$/);
    const blank = /^\s*$/.test(line);

    if (h3) { flushBuffer(); blocks.push({ kind: 'h4', text: h3[1] }); continue; }
    if (h2) { flushBuffer(); blocks.push({ kind: 'h3', text: h2[1] }); continue; }
    if (li) {
      if (mode !== 'ul') flushBuffer();
      mode = 'ul';
      buffer.push(line);
      continue;
    }
    if (blank) { flushBuffer(); continue; }
    if (mode !== 'para') flushBuffer();
    mode = 'para';
    buffer.push(line);
  }
  flushBuffer();

  return blocks.map(renderBlock).join('\n');
}

function escapeHtml(s) {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function renderInline(text) {
  // Split out inline-code first so other replacements don't touch its contents.
  const parts = [];
  let rest = text;
  const codeRe = /`([^`]+)`/;
  let m;
  while ((m = rest.match(codeRe))) {
    const before = rest.slice(0, m.index);
    parts.push({ type: 'text', value: before });
    parts.push({ type: 'code', value: m[1] });
    rest = rest.slice(m.index + m[0].length);
  }
  parts.push({ type: 'text', value: rest });

  return parts.map(p => {
    if (p.type === 'code') return `<code>${escapeHtml(p.value)}</code>`;
    let s = escapeHtml(p.value);
    // Links [text](url) — escape URL too so quotes can't break out
    s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label, url) =>
      `<a href="${escapeHtml(url)}" target="_blank" rel="noopener">${label}</a>`);
    // Bold **text** (match before italic so ** doesn't collapse to *)
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    // Italic *text* and _text_
    s = s.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>');
    s = s.replace(/(^|[^_])_([^_\n]+)_(?!_)/g, '$1<em>$2</em>');
    return s;
  }).join('');
}

function renderBlock(b) {
  switch (b.kind) {
    case 'h3': return `<h3>${renderInline(b.text)}</h3>`;
    case 'h4': return `<h4>${renderInline(b.text)}</h4>`;
    case 'ul': return `<ul>${b.items.map(i => `<li>${renderInline(i)}</li>`).join('')}</ul>`;
    case 'para': return `<p>${renderInline(b.text).replace(/\n/g, '<br>')}</p>`;
    default: return '';
  }
}
