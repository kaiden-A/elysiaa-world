import { CATEGORIES, CATEGORY_LABELS, STATUS_LABELS, NAV, SOCIALS, ICONS } from './site.js';

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
const HTML_ESCAPES = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => HTML_ESCAPES[char]);
}

export function safeHref(value, base = 'https://www.elysiaa.com/') {
  if (!value) return '';
  if (String(value).startsWith('#')) return value;
  try {
    const url = new URL(value, base);
    return ['http:', 'https:', 'mailto:'].includes(url.protocol) ? value : '';
  } catch {
    return '';
  }
}

export function externalAttrs(href) {
  return /^https?:/i.test(href) ? ' target="_blank" rel="noopener noreferrer"' : '';
}

export function paragraphs(text) {
  return String(text || '')
    .split(/\n{2,}/)
    .map((block) => `<p>${esc(block).replace(/\n/g, '<br />')}</p>`)
    .join('');
}

export function statusMarkup(status) {
  if (!status) return '';
  const label = STATUS_LABELS[status] || status;
  return `<span class="status"><span class="status-dot status-dot--${esc(status)}" aria-hidden="true"></span>${esc(label)}</span>`;
}

export function chips(items = [], className = 'chips') {
  if (!items || !items.length) return '';
  return `<div class="${className}">${items.map((item) => `<span>${esc(item)}</span>`).join('')}</div>`;
}

export function coverArt(project, index) {
  const category = esc(project.category || 'personal');
  const initial = (project.title || '?').trim().charAt(0).toUpperCase();
  return `<span class="work-cover-art work-cover-art--${category}" aria-hidden="true">
    <span class="work-cover-no">${ROMAN[index] || String(index + 1)}</span>
    <span class="work-cover-initial">${esc(initial)}</span>
    <span class="work-cover-label">${esc(CATEGORY_LABELS[project.category] || project.category || 'Project')}</span>
  </span>`;
}

export function coverImage(project, index, alt = '') {
  const src = safeHref(project.cover);
  if (!src) return coverArt(project, index);
  return `<img src="${esc(src)}" alt="${esc(project.coverAlt || alt)}" loading="lazy" decoding="async" />`;
}

export function featuredCard(project, index) {
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

export function indexRow(project, index) {
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

export function workFiltersMarkup() {
  return CATEGORIES.map(
    (category, index) =>
      `<button class="filter" type="button" data-filter="${esc(category.id)}" aria-pressed="${index === 0}">${esc(category.label)}</button>`
  ).join('');
}

export function navMarkup() {
  return NAV.map((item) => `<a class="nav-link" href="#${item.id}">${esc(item.label)}</a>`).join('');
}

export function socialsMarkup() {
  return SOCIALS.map((social) => {
    const attrs = social.href.startsWith('http') ? ' target="_blank" rel="noopener noreferrer"' : '';
    return `<a href="${esc(social.href)}" aria-label="${esc(social.label)}"${attrs}>${ICONS[social.icon]}</a>`;
  }).join('');
}

export function plateMarkup(item, index, label) {
  const link = safeHref(item.link);
  return `
    <li class="plate" style="transition-delay: ${(index % 3) * 0.1}s">
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
    </li>
  `;
}

export function skillsMarkup(skills) {
  return skills
    .map((group, groupIndex) => {
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
    })
    .join('');
}

export function timelineMarkup(experience) {
  return experience
    .map(
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
    )
    .join('');
}

export function aboutLeadMarkup(lead) {
  if (!lead) return '';
  return `<h3 class="about-lead-label">${esc(lead.kicker || 'Who I am')}</h3>
    <div class="about-lead-text">${paragraphs(lead.text)}</div>`;
}

export function aboutListMarkup(items) {
  return items.map((item, index) => plateMarkup(item, index, `Plate ${ROMAN[index]}`)).join('');
}

export function notesMarkup(quotes) {
  return quotes.map((item, index) => plateMarkup(item, index, item.source)).join('');
}
