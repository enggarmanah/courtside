import React, { useState, useRef, useEffect } from 'react';
import { formatNumber, formatLargeNumber } from '../../utils/formatHelper';
import { LoadingProgress } from '../common/feedback/LoadingProgress';

interface ChartDataPoint {
  label: string; // e.g. "Jun 27" or "Jun 2026"
  value: number;
}

interface CustomSVGLineChartProps {
  data: ChartDataPoint[];
  color: string; // e.g. "#059669"
  gradientId: string;
  height?: number;
  isCurrency?: boolean;
}

export const CustomSVGLineChart: React.FC<CustomSVGLineChartProps> = ({
  data,
  color,
  gradientId,
  height = 220,
  isCurrency = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(500);
  const [hoveredPoint, setHoveredPoint] = useState<{ x: number; y: number; data: ChartDataPoint } | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const resizeObserver = new ResizeObserver((entries) => {
      for (let entry of entries) {
        setWidth(entry.contentRect.width || 500);
      }
    });
    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center rounded-xl" style={{ height }}>
        <span className="text-slate-400 text-sm">No data available</span>
      </div>
    );
  }

  // Padding
  const paddingLeft = 60;
  const paddingRight = 15;
  const paddingTop = 15;
  const paddingBottom = 25;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  const values = data.map((d) => d.value);
  const maxValue = Math.max(...values, 10) * 1.1; // 10% headroom
  const minValue = 0;

  const points = data.map((d, index) => {
    const x = paddingLeft + (index / (data.length - 1 || 1)) * chartWidth;
    const y = paddingTop + chartHeight - ((d.value - minValue) / (maxValue - minValue)) * chartHeight;
    return { x, y, data: d };
  });

  // Build SVG Path
  let linePath = '';
  let areaPath = '';

  if (points.length > 0) {
    linePath = `M ${points[0].x} ${points[0].y}`;
    points.forEach((p, i) => {
      if (i > 0) {
        linePath += ` L ${p.x} ${p.y}`;
      }
    });

    areaPath = `${linePath} L ${points[points.length - 1].x} ${paddingTop + chartHeight} L ${points[0].x} ${paddingTop + chartHeight} Z`;
  }

  // Y-Axis Ticks (4 divisions)
  const yTicks = Array.from({ length: 5 }, (_, i) => {
    const val = minValue + (i / 4) * (maxValue - minValue);
    const y = paddingTop + chartHeight - (i / 4) * chartHeight;
    return { val, y };
  });

  // X-Axis Ticks (limit rendering to avoid overlaps)
  const xTickInterval = Math.max(1, Math.floor(data.length / 8));
  const xTicks = points.filter((_, i) => i % xTickInterval === 0);

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!containerRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;

    // Find closest point on X axis
    let closest = points[0];
    let minDist = Math.abs(points[0].x - mouseX);
    points.forEach((p) => {
      const dist = Math.abs(p.x - mouseX);
      if (dist < minDist) {
        minDist = dist;
        closest = p;
      }
    });

    setHoveredPoint(closest);
  };

  const handleMouseLeave = () => {
    setHoveredPoint(null);
  };

  return (
    <div ref={containerRef} className="relative w-full" style={{ height }}>
      <svg
        width={width}
        height={height}
        className="absolute top-0 left-0 overflow-visible select-none"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.3" />
            <stop offset="100%" stopColor={color} stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {/* Gridlines */}
        {yTicks.map((tick, i) => (
          <line
            key={i}
            x1={paddingLeft}
            y1={tick.y}
            x2={width - paddingRight}
            y2={tick.y}
            stroke="currentColor"
            className="text-slate-100 dark:text-slate-800"
            strokeWidth={1}
            strokeDasharray="4 4"
          />
        ))}

        {/* Y Axis Labels on the left of Y-axis */}
        {yTicks.map((tick, i) => (
          <text
            key={i}
            x={paddingLeft - 10}
            y={tick.y + 4}
            textAnchor="end"
            fontSize="10"
            className="fill-slate-400 dark:fill-slate-500 font-semibold"
          >
            {isCurrency ? 'Rp ' + formatLargeNumber(tick.val).toLowerCase() : formatNumber(Math.round(tick.val), 0)}
          </text>
        ))}

        {/* Area & Line */}
        {points.length > 0 && (
          <>
            <path d={areaPath} fill={`url(#${gradientId})`} />
            <path d={linePath} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" />
          </>
        )}

        {/* X Axis Labels */}
        {xTicks.map((tick, i) => {
          return (
            <text
              key={i}
              x={tick.x}
              y={height - 8}
              textAnchor="middle"
              fontSize="10"
              className="fill-slate-400 dark:fill-slate-500 font-semibold"
            >
              {tick.data.label}
            </text>
          );
        })}

        {/* Interactive hover line and dots */}
        {hoveredPoint && (
          <>
            <line
              x1={hoveredPoint.x}
              y1={paddingTop}
              x2={hoveredPoint.x}
              y2={paddingTop + chartHeight}
              stroke="currentColor"
              className="text-slate-200 dark:text-slate-700"
              strokeWidth={1.5}
            />
            <circle cx={hoveredPoint.x} cy={hoveredPoint.y} r={6} fill={color} stroke="#fff" strokeWidth={2} />
          </>
        )}
      </svg>

      {/* Tooltip Overlay */}
      {hoveredPoint && (
        <div
          className="absolute z-30 pointer-events-none bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 shadow-lg text-xs"
          style={{
            left: `${Math.min(width - 150, Math.max(10, hoveredPoint.x - 70))}px`,
            top: `${Math.max(5, hoveredPoint.y - 65)}px`,
          }}
        >
          <div className="font-semibold text-slate-500 dark:text-slate-400 mb-0.5">{hoveredPoint.data.label}</div>
          <div className="font-bold text-slate-800 dark:text-slate-100">
            {isCurrency ? 'Rp ' + formatLargeNumber(hoveredPoint.data.value).toLowerCase() : `${formatNumber(Math.round(hoveredPoint.data.value), 0)} Bookings`}
          </div>
        </div>
      )}
    </div>
  );
};

