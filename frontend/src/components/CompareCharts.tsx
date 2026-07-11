import ReactEChartsCore from "echarts-for-react/lib/core";
import * as echarts from "echarts/core";
import { HeatmapChart, LineChart, ScatterChart } from "echarts/charts";
import { GridComponent, LegendComponent, TooltipComponent, VisualMapComponent } from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import type { EChartsOption } from "echarts";
import type { CompareResponse } from "../types";

echarts.use([HeatmapChart, LineChart, ScatterChart, GridComponent, LegendComponent, TooltipComponent, VisualMapComponent, CanvasRenderer]);

const colors = ["#0071e3", "#d43f3a", "#16845f", "#7a5195", "#9a6700"];
const tooltip = { backgroundColor: "rgba(255,255,255,.96)", borderColor: "rgba(0,0,0,.1)", textStyle: { color: "#1d1d1f" }, extraCssText: "border-radius:8px;box-shadow:0 12px 36px rgba(0,0,0,.12)" };

export function PerformanceChart({ data, height = 360 }: { data: CompareResponse; height?: number }) {
  const dates = Array.from(new Set([
    ...data.benchmark.values.map((item) => item.date),
    ...data.series.flatMap((item) => item.values.map((value) => value.date))
  ])).sort();
  const series = [
    ...data.series.map((item, index) => {
      const values = new Map(item.values.map((value) => [value.date, value.value]));
      return { name: item.name, type: "line" as const, data: dates.map((date) => values.get(date) ?? null), smooth: 0.25, showSymbol: false, connectNulls: true, lineStyle: { color: colors[index], width: 2.5 }, emphasis: { focus: "series" as const } };
    }),
    (() => {
      const values = new Map(data.benchmark.values.map((value) => [value.date, value.value]));
      return { name: data.benchmark.name, type: "line" as const, data: dates.map((date) => values.get(date) ?? null), smooth: true, showSymbol: false, connectNulls: true, lineStyle: { color: "#86868b", width: 1.6, type: "dashed" as const } };
    })()
  ];
  const option: EChartsOption = {
    animationDuration: 650,
    animationDurationUpdate: 420,
    color: colors,
    legend: { top: 4, icon: "circle", itemWidth: 8, itemHeight: 8, textStyle: { color: "#515154", fontSize: 11 } },
    tooltip: { trigger: "axis", valueFormatter: (value) => `${Number(value).toFixed(2)}%`, axisPointer: { lineStyle: { color: "#86868b", type: "dashed" } }, ...tooltip },
    grid: { left: 52, right: 20, top: 42, bottom: 34 },
    xAxis: { type: "category", data: dates, boundaryGap: false, axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: "#86868b", hideOverlap: true } },
    yAxis: { type: "value", axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: "#86868b", formatter: "{value}%" }, splitLine: { lineStyle: { color: "#ececf0" } } },
    series
  };
  return <ReactEChartsCore echarts={echarts} option={option} style={{ height }} notMerge lazyUpdate />;
}

export function RiskReturnChart({ data, height = 300 }: { data: CompareResponse; height?: number }) {
  const maxAmount = Math.max(...data.metrics.map((item) => item.amount), 1);
  const option: EChartsOption = {
    animationDuration: 620,
    tooltip: { ...tooltip, formatter: (params) => {
      const item = Array.isArray(params) ? params[0] : params;
      const value = item.value as [number, number, number, string];
      return `${value[3]}<br/>年化波动 ${value[0].toFixed(2)}%<br/>区间收益 ${value[1].toFixed(2)}%`;
    } },
    grid: { left: 52, right: 20, top: 20, bottom: 40 },
    xAxis: { type: "value", name: "年化波动率", nameLocation: "middle", nameGap: 28, axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: "#86868b", formatter: "{value}%" }, splitLine: { lineStyle: { color: "#ececf0" } } },
    yAxis: { type: "value", name: "区间收益", nameGap: 18, axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: "#86868b", formatter: "{value}%" }, splitLine: { lineStyle: { color: "#ececf0" } } },
    series: [{ type: "scatter", data: data.metrics.map((item, index) => ({ value: [item.annualized_volatility ?? 0, item.return_pct, item.amount, item.name], itemStyle: { color: colors[index] } })), symbolSize: (value) => 14 + Math.sqrt(Number(value[2]) / maxAmount) * 32, label: { show: true, position: "top", color: "#515154", formatter: (params) => String((params.value as unknown[])[3]) }, emphasis: { scale: 1.15 } }]
  };
  return <ReactEChartsCore echarts={echarts} option={option} style={{ height }} notMerge lazyUpdate />;
}

export function CorrelationChart({ data, height = 300 }: { data: CompareResponse; height?: number }) {
  const cells = data.correlation.values.flatMap((row, y) => row.map((value, x) => [x, y, value ?? 0]));
  const option: EChartsOption = {
    animationDuration: 520,
    tooltip: { ...tooltip, formatter: (params) => {
      const item = Array.isArray(params) ? params[0] : params;
      const value = item.value as [number, number, number];
      return `${data.correlation.labels[value[1]]} × ${data.correlation.labels[value[0]]}<br/>相关系数 ${value[2].toFixed(2)}`;
    } },
    grid: { left: 72, right: 24, top: 18, bottom: 58 },
    xAxis: { type: "category", data: data.correlation.labels, axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: "#6e6e73", rotate: 20 } },
    yAxis: { type: "category", data: data.correlation.labels, axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: "#6e6e73" } },
    visualMap: { min: -1, max: 1, calculable: false, orient: "horizontal", left: "center", bottom: 0, itemWidth: 12, itemHeight: 120, inRange: { color: ["#16845f", "#f5f5f7", "#d43f3a"] }, textStyle: { color: "#86868b" } },
    series: [{ type: "heatmap", data: cells, label: { show: true, formatter: (params) => Number((params.value as number[])[2]).toFixed(2), color: "#1d1d1f" }, emphasis: { itemStyle: { shadowBlur: 8, shadowColor: "rgba(0,0,0,.16)" } } }]
  };
  return <ReactEChartsCore echarts={echarts} option={option} style={{ height }} notMerge lazyUpdate />;
}
