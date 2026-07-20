import type { MetadataRoute } from "next";

// Login-first app with no public marketing surface — disallow crawling
// entirely. (The former marketing allow-list for `/`, `/about`, `/changelog`
// and the sitemap references were removed with the landing.)
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        disallow: "/",
      },
    ],
  };
}
