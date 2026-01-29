import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Editor from "@monaco-editor/react";
import {
    X,
    Save,
    Plus,
    Settings,
    Shield,
    Clock,
    Zap,
    Target,
    Code,
    Maximize2,
    Minimize2,
    Image as ImageIcon,
    Link,
    HelpCircle,
    Layers,
    ArrowLeft,
    Check,
    Tag as TagIcon,
    AlertCircle
} from "lucide-react";
import SaaSLayout from "../components/SaaSLayout";
import * as api from "../services/api";

export default function QuestionEditor() {
    const { courseId, questionId } = useParams();
    const navigate = useNavigate();
    const isEdit = !!questionId;

    const [loading, setLoading] = useState(isEdit);
    const [saving, setSaving] = useState(false);
    const [activeQuestionType, setActiveQuestionType] = useState("html-css"); // 'html-css' | 'mcq'

    const [formData, setFormData] = useState({
        id: "",
        title: "",
        description: "",
        instructions: "",
        level: 1,
        questionNumber: 1,
        points: 100,
        tags: "",
        hasHtml: true,
        hasCss: true,
        hasJs: false,
        hints: "",
        isLocked: false,
        assetImages: "",
        assetReference: "",
        expectedSolutionHtml: "",
        expectedSolutionCss: "",
        expectedSolutionJs: "",
    });

    useEffect(() => {
        if (isEdit) {
            fetchQuestion();
        } else {
            const timestamp = Date.now();
            const newId = `${courseId}-l${formData.level}-q${timestamp}`;
            setFormData((prev) => ({ ...prev, id: newId }));
        }
    }, [courseId, questionId]);

    const fetchQuestion = async () => {
        try {
            setLoading(true);
            const res = await api.getCourseQuestions(courseId);
            const question = res.data.find((q) => q.id === questionId);

            if (question) {
                let imagePaths = "";
                if (Array.isArray(question.assets)) {
                    imagePaths = question.assets
                        .map((a) => (typeof a === "string" ? a : a.path))
                        .join("\n");
                } else if (question.assets?.images) {
                    imagePaths = question.assets.images
                        .map((img) => img.path || img)
                        .join("\n");
                }

                const tagsArray = Array.isArray(question.tags) ? question.tags : [];
                const hasHtml = tagsArray.some((t) => t.toLowerCase() === "html");
                const hasCss = tagsArray.some((t) => t.toLowerCase() === "css");
                const hasJs = tagsArray.some((t) => t.toLowerCase() === "js");
                const otherTags = tagsArray
                    .filter((t) => !["html", "css", "js"].includes(t.toLowerCase()))
                    .join(", ");

                setFormData({
                    id: question.id || "",
                    title: question.title || "",
                    description: question.description || "",
                    instructions: question.instructions || "",
                    level: question.level || 1,
                    questionNumber: question.questionNumber || 1,
                    points: question.points || 100,
                    tags: otherTags,
                    hasHtml: hasHtml || (!hasHtml && !hasCss && !hasJs),
                    hasCss: hasCss,
                    hasJs: hasJs,
                    hints: Array.isArray(question.hints) ? question.hints.join("\n") : "",
                    isLocked: question.isLocked || false,
                    assetImages: imagePaths,
                    assetReference: question.assets?.reference || "",
                    expectedSolutionHtml: question.expectedSolution?.html || "",
                    expectedSolutionCss: question.expectedSolution?.css || "",
                    expectedSolutionJs: question.expectedSolution?.js || "",
                });
            }
        } catch (error) {
            console.error("Error fetching question:", error);
            alert("Failed to load question data.");
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        try {
            setSaving(true);
            const imagePaths = formData.assetImages
                .split("\n")
                .map((path) => path.trim())
                .filter((path) => path);

            const assetImages = imagePaths.map((path) => {
                const filename = path.split("/").pop();
                return { name: filename, path, description: `${filename} image` };
            });

            const questionData = {
                ...formData,
                tags: [
                    ...(formData.hasHtml ? ["HTML"] : []),
                    ...(formData.hasCss ? ["CSS"] : []),
                    ...(formData.hasJs ? ["JS"] : []),
                    ...formData.tags.split(",").map(t => t.trim()).filter(t => t && !['html', 'css', 'js'].includes(t.toLowerCase()))
                ],
                hints: formData.hints.split("\n").filter(h => h.trim()),
                expectedSolution: {
                    html: formData.expectedSolutionHtml,
                    css: formData.expectedSolutionCss,
                    js: formData.expectedSolutionJs,
                },
                assets: { images: assetImages, reference: "" },
            };

            if (isEdit) {
                await api.updateQuestion(questionId, questionData);
            } else {
                await api.createQuestion(courseId, questionData);
            }
            navigate(`/admin/course/${courseId}/questions`);
        } catch (error) {
            console.error("Error saving question:", error);
            alert("Failed to save question.");
        } finally {
            setSaving(false);
        }
    };

    const handleExtractAssets = () => {
        const html = formData.expectedSolutionHtml || "";
        const css = formData.expectedSolutionCss || "";
        const combined = html + css;
        const regex = /(?:src=["']|url\(["']?)([^"')]+\.(?:png|jpg|jpeg|gif|svg|webp))["')]/gi;
        const matches = [...combined.matchAll(regex)];
        const uniquePaths = new Set(formData.assetImages.split("\n").map(p => p.trim()).filter(p => p));

        matches.forEach((match) => {
            let path = match[1];
            if (!path.startsWith("http") && !path.startsWith("/") && !path.startsWith("assets")) {
                path = `/assets/images/${path.replace(/^(\.\/)?(images\/)?/, "")}`;
            } else if (path.startsWith("images/")) {
                path = `/assets/${path}`;
            }
            uniquePaths.add(path);
        });

        setFormData({ ...formData, assetImages: Array.from(uniquePaths).join("\n") });
        alert(`Detected ${uniquePaths.size} assets.`);
    };

    if (loading) return (
        <SaaSLayout>
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-600"></div>
            </div>
        </SaaSLayout>
    );

    return (
        <SaaSLayout>
            <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 pb-12 space-y-8 text-left">
                {/* Breadcrumbs & Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-6">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            <span className="hover:text-indigo-600 cursor-pointer" onClick={() => navigate(`/admin/course/${courseId}/questions`)}>Question Bank</span>
                            <ArrowLeft size={10} />
                            <span className="text-indigo-600">Edit Question</span>
                        </div>
                        <h1 className="text-2xl font-black text-slate-900 tracking-tight">Edit Question</h1>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => navigate(`/admin/course/${courseId}/questions`)}
                            className="px-6 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold hover:bg-slate-50 transition-all text-xs uppercase tracking-widest"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="flex items-center gap-2 px-8 py-2.5 bg-indigo-600 text-white rounded-xl font-black hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 text-xs uppercase tracking-widest disabled:opacity-50"
                        >
                            <Save size={16} /> {saving ? "Saving..." : "Save Question"}
                        </button>
                    </div>
                </div>

                {/* Question Type Label (Simplified) */}
                <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] block pl-1">Question Type: HTML/CSS Challenge</label>
                </div>

                {/* Form Sections */}
                <div className="space-y-8">
                    {/* Title Section */}
                    <div className="bg-white p-1 border border-slate-200 rounded-xl shadow-sm">
                        <div className="px-6 pt-6 pb-2">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] block mb-2">Problem Title <span className="text-rose-500">*</span></label>
                        </div>
                        <div className="px-6 pb-6">
                            <input
                                type="text"
                                value={formData.title}
                                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold focus:ring-2 focus:ring-indigo-500/20 focus:bg-white transition-all outline-none"
                                placeholder="Structural Webpage with Divs"
                            />
                        </div>
                    </div>

                    {/* Description Section */}
                    <div className="bg-white p-1 border border-slate-200 rounded-xl shadow-sm">
                        <div className="px-6 pt-6 pb-2">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] block mb-2">Question Description <span className="text-rose-500">*</span></label>
                        </div>
                        <div className="px-6 pb-6">
                            <textarea
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-indigo-500/20 focus:bg-white transition-all outline-none min-h-[100px]"
                                placeholder="Create a webpage with a main <div> that contains a heading and two paragraphs..."
                            />
                        </div>
                    </div>

                    {/* Instructions Section */}
                    <div className="bg-white p-1 border border-slate-200 rounded-xl shadow-sm">
                        <div className="px-6 pt-6 pb-2">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] block mb-2">Instructions / Technical Requirements</label>
                        </div>
                        <div className="px-6 pb-6">
                            <textarea
                                value={formData.instructions}
                                onChange={(e) => setFormData({ ...formData, instructions: e.target.value })}
                                className="w-full px-4 py-3 bg-[#0f172a] text-indigo-100 border-none rounded-lg font-mono text-xs focus:ring-2 focus:ring-indigo-500/20 transition-all outline-none min-h-[150px] leading-relaxed"
                                placeholder="Enter specific tasks or constraints (e.g. use Flexbox, center the content)..."
                            />
                        </div>
                    </div>

                    {/* Code Editors */}
                    <div className="space-y-6">
                        {/* HTML */}
                        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                            <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-orange-500 shadow-lg shadow-orange-200" />
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Expected HTML Code <span className="text-rose-500">*</span></label>
                            </div>
                            <div className="h-[300px] border-b border-slate-200">
                                <Editor
                                    height="100%"
                                    language="html"
                                    value={formData.expectedSolutionHtml}
                                    onChange={(v) => setFormData({ ...formData, expectedSolutionHtml: v })}
                                    theme="vs-light"
                                    options={{ minimap: { enabled: false }, fontSize: 13, automaticLayout: true, tabSize: 2 }}
                                />
                            </div>
                        </div>

                        {/* CSS */}
                        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                            <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-blue-500 shadow-lg shadow-blue-200" />
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Expected CSS Code</label>
                            </div>
                            <div className="h-[300px] border-b border-slate-200">
                                <Editor
                                    height="100%"
                                    language="css"
                                    value={formData.expectedSolutionCss}
                                    onChange={(v) => setFormData({ ...formData, expectedSolutionCss: v })}
                                    theme="vs-light"
                                    options={{ minimap: { enabled: false }, fontSize: 13, automaticLayout: true, tabSize: 2 }}
                                />
                            </div>
                        </div>

                        {/* JS */}
                        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                            <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-yellow-500 shadow-lg shadow-yellow-200" />
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Expected JavaScript Code</label>
                            </div>
                            <div className="h-[300px] border-b border-slate-200">
                                <Editor
                                    height="100%"
                                    language="javascript"
                                    value={formData.expectedSolutionJs}
                                    onChange={(v) => setFormData({ ...formData, expectedSolutionJs: v })}
                                    theme="vs-light"
                                    options={{ minimap: { enabled: false }, fontSize: 13, automaticLayout: true, tabSize: 2 }}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Assets Section */}
                    <div className="bg-white border border-slate-200 rounded-xl shadow-sm">
                        <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-lg shadow-emerald-200" />
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Image Assets</label>
                            </div>
                            <button
                                onClick={handleExtractAssets}
                                className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-emerald-700 transition-all"
                            >
                                <Plus size={12} /> Add Asset
                            </button>
                        </div>
                        <div className="p-6">
                            <textarea
                                value={formData.assetImages}
                                onChange={(e) => setFormData({ ...formData, assetImages: e.target.value })}
                                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono focus:ring-2 focus:ring-emerald-500/20 transition-all outline-none min-h-[80px]"
                                placeholder="No assets defined. Click 'Add Asset' to edit image references."
                            />
                            <p className="text-[10px] text-slate-400 mt-2 font-medium italic">Define images that students can use in their HTML code (e.g., logo.png, hero.jpg)</p>
                        </div>
                    </div>

                    {/* Additional Parameters (Integrated in professional UI) */}
                    <div className="bg-slate-50 p-8 rounded-xl border border-slate-200 grid grid-cols-1 md:grid-cols-4 gap-6">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-1">Level</label>
                            <select
                                value={formData.level}
                                onChange={(e) => setFormData({ ...formData, level: parseInt(e.target.value) })}
                                className="w-full px-4 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold focus:ring-2 focus:ring-indigo-500/20 transition-all outline-none"
                            >
                                {[...Array(15)].map((_, i) => <option key={i + 1} value={i + 1}>Level {i + 1}</option>)}
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-1">Points</label>
                            <input
                                type="number"
                                value={formData.points}
                                onChange={(e) => setFormData({ ...formData, points: parseInt(e.target.value) })}
                                className="w-full px-4 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold focus:ring-2 focus:ring-indigo-500/20 transition-all outline-none"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-1">Tags</label>
                            <input
                                type="text"
                                value={formData.tags}
                                onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                                className="w-full px-4 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold focus:ring-2 focus:ring-indigo-500/20 transition-all outline-none"
                                placeholder="Flex, Grid, Layout"
                            />
                        </div>
                        <div className="flex items-end pb-1">
                            <label className="flex items-center gap-2 cursor-pointer select-none">
                                <input
                                    type="checkbox"
                                    checked={formData.isLocked}
                                    onChange={(e) => setFormData({ ...formData, isLocked: e.target.checked })}
                                    className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                />
                                <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Enforce Hierarchy</span>
                            </label>
                        </div>
                    </div>
                </div>

                {/* Footer info/tip */}
                <div className="pt-8 border-t border-slate-200">
                    <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100 flex items-start gap-3">
                        <AlertCircle className="text-indigo-600 shrink-0" size={16} />
                        <p className="text-[10px] text-indigo-700 leading-relaxed font-bold uppercase tracking-wider">
                            HTML/CSS Challenge Mode: Students will solve HTML, CSS, and JS code to match the expected output. The expected code above serves as the reference solution.
                        </p>
                    </div>
                </div>
            </div>
        </SaaSLayout>
    );
}
