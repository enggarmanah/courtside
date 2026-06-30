import React, { useState, useCallback } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart as RechartsLineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ReferenceLine,
} from 'recharts';
import { SeriesConfig, formatLargeNumber, formatNumber } from './chartConfig';
import { Icon } from '../ui/Icon';
import { LoadingProgress } from '../feedback/LoadingProgress';

export interface LineChartProps {
  data: any[];
  series: SeriesConfig[];
  xAxisKey?: string;
  height?: number;
  isCurrency?: boolean;
  showLegend?: boolean;
  useArea?: boolean;
  areaColor?: string;
  areaGradientId?: string;
  title?: string;
  icon?: string;
  chartId?: string;
  loading?: boolean;
  bordered?: boolean;
}

interface HoverState {
  active: boolean;
  x: number;
  y: number;
  index: number;
  payload: any;
}

const CustomTooltip = ({ active, payload, label, isCurrency, yAxisFormatter }: any) => {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 shadow-xl text-xs min-w-[140px]">
      <div className="font-semibold text-slate-500 dark:text-slate-400 mb-1.5 border-b border-slate-100 dark:border-slate-700 pb-1.5">{label}</div>
      {payload.map((entry: any, idx: number) => (
        <div key={idx} className="flex items-center justify-between gap-4 py-0.5">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: entry.color }} />
            <span className="font-medium text-slate-600 dark:text-slate-300 truncate max-w-[120px]">{entry.name}</span>
          </div>
          <span className="font-bold text-slate-800 dark:text-slate-100 tabular-nums">
            {isCurrency ? `Rp ${formatLargeNumber(entry.value)}` : yAxisFormatter ? yAxisFormatter(entry.value) : entry.value.toLocaleString()}
          </span>
        </div>
      ))}
    </div>
  );
};

const renderLegend = (props: any) => {
  const { payload } = props;
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1.5 justify-center pt-3 max-h-28 overflow-y-auto sidebar-scrollbar">
      {payload.map((entry: any, index: number) => (
        <div
          key={`legend-${index}`}
          className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-500 dark:text-slate-400 cursor-pointer hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
        >
          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0 ring-1 ring-slate-200 dark:ring-slate-600" style={{ backgroundColor: entry.color }} />
          <span className="truncate max-w-[100px]">{entry.value}</span>
        </div>
      ))}
    </div>
  );
};

