import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import {
  featuredCard,
  indexRow,
  workFiltersMarkup,
  skillsMarkup,
  timelineMarkup,
  aboutLeadMarkup,
  aboutListMarkup,
  notesMarkup,
  navMarkup,
  socialsMarkup,
} from './src/markup.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));

function readCollection(directory) {
  const fullPath = path.join(ROOT, 'content', directory);
  return fs
    .readdirSync(fullPath)
    .filter((name) => name.endsWith('.json'))
    .map((name) => ({
      name,
      data: JSON.parse(fs.readFileSync(path.join(fullPath, name), 'utf8')),
    }))
    .sort((a, b) => (a.data.order ?? 0) - (b.data.order ?? 0) || a.name.localeCompare(b.name))
    .map(({ data }) => data);
}

function prerenderPlugin() {
  return {
    name: 'elysiaa-prerender',
    transformIndexHtml(html) {
      const projects = readCollection('projects');
      const featured = projects.filter((project) => project.featured);
      const more = projects.filter((project) => !project.featured);
      const about = readCollection('about');
      const [lead, ...rest] = about;

      const replacements = {
        nav: navMarkup(),
        socials: socialsMarkup(),
        'socials-end': socialsMarkup(),
        'work-filters': workFiltersMarkup(),
        'work-featured': featured.map((project) => featuredCard(project, projects.indexOf(project))).join(''),
        'work-index': more.map((project, index) => indexRow(project, index)).join(''),
        'work-count': `${more.length} more ${more.length === 1 ? 'project' : 'projects'}`,
        skills: skillsMarkup(readCollection('skills')),
        'about-lead': aboutLeadMarkup(lead),
        timeline: timelineMarkup(readCollection('experience')),
        'about-list': aboutListMarkup(rest),
        notes: notesMarkup(readCollection('quotes')),
      };

      return html.replace(/<!-- prerender:([a-z-]+) -->/g, (match, key) => replacements[key] ?? match);
    },
  };
}

export default defineConfig({
  base: './',
  server: { host: true },
  build: { target: 'es2022' },
  plugins: [prerenderPlugin()],
});
