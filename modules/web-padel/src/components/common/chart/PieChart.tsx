import React, { useState, useCallback } from 'react';
import {
  ResponsiveContainer,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  Tooltip,
  Sector,
  Legend,
} from 'recharts';
import { CHART_COLORS, PieDataPoint, formatNumber } from './chartConfig';
import { Icon } from '../ui/Icon';
import { LoadingProgress } from '../feedback/LoadingProgress';



export interface PieChartProps {
  data: PieDataPoint[];
  height?: number;
  donut?: boolean;
  showLegend?: boolean;
  title?: string;
  icon?: string;
  valueFormatter?: (value: number) => string;
  emptyLabel?: string;
  chartId?: string;
  loading?: boolean;
  bordered?: boolean;
}

interface ActiveShapeProps {
  cx: number;
  cy: number;
  midAngle: number;
  innerRadius: number;
  outerRadius: number;
  startAngle: number;
  endAngle: number;
  fill: string;
  payload: any;
  percent: number;
  value: number;
}

const renderActiveShape = (props: ActiveShapeProps) => {
  const RADIAN = Math.PI / 180;
  const {
    cx, cy, midAngle, innerRadius, outerRadius,
    startAngle, endAngle, fill, payload, percent, value,
  } = props;
  const sin = Math.sin(-RADIAN * midAngle);
  const cos = Math.cos(-RADIAN * midAngle);
  const sx = cx + (outerRadius + 4) * cos;
  const sy = cy + (outerRadius + 4) * sin;
  const mx = cx + (outerRadius + 12) * cos;
  const my = cy + (outerRadius + 12) * sin;
  const ex = mx + (cos >= 0 ? 1 : -1) * 12;
  const ey = my;
  const textAnchor = cos >= 0 ? 'start' : 'end';

  return (
    <g>
      <text x={cx} y={cy - 8} dy={0} textAnchor="middle" className="fill-slate-800 dark:fill-slate-100 text-sm font-bold">
        {payload.name}
      </text>
      <text x={cx} y={cy + 12} dy={0} textAnchor="middle" className="fill-slate-400 dark:fill-slate-500 text-[10px] font-semibold">
        {value.toLocaleString()} ({`${(percent * 100).toFixed(1)}%`})
      </text>
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius}
        outerRadius={outerRadius + 6}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
      />
      <Sector
        cx={cx}
        cy={cy}
        startAngle={startAngle}
        endAngle={endAngle}
        innerRadius={outerRadius + 10}
        outerRadius={outerRadius + 14}
        fill={fill}
      />
      <path d={`M${sx},${sy}L${mx},${my}L${ex},${ey}`} stroke={fill} fill="none" />
      <circle cx={ex} cy={ey} r={2} fill={fill} stroke="none" />
      <text x={ex + (cos >= 0 ? 1 : -1) * 6} y={ey} textAnchor={textAnchor} className="fill-slate-600 dark:fill-slate-300 text-[10px] font-semibold">
        {payload.name}
      </text>
    </g>
  );
};

const CustomPieTooltip = ({ active, payload }: any) => {
  if (!active || !payload || payload.length === 0) return null;
  const entry = payload[0];
  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 shadow-xl text-xs min-w-[130px]">
      <div className="flex items-center gap-2 mb-1.5">
        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: entry.payload.fill || entry.color }} />
        <span className="font-semibold text-slate-700 dark:text-slate-300">{entry.name}</span>
      </div>
      <div className="font-bold text-slate-800 dark:text-slate-100">
        {entry.payload.formattedValue || entry.value.toLocaleString()}
      </div>
      <div className="text-slate-400 dark:text-slate-500 mt-0.5">
        {entry.payload.percent}% of total
      </div>
    </div>
  );
};

const renderPieLegend = (props: any) => {
  const { payload } = props;
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1.5 justify-center pt-3 max-h-28 overflow-y-auto sidebar-scrollbar">
      {payload.map((entry: any, index: number) => (
        <div
          key={`pie-legend-${index}`}
          className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-500 dark:text-slate-400 cursor-pointer hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
        >
          <span
            className="w-2.5 h-2.5 rounded-full flex-shrink-0 ring-1 ring-slate-200 dark:ring-slate-600"
            style={{ backgroundColor: entry.color }}
          />
          <span className="truncate max-w-[90px]">{entry.value}</span>
        </div>
      ))}
    </div>
  );
};

export const PieChart: React.FC<PieChartProps> = ({
  data,
  height = 280,
  donut = true,
  showLegend = true,
  title,
  icon,
  valueFormatter,
  emptyLabel = 'No data',
  chartId,
  loading = false,
  bordered = true,
}) => {
  const [activeIndex, setActiveIndex] = useState<number | undefined>(undefined);

  const total = data.reduce((sum, d) => sum + d.value, 0);

  const enrichedData = data.map((d, i) => ({
    ...d,
    id: d.id ?? i,
    formattedValue: valueFormatter ? valueFormatter(d.value) : formatNumber(d.value),
    percent: total > 0 ? ((d.value / total) * 100).toFixed(1) : '0',
    fill: CHART_COLORS[i % CHART_COLORS.length],
  }));

  const onPieEnter = useCallback((_: any, index: number) => {
    setActiveIndex(index);
  }, []);

  const onPieLeave = useCallback(() => {
    setActiveIndex(undefined);
  }, []);

  return (
    <div className={bordered
      ? "bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4"
      : ""}>
      {title && (
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            {icon && <Icon name={icon as any} size={16} className="text-brand-600 dark:text-brand-400" />}
            <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm">{title}</h3>
          </div>
          <span className="text-[12px] font-semibold text-brand-600 bg-brand-100 dark:bg-slate-700/50 px-3 py-1 rounded-3xl">
            {formatNumber(total)} total
          </span>
        </div>
      )}
      {loading ? (
        <div className="flex items-center justify-center rounded-xl" style={{ height }}>
          <LoadingProgress size="medium" />
        </div>
      ) : data.length === 0 ? (
        <div className="flex items-center justify-center rounded-xl" style={{ height: 120 }}>
          <span className="text-slate-400 text-sm">{emptyLabel}</span>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={height}>
          <RechartsPieChart id={chartId}>
            <Pie
              activeShape={renderActiveShape as any}
              nameKey={(entry: any) => entry.name || entry.id}
              data={enrichedData}
              cx="50%"
              cy="50%"
              innerRadius={donut ? 55 : 0}
              outerRadius={85}
              dataKey="value"
              onMouseEnter={onPieEnter}
              onMouseLeave={onPieLeave}
              animationDuration={600}
              animationEasing="ease-out"
            >
              {enrichedData.map((entry, index) => (
                <Cell
                  key={`cell-${entry.id}`}
                  fill={CHART_COLORS[index % CHART_COLORS.length]}
                  stroke="none"
                  style={{
                    filter: activeIndex === index ? 'none' : 'opacity(0.85)',
                    transition: 'filter 0.2s ease',
                  }}
                />
              ))}
            </Pie>
            <Tooltip content={<CustomPieTooltip />} />
            {showLegend && (
              <Legend
                content={renderPieLegend}
                layout="horizontal"
                verticalAlign="bottom"
                align="center"
              />
            )}
          </RechartsPieChart>
        </ResponsiveContainer>
      )}
    </div>
  );
};
