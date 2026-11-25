#!/usr/bin/env node
// Générateur statique bilingue (FR / EN) du site de Romaric Lokonon — aucune dépendance npm.
// Usage : node build.mjs   →   produit le dossier dist/ prêt à être hébergé.
import { mkdirSync, writeFileSync, rmSync, cpSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { site, langs, text, routes, navLabels, categories, parcours } from './src/data/site.mjs';
import { oeuvres, en as oeuvresEn, pages, faqItems, md, inline } from './src/data/content.mjs';

const ROOT = dirname(fileURLToPath(import.meta.url));
const DIST = join(ROOT, 'dist');
const CACHE = join(ROOT, '.cache');
const IMG_DIR = join(CACHE, 'img'); // cache persistant des images optimisées
const BUILD_DATE = new Date().toISOString().slice(0, 10);
const VERSION = Date.now().toString(36);

// ————————————————————————————————————————— langue courante
let LANG = 'fr';
const T = (fr, en) => (LANG === 'en' ? en : fr);
const R = () => routes[LANG];
const workUrl = (o, lang = LANG) => (lang === 'en' ? `/en/works/${o.slug}/` : `/oeuvres/${o.slug}/`);
const catLabel = (k) => categories[k][LANG];
/** Champ éditable dans la langue courante (repli sur le français). */
const pg = (obj, key) => obj[`${key}_${LANG}`] || obj[`${key}_fr`] || '';

const MATERIAL_EN = {
  Bois: 'Wood',
  'Bois de gmélina': 'Gmelina wood',
  'Bois, terre rouge, raphia': 'Wood, red earth, raffia',
  'Bois, finition colorée': 'Wood, coloured finish',
  'Bois de gmélina et peinture': 'Gmelina wood and paint',
};
/** Données d'une œuvre dans la langue courante. */
function L(o) {
  if (LANG === 'fr') return o;
  const e = oeuvresEn[o.slug];
  if (!e) throw new Error(`Traduction anglaise manquante : ${o.slug}`);
  return {
    ...o,
    title: e.title,
    alt: e.alt,
    desc: e.desc,
    material: e.material ?? (o.material ? MATERIAL_EN[o.material] ?? o.material : null),
    dims: e.dims ?? o.dims,
  };
}

// ————————————————————————————————————————— utilitaires
const esc = (s = '') =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const abs = (p) => site.url + p;
const num = (n) => new Intl.NumberFormat(LANG === 'en' ? 'en-US' : 'fr-FR').format(n);
const fcfa = (n) => `${num(n)}\u00a0FCFA`;
const eur = (n) => (LANG === 'en' ? `≈\u00a0€${num(Math.round(n / site.eurRate))}` : `≈\u00a0${num(Math.round(n / site.eurRate))}\u00a0€`);
const plain = (s) => s.replace(/\s+/g, ' ').trim();
const truncate = (s, n = 158) => (s.length <= n ? s : s.slice(0, s.lastIndexOf(' ', n - 1)) + '…');
const ld = (obj) => `<script type="application/ld+json">${JSON.stringify(obj).replace(/</g, '\\u003c')}</script>`;
const wa = (msg) => `https://wa.me/${site.whatsapp}?text=${encodeURIComponent(msg)}`;
const mailto = (subject, body = '') =>
  `mailto:${site.email}?subject=${encodeURIComponent(subject)}${body ? '&body=' + encodeURIComponent(body) : ''}`;
const bySlug = (s) => oeuvres.find((o) => o.slug === s) || oeuvres[0];
const prices = () => oeuvres.filter((o) => o.price && !o.sold).map((o) => o.price);
const priceMin = () => Math.min(...prices());
const priceMax = () => Math.max(...prices());

function write(path, content) {
  const file = join(DIST, path.endsWith('/') ? path + 'index.html' : path);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, content);
}

// ————————————————————————————————————————— images
const jobs = [{ src: join(ROOT, 'assets-src/media/atelier-1.png'), out: join(IMG_DIR, 'atelier-1'), og: false }];
for (const o of oeuvres) {
  o.images.forEach((file, i) =>
    jobs.push({ src: join(ROOT, 'assets-src/media', file), out: join(IMG_DIR, `${o.slug}-${i + 1}`), og: i === 0, thumb: join(CACHE, 'media', file) })
  );
}
mkdirSync(IMG_DIR, { recursive: true });
writeFileSync(join(CACHE, 'jobs.json'), JSON.stringify(jobs));
const py = spawnSync('python3', [join(ROOT, 'scripts/images.py'), join(CACHE, 'jobs.json'), join(CACHE, 'manifest.json')], { stdio: 'inherit' });
if (py.status !== 0) throw new Error('Échec du traitement des images (Python + Pillow requis).');
const manifest = JSON.parse(readFileSync(join(CACHE, 'manifest.json'), 'utf8'));

const srcsetOf = (key) => manifest[key].variants.map((x) => `/img/oeuvres/${x.file} ${x.w}w`).join(', ');
/** <img> responsive : srcset WebP, dimensions explicites, lazy par défaut. */
function img(key, alt, { sizes = '(min-width: 1100px) 33vw, (min-width: 700px) 50vw, 100vw', eager = false, cls = '' } = {}) {
  const m = manifest[key];
  if (!m) throw new Error(`Image manquante : ${key}`);
  const mid = m.variants[Math.min(1, m.variants.length - 1)];
  return `<img src="/img/oeuvres/${mid.file}" srcset="${srcsetOf(key)}" sizes="${sizes}" width="${mid.w}" height="${mid.h}" alt="${esc(alt)}"${
    eager ? ' fetchpriority="high"' : ' loading="lazy"'
  } decoding="async"${cls ? ` class="${cls}"` : ''}>`;
}
const cover = (o, opts) => img(`${o.slug}-1`, L(o).alt, opts);
const ogOf = (o) => `/img/oeuvres/${o.slug}-1-og.jpg`;
const largest = (key) => '/img/oeuvres/' + manifest[key].variants.at(-1).file;
const atelierAlt = () =>
  T(
    'Romaric Lokonon et d’autres sculpteurs taillant le bois assis au sol, au milieu des copeaux, dans l’atelier d’Agonlin Covè',
    'Romaric Lokonon and other sculptors carving wood while seated on the ground among wood shavings, in the Agonlin Covè workshop'
  );

// ————————————————————————————————————————— données structurées
const PERSON_ID = abs('/#artiste');
const personLd = () => ({
  '@type': 'Person',
  '@id': PERSON_ID,
  name: site.name,
  jobTitle: T('Sculpteur sur bois', 'Wood sculptor'),
  description: T(
    'Sculpteur sur bois béninois né en 2001 à Covè. Masques, têtes et figures en bois de gmélina inspirés des traditions béninoises et du patrimoine africain.',
    'Beninese wood sculptor born in 2001 in Covè. Masks, heads and figures in gmelina wood inspired by Beninese traditions and African heritage.'
  ),
  birthDate: '2001-10-19',
  birthPlace: { '@type': 'Place', name: 'Covè, Zou, Bénin' },
  nationality: { '@type': 'Country', name: 'Benin' },
  knowsAbout: T(
    ['Sculpture sur bois', 'Masques africains', 'Art béninois', 'Coiffures traditionnelles', 'Bois de gmélina'],
    ['Wood carving', 'African masks', 'Beninese art', 'Traditional hairstyles', 'Gmelina wood']
  ),
  address: { '@type': 'PostalAddress', addressLocality: site.city, addressRegion: site.region, addressCountry: site.countryCode },
  telephone: site.phoneIntl,
  email: `mailto:${site.email}`,
  url: abs(R().home),
  image: abs(ogOf(bySlug('ori-iwa-la-tete-de-sagesse'))),
  ...(site.social.length ? { sameAs: site.social.map((s) => s.url) } : {}),
});
const websiteLd = () => ({ '@type': 'WebSite', '@id': abs('/#site'), url: abs('/'), name: site.name, inLanguage: ['fr', 'en'], publisher: { '@id': PERSON_ID } });
const crumbsLd = (items) => ({
  '@type': 'BreadcrumbList',
  itemListElement: items.map(([name, path], i) => ({ '@type': 'ListItem', position: i + 1, name, item: abs(path) })),
});
const graph = (...nodes) => ld({ '@context': 'https://schema.org', '@graph': nodes });

// ————————————————————————————————————————— icônes
const icon = {
  wa: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12.04 2a9.9 9.9 0 0 0-8.5 14.98L2 22l5.17-1.5A9.93 9.93 0 1 0 12.04 2Zm0 18.1a8.2 8.2 0 0 1-4.17-1.14l-.3-.18-3.07.89.9-2.99-.2-.31a8.22 8.22 0 1 1 6.84 3.73Zm4.5-6.14c-.25-.12-1.46-.72-1.69-.8-.23-.08-.39-.12-.55.12-.17.25-.64.8-.78.96-.14.17-.29.19-.53.06a6.74 6.74 0 0 1-3.35-2.93c-.25-.44.25-.4.72-1.34.08-.16.04-.3-.02-.43l-.76-1.82c-.2-.48-.4-.41-.55-.42h-.47a.9.9 0 0 0-.65.3 2.74 2.74 0 0 0-.86 2.04 4.77 4.77 0 0 0 1 2.53 10.9 10.9 0 0 0 4.18 3.69c1.55.67 2.16.73 2.94.61.47-.07 1.46-.6 1.66-1.17.2-.58.2-1.07.15-1.17-.06-.1-.22-.17-.47-.29Z"/></svg>',
  mail: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.6" d="M3 6.5h18v11H3z M3.5 7l8.5 6.5L20.5 7"/></svg>',
  phone: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.6" d="M6.6 3.5h3l1.5 4-2 1.3a10.5 10.5 0 0 0 6.1 6.1l1.3-2 4 1.5v3a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 4.6 5.7a2 2 0 0 1 2-2.2Z"/></svg>',
  pin: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.6" d="M12 21s-6.5-6.1-6.5-11a6.5 6.5 0 0 1 13 0c0 4.9-6.5 11-6.5 11Z"/><circle cx="12" cy="10" r="2.3" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>',
  arrow: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.6" d="M4 12h15m-5-5 5 5-5 5"/></svg>',
  back: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.6" d="M20 12H5m5-5-5 5 5 5"/></svg>',
  bag: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.6" d="M5 8h14l-1 12H6L5 8Zm4 0V6.5a3 3 0 0 1 6 0V8"/></svg>',
  check: '<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="22" fill="none" stroke="currentColor" stroke-width="1.6"/><path fill="none" stroke="currentColor" stroke-width="2" d="m15 24.5 6 6 12-13"/></svg>',
  globe: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="1.5"/><path fill="none" stroke="currentColor" stroke-width="1.5" d="M3.5 12h17M12 3.5c2.5 2.6 3.6 5.4 3.6 8.5s-1.1 5.9-3.6 8.5c-2.5-2.6-3.6-5.4-3.6-8.5s1.1-5.9 3.6-8.5Z"/></svg>',
};

