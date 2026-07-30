import { escapeHtml } from '../../utils/sanitize.js';

const variants = [44, 88, 112, 224];
const srcset = (extension) => variants
  .map((size) => `/assets/wild-evolution-emblem-${size}.${extension} ${size}w`)
  .join(', ');

export function brandEmblemPicture({
  alt = 'Wild Evolution emblem',
  width = 44,
  height = width,
  sizes = `${width}px`,
  eager = false,
  className = '',
} = {}) {
  return `<picture class="brand-emblem ${escapeHtml(className)}">
    <source type="image/avif" srcset="${srcset('avif')}" sizes="${escapeHtml(sizes)}" />
    <source type="image/webp" srcset="${srcset('webp')}" sizes="${escapeHtml(sizes)}" />
    <img src="/assets/wild-evolution-emblem-112.webp" width="${width}" height="${height}" alt="${escapeHtml(alt)}" decoding="async" loading="${eager ? 'eager' : 'lazy'}" />
  </picture>`;
}
