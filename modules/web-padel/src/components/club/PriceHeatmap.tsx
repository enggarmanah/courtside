import React, { useState } from 'react';
import { formatCurrency } from '../../utils/formatHelper';
import { LoadingProgress } from '../common/feedback/LoadingProgress';

interface PriceSlot {
  time: string;
  price: number;
}

interface PriceDayRow {
  day: string;
  slots: PriceSlot[];
}

interface PriceHeatmapProps {
  timeSlots: string[];
  rows: PriceDayRow[];
  loading?: boolean;
}

const formatPriceK = (value: number): string => {
  if (!value || value <= 0) return '-';
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)} M`;
  if (value >= 1000) return `${Math.round(value / 1000)} K`;
  return String(value);
};

const getPriceStyle = (price: number, minPrice: number, maxPrice: number): React.CSSProperties => {
  if (!price || price <= 0) {
    return { backgroundColor: 'rgb(248 250 252)', color: '#94a3b8' }; // slate-50 / slate-400
  }
  if (maxPrice <= minPrice || maxPrice <= 0) {
    return { backgroundColor: 'rgb(255 251 235)', color: '#b45309' }; // amber-50 / amber-700
  }
  const ratio = (price - minPrice) / (maxPrice - minPrice);
  const lightness = 95 - ratio * 55; // 95% (very light) down to 40% (dark)
  const bg = `hsl(24 90% ${lightness}%)`;
  const textColor = lightness > 60 ? '#7c2d12' : '#ffffff'; // orange-950 for light, white for dark
  return { backgroundColor: bg, color: textColor };
};
export const PriceHeatmap: React.FC<PriceHeatmapProps> = ({ timeSlots, rows, loading }) => {
  const [hoveredCell, setHoveredCell] = useState<{
    x: number;
    y: number;
    day: string;
    time: string;
    price: number;
  } | null>(null);

  const allPrices = rows.flatMap((row) => row.slots.map((s) => s.price)).filter((p) => p > 0);
  const minPrice = allPrices.length > 0 ? Math.min(...allPrices) : 0;
  const maxPrice = allPrices.length > 0 ? Math.max(...allPrices) : 0;

  if (loading) {
    return (
      <div className="space-y-2">
        <div className="flex gap-1">
          <div className="h-6 w-[60px] bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
          {timeSlots.slice(0, 6).map((slot) => (
            <div key={slot} className="h-6 flex-1 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
          ))}
        </div>
        {Array.from({ length: 4 }).map((_, rowIdx) => (
          <div key={rowIdx} className="flex gap-1">
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
              <th className="p-2.5 font-bold text-slate-500 dark:text-slate-400 sticky left-0 bg-slate-50 dark:bg-slate-800 z-10" style={{ width: '60px' }}>
                Day
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
              <tr key={row.day} className="border-b border-slate-100 dark:border-slate-800/30">
                <td className="p-2.5 font-semibold text-slate-700 dark:text-slate-300 sticky left-0 bg-white dark:bg-slate-900 z-10" style={{ width: '60px' }}>
                  {row.day}
                </td>
                {timeSlots.map((slot) => {
                  const cell = row.slots.find((s) => s.time === slot) || { time: slot, price: 0 };
                  const cellStyle = getPriceStyle(cell.price, minPrice, maxPrice);
                  return (
                    <td
                      key={slot}
                      className="p-2.5 text-center transition-all duration-150 cursor-pointer relative hover:ring-2 hover:ring-brand-500 hover:z-20"
                      style={cellStyle}
                      onMouseEnter={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        const tableRect = e.currentTarget.offsetParent?.getBoundingClientRect();
                        setHoveredCell({
                          x: rect.left - (tableRect?.left || 0) + rect.width / 2,
                          y: rect.top - (tableRect?.top || 0),
                          day: row.day,
                          time: slot,
                          price: cell.price,
                        });
                      }}
                      onMouseLeave={() => setHoveredCell(null)}
                    >
                      {formatPriceK(cell.price)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {hoveredCell && (
        <div
          className="absolute z-30 pointer-events-none bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 shadow-md text-xs -translate-x-1/2 -translate-y-[110%]"
          style={{
            left: `${hoveredCell.x}px`,
            top: `${hoveredCell.y}px`,
          }}
        >
          <div className="font-semibold text-slate-500 dark:text-slate-400">{hoveredCell.day} @ {hoveredCell.time}</div>
          <div className="font-bold text-slate-800 dark:text-slate-100 mt-0.5">
            Price: {hoveredCell.price > 0 ? formatCurrency(hoveredCell.price) : '-'}
          </div>
        </div>
      )}
    </div>
  );
};