// ————————————————————————————————————————— gabarit
/** alt = { fr: '/chemin/', en: '/en/chemin/' } — pages équivalentes dans chaque langue. */
function layout({ alt, title, description, image, jsonld = '', body, bodyClass = '', noindex = false }) {
  const path = alt[LANG];
  const isHome = path === R().home;
  const fullTitle = isHome ? text[LANG].title : `${title} · ${site.name}`;
  const ogImg = abs(image || ogOf(bySlug('ori-iwa-la-tete-de-sagesse')));
  const other = LANG === 'fr' ? 'en' : 'fr';
  const navKeys = ['home', 'works', 'services', 'about', 'contact'];
  const current = (k) => (k === 'home' ? isHome : path.startsWith(R()[k]));
  return `<!doctype html>
<html lang="${LANG}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(fullTitle)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${abs(path)}">
${langs.map((l) => `<link rel="alternate" hreflang="${l}" href="${abs(alt[l])}">`).join('\n')}
<link rel="alternate" hreflang="x-default" href="${abs(alt.fr)}">
<meta name="robots" content="${noindex ? 'noindex' : 'index, follow, max-image-preview:large'}">
<meta name="author" content="${site.name}">
<meta name="theme-color" content="#0d0c0b">
<meta name="geo.region" content="BJ-ZO">
<meta name="geo.placename" content="${site.city}">
<meta property="og:type" content="${path.includes('/oeuvres/') || path.includes('/works/') ? 'article' : 'website'}">
<meta property="og:site_name" content="${site.name}">
<meta property="og:locale" content="${text[LANG].locale}">
<meta property="og:locale:alternate" content="${text[other].locale}">
<meta property="og:title" content="${esc(fullTitle)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${abs(path)}">
<meta property="og:image" content="${ogImg}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(fullTitle)}">
<meta name="twitter:description" content="${esc(description)}">
<meta name="twitter:image" content="${ogImg}">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="manifest" href="/site.webmanifest">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500&family=Manrope:wght@400;500;600;700&display=swap">
<link rel="stylesheet" href="/css/style.css?v=${VERSION}">
<script>document.documentElement.classList.add("js")</script>
<script src="/js/main.js?v=${VERSION}" defer></script>
${jsonld}
</head>
<body class="${bodyClass}">
<a class="skip" href="#contenu">${T('Aller au contenu', 'Skip to content')}</a>
<header class="site-header" data-header>
  <div class="wrap header-inner">
    <a class="brand" href="${R().home}" aria-label="${site.name} — ${T('accueil', 'home')}">
      <span class="brand-name">Romaric Lokonon</span>
      <span class="brand-sub">${T('Sculpteur · Bénin', 'Sculptor · Benin')}</span>
    </a>
    <a class="lang-switch lang-switch-mobile" href="${alt[other]}" hreflang="${other}" lang="${other}" data-lang-link aria-label="${T('Read this page in English', 'Lire cette page en français')}">${icon.globe}<span>${other.toUpperCase()}</span></a>
    <button class="nav-toggle" type="button" aria-expanded="false" aria-controls="menu" data-nav-toggle>
      <span class="sr">Menu</span><span class="bars" aria-hidden="true"></span>
    </button>
    <nav class="nav" id="menu" aria-label="${T('Navigation principale', 'Main navigation')}">
      <ul>
        ${navKeys.map((k) => `<li><a href="${R()[k]}"${current(k) ? ' aria-current="page"' : ''}>${navLabels[LANG][k]}</a></li>`).join('\n        ')}
      </ul>
      <div class="nav-end">
        <div class="lang-switch lang-switch-desktop" role="group" aria-label="${T('Langue', 'Language')}">
          <a href="${alt.fr}" hreflang="fr" lang="fr"${LANG === 'fr' ? ' aria-current="true"' : ''} data-lang-link>FR</a>
          <a href="${alt.en}" hreflang="en" lang="en"${LANG === 'en' ? ' aria-current="true"' : ''} data-lang-link>EN</a>
        </div>
        <a class="btn btn-sm btn-wa" href="${wa(T('Bonjour Romaric, je découvre votre travail sur votre site et souhaiterais échanger avec vous.', 'Hello Romaric, I discovered your work on your website and would like to get in touch.'))}" target="_blank" rel="noopener">${icon.wa}<span>WhatsApp</span></a>
      </div>
    </nav>
  </div>
</header>
<main id="contenu">
${body}
</main>
${footer(alt)}
</body>
</html>
`;
}

function footer() {
  return `<footer class="site-footer">
  <div class="wrap footer-grid">
    <div class="footer-brand">
      <p class="brand-name">Romaric Lokonon</p>
      <p class="muted">${T(
        `Sculpteur sur bois à ${site.city}, Bénin. Pièces uniques taillées à la main dans le bois de gmélina.`,
        `Wood sculptor in ${site.city}, Benin. Unique pieces hand-carved in gmelina wood.`
      )}</p>
    </div>
    <nav aria-label="${T('Pied de page', 'Footer')}">
      <p class="footer-title">${T('Explorer', 'Explore')}</p>
      <ul>${['home', 'works', 'services', 'about', 'contact'].map((k) => `<li><a href="${R()[k]}">${navLabels[LANG][k]}</a></li>`).join('')}</ul>
    </nav>
    <div>
      <p class="footer-title">${T('Collection', 'Collection')}</p>
      <ul>${Object.keys(categories).map((k) => `<li><a href="${R().works}?cat=${k}">${catLabel(k)}</a></li>`).join('')}</ul>
    </div>
    <address>
      <p class="footer-title">Contact</p>
      <ul>
        <li><a href="${wa(T('Bonjour Romaric,', 'Hello Romaric,'))}" target="_blank" rel="noopener">WhatsApp · ${site.phoneDisplay}</a></li>
        <li><a href="tel:${site.phoneIntl}">${T('Téléphone', 'Phone')} · ${site.phoneDisplay}</a></li>
        <li><a href="mailto:${site.email}">${site.email}</a></li>
        <li>${site.city}, ${site.region} — ${text[LANG].country}</li>
      </ul>
    </address>
  </div>
  <div class="wrap footer-bottom">
    <p>© ${new Date().getFullYear()} Romaric Lokonon — ${T('Tous droits réservés. Œuvres et photographies protégées.', 'All rights reserved. Works and photographs are protected.')}</p>
    <p><a href="${R().legal}">${T('Mentions légales', 'Legal notice')}</a></p>
  </div>
</footer>`;
}

// ————————————————————————————————————————— composants
function priceBlock(o, { big = false } = {}) {
  const cls = `price${big ? ' price-big' : ''}`;
  if (o.sold) return `<p class="${cls}"><span class="price-main sold-label">${T('Vendue', 'Sold')}</span></p>`;
  if (!o.price) return `<p class="${cls}"><span class="price-main">${T('Prix sur demande', 'Price on request')}</span></p>`;
  const note = o.priceNote ? ` <span class="price-note">${T('par pièce', 'per piece')}</span>` : '';
  return `<p class="${cls}"><span class="price-main">${fcfa(o.price)}</span>${note} <span class="price-eur">${eur(o.price)}</span></p>`;
}

function card(o, { sizes } = {}) {
  const l = L(o);
  return `<article class="card" data-cat="${o.cat}" data-price="${o.price || ''}">
  <a href="${workUrl(o)}" class="card-link">
    <div class="card-media">${o.sold ? `<span class="badge-sold">${T('Vendue', 'Sold')}</span>` : ''}${cover(o, { sizes: sizes || '(min-width: 1200px) 25vw, (min-width: 900px) 33vw, 50vw' })}</div>
    <div class="card-body">
      <p class="eyebrow">${catLabel(o.cat)}</p>
      <h3 class="card-title">${esc(l.title)}</h3>
      <p class="card-meta">${esc(l.dims || l.material || T('Bois sculpté', 'Carved wood'))}</p>
      ${priceBlock(o)}
    </div>
  </a>
</article>`;
}

const ctaBand = (title, txt) => `
<section class="cta-band">
  <div class="wrap cta-inner reveal">
    <h2 class="display">${title || T('Une pièce vous parle ?', 'Does a piece speak to you?')}</h2>
    <p>${
      txt ||
      T(
        'Chaque sculpture est unique. Écrivez-moi pour connaître sa disponibilité, demander des photos supplémentaires ou imaginer une commande sur mesure.',
        'Every sculpture is unique. Write to me to check availability, ask for more photos or imagine a custom commission.'
      )
    }</p>
    <div class="actions">
      <a class="btn btn-light btn-wa" href="${wa(T('Bonjour Romaric, je souhaiterais échanger avec vous au sujet de vos sculptures.', 'Hello Romaric, I would like to talk with you about your sculptures.'))}" target="_blank" rel="noopener">${icon.wa}<span>${T('Écrire sur WhatsApp', 'Message on WhatsApp')}</span></a>
      <a class="btn btn-ghost-light" href="${R().contact}">${T('Toutes les options de contact', 'All contact options')}</a>
    </div>
  </div>
</section>`;