export const LineChart: React.FC<LineChartProps> = ({
  data,
  series,
  xAxisKey = 'date',
  height = 280,
  isCurrency = false,
  showLegend = false,
  useArea = false,
  areaColor = '#6366f1',
  areaGradientId = 'areaGrad',
  title,
  icon,
  chartId,
  loading = false,
  bordered = true,
}) => {
  const [hoverState, setHoverState] = useState<HoverState | null>(null);

  const handleMouseMove = useCallback((state: any) => {
    if (state && state.activeTooltipIndex != null) {
      setHoverState({
        active: true,
        x: state.chartX,
        y: state.chartY,
        index: state.activeTooltipIndex,
        payload: state,
      });
    }
  }, []);

  const handleMouseLeave = useCallback(() => {
    setHoverState(null);
  }, []);

  const yAxisFormatter = useCallback((value: number) => {
    if (isCurrency) return formatLargeNumber(value);
    return formatNumber(Math.round(value));
  }, [isCurrency]);

  const xAxisFormatter = useCallback((value: string) => {
    if (value.length > 10) {
      const parts = value.split(' ');
      if (parts.length >= 2) return `${parts[0]} ${parts[1]}`;
    }
    return value;
  }, []);

  return (
    <div className={bordered
      ? "bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-6 shadow-sm overflow-hidden"
      : "overflow-hidden"}>
      {title && (
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            {icon && <Icon name={icon as any} size={16} className="text-brand-600 dark:text-brand-400" />}
            <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm">{title}</h3>
          </div>
          {hoverState?.active && hoverState.payload?.activeLabel && (
            <span className="text-[10px] font-semibold text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-900/20 px-2 py-0.5 rounded-md">
              {hoverState.payload.activeLabel}
            </span>
          )}
        </div>
      )}
      <div className={bordered && title ? '-mx-4 -mb-4' : bordered ? '-mx-6 -mb-6' : ''}>
        {loading ? (
          <div className="flex items-center justify-center rounded-xl" style={{ height }}>
            <LoadingProgress size="medium" />
          </div>
        ) : data.length === 0 ? (
          <div className="flex items-center justify-center rounded-xl" style={{ height }}>
            <span className="text-slate-400 text-sm">No data available</span>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={height}>
            {useArea ? (
              <AreaChart
                id={chartId}
                data={data}
                margin={{ top: 15, right: 15, left: 5, bottom: 5 }}
                onMouseMove={handleMouseMove}
                onMouseLeave={handleMouseLeave}
              >
                <defs>
                  <linearGradient id={areaGradientId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={areaColor} stopOpacity="0.35" />
                    <stop offset="50%" stopColor={areaColor} stopOpacity="0.1" />
                    <stop offset="100%" stopColor={areaColor} stopOpacity="0.0" />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="4 4" stroke="currentColor" className="text-slate-100 dark:text-slate-800" vertical={false} />
                <XAxis
                  dataKey={xAxisKey}
                  tick={{ fontSize: 10 }}
                  className="text-slate-400 font-semibold"
                  tickFormatter={xAxisFormatter}
                  axisLine={{ stroke: 'currentColor', className: 'text-slate-200 dark:text-slate-700' }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10 }}
                  className="text-slate-400 font-semibold"
                  tickFormatter={yAxisFormatter}
                  axisLine={false}
                  tickLine={false}
                  width={50}
                />
                <Tooltip
                  content={<CustomTooltip isCurrency={isCurrency} yAxisFormatter={yAxisFormatter} />}
                  cursor={{ stroke: 'currentColor', strokeDasharray: '4 4', className: 'text-slate-300 dark:text-slate-600' }}
                />
                <Area
                  type="monotone"
                  dataKey={series[0]?.dataKey}
                  stroke={areaColor}
                  fill={`url(#${areaGradientId})`}
                  strokeWidth={1}
                  dot={false}
                  activeDot={{ r: 3, fill: areaColor, stroke: '#fff', strokeWidth: 1 }}
                  name={series[0]?.name}
                  animationDuration={800}
                  animationEasing="ease-out"
                />
                {hoverState?.active && (
                  <ReferenceLine x={data[hoverState.index]?.[xAxisKey]} stroke="currentColor" className="text-slate-200 dark:text-slate-700" strokeDasharray="4 4" />
                )}
              </AreaChart>
            ) : (
              <RechartsLineChart
                id={chartId}
                data={data}
                margin={{ top: 15, right: 15, left: 5, bottom: 5 }}
                onMouseMove={handleMouseMove}
                onMouseLeave={handleMouseLeave}
              >
                <CartesianGrid strokeDasharray="4 4" stroke="currentColor" className="text-slate-100 dark:text-slate-800" vertical={false} />
                <XAxis
                  dataKey={xAxisKey}
                  tick={{ fontSize: 10 }}
                  className="text-slate-400 font-semibold"
                  tickFormatter={xAxisFormatter}
                  axisLine={{ stroke: 'currentColor', className: 'text-slate-200 dark:text-slate-700' }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10 }}
                  className="text-slate-400 font-semibold"
                  tickFormatter={yAxisFormatter}
                  axisLine={false}
                  tickLine={false}
                  width={50}
                />
                <Tooltip
                  content={<CustomTooltip isCurrency={isCurrency} yAxisFormatter={yAxisFormatter} />}
                  cursor={{ stroke: 'currentColor', strokeDasharray: '4 4', className: 'text-slate-300 dark:text-slate-600' }}
                />
                {series.map((s: SeriesConfig) => (
                  <Line
                    key={s.dataKey}
                    type="monotone"
                    dataKey={s.dataKey}
                    stroke={s.color}
                    strokeWidth={1}
                    dot={false}
                    activeDot={{ r: 3, fill: s.color, stroke: '#fff', strokeWidth: 1 }}
                    name={s.name}
                    animationDuration={800}
                    animationEasing="ease-out"
                  />
                ))}
                {showLegend && <Legend content={renderLegend} />}
                {hoverState?.active && (
                  <ReferenceLine x={data[hoverState.index]?.[xAxisKey]} stroke="currentColor" className="text-slate-200 dark:text-slate-700" strokeDasharray="4 4" />
                )}
              </RechartsLineChart>
            )}
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
};
