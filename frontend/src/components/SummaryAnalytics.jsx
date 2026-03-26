import React from 'react';
import {
    Layout,
    CheckCircle,
    Clock,
    AlertCircle,
    TrendingUp,
    Zap,
    FileText,
    Activity,
    Shield
} from 'lucide-react';

const MetricCard = ({ icon: Icon, label, value, color = 'blue', delay = 0 }) => {
    const colors = {
        blue: {
            bg: 'bg-slate-50',
            text: 'text-slate-900',
            border: 'border-slate-200',
            iconBg: 'bg-slate-900',
            shadow: 'shadow-slate-100/50'
        },
        emerald: {
            bg: 'bg-emerald-50',
            text: 'text-emerald-600',
            border: 'border-emerald-100',
            iconBg: 'bg-emerald-600',
            shadow: 'shadow-emerald-100/50'
        },
        amber: {
            bg: 'bg-amber-50',
            text: 'text-amber-600',
            border: 'border-amber-100',
            iconBg: 'bg-amber-600',
            shadow: 'shadow-amber-100/50'
        },
        rose: {
            bg: 'bg-rose-50',
            text: 'text-rose-600',
            border: 'border-rose-100',
            iconBg: 'bg-rose-600',
            shadow: 'shadow-rose-100/50'
        },
        purple: {
            bg: 'bg-purple-50',
            text: 'text-purple-600',
            border: 'border-purple-100',
            iconBg: 'bg-purple-600',
            shadow: 'shadow-purple-100/50'
        },
        slate: {
            bg: 'bg-slate-50',
            text: 'text-slate-600',
            border: 'border-slate-100',
            iconBg: 'bg-slate-600',
            shadow: 'shadow-slate-100/50'
        }
    };

    const c = colors[color] || colors.blue;

    return (
        <div
            className={`group flex items-center gap-3 bg-white px-4 py-3 rounded-md border ${c.border} shadow-sm transition-all duration-200 hover:shadow-md`}
        >
            <div className={`w-10 h-10 rounded-md ${c.bg} flex items-center justify-center ${c.text} transition-colors border border-black/5`}>
                <Icon size={20} />
            </div>
            <div>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">{label}</p>
                <p className={`text-xl font-bold ${c.text} tabular-nums leading-none`}>
                    {value !== undefined ? value : '0'}
                </p>
            </div>
        </div>
    );
};

export default function SummaryAnalytics({ metrics, type = 'submissions' }) {
    if (!metrics) return null;

    if (type === 'submissions') {
        return (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
                <MetricCard icon={FileText} label="Total Submissions" value={metrics.total} color="slate" delay={0} />
                <MetricCard icon={Clock} label="Pending Reviews" value={metrics.pending} color="amber" delay={100} />
                <MetricCard icon={Activity} label="Evaluating" value={metrics.evaluating} color="blue" delay={200} />
                <MetricCard icon={CheckCircle} label="Completed" value={metrics.completed} color="emerald" delay={300} />
            </div>
        );
    }

    if (type === 'results') {
        return (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 w-full">
                <MetricCard icon={FileText} label="Total Results" value={metrics.total} color="slate" delay={0} />
                <MetricCard icon={CheckCircle} label="Cleared/Pass" value={metrics.passed} color="emerald" delay={100} />
                <MetricCard icon={AlertCircle} label="Failed" value={metrics.failed} color="rose" delay={200} />
            </div>
        );
    }

    if (type === 'session') {
        return (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full animate-in fade-in slide-in-from-top-4 duration-500">
                <MetricCard icon={FileText} label="Submitted" value={metrics.submitted} color="blue" delay={0} />
                <MetricCard icon={Clock} label="Remaining" value={metrics.remaining} color="amber" delay={100} />
                <MetricCard icon={CheckCircle} label="Cleared/Pass" value={metrics.passed} color="emerald" delay={200} />
                <MetricCard icon={AlertCircle} label="Failed" value={metrics.failed} color="rose" delay={300} />
            </div>
        );
    }

    return null;
}