const breadcrumbs = (items) => `<nav class="crumbs" aria-label="${T('Fil d’Ariane', 'Breadcrumb')}"><ol>${items
  .map(([name, path], i) => (i === items.length - 1 ? `<li aria-current="page">${esc(name)}</li>` : `<li><a href="${path}">${esc(name)}</a></li>`))
  .join('')}</ol></nav>`;

const pageHead = (eyebrow, title, intro, crumbs) => `
<section class="page-head">
  <div class="wrap">
    ${crumbs ? breadcrumbs(crumbs) : ''}
    <p class="eyebrow">${eyebrow}</p>
    <h1 class="display">${title}</h1>
    ${intro ? `<p class="lead">${intro}</p>` : ''}
  </div>
</section>`;

const timeline = () => `<ol class="timeline reveal">
      ${parcours.map((p) => `<li><span class="tl-year">${p.year}</span><p>${p[LANG]}</p></li>`).join('\n      ')}
    </ol>`;

const atelierFigure = (cls = '') => `<figure class="atelier-figure ${cls}">
  ${img('atelier-1', atelierAlt(), { sizes: '(min-width: 900px) 50vw, 100vw' })}
  <figcaption>${T(`L’atelier d’${site.city} — la taille se fait au sol, au milieu des copeaux.`, `The ${site.city} workshop — carving is done on the ground, among the shavings.`)}</figcaption>
</figure>`;

// ————————————————————————————————————————— page : accueil
function pageHome() {
  const majeures = oeuvres.filter((o) => o.cat === 'majeure');
  const hero = bySlug('ori-iwa-la-tete-de-sagesse');
  const strip = ['la-spirale-aerienne', 'l-envol', 'le-visage-aux-calebasses', 'masque-wanyinan', 'la-route-au-sommet', 'la-coiffe-aux-petales', 'masque-espoir', 'a-deux-sur-la-moto'].map(bySlug);
  const total = oeuvres.length;

  const body = `
<section class="hero">
  <div class="wrap hero-grid">
    <div class="hero-text">
      <p class="eyebrow reveal">${T(`Sculpteur sur bois · ${site.city}, Bénin`, `Wood sculptor · ${site.city}, Benin`)}</p>
      <h1 class="display hero-title reveal">${inline(pg(pages.accueil, 'hero_title'))}</h1>
      <p class="lead reveal">${inline(pg(pages.accueil, 'hero_lead'))}</p>
      <div class="actions reveal">
        <a class="btn btn-light" href="${R().works}">${T('Découvrir les œuvres', 'Discover the works')} ${icon.arrow}</a>
        <a class="btn btn-ghost-light" href="${R().services}">${T('Commander une pièce', 'Commission a piece')}</a>
      </div>
    </div>
    <figure class="hero-figure">
      ${img(`${hero.slug}-1`, L(hero).alt, { eager: true, sizes: '(min-width: 900px) 46vw, 90vw' })}
      <figcaption><a href="${workUrl(hero)}"><em>${esc(L(hero).title)}</em> — ${T('bois de gmélina', 'gmelina wood')}</a></figcaption>
    </figure>
  </div>
  <div class="wrap hero-facts">
    <dl>
      <div><dt>${T('Né en', 'Born')}</dt><dd>${T('2001, à Covè', '2001, Covè')}</dd></div>
      <div><dt>${T('Sculpteur depuis', 'Sculptor since')}</dt><dd>2019</dd></div>
      <div><dt>${T('Matière', 'Material')}</dt><dd>${T('Bois de gmélina', 'Gmelina wood')}</dd></div>
      <div><dt>Collection</dt><dd>${total} ${T('œuvres', 'works')}</dd></div>
    </dl>
  </div>
</section>

<section class="section paper">
  <div class="wrap split">
    <div class="reveal">
      <p class="eyebrow">${T('Démarche artistique', 'Artistic approach')}</p>
      <h2 class="display">${inline(pg(pages.accueil, 'approach_title'))}</h2>
    </div>
    <div class="prose reveal">
      ${md(pg(pages.accueil, 'approach_text'))}
      ${pg(pages.accueil, 'quote') ? `<blockquote class="quote">${T('« ', '“')}${inline(pg(pages.accueil, 'quote'))}${T(' »', '”')}</blockquote>` : ''}
      <a class="link-arrow" href="${R().about}">${T('Lire le parcours de l’artiste', 'Read the artist’s story')} ${icon.arrow}</a>
    </div>
  </div>
</section>

<section class="section">
  <div class="wrap">
    <div class="section-head reveal">
      <div>
        <p class="eyebrow">${T('Sélection', 'Selection')}</p>
        <h2 class="display">${catLabel('majeure')}</h2>
      </div>
      <a class="link-arrow" href="${R().works}?cat=majeure">${T(`Voir les ${majeures.length} pièces`, `See all ${majeures.length} pieces`)} ${icon.arrow}</a>
    </div>
    <div class="feature-list">
      ${majeures
        .map((o, i) => {
          const l = L(o);
          return `<article class="feature reveal">
        <a class="feature-media" href="${workUrl(o)}" tabindex="-1" aria-hidden="true">${cover(o, { sizes: '(min-width: 900px) 50vw, 100vw' })}</a>
        <div class="feature-body">
          <p class="feature-num">${String(i + 1).padStart(2, '0')}</p>
          <h3 class="display"><a href="${workUrl(o)}">${esc(l.title)}</a></h3>
          <p>${esc(l.desc[0])}</p>
          <p class="card-meta">${esc(l.material || '')}</p>
          ${priceBlock(o)}
          <a class="link-arrow" href="${workUrl(o)}">${T('Découvrir l’œuvre', 'View the work')} ${icon.arrow}</a>
        </div>
      </article>`;
        })
        .join('\n')}
    </div>
  </div>
</section>

<section class="section craft">
  <div class="wrap">
    <div class="atelier-split">
      ${atelierFigure('reveal')}
      <div class="reveal">
        <p class="eyebrow">${T('L’atelier', 'The workshop')}</p>
        <h2 class="display">${T('Taillé à la main, fini à la main.', 'Carved by hand, finished by hand.')}</h2>
        <p class="lead">${inline(pg(pages.accueil, 'workshop_text'))}</p>
      </div>
    </div>
    <ol class="steps">
      ${T(
        `<li class="reveal"><span class="step-n">01</span><h3>Le bois de gmélina</h3><p>Le <em>Gmelina arborea</em>, ou mélina, est choisi pour sa noblesse et sa durabilité. Son grain fin accueille le détail.</p></li>
      <li class="reveal"><span class="step-n">02</span><h3>La taille</h3><p>Chaque pièce est taillée dans le bois brut avec des outils traditionnels, à l’atelier d’${site.city}.</p></li>
      <li class="reveal"><span class="step-n">03</span><h3>Séchage &amp; ponçage</h3><p>La pièce est mise à sécher, puis poncée pour obtenir une surface lisse qui révèle le modelé des visages.</p></li>
      <li class="reveal"><span class="step-n">04</span><h3>La finition</h3><p>Finition naturelle brute pour la plupart des œuvres ; certaines sont polychromes ou associent terre rouge et raphia.</p></li>`,
        `<li class="reveal"><span class="step-n">01</span><h3>Gmelina wood</h3><p><em>Gmelina arborea</em> is chosen for its nobility and durability. Its fine grain welcomes detail.</p></li>
      <li class="reveal"><span class="step-n">02</span><h3>Carving</h3><p>Each piece is carved from raw wood with traditional tools, in the ${site.city} workshop.</p></li>
      <li class="reveal"><span class="step-n">03</span><h3>Drying &amp; sanding</h3><p>The piece is left to dry, then sanded to a smooth surface that reveals the modelling of the faces.</p></li>
      <li class="reveal"><span class="step-n">04</span><h3>Finishing</h3><p>A raw natural finish for most works; some are polychrome or combine red earth and raffia.</p></li>`
      )}
    </ol>
    <p class="signature reveal"><span>Signature</span> ${T('Le détail des coiffures et l’expression des visages.', 'The detail of the headdresses and the expression of the faces.')}</p>
  </div>
</section>

<section class="section">
  <div class="wrap">
    <div class="section-head reveal">
      <div>
        <p class="eyebrow">${T('La collection', 'The collection')}</p>
        <h2 class="display">${T('Portraits, coiffes &amp; masques', 'Portraits, headdresses &amp; masks')}</h2>
      </div>
      <a class="link-arrow" href="${R().works}">${T('Toute la collection', 'The full collection')} (${total}) ${icon.arrow}</a>
    </div>
    <div class="grid grid-4">
      ${strip.map((o) => card(o)).join('\n')}
    </div>
  </div>
</section>

<section class="section paper">
  <div class="wrap split">
    <div class="reveal">
      <p class="eyebrow">${T('Parcours', 'Journey')}</p>
      <h2 class="display">${T('De Covè à Doha.', 'From Covè to Doha.')}</h2>
      <p class="muted-dark">${T('Un parcours jeune, enraciné dans un atelier familial et déjà ouvert sur le monde.', 'A young career, rooted in a family workshop and already open to the world.')}</p>
    </div>
    ${timeline()}
  </div>
</section>

<section class="section">
  <div class="wrap">
    <div class="section-head reveal">
      <div>
        <p class="eyebrow">Services</p>
        <h2 class="display">${T('Acquérir, commander, collaborer', 'Acquire, commission, collaborate')}</h2>
      </div>
      <a class="link-arrow" href="${R().services}">${T('Détail des services', 'Service details')} ${icon.arrow}</a>
    </div>
    <div class="grid grid-3 services-mini">
      <a class="svc reveal" href="${R().works}"><span class="step-n">01</span><h3>${T('Œuvres originales', 'Original works')}</h3><p>${T(
        `Pièces uniques disponibles à l’acquisition, de ${num(priceMin())} à ${num(priceMax())}&nbsp;FCFA.`,
        `Unique pieces available to acquire, from ${num(priceMin())} to ${num(priceMax())}&nbsp;FCFA (≈&nbsp;€${num(Math.round(priceMin() / site.eurRate))}–${num(Math.round(priceMax() / site.eurRate))}).`
      )}</p></a>
      <a class="svc reveal" href="${R().services}#sur-mesure"><span class="step-n">02</span><h3>${T('Commandes sur mesure', 'Custom commissions')}</h3><p>${T(
        'Un masque, une tête, une coiffe ou une scène imaginés avec vous et sculptés pour vous.',
        'A mask, a head, a headdress or a scene imagined with you and carved for you.'
      )}</p></a>
      <a class="svc reveal" href="${R().services}#expedition"><span class="step-n">03</span><h3>${T('Expédition internationale', 'Worldwide shipping')}</h3><p>${T(
        'Des œuvres qui voyagent depuis le Bénin vers les collectionneurs du monde entier.',
        'Works that travel from Benin to collectors around the world.'
      )}</p></a>
    </div>
  </div>
</section>
${ctaBand()}`;

  return layout({
    alt: { fr: '/', en: '/en/' },
    title: text[LANG].title,
    description: text[LANG].description,
    image: ogOf(hero),
    jsonld: graph(personLd(), websiteLd(), {
      '@type': 'ItemList',
      name: T('Œuvres majeures de Romaric Lokonon', 'Major works by Romaric Lokonon'),
      itemListElement: majeures.map((o, i) => ({ '@type': 'ListItem', position: i + 1, url: abs(workUrl(o)), name: L(o).title })),
    }),
    body,
    bodyClass: 'home',
  });
}

