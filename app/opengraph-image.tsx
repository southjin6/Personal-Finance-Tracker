import { ImageResponse } from "next/og";

export const alt = "Personal Finance Tracker — track income and expenses";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Mirrors the app's own dark palette, so the card a reviewer sees in a chat
// client matches the product behind the link. Concrete values rather than the
// CSS custom properties in globals.css: this renders through satori, which does
// not resolve those tokens.
const BACKGROUND = "#09090b";
const FOREGROUND = "#fafafa";
const MUTED = "#a1a1aa";
const BAR = "#3f3f46";
const ACCENT = "#22c55e";

const BAR_HEIGHTS = [44, 78, 116, 160];

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: BACKGROUND,
          color: FOREGROUND,
          padding: 80,
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-end", gap: 14 }}>
          {BAR_HEIGHTS.map((height, index) => (
            <div
              key={height}
              style={{
                width: 30,
                height,
                borderRadius: 8,
                background: index === BAR_HEIGHTS.length - 1 ? ACCENT : BAR,
              }}
            />
          ))}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ fontSize: 84, fontWeight: 700, letterSpacing: -2 }}>
            Personal Finance Tracker
          </div>
          <div style={{ fontSize: 36, color: MUTED }}>
            Track income and expenses, and see where your money goes.
          </div>
        </div>
      </div>
    ),
    size
  );
}
