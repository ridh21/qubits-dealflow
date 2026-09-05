"use client";
import { useId, useState } from "react";
import {
  PolarAngleAxis,
  RadialBar,
  RadialBarChart,
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  LineChart,
  Pie,
  PieChart,
  Scatter,
  ScatterChart,
  XAxis,
  YAxis,
} from "recharts";
import type { AnalyticsChart as Definition } from "@/domain/analytics/charts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableHeader,
  TableHead,
  TableRow,
  TableBody,
  TableCell,
} from "@/components/ui/table";
const color = (index: number) => `var(--chart-${(index % 5) + 1})`;
const number = new Intl.NumberFormat("en", { maximumFractionDigits: 2 });
export function AnalyticsChart({ chart }: { chart: Definition }) {
  const [table, setTable] = useState(false);
  const id = useId();
  const config = Object.fromEntries(
    chart.series.map((s, i) => [s.key, { label: s.label, color: color(i) }]),
  );
  const horizontal = chart.kind === "horizontal";
  const axes = (
    <>
      <CartesianGrid vertical={false} />
      <XAxis
        dataKey={horizontal ? undefined : "label"}
        type={horizontal ? "number" : "category"}
        allowDecimals={
          !horizontal ||
          ![
            "Quotations",
            "Steps",
            "Requests",
            "Invoices",
            "Shipments",
            "Users",
            "Messages",
            "Transitions",
            "Audit events",
            "Units",
          ].includes(chart.unit)
        }
        tickLine={false}
        axisLine={false}
        tickFormatter={horizontal ? (v) => number.format(Number(v)) : undefined}
      />
      <YAxis
        dataKey={horizontal ? "label" : undefined}
        type={horizontal ? "category" : "number"}
        width={horizontal ? 125 : 65}
        allowDecimals={
          ![
            "Quotations",
            "Steps",
            "Requests",
            "Invoices",
            "Shipments",
            "Users",
            "Messages",
            "Transitions",
            "Audit events",
            "Units",
          ].includes(chart.unit)
        }
        domain={
          !horizontal && chart.unit.startsWith("%") ? [0, 100] : undefined
        }
        tickLine={false}
        axisLine={false}
        tickFormatter={horizontal ? undefined : (v) => number.format(Number(v))}
      />
      <ChartTooltip content={<ChartTooltipContent />} />
    </>
  );
  let visual;
  switch (chart.kind) {
    case "radial":
      visual = (
        <RadialBarChart
          data={chart.rows}
          startAngle={180}
          endAngle={0}
          innerRadius="60%"
          outerRadius="90%"
          cy="75%"
        >
          <PolarAngleAxis
            type="number"
            domain={[0, chart.maximum ?? 100]}
            tick={false}
          />
          <RadialBar
            dataKey={chart.series[0].key}
            background
            fill={color(0)}
            isAnimationActive={false}
          />
          <ChartTooltip content={<ChartTooltipContent nameKey="label" />} />
        </RadialBarChart>
      );
      break;
    case "donut":
      visual = (
        <PieChart>
          <ChartTooltip content={<ChartTooltipContent nameKey="label" />} />
          <Pie
            data={chart.rows}
            dataKey={chart.series[0].key}
            nameKey="label"
            innerRadius="48%"
            outerRadius="78%"
            isAnimationActive={false}
          >
            {chart.rows.map((r, i) => (
              <Cell key={r.label} fill={color(i)} />
            ))}
          </Pie>
        </PieChart>
      );
      break;
    case "scatter":
      visual = (
        <ScatterChart margin={{ bottom: 15, right: 20 }}>
          <CartesianGrid />
          <XAxis
            type="number"
            dataKey={chart.series[0].key}
            name={chart.series[0].label}
          />
          <YAxis
            type="number"
            dataKey={chart.series[1].key}
            name={chart.series[1].label}
          />
          <ChartTooltip
            cursor={{ strokeDasharray: "3 3" }}
            content={
              <ChartTooltipContent
                labelFormatter={(_, payload) =>
                  payload[0]?.payload?.label ?? "Quotation"
                }
              />
            }
          />
          <Scatter data={chart.rows} fill={color(0)} isAnimationActive={false}>
            {chart.rows.map((r) => (
              <Cell
                key={r.label}
                fill={r.label.includes("· anomaly") ? color(3) : color(0)}
              />
            ))}
          </Scatter>
        </ScatterChart>
      );
      break;
    case "line":
      visual = (
        <LineChart data={chart.rows}>
          {axes}
          {chart.series.map((s, i) => (
            <Line
              key={s.key}
              dataKey={s.key}
              name={s.label}
              stroke={color(i)}
              strokeWidth={2}
              dot={{ r: 3 }}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      );
      break;
    case "area":
      visual = (
        <AreaChart data={chart.rows}>
          {axes}
          {chart.series.map((s, i) => (
            <Area
              key={s.key}
              dataKey={s.key}
              name={s.label}
              stackId={chart.stacked ? "total" : undefined}
              stroke={color(i)}
              fill={color(i)}
              fillOpacity={0.35}
              isAnimationActive={false}
            />
          ))}
        </AreaChart>
      );
      break;
    case "combo":
      visual = (
        <ComposedChart data={chart.rows}>
          {axes}
          {chart.series.map((s, i) =>
            i === 0 ? (
              <Bar
                key={s.key}
                dataKey={s.key}
                name={s.label}
                fill={color(i)}
                isAnimationActive={false}
              />
            ) : (
              <Line
                key={s.key}
                dataKey={s.key}
                name={s.label}
                stroke={color(i)}
                strokeWidth={3}
                isAnimationActive={false}
              />
            ),
          )}
        </ComposedChart>
      );
      break;
    default:
      visual = (
        <BarChart
          data={chart.rows}
          layout={horizontal ? "vertical" : "horizontal"}
        >
          {axes}
          {chart.series.map((s, i) => (
            <Bar
              key={s.key}
              dataKey={s.key}
              name={s.label}
              stackId={chart.stacked ? "total" : undefined}
              fill={color(i)}
              isAnimationActive={false}
            />
          ))}
        </BarChart>
      );
  }
  const legends =
    chart.kind === "donut"
      ? chart.rows.map((r) => r.label)
      : chart.series.map((s) => s.label);
  return (
    <section
      className="min-w-0 space-y-4 rounded-xl border bg-card p-5"
      aria-labelledby={`${id}-title`}
    >
      <div>
        <h2 id={`${id}-title`} className="font-display text-lg font-semibold">
          {chart.title}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{chart.question}</p>
      </div>
      <div className="flex items-center justify-between gap-3 text-xs">
        <span>
          {chart.dimension} · {chart.unit}
        </span>
        <label className="flex shrink-0 items-center gap-2" htmlFor={id}>
          <Switch
            id={id}
            aria-label={`Show data table for ${chart.title}`}
            checked={table}
            onCheckedChange={setTable}
          />
          Data table
        </label>
      </div>
      {!chart.rows.length ? (
        <p className="flex h-64 items-center justify-center text-sm text-muted-foreground">
          No matching records.
        </p>
      ) : !table &&
        chart.kind === "donut" &&
        chart.rows.every((row) => row[chart.series[0].key] === 0) ? (
        <p className="flex h-64 items-center justify-center text-sm text-muted-foreground">
          No activity for these categories.
        </p>
      ) : table ? (
        <div className="max-h-80 overflow-auto">
          <Table>
            <caption className="sr-only">
              {chart.title} · {chart.unit}
            </caption>
            <TableHeader>
              <TableRow>
                <TableHead>
                  {chart.kind === "scatter" ? "Quotation" : chart.dimension}
                </TableHead>
                {chart.series.map((s) => (
                  <TableHead key={s.key}>
                    {s.label}
                    {chart.kind === "scatter" || s.label === chart.unit
                      ? ""
                      : ` (${chart.unit})`}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {chart.rows.map((r, index) => (
                <TableRow key={`${r.label}-${index}`}>
                  <TableCell>{r.label}</TableCell>
                  {chart.series.map((s) => (
                    <TableCell key={s.key} className="tabular-nums">
                      {typeof r[s.key] === "number"
                        ? number.format(r[s.key] as number)
                        : r[s.key]}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <ChartContainer
          config={config}
          className="h-72 w-full"
          role="group"
          aria-label={chart.title}
        >
          {visual}
        </ChartContainer>
      )}
      {chart.kind === "radial" && chart.rows.length > 0 && (
        <p className="text-center text-2xl font-semibold tabular-nums">
          {number.format(Number(chart.rows[0][chart.series[0].key]))}{" "}
          <span className="text-sm font-normal">{chart.unit}</span>
        </p>
      )}
      <ul
        className="flex flex-wrap gap-x-4 gap-y-1 text-xs"
        aria-label="Legend"
      >
        {legends.map((label, i) => (
          <li key={`${label}-${i}`} className="flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="size-2.5 rounded-sm"
              style={{ background: color(i) }}
            />
            {label}
          </li>
        ))}
      </ul>
    </section>
  );
}
