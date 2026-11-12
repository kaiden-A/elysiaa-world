import { CATEGORIES, CATEGORY_LABELS, STATUS_LABELS, NAV, SOCIALS, CONTACT_MAIL } from './site.js';

const modules = import.meta.glob('../content/**/*.json', { eager: true, import: 'default' });

import music from '../content/music.json';

function load(section) {
  return Object.entries(modules)
    .filter(([path]) => path.startsWith(`../content/${section}/`))
    .sort(([aPath, a], [bPath, b]) => (a.order ?? 0) - (b.order ?? 0) || aPath.localeCompare(bPath))
    .map(([, data]) => data);
}

export const PROJECTS = load('projects');
export const FEATURED = PROJECTS.filter((project) => project.featured);
export const MORE = PROJECTS.filter((project) => !project.featured);
export const SKILLS = load('skills');
export const EXPERIENCE = load('experience');
export const QUOTES = load('quotes');
export const ABOUT = load('about');

export const MUSIC = [...music].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

export { CATEGORIES, CATEGORY_LABELS, STATUS_LABELS, NAV, SOCIALS, CONTACT_MAIL };
