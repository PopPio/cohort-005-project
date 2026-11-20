import { cn } from "~/lib/utils";

/** The year is a literal, not computed during render: a year read from the
 * clock can differ between server and browser and break hydration. */
const COPYRIGHT_NOTICE = "© 2026 Cadence. All rights reserved.";

export function SiteFooter({ className }: { className?: string }) {
  return (
    <footer className={cn("border-t border-border py-8", className)}>
      <div className="mx-auto max-w-6xl px-6 text-center text-sm text-muted-foreground">
        {COPYRIGHT_NOTICE}
      </div>
    </footer>
  );
}
