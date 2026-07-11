import { useMemo } from "react";
import ReactEChartsCore from "echarts-for-react/lib/core";
import * as echarts from "echarts/core";
import { BarChart, CandlestickChart, LineChart } from "echarts/charts";
import { AxisPointerComponent, DataZoomComponent, GridComponent, LegendComponent, TooltipComponent } from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import type { EChartsOption } from "echarts";
import { calculateTechnicalSeries } from "../lib/marketMath";
import type { HistoryPoint } from "../types";

echarts.use([BarChart, CandlestickChart, LineChart, AxisPointerComponent, DataZoomComponent, GridComponent, LegendComponent, TooltipComponent, CanvasRenderer]);

export type IndicatorMode = "macd" | "rsi";

export default function StockTechnicalChart({ data, indicator = "macd", height = 540 }: { data: HistoryPoint[]; indicator?: IndicatorMode; height?: number }) {
  const rows = useMemo(() => calculateTechnicalSeries(data), [data]);
  const dates = rows.map((item) => item.date);
  const option: EChartsOption = {
    animation: true,
    animationDuration: 620,
    animationDurationUpdate: 360,
    animationEasing: "cubicOut",
    legend: { top: 4, right: 8, itemWidth: 12, itemHeight: 3, textStyle: { color: "#6e6e73", fontSize: 11 }, data: ["MA5", "MA10", "MA20"] },
    axisPointer: { link: [{ xAxisIndex: "all" }], label: { backgroundColor: "#1d1d1f" } },
    tooltip: { trigger: "axis", axisPointer: { type: "cross", lineStyle: { color: "#86868b", type: "dashed" } }, borderColor: "rgba(0,0,0,.1)", backgroundColor: "rgba(255,255,255,.96)", textStyle: { color: "#1d1d1f" }, extraCssText: "border-radius:8px;box-shadow:0 12px 36px rgba(0,0,0,.12)" },
    grid: [
      { left: 55, right: 20, top: 38, height: "53%" },
      { left: 55, right: 20, top: "65%", height: "11%" },
      { left: 55, right: 20, top: "80%", height: "13%" }
    ],
    xAxis: [0, 1, 2].map((gridIndex) => ({
      type: "category",
      gridIndex,
      data: dates,
      boundaryGap: true,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { show: gridIndex === 2, color: "#86868b", hideOverlap: true },
      splitLine: { show: false },
      min: "dataMin",
      max: "dataMax"
    })),
    yAxis: [0, 1, 2].map((gridIndex) => ({
      scale: true,
      gridIndex,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: "#86868b", fontSize: 10 },
      splitLine: { lineStyle: { color: "#ececf0" } }
    })),
    dataZoom: [
      { type: "inside", xAxisIndex: [0, 1, 2], start: Math.max(0, 100 - (80 / Math.max(rows.length, 1)) * 100), end: 100 },
      { type: "slider", xAxisIndex: [0, 1, 2], bottom: 2, height: 18, borderColor: "transparent", backgroundColor: "#f5f5f7", fillerColor: "rgba(0,113,227,.12)", handleStyle: { color: "#0071e3" }, textStyle: { color: "#86868b" } }
    ],
    series: [
      {
        name: "K线",
        type: "candlestick",
        xAxisIndex: 0,
        yAxisIndex: 0,
        data: rows.map((item) => [item.open ?? item.close, item.close, item.low ?? item.close, item.high ?? item.close]),
        itemStyle: { color: "#d43f3a", color0: "#16845f", borderColor: "#d43f3a", borderColor0: "#16845f" }
      },
      lineSeries("MA5", rows.map((item) => item.ma5), "#0071e3"),
      lineSeries("MA10", rows.map((item) => item.ma10), "#9a6700"),
      lineSeries("MA20", rows.map((item) => item.ma20), "#7a5195"),
      {
        name: "成交量",
        type: "bar",
        xAxisIndex: 1,
        yAxisIndex: 1,
        data: rows.map((item, index) => ({ value: item.volume ?? 0, itemStyle: { color: item.close >= (item.open ?? rows[Math.max(0, index - 1)]?.close ?? item.close) ? "rgba(212,63,58,.55)" : "rgba(22,132,95,.55)" } })),
        barMaxWidth: 8
      },
      ...(indicator === "macd" ? [
        {
          name: "MACD",
          type: "bar" as const,
          xAxisIndex: 2,
          yAxisIndex: 2,
          data: rows.map((item) => ({ value: item.histogram, itemStyle: { color: (item.histogram ?? 0) >= 0 ? "#d43f3a" : "#16845f" } })),
          barMaxWidth: 7
        },
        indicatorLine("DIF", rows.map((item) => item.macd), "#0071e3"),
        indicatorLine("DEA", rows.map((item) => item.signal), "#9a6700")
      ] : [
        indicatorLine("RSI14", rows.map((item) => item.rsi), "#7a5195")
      ])
    ]
  };
  return <ReactEChartsCore echarts={echarts} option={option} style={{ height }} notMerge lazyUpdate />;
}

function lineSeries(name: string, data: Array<number | null>, color: string) {
  return { name, type: "line" as const, xAxisIndex: 0, yAxisIndex: 0, data, smooth: true, showSymbol: false, lineStyle: { color, width: 1.4 }, emphasis: { focus: "series" as const } };
}

function indicatorLine(name: string, data: Array<number | null>, color: string) {
  return { name, type: "line" as const, xAxisIndex: 2, yAxisIndex: 2, data, smooth: true, showSymbol: false, lineStyle: { color, width: 1.4 } };
}
