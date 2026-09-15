import {
  NAV,
  PERSONAL,
  CLUB,
  CHARITY,
  WORKS,
  QUOTES,
  ABOUT,
  SOCIALS,
  CONTACT_MAIL,
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

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX'];

const $ = (id) => document.getElementById(id);

/* ---------- build ---------- */

function plate(item, index, label) {
  const el = document.createElement('li');
  el.className = 'plate';
  el.style.transitionDelay = `${(index % 3) * 0.1}s`;
  el.innerHTML = `
    <span class="plate-no">${item.kicker || label}</span>
    <div>
      ${
        item.title
          ? `<h3 class="plate-title">${
              item.link
                ? `<a class="plate-link" href="${item.link}" target="_blank" rel="noopener noreferrer">${item.title}<span class="plate-link-arrow" aria-hidden="true">↗</span><span class="sr-only"> (opens in new tab)</span></a>`
                : item.title
            }</h3>`
          : ''
      }
      <p class="plate-text">${item.text}</p>
      ${
        item.tags
          ? `<div class="plate-tags">${item.tags.map((t) => `<span>${t}</span>`).join('')}</div>`
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
  SOCIALS.forEach((s) => {
    const a = document.createElement('a');
    a.href = s.href;
    a.setAttribute('aria-label', s.label);
    if (s.href.startsWith('http')) {
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
    }
    a.innerHTML = ICONS[s.icon];
    el.appendChild(a);
  });
}

function buildNav() {
  const nav = $('site-nav');
  nav.innerHTML = NAV.map((n) => `<a class="nav-link" href="#${n.id}">${n.label}</a>`).join('');
}

/* ---------- nav behaviour ---------- */

function initNav() {
  const nav = $('site-nav');
  const toggle = $('nav-toggle');

  toggle.addEventListener('click', () => {
    const open = nav.classList.toggle('open');
    toggle.setAttribute('aria-expanded', String(open));
  });

  nav.addEventListener('click', (e) => {
    if (e.target.closest('a')) {
      nav.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
    }
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

  sections.forEach((s) => spy.observe(s));
}

/* ---------- reveals ---------- */

const io = new IntersectionObserver(
  (entries) => {
    for (const e of entries) {
      if (e.isIntersecting) {
        e.target.classList.add('in');
        io.unobserve(e.target);
      }
    }
  },
  { threshold: 0.15 }
);

/* ---------- theme ---------- */

function initTheme() {
  const btn = $('theme-toggle');
  if (!btn) return;

  btn.addEventListener('click', () => daynight.toggle());

  daynight.subscribe((mode) => {
    const night = mode === 'night';
    btn.setAttribute('aria-pressed', String(night));
    btn.setAttribute('aria-label', night ? 'Switch to sunset theme' : 'Switch to night theme');
  });
}

/* ---------- public ---------- */

export function initUI() {
  buildNav();
  fillList('personal-list', PERSONAL, (i) => `Plate ${ROMAN[i]}`);
  fillList('club-list', CLUB, (i) => `Plate ${ROMAN[i]}`);
  fillList('charity-list', CHARITY, (i) => `Plate ${ROMAN[i]}`);
  fillList('works-list', WORKS, (i) => `Plate ${ROMAN[i]}`);
  fillList('quotes-list', QUOTES, (_i, item) => item.source);
  fillList('about-list', ABOUT, (i) => `Plate ${ROMAN[i]}`);
  fillSocials('socials');
  fillSocials('socials-end');
  $('contact-mail').href = `mailto:${CONTACT_MAIL}`;
  $('contact-mail').textContent = CONTACT_MAIL;

  initNav();
  initSpy();
  initTheme();
  initAudio();

  document.querySelectorAll('.plate, .reveal').forEach((el) => io.observe(el));
}

export function setLoadProgress(p) {
  $('loader-fill').style.width = `${Math.round(p * 100)}%`;
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
  $('loader').classList.add('done');
}
