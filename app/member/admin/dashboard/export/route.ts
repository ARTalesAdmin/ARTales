import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/guards";
import { getAdminDashboardMetrics, metricsToCsv } from "@/lib/purchases";

export async function GET(request: Request) {
  await requireAdmin();
  const url = new URL(request.url);
  const range = url.searchParams.get("range") === "all" ? "all" : "month";
  const metrics = await getAdminDashboardMetrics(range);
  const csv = metricsToCsv(metrics);
  const filename = `artales-dashboard-${range}-${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
