import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
    ChevronDown, ChevronUp, ChevronRight, Filter, X, Check,
    ChevronsLeft, ChevronsRight, ChevronLeft, ChevronRight as ChevronRightIcon,
    Search, SlidersHorizontal, Calendar, Eye, EyeOff, LayoutList, Clock
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
    const isDate = column.filterType === 'date-range';
    const isTime = column.filterType === 'time-range';
    const [tab, setTab] = useState(isDate ? 'date' : isTime ? 'time' : 'values');
    const [textFilter, setTextFilter] = useState(value?.text || '');
    const [textMode, setTextMode] = useState(value?.textMode || 'contains');
    const [checkedValues, setCheckedValues] = useState(new Set(value?.checked || []));
    const [startDate, setStartDate] = useState(value?.startDate || '');
    const [endDate, setEndDate] = useState(value?.endDate || '');
    const [startTime, setStartTime] = useState(value?.startTime || '');
    const [endTime, setEndTime] = useState(value?.endTime || '');
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
        } else if (tab === 'text') {
            onChange(column.key, textFilter ? { text: textFilter, textMode } : null);
        } else if (tab === 'date') {
            onChange(column.key, (startDate || endDate) ? { startDate, endDate } : null);
        } else if (tab === 'time') {
            onChange(column.key, (startTime || endTime) ? { startTime, endTime } : null);
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
        <div ref={ref} className="absolute top-full left-0 mt-1 w-64 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden animate-fade-in-up" onClick={e => e.stopPropagation()}>
            {/* Tabs */}
            <div className="flex border-b border-slate-100 bg-slate-50/50">
                {(isDate ? ['date'] : isTime ? ['time'] : ['values', 'text']).map(t => (
                    <button
                        key={t}
                        onClick={(e) => { e.stopPropagation(); setTab(t); }}
                        className={`flex-1 px-3 py-2.5 text-[10px] font-black uppercase tracking-wider transition-colors
              ${tab === t ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50' : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'}`}
                    >
                        {t === 'values' ? 'Values' : t === 'text' ? 'Text' : t === 'date' ? 'Date Range' : 'Time Range'}
                    </button>
                ))}
            </div>

            <div className="p-2 max-h-56 overflow-y-auto">
                {tab === 'values' ? (
                    uniqueValues.length > 0 ? (
                        <div className="space-y-0.5">
                            {uniqueValues.map(v => {
                                const val = typeof v === 'object' ? v.value : v;
                                const label = typeof v === 'object' ? v.label : String(v);
                                return (
                                    <label key={val} className="flex items-center gap-2.5 px-2.5 py-2 rounded-md hover:bg-slate-50 cursor-pointer text-xs transition-colors">
                                        <input
                                            type="checkbox"
                                            checked={checkedValues.has(val)}
                                            onChange={() => toggleValue(val)}
                                            className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                        />
                                        <span className="text-slate-700 font-medium truncate">{label}</span>
                                    </label>
                                );
                            })}
                        </div>
                    ) : <p className="text-xs text-slate-400 text-center py-6 italic">No values available</p>
                ) : tab === 'text' ? (
                    <div className="space-y-3 p-2">
                        <select
                            value={textMode}
                            onChange={e => setTextMode(e.target.value)}
                            onClick={e => e.stopPropagation()}
                            className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 transition-all cursor-pointer"
                        >
                            <option value="contains">Contains...</option>
                            <option value="equals">Equals...</option>
                            <option value="starts">Starts with...</option>
                        </select>
                        <input
                            type="text"
                            value={textFilter}
                            onChange={e => setTextFilter(e.target.value)}
                            onClick={e => e.stopPropagation()}
                            placeholder="Type to filter..."
                            className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 transition-all shadow-sm"
                            autoFocus
                        />
                    </div>
                ) : tab === 'time' ? (
                    <div className="space-y-4 p-2">
                        <div>
                            <label className="flex items-center gap-1.5 text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">
                                <Clock size={12} /> Start Time
                            </label>
                            <input
                                type="time"
                                value={startTime}
                                onChange={e => setStartTime(e.target.value)}
                                onClick={e => e.stopPropagation()}
                                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 transition-all shadow-sm cursor-pointer"
                            />
                        </div>
                        <div>
                            <label className="flex items-center gap-1.5 text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">
                                <Clock size={12} /> End Time
                            </label>
                            <input
                                type="time"
                                value={endTime}
                                onChange={e => setEndTime(e.target.value)}
                                onClick={e => e.stopPropagation()}
                                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 transition-all shadow-sm cursor-pointer"
                            />
                        </div>
                    </div>
                ) : (
                    <div className="space-y-4 p-2">
                        <div>
                            <label className="flex items-center gap-1.5 text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">
                                <Calendar size={12} /> From Date
                            </label>
                            <input
                                type="date"
                                value={startDate}
                                onChange={e => setStartDate(e.target.value)}
                                onClick={e => e.stopPropagation()}
                                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 transition-all shadow-sm cursor-pointer"
                            />
                        </div>
                        <div>
                            <label className="flex items-center gap-1.5 text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">
                                <Calendar size={12} /> To Date
                            </label>
                            <input
                                type="date"
                                value={endDate}
                                onChange={e => setEndDate(e.target.value)}
                                onClick={e => e.stopPropagation()}
                                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 transition-all shadow-sm cursor-pointer"
                            />
                        </div>
                    </div>
                )}
            </div>

            <div className="flex gap-2 p-3 border-t border-slate-100 bg-slate-50/80">
                <button onClick={clear} className="flex-1 px-3 py-2 text-xs font-bold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-sm">
                    Clear Option
                </button>
                <button onClick={apply} className="flex-1 px-3 py-2 text-xs font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm shadow-blue-500/20">
                    Apply Filter
                </button>
            </div>
        </div>
    );
}

