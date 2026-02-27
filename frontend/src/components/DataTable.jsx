import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
    ChevronDown, ChevronUp, ChevronRight, Filter, X, Check,
    ChevronsLeft, ChevronsRight, ChevronLeft, ChevronRight as ChevronRightIcon,
    Search, SlidersHorizontal
} from 'lucide-react';

/**
 * Enterprise DataTable Component
 *
 * Props:
 *  columns     – Array of { key, label, sortable, filterable, filterType, renderCell, width }
 *  data        – Array of row objects
 *  totalItems  – Total server-side count for pagination
 *  page        – Current page (1-indexed)
 *  pageSize    – Items per page
 *  onPageChange(page)
 *  onPageSizeChange(size)
 *  sortBy      – Current sort column key
 *  sortDir     – 'asc' | 'desc'
 *  onSort(key, dir)
 *  filters     – { [columnKey]: value }
 *  onFilterChange(key, value)
 *  selectable  – Boolean
 *  selectedIds – Set of selected row ids
 *  onSelectionChange(newSet)
 *  idKey       – Row identity key (default 'id')
 *  expandable  – Boolean
 *  renderExpandedRow(row)
 *  loading     – Boolean
 *  emptyIcon   – React node
 *  emptyMessage – String
 *  bulkActions – React node (floating bar content)
 *  onSearch(term) – Optional search callback
 *  searchValue – Current search term
 *  statusMap   – { value: { label, color } } for badge rendering
 */

