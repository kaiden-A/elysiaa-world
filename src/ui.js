import {
  NAV,
  PROJECTS,
  FEATURED,
  MORE,
  SKILLS,
  EXPERIENCE,
  QUOTES,
  ABOUT,
  SOCIALS,
  CONTACT_MAIL,
  CATEGORIES,
  CATEGORY_LABELS,
  STATUS_LABELS,
} from './content.js';
import { daynight } from './core/daynight.js';
import { initAudio } from './audio.js';

const ICONS = {
  github:
    '<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z"/></svg>',
  linkedin:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M4.98 3.5C4.98 4.88 3.87 6 2.5 6S0 4.88 0 3.5 1.12 1 2.5 1s2.48 1.12 2.48 2.5zM.24 8.31h4.52V23H.24V8.31zM8.34 8.31h4.33v2h.06c.6-1.14 2.07-2.34 4.26-2.34 4.56 0 5.4 3 5.4 6.9V23h-4.52v-7.1c0-1.7-.03-3.88-2.36-3.88-2.37 0-2.73 1.85-2.73 3.76V23H8.34V8.31z"/></svg>',
  mail: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><rect x="2.5" y="5" width="19" height="14" rx="1"/><path d="m3.5 6.5 8.5 6.5 8.5-6.5"/></svg>',
};

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
const BASE_TITLE = document.title;
const HTML_ESCAPES = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

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

/* ---------- helpers ---------- */

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => HTML_ESCAPES[char]);
}

function safeHref(value) {
  if (!value) return '';
  if (String(value).startsWith('#')) return value;
  try {
    const url = new URL(value, window.location.href);
    return ['http:', 'https:', 'mailto:'].includes(url.protocol) ? value : '';
  } catch {
    return '';
  }
}

function externalAttrs(href) {
  return /^https?:/i.test(href) ? ' target="_blank" rel="noopener noreferrer"' : '';
}

function paragraphs(text) {
  return String(text || '')
    .split(/\n{2,}/)
    .map((block) => `<p>${esc(block).replace(/\n/g, '<br />')}</p>`)
    .join('');
}

function statusMarkup(status) {
  if (!status) return '';
  const label = STATUS_LABELS[status] || status;
  return `<span class="status"><span class="status-dot status-dot--${esc(status)}" aria-hidden="true"></span>${esc(label)}</span>`;
}

function chips(items = [], className = 'chips') {
  if (!items || !items.length) return '';
  return `<div class="${className}">${items.map((item) => `<span>${esc(item)}</span>`).join('')}</div>`;
}

function coverArt(project, index) {
  const category = esc(project.category || 'personal');
  const initial = (project.title || '?').trim().charAt(0).toUpperCase();
  return `<span class="work-cover-art work-cover-art--${category}" aria-hidden="true">
    <span class="work-cover-no">${ROMAN[index] || String(index + 1)}</span>
    <span class="work-cover-initial">${esc(initial)}</span>
    <span class="work-cover-label">${esc(CATEGORY_LABELS[project.category] || project.category || 'Project')}</span>
  </span>`;
}

function coverImage(project, index, alt = '') {
  const src = safeHref(project.cover);
  if (!src) return coverArt(project, index);
  return `<img src="${esc(src)}" alt="${esc(project.coverAlt || alt)}" loading="lazy" decoding="async" />`;
}

/* ---------- build ---------- */

function plate(item, index, label) {
  const el = document.createElement('li');
  el.className = 'plate';
  el.style.transitionDelay = `${(index % 3) * 0.1}s`;
  const link = safeHref(item.link);
  el.innerHTML = `
    <span class="plate-no">${esc(item.kicker || label)}</span>
    <div>
      ${
        item.title
          ? `<h3 class="plate-title">${
              link
                ? `<a class="plate-link" href="${esc(link)}"${externalAttrs(link)}>${esc(item.title)}<span class="plate-link-arrow" aria-hidden="true">↗</span><span class="sr-only"> (opens in new tab)</span></a>`
                : esc(item.title)
            }</h3>`
          : ''
      }
      <div class="plate-text">${paragraphs(item.text)}</div>
      ${
        item.tags && item.tags.length
          ? `<div class="plate-tags">${item.tags.map((tag) => `<span>${esc(tag)}</span>`).join('')}</div>`
          : ''
      }
    </div>
  `;
  return el;
}

