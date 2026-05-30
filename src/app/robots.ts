import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/dashboard",
          "/admin",
          "/rules",
          "/documents",
          "/portfolio",
          "/watchlist",
          "/settings",
          "/beta",
          "/api/",
        ],
      },
    ],
    sitemap: "https://ruletrade-ai.vercel.app/sitemap.xml",
  };
}
