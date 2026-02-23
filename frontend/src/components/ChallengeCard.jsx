export default function ChallengeCard({ challenge, onClick }) {
  const difficultyClass = {
    Easy: 'badge-easy',
    Medium: 'badge-medium',
    Hard: 'badge-hard'
  }[challenge.difficulty] || 'badge-easy';

  return (
    <div
      onClick={onClick}
      className="card cursor-pointer hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1"
    >
      <div className="flex justify-between items-start mb-4">
        <h3 className="text-xl font-bold text-gray-900">{challenge.title}</h3>
        <span className={`badge ${difficultyClass}`}>
          {challenge.difficulty}
        </span>
      </div>

      <p className="text-gray-600 mb-4 line-clamp-3">{challenge.description}</p>

      <div className="flex flex-wrap gap-2 mb-4">
        {challenge.tags?.map((tag, index) => (
          <span
            key={index}
            className="px-2 py-1 bg-blue-50 text-blue-700 text-xs font-medium rounded"
          >
            {tag}
          </span>
        ))}
      </div>

      <div className="flex justify-between items-center pt-4 border-t border-gray-200">
        <div className="flex items-center text-slate-400 text-[11px] font-bold uppercase tracking-wider">
          <svg className="w-3.5 h-3.5 mr-1.5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
          </svg>
          {challenge.timeLimit} MIN
        </div>
        <button className="px-4 py-2 bg-blue-50 text-blue-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-600 hover:text-white transition-all shadow-sm">
          Start →
        </button>
      </div>
    </div>
  );
}
