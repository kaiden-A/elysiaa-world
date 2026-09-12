import { ROLES, PROJECTS, SOCIALS, CONTACT_MAIL, EIDOLONS } from './content.js';

const plateEl = document.getElementById('plate-list');
const projectEl = document.getElementById('project-list');
const socialsEl = document.getElementById('socials');
const mailEl = document.getElementById('contact-mail');
const loaderEl = document.getElementById('loader');
const loaderFill = document.getElementById('loader-fill');
const noWebglEl = document.getElementById('no-webgl');
const nodesEl = document.getElementById('eidolon-nodes');
const nodeEls = [];

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];

function plate(item, index, offset = 0) {
  const el = document.createElement('li');
  el.className = 'plate';
  el.style.transitionDelay = `${(index % 3) * 0.12}s`;
  el.innerHTML = `
    <span class="plate-no">Plate ${ROMAN[index + offset] || index + 1}</span>
    <div>
      <h3 class="plate-title">${item.title}</h3>
      <p class="plate-text">${item.text}</p>
      <div class="plate-tags">${(item.tags || []).map((t) => `<span>${t}</span>`).join('')}</div>
    </div>
  `;
  return el;
}

function initCatalogue() {
  ROLES.forEach((r, i) => plateEl.appendChild(plate(r, i, 0)));
  PROJECTS.forEach((p, i) => projectEl.appendChild(plate(p, i, ROLES.length)));

  SOCIALS.forEach((s) => {
    const a = document.createElement('a');
    a.href = s.href;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.textContent = s.label;
    socialsEl.appendChild(a);
  });
  mailEl.href = `mailto:${CONTACT_MAIL}`;
  mailEl.textContent = CONTACT_MAIL;
}

function initNodes() {
  EIDOLONS.forEach((e, i) => {
    const a = ((-90 + i * 60) * Math.PI) / 180;
    const el = document.createElement('div');
    el.className = 'node' + (Math.cos(a) < -0.01 ? ' left' : '');
    el.innerHTML = `<span class="node-badge">${e.n}</span><span class="node-label">${e.title}</span>`;
    nodesEl.appendChild(el);
    nodeEls.push(el);
  });
  layoutNodes();
  window.addEventListener('resize', layoutNodes);
}

function layoutNodes() {
  const R = Math.min(window.innerWidth, window.innerHeight) * 0.37;
  nodeEls.forEach((el, i) => {
    const a = ((-90 + i * 60) * Math.PI) / 180;
    el.style.setProperty('--nx', `${Math.cos(a) * R}px`);
    el.style.setProperty('--ny', `${Math.sin(a) * R}px`);
  });
}

export function setNodesOpacity(v) {
  nodesEl.style.opacity = Math.max(0, Math.min(1, v)).toFixed(3);
}

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

const ioSection = new IntersectionObserver(
  (entries) => {
    for (const e of entries) {
      e.target.classList.toggle('visible', e.isIntersecting);
    }
  },
  { threshold: 0.35 }
);

export function initUI() {
  initCatalogue();
  initNodes();
  document.querySelectorAll('.plate').forEach((p) => io.observe(p));
  const guardian = document.getElementById('guardian');
  if (guardian) ioSection.observe(guardian);
}

export function setLoadProgress(p) {
  loaderFill.style.width = `${Math.round(p * 100)}%`;
}

export function hideLoader() {
  loaderEl.classList.add('done');
}

export function showNoWebgl() {
  noWebglEl.hidden = false;
  loaderEl.classList.add('done');
}