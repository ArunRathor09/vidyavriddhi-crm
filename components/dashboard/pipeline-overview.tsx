import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { pipelineStages } from "@/lib/constants/mock-data";
import { formatINR } from "@/lib/format";

export function PipelineOverview() {
  const max = Math.max(...pipelineStages.map((s) => s.deals));
  const total = pipelineStages.reduce((sum, s) => sum + s.value, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Sales Pipeline</CardTitle>
        <p className="text-sm text-muted-foreground">
          Total value: <span className="font-medium text-foreground">{formatINR(total)}</span>
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        {pipelineStages.map((s) => (
          <div key={s.name}>
            <div className="mb-1.5 flex items-center justify-between text-sm">
              <span className="font-medium">{s.name}</span>
              <span className="text-muted-foreground">
                {s.deals} deals · {formatINR(s.value)}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${(s.deals / max) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}