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

export const CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'personal', label: 'Personal' },
  { id: 'club', label: 'Club / Social' },
  { id: 'charity', label: 'Charity' },
  { id: 'client', label: 'Client work' },
];

export const CATEGORY_LABELS = Object.fromEntries(
  CATEGORIES.filter((category) => category.id !== 'all').map((category) => [category.id, category.label])
);

export const STATUS_LABELS = {
  live: 'Live',
  'in-progress': 'In progress',
  past: 'Past',
  archived: 'Archived',
};

export const NAV = [
  { id: 'home', label: 'Home' },
  { id: 'work', label: 'Work' },
  { id: 'skills', label: 'Skills' },
  { id: 'about', label: 'About' },
  { id: 'notes', label: 'Notes' },
  { id: 'contact', label: 'Contact' },
];

export const SOCIALS = [
  { label: 'GitHub', href: 'https://github.com/kaiden-A', icon: 'github' },
  { label: 'LinkedIn', href: 'https://www.linkedin.com/in/amirul-ikhwan-041772390', icon: 'linkedin' },
  { label: 'Email', href: 'mailto:contacts@elysiaa.com', icon: 'mail' },
];

export const CONTACT_MAIL = 'contacts@elysiaa.com';