/* ── Skeleton Row ─────────────────────────────────────────── */
function SkeletonRow({ cols, paddingClass }) {
    return (
        <tr className="animate-pulse">
            {Array.from({ length: cols }).map((_, i) => (
                <td key={i} className={paddingClass}>
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

    // UI Preference states
    const [hiddenColumns, setHiddenColumns] = useState(new Set());
    const [density, setDensity] = useState('normal'); // 'normal' | 'compact'
    const [viewOptionsOpen, setViewOptionsOpen] = useState(false);
    const viewOptionsRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (viewOptionsRef.current && !viewOptionsRef.current.contains(e.target)) {
                setViewOptionsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

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

    const extendedColumns = [
        {
            key: '_sno',
            label: 'S.No',
            width: '50px',
            sortable: false,
            filterable: false,
            renderCell: (_, __, rowIndex) => (
                <span className="text-[11px] font-bold text-slate-400">
                    {Math.max(1, startItem) + rowIndex}
                </span>
            )
        },
        ...columns
    ].filter(col => !hiddenColumns.has(col.key));

    const colCount = extendedColumns.length + (selectable ? 1 : 0) + (expandable ? 1 : 0);
    const paddingClass = density === 'compact' ? 'px-4 py-2' : 'px-4 py-3.5';

    // Active filters logic
    const activeFiltersCount = Object.keys(filters).filter(k => filters[k]).length;

    const removeFilter = (key) => {
        onFilterChange?.(key, null);
    };

    const clearAllFilters = () => {
        Object.keys(filters).forEach(k => onFilterChange?.(k, null));
        if (onSearch) onSearch('');
    };

    return (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
            {/* ── Top Bar (Search & View Options) ─────────────────────────────────── */}
            <div className="px-5 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white">
                {onSearch && (
                    <div className="relative flex-1 max-w-md">
                        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            value={searchValue}
                            onChange={e => onSearch(e.target.value)}
                            placeholder="Search in table..."
                            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 hover:border-blue-300 rounded-xl text-sm font-medium text-slate-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:bg-white outline-none transition-all shadow-sm"
                        />
                    </div>
                )}

                <div className="flex items-center gap-3 self-end sm:self-auto ml-auto">
                    {/* View Options Toggle */}
                    <div className="relative" ref={viewOptionsRef}>
                        <button
                            onClick={() => setViewOptionsOpen(!viewOptionsOpen)}
                            className={`flex items-center gap-2 px-3 py-2 border rounded-xl text-xs font-bold transition-all shadow-sm
                                ${viewOptionsOpen ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
                        >
                            <LayoutList size={14} /> View
                        </button>

                        {viewOptionsOpen && (
                            <div className="absolute right-0 top-full mt-2 w-64 bg-white border border-slate-200 rounded-xl shadow-xl z-40 animate-fade-in-up overflow-hidden">
                                {/* Density section */}
                                <div className="p-3 border-b border-slate-100 bg-slate-50/50">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5"><SlidersHorizontal size={10} /> Row Density</p>
                                    <div className="flex items-center gap-2 bg-slate-200/50 rounded-lg p-1 border border-slate-100">
                                        <button
                                            onClick={() => setDensity('normal')}
                                            className={`flex-1 text-xs py-1.5 rounded-md font-bold transition-all ${density === 'normal' ? 'bg-white text-blue-700 shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-700'}`}
                                        >
                                            Normal
                                        </button>
                                        <button
                                            onClick={() => setDensity('compact')}
                                            className={`flex-1 text-xs py-1.5 rounded-md font-bold transition-all ${density === 'compact' ? 'bg-white text-blue-700 shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-700'}`}
                                        >
                                            Compact
                                        </button>
                                    </div>
                                </div>
                                {/* Columns section */}
                                <div className="p-3 max-h-64 overflow-y-auto">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1.5"><Eye size={10} /> Toggle Columns</p>
                                    <div className="space-y-1">
                                        {columns.map(col => (
                                            <label key={col.key} className="flex items-center gap-3 px-2.5 py-2 rounded-md hover:bg-slate-50 cursor-pointer group transition-colors">
                                                <input
                                                    type="checkbox"
                                                    checked={!hiddenColumns.has(col.key)}
                                                    onChange={() => {
                                                        const next = new Set(hiddenColumns);
                                                        next.has(col.key) ? next.delete(col.key) : next.add(col.key);
                                                        setHiddenColumns(next);
                                                    }}
                                                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 transition-colors"
                                                />
                                                <span className={`text-xs font-semibold ${hiddenColumns.has(col.key) ? 'text-slate-500' : 'text-slate-800'}`}>{col.label}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* ── Active Filters Chips ─────────────────────────────────── */}
            {(activeFiltersCount > 0 || (onSearch && searchValue)) && (
                <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/50 flex flex-wrap items-center gap-2">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-2 flex items-center gap-1.5">
                        <Filter size={10} /> Active:
                    </span>

                    {searchValue && (
                        <div className="flex items-center gap-1.5 px-3 py-1 bg-white border border-slate-200 rounded-full shadow-sm animate-fade-in">
                            <span className="text-[10px] font-bold text-slate-400">Search:</span>
                            <span className="text-xs font-semibold text-slate-700">{searchValue}</span>
                            <button onClick={() => onSearch('')} className="ml-1 p-0.5 rounded-full hover:bg-rose-50 text-slate-400 hover:text-rose-500 transition-colors">
                                <X size={12} />
                            </button>
                        </div>
                    )}

                    {Object.keys(filters).filter(k => filters[k]).map(key => {
                        const col = columns.find(c => c.key === key);
                        const val = filters[key];
                        let displayVal = '';

                        if (val.checked) {
                            displayVal = val.checked.length > 1 ? `${val.checked[0]} +${val.checked.length - 1}` : val.checked[0];
                        } else if (val.text) {
                            displayVal = `"${val.text}"`;
                        } else if (val.startDate || val.endDate) {
                            const sd = val.startDate ? new Date(val.startDate).toLocaleDateString() : 'Any';
                            const ed = val.endDate ? new Date(val.endDate).toLocaleDateString() : 'Any';
                            displayVal = `${sd} - ${ed}`;
                        } else if (val.startTime || val.endTime) {
                            displayVal = `${val.startTime || 'Any'} - ${val.endTime || 'Any'}`;
                        }

                        return (
                            <div key={key} className="flex items-center gap-2 px-3 py-1 bg-blue-50 border border-blue-100 rounded-full text-blue-700 shadow-sm animate-fade-in overflow-hidden max-w-xs">
                                <span className="text-[10px] font-bold opacity-70 whitespace-nowrap">{col?.label || key}:</span>
                                <span className="text-xs font-semibold truncate">{displayVal}</span>
                                <button onClick={() => removeFilter(key)} className="ml-0.5 p-0.5 rounded-full hover:bg-blue-100 text-blue-400 hover:text-blue-700 transition-colors flex-shrink-0">
                                    <X size={12} />
                                </button>
                            </div>
                        );
                    })}

                    <button
                        onClick={clearAllFilters}
                        className="ml-auto text-[10px] font-bold text-slate-500 hover:text-rose-600 hover:bg-rose-50 px-3 py-1.5 rounded-full uppercase tracking-widest transition-colors flex items-center gap-1.5"
                    >
                        Clear All
                    </button>
                </div>
            )}

            {/* ── Floating Bulk Action Bar ──────────────────── */}
            {selectable && selectedIds.size > 0 && bulkActions && (
                <div className="px-5 py-2.5 bg-slate-900 flex items-center gap-4 relative z-10 transition-all duration-200">
                    <div className="flex items-center gap-2">
                        <div className="w-5 h-5 bg-blue-500 rounded flex items-center justify-center shadow-sm">
                            <Check size={12} className="text-white font-bold" />
                        </div>
                        <span className="text-xs font-bold text-white uppercase tracking-wider">
                            {selectedIds.size} Selected
                        </span>
                    </div>
                    <div className="h-4 w-px bg-slate-700" />
                    <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
                        {bulkActions}
                    </div>
                    <button
                        onClick={() => onSelectionChange?.(new Set())}
                        className="ml-auto text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-white transition-colors"
                    >
                        Clear Selection
                    </button>
                </div>
            )}

            {/* ── Desktop Table ──────────────────────────────── */}
            <div className="hidden md:block overflow-x-auto flex-1">
                <table className="w-full text-left">
                    <thead className="bg-slate-50/80 border-b border-slate-200">
                        <tr>
                            {selectable && (
                                <th className={`${paddingClass} w-12 border-r border-slate-100/50`}>
                                    <input
                                        type="checkbox"
                                        checked={allSelected}
                                        ref={el => { if (el) el.indeterminate = someSelected; }}
                                        onChange={toggleSelectAll}
                                        className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 transition-colors"
                                    />
                                </th>
                            )}
                            {expandable && <th className="px-2 py-3.5 w-10 border-r border-slate-100/50" />}
                            {extendedColumns.map(col => (
                                <th
                                    key={col.key}
                                    className={`${paddingClass} text-[11px] font-black uppercase tracking-widest text-slate-500 border-r border-slate-100/50 last:border-r-0`}
                                    style={col.width ? { width: col.width } : {}}
                                >
                                    <div className="flex items-center justify-between gap-2 group relative">
                                        <div
                                            className={`flex items-center gap-1.5 flex-1 w-full ${col.sortable ? 'cursor-pointer hover:text-slate-800 select-none transition-colors' : ''}`}
                                            onClick={() => col.sortable && handleSort(col.key)}
                                        >
                                            <span>{col.label}</span>
                                            {col.sortable && (
                                                <div className="flex flex-col items-center opacity-40 group-hover:opacity-100 transition-opacity">
                                                    <ChevronUp size={10} className={sortBy === col.key && sortDir === 'asc' ? 'text-blue-600 opacity-100' : '-mb-1'} />
                                                    <ChevronDown size={10} className={sortBy === col.key && sortDir === 'desc' ? 'text-blue-600 opacity-100' : ''} />
                                                </div>
                                            )}
                                        </div>
                                        {col.filterable && (
                                            <div className="relative">
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); setOpenFilter(openFilter === col.key ? null : col.key); }}
                                                    className={`p-1.5 rounded-md transition-colors ${filters[col.key] ? 'text-blue-700 bg-blue-100 shadow-sm' : 'text-slate-300 hover:text-slate-600 hover:bg-slate-200'
                                                        }`}
                                                >
                                                    <Filter size={12} />
                                                </button>
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
                                        )}
                                    </div>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                        {loading ? (
                            Array.from({ length: pageSize > 5 ? 5 : pageSize }).map((_, i) => (
                                <SkeletonRow key={i} cols={colCount} paddingClass={paddingClass} />
                            ))
                        ) : data.length === 0 ? (
                            <tr>
                                <td colSpan={colCount} className="px-6 py-24 text-center bg-slate-50/30">
                                    <div className="flex flex-col items-center gap-4">
                                        {emptyIcon ? (
                                            <div className="w-20 h-20 bg-white shadow-sm border border-slate-100 rounded-full flex items-center justify-center text-slate-400">
                                                {emptyIcon}
                                            </div>
                                        ) : (
                                            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center text-slate-300">
                                                <Search size={24} />
                                            </div>
                                        )}
                                        <p className="text-slate-500 font-semibold">{emptyMessage}</p>
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            data.map((row, rowIndex) => (
                                <React.Fragment key={row[idKey]}>
                                    <tr className={`hover:bg-slate-50/80 transition-colors ${selectedIds.has(row[idKey]) ? 'bg-blue-50/40 hover:bg-blue-50/60' : ''}`}>
                                        {selectable && (
                                            <td className={`${paddingClass}`}>
                                                <input
                                                    type="checkbox"
                                                    checked={selectedIds.has(row[idKey])}
                                                    onChange={() => toggleSelect(row[idKey])}
                                                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 transition-colors"
                                                />
                                            </td>
                                        )}
                                        {expandable && (
                                            <td className="px-2 py-3.5">
                                                <button
                                                    onClick={() => toggleExpand(row[idKey])}
                                                    className="p-1 rounded-md text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors"
                                                >
                                                    {expandedRows.has(row[idKey])
                                                        ? <ChevronDown size={16} />
                                                        : <ChevronRight size={16} />
                                                    }
                                                </button>
                                            </td>
                                        )}
                                        {extendedColumns.map(col => (
                                            <td key={col.key} className={`${paddingClass} text-sm text-slate-700 ${density === 'compact' ? 'py-2.5' : 'py-4'}`}>
                                                {col.renderCell ? col.renderCell(row[col.key], row, rowIndex) : (row[col.key] ?? '—')}
                                            </td>
                                        ))}
                                    </tr>
                                    {expandable && expandedRows.has(row[idKey]) && renderExpandedRow && (
                                        <tr className="bg-slate-50 border-t border-slate-100 shadow-inner">
                                            <td colSpan={colCount} className="px-8 py-6 rounded-b-lg">
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
            <div className="md:hidden divide-y divide-slate-100 bg-slate-50/30">
                {loading ? (
                    Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="p-5 animate-pulse space-y-4">
                            <div className="h-4 bg-slate-200 rounded w-3/4" />
                            <div className="h-3 bg-slate-200 rounded w-1/2" />
                            <div className="h-3 bg-slate-200 rounded w-2/3" />
                        </div>
                    ))
                ) : data.length === 0 ? (
                    <div className="px-6 py-20 text-center">
                        {emptyIcon && <div className="w-16 h-16 mx-auto mb-4 bg-white shadow-sm border border-slate-100 rounded-full flex items-center justify-center text-slate-300">{emptyIcon}</div>}
                        <p className="text-slate-500 font-semibold">{emptyMessage}</p>
                    </div>
                ) : (
                    data.map((row, rowIndex) => (
                        <div key={row[idKey]} className={`p-5 overflow-hidden relative ${selectedIds.has(row[idKey]) ? 'bg-blue-50/40' : 'bg-white'}`}>
                            {selectedIds.has(row[idKey]) && <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500" />}
                            <div className="flex items-start gap-4">
                                {selectable && (
                                    <input
                                        type="checkbox"
                                        checked={selectedIds.has(row[idKey])}
                                        onChange={() => toggleSelect(row[idKey])}
                                        className="w-5 h-5 mt-0.5 rounded border-slate-300 text-blue-600 flex-shrink-0"
                                    />
                                )}
                                <div className="flex-1 space-y-3">
                                    {extendedColumns.map(col => (
                                        <div key={col.key} className="flex flex-col gap-1">
                                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{col.label}</span>
                                            <div className="text-sm text-slate-800 font-medium">
                                                {col.renderCell ? col.renderCell(row[col.key], row, rowIndex) : (row[col.key] ?? '—')}
                                            </div>
                                        </div>
                                    ))}
                                    {expandable && renderExpandedRow && (
                                        <button
                                            onClick={() => toggleExpand(row[idKey])}
                                            className="text-xs font-black text-blue-600 mt-2 hover:text-blue-800 flex items-center gap-1 uppercase tracking-widest"
                                        >
                                            {expandedRows.has(row[idKey]) ? <><ChevronDown size={14} /> Hide Details</> : <><ChevronRight size={14} /> Show Details</>}
                                        </button>
                                    )}
                                    {expandable && expandedRows.has(row[idKey]) && renderExpandedRow && (
                                        <div className="mt-4 pt-4 border-t border-slate-100">
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
                <div className="px-5 py-3.5 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4 bg-white mt-auto rounded-b-xl">
                    <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-start">
                        <span className="text-xs font-semibold text-slate-500 hidden sm:inline">Show</span>
                        <select
                            value={pageSize}
                            onChange={e => onPageSizeChange?.(Number(e.target.value))}
                            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 hover:border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none transition-colors appearance-none cursor-pointer"
                        >
                            {[10, 25, 50, 100].map(n => <option key={n} value={n}>{n} rows</option>)}
                        </select>
                    </div>

                    <span className="text-xs font-medium text-slate-500 text-center sm:text-left">
                        Showing <strong className="text-slate-800 font-bold">{startItem}</strong> to <strong className="text-slate-800 font-bold">{endItem}</strong> of <strong className="text-slate-800 font-bold">{totalItems}</strong> entries
                    </span>

                    <div className="flex items-center gap-1.5">
                        <button
                            onClick={() => onPageChange?.(1)}
                            disabled={page <= 1}
                            title="First Page"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        >
                            <ChevronsLeft size={16} />
                        </button>
                        <button
                            onClick={() => onPageChange?.(page - 1)}
                            disabled={page <= 1}
                            title="Previous Page"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        >
                            <ChevronLeft size={16} />
                        </button>

                        {/* Page numbers */}
                        {(() => {
                            const pages = [];
                            const maxVisible = 5; // Responsive page numbers if needed window.innerWidth < 640 ? 3 : 5
                            let start = Math.max(1, page - Math.floor(maxVisible / 2));
                            let end = Math.min(totalPages, start + maxVisible - 1);
                            if (end - start < maxVisible - 1) start = Math.max(1, end - maxVisible + 1);

                            for (let i = start; i <= end; i++) {
                                pages.push(
                                    <button
                                        key={i}
                                        onClick={() => onPageChange?.(i)}
                                        className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${i === page
                                            ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30'
                                            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
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
                            title="Next Page"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        >
                            <ChevronRightIcon size={16} />
                        </button>
                        <button
                            onClick={() => onPageChange?.(totalPages)}
                            disabled={page >= totalPages}
                            title="Last Page"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        >
                            <ChevronsRight size={16} />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
