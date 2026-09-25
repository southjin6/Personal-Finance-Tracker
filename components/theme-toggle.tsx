"use client";

import { MoonIcon, SunIcon } from "lucide-react";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
    >
      {/* Both icons are always rendered and CSS picks one, so the button matches
          the server-rendered markup without a mounted flag or a hydration mismatch.
          next-themes sets .dark on <html> before paint. */}
      <SunIcon className="hidden dark:block" />
      <MoonIcon className="block dark:hidden" />
      <span className="sr-only">Toggle theme</span>
    </Button>
  );
}
