import ReactECharts from "echarts-for-react";
import type { EChartsOption } from "echarts";
import type { HistoryPoint, Sector } from "../types";
import { formatAmount, formatPct } from "../format";

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
  return <ReactECharts option={option} style={{ height }} notMerge lazyUpdate />;
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
  return <ReactECharts option={option} style={{ height }} notMerge lazyUpdate />;
}
