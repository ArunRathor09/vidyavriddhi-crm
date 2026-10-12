import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRight } from "lucide-react";

const stats = [
  { label: "Total customers", value: "1,248" },
  { label: "Open deals", value: "86" },
  { label: "Pipeline value", value: "₹42.5L" },
];

const stages = [
  { name: "New", count: 12 },
  { name: "Qualified", count: 8 },
  { name: "Proposal", count: 5 },
  { name: "Won", count: 3 },
];

export function Hero() {
  return (
    <section className="mx-auto max-w-6xl px-4 pb-16 pt-16 text-center md:pt-24">
      <Badge variant="secondary" className="mb-4">
        Multi-tenant CRM for modern teams
      </Badge>

      <h1 className="mx-auto max-w-3xl text-4xl font-bold tracking-tight md:text-6xl">
        Customers, leads And sales,{" "}
        <span className="text-primary">all in one place</span>
      </h1>

      <p className="mx-auto mt-5 max-w-2xl text-lg text-muted-foreground">
        Nexora CRM is a multi-tenant CRM platform that helps businesses manage their customers, leads, and sales in one place. With Nexora CRM, you can easily track your sales pipeline, manage your customer relationships, and grow your business.
      </p>

      <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
        <Button size="lg" asChild>
          <Link href="/register">
            Start free <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
        <Button size="lg" variant="outline" asChild>
          <a href="#features">See features</a>
        </Button>
      </div>

      {/* Dashboard preview (sirf mock UI) */}
      <div className="mx-auto mt-14 max-w-4xl rounded-xl border bg-card p-4 text-left shadow-sm md:p-6">
        <div className="grid gap-3 sm:grid-cols-3">
          {stats.map((s) => (
            <div key={s.label} className="rounded-lg border bg-background p-4">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className="mt-1 text-2xl font-semibold">{s.value}</p>
            </div>
          ))}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          {stages.map((stage) => (
            <div key={stage.name} className="rounded-lg bg-muted/50 p-3">
              <div className="mb-2 flex items-center justify-between text-sm font-medium">
                {stage.name}
                <span className="text-xs text-muted-foreground">{stage.count}</span>
              </div>
              <div className="space-y-2">
                <div className="h-10 rounded-md border bg-background" />
                <div className="h-10 rounded-md border bg-background" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}