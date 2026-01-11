import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import SaaSLayout from '../components/SaaSLayout';
import { getChallenges } from '../services/api';
import ChallengeCard from '../components/ChallengeCard';
import {
  Filter,
  Terminal,
  Search,
  Zap,
  Layout
} from 'lucide-react';

export default function CandidateDashboard() {
  const [challenges, setChallenges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    loadChallenges();
  }, []);

  const loadChallenges = async () => {
    try {
      setLoading(true);
      const response = await getChallenges();
      setChallenges(response.data);
    } catch (error) {
      console.error('Failed to load challenges:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredChallenges = challenges.filter(challenge => {
    const matchesFilter = filter === 'all' || challenge.difficulty.toLowerCase() === filter;
    const matchesSearch = challenge.title.toLowerCase().includes(search.toLowerCase()) ||
      challenge.description.toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  return (
    <SaaSLayout>
      <div className="space-y-8 text-left">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Challenge Repository</h1>
            <p className="text-slate-500 mt-1">Direct access to the full spectrum of frontend assessments.</p>
          </div>

          <div className="flex items-center gap-4 bg-white p-2 border border-slate-100 rounded-2xl shadow-sm w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
              <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search challenges..."
                className="w-full pl-12 pr-4 py-2.5 bg-slate-50 border-none rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="p-2 bg-slate-100 rounded-xl text-slate-400">
            <Filter size={18} />
          </div>
          {[
            { id: 'all', label: 'All Modules', color: 'bg-slate-900 text-white' },
            { id: 'beginner', label: 'Junior', color: 'bg-emerald-50 text-emerald-600' },
            { id: 'intermediate', label: 'Associate', color: 'bg-amber-50 text-amber-600' },
            { id: 'advanced', label: 'Senior', color: 'bg-rose-50 text-rose-600' }
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`px-5 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all
                        ${filter === f.id ? (f.id === 'all' ? 'bg-slate-900 text-white shadow-xl shadow-slate-900/10' : f.color + ' border border-transparent shadow-lg') : 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-50'}
                    `}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Challenges Grid */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-40">
            <Terminal size={48} className="text-slate-100 animate-pulse mb-6" />
            <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Loading Logic Streams...</p>
          </div>
        ) : filteredChallenges.length === 0 ? (
          <div className="py-40 bg-white rounded-[2.5rem] border border-dashed border-slate-200 flex flex-col items-center">
            <Zap size={48} className="text-slate-100 mb-4" />
            <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">No matches found in this sector</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredChallenges.map(challenge => (
              <div key={challenge.id} className="group cursor-pointer" onClick={() => navigate(`/challenge/${challenge.id}`)}>
                <ChallengeCard
                  challenge={challenge}
                  onClick={() => { }} // Already handled by parent div for better coverage
                />
              </div>
            ))}
          </div>
        )}

        {/* Info Zone */}
        <div className="mt-12 p-8 bg-blue-600 rounded-[2.5rem] text-white flex flex-col lg:flex-row items-center justify-between gap-8 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-12 opacity-10 pointer-events-none">
            <Layout size={180} />
          </div>
          <div className="relative z-10">
            <h3 className="text-2xl font-bold mb-2">Practice Mode</h3>
            <p className="text-blue-100 font-medium max-w-xl">
              All challenges here are available for sandbox practice. Your performance here contributes to your global **Technical Ranking** but does not affect curriculum level progression.
            </p>
          </div>
          <button className="px-8 py-4 bg-white text-blue-600 rounded-2xl font-bold shadow-2xl shadow-blue-900/20 hover:bg-blue-50 transition-colors relative z-10 whitespace-nowrap">
            Review Guidelines
          </button>
        </div>
      </div>
    </SaaSLayout>
  );
}
