import ReactEChartsCore from "echarts-for-react/lib/core";
import * as echarts from "echarts/core";
import { BarChart, LineChart as EChartsLineChart } from "echarts/charts";
import { GridComponent, LegendComponent, TooltipComponent } from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import type { EChartsOption } from "echarts";
import type { HistoryPoint, Sector, StockDetail } from "../types";
import { formatAmount, formatPct } from "../format";

echarts.use([BarChart, EChartsLineChart, GridComponent, LegendComponent, TooltipComponent, CanvasRenderer]);

const compareColors = ["#2f6f6d", "#c43d36", "#8a5a00", "#3568a8", "#7a5195"];

interface LineChartProps {
  data: HistoryPoint[];
  height?: number;
  color?: string;
}

export function LineChart({ data, height = 260, color = "#2f6f6d" }: LineChartProps) {
  const option: EChartsOption = {
    grid: { left: 44, right: 16, top: 18, bottom: 34 },
    tooltip: { trigger: "axis" },
    xAxis: {
      type: "category",
      data: data.map((item) => item.date),
      axisLabel: { color: "#667085", hideOverlap: true }
    },
    yAxis: {
      type: "value",
      scale: true,
      axisLabel: { color: "#667085" },
      splitLine: { lineStyle: { color: "#edf0f2" } }
    },
    series: [
      {
        type: "line",
        smooth: true,
        showSymbol: false,
        data: data.map((item) => item.close),
        lineStyle: { width: 2, color },
        areaStyle: { color: "rgba(47,111,109,0.12)" }
      }
    ]
  };
  return <ReactEChartsCore echarts={echarts} option={option} style={{ height }} notMerge lazyUpdate />;
}

export function SectorBarChart({ data, height = 260 }: { data: Sector[]; height?: number }) {
  const top = data.slice(0, 10).reverse();
  const option: EChartsOption = {
    grid: { left: 90, right: 28, top: 14, bottom: 30 },
    tooltip: {
      trigger: "axis",
      formatter: (params) => {
        const item = Array.isArray(params) ? params[0] : params;
        const sector = top[item.dataIndex];
        return `${sector.name}<br/>涨跌幅 ${formatPct(sector.change_pct)}<br/>成交额 ${formatAmount(sector.amount)}`;
      }
    },
    xAxis: {
      type: "value",
      axisLabel: { color: "#667085", formatter: "{value}%" },
      splitLine: { lineStyle: { color: "#edf0f2" } }
    },
    yAxis: {
      type: "category",
      data: top.map((item) => item.name),
      axisLabel: { color: "#475467" }
    },
    series: [
      {
        type: "bar",
        data: top.map((item) => item.change_pct),
        itemStyle: {
          color: (params) => (Number(params.value) >= 0 ? "#c43d36" : "#16845f"),
          borderRadius: [0, 4, 4, 0]
        }
      }
    ]
  };
  return <ReactEChartsCore echarts={echarts} option={option} style={{ height }} notMerge lazyUpdate />;
}

export function ComparisonLineChart({ details, days = 60, height = 360 }: { details: StockDetail[]; days?: number; height?: number }) {
  const histories = details.map((detail) => ({
    detail,
    rows: (detail.history ?? []).filter((item) => item.date && Number.isFinite(Number(item.close))).slice(-days)
  }));
  const dates = Array.from(new Set(histories.flatMap((item) => item.rows.map((row) => row.date)))).sort();
  const option: EChartsOption = {
    animationDuration: 260,
    color: compareColors,
    grid: { left: 48, right: 20, top: 42, bottom: 34 },
    legend: { top: 4, textStyle: { color: "#475467" } },
    tooltip: { trigger: "axis", valueFormatter: (value) => `${Number(value).toFixed(2)}%` },
    xAxis: { type: "category", data: dates, axisLabel: { color: "#667085", hideOverlap: true } },
    yAxis: {
      type: "value",
      axisLabel: { color: "#667085", formatter: "{value}%" },
      splitLine: { lineStyle: { color: "#edf0f2" } }
    },
    series: histories.map(({ detail, rows }) => {
      const first = Number(rows[0]?.close) || 1;
      const byDate = new Map(rows.map((row) => [row.date, ((Number(row.close) / first) - 1) * 100]));
      return {
        name: detail.quote.name,
        type: "line",
        smooth: true,
        showSymbol: false,
        connectNulls: true,
        data: dates.map((date) => {
          const value = byDate.get(date);
          return value == null ? null : Number(value.toFixed(2));
        }),
        lineStyle: { width: 2 }
      };
    })
  };
  return <ReactEChartsCore echarts={echarts} option={option} style={{ height }} notMerge lazyUpdate />;
}
