"use client";

import { ThemeProvider as NextThemesProvider, type ThemeProviderProps } from "next-themes";

// `attribute="class"` is fixed here rather than passed in: the dark variants in
// app/globals.css are declared as `&:is(.dark *)`, so the theme has to land as a
// class on <html>. next-themes defaults to `data-theme`, which would match nothing.
export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return (
    <NextThemesProvider attribute="class" {...props}>
      {children}
    </NextThemesProvider>
  );
}
