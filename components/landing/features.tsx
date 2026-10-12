import {
  Users,
  Target,
  Columns3,
  ListChecks,
  TrendingUp,
  ShieldCheck,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const features = [
  {
    icon: Users,
    title: "Customer Management",
    description: "Profiles, contacts, history, notes aur custom fields, sab ek dashboard se.",
  },
  {
    icon: Target,
    title: "Lead Management",
    description: "Leads capture karo, score karo, assign karo aur customer mein convert karo.",
  },
  {
    icon: Columns3,
    title: "Sales Pipeline",
    description: "Drag-and-drop pipeline, deal stages aur forecasting ke saath.",
  },
  {
    icon: ListChecks,
    title: "Tasks & Activities",
    description: "Calls, meetings, follow-ups aur reminders ek timeline mein.",
  },
  {
    icon: TrendingUp,
    title: "Analytics & Reports",
    description: "Revenue, conversion rate aur team performance ke clear charts.",
  },
  {
    icon: ShieldCheck,
    title: "Secure by Design",
    description: "Role-based access, tenant isolation aur audit logs.",
  },
];

export function Features() {
  return (
    <section id="features" className="border-t bg-muted/30 py-20">
      <div className="mx-auto max-w-6xl px-4">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight">
            Business chalane ke liye sab kuch
          </h2>
          <p className="mt-3 text-muted-foreground">
            Chhoti team ho ya badi company, Nexora aapke saath scale hota hai.
          </p>
        </div>

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <Card key={f.title}>
              <CardHeader>
                <span className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <f.icon className="h-5 w-5" />
                </span>
                <CardTitle className="text-lg">{f.title}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                {f.description}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}