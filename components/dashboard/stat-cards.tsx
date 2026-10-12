import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { stats } from "@/lib/constants/mock-data";

export function StatCards() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {stats.map((s) => {
        const up = s.change >= 0;
        return (
          <Card key={s.title}>
            <CardContent className="p-5">
              <p className="text-sm text-muted-foreground">{s.title}</p>
              <p className="mt-2 text-3xl font-bold tracking-tight">{s.value}</p>
              <div className="mt-3 flex items-center gap-2 text-xs">
                <span
                  className={cn(
                    "inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 font-medium",
                    up
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                      : "bg-red-500/10 text-red-600 dark:text-red-400"
                  )}
                >
                  {up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                  {Math.abs(s.change)}%
                </span>
                <span className="text-muted-foreground">{s.hint}</span>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}