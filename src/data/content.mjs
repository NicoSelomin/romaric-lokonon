// Chargement du contenu éditable (dossier content/, modifié depuis /admin avec Decap CMS).
import { readFileSync, readdirSync } from 'node:fs';

const dir = new URL('../../content/', import.meta.url);
const json = (f) => JSON.parse(readFileSync(new URL(f, dir), 'utf8'));
const paras = (s = '') => String(s).split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
const file = (p) => String(p).split('/').pop();

/** Œuvres publiées, triées par « ordre » puis par titre. Le nom du fichier sert d'adresse (slug). */
const all = readdirSync(new URL('oeuvres/', dir))
  .filter((f) => f.endsWith('.json'))
  .map((f) => ({ slug: f.replace(/\.json$/, ''), ...json(`oeuvres/${f}`) }))
  .filter((d) => d.published !== false && (d.photos || []).length)
  .sort((a, b) => (a.order ?? 999) - (b.order ?? 999) || a.title_fr.localeCompare(b.title_fr, 'fr'));

export const oeuvres = all.map((d) => ({
  slug: d.slug,
  title: d.title_fr,
  cat: d.category,
  images: d.photos.map(file),
  alt: d.alt_fr || d.title_fr,
  desc: paras(d.description_fr),
  material: d.material_fr || null,
  dims: d.dimensions_fr || null,
  price: d.price ? Number(d.price) : null,
  priceNote: d.price_per_piece ? 'par pièce' : undefined,
  sold: !!d.sold,
}));

export const en = Object.fromEntries(
  all.map((d) => [
    d.slug,
    {
      title: d.title_en || d.title_fr,
      alt: d.alt_en || d.alt_fr || d.title_en || d.title_fr,
      desc: paras(d.description_en || d.description_fr),
      material: d.material_en || d.material_fr || null,
      dims: d.dimensions_en || d.dimensions_fr || null,
    },
  ])
);

export const pages = { accueil: json('accueil.json'), apropos: json('a-propos.json') };
export const faqItems = json('faq.json').items;

// ——— Markdown minimal : paragraphes, ## titres, > citation, **gras**, *italique*, [lien](url)
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
export const inline = (s = '') =>
  esc(String(s))
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/\[(.+?)\]\((https?:\/\/[^\s)]+|\/[^\s)]*)\)/g, '<a href="$2">$1</a>')
    .replace(/\n/g, '<br>');
export const md = (s = '') =>
  paras(s)
    .map((b) =>
      b.startsWith('## ')
        ? `<h2 class="display">${inline(b.slice(3))}</h2>`
        : b.startsWith('> ')
        ? `<blockquote class="quote">${inline(b.replace(/^> ?/gm, ''))}</blockquote>`
        : `<p>${inline(b)}</p>`
    )
    .join('\n');