// ————————————————————————————————————————— page : collection
function pageCollection() {
  const counts = Object.fromEntries(Object.keys(categories).map((k) => [k, oeuvres.filter((o) => o.cat === k).length]));
  const crumbs = [[navLabels[LANG].home, R().home], [navLabels[LANG].works, R().works]];
  const body = `
${pageHead(
  'Collection 2026',
  T('Les œuvres', 'The works'),
  T(
    `${oeuvres.length} sculptures uniques en bois de gmélina — œuvres majeures, portraits et coiffures, pièces narratives et masques. Toutes sont taillées à la main à ${site.city}.`,
    `${oeuvres.length} unique sculptures in gmelina wood — major works, portraits and headdresses, narrative pieces and masks. All are hand-carved in ${site.city}.`
  ),
  crumbs
)}
<section class="section section-tight">
  <div class="wrap">
    <div class="toolbar" data-filters>
      <div class="chips" role="group" aria-label="${T('Filtrer par catégorie', 'Filter by category')}">
        <button type="button" class="chip" aria-pressed="true" data-filter="tout">${T('Tout', 'All')} <span>${oeuvres.length}</span></button>
        ${Object.keys(categories)
          .map((k) => `<button type="button" class="chip" aria-pressed="false" data-filter="${k}">${catLabel(k)} <span>${counts[k]}</span></button>`)
          .join('\n        ')}
      </div>
      <label class="sort">
        <span>${T('Trier', 'Sort')}</span>
        <select data-sort>
          <option value="defaut">${T('Sélection', 'Featured')}</option>
          <option value="asc">${T('Prix croissant', 'Price: low to high')}</option>
          <option value="desc">${T('Prix décroissant', 'Price: high to low')}</option>
        </select>
      </label>
    </div>
    <p class="result-count" aria-live="polite" data-count>${oeuvres.length} ${T('œuvres', 'works')}</p>
    <div class="grid grid-4" data-grid>
      ${oeuvres.map((o) => card(o)).join('\n')}
    </div>
    <p class="note">${T(
      'Prix indicatifs en francs CFA (XOF), hors emballage et transport. Conversion en euros à titre indicatif (1&nbsp;€ = 655,957&nbsp;FCFA).',
      'Prices in CFA francs (XOF), excluding packaging and shipping. Euro conversion for reference only (€1 = 655.957&nbsp;FCFA).'
    )}</p>
  </div>
</section>
${ctaBand(
  T('Vous ne trouvez pas la pièce idéale ?', 'Can’t find the right piece?'),
  T(
    'Romaric réalise aussi des commandes sur mesure : un masque, une coiffe, une scène ou un portrait imaginés avec vous.',
    'Romaric also takes custom commissions: a mask, a headdress, a scene or a portrait imagined with you.'
  )
)}`;

  return layout({
    alt: { fr: routes.fr.works, en: routes.en.works },
    title: T('Œuvres — sculptures, masques et têtes en bois', 'Works — wooden sculptures, masks and heads'),
    description: T(
      `${oeuvres.length} sculptures en bois de Romaric Lokonon : masques, têtes à coiffes, œuvres narratives, sculptées à la main au Bénin. Prix et dimensions.`,
      `${oeuvres.length} wooden sculptures by Romaric Lokonon: masks, heads with headdresses and narrative works, hand-carved in Benin. Prices and dimensions.`
    ),
    image: ogOf(bySlug('la-spirale-aerienne')),
    jsonld: graph(crumbsLd(crumbs), {
      '@type': 'CollectionPage',
      name: T('Œuvres de Romaric Lokonon', 'Works by Romaric Lokonon'),
      url: abs(R().works),
      about: { '@id': PERSON_ID },
      mainEntity: {
        '@type': 'ItemList',
        numberOfItems: oeuvres.length,
        itemListElement: oeuvres.map((o, i) => ({ '@type': 'ListItem', position: i + 1, url: abs(workUrl(o)), name: L(o).title })),
      },
    }),
    body,
  });
}

// ————————————————————————————————————————— fenêtre « Passer commande »
function orderModal(o) {
  const l = L(o);
  const isQuote = !o.price;
  return `<dialog class="modal" data-order-modal aria-labelledby="order-title">
  <div class="modal-panel">
    <button type="button" class="modal-close" data-close aria-label="${T('Fermer', 'Close')}">×</button>
    <div class="modal-head">
      <div class="modal-thumb">${cover(o, { sizes: '96px' })}</div>
      <div>
        <p class="eyebrow">${isQuote ? T('Demande de prix', 'Price request') : T('Passer commande', 'Place an order')}</p>
        <h2 class="display" id="order-title">${esc(l.title)}</h2>
        ${priceBlock(o)}
      </div>
    </div>
    <div data-step="form">
      <form name="${site.orderFormName}" method="POST" action="${T('/commande-envoyee/', '/en/order-sent/')}" data-netlify="true" netlify-honeypot="bot-field" data-order-form novalidate>
        <input type="hidden" name="form-name" value="${site.orderFormName}">
        <input type="hidden" name="oeuvre" value="${esc(L({ ...o }).title === o.title ? o.title : `${o.title} (${l.title})`)}">
        <input type="hidden" name="prix" value="${o.price ? `${o.price} FCFA` : 'sur demande'}">
        <input type="hidden" name="page" value="${abs(workUrl(o))}">
        <input type="hidden" name="langue" value="${LANG}">
        <p class="hp" aria-hidden="true"><label>Ne pas remplir <input name="bot-field" tabindex="-1" autocomplete="off"></label></p>
        <div class="form-grid">
          <div class="field"><label for="o-name">${T('Nom complet', 'Full name')} *</label><input id="o-name" name="nom" autocomplete="name" required></div>
          <div class="field"><label for="o-email">E-mail *</label><input id="o-email" name="email" type="email" autocomplete="email" required></div>
          <div class="field"><label for="o-phone">${T('Téléphone / WhatsApp', 'Phone / WhatsApp')} *</label><input id="o-phone" name="telephone" type="tel" autocomplete="tel" placeholder="+229 …" required></div>
          <div class="field"><label for="o-country">${T('Pays de livraison', 'Delivery country')} *</label><input id="o-country" name="pays" autocomplete="country-name" required></div>
          <div class="field field-full"><label for="o-city">${T('Ville', 'City')}</label><input id="o-city" name="ville" autocomplete="address-level2"></div>
          <div class="field field-full"><label for="o-msg">${T('Message', 'Message')} <span class="opt">(${T('facultatif', 'optional')})</span></label><textarea id="o-msg" name="message" rows="3" placeholder="${T(
            'Questions, délai souhaité, mode de livraison…',
            'Questions, preferred timing, delivery method…'
          )}"></textarea></div>
        </div>
        <p class="form-error" data-form-error hidden>${T('Merci de remplir les champs marqués d’un astérisque, avec un e-mail valide.', 'Please fill in the fields marked with an asterisk, with a valid email.')}</p>
        <p class="form-legal">${T(
          'Aucun paiement en ligne : votre demande est transmise à l’artiste, qui vous recontacte pour confirmer la disponibilité, le transport et le règlement.',
          'No online payment: your request goes to the artist, who will contact you to confirm availability, shipping and payment.'
        )}</p>
        <button class="btn btn-light btn-block" type="submit">${icon.bag}<span>${isQuote ? T('Envoyer ma demande', 'Send my request') : T('Envoyer ma commande', 'Send my order')}</span></button>
      </form>
    </div>
    <div class="modal-result" data-step="done" hidden tabindex="-1">
      <span class="result-icon">${icon.check}</span>
      <h3 class="display">${T('Merci, votre demande est bien envoyée !', 'Thank you, your request has been sent!')}</h3>
      <p>${T(
        `Nous avons bien reçu votre demande pour « ${esc(l.title)} ». <strong>Nous allons prendre contact avec vous très rapidement</strong> par e-mail ou WhatsApp pour confirmer la disponibilité, les frais de transport et les modalités de paiement.`,
        `We have received your request for “${esc(l.title)}”. <strong>We will get in touch with you very soon</strong> by email or WhatsApp to confirm availability, shipping costs and payment terms.`
      )}</p>
      <button type="button" class="btn btn-light" data-close>${T('Continuer la visite', 'Continue browsing')}</button>
    </div>
    <div class="modal-result" data-step="error" hidden tabindex="-1">
      <h3 class="display">${T('L’envoi n’a pas abouti', 'Your request could not be sent')}</h3>
      <p>${T(
        'Un problème de connexion a empêché l’envoi. Vous pouvez transmettre directement votre demande à Romaric sur WhatsApp : votre message est déjà rédigé.',
        'A connection problem prevented sending. You can send your request directly to Romaric on WhatsApp — your message is already written.'
      )}</p>
      <a class="btn btn-light btn-wa" data-wa-fallback href="${wa('')}" target="_blank" rel="noopener">${icon.wa}<span>${T('Envoyer via WhatsApp', 'Send via WhatsApp')}</span></a>
    </div>
  </div>
</dialog>`;
}

