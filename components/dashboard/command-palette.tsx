"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Command, Search, Target, UserRound } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { navGroups } from "@/lib/constants/nav";

type CommandPaletteProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const router = useRouter();
  const normalizedQuery = query.trim().toLowerCase();
  const pages = useMemo(
    () => navGroups.flatMap((group) => group.items.map((item) => ({ ...item, group: group.label }))),
    [],
  );
  const filteredPages = pages.filter((item) =>
    `${item.title} ${item.group} ${item.href}`.toLowerCase().includes(normalizedQuery),
  );

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        if (open) setQuery("");
        onOpenChange(!open);
      }
    }
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [onOpenChange, open]);

  function navigate(href: string) {
    router.push(href);
    onOpenChange(false);
  }

  function searchRecords(collection: "leads" | "students") {
    navigate(`/${collection}?search=${encodeURIComponent(query.trim())}`);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) setQuery("");
        onOpenChange(nextOpen);
      }}
    >
      <DialogContent className="max-w-[min(94vw,560px)] gap-0 overflow-hidden rounded-[22px] border-border/80 p-0 shadow-[0_28px_100px_-35px_rgb(10_28_48_/_50%)]">
        <DialogHeader className="sr-only">
          <DialogTitle>Quick navigation</DialogTitle>
          <DialogDescription>Find a workspace or search your leads and students.</DialogDescription>
        </DialogHeader>
        <div className="flex items-center gap-3 border-b px-5 py-4">
          <Search className="h-5 w-5 shrink-0 text-primary" />
          <Input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Jump to a workspace or find a record…"
            aria-label="Search workspaces and records"
            className="h-10 border-0 bg-transparent px-0 text-sm shadow-none focus-visible:ring-0"
          />
          <kbd className="hidden shrink-0 rounded-md border bg-muted px-1.5 py-1 text-[9px] font-medium text-muted-foreground sm:inline-flex">ESC</kbd>
        </div>

        <div className="max-h-[min(62dvh,460px)] overflow-y-auto p-3">
          {normalizedQuery && (
            <div className="mb-3">
              <p className="px-2 pb-2 text-[9px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Search records</p>
              <div className="grid gap-1 sm:grid-cols-2">
                <CommandAction
                  icon={Target}
                  label={`Search leads for “${query.trim()}”`}
                  detail="Student CRM"
                  onClick={() => searchRecords("leads")}
                />
                <CommandAction
                  icon={UserRound}
                  label={`Search students for “${query.trim()}”`}
                  detail="Student directory"
                  onClick={() => searchRecords("students")}
                />
              </div>
            </div>
          )}

          <p className="px-2 pb-2 text-[9px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Workspaces</p>
          {filteredPages.length ? (
            <div className="space-y-1">
              {filteredPages.map((item) => (
                <CommandAction
                  key={item.href}
                  icon={item.icon}
                  label={item.title}
                  detail={item.group}
                  onClick={() => navigate(item.href)}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed px-4 py-7 text-center">
              <p className="text-sm font-medium">No workspace matches that search</p>
              <p className="mt-1 text-xs text-muted-foreground">Try a module name, like Applications or Reports.</p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t bg-muted/35 px-5 py-3">
          <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground"><Command className="h-3 w-3" />Quick navigation</span>
          <Button variant="ghost" size="sm" className="h-7 gap-1.5 px-2 text-[10px] text-muted-foreground" onClick={() => onOpenChange(false)}>
            Close <ArrowRight className="h-3 w-3" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CommandAction({
  icon: Icon,
  label,
  detail,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  detail: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full items-center gap-3 rounded-xl border border-transparent px-3 py-2.5 text-left transition-colors hover:border-primary/10 hover:bg-primary/[0.045] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground transition-colors group-hover:bg-primary/10 group-hover:text-primary">
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-medium">{label}</span>
        <span className="mt-0.5 block text-[9px] text-muted-foreground">{detail}</span>
      </span>
      <ArrowRight className="h-3 w-3 shrink-0 text-muted-foreground/0 transition-colors group-hover:text-primary" />
    </button>
  );
}
