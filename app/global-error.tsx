"use client";

// global-error replaces the root layout, so it cannot rely on anything that
// layout provides -- including the Tailwind stylesheet imported there. The
// styles are inline, and the colours are CSS system colours, so this page stays
// legible even when the app's own CSS bundle is exactly what failed to load.
export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "0.75rem",
          padding: "1.5rem",
          textAlign: "center",
          background: "Canvas",
          color: "CanvasText",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <h1 style={{ margin: 0, fontSize: "1.5rem", fontWeight: 600 }}>
          Something went wrong
        </h1>
        <p style={{ margin: 0, fontSize: "0.875rem", color: "GrayText" }}>
          {error.digest
            ? `The page could not be loaded. Reference: ${error.digest}`
            : "The page could not be loaded."}
        </p>
        <button
          type="button"
          onClick={() => retry()}
          style={{
            marginTop: "0.5rem",
            padding: "0.5rem 1rem",
            borderRadius: "0.5rem",
            border: "1px solid GrayText",
            background: "transparent",
            color: "CanvasText",
            font: "inherit",
            fontSize: "0.875rem",
            cursor: "pointer",
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
