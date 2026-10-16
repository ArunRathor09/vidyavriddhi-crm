import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { recentDeals, type DealStage } from "@/lib/constants/mock-data";
import { formatINR } from "@/lib/format";

const stageStyles: Record<DealStage, string> = {
  New: "bg-slate-500/10 text-slate-600",
  Qualified: "bg-blue-500/10 text-blue-600",
  Proposal: "bg-amber-500/10 text-amber-600",
  Negotiation: "bg-purple-500/10 text-purple-600",
  Won: "bg-emerald-500/10 text-emerald-600",
};

export function RecentDeals() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Recent Deals</CardTitle>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/deals">View all</Link>
        </Button>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Deal</TableHead>
              <TableHead className="hidden sm:table-cell">Customer</TableHead>
              <TableHead>Stage</TableHead>
              <TableHead className="hidden md:table-cell">Owner</TableHead>
              <TableHead className="text-right">Value</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {recentDeals.map((d) => (
              <TableRow key={d.id}>
                <TableCell>
                  <p className="font-medium">{d.title}</p>
                  <p className="text-xs text-muted-foreground">{d.id}</p>
                </TableCell>
                <TableCell className="hidden sm:table-cell">{d.customer}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={cn("border-0", stageStyles[d.stage])}>
                    {d.stage}
                  </Badge>
                </TableCell>
                <TableCell className="hidden md:table-cell">{d.owner}</TableCell>
                <TableCell className="text-right font-medium">{formatINR(d.value)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}