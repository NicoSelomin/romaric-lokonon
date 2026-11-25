# Romaric Lokonon — site portfolio

Site vitrine et catalogue de Romaric Lokonon, sculpteur sur bois à Agonlin Covè (Bénin).
Site **statique** généré par un petit script Node, sans aucune dépendance npm. Il est rapide, simple à héberger et pensé pour le référencement.

## Commandes

```bash
npm run build   # génère dist/ (la 1re fois, ~1 min pour optimiser les 62 photos ; ensuite tout vient du cache)
npm run serve   # aperçu sur http://localhost:4173
```

Prérequis : Node ≥ 18 et Python 3 avec Pillow (`pip install pillow`).

## En ligne

- Site : https://romaric-lokonon.netlify.app — administration : https://app.netlify.com/projects/romaric-lokonon
- **Mettre à jour le site** : `PATH=$HOME/.nvm/versions/node/v22.23.2/bin:$PATH npm run deploy`. Netlify CLI 27 demande Node ≥ 22.13, alors que le Node par défaut de la machine est en 20.11.
- Commandes reçues : tableau de bord Netlify → Forms → `commande`. Une notification part aussi par e-mail à lokononromaric19@gmail.com.
- La protection « connexion d'équipe » de Netlify est désactivée : le site est public.

## Administration (sans toucher au code)

L'administration se trouve sur https://romaric-lokonon.netlify.app/admin/ : connexion avec un compte GitHub qui a accès au dépôt.
- **Œuvres** : ajouter, modifier ou supprimer une œuvre (photos, prix, textes FR/EN, statut « Vendue », masquer sans supprimer, ordre d'affichage).
- **Pages du site** : textes de l'accueil et de la page À propos, parcours, FAQ, coordonnées et réseaux sociaux.
- Chaque enregistrement crée un commit sur GitHub ; Netlify reconstruit alors le site en 2 à 3 minutes.
- Pour tester l'administration en local : lancer `npm run admin:local` et `npm run serve`, puis ouvrir http://localhost:4173/admin/.

Le contenu est stocké dans `content/` (un fichier JSON par œuvre) et les photos d'origine dans `assets-src/media/`.

## Structure

| Chemin | Rôle |
|---|---|
| `src/data/site.mjs` | Domaine, coordonnées, parcours, catégories |
| `content/` | **Contenu éditable** : œuvres, textes, parcours, FAQ, coordonnées (géré par /admin) |
| `src/data/content.mjs` | Lecture du contenu + mini-Markdown |
| `assets-src/media/` | Photos originales (extraites du portfolio Word) |
| `src/static/` | CSS, JS, favicon, copiés tels quels |
| `scripts/images.py` | Conversion WebP responsive (480/900/1500 px) + images de partage 1200×630 |
| `build.mjs` | Gabarits HTML, SEO, sitemap |
| `dist/` | Site final à mettre en ligne |

**Ajouter une œuvre** : de préférence via /admin. À la main : déposer les photos dans `assets-src/media/` et créer un fichier `content/oeuvres/<adresse>.json`.

## Pages générées (91 pages, FR + EN)

Français à la racine (`/`, `/oeuvres/…`), anglais sous `/en/` (`/en/works/…`), avec un sélecteur FR/EN dans l'en-tête qui renvoie vers la page équivalente.
Accueil · Œuvres (filtres et tri) · 38 fiches œuvres · Services (avec FAQ) · À propos · Contact · Mentions légales · 404.
Les traductions anglaises des œuvres se trouvent dans `src/data/oeuvres.en.mjs`. Les textes des pages sont dans `build.mjs`, sous la forme `T('français', 'english')`.

## Bouton « Passer commande »

Chaque fiche œuvre ouvre une fenêtre avec un formulaire (nom, e-mail, téléphone/WhatsApp, pays, ville, message), puis affiche un message de confirmation.
- L'envoi passe par **Netlify Forms** : le formulaire s'appelle `commande`. Les demandes arrivent dans le tableau de bord Netlify, qui peut aussi les transférer par e-mail (Forms → Notifications).
- En local (`localhost`), l'envoi est **simulé** : on peut tester l'interface, mais rien n'est envoyé.
- En cas d'échec réseau, le client se voit proposer d'envoyer la même demande par WhatsApp, avec le message déjà rédigé.
- Sur un autre hébergeur que Netlify, il faut remplacer l'URL du `fetch` dans `src/static/js/main.js` (Formspree, Web3Forms…).

## SEO inclus

- Balises title et description propres à chaque page, URL canonique, Open Graph et Twitter Card (image 1200×630 par œuvre)
- Données structurées JSON-LD : `Person`, `WebSite`, `VisualArtwork` + `Product`/`Offer` (prix en XOF), `BreadcrumbList`, `FAQPage`, `Service`, `CollectionPage`
- `sitemap.xml` avec sitemap images, `robots.txt`, `llms.txt`
- Textes alternatifs descriptifs, images WebP dimensionnées (pas de décalage de mise en page), chargement différé, un seul H1 par page, HTML sémantique, navigation au clavier, `prefers-reduced-motion`

## À faire avant la mise en ligne

1. **Domaine** : remplacer `url` dans `src/data/site.mjs`, puis relancer le build.
2. **Hébergement** : envoyer `dist/` sur Netlify, Cloudflare Pages, GitHub Pages ou un hébergement mutualisé. Configurer `404.html` comme page d'erreur. Renseigner `host` dans `site.mjs` pour les mentions légales.
3. **Google Search Console** : déclarer le site et soumettre `sitemap.xml`. Créer aussi une fiche **Google Business Profile** (atelier à Agonlin Covè).
4. **Réseaux sociaux** : ajouter les URL dans `social` (`site.mjs`). Elles alimentent le `sameAs` du JSON-LD.
5. Informations encore manquantes dans le portfolio Word (voir ci-dessous).

## Informations à compléter (reprises du document Word)

- Dimensions manquantes : Trône royal, Héritage vivant, Gambada, Les bâtisseurs, Ori Iwa, Quatre têtes tressées, Portrait serein, Portrait à la boucle d'oreille, Dadobo, Zotchedte, Abigaël, Houédanou.
- Prix manquants : les 8 masques (Espoir, Alougba, Cossi, Wanyinan, Dadobo, Zotchedte, Abigaël, Houédanou). Ils s'affichent « Prix sur demande ».
- **Prix contradictoires** dans le Word : le tableau « Catalogue » (section 6) ne donne pas les mêmes prix que les fiches (section 5). Le site reprend les **fiches**.
  Exemples : Spirale aérienne 250 000 contre 200 000 ; Visage aux calebasses 120 000 contre 70 000 ; Profil au dôme torsadé 100 000 contre 60 000.
- « Portrait à la coupe courte » n'a pas de photo. Il n'est donc pas publié.
- Plusieurs titres sont marqués « à confirmer » dans le Word.
- Texte précis sur l'expérience au Qatar ; photos de l'atelier ; certificat d'authenticité ; délais de commande ; modalités d'expédition.
- Photo de l'atelier (`assets-src/media/atelier-1.png`) : recadrée depuis une capture d'écran, donc seulement 515 px de large. La remplacer par l'original en haute définition (même nom de fichier).
- Polices : chargées depuis Google Fonts. Pour une conformité RGPD stricte, les héberger localement.
