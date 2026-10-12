import { Circle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { tasks } from "@/lib/constants/mock-data";

const priorityStyles: Record<string, string> = {
  Urgent: "bg-red-500/10 text-red-600 dark:text-red-400",
  High: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
  Medium: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  Low: "bg-slate-500/10 text-slate-600 dark:text-slate-300",
};

export function TasksCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Upcoming Tasks</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {tasks.map((t) => (
          <div key={t.id} className="flex items-start gap-3">
            <Circle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{t.title}</p>
              <p className="text-xs text-muted-foreground">{t.due}</p>
            </div>
            <Badge variant="outline" className={cn("border-0", priorityStyles[t.priority])}>
              {t.priority}
            </Badge>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}