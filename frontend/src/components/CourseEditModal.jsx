import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Save, Plus, Layers, Clock, Zap, Image, Palette, Tag, BookOpen, Shield, Link } from 'lucide-react';
import { getCourses } from '../services/api';

export default function CourseEditModal({ course, onClose, onSave }) {
  const [formData, setFormData] = useState(course || {
    id: '',
    title: '',
    description: '',
    icon: '📚',
    color: '#6366f1',
    thumbnail: 'https://images.unsplash.com/photo-1633356122544-f134324a6cee?w=800&q=80',
    difficulty: 'Beginner',
    totalLevels: 6,
    estimatedTime: '10 hours',
    orderIndex: null,
    tags: [],
    prerequisiteCourseId: null,
    restrictions: {
      blockCopy: false,
      blockPaste: false,
      forceFullscreen: false,
      maxViolations: 3,
      timeLimit: 0
    }
  });
  const [tagInput, setTagInput] = useState('');
  const [availableCourses, setAvailableCourses] = useState([]);

  // Fetch available courses for prerequisite dropdown
  useEffect(() => {
    const fetchCourses = async () => {
      try {
        const response = await getCourses();
        // Filter out the current course to prevent self-referencing
        setAvailableCourses(response.data.filter(c => c.id !== course?.id));
      } catch (error) {
        console.error('Failed to load courses for prerequisite dropdown:', error);
      }
    };
    fetchCourses();
  }, [course?.id]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    if (type === 'checkbox') {
      if (name.startsWith('restriction_')) {
        const key = name.replace('restriction_', '');
        setFormData(prev => ({
          ...prev,
          restrictions: {
            ...prev.restrictions,
            [key]: checked
          }
        }));
      } else {
        setFormData(prev => ({ ...prev, [name]: checked }));
      }
    } else if (name.startsWith('restriction_num_')) {
      const key = name.replace('restriction_num_', '');
      setFormData(prev => ({
        ...prev,
        restrictions: {
          ...prev.restrictions,
          [key]: parseInt(value) || 0
        }
      }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleAddTag = () => {
    if (tagInput.trim() && !formData.tags.includes(tagInput.trim())) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, tagInput.trim()]
      }));
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
  };

  const difficultyColors = {
    Beginner: 'bg-emerald-500',
    Intermediate: 'bg-amber-500',
    Advanced: 'bg-rose-500'
  };

  const modalContent = (
    <div className="fixed inset-0 bg-gradient-to-br from-slate-900/80 to-indigo-900/80 backdrop-blur-md flex items-center justify-center p-6" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 99999 }}>
      <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-5xl max-h-[90vh] flex overflow-hidden">

        {/* Left Panel - Live Preview */}
        <div className="w-80 bg-gradient-to-br from-slate-900 to-indigo-950 p-8 flex flex-col hidden lg:flex">
          <div className="mb-8">
            <h3 className="text-white text-lg font-bold mb-1">Live Preview</h3>
            <p className="text-indigo-300 text-xs">See how students will view this course</p>
          </div>

          {/* Preview Card */}
          <div className="bg-white rounded-2xl overflow-hidden shadow-2xl flex-1 flex flex-col max-h-[400px]">
            <div
              className="h-32 flex items-center justify-center relative"
              style={{ backgroundColor: formData.color }}
            >
              <span className="text-5xl filter drop-shadow-lg">{formData.icon || '📚'}</span>
              <div className={`absolute top-3 left-3 px-2 py-0.5 ${difficultyColors[formData.difficulty]} text-white text-[10px] font-bold uppercase rounded`}>
                {formData.difficulty}
              </div>
            </div>
            <div className="p-5 flex-1 flex flex-col">
              <h4 className="font-bold text-slate-900 text-sm mb-2 line-clamp-2">
                {formData.title || 'Course Title'}
              </h4>
              <p className="text-slate-500 text-xs mb-4 line-clamp-3 flex-1">
                {formData.description || 'Course description will appear here...'}
              </p>
              <div className="flex items-center gap-4 text-[10px] text-slate-400 font-medium pt-3 border-t border-slate-100">
                <span className="flex items-center gap-1"><Layers size={10} /> {formData.totalLevels} Levels</span>
                <span className="flex items-center gap-1"><Clock size={10} /> {formData.estimatedTime}</span>
              </div>
            </div>
          </div>

          <div className="mt-8 p-4 bg-white/10 rounded-xl">
            <p className="text-indigo-200 text-xs leading-relaxed">
              💡 <strong>Tip:</strong> Use clear, action-oriented titles and concise descriptions for better student engagement.
            </p>
          </div>
        </div>

        {/* Right Panel - Form */}
        <div className="flex-1 flex flex-col">
          {/* Header */}
          <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-indigo-100 flex items-center justify-center">
                <BookOpen className="text-indigo-600" size={24} />
              </div>
              <div>
                <h2 className="text-xl font-black text-slate-900">
                  {course ? 'Edit Level' : 'New Level'}
                </h2>
                <p className="text-slate-400 text-sm">Fill in the details below</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-10 h-10 rounded-full bg-slate-100 text-slate-400 hover:bg-rose-100 hover:text-rose-500 flex items-center justify-center transition-all"
            >
              <X size={20} />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-8">
            <div className="grid grid-cols-2 gap-6">

              {/* Course ID */}
              <div className="col-span-2 sm:col-span-1">
                <label className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                  <span className="w-5 h-5 rounded bg-slate-100 flex items-center justify-center text-[10px] font-black text-slate-400">1</span>
                  Level ID
                </label>
                <input
                  type="text"
                  name="id"
                  value={formData.id}
                  onChange={handleChange}
                  disabled={!!course}
                  required
                  placeholder="level-0"
                  className="w-full px-4 py-3 bg-slate-50 border-2 border-transparent rounded-xl text-sm font-medium focus:border-indigo-500 focus:bg-white outline-none transition-all disabled:opacity-50"
                />
              </div>

              {/* Title */}
              <div className="col-span-2 sm:col-span-1">
                <label className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                  <span className="w-5 h-5 rounded bg-slate-100 flex items-center justify-center text-[10px] font-black text-slate-400">2</span>
                  Title
                </label>
                <input
                  type="text"
                  name="title"
                  value={formData.title}
                  onChange={handleChange}
                  required
                  placeholder="React Fundamentals"
                  className="w-full px-4 py-3 bg-slate-50 border-2 border-transparent rounded-xl text-sm font-medium focus:border-indigo-500 focus:bg-white outline-none transition-all"
                />
              </div>

              {/* Description */}
              <div className="col-span-2">
                <label className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                  <span className="w-5 h-5 rounded bg-slate-100 flex items-center justify-center text-[10px] font-black text-slate-400">3</span>
                  Description
                </label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  required
                  rows="3"
                  placeholder="A comprehensive course covering..."
                  className="w-full px-4 py-3 bg-slate-50 border-2 border-transparent rounded-xl text-sm font-medium focus:border-indigo-500 focus:bg-white outline-none transition-all resize-none"
                />
              </div>

              {/* Visual Settings Row */}
              <div className="col-span-2 grid grid-cols-3 gap-4 p-4 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-2xl">
                <div>
                  <label className="flex items-center gap-1 text-xs font-bold text-indigo-600 mb-2">
                    <Palette size={12} /> Icon
                  </label>
                  <input
                    type="text"
                    name="icon"
                    value={formData.icon}
                    onChange={handleChange}
                    maxLength="2"
                    className="w-full h-14 bg-white border-2 border-indigo-100 rounded-xl text-3xl text-center focus:border-indigo-500 outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="flex items-center gap-1 text-xs font-bold text-indigo-600 mb-2">
                    <Palette size={12} /> Color
                  </label>
                  <div className="h-14 bg-white border-2 border-indigo-100 rounded-xl flex items-center px-3 gap-3">
                    <input
                      type="color"
                      name="color"
                      value={formData.color}
                      onChange={handleChange}
                      className="w-10 h-10 rounded-lg cursor-pointer border-none p-0"
                    />
                    <span className="text-xs font-mono text-slate-400">{formData.color}</span>
                  </div>
                </div>
                <div>
                  <label className="flex items-center gap-1 text-xs font-bold text-indigo-600 mb-2">
                    <Zap size={12} /> Difficulty
                  </label>
                  <select
                    name="difficulty"
                    value={formData.difficulty}
                    onChange={handleChange}
                    className="w-full h-14 bg-white border-2 border-indigo-100 rounded-xl px-3 text-sm font-bold focus:border-indigo-500 outline-none transition-all cursor-pointer"
                  >
                    <option value="Beginner">🟢 Beginner</option>
                    <option value="Intermediate">🟡 Intermediate</option>
                    <option value="Advanced">🔴 Advanced</option>
                  </select>
                </div>
              </div>

              {/* Thumbnail */}
              <div className="col-span-2">
                <label className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                  <Image size={12} /> Thumbnail URL
                </label>
                <input
                  type="text"
                  name="thumbnail"
                  value={formData.thumbnail}
                  onChange={handleChange}
                  placeholder="https://images.unsplash.com/..."
                  className="w-full px-4 py-3 bg-slate-50 border-2 border-transparent rounded-xl text-sm font-medium focus:border-indigo-500 focus:bg-white outline-none transition-all"
                />
              </div>

              {/* Order and Time */}
              <div>
                <label className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                  <Layers size={12} /> Order Index
                </label>
                <input
                  type="number"
                  name="orderIndex"
                  value={formData.orderIndex === null ? '' : formData.orderIndex}
                  onChange={handleChange}
                  min="0"
                  max="9999"
                  placeholder="Auto-assign"
                  className="w-full px-4 py-3 bg-slate-50 border-2 border-transparent rounded-xl text-sm font-medium focus:border-indigo-500 focus:bg-white outline-none transition-all"
                />
              </div>
              <div>
                <label className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                  <Clock size={12} /> Estimated Time
                </label>
                <input
                  type="text"
                  name="estimatedTime"
                  value={formData.estimatedTime}
                  onChange={handleChange}
                  placeholder="10 hours"
                  className="w-full px-4 py-3 bg-slate-50 border-2 border-transparent rounded-xl text-sm font-medium focus:border-indigo-500 focus:bg-white outline-none transition-all"
                />
              </div>

              {/* Prerequisite Course */}
              <div className="col-span-2">
                <label className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                  <Link size={12} /> Prerequisite Level
                </label>
                <select
                  name="prerequisiteCourseId"
                  value={formData.prerequisiteCourseId || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, prerequisiteCourseId: e.target.value || null }))}
                  className="w-full px-4 py-3 bg-slate-50 border-2 border-transparent rounded-xl text-sm font-medium focus:border-indigo-500 focus:bg-white outline-none transition-all cursor-pointer"
                >
                  <option value="">No prerequisite (course visible to all)</option>
                  {availableCourses.map(c => (
                    <option key={c.id} value={c.id}>{c.title}</option>
                  ))}
                </select>
                <p className="text-xs text-slate-400 mt-2">
                  Students must complete all levels of the selected course before this course becomes visible.
                </p>
              </div>

              {/* Tags */}
              <div className="col-span-2">
                <label className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                  <Tag size={12} /> Tags
                </label>
                <div className="flex gap-2 mb-3">
                  <input
                    type="text"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                    placeholder="Type and press Enter"
                    className="flex-1 px-4 py-3 bg-slate-50 border-2 border-transparent rounded-xl text-sm font-medium focus:border-indigo-500 focus:bg-white outline-none transition-all"
                  />
                  <button
                    type="button"
                    onClick={handleAddTag}
                    className="px-5 bg-indigo-100 text-indigo-600 rounded-xl font-bold text-sm hover:bg-indigo-200 transition-all flex items-center gap-2"
                  >
                    <Plus size={16} />
                  </button>
                </div>
                <div className="flex flex-wrap gap-2 min-h-[36px]">
                  {formData.tags.length === 0 && (
                    <span className="text-xs text-slate-400 italic">No tags added yet</span>
                  )}
                  {formData.tags.map((tag, idx) => (
                    <span
                      key={idx}
                      className="px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg text-xs font-bold flex items-center gap-2 group"
                    >
                      {tag}
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(tag)}
                        className="text-indigo-300 hover:text-rose-500 transition-colors"
                      >
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              {/* Exam Restrictions Section */}
              <div className="col-span-2 border-t pt-8 mt-4">
                <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                  <Zap size={20} className="text-amber-500" /> Exam Security & Restrictions
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-6 rounded-[2rem] border border-slate-100">
                  <div className="flex items-center justify-between p-4 bg-white rounded-2xl shadow-sm border border-slate-100">
                    <div>
                      <p className="font-bold text-slate-900 text-sm">Block Copy/Paste</p>
                      <p className="text-[10px] text-slate-400">Strictly prevent content copying</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        name="restriction_blockCopy"
                        className="sr-only peer"
                        checked={formData.restrictions?.blockCopy || false}
                        onChange={handleChange}
                      />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                    </label>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-white rounded-2xl shadow-sm border border-slate-100">
                    <div>
                      <p className="font-bold text-slate-900 text-sm">Enforce Fullscreen</p>
                      <p className="text-[10px] text-slate-400">Force exam mode on start</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        name="restriction_forceFullscreen"
                        className="sr-only peer"
                        checked={formData.restrictions?.forceFullscreen || false}
                        onChange={handleChange}
                      />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                    </label>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-white rounded-2xl shadow-sm border border-slate-100">
                    <div>
                      <p className="font-bold text-slate-900 text-sm">Max Tab Switches</p>
                      <p className="text-[10px] text-slate-400">Attempts before auto-submit</p>
                    </div>
                    <input
                      type="number"
                      name="restriction_num_maxViolations"
                      value={formData.restrictions?.maxViolations || 3}
                      onChange={handleChange}
                      min="1"
                      className="w-16 px-2 py-1 bg-slate-50 border rounded-lg text-sm text-center font-bold outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div className="flex items-center justify-between p-4 bg-white rounded-2xl shadow-sm border border-slate-100">
                    <div>
                      <p className="font-bold text-slate-900 text-sm">Time Limit (Mins)</p>
                      <p className="text-[10px] text-slate-400">0 = Infinite</p>
                    </div>
                    <input
                      type="number"
                      name="restriction_num_timeLimit"
                      value={formData.restrictions?.timeLimit || 0}
                      onChange={handleChange}
                      min="0"
                      className="w-16 px-2 py-1 bg-slate-50 border rounded-lg text-sm text-center font-bold outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>
              </div>

              {/* Evaluation Engine Section */}
              <div className="col-span-2 border-t pt-8 mt-4">
                <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                  <Shield size={20} className="text-indigo-600" /> Global Evaluation Thresholds
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50 p-6 rounded-[2rem] border border-slate-100">
                  <div className="flex flex-col items-center p-4 bg-white rounded-2xl shadow-sm border border-slate-100 gap-2">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Structural Integrity</span>
                    <div className="flex items-center gap-2 w-full">
                      <input
                        type="number"
                        name="threshold_structure"
                        value={formData.passingThreshold?.structure || 80}
                        onChange={(e) => setFormData({
                          ...formData,
                          passingThreshold: { ...formData.passingThreshold, structure: parseInt(e.target.value) || 0 }
                        })}
                        min="0"
                        max="100"
                        className="flex-1 px-2 py-2 bg-slate-50 border rounded-lg text-sm text-center font-black outline-none focus:border-indigo-500"
                      />
                      <span className="text-xs font-bold text-slate-400">%</span>
                    </div>
                  </div>

                  <div className="flex flex-col items-center p-4 bg-white rounded-2xl shadow-sm border border-slate-100 gap-2">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Visual Fidelity</span>
                    <div className="flex items-center gap-2 w-full">
                      <input
                        type="number"
                        name="threshold_visual"
                        value={formData.passingThreshold?.visual || 80}
                        onChange={(e) => setFormData({
                          ...formData,
                          passingThreshold: { ...formData.passingThreshold, visual: parseInt(e.target.value) || 0 }
                        })}
                        min="0"
                        max="100"
                        className="flex-1 px-2 py-2 bg-slate-50 border rounded-lg text-sm text-center font-black outline-none focus:border-indigo-500"
                      />
                      <span className="text-xs font-bold text-slate-400">%</span>
                    </div>
                  </div>

                  <div className="flex flex-col items-center p-4 bg-white rounded-2xl shadow-sm border border-slate-100 gap-2">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Success (Min Pass)</span>
                    <div className="flex items-center gap-2 w-full">
                      <input
                        type="number"
                        name="threshold_overall"
                        value={formData.passingThreshold?.overall || 75}
                        onChange={(e) => setFormData({
                          ...formData,
                          passingThreshold: { ...formData.passingThreshold, overall: parseInt(e.target.value) || 0 }
                        })}
                        min="0"
                        max="100"
                        className="flex-1 px-2 py-2 bg-slate-50 border rounded-lg text-sm text-center font-black outline-none focus:border-indigo-500"
                      />
                      <span className="text-xs font-bold text-slate-400">%</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </form>

          {/* Footer */}
          <div className="px-8 py-5 border-t border-slate-100 flex justify-between items-center bg-slate-50/50">
            <p className="text-xs text-slate-400">* Required fields</p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-3 text-slate-500 font-bold text-sm hover:text-slate-700 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                className="px-8 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-bold flex items-center gap-2 hover:from-indigo-700 hover:to-purple-700 transition-all shadow-lg shadow-indigo-500/25"
              >
                <Save size={18} />
                {course ? 'Save Changes' : 'Create Course'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
