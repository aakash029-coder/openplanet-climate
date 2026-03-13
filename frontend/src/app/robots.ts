import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*', // Sabhi search engines (Google, Bing, etc.) ko allow karna
      allow: '/',
    },
    sitemap: 'https://openplanet-ai.vercel.app/sitemap.xml', // Sitemap ka rasta
  };
}