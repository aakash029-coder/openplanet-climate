import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*', // Sabhi search engines (Google, Bing, etc.) ko allow karna
      allow: '/',
    },
    sitemap: 'https://www.openplanetrisk.com/sitemap.xml', // Sitemap ka rasta
  };
}