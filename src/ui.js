import {
  PROJECTS,
  FEATURED,
  MORE,
  SKILLS,
  EXPERIENCE,
  QUOTES,
  ABOUT,
  CONTACT_MAIL,
  CATEGORIES,
  CATEGORY_LABELS,
  STATUS_LABELS,
} from './content.js';
import {
  esc,
  safeHref,
  externalAttrs,
  paragraphs,
  statusMarkup,
  chips,
  featuredCard,
  indexRow,
  skillsMarkup,
  timelineMarkup,
  aboutLeadMarkup,
  aboutListMarkup,
  notesMarkup,
  navMarkup,
  socialsMarkup,
  workFiltersMarkup,
} from './markup.js';
import { daynight } from './core/daynight.js';
import { initAudio } from './audio.js';

const BASE_TITLE = document.title;
const $ = (id) => document.getElementById(id);
const projectBySlug = new Map(PROJECTS.map((project) => [project.slug, project]));
const PAGE_REGIONS = ['header.chrome', '#content']
  .map((selector) => document.querySelector(selector))
  .filter(Boolean);
const NAV_BACKGROUND_REGIONS = ['#content', '.brand', '.chrome-end']
  .map((selector) => document.querySelector(selector))
  .filter(Boolean);
const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)');
const scrollBehavior = () => (REDUCED_MOTION.matches ? 'auto' : 'smooth');

/* ---------- build ---------- */

function setWorkView(filter) {
  const isAll = filter === 'all';
  const featured = $('work-featured');
  const rows = [...document.querySelectorAll('#work-index .work-row')];
  let visible = 0;

  rows.forEach((row) => {
    const show = isAll ? row.dataset.featured !== 'true' : row.dataset.category === filter;
    row.hidden = !show;
    if (show) {
      visible += 1;
      const number = row.querySelector('.work-row-no');
      if (number) number.textContent = String(visible).padStart(2, '0');
    }
  });

  featured.hidden = !isAll;
  $('work').classList.toggle('is-filtered', !isAll);

  const label = CATEGORIES.find((category) => category.id === filter)?.label ?? 'All';
  $('work-index-title').textContent = isAll ? 'More work' : label;
  $('work-count').textContent = isAll
    ? `${MORE.length} more ${MORE.length === 1 ? 'project' : 'projects'}`
    : `${visible} ${visible === 1 ? 'project' : 'projects'}`;
  $('work-empty').hidden = visible > 0;
}

function renderWork() {
  $('work-featured').innerHTML = FEATURED.map((project) => featuredCard(project, PROJECTS.indexOf(project))).join('');
  $('work-index').innerHTML = PROJECTS.map((project, index) => indexRow(project, index)).join('');

  const filters = $('work-filters');
  filters.innerHTML = workFiltersMarkup();

  filters.addEventListener('click', (event) => {
    const button = event.target.closest('[data-filter]');
    if (!button) return;
    filters.querySelectorAll('[data-filter]').forEach((item) => {
      item.setAttribute('aria-pressed', String(item === button));
    });
    setWorkView(button.dataset.filter);
  });

  setWorkView('all');
}

function renderSkills() {
  $('skills-grid').innerHTML = skillsMarkup(SKILLS);
}

function renderTimeline() {
  $('timeline').innerHTML = timelineMarkup(EXPERIENCE);
}

/* ---------- drawer ---------- */

let drawerOpen = false;
let lastFocused = null;

function systemCard(system) {
  const link = safeHref(system.link);
  return `<article class="system">
    ${
      system.image
        ? `<div class="system-image"><img src="${esc(safeHref(system.image))}" alt="${esc(system.imageAlt || '')}" loading="lazy" decoding="async" /></div>`
        : ''
    }
    <div class="system-head">
      <h4 class="system-title">${esc(system.name)}</h4>
      ${statusMarkup(system.status)}
    </div>
    ${system.summary ? `<p class="system-summary">${esc(system.summary)}</p>` : ''}
    ${chips(system.stack)}
    ${link ? `<a class="system-link" href="${esc(link)}"${externalAttrs(link)}>Open <span aria-hidden="true">↗</span><span class="sr-only"> (opens in new tab)</span></a>` : ''}
  </article>`;
}