function fillList(id, items, labeler) {
  const el = $(id);
  items.forEach((item, i) => el.appendChild(plate(item, i, labeler(i, item))));
}

function fillSocials(id) {
  const el = $(id);
  SOCIALS.forEach((social) => {
    const a = document.createElement('a');
    a.href = social.href;
    a.setAttribute('aria-label', social.label);
    if (social.href.startsWith('http')) {
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
    }
    a.innerHTML = ICONS[social.icon];
    el.appendChild(a);
  });
}

function featuredCard(project) {
  const index = PROJECTS.indexOf(project);
  const link = safeHref(project.link);
  const repo = safeHref(project.repo);
  const systems = project.systems && project.systems.length ? `${project.systems.length} systems` : '';
  const meta = [project.role, systems].filter(Boolean).join(' · ');

  return `
    <article class="work-card reveal">
      <button class="work-cover" type="button" data-open-project="${esc(project.slug)}" aria-label="Read the ${esc(project.title)} case study">
        ${coverImage(project, index)}
        <span class="work-cover-hint">Read case study <span aria-hidden="true">→</span></span>
      </button>
      <div class="work-card-body">
        <p class="work-card-meta">
          <span>${esc(CATEGORY_LABELS[project.category] || project.category || 'Project')}</span>
          <span class="meta-sep" aria-hidden="true">·</span>
          ${statusMarkup(project.status)}
        </p>
        <h3 class="work-card-title">
          <button type="button" data-open-project="${esc(project.slug)}">${esc(project.title)}</button>
        </h3>
        <p class="work-card-hook">${esc(project.hook)}</p>
        ${meta ? `<p class="work-card-role">${esc(meta)}</p>` : ''}
        ${chips(project.stack)}
        <div class="work-card-links">
          <button type="button" data-open-project="${esc(project.slug)}">Case study <span aria-hidden="true">→</span></button>
          ${
            link
              ? `<a href="${esc(link)}"${externalAttrs(link)}>Live <span aria-hidden="true">↗</span><span class="sr-only"> (opens in new tab)</span></a>`
              : ''
          }
          ${
            repo
              ? `<a href="${esc(repo)}"${externalAttrs(repo)}>Code <span aria-hidden="true">↗</span><span class="sr-only"> (opens in new tab)</span></a>`
              : ''
          }
        </div>
      </div>
    </article>
  `;
}

function indexRow(project) {
  const index = PROJECTS.indexOf(project);
  const tags = (project.stack || []).slice(0, 3).join(' · ');
  return `
    <li class="work-row reveal" data-category="${esc(project.category)}" data-featured="${String(Boolean(project.featured))}">
      <button class="work-row-main" type="button" data-open-project="${esc(project.slug)}">
        <span class="work-row-no">${String(index + 1).padStart(2, '0')}</span>
        <span class="work-row-title">${esc(project.title)}</span>
        <span class="work-row-hook">${esc(project.hook)}</span>
        <span class="work-row-tags">${esc(tags)}</span>
        <span class="work-row-arrow" aria-hidden="true">→</span>
      </button>
    </li>
  `;
}

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
  $('work-featured').innerHTML = FEATURED.map(featuredCard).join('');
  $('work-index').innerHTML = PROJECTS.map(indexRow).join('');

  const filters = $('work-filters');
  filters.innerHTML = CATEGORIES.map(
    (category, index) =>
      `<button class="filter" type="button" data-filter="${esc(category.id)}" aria-pressed="${index === 0}">${esc(category.label)}</button>`
  ).join('');

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
  $('skills-grid').innerHTML = SKILLS.map((group, groupIndex) => {
    const items = (group.items || [])
      .map((item) => {
        const href = safeHref(item.href);
        const proof = esc(item.proof);
        const content = `<span class="skill-name">${esc(item.name)}</span><span class="skill-proof">${proof}</span>`;
        const row = href
          ? `<a class="skill-link" href="${esc(href)}"${externalAttrs(href)}${
              href.startsWith('#project/') ? ' aria-haspopup="dialog"' : ''
            }>${content}${/^https?:/.test(href) ? '<span class="sr-only"> (opens in new tab)</span>' : ''}</a>`
          : `<div class="skill-link">${content}</div>`;

        return `<li class="skill-item">${row}</li>`;
      })
      .join('');

    return `<section class="skill-group reveal" aria-labelledby="skill-group-${groupIndex}">
      <h3 id="skill-group-${groupIndex}" class="skill-group-title">${esc(group.group)}</h3>
      ${group.note ? `<p class="skill-group-note">${esc(group.note)}</p>` : ''}
      <ul class="skill-list">${items}</ul>
    </section>`;
  }).join('');
}

