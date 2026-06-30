export interface ColumnDefinition<T> {
  header: string;
  icon?: string;
  key: string;
  width?: string;
  align?: 'left' | 'center' | 'right';
  className?: string;
  render?: (value: any, item: T, index: number) => any;
}

interface Props<T> {
  columns: ColumnDefinition<T>[];
  data: T[];
  onRowClick?: (item: T) => void;
  getRowKey?: (item: T, index: number) => string;
  emptyMessage?: string;
  className?: string;
  actions?: (item: T, index: number) => any;
}

export function DataTable<T>({
  columns, data, onRowClick, getRowKey, emptyMessage, className, actions
}: Props<T>) {
  if (data.length === 0) {
    return (
      <div className="py-16 px-10 text-center bg-slate-50 dark:bg-slate-800/50 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700">
        <div className="text-sm font-semibold text-slate-400 dark:text-slate-500">
          {emptyMessage || 'No data'}
        </div>
      </div>
    );
  }

  return (
    <div className={`overflow-x-auto ${className || ''}`}>
      <table className="w-full border-separate border-spacing-0">
        <thead>
          <tr className="bg-brand-100 dark:bg-brand-900/30 sticky top-0 z-10">
            {columns.map((col) => (
              <th
                key={col.key}
                scope="col"
                className={`px-4 py-3 text-[10px] font-black uppercase tracking-widest text-brand-700 dark:text-brand-400 border-b-4 border-brand-400 dark:border-brand-600 ${col.className || ''}`}
                style={{ textAlign: col.align || 'left', width: col.width, minWidth: col.width }}
              >
                {col.header}
              </th>
            ))}
            {actions && (
              <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-brand-700 dark:text-brand-400 border-b-4 border-brand-400 dark:border-brand-600 text-center w-[80px]">
                ACTION
              </th>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {data.map((item, idx) => {
            const key = getRowKey ? getRowKey(item, idx) : (item as any).id || idx;
            return (
              <tr
                key={key}
                onClick={() => onRowClick?.(item)}
                className={`group transition-all duration-200 ${onRowClick ? 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 md:hover:shadow-[inset_5px_0_0_0_rgba(var(--brand-600))] md:dark:hover:shadow-[inset_5px_0_0_0_rgba(var(--brand-400))]' : ''}`}
              >
                {columns.map((col) => {
                  const val = (item as any)[col.key];
                  const cellValue = col.render ? col.render(val, item, idx) : val;
                  return (
                    <td
                      key={`${key}-${col.key}`}
                      className="px-4 py-2 align-middle"
                      style={{ textAlign: col.align || 'left', width: col.width, minWidth: col.width }}
                    >
                      {cellValue ?? '-'}
                    </td>
                  );
                })}
                {actions && (
                  <td className="px-4 py-4 text-center" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      {actions(item, idx)}
                    </div>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}