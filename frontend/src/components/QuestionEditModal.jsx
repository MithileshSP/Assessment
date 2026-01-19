import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Save, Plus, Settings, Shield, Clock, Zap, Target, Code, Maximize2, Minimize2, Image, Link, HelpCircle, Layers } from 'lucide-react';

export default function QuestionEditModal({ question, courseId, onSave, onClose }) {
  const [formData, setFormData] = useState({
    id: '',
    title: '',
    description: '',
    instructions: '',
    level: 1,
    questionNumber: 1,
    points: 100,
    tags: '',
    hasHtml: false,
    hasCss: false,
    hasJs: false,
    hints: '',
    isLocked: false,
    assetImages: '',
    assetReference: '',
    expectedSolutionHtml: '',
    expectedSolutionCss: '',
    expectedSolutionJs: '',
    thresholdStructure: 70,
    thresholdVisual: 80,
    thresholdOverall: 75
  });

  const [activeTab, setActiveTab] = useState('basic'); // 'basic' | 'solution' | 'assets' | 'evaluation'

  useEffect(() => {
    if (question) {
      // Convert assets array to string paths
      let imagePaths = '';
      if (Array.isArray(question.assets)) {
        imagePaths = question.assets.map(a => (typeof a === 'string' ? a : a.path)).join('\n');
      } else if (question.assets?.images) {
        imagePaths = question.assets.images.map(img => img.path || img).join('\n');
      }

      const referencePath = question.assets?.reference || '';

      const tagsArray = Array.isArray(question.tags) ? question.tags : [];
      const hasHtml = tagsArray.some(t => t.toLowerCase() === 'html');
      const hasCss = tagsArray.some(t => t.toLowerCase() === 'css');
      const hasJs = tagsArray.some(t => t.toLowerCase() === 'js');
      const otherTags = tagsArray.filter(t => !['html', 'css', 'js'].includes(t.toLowerCase())).join(', ');

      setFormData({
        id: question.id || '',
        title: question.title || '',
        description: question.description || '',
        instructions: question.instructions || '',
        level: question.level || 1,
        questionNumber: question.questionNumber || 1,
        points: question.points || 100,
        tags: otherTags,
        hasHtml,
        hasCss,
        hasJs,
        hints: Array.isArray(question.hints) ? question.hints.join('\n') : '',
        isLocked: question.isLocked || false,
        assetImages: imagePaths,
        assetReference: referencePath,
        expectedSolutionHtml: question.expectedSolution?.html || '',
        expectedSolutionCss: question.expectedSolution?.css || '',
        expectedSolutionJs: question.expectedSolution?.js || '',
        thresholdStructure: question.passingThreshold?.structure || 70,
        thresholdVisual: question.passingThreshold?.visual || 80,
        thresholdOverall: question.passingThreshold?.overall || 75
      });
    } else {
      // New question - generate ID
      const timestamp = Date.now();
      const newId = `${courseId}-l${formData.level}-q${timestamp}`;
      setFormData(prev => ({ ...prev, id: newId }));
    }
  }, [question, courseId]);

  const handleExtractAssets = () => {
    const html = formData.expectedSolutionHtml || '';
    const css = formData.expectedSolutionCss || '';
    const combined = html + css;

    const regex = /(?:src=["']|url\(["']?)([^"')]+\.(?:png|jpg|jpeg|gif|svg|webp))["')]/gi;
    const matches = [...combined.matchAll(regex)];

    const uniquePaths = new Set();
    const currentPaths = formData.assetImages.split('\n').map(p => p.trim()).filter(p => p);

    currentPaths.forEach(p => uniquePaths.add(p));

    matches.forEach(match => {
      let path = match[1];
      if (!path.startsWith('http') && !path.startsWith('/') && !path.startsWith('assets')) {
        path = path.replace(/^(\.\/)?(images\/)?/, '');
        path = `/assets/images/${path}`;
      } else if (path.startsWith('images/')) {
        path = `/assets/${path}`;
      }
      uniquePaths.add(path);
    });

    setFormData({
      ...formData,
      assetImages: Array.from(uniquePaths).join('\n')
    });

    alert(`Extracted ${uniquePaths.size - currentPaths.length} new asset(s) from code!`);
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    const imagePaths = formData.assetImages
      .split('\n')
      .map(path => path.trim())
      .filter(path => path);

    const assetImages = imagePaths.map(path => {
      const filename = path.split('/').pop();
      return {
        name: filename,
        path: path,
        description: `${filename} image`
      };
    });

    const questionData = {
      id: formData.id,
      courseId: courseId,
      level: parseInt(formData.level),
      questionNumber: parseInt(formData.questionNumber),
      title: formData.title,
      description: formData.description,
      instructions: formData.instructions,
      points: parseInt(formData.points),
      tags: [
        ...(formData.hasHtml ? ['HTML'] : []),
        ...(formData.hasCss ? ['CSS'] : []),
        ...(formData.hasJs ? ['JS'] : []),
        ...formData.tags.split(',').map(t => t.trim()).filter(t => t && !['html', 'css', 'js'].includes(t.toLowerCase()))
      ],
      hints: formData.hints.split('\n').filter(h => h.trim()),
      isLocked: formData.isLocked,
      passingThreshold: {
        structure: parseInt(formData.thresholdStructure) || 70,
        visual: parseInt(formData.thresholdVisual) || 80,
        overall: parseInt(formData.thresholdOverall) || 75
      },
      expectedSolution: {
        html: formData.expectedSolutionHtml,
        css: formData.expectedSolutionCss,
        js: formData.expectedSolutionJs
      },
      assets: {
        images: assetImages,
        reference: ''
      },
      prerequisite: question?.prerequisite || null,
      createdAt: question?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    onSave(questionData);
  };

  const modalContent = (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4 font-sans animate-in fade-in duration-200">
      <div className="bg-white rounded-[2.5rem] shadow-2xl max-w-6xl w-full max-h-[92vh] flex flex-col overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-10 py-8 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
          <div>
            <div className="flex items-center gap-2 text-[10px] font-black text-indigo-500 uppercase tracking-[0.2em] mb-1">
              <Code size={10} />
              <span>Assessment Architect</span>
            </div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">
              {question ? 'Refine Question' : 'Engineer New Prompt'}
            </h2>
            <p className="text-slate-400 text-sm mt-1">Configure challenge parameters, solutions, and evaluation criteria.</p>
          </div>
          <button
            onClick={onClose}
            className="w-12 h-12 flex items-center justify-center bg-slate-50 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-2xl transition-all active:scale-90"
          >
            <X size={24} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="px-10 bg-slate-50/50 border-b border-slate-100 flex items-center gap-8 shrink-0">
          {[
            { id: 'basic', label: 'Identity & Scope', icon: <Target size={16} /> },
            { id: 'solution', label: 'Grand Truth Solution', icon: <Code size={16} /> },
            { id: 'assets', label: 'Media Assets', icon: <Image size={16} /> },
            { id: 'evaluation', label: 'Evaluation Engine', icon: <Shield size={16} /> }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 py-5 text-xs font-black uppercase tracking-[0.15em] transition-all relative ${activeTab === tab.id ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'
                }`}
            >
              {tab.icon}
              {tab.label}
              {activeTab === tab.id && (
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-indigo-600 rounded-t-full shadow-[0_-4px_12px_rgba(79,70,229,0.3)]" />
              )}
            </button>
          ))}
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto custom-scrollbar p-10 space-y-10 focus-within:outline-none">
          {activeTab === 'basic' && (
            <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-300">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Unique Identifier</label>
                  <input
                    type="text"
                    value={formData.id}
                    onChange={(e) => setFormData({ ...formData, id: e.target.value })}
                    className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-indigo-500/5 focus:bg-white focus:border-indigo-500 transition-all outline-none"
                    required
                    disabled={!!question}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Question Title</label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-indigo-500/5 focus:bg-white focus:border-indigo-500 transition-all outline-none"
                    required
                    placeholder="e.g. Navigation Bar Construction"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Mission Brief (Description)</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium focus:ring-4 focus:ring-indigo-500/5 focus:bg-white focus:border-indigo-500 transition-all outline-none min-h-[80px]"
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Technical Requirements (Instructions)</label>
                <textarea
                  value={formData.instructions}
                  onChange={(e) => setFormData({ ...formData, instructions: e.target.value })}
                  className="w-full px-5 py-4 bg-[#0f172a] text-indigo-100 border-none rounded-2xl text-sm font-mono focus:ring-4 focus:ring-indigo-500/20 transition-all outline-none min-h-[160px]"
                  required
                />
              </div>

              <div className="grid grid-cols-3 gap-6">
                <MetricInput label="Level (1-12)" value={formData.level} onChange={v => setFormData({ ...formData, level: v })} icon={<Layers size={14} />} />
                <MetricInput label="Display Order" value={formData.questionNumber} onChange={v => setFormData({ ...formData, questionNumber: v })} icon={<Zap size={14} />} />
                <MetricInput label="Points Awarded" value={formData.points} onChange={v => setFormData({ ...formData, points: v })} icon={<Target size={14} />} />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-8 pt-4">
                <div className="md:col-span-1 space-y-4">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Primary Stack</label>
                  <div className="flex flex-col gap-3">
                    <LanguageToggle
                      label="HTML5"
                      checked={formData.hasHtml}
                      onChange={(v) => setFormData({ ...formData, hasHtml: v })}
                      color="peer-checked:bg-orange-500"
                    />
                    <LanguageToggle
                      label="CSS3"
                      checked={formData.hasCss}
                      onChange={(v) => setFormData({ ...formData, hasCss: v })}
                      color="peer-checked:bg-blue-500"
                    />
                    <LanguageToggle
                      label="JavaScript"
                      checked={formData.hasJs}
                      onChange={(v) => setFormData({ ...formData, hasJs: v })}
                      color="peer-checked:bg-yellow-500"
                    />
                  </div>
                </div>

                <div className="md:col-span-2 space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Additional Keywords / Tags</label>
                  <input
                    type="text"
                    value={formData.tags}
                    onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                    className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-indigo-500/5 focus:bg-white focus:border-indigo-500 transition-all outline-none"
                    placeholder="e.g. Flexbox, Semantic HTML, Grid"
                  />
                </div>

                <div className="md:col-span-1 flex items-center justify-center p-4 bg-slate-50 rounded-2xl border border-slate-100 mt-6">
                  <label className="flex items-center gap-4 cursor-pointer group">
                    <div className="relative">
                      <input
                        type="checkbox"
                        checked={formData.isLocked}
                        onChange={(e) => setFormData({ ...formData, isLocked: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-14 h-8 bg-slate-300 rounded-full peer peer-checked:bg-indigo-600 transition-all after:content-[''] after:absolute after:top-1 after:left-1 after:bg-white after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:after:translate-x-6 shadow-inner" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm font-black text-slate-700 uppercase tracking-widest">Enforce Unlock</span>
                      <span className="text-[10px] text-slate-400 font-bold">Lock this question by default</span>
                    </div>
                  </label>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'solution' && (
            <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-300">
              <div className="space-y-4">
                <div className="flex items-center justify-between px-2">
                  <label className="text-xs font-black text-slate-600 uppercase tracking-widest">HTML Architecture</label>
                  <div className="h-[1px] flex-1 mx-6 bg-slate-100" />
                </div>
                <textarea
                  value={formData.expectedSolutionHtml}
                  onChange={(e) => setFormData({ ...formData, expectedSolutionHtml: e.target.value })}
                  className="w-full px-6 py-5 bg-[#0f172a] text-emerald-400 border-none rounded-3xl text-sm font-mono focus:ring-8 focus:ring-emerald-500/5 transition-all outline-none min-h-[180px]"
                  placeholder="<!-- Structured HTML here -->"
                />
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between px-2">
                  <label className="text-xs font-black text-slate-600 uppercase tracking-widest">CSS Styling System</label>
                  <div className="h-[1px] flex-1 mx-6 bg-slate-100" />
                </div>
                <textarea
                  value={formData.expectedSolutionCss}
                  onChange={(e) => setFormData({ ...formData, expectedSolutionCss: e.target.value })}
                  className="w-full px-6 py-5 bg-[#0f172a] text-sky-400 border-none rounded-3xl text-sm font-mono focus:ring-8 focus:ring-sky-500/5 transition-all outline-none min-h-[180px]"
                  placeholder="/* Modern CSS design here */"
                />
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between px-2">
                  <label className="text-xs font-black text-slate-600 uppercase tracking-widest">Behavioral Logic (JavaScript)</label>
                  <div className="h-[1px] flex-1 mx-6 bg-slate-100" />
                </div>
                <textarea
                  value={formData.expectedSolutionJs}
                  onChange={(e) => setFormData({ ...formData, expectedSolutionJs: e.target.value })}
                  className="w-full px-6 py-5 bg-[#0f172a] text-amber-400 border-none rounded-3xl text-sm font-mono focus:ring-8 focus:ring-amber-500/5 transition-all outline-none min-h-[120px]"
                  placeholder="// Interactive logic (optional)"
                />
              </div>
            </div>
          )}

          {activeTab === 'assets' && (
            <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-300">
              <div className="bg-indigo-50 border border-indigo-100 rounded-[2rem] p-8 flex items-start gap-6">
                <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center text-indigo-600 shadow-sm shrink-0">
                  <Image size={28} />
                </div>
                <div className="space-y-2">
                  <h4 className="text-lg font-black text-indigo-900">CDN Asset Registry</h4>
                  <p className="text-indigo-600/70 text-sm leading-relaxed"> List the absolute paths of images required for this challenge. Use the button below to auto-detect images referenced in your solution code.</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between px-2">
                  <label className="text-xs font-black text-slate-600 uppercase tracking-widest">Image Source Paths</label>
                  <button
                    type="button"
                    onClick={handleExtractAssets}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200"
                  >
                    <Zap size={14} />
                    Auto-Detect Assets
                  </button>
                </div>
                <textarea
                  value={formData.assetImages}
                  onChange={(e) => setFormData({ ...formData, assetImages: e.target.value })}
                  className="w-full px-6 py-5 bg-slate-50 border border-slate-200 rounded-3xl text-sm font-mono focus:ring-4 focus:ring-indigo-500/5 focus:bg-white focus:border-indigo-500 transition-all outline-none min-h-[200px]"
                  placeholder="/assets/images/sample-media.webp"
                />
              </div>
            </div>
          )}

          {activeTab === 'evaluation' && (
            <div className="space-y-10 animate-in slide-in-from-bottom-4 duration-300">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <EvaluationCard
                  title="Structural Integrity"
                  description="DOM Hierarchy & Tag Accuracy"
                  value={formData.thresholdStructure}
                  onChange={v => setFormData({ ...formData, thresholdStructure: v })}
                  color="bg-emerald-50 text-emerald-600"
                />
                <EvaluationCard
                  title="Visual Fidelity"
                  description="Pixel Match & CSS Layout"
                  value={formData.thresholdVisual}
                  onChange={v => setFormData({ ...formData, thresholdVisual: v })}
                  color="bg-sky-50 text-sky-600"
                />
                <EvaluationCard
                  title="Success Threshold"
                  description="Minimum Passing Requirement"
                  value={formData.thresholdOverall}
                  onChange={v => setFormData({ ...formData, thresholdOverall: v })}
                  color="bg-indigo-50 text-indigo-600"
                />
              </div>

              <div className="space-y-4 pt-4">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Knowledge Reinforcement (Hints)</label>
                <textarea
                  value={formData.hints}
                  onChange={(e) => setFormData({ ...formData, hints: e.target.value })}
                  className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium focus:ring-4 focus:ring-indigo-500/5 focus:bg-white transition-all outline-none min-h-[120px]"
                  placeholder="Provide iterative guidance for stuck candidates..."
                />
              </div>
            </div>
          )}
        </form>

        {/* Footer */}
        <div className="px-10 py-8 border-t border-slate-100 flex justify-between items-center bg-slate-50/50 shrink-0">
          <div className="flex items-center gap-2 text-slate-400">
            <HelpCircle size={14} />
            <span className="text-[10px] font-black uppercase tracking-widest">Auto-saving local draft...</span>
          </div>
          <div className="flex gap-4">
            <button
              type="button"
              onClick={onClose}
              className="px-8 py-3.5 text-slate-500 font-black text-xs uppercase tracking-widest hover:text-slate-700 hover:bg-slate-100 rounded-2xl transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              className="px-10 py-3.5 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 flex items-center gap-3 active:scale-95"
            >
              <Save size={18} />
              {question ? 'Confirm Changes' : 'Deploy Question'}
            </button>
          </div>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{
        __html: `
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #cbd5e1; }
      `}} />
    </div>
  );

  return createPortal(modalContent, document.body);
}

const LanguageToggle = ({ label, checked, onChange, color }) => (
  <label className="flex items-center justify-between cursor-pointer group bg-white border border-slate-100 px-4 py-2.5 rounded-xl hover:border-slate-200 transition-all">
    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{label}</span>
    <div className="relative">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="sr-only peer"
      />
      <div className={`w-10 h-6 bg-slate-200 rounded-full peer ${color} transition-all after:content-[''] after:absolute after:top-1 after:left-1 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-4 shadow-inner`} />
    </div>
  </label>
);

const MetricInput = ({ label, value, onChange, icon }) => (
  <div className="space-y-2">
    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1 flex items-center gap-1.5">
      {icon}
      {label}
    </label>
    <input
      type="number"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-indigo-500/5 focus:bg-white transition-all outline-none"
      required
    />
  </div>
);

const EvaluationCard = ({ title, description, value, onChange, color }) => (
  <div className={`p-6 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col items-center text-center space-y-4 ${color.split(' ')[0]}`}>
    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black ${color}`}>
      %
    </div>
    <div>
      <h5 className="font-black text-slate-900 text-sm uppercase tracking-tight">{title}</h5>
      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">{description}</p>
    </div>
    <div className="relative group w-full">
      <input
        type="number"
        max="100"
        min="0"
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-center font-black text-slate-900 focus:ring-4 focus:ring-indigo-500/5 transition-all outline-none"
      />
      <div className="absolute inset-y-0 right-4 flex items-center text-slate-300 font-black text-xs pointer-events-none">%</div>
    </div>
  </div>
);