// ————————————————————————————————————————— page : œuvre
function pageOeuvre(o, idx) {
  const l = L(o);
  const prev = oeuvres[(idx - 1 + oeuvres.length) % oeuvres.length];
  const next = oeuvres[(idx + 1) % oeuvres.length];
  const related = oeuvres.filter((x) => x.cat === o.cat && x !== o).slice(0, 4);
  if (related.length < 4) related.push(...oeuvres.filter((x) => x.cat !== o.cat && x.cat !== 'majeure').slice(0, 4 - related.length));
  const crumbs = [[navLabels[LANG].home, R().home], [navLabels[LANG].works, R().works], [l.title, workUrl(o)]];
  const descText = plain(l.desc.join(' '));
  const msg = T(
    `Bonjour Romaric, je suis intéressé(e) par votre œuvre « ${l.title} » (${abs(workUrl(o))}). Est-elle toujours disponible ?`,
    `Hello Romaric, I am interested in your work “${l.title}” (${abs(workUrl(o))}). Is it still available?`
  );
  const generic = l.dims && /^\d/.test(l.dims) && l.dims.includes('×');
  const specs = [
    [T('Catégorie', 'Category'), catLabel(o.cat)],
    [T('Matériau', 'Material'), l.material || T('Bois sculpté', 'Carved wood')],
    [T('Dimensions', 'Dimensions'), l.dims ? l.dims + (generic ? T(' (H × l × P)', ' (H × W × D)') : '') : T('Sur demande', 'On request')],
    [T('Technique', 'Technique'), T('Taille directe à la main, outils traditionnels', 'Direct hand carving, traditional tools')],
    [T('Édition', 'Edition'), T('Pièce unique', 'Unique piece')],
    [T('Atelier', 'Workshop'), `${site.city}, ${text[LANG].country}`],
  ];
  const keys = o.images.map((_, i) => `${o.slug}-${i + 1}`);
  const altFor = (i) => (i === 0 ? l.alt : `${l.title} — ${T('vue', 'view')} ${i + 1}`);

  const artworkLd = {
    '@type': o.price ? ['VisualArtwork', 'Product'] : 'VisualArtwork',
    '@id': abs(workUrl(o)) + '#oeuvre',
    name: l.title,
    url: abs(workUrl(o)),
    inLanguage: LANG,
    description: descText,
    image: keys.map((k) => abs(largest(k))),
    artform: T('Sculpture', 'Sculpture'),
    artMedium: l.material || T('Bois', 'Wood'),
    creator: { '@id': PERSON_ID },
    locationCreated: { '@type': 'Place', name: `${site.city}, Benin` },
    ...(o.price
      ? {
          brand: { '@type': 'Brand', name: site.name },
          sku: o.slug,
          offers: {
            '@type': 'Offer',
            url: abs(workUrl(o)),
            price: o.price,
            priceCurrency: 'XOF',
            availability: o.sold ? 'https://schema.org/SoldOut' : 'https://schema.org/InStock',
            itemCondition: 'https://schema.org/NewCondition',
            seller: { '@id': PERSON_ID },
          },
        }
      : {}),
  };

  const body = `
<article class="artwork">
  <div class="wrap">
    ${breadcrumbs(crumbs)}
    <div class="artwork-grid">
      <div class="gallery" data-gallery>
        <button type="button" class="gallery-main" data-open aria-label="${T('Agrandir l’image', 'Enlarge image')}">
          ${img(keys[0], l.alt, { eager: true, sizes: '(min-width: 1000px) 55vw, 100vw' })}
        </button>
        ${
          keys.length > 1
            ? `<ul class="thumbs" aria-label="${T('Autres vues', 'Other views')}">
          ${keys
            .map(
              (k, i) =>
                `<li><button type="button" class="thumb" aria-label="${T('Vue', 'View')} ${i + 1}"${i === 0 ? ' aria-current="true"' : ''} data-full="${largest(k)}" data-srcset="${esc(srcsetOf(k))}" data-alt="${esc(altFor(i))}">${img(k, altFor(i), { sizes: '120px' })}</button></li>`
            )
            .join('\n          ')}
        </ul>`
            : ''
        }
      </div>
      <div class="artwork-info">
        <p class="eyebrow">${catLabel(o.cat)}</p>
        <h1 class="display">${esc(l.title)}</h1>
        <p class="byline">Romaric Lokonon · ${esc((l.material || T('bois sculpté', 'carved wood')).toLowerCase())}</p>
        ${priceBlock(o, { big: true })}
        <div class="prose">${l.desc.map((p) => `<p>${esc(p)}</p>`).join('')}</div>
        <div class="actions">
          ${
            o.sold
              ? `<p class="sold-note">${T('Cette œuvre a trouvé preneur. Romaric peut réaliser une pièce dans le même esprit.', 'This work has found a home. Romaric can create a piece in the same spirit.')}</p>
          <a class="btn btn-light btn-wa" href="${wa(T(`Bonjour Romaric, l’œuvre « ${l.title} » est vendue : pourriez-vous réaliser une pièce dans le même esprit ?`, `Hello Romaric, “${l.title}” is sold: could you create a piece in the same spirit?`))}" target="_blank" rel="noopener">${icon.wa}<span>${T('Demander une pièce similaire', 'Ask for a similar piece')}</span></a>`
              : `<button type="button" class="btn btn-light" data-order-open>${icon.bag}<span>${o.price ? T('Passer commande', 'Place an order') : T('Demander le prix', 'Request the price')}</span></button>
          <a class="btn btn-ghost-light btn-wa" href="${wa(msg)}" target="_blank" rel="noopener">${icon.wa}<span>WhatsApp</span></a>`
          }
        </div>
        <dl class="specs">
          ${specs.map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('\n          ')}
        </dl>
        <p class="note">${T('Prix hors emballage et transport. Expédition internationale possible —', 'Price excludes packaging and shipping. Worldwide shipping available —')} <a href="${R().services}#expedition">${T('en savoir plus', 'learn more')}</a>.</p>
      </div>
    </div>
    <nav class="pager" aria-label="${T('Œuvres voisines', 'Adjacent works')}">
      <a href="${workUrl(prev)}" rel="prev">${icon.back}<span><small>${T('Précédente', 'Previous')}</small>${esc(L(prev).title)}</span></a>
      <a href="${workUrl(next)}" rel="next"><span><small>${T('Suivante', 'Next')}</small>${esc(L(next).title)}</span>${icon.arrow}</a>
    </nav>
  </div>
</article>
<section class="section section-tight">
  <div class="wrap">
    <div class="section-head"><h2 class="display">${T('Dans la même veine', 'In the same vein')}</h2><a class="link-arrow" href="${R().works}">${T('Toute la collection', 'The full collection')} ${icon.arrow}</a></div>
    <div class="grid grid-4">${related.map((r) => card(r)).join('\n')}</div>
  </div>
</section>
<dialog class="lightbox" data-lightbox aria-label="${T('Image agrandie', 'Enlarged image')}">
  <button type="button" class="lb-close" data-close aria-label="${T('Fermer', 'Close')}">×</button>
  <button type="button" class="lb-nav lb-prev" data-step="-1" aria-label="${T('Image précédente', 'Previous image')}">${icon.back}</button>
  <img alt="" data-lb-img>
  <button type="button" class="lb-nav lb-next" data-step="1" aria-label="${T('Image suivante', 'Next image')}">${icon.arrow}</button>
</dialog>
${o.sold ? '' : orderModal(o)}
${ctaBand(
  T('Une question sur cette œuvre ?', 'A question about this work?'),
  T(
    'Demandez des photos supplémentaires, les conditions d’expédition vers votre pays ou une pièce dans le même esprit.',
    'Ask for more photos, shipping conditions to your country or a piece in the same spirit.'
  )
)}`;

  const kind = o.cat === 'masque' ? T('masque', 'mask') : 'sculpture';
  const priceTxt = o.price ? ` ${fcfa(o.price).replace('\u00a0', ' ').replace('\u00a0', ' ')}.` : '';
  return layout({
    alt: { fr: workUrl(o, 'fr'), en: workUrl(o, 'en') },
    title: l.title.length > 34 ? l.title : T(`${l.title} — ${kind} en bois`, `${l.title} — wooden ${kind}`),
    description: truncate(
      T(`${l.title}, ${kind} en bois de Romaric Lokonon (Bénin).${priceTxt} ${descText}`, `${l.title}, a wooden ${kind} by Romaric Lokonon (Benin).${priceTxt} ${descText}`)
    ),
    image: ogOf(o),
    jsonld: graph(crumbsLd(crumbs), artworkLd, personLd()),
    body,
  });
}

// ————————————————————————————————————————— page : services
const faq = () => faqItems.map((f) => [pg(f, 'question'), pg(f, 'answer')]);

