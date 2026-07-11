import ReactEChartsCore from "echarts-for-react/lib/core";
import * as echarts from "echarts/core";
import { BarChart, LineChart as EChartsLineChart } from "echarts/charts";
import { GridComponent, LegendComponent, TooltipComponent } from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import type { EChartsOption } from "echarts";
import type { HistoryPoint, Sector, StockDetail } from "../types";
import { formatAmount, formatPct } from "../format";

echarts.use([BarChart, EChartsLineChart, GridComponent, LegendComponent, TooltipComponent, CanvasRenderer]);

const compareColors = ["#0071e3", "#d43f3a", "#16845f", "#7a5195", "#9a6700"];
const tooltipStyle = {
  backgroundColor: "rgba(255,255,255,0.96)",
  borderColor: "rgba(0,0,0,0.09)",
  borderWidth: 1,
  padding: 11,
  textStyle: { color: "#1d1d1f", fontSize: 12 },
  extraCssText: "border-radius:8px;box-shadow:0 12px 36px rgba(0,0,0,0.12);backdrop-filter:blur(18px)"
};

interface LineChartProps {
  data: HistoryPoint[];
  height?: number;
  color?: string;
}

export function LineChart({ data, height = 260, color = "#0071e3" }: LineChartProps) {
  const option: EChartsOption = {
    animationDuration: 900,
    animationEasing: "cubicOut",
    grid: { left: 44, right: 16, top: 20, bottom: 34 },
    tooltip: { trigger: "axis", axisPointer: { lineStyle: { color: "#a1a1a6", type: "dashed" } }, ...tooltipStyle },
    xAxis: {
      type: "category",
      data: data.map((item) => item.date),
      axisLabel: { color: "#86868b", hideOverlap: true },
      axisLine: { show: false },
      axisTick: { show: false }
    },
    yAxis: {
      type: "value",
      scale: true,
      axisLabel: { color: "#86868b" },
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { lineStyle: { color: "#e8e8ed" } }
    },
    series: [
      {
        type: "line",
        smooth: true,
        showSymbol: false,
        data: data.map((item) => item.close),
        lineStyle: { width: 2.5, color },
        areaStyle: { color: "rgba(0,113,227,0.07)" },
        emphasis: { focus: "series", lineStyle: { width: 3.5 } }
      }
    ]
  };
  return <ReactEChartsCore echarts={echarts} option={option} style={{ height }} notMerge lazyUpdate />;
}

export function SectorBarChart({ data, height = 260 }: { data: Sector[]; height?: number }) {
  const top = data.slice(0, 10).reverse();
  const option: EChartsOption = {
    animationDuration: 820,
    animationEasing: "cubicOut",
    grid: { left: 90, right: 28, top: 14, bottom: 30 },
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "shadow", shadowStyle: { color: "rgba(0,0,0,0.025)" } },
      ...tooltipStyle,
      formatter: (params) => {
        const item = Array.isArray(params) ? params[0] : params;
        const sector = top[item.dataIndex];
        return `${sector.name}<br/>涨跌幅 ${formatPct(sector.change_pct)}<br/>成交额 ${formatAmount(sector.amount)}`;
      }
    },
    xAxis: {
      type: "value",
      axisLabel: { color: "#86868b", formatter: "{value}%" },
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { lineStyle: { color: "#e8e8ed" } }
    },
    yAxis: {
      type: "category",
      data: top.map((item) => item.name),
      axisLabel: { color: "#515154" },
      axisLine: { show: false },
      axisTick: { show: false }
    },
    series: [
      {
        type: "bar",
        data: top.map((item) => item.change_pct),
        itemStyle: {
          color: (params) => (Number(params.value) >= 0 ? "#d43f3a" : "#16845f"),
          borderRadius: [0, 4, 4, 0]
        },
        emphasis: { itemStyle: { opacity: 0.78 } }
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
    animationDuration: 920,
    animationEasing: "cubicOut",
    color: compareColors,
    grid: { left: 48, right: 20, top: 42, bottom: 34 },
    legend: { top: 4, icon: "circle", itemWidth: 8, itemHeight: 8, textStyle: { color: "#515154", fontSize: 11 } },
    tooltip: {
      trigger: "axis",
      valueFormatter: (value) => `${Number(value).toFixed(2)}%`,
      axisPointer: { lineStyle: { color: "#a1a1a6", type: "dashed" } },
      ...tooltipStyle
    },
    xAxis: {
      type: "category",
      data: dates,
      axisLabel: { color: "#86868b", hideOverlap: true },
      axisLine: { show: false },
      axisTick: { show: false }
    },
    yAxis: {
      type: "value",
      axisLabel: { color: "#86868b", formatter: "{value}%" },
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { lineStyle: { color: "#e8e8ed" } }
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
        lineStyle: { width: 2.5 },
        emphasis: { focus: "series", lineStyle: { width: 3.5 } }
      };
    })
  };
  return <ReactEChartsCore echarts={echarts} option={option} style={{ height }} notMerge lazyUpdate />;
}