/* ── Status Badge ─────────────────────────────────────────── */
const STATUS_COLORS = {
    assigned: { bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-600' },
    in_progress: { bg: 'bg-blue-50', text: 'text-blue-600', dot: 'bg-blue-400' },
    evaluated: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
    reallocated: { bg: 'bg-slate-100', text: 'text-slate-600', dot: 'bg-slate-400' },
    reopened: { bg: 'bg-rose-50', text: 'text-rose-700', dot: 'bg-rose-500' },
    unassigned: { bg: 'bg-slate-50', text: 'text-slate-500', dot: 'bg-slate-300' },
    pending: { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500' },
    passed: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
    failed: { bg: 'bg-rose-50', text: 'text-rose-700', dot: 'bg-rose-500' },
};

export function StatusBadge({ value, customMap }) {
    const map = customMap || STATUS_COLORS;
    const style = map[value] || map.unassigned;
    const label = value ? value.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : 'N/A';
    return (
        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${style.bg} ${style.text}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
            {label}
        </span>
    );
}

/* ── Filter Popover ───────────────────────────────────────── */
function FilterPopover({ column, value, onChange, onClose, allValues }) {
    const [tab, setTab] = useState('values');
    const [textFilter, setTextFilter] = useState(value?.text || '');
    const [textMode, setTextMode] = useState(value?.textMode || 'contains');
    const [checkedValues, setCheckedValues] = useState(new Set(value?.checked || []));
    const ref = useRef(null);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (ref.current && !ref.current.contains(e.target)) onClose();
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [onClose]);

    const toggleValue = (v) => {
        const next = new Set(checkedValues);
        next.has(v) ? next.delete(v) : next.add(v);
        setCheckedValues(next);
    };

    const apply = (e) => {
        e.stopPropagation();
        if (tab === 'values') {
            onChange(column.key, checkedValues.size > 0 ? { checked: [...checkedValues] } : null);
        } else {
            onChange(column.key, textFilter ? { text: textFilter, textMode } : null);
        }
        onClose();
    };

    const clear = (e) => {
        e.stopPropagation();
        onChange(column.key, null);
        onClose();
    };

    const uniqueValues = column.filterOptions || [...new Set(allValues || [])].filter(Boolean).sort();

    return (
        <div ref={ref} className="absolute top-full left-0 mt-1 w-56 bg-white border border-slate-200 rounded-lg shadow-lg z-50 overflow-hidden animate-fade-in-up" onClick={e => e.stopPropagation()}>
            {/* Tabs */}
            <div className="flex border-b border-slate-100">
                {['values', 'text'].map(t => (
                    <button
                        key={t}
                        onClick={(e) => { e.stopPropagation(); setTab(t); }}
                        className={`flex-1 px-3 py-2 text-[10px] font-bold uppercase tracking-wider transition-colors
              ${tab === t ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                        {t === 'values' ? 'Values' : 'Text'}
                    </button>
                ))}
            </div>

            <div className="p-2 max-h-48 overflow-y-auto">
                {tab === 'values' ? (
                    uniqueValues.length > 0 ? (
                        <div className="space-y-0.5">
                            {uniqueValues.map(v => {
                                const val = typeof v === 'object' ? v.value : v;
                                const label = typeof v === 'object' ? v.label : String(v);
                                return (
                                    <label key={val} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-slate-50 cursor-pointer text-xs">
                                        <input
                                            type="checkbox"
                                            checked={checkedValues.has(val)}
                                            onChange={() => toggleValue(val)}
                                            className="w-3.5 h-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                        />
                                        <span className="text-slate-700 font-medium truncate">{label}</span>
                                    </label>
                                );
                            })}
                        </div>
                    ) : <p className="text-xs text-slate-400 text-center py-4">No values available</p>
                ) : (
                    <div className="space-y-2 p-1">
                        <select
                            value={textMode}
                            onChange={e => setTextMode(e.target.value)}
                            onClick={e => e.stopPropagation()}
                            className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded text-xs font-medium text-slate-700 outline-none"
                        >
                            <option value="contains">Contains</option>
                            <option value="equals">Equals</option>
                            <option value="starts">Starts with</option>
                        </select>
                        <input
                            type="text"
                            value={textFilter}
                            onChange={e => setTextFilter(e.target.value)}
                            onClick={e => e.stopPropagation()}
                            placeholder="Filter value..."
                            className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded text-xs text-slate-700 outline-none focus:border-blue-500"
                            autoFocus
                        />
                    </div>
                )}
            </div>

            <div className="flex gap-2 p-2 border-t border-slate-100 bg-slate-50/50">
                <button onClick={clear} className="flex-1 px-2 py-1.5 text-[10px] font-bold text-slate-500 bg-white border border-slate-200 rounded hover:bg-slate-100 transition-colors">
                    Clear
                </button>
                <button onClick={apply} className="flex-1 px-2 py-1.5 text-[10px] font-bold text-white bg-blue-600 rounded hover:bg-blue-700 transition-colors shadow-sm">
                    Apply
                </button>
            </div>
        </div>
    );
}

/* ── Skeleton Row ─────────────────────────────────────────── */
function SkeletonRow({ cols }) {
    return (
        <tr className="animate-pulse">
            {Array.from({ length: cols }).map((_, i) => (
                <td key={i} className="px-4 py-3.5">
                    <div className="h-4 bg-slate-100 rounded-md w-3/4" />
                </td>
            ))}
        </tr>
    );
}

/* ── Main DataTable ───────────────────────────────────────── */
export default function DataTable({
    columns = [],
    data = [],
    totalItems = 0,
    page = 1,
    pageSize = 25,
    onPageChange,
    onPageSizeChange,
    sortBy,
    sortDir = 'desc',
    onSort,
    filters = {},
    onFilterChange,
    selectable = false,
    selectedIds = new Set(),
    onSelectionChange,
    idKey = 'id',
    expandable = false,
    renderExpandedRow,
    loading = false,
    emptyIcon,
    emptyMessage = 'No data found',
    bulkActions,
    onSearch,
    searchValue = '',
    filterData = null // NEW: Full dataset for populating filter values
}) {
    const [openFilter, setOpenFilter] = useState(null);
    const [expandedRows, setExpandedRows] = useState(new Set());

    const totalPages = Math.ceil(totalItems / pageSize);
    const startItem = Math.min((page - 1) * pageSize + 1, totalItems);
    const endItem = Math.min(page * pageSize, totalItems);

    const allSelected = data.length > 0 && data.every(r => selectedIds.has(r[idKey]));
    const someSelected = data.some(r => selectedIds.has(r[idKey])) && !allSelected;

    const toggleSelectAll = () => {
        const next = new Set(selectedIds);
        if (allSelected) {
            data.forEach(r => next.delete(r[idKey]));
        } else {
            data.forEach(r => next.add(r[idKey]));
        }
        onSelectionChange?.(next);
    };

    const toggleSelect = (id) => {
        const next = new Set(selectedIds);
        next.has(id) ? next.delete(id) : next.add(id);
        onSelectionChange?.(next);
    };

    const toggleExpand = (id) => {
        const next = new Set(expandedRows);
        next.has(id) ? next.delete(id) : next.add(id);
        setExpandedRows(next);
    };

    const handleSort = (key) => {
        if (!onSort) return;
        const newDir = sortBy === key && sortDir === 'asc' ? 'desc' : 'asc';
        onSort(key, newDir);
    };

    // Extract unique values for filter popovers
    const getColumnValues = useCallback((key) => {
        const source = filterData || data; // Prefer filterData if provided
        return source.map(r => r[key]);
    }, [data, filterData]);

    const colCount = columns.length + (selectable ? 1 : 0) + (expandable ? 1 : 0);

    return (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            {/* ── Search Bar ─────────────────────────────────── */}
            {onSearch && (
                <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-4">
                    <div className="relative flex-1 max-w-md">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            value={searchValue}
                            onChange={e => onSearch(e.target.value)}
                            placeholder="Search submissions..."
                            className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-300 outline-none transition-all"
                        />
                    </div>
                    {Object.keys(filters).filter(k => filters[k]).length > 0 && (
                        <div className="flex items-center gap-2">
                            <SlidersHorizontal size={14} className="text-slate-400" />
                            <span className="text-xs font-bold text-slate-500">
                                {Object.keys(filters).filter(k => filters[k]).length} filter{Object.keys(filters).filter(k => filters[k]).length > 1 ? 's' : ''} active
                            </span>
                        </div>
                    )}
                </div>
            )}

            {/* ── Floating Bulk Action Bar ──────────────────── */}
            {selectable && selectedIds.size > 0 && bulkActions && (
                <div className="px-5 py-3 bg-blue-50 border-b border-blue-100 flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <div className="w-6 h-6 bg-blue-600 rounded-md flex items-center justify-center">
                            <Check size={14} className="text-white" />
                        </div>
                        <span className="text-sm font-bold text-blue-900">
                            {selectedIds.size} selected
                        </span>
                    </div>
                    <div className="h-5 w-px bg-blue-200" />
                    {bulkActions}
                    <button
                        onClick={() => onSelectionChange?.(new Set())}
                        className="ml-auto text-xs font-bold text-blue-600 hover:text-blue-800 transition-colors"
                    >
                        Deselect All
                    </button>
                </div>
            )}

            {/* ── Desktop Table ──────────────────────────────── */}
            <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left">
                    <thead className="bg-slate-50/80 border-b border-slate-100">
                        <tr>
                            {selectable && (
                                <th className="px-4 py-3.5 w-12">
                                    <input
                                        type="checkbox"
                                        checked={allSelected}
                                        ref={el => { if (el) el.indeterminate = someSelected; }}
                                        onChange={toggleSelectAll}
                                        className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                    />
                                </th>
                            )}
                            {expandable && <th className="px-2 py-3.5 w-10" />}
                            {columns.map(col => (
                                <th
                                    key={col.key}
                                    className="px-4 py-3.5 text-[11px] font-black uppercase tracking-wider text-slate-500"
                                    style={col.width ? { width: col.width } : {}}
                                >
                                    <div className="flex items-center gap-1.5 relative">
                                        <span
                                            className={col.sortable ? 'cursor-pointer hover:text-slate-700 select-none transition-colors' : ''}
                                            onClick={() => col.sortable && handleSort(col.key)}
                                        >
                                            {col.label}
                                        </span>
                                        {col.sortable && sortBy === col.key && (
                                            sortDir === 'asc'
                                                ? <ChevronUp size={14} className="text-blue-500" />
                                                : <ChevronDown size={14} className="text-blue-500" />
                                        )}
                                        {col.filterable && (
                                            <button
                                                onClick={(e) => { e.stopPropagation(); setOpenFilter(openFilter === col.key ? null : col.key); }}
                                                className={`p-1 rounded-md transition-colors ${filters[col.key] ? 'text-blue-600 bg-blue-50' : 'text-slate-300 hover:text-slate-500 hover:bg-slate-100'
                                                    }`}
                                            >
                                                <Filter size={12} />
                                            </button>
                                        )}
                                        {openFilter === col.key && (
                                            <FilterPopover
                                                column={col}
                                                value={filters[col.key]}
                                                onChange={onFilterChange}
                                                onClose={() => setOpenFilter(null)}
                                                allValues={getColumnValues(col.key)}
                                            />
                                        )}
                                    </div>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {loading ? (
                            Array.from({ length: pageSize > 5 ? 5 : pageSize }).map((_, i) => (
                                <SkeletonRow key={i} cols={colCount} />
                            ))
                        ) : data.length === 0 ? (
                            <tr>
                                <td colSpan={colCount} className="px-6 py-20 text-center">
                                    <div className="flex flex-col items-center gap-3">
                                        {emptyIcon && <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center text-slate-300">{emptyIcon}</div>}
                                        <p className="text-slate-400 font-medium text-sm">{emptyMessage}</p>
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            data.map(row => (
                                <React.Fragment key={row[idKey]}>
                                    <tr className={`hover:bg-slate-50/70 transition-colors ${selectedIds.has(row[idKey]) ? 'bg-blue-50/30' : ''}`}>
                                        {selectable && (
                                            <td className="px-4 py-3.5">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedIds.has(row[idKey])}
                                                    onChange={() => toggleSelect(row[idKey])}
                                                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                                />
                                            </td>
                                        )}
                                        {expandable && (
                                            <td className="px-2 py-3.5">
                                                <button
                                                    onClick={() => toggleExpand(row[idKey])}
                                                    className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                                                >
                                                    {expandedRows.has(row[idKey])
                                                        ? <ChevronDown size={16} />
                                                        : <ChevronRight size={16} />
                                                    }
                                                </button>
                                            </td>
                                        )}
                                        {columns.map(col => (
                                            <td key={col.key} className="px-4 py-3.5 text-sm text-slate-700">
                                                {col.renderCell ? col.renderCell(row[col.key], row) : (row[col.key] ?? '—')}
                                            </td>
                                        ))}
                                    </tr>
                                    {expandable && expandedRows.has(row[idKey]) && renderExpandedRow && (
                                        <tr className="bg-slate-50/50">
                                            <td colSpan={colCount} className="px-6 py-4">
                                                {renderExpandedRow(row)}
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* ── Mobile Card View ───────────────────────────── */}
            <div className="md:hidden divide-y divide-slate-100">
                {loading ? (
                    Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="p-4 animate-pulse space-y-3">
                            <div className="h-4 bg-slate-100 rounded w-3/4" />
                            <div className="h-3 bg-slate-100 rounded w-1/2" />
                            <div className="h-3 bg-slate-100 rounded w-2/3" />
                        </div>
                    ))
                ) : data.length === 0 ? (
                    <div className="px-6 py-16 text-center">
                        {emptyIcon && <div className="w-14 h-14 mx-auto mb-3 bg-slate-50 rounded-full flex items-center justify-center text-slate-300">{emptyIcon}</div>}
                        <p className="text-slate-400 font-medium text-sm">{emptyMessage}</p>
                    </div>
                ) : (
                    data.map(row => (
                        <div key={row[idKey]} className={`p-4 ${selectedIds.has(row[idKey]) ? 'bg-blue-50/40' : ''}`}>
                            <div className="flex items-start gap-3">
                                {selectable && (
                                    <input
                                        type="checkbox"
                                        checked={selectedIds.has(row[idKey])}
                                        onChange={() => toggleSelect(row[idKey])}
                                        className="w-4 h-4 mt-0.5 rounded border-slate-300 text-blue-600"
                                    />
                                )}
                                <div className="flex-1 space-y-2">
                                    {columns.map(col => (
                                        <div key={col.key} className="flex justify-between items-center gap-2">
                                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{col.label}</span>
                                            <span className="text-sm text-slate-700 font-medium text-right">
                                                {col.renderCell ? col.renderCell(row[col.key], row) : (row[col.key] ?? '—')}
                                            </span>
                                        </div>
                                    ))}
                                    {expandable && renderExpandedRow && (
                                        <button
                                            onClick={() => toggleExpand(row[idKey])}
                                            className="text-xs font-bold text-blue-600 mt-1"
                                        >
                                            {expandedRows.has(row[idKey]) ? 'Hide Details' : 'Show Details'}
                                        </button>
                                    )}
                                    {expandable && expandedRows.has(row[idKey]) && renderExpandedRow && (
                                        <div className="mt-2 pt-2 border-t border-slate-100">
                                            {renderExpandedRow(row)}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* ── Pagination Footer ──────────────────────────── */}
            {totalItems > 0 && (
                <div className="px-5 py-3.5 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50/50">
                    <div className="flex items-center gap-3">
                        <span className="text-xs font-medium text-slate-500">Show</span>
                        <select
                            value={pageSize}
                            onChange={e => onPageSizeChange?.(Number(e.target.value))}
                            className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none"
                        >
                            {[10, 25, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
                        </select>
                        <span className="text-xs font-medium text-slate-500">entries</span>
                    </div>

                    <span className="text-xs font-medium text-slate-500">
                        Showing <strong className="text-slate-700">{startItem}</strong> to <strong className="text-slate-700">{endItem}</strong> of <strong className="text-slate-700">{totalItems}</strong> entries
                    </span>

                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => onPageChange?.(1)}
                            disabled={page <= 1}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        >
                            <ChevronsLeft size={16} />
                        </button>
                        <button
                            onClick={() => onPageChange?.(page - 1)}
                            disabled={page <= 1}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        >
                            <ChevronLeft size={16} />
                        </button>

                        {/* Page numbers */}
                        {(() => {
                            const pages = [];
                            const maxVisible = 5;
                            let start = Math.max(1, page - Math.floor(maxVisible / 2));
                            let end = Math.min(totalPages, start + maxVisible - 1);
                            if (end - start < maxVisible - 1) start = Math.max(1, end - maxVisible + 1);

                            for (let i = start; i <= end; i++) {
                                pages.push(
                                    <button
                                        key={i}
                                        onClick={() => onPageChange?.(i)}
                                        className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${i === page
                                            ? 'bg-blue-600 text-white shadow-sm shadow-blue-200'
                                            : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
                                            }`}
                                    >
                                        {i}
                                    </button>
                                );
                            }
                            return pages;
                        })()}

                        <button
                            onClick={() => onPageChange?.(page + 1)}
                            disabled={page >= totalPages}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        >
                            <ChevronRightIcon size={16} />
                        </button>
                        <button
                            onClick={() => onPageChange?.(totalPages)}
                            disabled={page >= totalPages}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        >
                            <ChevronsRight size={16} />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
