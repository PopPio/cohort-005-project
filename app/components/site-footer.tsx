import { cn } from "~/lib/utils";

/** The year is fixed on purpose: it was decided in issue #23, and a year
 * computed during render can differ between server and browser. */
export const COPYRIGHT_NOTICE = "© 2026 Cadence. All rights reserved.";

export function SiteFooter({ className }: { className?: string }) {
  return (
    <footer className={cn("border-t border-border py-8", className)}>
      <div className="mx-auto max-w-6xl px-6 text-center text-sm text-muted-foreground">
        {COPYRIGHT_NOTICE}
      </div>
    </footer>
  );
}