function drawerMarkup(project) {
  const index = PROJECTS.indexOf(project);
  const next = PROJECTS[(index + 1) % PROJECTS.length];
  const link = safeHref(project.link);
  const repo = safeHref(project.repo);
  const cover = safeHref(project.cover);
  const caseStudy = project.caseStudy || {};
  const systems = project.systems || [];
  const gallery = (project.gallery || []).map((src) => safeHref(src)).filter(Boolean);
  const galleryAlt = project.galleryAlt || [];
  const meta = [
    ['Role', project.role],
    ['Period', project.period],
    ['Status', STATUS_LABELS[project.status] || project.status],
  ].filter(([, value]) => value);

  return `
    <header class="drawer-head">
      ${
        project.logo
          ? `<img class="drawer-logo" src="${esc(safeHref(project.logo))}" alt="" loading="lazy" decoding="async" />`
          : ''
      }
      <p class="kicker">${esc(CATEGORY_LABELS[project.category] || project.category || 'Project')}${
        project.kind === 'ecosystem' ? ' · Ecosystem' : ''
      }</p>
      <h2 id="drawer-title" class="drawer-title">${esc(project.title)}</h2>
      ${project.hook ? `<p class="drawer-hook">${esc(project.hook)}</p>` : ''}
      ${
        meta.length
          ? `<dl class="drawer-meta">${meta
              .map(([key, value]) => `<div><dt>${esc(key)}</dt><dd>${esc(value)}</dd></div>`)
              .join('')}</dl>`
          : ''
      }
      ${chips(project.stack, 'chips chips--drawer')}
      ${
        link || repo
          ? `<div class="drawer-actions">
              ${link ? `<a class="btn btn--solid" href="${esc(link)}"${externalAttrs(link)}>Visit live <span aria-hidden="true">↗</span></a>` : ''}
              ${repo ? `<a class="btn" href="${esc(repo)}"${externalAttrs(repo)}>View code <span aria-hidden="true">↗</span></a>` : ''}
            </div>`
          : ''
      }
    </header>
    ${cover ? `<figure class="drawer-cover"><img src="${esc(cover)}" alt="${esc(project.coverAlt || `${project.title} preview`)}" loading="lazy" decoding="async" /></figure>` : ''}
    ${project.text ? `<section class="drawer-section"><h3>Overview</h3>${paragraphs(project.text)}</section>` : ''}
    ${caseStudy.problem ? `<section class="drawer-section"><h3>The problem</h3>${paragraphs(caseStudy.problem)}</section>` : ''}
    ${caseStudy.approach ? `<section class="drawer-section"><h3>The approach</h3>${paragraphs(caseStudy.approach)}</section>` : ''}
    ${
      systems.length
        ? `<section class="drawer-section"><h3>Inside the ecosystem</h3><div class="systems-grid">${systems
            .map(systemCard)
            .join('')}</div></section>`
        : ''
    }
    ${
      gallery.length
        ? `<section class="drawer-section"><h3>More views</h3><div class="drawer-gallery">${gallery
            .map(
              (src, index) =>
                `<img src="${esc(src)}" alt="${esc(galleryAlt[index] || `${project.title} — view ${index + 1}`)}" loading="lazy" decoding="async" />`
            )
            .join('')}</div></section>`
        : ''
    }
    ${
      project.highlights && project.highlights.length
        ? `<section class="drawer-section"><h3>What stands out</h3><ul class="drawer-highlights">${project.highlights
            .map((highlight) => `<li>${esc(highlight)}</li>`)
            .join('')}</ul></section>`
        : ''
    }
    ${caseStudy.outcome ? `<section class="drawer-section"><h3>The outcome</h3>${paragraphs(caseStudy.outcome)}</section>` : ''}
    ${caseStudy.learned ? `<section class="drawer-section"><h3>What I learned</h3>${paragraphs(caseStudy.learned)}</section>` : ''}
    <footer class="drawer-footer">
      <p class="drawer-footer-label">Next project</p>
      <button class="drawer-next" type="button" data-open-project="${esc(next.slug)}">
        <span>${esc(next.title)}</span>
        <span aria-hidden="true">→</span>
      </button>
    </footer>
  `;
}

function openProject(slug, { updateHash = true } = {}) {
  const project = projectBySlug.get(slug);
  if (!project) return;

  if (updateHash && window.location.hash !== `#project/${slug}`) {
    window.location.hash = `#project/${slug}`;
    return;
  }

  const drawer = $('project-drawer');
  const body = $('drawer-body');
  const panel = drawer.querySelector('.drawer-panel');

  if (!drawerOpen) {
    lastFocused = document.activeElement;
    drawer.hidden = false;
    document.documentElement.classList.add('drawer-open');
    PAGE_REGIONS.forEach((region) => {
      region.inert = true;
    });
    drawerOpen = true;
  }

  body.innerHTML = drawerMarkup(project);
  body.scrollTop = 0;
  panel.focus({ preventScroll: true });
  document.title = `${project.title} — ${BASE_TITLE}`;
}