function pageServices() {
  const crumbs = [[navLabels[LANG].home, R().home], ['Services', R().services]];
  const ticks = (items) => `<ul class="ticks">${items.map((i) => `<li>${i}</li>`).join('')}</ul>`;
  const body = `
${pageHead(
  'Services',
  T('Acquérir, commander, <em>collaborer</em>.', 'Acquire, commission, <em>collaborate</em>.'),
  T(
    'Que vous soyez collectionneur, amateur d’art africain, décorateur ou institution, chaque échange commence par une conversation directe avec l’artiste.',
    'Whether you are a collector, an African art lover, an interior designer or an institution, every exchange begins with a direct conversation with the artist.'
  ),
  crumbs
)}
<section class="section section-tight">
  <div class="wrap services">
    <article class="service reveal" id="oeuvres-originales">
      <div class="service-media">${cover(bySlug('weziza'), { sizes: '(min-width: 900px) 40vw, 100vw' })}</div>
      <div class="service-body">
        <span class="step-n">01</span>
        <h2 class="display">${T('Œuvres originales', 'Original works')}</h2>
        <p>${T(
          `Une collection de ${oeuvres.length} sculptures disponibles : œuvres majeures, portraits aux coiffes sculptées, pièces narratives et polychromes, masques. Chaque pièce est unique et signée de la main de l’artiste.`,
          `A collection of ${oeuvres.length} available sculptures: major works, portraits with carved headdresses, narrative and polychrome pieces, masks. Each piece is unique and made by the artist’s own hand.`
        )}</p>
        ${ticks(
          T(
            ['Pièces uniques, sculptées à la main', 'Prix affichés en FCFA et en euros', 'Commande en ligne en quelques clics, sans paiement en ligne'],
            ['Unique, hand-carved pieces', 'Prices shown in CFA francs and euros', 'Order online in a few clicks, no online payment']
          )
        )}
        <a class="btn btn-light" href="${R().works}">${T('Parcourir la collection', 'Browse the collection')} ${icon.arrow}</a>
      </div>
    </article>
    <article class="service reveal" id="sur-mesure">
      <div class="service-media">${img('atelier-1', atelierAlt(), { sizes: '(min-width: 900px) 40vw, 100vw' })}</div>
      <div class="service-body">
        <span class="step-n">02</span>
        <h2 class="display">${T('Commandes sur mesure', 'Custom commissions')}</h2>
        <p>${T(
          'Un masque à votre nom, une coiffe inspirée d’une tradition qui vous est chère, une scène racontant un métier ou un souvenir : Romaric sculpte des pièces imaginées avec vous, dans son langage de formes.',
          'A mask bearing your name, a headdress inspired by a tradition dear to you, a scene telling the story of a trade or a memory: Romaric carves pieces imagined with you, in his own language of forms.'
        )}</p>
        ${ticks(
          T(
            ['Têtes, masques, coiffes, figures et scènes narratives', 'Finition naturelle ou polychrome', 'Cadeaux d’exception, pièces de décoration, objets de mémoire'],
            ['Heads, masks, headdresses, figures and narrative scenes', 'Natural or polychrome finish', 'Exceptional gifts, interior pieces, objects of memory']
          )
        )}
        <a class="btn btn-light btn-wa" href="${wa(T('Bonjour Romaric, j’aimerais vous parler d’une commande sur mesure : ', 'Hello Romaric, I would like to talk to you about a custom commission: '))}" target="_blank" rel="noopener">${icon.wa}<span>${T('Parler de mon projet', 'Discuss my project')}</span></a>
      </div>
    </article>
    <article class="service reveal" id="expedition">
      <div class="service-media">${cover(bySlug('l-envol'), { sizes: '(min-width: 900px) 40vw, 100vw' })}</div>
      <div class="service-body">
        <span class="step-n">03</span>
        <h2 class="display">${T('Expédition internationale', 'Worldwide shipping')}</h2>
        <p>${T(
          `Les œuvres quittent l’atelier d’${site.city} pour rejoindre des collectionneurs au Bénin et à l’étranger. Le mode d’envoi, l’emballage et les documents d’exportation sont définis avec vous avant l’envoi.`,
          `Works leave the ${site.city} workshop to join collectors in Benin and abroad. Shipping method, packaging and export documents are agreed with you before dispatch.`
        )}</p>
        ${ticks(
          T(
            ['Devis de transport selon la pièce et la destination', 'Retrait possible à l’atelier', 'Suivi direct avec l’artiste'],
            ['Shipping quote based on the piece and destination', 'Pick-up at the workshop possible', 'Direct follow-up with the artist']
          )
        )}
      </div>
    </article>
    <article class="service reveal" id="collaborations">
      <div class="service-media">${cover(bySlug('trone-royal-retour-aux-sources'), { sizes: '(min-width: 900px) 40vw, 100vw' })}</div>
      <div class="service-body">
        <span class="step-n">04</span>
        <h2 class="display">${T('Expositions &amp; collaborations', 'Exhibitions &amp; collaborations')}</h2>
        <p>${T(
          'Exposé à Ouidah (« À l’air de rien », 2024 et 2025) et engagé en 2026 dans une expérience artistique au Qatar en lien avec Qatar Museums, Romaric est ouvert aux galeries, musées, résidences et projets culturels.',
          'Exhibited in Ouidah (“À l’air de rien”, 2024 and 2025) and engaged in 2026 in an artistic experience in Qatar in connection with Qatar Museums, Romaric welcomes galleries, museums, residencies and cultural projects.'
        )}</p>
        <a class="btn btn-ghost-light" href="${mailto(T('Proposition d’exposition / collaboration', 'Exhibition / collaboration proposal'))}">${icon.mail}<span>${T('Proposer un projet', 'Propose a project')}</span></a>
      </div>
    </article>
  </div>
</section>

<section class="section paper">
  <div class="wrap">
    <div class="section-head reveal"><div><p class="eyebrow">${T('Commande sur mesure', 'Custom commission')}</p><h2 class="display">${T('Comment ça se passe', 'How it works')}</h2></div></div>
    <ol class="process">
      ${T(
        `<li class="reveal"><span class="step-n">01</span><h3>L’échange</h3><p>Vous décrivez votre idée par WhatsApp ou e-mail : sujet, dimensions, finition, références.</p></li>
      <li class="reveal"><span class="step-n">02</span><h3>La proposition</h3><p>L’artiste vous répond avec une approche, un prix et un délai de réalisation.</p></li>
      <li class="reveal"><span class="step-n">03</span><h3>La taille</h3><p>La pièce est sculptée à la main dans le bois brut, puis séchée et poncée.</p></li>
      <li class="reveal"><span class="step-n">04</span><h3>La validation</h3><p>Vous recevez des photos de l’œuvre achevée avant son départ de l’atelier.</p></li>
      <li class="reveal"><span class="step-n">05</span><h3>La livraison</h3><p>Emballage soigné et expédition vers votre adresse, ou retrait à ${site.city}.</p></li>`,
        `<li class="reveal"><span class="step-n">01</span><h3>The conversation</h3><p>You describe your idea by WhatsApp or email: subject, size, finish, references.</p></li>
      <li class="reveal"><span class="step-n">02</span><h3>The proposal</h3><p>The artist replies with an approach, a price and a timeline.</p></li>
      <li class="reveal"><span class="step-n">03</span><h3>The carving</h3><p>The piece is hand-carved from raw wood, then dried and sanded.</p></li>
      <li class="reveal"><span class="step-n">04</span><h3>Approval</h3><p>You receive photos of the finished work before it leaves the workshop.</p></li>
      <li class="reveal"><span class="step-n">05</span><h3>Delivery</h3><p>Careful packaging and shipping to your address, or pick-up in ${site.city}.</p></li>`
      )}
    </ol>
  </div>
</section>

<section class="section">
  <div class="wrap split">
    <div class="reveal"><p class="eyebrow">${T('Questions fréquentes', 'FAQ')}</p><h2 class="display">${T('Bon à savoir', 'Good to know')}</h2></div>
    <div class="faq reveal">
      ${faq()
        .map(([q, a]) => `<details><summary>${q}</summary><p>${a}</p></details>`)
        .join('\n      ')}
    </div>
  </div>
</section>
${ctaBand(T('Parlons de votre projet', 'Let’s talk about your project'), T('Une réponse directe de l’artiste, sur WhatsApp ou par e-mail.', 'A direct answer from the artist, on WhatsApp or by email.'))}`;

  return layout({
    alt: { fr: routes.fr.services, en: routes.en.services },
    title: T('Services — commandes sur mesure et vente de sculptures', 'Services — custom commissions and sculpture sales'),
    description: T(
      'Sculptures originales, commandes sur mesure, expédition internationale et expositions : les services de Romaric Lokonon, sculpteur sur bois au Bénin.',
      'Original sculptures, custom commissions, worldwide shipping and exhibitions: the services of Romaric Lokonon, wood sculptor in Benin.'
    ),
    image: ogOf(bySlug('les-batisseurs')),
    jsonld: graph(
      crumbsLd(crumbs),
      {
        '@type': 'Service',
        name: T('Sculpture sur bois sur mesure', 'Custom wood sculpture'),
        serviceType: T('Commande de sculpture en bois', 'Wood sculpture commission'),
        provider: { '@id': PERSON_ID },
        areaServed: 'Worldwide',
        description: T(
          'Masques, têtes, coiffes, figures et scènes narratives sculptés à la main en bois de gmélina, sur commande.',
          'Masks, heads, headdresses, figures and narrative scenes hand-carved in gmelina wood, to order.'
        ),
      },
      { '@type': 'FAQPage', mainEntity: faq().map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) },
      personLd()
    ),
    body,
  });
}