function renderTimeline() {
  $('timeline').innerHTML = EXPERIENCE.map(
    (item) => `<li class="timeline-item reveal">
      <div class="timeline-meta">
        ${item.period ? `<span class="timeline-period">${esc(item.period)}</span>` : ''}
        ${item.kind ? `<span class="timeline-kind timeline-kind--${esc(item.kind)}">${esc(item.kind)}</span>` : ''}
      </div>
      <div class="timeline-body">
        <h4 class="timeline-role">${esc(item.role)}</h4>
        <p class="timeline-org">${esc(item.org)}</p>
        ${item.detail ? `<p class="timeline-detail">${esc(item.detail)}</p>` : ''}
      </div>
    </li>`
  ).join('');
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
                `<img src="${esc(src)}" alt="${esc(project.title)} — view ${index + 1}" loading="lazy" decoding="async" />`
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
  const nav = $('site-nav');
  nav.innerHTML = NAV.map((item) => `<a class="nav-link" href="#${item.id}">${esc(item.label)}</a>`).join('');
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
    leadEl.innerHTML = `<span class="about-lead-label">${esc(lead.kicker || 'Who I am')}</span>
      <div class="about-lead-text">${paragraphs(lead.text)}</div>`;
  } else {
    leadEl.hidden = true;
  }

  fillList('about-list', rest, (i) => `Plate ${ROMAN[i]}`);
}

function initBackToTop() {
  $('back-to-top')?.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: scrollBehavior() });
  });
}

function initChrome() {
  const chrome = document.querySelector('.chrome');
  if (!chrome) return;

  const update = () => {
    chrome.classList.toggle('is-scrolled', window.scrollY > 24);
  };

  update();
  window.addEventListener('scroll', update, { passive: true });
}

async function copyText(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.style.position = 'fixed';
  area.style.opacity = '0';
  document.body.appendChild(area);
  area.select();
  document.execCommand('copy');
  area.remove();
}

function initCopyMail() {
  const button = $('copy-mail');
  if (!button) return;
  let timer = 0;

  button.addEventListener('click', async () => {
    try {
      await copyText(CONTACT_MAIL);
      window.clearTimeout(timer);
      button.textContent = 'Copied';
      button.classList.add('is-copied');
      timer = window.setTimeout(() => {
        button.textContent = 'Copy';
        button.classList.remove('is-copied');
      }, 1800);
    } catch {
      button.textContent = 'Copy failed';
      window.setTimeout(() => {
        button.textContent = 'Copy';
      }, 1800);
    }
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
  fillList('quotes-list', QUOTES, (_i, item) => item.source);
  fillSocials('socials');
  fillSocials('socials-end');
  $('contact-mail').href = `mailto:${CONTACT_MAIL}`;
  $('contact-mail').textContent = CONTACT_MAIL;

  initNav();
  initSpy();
  initTheme();
  initAudio();
  initDrawer();
  initBackToTop();
  initChrome();
  initCopyMail();
  initNoWebglDismiss();
  observeReveals();
}

export function setLoadProgress(progress) {
  $('loader-fill').style.width = `${Math.round(progress * 100)}%`;
}

export function hideLoader() {
  const loader = $('loader');
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
