import ReactEChartsCore from "echarts-for-react/lib/core";
import * as echarts from "echarts/core";
import { BarChart, LineChart, TreemapChart } from "echarts/charts";
import { GridComponent, TooltipComponent } from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import type { EChartsOption } from "echarts";
import type { ChangeDistributionBucket, HistoryPoint, Sector } from "../types";
import { formatAmount, formatPct } from "../format";

echarts.use([BarChart, LineChart, TreemapChart, GridComponent, TooltipComponent, CanvasRenderer]);

const tooltip = {
  backgroundColor: "rgba(255,255,255,0.96)",
  borderColor: "rgba(0,0,0,0.1)",
  borderWidth: 1,
  textStyle: { color: "#1d1d1f", fontSize: 12 },
  extraCssText: "border-radius:8px;box-shadow:0 12px 36px rgba(0,0,0,.12);backdrop-filter:blur(18px)"
};

export function IndexTrendChart({ data, height = 280 }: { data: HistoryPoint[]; height?: number }) {
  const option: EChartsOption = {
    animationDuration: 650,
    animationDurationUpdate: 420,
    animationEasing: "cubicOut",
    grid: { left: 45, right: 14, top: 22, bottom: 32 },
    tooltip: { trigger: "axis", axisPointer: { lineStyle: { color: "#86868b", type: "dashed" } }, ...tooltip },
    xAxis: { type: "category", data: data.map((item) => item.date), boundaryGap: false, axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: "#86868b", hideOverlap: true } },
    yAxis: { type: "value", scale: true, axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: "#86868b" }, splitLine: { lineStyle: { color: "#ececf0" } } },
    series: [{ type: "line", data: data.map((item) => item.close), smooth: 0.25, showSymbol: false, lineStyle: { color: "#0071e3", width: 2.5 }, areaStyle: { color: "rgba(0,113,227,.06)" }, emphasis: { focus: "series" } }]
  };
  return <ReactEChartsCore echarts={echarts} option={option} style={{ height }} notMerge lazyUpdate />;
}

export function SectorTreemap({ data, height = 320, onSelect }: { data: Sector[]; height?: number; onSelect?: (sector: string) => void }) {
  const option: EChartsOption = {
    animationDuration: 650,
    animationDurationUpdate: 420,
    tooltip: {
      ...tooltip,
      formatter: (params) => {
        const item = Array.isArray(params) ? params[0] : params;
        const row = data.find((sector) => sector.name === String(item.name));
        return row ? `${row.name}<br/>涨跌幅 ${formatPct(row.change_pct)}<br/>成交额 ${formatAmount(row.amount)}` : String(item.name);
      }
    },
    series: [{
      type: "treemap",
      roam: false,
      nodeClick: false,
      breadcrumb: { show: false },
      label: { show: true, formatter: "{b}\n{c}%", color: "#fff", fontSize: 12, lineHeight: 18 },
      itemStyle: { borderColor: "#fff", borderWidth: 3, gapWidth: 2 },
      upperLabel: { show: false },
      data: data.slice(0, 14).map((item) => ({
        name: item.name,
        value: Math.max(item.amount, 1),
        itemStyle: { color: item.change_pct >= 0 ? redScale(item.change_pct) : greenScale(item.change_pct) },
        label: { formatter: `${item.name}\n${formatPct(item.change_pct)}` }
      }))
    }]
  };
  return <ReactEChartsCore echarts={echarts} option={option} onEvents={{ click: (params: { name?: string }) => params.name && onSelect?.(params.name) }} style={{ height }} notMerge lazyUpdate />;
}

export function DistributionChart({ data, height = 260 }: { data: ChangeDistributionBucket[]; height?: number }) {
  const option: EChartsOption = {
    animationDuration: 620,
    animationDelay: (index: number) => index * 45,
    grid: { left: 36, right: 12, top: 18, bottom: 34 },
    tooltip: { trigger: "axis", axisPointer: { type: "shadow", shadowStyle: { color: "rgba(0,0,0,.03)" } }, ...tooltip },
    xAxis: { type: "category", data: data.map((item) => item.label), axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: "#86868b", interval: 0, fontSize: 10 } },
    yAxis: { type: "value", minInterval: 1, axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: "#86868b" }, splitLine: { lineStyle: { color: "#ececf0" } } },
    series: [{
      type: "bar",
      data: data.map((item, index) => ({ value: item.count, itemStyle: { color: index < 4 ? "#16845f" : "#d43f3a", borderRadius: [4, 4, 0, 0] } })),
      barMaxWidth: 38,
      emphasis: { itemStyle: { opacity: 0.78 } }
    }]
  };
  return <ReactEChartsCore echarts={echarts} option={option} style={{ height }} notMerge lazyUpdate />;
}

function redScale(value: number) {
  const alpha = Math.min(0.95, 0.52 + Math.abs(value) / 9);
  return `rgba(199,42,36,${alpha})`;
}

function greenScale(value: number) {
  const alpha = Math.min(0.95, 0.52 + Math.abs(value) / 9);
  return `rgba(22,132,95,${alpha})`;
}