// ————————————————————————————————————————— page : à propos
function pageAbout() {
  const piece = bySlug('heritage-vivant');
  const crumbs = [[navLabels[LANG].home, R().home], [navLabels[LANG].about, R().about]];
  const body = `
${pageHead(
  T('À propos', 'About'),
  'Romaric <em>Lokonon</em>',
  inline(pg(pages.apropos, 'intro')),
  crumbs
)}
<section class="section section-tight">
  <div class="wrap about-grid">
    <figure class="about-figure reveal">
      ${cover(piece, { sizes: '(min-width: 900px) 40vw, 100vw' })}
      <figcaption><a href="${workUrl(piece)}"><em>${esc(L(piece).title)}</em></a> — ${esc(L(piece).material.toLowerCase())}</figcaption>
    </figure>
    <div class="prose prose-lg reveal">
      ${md(pg(pages.apropos, 'bio'))}
    </div>
  </div>
</section>

<section class="section craft">
  <div class="wrap">
    <div class="atelier-split">
      ${atelierFigure('reveal')}
      <div class="prose reveal">
        <p class="eyebrow">${T('Matière &amp; savoir-faire', 'Material &amp; craft')}</p>
        <h2 class="display">${T('Le bois de gmélina, le geste de la main.', 'Gmelina wood, the gesture of the hand.')}</h2>
        ${md(pg(pages.apropos, 'craft'))}
        <p class="signature"><span>Signature</span> ${T('Le détail des coiffures et l’expression des visages.', 'The detail of the headdresses and the expression of the faces.')}</p>
      </div>
    </div>
  </div>
</section>

<section class="section paper">
  <div class="wrap split">
    <div class="reveal"><p class="eyebrow">${T('Parcours', 'Journey')}</p><h2 class="display">${T('Repères', 'Milestones')}</h2></div>
    ${timeline()}
  </div>
</section>

<section class="section">
  <div class="wrap">
    <div class="section-head reveal"><div><p class="eyebrow">Inspirations</p><h2 class="display">${T('Ce que racontent les œuvres', 'What the works tell')}</h2></div></div>
    <div class="grid grid-3 themes">
      ${T(
        `<div class="theme reveal"><h3>La royauté &amp; la mémoire</h3><p>Le Danxomè, les têtes royales yoruba, la question du retour du patrimoine : <a href="${workUrl(bySlug('trone-royal-retour-aux-sources'))}">Trône royal</a>, <a href="${workUrl(bySlug('ori-iwa-la-tete-de-sagesse'))}">Ori Iwa</a>.</p></div>
      <div class="theme reveal"><h3>La parure &amp; la beauté</h3><p>Tresses, cauris, pétales, spirales : les coiffures disent le rang, l’élégance et le soin — <a href="${workUrl(bySlug('weziza'))}">Weziza</a>, <a href="${workUrl(bySlug('la-spirale-aerienne'))}">La spirale aérienne</a>.</p></div>
      <div class="theme reveal"><h3>La vie d’aujourd’hui</h3><p>Chantiers, routes, motos : le quotidien béninois prend place au sommet des têtes — <a href="${workUrl(bySlug('les-batisseurs'))}">Les bâtisseurs</a>, <a href="${workUrl(bySlug('a-deux-sur-la-moto'))}">À deux sur la moto</a>.</p></div>`,
        `<div class="theme reveal"><h3>Royalty &amp; memory</h3><p>Danxomè, Yoruba royal heads, the question of returning heritage: <a href="${workUrl(bySlug('trone-royal-retour-aux-sources'))}">Royal Throne</a>, <a href="${workUrl(bySlug('ori-iwa-la-tete-de-sagesse'))}">Ori Iwa</a>.</p></div>
      <div class="theme reveal"><h3>Adornment &amp; beauty</h3><p>Braids, cowries, petals, spirals: hairstyles speak of rank, elegance and care — <a href="${workUrl(bySlug('weziza'))}">Weziza</a>, <a href="${workUrl(bySlug('la-spirale-aerienne'))}">The Airy Spiral</a>.</p></div>
      <div class="theme reveal"><h3>Life today</h3><p>Building sites, roads, motorbikes: everyday Beninese life sits on top of the heads — <a href="${workUrl(bySlug('les-batisseurs'))}">The Builders</a>, <a href="${workUrl(bySlug('a-deux-sur-la-moto'))}">Two on a Motorbike</a>.</p></div>`
      )}
    </div>
  </div>
</section>
${ctaBand(
  T('Rencontrer l’artiste', 'Meet the artist'),
  T('Pour une acquisition, une commande, une exposition ou une interview, Romaric répond directement.', 'For an acquisition, a commission, an exhibition or an interview, Romaric answers directly.')
)}`;

  return layout({
    alt: { fr: routes.fr.about, en: routes.en.about },
    title: T('À propos — biographie et démarche du sculpteur', 'About — the sculptor’s biography and approach'),
    description: T(
      'Biographie de Romaric Lokonon, sculpteur sur bois né en 2001 à Covè (Bénin), fils du sculpteur Joachim Lokonon : démarche, parcours et savoir-faire.',
      'Biography of Romaric Lokonon, wood sculptor born in 2001 in Covè (Benin), son of sculptor Joachim Lokonon: approach, career and craft.'
    ),
    image: ogOf(piece),
    jsonld: graph(crumbsLd(crumbs), { '@type': 'ProfilePage', mainEntity: { '@id': PERSON_ID }, url: abs(R().about) }, personLd()),
    body,
  });
}

// ————————————————————————————————————————— page : contact
function pageContact() {
  const crumbs = [[navLabels[LANG].home, R().home], ['Contact', R().contact]];
  const subjects = T(
    ['Acquisition d’une œuvre', 'Commande sur mesure', 'Exposition / collaboration', 'Presse', 'Autre demande'],
    ['Acquiring a work', 'Custom commission', 'Exhibition / collaboration', 'Press', 'Other request']
  );
  const body = `
${pageHead(
  'Contact',
  T('Écrire à l’<em>artiste</em>', 'Write to the <em>artist</em>'),
  T(
    'Une question sur une œuvre, une commande sur mesure, une exposition ? Romaric vous répond directement, de préférence sur WhatsApp.',
    'A question about a work, a custom commission, an exhibition? Romaric answers you directly, preferably on WhatsApp.'
  ),
  crumbs
)}
<section class="section section-tight">
  <div class="wrap contact-grid">
    <div class="contact-cards">
      <a class="contact-card" href="${wa(T('Bonjour Romaric,', 'Hello Romaric,'))}" target="_blank" rel="noopener">${icon.wa}<span><small>${T('WhatsApp — réponse la plus rapide', 'WhatsApp — fastest reply')}</small>${site.phoneDisplay}</span></a>
      <a class="contact-card" href="tel:${site.phoneIntl}">${icon.phone}<span><small>${T('Téléphone', 'Phone')}</small>${site.phoneDisplay}</span></a>
      <a class="contact-card" href="mailto:${site.email}">${icon.mail}<span><small>E-mail</small>${site.email}</span></a>
      <a class="contact-card" href="https://www.openstreetmap.org/search?query=${encodeURIComponent('Agonlin Covè, Bénin')}" target="_blank" rel="noopener">${icon.pin}<span><small>${T('Atelier', 'Workshop')}</small>${site.city}, ${site.region} — ${text[LANG].country}</span></a>
    </div>
    <form class="contact-form" data-contact-form novalidate>
      <h2 class="display">${T('Votre message', 'Your message')}</h2>
      <p class="muted">${T(
        'Le formulaire prépare votre message dans WhatsApp ou dans votre messagerie : rien n’est stocké sur ce site.',
        'The form prepares your message in WhatsApp or your email app: nothing is stored on this site.'
      )}</p>
      <div class="field"><label for="f-name">${T('Nom', 'Name')}</label><input id="f-name" name="name" autocomplete="name" required></div>
      <div class="field"><label for="f-subject">${T('Objet', 'Subject')}</label>
        <select id="f-subject" name="subject">${subjects.map((s) => `<option>${s}</option>`).join('')}</select>
      </div>
      <div class="field"><label for="f-piece">${T('Œuvre concernée', 'Related work')} <span class="opt">(${T('facultatif', 'optional')})</span></label>
        <select id="f-piece" name="piece"><option value="">—</option>${oeuvres.map((o) => `<option>${esc(L(o).title)}</option>`).join('')}</select>
      </div>
      <div class="field"><label for="f-msg">Message</label><textarea id="f-msg" name="message" rows="5" required></textarea></div>
      <p class="form-error" data-form-error hidden>${T('Merci d’indiquer votre nom et votre message.', 'Please enter your name and your message.')}</p>
      <div class="actions">
        <button class="btn btn-light btn-wa" type="submit" value="whatsapp">${icon.wa}<span>${T('Envoyer via WhatsApp', 'Send via WhatsApp')}</span></button>
        <button class="btn btn-ghost-light" type="submit" value="email">${icon.mail}<span>${T('Envoyer par e-mail', 'Send by email')}</span></button>
      </div>
    </form>
  </div>
</section>`;

  return layout({
    alt: { fr: routes.fr.contact, en: routes.en.contact },
    title: T('Contact — WhatsApp, téléphone, e-mail', 'Contact — WhatsApp, phone, email'),
    description: T(
      `Contactez Romaric Lokonon, sculpteur sur bois au Bénin, par WhatsApp (${site.phoneDisplay}) ou e-mail : acquisitions, commandes sur mesure, expositions.`,
      `Contact Romaric Lokonon, wood sculptor in Benin, by WhatsApp (${site.phoneDisplay}) or email: acquisitions, custom commissions, exhibitions.`
    ),
    jsonld: graph(crumbsLd(crumbs), { '@type': 'ContactPage', url: abs(R().contact), about: { '@id': PERSON_ID } }, personLd()),
    body,
    bodyClass: 'page-contact',
  });
}

