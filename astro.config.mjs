import { defineConfig } from 'astro/config';

// configure-pages supplies the actual domain and repository path in Actions.
export default defineConfig({
  site: process.env.SITE_URL || 'https://bipreacher.github.io',
  base: process.env.BASE_PATH || '/',
  trailingSlash: 'always',
});
