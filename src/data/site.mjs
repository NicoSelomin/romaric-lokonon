// Configuration technique du site.
// Les coordonnées, le parcours et les textes éditables sont dans content/ (modifiables depuis /admin).
import { readFileSync } from 'node:fs';

const json = (f) => JSON.parse(readFileSync(new URL(`../../content/${f}`, import.meta.url), 'utf8'));
const reglages = json('reglages.json');

export const site = {
  // ⚠️ Remplacer par le nom de domaine définitif (sans slash final).
  url: 'https://romaric-lokonon.netlify.app',
  name: 'Romaric Lokonon',
  phoneDisplay: reglages.phone_display,
  phoneIntl: '+' + reglages.whatsapp.replace(/\D/g, ''),
  whatsapp: reglages.whatsapp.replace(/\D/g, ''),
  email: reglages.email,
  city: reglages.city,
  region: reglages.region,
  countryCode: 'BJ',
  eurRate: 655.957, // 1 € = 655,957 FCFA (parité fixe)
  host: 'Netlify, Inc. — San Francisco, Californie, États-Unis (www.netlify.com)',
  social: (reglages.social || []).filter((s) => s && s.url),
  // Nom du formulaire de commande (Netlify Forms)
  orderFormName: 'commande',
};

export const langs = ['fr', 'en'];

export const text = {
  fr: {
    locale: 'fr_FR',
    country: 'Bénin',
    title: 'Romaric Lokonon — Sculpteur sur bois, Bénin',
    description:
      'Romaric Lokonon, sculpteur sur bois à Agonlin Covè (Bénin) : masques, têtes et figures en gmélina sculptés à la main. Œuvres originales et commandes sur mesure.',
  },
  en: {
    locale: 'en_US',
    country: 'Benin',
    title: 'Romaric Lokonon — Wood sculptor, Benin',
    description:
      'Romaric Lokonon, wood sculptor in Agonlin Covè, Benin: masks, heads and figures hand-carved in gmelina wood. Original works and commissions, shipped worldwide.',
  },
};

export const routes = {
  fr: { home: '/', works: '/oeuvres/', services: '/services/', about: '/a-propos/', contact: '/contact/', legal: '/mentions-legales/' },
  en: { home: '/en/', works: '/en/works/', services: '/en/services/', about: '/en/about/', contact: '/en/contact/', legal: '/en/legal/' },
};

export const navLabels = {
  fr: { home: 'Accueil', works: 'Œuvres', services: 'Services', about: 'À propos', contact: 'Contact' },
  en: { home: 'Home', works: 'Works', services: 'Services', about: 'About', contact: 'Contact' },
};

export const categories = {
  majeure: { fr: 'Œuvres majeures', en: 'Major works' },
  portrait: { fr: 'Portraits & coiffures', en: 'Portraits & headdresses' },
  narrative: { fr: 'Œuvres narratives', en: 'Narrative works' },
  masque: { fr: 'Masques', en: 'Masks' },
};

export const parcours = json('parcours.json').items.map((p) => ({ year: p.year, fr: p.text_fr, en: p.text_en }));