// ————————————————————————————————————————— pages annexes
function pageLegal() {
  const crumbs = [[navLabels[LANG].home, R().home], [T('Mentions légales', 'Legal notice'), R().legal]];
  const body = `
${pageHead(T('Informations', 'Information'), T('Mentions légales', 'Legal notice'), '', crumbs)}
<section class="section section-tight">
  <div class="wrap prose prose-narrow">
    <h2>${T('Éditeur du site', 'Site publisher')}</h2>
    <p>${T('Romaric Lokonon, sculpteur sur bois', 'Romaric Lokonon, wood sculptor')} — ${site.city}, ${site.region}, ${text[LANG].country}.<br>${T('Téléphone', 'Phone')} / WhatsApp : ${site.phoneDisplay} · E-mail : <a href="mailto:${site.email}">${site.email}</a></p>
    ${site.host ? `<h2>${T('Hébergement', 'Hosting')}</h2><p>${site.host}</p>` : ''}
    <h2>${T('Propriété intellectuelle', 'Intellectual property')}</h2>
    <p>${T(
      'Les œuvres présentées, leurs photographies et les textes de ce site sont la propriété de Romaric Lokonon. Toute reproduction, même partielle, est interdite sans autorisation écrite préalable.',
      'The works shown, their photographs and the texts on this site are the property of Romaric Lokonon. Any reproduction, even partial, is prohibited without prior written permission.'
    )}</p>
    <h2>${T('Prix et commandes', 'Prices and orders')}</h2>
    <p>${T(
      'Les prix sont indiqués en francs CFA (XOF), hors emballage et transport. La conversion en euros est donnée à titre indicatif (1&nbsp;€ = 655,957&nbsp;FCFA). Une demande de commande n’engage ni l’acheteur ni l’artiste : la vente est conclue après confirmation de la disponibilité, du transport et du paiement.',
      'Prices are shown in CFA francs (XOF), excluding packaging and shipping. Euro conversion is for reference only (€1 = 655.957&nbsp;FCFA). An order request does not commit either the buyer or the artist: the sale is concluded once availability, shipping and payment are confirmed.'
    )}</p>
    <h2>${T('Données personnelles', 'Personal data')}</h2>
    <p>${T(
      'Ce site ne dépose aucun cookie de suivi. Les informations saisies dans le formulaire de commande (nom, e-mail, téléphone, pays, message) sont transmises à l’artiste uniquement pour traiter votre demande et ne sont ni revendues ni utilisées à d’autres fins. Vous pouvez demander leur suppression à tout moment par e-mail.',
      'This site sets no tracking cookies. Information entered in the order form (name, email, phone, country, message) is sent to the artist solely to handle your request and is never sold or used for other purposes. You may ask for its deletion at any time by email.'
    )}</p>
  </div>
</section>`;
  return layout({
    alt: { fr: routes.fr.legal, en: routes.en.legal },
    title: T('Mentions légales', 'Legal notice'),
    description: T('Mentions légales du site de Romaric Lokonon, sculpteur sur bois au Bénin.', 'Legal notice for the website of Romaric Lokonon, wood sculptor in Benin.'),
    body,
  });
}

/** Page de confirmation pour l'envoi sans JavaScript (redirection Netlify Forms). */
function pageOrderSent() {
  return layout({
    alt: { fr: '/commande-envoyee/', en: '/en/order-sent/' },
    title: T('Demande envoyée', 'Request sent'),
    description: T('Votre demande de commande a bien été envoyée.', 'Your order request has been sent.'),
    noindex: true,
    body: `<section class="section notfound"><div class="wrap prose-narrow">
      <span class="result-icon">${icon.check}</span>
      <h1 class="display">${T('Merci, votre demande est bien envoyée !', 'Thank you, your request has been sent!')}</h1>
      <p class="lead">${T(
        'Nous allons prendre contact avec vous très rapidement par e-mail ou WhatsApp pour confirmer la disponibilité, le transport et le paiement.',
        'We will get in touch with you very soon by email or WhatsApp to confirm availability, shipping and payment.'
      )}</p>
      <div class="actions"><a class="btn btn-light" href="${R().works}">${T('Continuer la visite', 'Continue browsing')}</a></div>
    </div></section>`,
  });
}

function page404() {
  const o = bySlug('masque-wanyinan');
  return layout({
    alt: { fr: '/404.html', en: '/404.html' },
    title: 'Page introuvable · Page not found',
    description: 'Cette page n’existe pas ou a été déplacée.',
    noindex: true,
    body: `<section class="section notfound"><div class="wrap split">
      <div><p class="eyebrow">Erreur 404</p><h1 class="display">Cette page s’est perdue dans le bois.</h1><p class="lead">L’adresse demandée n’existe pas ou a été déplacée.<br><span lang="en">This page doesn’t exist or has moved.</span></p>
      <div class="actions"><a class="btn btn-light" href="/">Retour à l’accueil</a><a class="btn btn-ghost-light" href="/en/" lang="en">English home</a></div></div>
      <div>${cover(o, { sizes: '40vw' })}</div></div></section>`,
  });
}

// ————————————————————————————————————————— fichiers techniques SEO
function sitemap() {
  const pages = [
    ['home', '1.0', null],
    ['works', '0.9', null],
    ['services', '0.8', null],
    ['about', '0.8', null],
    ['contact', '0.6', null],
    ['legal', '0.2', null],
  ].map(([k, p]) => [{ fr: routes.fr[k], en: routes.en[k] }, p, null]);
  oeuvres.forEach((o) => pages.push([{ fr: workUrl(o, 'fr'), en: workUrl(o, 'en') }, o.cat === 'majeure' ? '0.8' : '0.7', o]));
  const entries = [];
  for (const [alt, prio, o] of pages) {
    for (const l of langs) {
      const alts = langs.map((x) => `\n    <xhtml:link rel="alternate" hreflang="${x}" href="${abs(alt[x])}"/>`).join('') + `\n    <xhtml:link rel="alternate" hreflang="x-default" href="${abs(alt.fr)}"/>`;
      const imgs = o ? o.images.map((_, i) => `\n    <image:image><image:loc>${abs(largest(`${o.slug}-${i + 1}`))}</image:loc></image:image>`).join('') : '';
      entries.push(`  <url>\n    <loc>${abs(alt[l])}</loc>\n    <lastmod>${BUILD_DATE}</lastmod>\n    <priority>${prio}</priority>${alts}${imgs}\n  </url>`);
    }
  }
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${entries.join('\n')}
</urlset>
`;
}

const robots = () => `User-agent: *
Allow: /
Disallow: /commande-envoyee/
Disallow: /en/order-sent/
Disallow: /admin/

Sitemap: ${abs('/sitemap.xml')}
`;

function llms() {
  LANG = 'en';
  const out = `# ${site.name}

> ${text.en.description}
> Site available in French (${abs('/')}) and English (${abs('/en/')}).

## Pages
- [Home](${abs('/en/')})
- [Works](${abs('/en/works/')}): ${oeuvres.length} sculptures with prices and dimensions; each page has an order form
- [Services](${abs('/en/services/')}): original works, custom commissions, worldwide shipping, collaborations
- [About](${abs('/en/about/')}): biography, approach, career
- [Contact](${abs('/en/contact/')}): WhatsApp ${site.phoneDisplay}, ${site.email}

## Works
${oeuvres.map((o) => `- [${L(o).title}](${abs(workUrl(o))}) — ${catLabel(o.cat)}${o.price ? `, ${o.price} FCFA` : ''}`).join('\n')}
`;
  LANG = 'fr';
  return out;
}

const webmanifest = () =>
  JSON.stringify(
    {
      name: text.fr.title,
      short_name: 'R. Lokonon',
      lang: 'fr',
      start_url: '/',
      display: 'standalone',
      background_color: '#0d0c0b',
      theme_color: '#0d0c0b',
      icons: [{ src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml' }],
    },
    null,
    2
  );

// Netlify : en-têtes de cache et de sécurité (ignoré par les autres hébergeurs)
const headers = () => `/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  X-Frame-Options: SAMEORIGIN
  Permissions-Policy: camera=(), microphone=(), geolocation=()

/img/*
  Cache-Control: public, max-age=31536000, immutable

/css/*
  Cache-Control: public, max-age=31536000, immutable

/js/*
  Cache-Control: public, max-age=31536000, immutable
`;

// ————————————————————————————————————————— construction
rmSync(DIST, { recursive: true, force: true });
mkdirSync(DIST, { recursive: true });
cpSync(join(ROOT, 'src/static'), DIST, { recursive: true });
// On ne publie que les images des œuvres actuelles (pas celles d'œuvres supprimées restées en cache)
const used = new Set(Object.entries(manifest).flatMap(([k, m]) => [...m.variants.map((v) => v.file), `${k}-og.jpg`]));
cpSync(IMG_DIR, join(DIST, 'img/oeuvres'), { recursive: true, filter: (p) => p === IMG_DIR || used.has(p.split('/').pop()) });
// Vignettes des photos sources, aux adresses /media/… utilisées par l'administration
const thumbs = new Set(oeuvres.flatMap((o) => o.images));
cpSync(join(CACHE, 'media'), join(DIST, 'media'), { recursive: true, filter: (p) => p === join(CACHE, 'media') || thumbs.has(p.split('/').pop()) });

let count = 0;
for (const lang of langs) {
  LANG = lang;
  const r = routes[lang];
  write(r.home, pageHome());
  write(r.works, pageCollection());
  oeuvres.forEach((o, i) => write(workUrl(o), pageOeuvre(o, i)));
  write(r.services, pageServices());
  write(r.about, pageAbout());
  write(r.contact, pageContact());
  write(r.legal, pageLegal());
  write(T('/commande-envoyee/', '/en/order-sent/'), pageOrderSent());
  count += oeuvres.length + 7;
}
LANG = 'fr';
write('404.html', page404());
write('sitemap.xml', sitemap());
write('robots.txt', robots());
write('llms.txt', llms());
write('site.webmanifest', webmanifest());
write('_headers', headers());

console.log(`✓ Site généré dans dist/ — ${oeuvres.length} œuvres × 2 langues, ${count + 1} pages.`);
