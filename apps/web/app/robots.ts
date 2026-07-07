import type { MetadataRoute } from 'next';

import { APP_URL } from '../lib/site-url';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/', disallow: '/admin' },
    sitemap: `${APP_URL}/sitemap.xml`,
  };
}