function closeDrawer({ updateHistory = true } = {}) {
  if (!drawerOpen) return;
  drawerOpen = false;
  $('project-drawer').hidden = true;
  $('drawer-body').innerHTML = '';
  document.documentElement.classList.remove('drawer-open');
  PAGE_REGIONS.forEach((region) => {
    region.inert = false;
  });
  document.title = BASE_TITLE;

  if (updateHistory && window.location.hash.startsWith('#project/')) {
    history.replaceState('', document.title, window.location.pathname + window.location.search);
  }

  if (lastFocused && typeof lastFocused.focus === 'function') {
    lastFocused.focus({ preventScroll: true });
  }
  lastFocused = null;
}

function scrollToWork() {
  const work = $('work');
  if (!work) return;
  window.scrollTo({
    top: work.getBoundingClientRect().top + window.scrollY,
    behavior: scrollBehavior(),
  });
}

function syncDrawerFromHash() {
  const match = window.location.hash.match(/^#project\/([a-z0-9-]+)$/);
  if (match) {
    const work = $('work');
    if (work && window.scrollY < work.offsetTop - window.innerHeight * 0.5) {
      window.scrollTo({ top: work.offsetTop, behavior: 'auto' });
    }
    openProject(match[1], { updateHash: false });
  } else {
    closeDrawer({ updateHistory: false });
  }
}

function initDrawer() {
  const drawer = $('project-drawer');

  document.addEventListener('click', (event) => {
    const opener = event.target.closest('[data-open-project]');
    if (opener) {
      event.preventDefault();
      openProject(opener.dataset.openProject);
      return;
    }
    const closer = event.target.closest('[data-drawer-close]');
    if (closer) {
      event.preventDefault();
      const returnToWork = Boolean(closer.closest('[data-return-work]'));
      closeDrawer();
      if (returnToWork) {
        window.setTimeout(scrollToWork, 0);
      }
    }
  });

  document.addEventListener('keydown', (event) => {
    if (!drawerOpen) return;

    if (event.key === 'Escape') {
      event.preventDefault();
      closeDrawer();
      return;
    }

    if (event.key !== 'Tab') return;

    const panel = drawer.querySelector('.drawer-panel');
    const focusable = [...drawer.querySelectorAll('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])')].filter(
      (element) => element.offsetParent !== null
    );
    if (!focusable.length) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (event.shiftKey && (document.activeElement === first || document.activeElement === panel)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });

  window.addEventListener('hashchange', syncDrawerFromHash);
  syncDrawerFromHash();
}

/* ---------- nav ---------- */

function buildNav() {
  $('site-nav').innerHTML = navMarkup();
}

function initNav() {
  const nav = $('site-nav');
  const toggle = $('nav-toggle');
  const label = $('nav-toggle-label');
  let open = false;
  let lastFocused = null;

  const setOpen = (next, { restoreFocus = true } = {}) => {
    open = next;
    nav.classList.toggle('open', open);
    toggle.setAttribute('aria-expanded', String(open));
    if (label) label.textContent = open ? 'Close menu' : 'Menu';
    document.documentElement.classList.toggle('nav-open', open);
    NAV_BACKGROUND_REGIONS.forEach((region) => {
      region.inert = open;
    });

    if (open) {
      lastFocused = document.activeElement;
      window.requestAnimationFrame(() => nav.querySelector('a')?.focus({ preventScroll: true }));
    } else if (restoreFocus) {
      const target = lastFocused || toggle;
      target.focus({ preventScroll: true });
      lastFocused = null;
    }
  };

  toggle.addEventListener('click', () => setOpen(!open));

  nav.addEventListener('click', (event) => {
    if (event.target.closest('a')) setOpen(false);
  });

  document.addEventListener('keydown', (event) => {
    if (!open) return;

    if (event.key === 'Escape') {
      event.preventDefault();
      setOpen(false);
      return;
    }

    if (event.key !== 'Tab') return;

    const focusable = [toggle, ...nav.querySelectorAll('a')];
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });

  window.addEventListener('resize', () => {
    if (open && window.innerWidth > 980) setOpen(false, { restoreFocus: false });
  });
}

function initSpy() {
  const links = new Map(
    [...document.querySelectorAll('.nav-link')].map((a) => [a.getAttribute('href').slice(1), a])
  );
  const sections = document.querySelectorAll('[data-section]');

  const spy = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        links.forEach((a, id) => {
          const active = id === entry.target.id;
          a.classList.toggle('active', active);
          if (active) a.setAttribute('aria-current', 'true');
          else a.removeAttribute('aria-current');
        });
      }
    },
    { rootMargin: '-45% 0px -50% 0px', threshold: 0 }
  );

  sections.forEach((section) => spy.observe(section));
}

/* ---------- reveals ---------- */

const io = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        entry.target.classList.add('in');
        io.unobserve(entry.target);
      }
    }
  },
  { threshold: 0.15 }
);

