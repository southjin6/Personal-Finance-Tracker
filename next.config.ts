import type { NextConfig } from "next";

// The four directives that cost this app nothing: no page is framed, nothing is
// embedded as a plugin, no form posts off-origin, and there is no <base> tag.
// frame-ancestors is the clickjacking control; the other three are belt and
// braces. X-Frame-Options is deliberately absent rather than added alongside --
// frame-ancestors supersedes it, and two controls that must agree are a trap
// for whoever edits one of them.
//
// script-src, style-src and default-src are absent on purpose, not forgotten.
// default-src would drag in script/style/img/font with it, and Next's inline
// bootstrap, recharts' and Radix's inline styles and the Google avatar allowed
// by images.remotePatterns below would each have to be enumerated. A nonce-based
// policy is the way to add script-src; it belongs in proxy.ts, not here.
const CSP = [
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const nextConfig: NextConfig = {
  // Drops the X-Powered-By: Next.js header, which advertised the framework and
  // its major version on every response for no benefit.
  poweredByHeader: false,

  // Applies to everything: headers are matched before the filesystem, so this
  // covers pages, the route handler and the CSV download alike. Cache-Control is
  // not in here -- the immutable _next/static assets set their own and cannot be
  // overridden, and the export route sets no-store itself.
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: CSP },
          // Without this a browser may sniff a text/plain or text/csv response as
          // HTML and run it, which is how an uploaded file becomes XSS.
          { key: "X-Content-Type-Options", value: "nosniff" },
          // The modern default, stated rather than assumed: the origin, but no
          // path or query, goes to another site -- so a URL that carries a
          // ?month= or ?q= value never leaks past the origin.
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
        ],
      },
    ];
  },

  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
    ],
  },
};

export default nextConfig;
