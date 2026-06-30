export const CHART_COLORS = [
  '#6366f1', '#f59e0b', '#10b981', '#ef4444', '#3b82f6',
  '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#84cc16',
  '#06b6d4', '#d946ef', '#22d3ee', '#fb923c', '#a3e635',
  '#2dd4bf', '#f472b6', '#818cf8', '#34d399', '#e879f9',
  '#38bdf8', '#4ade80', '#fbbf24', '#c084fc', '#f87171',
];

export interface PieDataPoint {
  name: string;
  value: number;
  id?: string | number;
}

export interface MultiSeriesPoint {
  date: string;
  [key: string]: string | number;
}

export interface SeriesConfig {
  dataKey: string;
  color: string;
  name: string;
}

export const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(value);
};

export const formatNumber = (value: number) => {
  return new Intl.NumberFormat('id-ID').format(value);
};

export const formatLargeNumber = (value: number) => {
  if (value >= 1000000) return (value / 1000000).toFixed(1) + ' M';
  if (value >= 1000) return (value / 1000).toFixed(1) + ' K';
  return value.toString();
};

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const formatDayMonth = (dateStr: string) => {
  const d = new Date(dateStr + 'T00:00:00');
  if (isNaN(d.getTime())) return '';
  return `${d.getDate()} ${MONTH_SHORT[d.getMonth()]}`;
};

export const formatMonthYear = (dateStr: string) => {
  const d = new Date(dateStr + '-01T00:00:00');
  if (isNaN(d.getTime())) return '';
  return `${MONTH_SHORT[d.getMonth()]} ${d.getFullYear()}`;
};
