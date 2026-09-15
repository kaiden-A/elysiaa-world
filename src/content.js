const modules = import.meta.glob('../content/**/*.json', { eager: true, import: 'default' });

import music from '../content/music.json';

function load(section) {
  return Object.entries(modules)
    .filter(([path]) => path.startsWith(`../content/${section}/`))
    .sort(([aPath, a], [bPath, b]) => (a.order ?? 0) - (b.order ?? 0) || aPath.localeCompare(bPath))
    .map(([, data]) => data);
}

export const PERSONAL = load('personal');
export const CLUB = load('club');
export const CHARITY = load('charity');
export const WORKS = load('works');
export const QUOTES = load('quotes');
export const ABOUT = load('about');

export const MUSIC = [...music].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

export const NAV = [
  { id: 'home', label: 'Home' },
  { id: 'personal', label: 'Personal' },
  { id: 'club', label: 'Club / Social' },
  { id: 'charity', label: 'Charity' },
  { id: 'works', label: 'Works' },
  { id: 'quotes', label: 'Quotes' },
  { id: 'about', label: 'About' },
];

export const SOCIALS = [
  { label: 'GitHub', href: 'https://github.com/kaiden-A', icon: 'github' },
  { label: 'LinkedIn', href: 'https://www.linkedin.com/in/amirul-ikhwan-041772390', icon: 'linkedin' },
  { label: 'Email', href: 'mailto:contacts@elysiaa.com', icon: 'mail' },
];

export const CONTACT_MAIL = 'contacts@elysiaa.com';