function observeReveals() {
  document.querySelectorAll('.plate, .reveal').forEach((element) => io.observe(element));
}

/* ---------- theme ---------- */

function initTheme() {
  const button = $('theme-toggle');
  if (!button) return;

  button.addEventListener('click', () => daynight.toggle());

  daynight.subscribe((mode) => {
    const night = mode === 'night';
    button.setAttribute('aria-pressed', String(night));
    button.setAttribute('aria-label', night ? 'Switch to sunset theme' : 'Switch to night theme');
  });
}

/* ---------- small interactions ---------- */

function renderAbout() {
  const [lead, ...rest] = ABOUT;
  const leadEl = $('about-lead');

  if (lead) {
    leadEl.innerHTML = aboutLeadMarkup(lead);
  } else {
    leadEl.hidden = true;
  }

  $('about-list').innerHTML = aboutListMarkup(rest);
}

/* ---------- hero ---------- */

function splitHeroTitle() {
  const title = document.querySelector('.hero-title');
  if (!title || title.dataset.split === 'true') return;

  const text = title.textContent.replace(/\s+/g, ' ').trim();
  if (!text) return;

  title.textContent = '';

  [...text].forEach((char, index) => {
    if (char === ' ') {
      const space = document.createElement('span');
      space.className = 'hero-space';
      space.setAttribute('aria-hidden', 'true');
      space.textContent = ' ';
      title.append(space);
      return;
    }

    const mask = document.createElement('span');
    mask.className = 'hero-letter-mask';
    mask.style.setProperty('--i', index);
    mask.setAttribute('aria-hidden', 'true');

    const letter = document.createElement('span');
    letter.className = `hero-letter${index === 0 ? ' hero-letter--initial' : ''}`;
    letter.textContent = char;
    mask.append(letter);
    title.append(mask);
  });

  title.dataset.split = 'true';
}

function initHeroMotion() {
  const hero = document.querySelector('.hero');
  if (!hero) return;

  let range = 1;
  let frame = 0;
  let last = -1;

  const update = () => {
    frame = 0;
    let exit = 0;

    if (!REDUCED_MOTION.matches) {
      const raw = Math.min(1, Math.max(0, window.scrollY / range));
      exit = raw * raw * (3 - 2 * raw);
    }

    if (Math.abs(exit - last) < 0.001) return;
    last = exit;
    hero.style.setProperty('--hero-exit', exit.toFixed(3));
    hero.classList.toggle('is-gone', exit > 0.92);
  };

  const request = () => {
    if (!frame) frame = window.requestAnimationFrame(update);
  };

  const measure = () => {
    const pinned = window.matchMedia('(min-width: 761px) and (min-height: 700px)').matches;
    range = pinned
      ? Math.max(1, hero.offsetHeight - window.innerHeight)
      : Math.max(1, hero.offsetHeight * 0.34);
    last = -1;
    request();
  };

  measure();
  window.addEventListener('resize', measure);
  window.addEventListener('scroll', request, { passive: true });
  REDUCED_MOTION.addEventListener('change', () => {
    last = -1;
    request();
  });
}

function initHero() {
  document.documentElement.classList.add('hero-armed');
  splitHeroTitle();
  initHeroMotion();
}

function initBackToTop() {
  $('back-to-top')?.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: scrollBehavior() });
  });
}

function initNoWebglDismiss() {
  $('no-webgl-dismiss')?.addEventListener('click', () => {
    $('no-webgl-note').hidden = true;
  });
}

/* ---------- public ---------- */

export function initUI() {
  buildNav();
  renderWork();
  renderSkills();
  renderAbout();
  renderTimeline();
  $('quotes-list').innerHTML = notesMarkup(QUOTES);
  $('socials').innerHTML = socialsMarkup();
  $('socials-end').innerHTML = socialsMarkup();
  $('contact-mail').href = `mailto:${CONTACT_MAIL}`;
  $('contact-mail').textContent = CONTACT_MAIL;

  initNav();
  initSpy();
  initTheme();
  initAudio();
  initDrawer();
  initBackToTop();
  initHero();
  initNoWebglDismiss();
  observeReveals();
}

export function setLoadProgress(progress) {
  $('loader-fill').style.width = `${Math.round(progress * 100)}%`;
}

export function hideLoader() {
  document.documentElement.classList.add('is-ready');
  const loader = $('loader');
  if (!loader || loader.classList.contains('done')) return;
  loader.classList.add('done');
  loader.setAttribute('aria-hidden', 'true');
  window.setTimeout(() => {
    loader.style.display = 'none';
  }, 1400);
}

export function showNoWebgl() {
  $('no-webgl').hidden = false;
  $('no-webgl-note').hidden = false;
  hideLoader();
}