interface OccupancySlot {
  time: string;
  occupancyRate: number;
}

interface OccupancyRow {
  period: string;
  day?: string;
  slots: OccupancySlot[];
}

interface OccupancyHeatmapProps {
  timeSlots: string[];
  rows: OccupancyRow[];
  yAxisLabel?: string;
  loading?: boolean;
  totalCourts?: number;
}

export const OccupancyHeatmap: React.FC<OccupancyHeatmapProps> = ({ timeSlots, rows, yAxisLabel, loading, totalCourts }) => {
  const [hoveredCell, setHoveredCell] = useState<{
    x: number;
    y: number;
    period: string;
    time: string;
    rate: number;
  } | null>(null);

  const getHeatmapColorClass = (rate: number) => {
    if (rate === 0) return 'bg-slate-50 dark:bg-slate-800/30 text-slate-400';
    if (rate < 25) return 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400';
    if (rate < 50) return 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300';
    if (rate < 75) return 'bg-emerald-500/80 text-white';
    return 'bg-emerald-600 text-white font-bold';
  };

  const hasDayColumn = rows.some((row) => row.day);

  if (loading) {
    return (
      <div className="space-y-2">
        <div className="flex gap-1">
          <div className="h-6 w-[100px] bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
          <div className="h-6 w-[60px] bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
          {timeSlots.slice(0, 6).map((slot) => (
            <div key={slot} className="h-6 flex-1 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
          ))}
        </div>
        {Array.from({ length: 4 }).map((_, rowIdx) => (
          <div key={rowIdx} className="flex gap-1">
            <div className="h-6 w-[100px] bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
            <div className="h-6 w-[60px] bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
            {timeSlots.slice(0, 6).map((slot) => (
              <div key={slot} className="h-6 flex-1 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
            ))}
          </div>
        ))}
        <div className="flex justify-center pt-2">
          <LoadingProgress size="small" />
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full">
      <div className="overflow-x-auto sidebar-scrollbar border border-slate-100 dark:border-slate-800 rounded-xl">
        <table className="w-full border-collapse text-left text-xs min-w-[700px]">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
              {hasDayColumn && (
                <th className="p-2.5 font-bold text-slate-500 dark:text-slate-400 sticky left-0 bg-slate-50 dark:bg-slate-800 z-10 text-left" style={{ width: '100px' }}>
                  Day
                </th>
              )}
              <th className="p-2.5 font-bold text-slate-500 dark:text-slate-400 sticky left-0 bg-slate-50 dark:bg-slate-800 z-10" style={{ width: '60px' }}>
                {yAxisLabel || 'Period'}
              </th>
              {timeSlots.map((slot) => (
                <th key={slot} className="p-2.5 font-bold text-slate-500 dark:text-slate-400 text-center">
                  {slot}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.period} className="border-b border-slate-100 dark:border-slate-800/30">
                {hasDayColumn && (
                  <td className="p-2.5 font-bold text-slate-600 dark:text-slate-400 sticky left-0 bg-white dark:bg-slate-900 z-10 text-left" style={{ width: '100px' }}>
                    {row.day || ''}
                  </td>
                )}
                <td className="p-2.5 font-semibold text-slate-700 dark:text-slate-300 sticky left-0 bg-white dark:bg-slate-900 z-10" style={{ width: '60px' }}>
                  {row.period}
                </td>
                {timeSlots.map((slot) => {
                  const cell = row.slots.find((s) => s.time === slot) || { time: slot, occupancyRate: 0 };
                  const colorClass = getHeatmapColorClass(cell.occupancyRate);
                  return (
                    <td
                      key={slot}
                      className={`p-2.5 text-center transition-all duration-150 cursor-pointer relative ${colorClass} hover:ring-2 hover:ring-brand-500 hover:z-20`}
                      onMouseEnter={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        const tableRect = e.currentTarget.offsetParent?.getBoundingClientRect();
                        setHoveredCell({
                          x: rect.left - (tableRect?.left || 0) + rect.width / 2,
                          y: rect.top - (tableRect?.top || 0),
                          period: row.period,
                          time: slot,
                          rate: cell.occupancyRate,
                        });
                      }}
                      onMouseLeave={() => setHoveredCell(null)}
                    >
                      {cell.occupancyRate > 0 ? `${Math.round(cell.occupancyRate)}%` : '-'}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Grid Cell Tooltip */}
      {hoveredCell && (
        <div
          className="absolute z-30 pointer-events-none bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 shadow-md text-xs -translate-x-1/2 -translate-y-[110%]"
          style={{
            left: `${hoveredCell.x}px`,
            top: `${hoveredCell.y}px`,
          }}
        >
          <div className="font-semibold text-slate-500 dark:text-slate-400">{hoveredCell.period} @ {hoveredCell.time}</div>
          <div className="font-bold text-slate-800 dark:text-slate-100 mt-0.5">
            Occupancy: {hoveredCell.rate.toFixed(1)}%
          </div>
          {totalCourts != null && totalCourts > 0 && (
            <div className="text-slate-600 dark:text-slate-300 mt-0.5">
              Courts Booked: {Math.round((hoveredCell.rate / 100) * totalCourts)} / {totalCourts}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
