export { LineChart } from './LineChart';
export type { LineChartProps } from './LineChart';
export { PieChart } from './PieChart';
export type { PieChartProps } from './PieChart';
export {
  CHART_COLORS,
  formatCurrency,
  formatNumber,
  formatLargeNumber,
  formatDayMonth,
  formatMonthYear,
} from './chartConfig';
export type { PieDataPoint, MultiSeriesPoint, SeriesConfig } from './chartConfig';

export function flattenMultiSeries(data: any[]): Record<string, any>[] {
  return data.map((item: any) => {
    const point: Record<string, any> = { date: item.label };
    item.series.forEach((s: any) => {
      point[s.name] = s.value;
    });
    return point;
  });
}
