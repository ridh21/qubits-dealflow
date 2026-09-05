"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import type { AnalyticsData } from "@/server/queries/analytics";
import { PageHeader } from "@/components/layout/page-header";
import { WorkspaceActions } from "@/components/layout/workspace-actions";
import { ChartLineUp, Funnel } from "@/components/icons";
import { useSidebar } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/forms/date-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AnalyticsChart } from "./analytics-chart";
const labels = {
  rep: "My sales",
  manager: "Team performance",
  finance: "Finance",
  ops: "Operations",
  admin: "Platform",
};
export function AnalyticsWorkspace({
  data,
  teams,
}: {
  data: AnalyticsData;
  teams: { id: string; name: string }[];
}) {
  const router = useRouter();
  const { isMobile, setOpenMobile } = useSidebar();
  const [pending, start] = useTransition();
  const [from, setFrom] = useState(data.filters.from),
    [to, setTo] = useState(data.filters.to),
    [teamId, setTeamId] = useState(data.filters.teamId ?? "");
  function url(view = data.view) {
    const query = new URLSearchParams({ from, to, view });
    if (teamId && view !== "admin") query.set("teamId", teamId);
    return `/analytics?${query}`;
  }
  return (
    <>
      <PageHeader
        title="Analytics"
        description={`${labels[data.view]} · ${data.filters.from} to ${data.filters.to} (UTC). Live operational views; manual reports and exports are available separately.`}
      />
      <WorkspaceActions>
        <Button
          disabled={pending || !from || !to || from > to}
          onClick={() =>
            start(() => {
              if (isMobile) setOpenMobile(false);
              router.push(url());
              router.refresh();
            })
          }
        >
          <Funnel className="size-4" />
          {pending ? "Applying…" : "Apply filters"}
        </Button>
        {data.views.map((view) => (
          <Button
            key={view}
            variant={data.view === view ? "secondary" : "ghost"}
            asChild
          >
            <Link
              href={url(view)}
              onClick={() => {
                if (isMobile) setOpenMobile(false);
              }}
              aria-current={view === data.view ? "page" : undefined}
            >
              <ChartLineUp className="size-4" />
              {labels[view]}
            </Link>
          </Button>
        ))}
      </WorkspaceActions>
      <div
        className="flex flex-wrap items-end gap-4"
        role="group"
        aria-label="Analytics filters"
      >
        <div className="grid gap-1.5">
          <span className="text-sm font-medium">From</span>
          <DatePicker
            label="Analytics start date"
            value={new Date(`${from}T12:00:00`)}
            onChange={(d) => {
              if (d) setFrom(format(d, "yyyy-MM-dd"));
            }}
          />
        </div>
        <div className="grid gap-1.5">
          <span className="text-sm font-medium">To</span>
          <DatePicker
            label="Analytics end date"
            value={new Date(`${to}T12:00:00`)}
            onChange={(d) => {
              if (d) setTo(format(d, "yyyy-MM-dd"));
            }}
          />
        </div>
        {data.view !== "admin" && (
          <div className="grid gap-1.5">
            <label htmlFor="analytics-team" className="text-sm font-medium">
              Team
            </label>
            <Select
              value={teamId || "ALL"}
              onValueChange={(v) => setTeamId(v === "ALL" ? "" : v)}
            >
              <SelectTrigger id="analytics-team" className="w-52">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All permitted teams</SelectItem>
                {teams.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        {from > to && (
          <p role="alert" className="text-sm text-destructive">
            End date must be on or after start date.
          </p>
        )}
      </div>
      {(data.view === "rep" || data.view === "manager") && (
        <section className="rounded-xl border p-5">
          <h2 className="font-display text-lg font-semibold">Stalled deals</h2>
          <p className="text-sm text-muted-foreground">
            Open stalled alerts flagged in this period, oldest activity first.
          </p>
          {data.stalled.length ? (
            <ul className="mt-3 space-y-2">
              {data.stalled.map((q) => (
                <li
                  key={q.id}
                  className="flex flex-wrap justify-between gap-2 text-sm"
                >
                  <Link
                    href={`/quotations/${q.id}`}
                    className="font-medium underline"
                  >
                    {q.number}
                  </Link>
                  <span className="text-muted-foreground">
                    Last activity {q.lastActivityAt.slice(0, 10)} UTC
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm">No matching stalled deals.</p>
          )}
        </section>
      )}
      <div className="grid gap-5 xl:grid-cols-2" aria-busy={pending}>
        {data.charts.map((chart) => (
          <AnalyticsChart key={chart.id} chart={chart} />
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        Updated {data.generatedAt.replace("T", " ").slice(0, 19)} UTC. Monetary
        charts use separate currencies.
      </p>
    </>
  );
}
