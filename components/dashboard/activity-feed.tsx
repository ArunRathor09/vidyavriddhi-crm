import { Calendar, Mail, Phone, StickyNote, Trophy } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { activities } from "@/lib/constants/mock-data";

const icons = {
  call: Phone,
  deal: Trophy,
  email: Mail,
  meeting: Calendar,
  note: StickyNote,
} as const;

export function ActivityFeed() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Recent Activity</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {activities.map((a) => {
          const Icon = icons[a.type as keyof typeof icons];
          return (
            <div key={a.id} className="flex items-start gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Icon className="h-4 w-4" />
              </span>
              <div>
                <p className="text-sm">{a.text}</p>
                <p className="text-xs text-muted-foreground">{a.time}</p>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}