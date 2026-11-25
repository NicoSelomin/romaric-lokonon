/* Romaric Lokonon — interactions (vanilla, sans dépendance) */
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const EN = document.documentElement.lang === 'en';
  const t = (fr, en) => (EN ? en : fr);
  const WA = '2290154003164';
  const MAIL = 'lokononromaric19@gmail.com';
  document.documentElement.classList.add('js');

  // En-tête : ombre au défilement
  const header = $('[data-header]');
  const onScroll = () => header && header.classList.toggle('is-scrolled', window.scrollY > 8);
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // Menu mobile
  const toggle = $('[data-nav-toggle]');
  const menu = $('#menu');
  const setMenu = (open) => {
    toggle.setAttribute('aria-expanded', String(open));
    menu.classList.toggle('is-open', open);
    document.body.classList.toggle('nav-open', open);
  };
  toggle?.addEventListener('click', () => setMenu(toggle.getAttribute('aria-expanded') !== 'true'));
  addEventListener('keydown', (e) => e.key === 'Escape' && toggle?.getAttribute('aria-expanded') === 'true' && setMenu(false));
  matchMedia('(min-width: 901px)').addEventListener('change', (e) => e.matches && setMenu(false));

  // Changement de langue : conserve les filtres (?cat=…&tri=…) et mémorise le choix
  $$('[data-lang-link]').forEach((a) =>
    a.addEventListener('click', () => {
      try { localStorage.setItem('lang', a.hreflang); } catch (_) {}
      if (location.search) a.href = a.getAttribute('href').split('?')[0] + location.search;
    })
  );

  // Apparition au défilement
  const reveals = $$('.reveal');
  if ('IntersectionObserver' in window && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const io = new IntersectionObserver(
      (entries) => entries.forEach((en) => en.isIntersecting && (en.target.classList.add('is-in'), io.unobserve(en.target))),
      { rootMargin: '0px 0px -8% 0px', threshold: 0.08 }
    );
    reveals.forEach((el) => io.observe(el));
  } else reveals.forEach((el) => el.classList.add('is-in'));

  // Collection : filtres + tri (état reflété dans l'URL : ?cat=masque&tri=asc)
  const filters = $('[data-filters]');
  if (filters) {
    const grid = $('[data-grid]');
    const cards = $$('.card', grid);
    const original = cards.slice();
    const count = $('[data-count]');
    const sortSel = $('[data-sort]');
    const params = new URLSearchParams(location.search);
    let cat = params.get('cat') || 'tout';
    if (!$(`[data-filter="${cat}"]`, filters)) cat = 'tout';
    sortSel.value = ['asc', 'desc'].includes(params.get('tri')) ? params.get('tri') : 'defaut';

    const apply = (push) => {
      $$('[data-filter]', filters).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.filter === cat)));
      let shown = 0;
      cards.forEach((c) => {
        const ok = cat === 'tout' || c.dataset.cat === cat;
        c.hidden = !ok;
        if (ok) shown++;
      });
      const mode = sortSel.value;
      const price = (c) => (c.dataset.price ? +c.dataset.price : null);
      const ordered =
        mode === 'defaut'
          ? original
          : cards.slice().sort((a, b) => {
              const pa = price(a), pb = price(b);
              if (pa === null) return 1; // « prix sur demande » toujours à la fin
              if (pb === null) return -1;
              return mode === 'asc' ? pa - pb : pb - pa;
            });
      ordered.forEach((c) => grid.appendChild(c));
      count.textContent = `${shown} ${t('œuvre', 'work')}${shown > 1 ? 's' : ''}`;
      if (push) {
        const p = new URLSearchParams();
        if (cat !== 'tout') p.set('cat', cat);
        if (mode !== 'defaut') p.set('tri', mode);
        history.replaceState(null, '', p.toString() ? `?${p}` : location.pathname);
      }
    };
    filters.addEventListener('click', (e) => {
      const b = e.target.closest('[data-filter]');
      if (!b) return;
      cat = b.dataset.filter;
      apply(true);
    });
    sortSel.addEventListener('change', () => apply(true));
    apply(false);
  }

  // Page œuvre : galerie + visionneuse plein écran
  const gallery = $('[data-gallery]');
  if (gallery) {
    const mainBtn = $('[data-open]', gallery);
    const mainImg = $('img', mainBtn);
    const thumbs = $$('.thumb', gallery);
    const lb = $('[data-lightbox]');
    const lbImg = $('[data-lb-img]', lb);
    const fulls = thumbs.length ? thumbs.map((x) => ({ src: x.dataset.full, alt: x.dataset.alt })) : [{ src: mainImg.currentSrc || mainImg.src, alt: mainImg.alt }];
    let index = 0;

    const show = (i) => {
      index = (i + fulls.length) % fulls.length;
      const th = thumbs[index];
      if (th) {
        mainImg.style.opacity = '0';
        setTimeout(() => {
          mainImg.srcset = th.dataset.srcset;
          mainImg.alt = th.dataset.alt;
          mainImg.style.opacity = '1';
        }, 160);
        thumbs.forEach((x, k) => x.setAttribute('aria-current', String(k === index)));
      }
      lbImg.src = fulls[index].src;
      lbImg.alt = fulls[index].alt;
    };
    thumbs.forEach((th, i) => th.addEventListener('click', () => show(i)));
    lb.classList.toggle('single', fulls.length < 2);
    mainBtn.addEventListener('click', () => {
      lbImg.src = fulls[index].src;
      lbImg.alt = fulls[index].alt;
      lb.showModal();
    });
    $('[data-close]', lb).addEventListener('click', () => lb.close());
    lb.addEventListener('click', (e) => e.target === lb && lb.close());
    $$('[data-step]', lb).forEach((b) => b.addEventListener('click', () => show(index + +b.dataset.step)));
    lb.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') show(index + 1);
      if (e.key === 'ArrowLeft') show(index - 1);
    });
    let x0 = null;
    lb.addEventListener('touchstart', (e) => (x0 = e.touches[0].clientX), { passive: true });
    lb.addEventListener('touchend', (e) => {
      if (x0 === null) return;
      const dx = e.changedTouches[0].clientX - x0;
      if (Math.abs(dx) > 40) show(index + (dx < 0 ? 1 : -1));
      x0 = null;
    });
  }

  // Page œuvre : fenêtre « Passer commande »
  // Envoi vers Netlify Forms (POST encodé). En local (localhost), l'envoi est simulé pour tester l'interface.
  const modal = $('[data-order-modal]');
  if (modal) {
    const form = $('[data-order-form]', modal);
    const steps = $$('[data-step]', modal);
    const err = $('[data-form-error]', form);
    const submit = $('button[type="submit"]', form);
    const showStep = (name) => {
      steps.forEach((s) => (s.hidden = s.dataset.step !== name));
      const visible = $(`[data-step="${name}"]`, modal);
      if (name !== 'form') visible.focus();
    };
    const open = () => {
      showStep('form');
      modal.showModal();
      setTimeout(() => form.elements.nom.focus(), 50);
    };
    $$('[data-order-open]').forEach((b) => b.addEventListener('click', open));
    $$('[data-close]', modal).forEach((b) => b.addEventListener('click', () => modal.close()));
    modal.addEventListener('click', (e) => e.target === modal && modal.close());

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = form.elements;
      const required = ['nom', 'email', 'telephone', 'pays'];
      const missing = required.find((n) => !f[n].value.trim() || (n === 'email' && !f[n].checkValidity()));
      required.forEach((n) => f[n].setAttribute('aria-invalid', String(!f[n].value.trim() || (n === 'email' && !f[n].checkValidity()))));
      if (missing) {
        err.hidden = false;
        f[missing].focus();
        return;
      }
      err.hidden = true;
      submit.disabled = true;
      submit.classList.add('is-loading');
      const data = new FormData(form);
      let ok = false;
      try {
        if (['localhost', '127.0.0.1'].includes(location.hostname)) {
          await new Promise((r) => setTimeout(r, 700)); // simulation en local
          ok = true;
        } else {
          const res = await fetch('/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams(data).toString(),
          });
          ok = res.ok;
        }
      } catch (_) {
        ok = false;
      }
      submit.disabled = false;
      submit.classList.remove('is-loading');
      if (ok) {
        form.reset();
        showStep('done');
      } else {
        const g = (k) => (data.get(k) || '').toString().trim();
        const text = t(
          `Bonjour Romaric, je souhaite commander l'œuvre « ${g('oeuvre')} » (${g('page')}).\n\nNom : ${g('nom')}\nE-mail : ${g('email')}\nTéléphone : ${g('telephone')}\nPays : ${g('pays')} ${g('ville')}\n\n${g('message')}`,
          `Hello Romaric, I would like to order the work “${g('oeuvre')}” (${g('page')}).\n\nName: ${g('nom')}\nEmail: ${g('email')}\nPhone: ${g('telephone')}\nCountry: ${g('pays')} ${g('ville')}\n\n${g('message')}`
        );
        $('[data-wa-fallback]', modal).href = `https://wa.me/${WA}?text=${encodeURIComponent(text.trim())}`;
        showStep('error');
      }
    });
  }

  // Contact : le formulaire compose un message WhatsApp ou e-mail (aucune donnée stockée)
  const cform = $('[data-contact-form]');
  if (cform) {
    cform.addEventListener('submit', (e) => {
      e.preventDefault();
      const d = new FormData(cform);
      const name = (d.get('name') || '').trim();
      const msg = (d.get('message') || '').trim();
      const err = $('[data-form-error]', cform);
      if (!name || !msg) {
        err.hidden = false;
        (!name ? cform.elements.name : cform.elements.message).focus();
        return;
      }
      err.hidden = true;
      const subject = d.get('subject');
      const piece = d.get('piece');
      const text = `${t('Bonjour Romaric,', 'Hello Romaric,')}\n\n${msg}\n\n— ${name}\n${t('Objet', 'Subject')} : ${subject}${piece ? `\n${t('Œuvre', 'Work')} : ${piece}` : ''}`;
      if (e.submitter && e.submitter.value === 'email') {
        location.href = `mailto:${MAIL}?subject=${encodeURIComponent(`${subject}${piece ? ` — ${piece}` : ''}`)}&body=${encodeURIComponent(text)}`;
      } else {
        window.open(`https://wa.me/${WA}?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
      }
    });
  }
})();
