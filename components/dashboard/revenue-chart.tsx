"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { revenueData } from "@/lib/constants/mock-data";

export function RevenueChart() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Revenue vs Target</CardTitle>
        <p className="text-sm text-muted-foreground">Last 9 months (₹ lakhs mein)</p>
      </CardHeader>
      <CardContent>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={revenueData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={12} stroke="var(--muted-foreground)" />
              <YAxis tickLine={false} axisLine={false} fontSize={12} stroke="var(--muted-foreground)" tickFormatter={(v) => `₹${v}L`} />
              <Tooltip
                formatter={(v) => `₹${v}L`}
                contentStyle={{
                  backgroundColor: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <Area type="monotone" dataKey="target" stroke="var(--muted-foreground)" strokeDasharray="4 4" strokeWidth={2} fill="none" />
              <Area type="monotone" dataKey="revenue" stroke="var(--primary)" strokeWidth={2} fill="url(#revenueFill)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}