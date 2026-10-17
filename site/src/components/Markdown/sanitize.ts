import DOMPurify from 'dompurify';
import { marked } from 'marked';

const ABSOLUTE = /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i;

function rewrite(value: string, baseUrl: string | null): string | null {
  if (ABSOLUTE.test(value)) return value;
  if (!baseUrl) return value.startsWith('#') ? null : value;
  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return null;
  }
}

export function renderMarkdown(source: string, baseUrl: string | null): string {
  const html = marked.parse(source, { async: false, gfm: true });
  const fragment = DOMPurify.sanitize(html, { RETURN_DOM_FRAGMENT: true });
  for (const link of fragment.querySelectorAll('a[href]')) {
    const href = rewrite(link.getAttribute('href') ?? '', baseUrl);
    if (href === null) link.removeAttribute('href');
    else link.setAttribute('href', href);
    if (href && /^https?:/i.test(href)) {
      link.setAttribute('target', '_blank');
      link.setAttribute('rel', 'noopener noreferrer');
    }
  }
  for (const img of fragment.querySelectorAll('img[src]')) {
    const src = rewrite(img.getAttribute('src') ?? '', baseUrl ? baseUrl.replace('/blob/', '/raw/') : null);
    if (src === null) img.removeAttribute('src');
    else img.setAttribute('src', src);
  }
  const container = document.createElement('div');
  container.appendChild(fragment);
  return container.innerHTML;
}
