import Link from "next/link";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const plans = [
  {
    name: "Free",
    price: "₹0",
    note: "Hamesha free",
    features: ["Limited users", "Limited customers", "Basic CRM"],
  },
  {
    name: "Professional",
    price: "₹999",
    note: "per user / month",
    features: ["More users", "Advanced pipelines", "Analytics", "Automation"],
    popular: true,
  },
  {
    name: "Business",
    price: "₹2,999",
    note: "per user / month",
    features: ["Advanced permissions", "Advanced analytics", "Integrations", "Priority support"],
  },
  {
    name: "Enterprise",
    price: "Custom",
    note: "Contact us",
    features: ["Custom limits", "SSO", "Advanced security", "Dedicated support"],
  },
];

export function Pricing() {
  return (
    <section id="pricing" className="py-20">
      <div className="mx-auto max-w-6xl px-4">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight">Simple pricing</h2>
          <p className="mt-3 text-muted-foreground">
            Free se shuru karo, zarurat ke hisaab se upgrade karo.
          </p>
        </div>

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {plans.map((plan) => (
            <Card
              key={plan.name}
              className={plan.popular ? "border-primary shadow-md" : ""}
            >
              <CardHeader>
                <CardTitle className="flex items-center justify-between text-lg">
                  {plan.name}
                  {plan.popular && <Badge>Popular</Badge>}
                </CardTitle>
                <div className="pt-2">
                  <span className="text-3xl font-bold">{plan.price}</span>
                  <p className="text-xs text-muted-foreground">{plan.note}</p>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-2 text-sm">
                  {plan.features.map((item) => (
                    <li key={item} className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-primary" />
                      {item}
                    </li>
                  ))}
                </ul>
                <Button
                  className="w-full"
                  variant={plan.popular ? "default" : "outline"}
                  asChild
                >
                  <Link href="/register">Get started</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}