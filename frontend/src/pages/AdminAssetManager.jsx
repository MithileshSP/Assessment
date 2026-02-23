import React, { useState, useEffect, useRef } from 'react';
import SaaSLayout from '../components/SaaSLayout';
import api, { BASE_URL } from '../services/api';
import {
    Image as ImageIcon,
    Plus,
    Upload,
    Copy,
    Trash2,
    Eye,
    Search,
    RefreshCw,
    X,
    Filter,
    CheckCircle,
    AlertCircle,
    FileImage,
    ExternalLink,
    ChevronRight,
    Loader2
} from 'lucide-react';

const AdminAssetManager = () => {
    const [assets, setAssets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [categories, setCategories] = useState(['images', 'videos']);
    const [selectedCategory, setSelectedCategory] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [uploading, setUploading] = useState(false);
    const [dragActive, setDragActive] = useState(false);
    const [previewAsset, setPreviewAsset] = useState(null);
    const [uploadFeedback, setUploadFeedback] = useState(null); // { success: boolean, message: string }

    const fileInputRef = useRef(null);

    const fetchAssets = async () => {
        try {
            setLoading(true);
            const res = await api.get('/assets', {
                params: selectedCategory ? { category: selectedCategory } : {}
            });
            setAssets(res.data);
        } catch (error) {
            console.error('Failed to load assets', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchCategories = async () => {
        try {
            const res = await api.get('/assets/categories');
            if (res.data && res.data.length > 0) {
                // Merge with defaults and ensure uniqueness
                setCategories(prev => [...new Set([...prev, ...res.data])]);
            }
        } catch (e) {
            console.error('Failed to load categories', e);
        }
    };

    useEffect(() => {
        fetchAssets();
        fetchCategories();
    }, [selectedCategory]);

    const handleFileUpload = async (file) => {
        if (!file) return;

        // Validation
        if (file.size > 10 * 1024 * 1024) {
            setUploadFeedback({ success: false, message: "File too large. Max size is 10MB." });
            return;
        }

        const formData = new FormData();
        // Append text fields FIRST for Multer to access them in 'destination'
        formData.append('category', selectedCategory || 'images');
        formData.append('asset', file);

        try {
            setUploading(true);
            setUploadFeedback(null);
            const res = await api.post('/assets/upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setUploadFeedback({ success: true, message: `Uploaded ${file.name} successfully.` });
            fetchAssets();
        } catch (error) {
            setUploadFeedback({
                success: false,
                message: error.response?.data?.error || "Failed to upload file."
            });
        } finally {
            setUploading(false);
        }
    };

    const handleDelete = async (filename) => {
        if (!window.confirm("Are you sure you want to delete this asset? This cannot be undone and may break questions using it.")) return;

        try {
            await api.delete(`/assets/${filename}`);
            setAssets(prev => prev.filter(a => a.filename !== filename));
        } catch (error) {
            alert("Failed to delete asset");
        }
    };

    const copyToClipboard = (text) => {
        const fullUrl = text.startsWith('http') ? text : `${window.location.origin}${text}`;
        navigator.clipboard.writeText(fullUrl);
        // Temporary feedback would be nice, but simple alert for now or micro-toast
        alert("Public URL copied to clipboard!");
    };

    const handleDrag = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") {
            setDragActive(true);
        } else if (e.type === "dragleave") {
            setDragActive(false);
        }
    };

    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleFileUpload(e.dataTransfer.files[0]);
        }
    };

    const filteredAssets = assets.filter(a => {
        const name = a?.original_name || '';
        const fname = a?.filename || '';
        const search = searchQuery?.toLowerCase() || '';
        return name.toLowerCase().includes(search) || fname.toLowerCase().includes(search);
    });

    const getPreviewUrl = (asset) => {
        if (asset.url.startsWith('http')) return asset.url;
        // If relative, prepend BASE_URL or proxy path
        // In this project, assets are served at /assets/
        return asset.url;
    };

    const formatSize = (bytes) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    return (
        <SaaSLayout>
            <div className="min-h-screen bg-[#F8FAFC]/30 -m-4 md:-m-8 p-4 md:p-8 font-sans antialiased text-slate-900">
                {/* --- Premium Header Section --- */}
                <div className="max-w-7xl mx-auto mb-10">
                    <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 pb-10 border-b border-slate-200/60">
                        <div className="text-left">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-10 h-10 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-200">
                                    <ImageIcon size={20} />
                                </div>
                                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-600 bg-blue-50 px-3 py-1.5 rounded-full">
                                    Asset Manager • Persistent Cloud Storage
                                </span>
                            </div>
                            <h1 className="text-3xl md:text-4xl lg:text-5xl font-black tracking-tight text-slate-900 mb-2">
                                Media Library
                            </h1>
                            <p className="text-slate-500 font-medium text-sm md:text-lg max-w-2xl">
                                Central repository for images and multimedia assets used across test challenges.
                            </p>
                        </div>

                        <div className="flex items-center gap-3 w-full lg:w-auto">
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                disabled={uploading}
                                className="w-full lg:w-auto px-6 md:px-8 py-3 md:py-4 bg-slate-900 text-white rounded-2xl font-black text-sm tracking-tight transition-all hover:bg-blue-600 shadow-xl shadow-slate-200 flex items-center justify-center gap-2"
                            >
                                {uploading ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
                                <span>{uploading ? 'Processing...' : 'Upload New Asset'}</span>
                            </button>
                            <input
                                type="file"
                                ref={fileInputRef}
                                className="hidden"
                                onChange={(e) => handleFileUpload(e.target.files[0])}
                                accept="image/*,video/*"
                            />
                        </div>
                    </div>
                </div>

                {/* --- Main Dashboard Area --- */}
                <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">

                    {/* Left Sidebar: Filters & Stats */}
                    <div className="lg:col-span-3 space-y-6">
                        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm text-left">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                                    <Filter size={14} className="text-blue-600" />
                                    Categories
                                </h3>
                                <div className="w-8 h-8 bg-slate-50 rounded-lg flex items-center justify-center text-slate-400">
                                    {categories.length}
                                </div>
                            </div>
                            <div className="space-y-2">
                                <button
                                    onClick={() => setSelectedCategory(null)}
                                    className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-xs font-black transition-all ${!selectedCategory ? 'bg-blue-600 text-white shadow-lg shadow-blue-100' : 'text-slate-500 hover:bg-slate-50'}`}
                                >
                                    <span>All Assets</span>
                                    <ChevronRight size={14} className={!selectedCategory ? 'text-white/60' : 'text-slate-300'} />
                                </button>
                                {categories.map(cat => (
                                    <button
                                        key={cat}
                                        onClick={() => setSelectedCategory(cat)}
                                        className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-xs font-black transition-all ${selectedCategory === cat ? 'bg-blue-600 text-white shadow-lg shadow-blue-100' : 'text-slate-500 hover:bg-slate-50'}`}
                                    >
                                        <span className="capitalize">{cat}</span>
                                        <ChevronRight size={14} className={selectedCategory === cat ? 'text-white/60' : 'text-slate-300'} />
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="bg-blue-600 p-8 rounded-[2rem] text-white text-left relative overflow-hidden">
                            <div className="absolute top-[-20px] right-[-20px] w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
                            <span className="text-xs font-bold text-white/50 uppercase tracking-widest block mb-4">Storage Usage</span>
                            <div className="text-3xl font-black mb-2">{assets.length} <span className="text-sm font-medium text-white/60">Files</span></div>
                            <p className="text-white/70 text-xs font-medium leading-relaxed">
                                Assets are stored persistently using Docker volumes on the host server.
                            </p>
                        </div>

                        {uploadFeedback && (
                            <div className={`p-6 rounded-[2rem] border animate-fade-in text-left flex items-start gap-4 ${uploadFeedback.success ? 'bg-emerald-50 border-emerald-100 text-emerald-800' : 'bg-rose-50 border-rose-100 text-rose-800'}`}>
                                {uploadFeedback.success ? <CheckCircle size={24} className="text-emerald-500 flex-shrink-0" /> : <AlertCircle size={24} className="text-rose-500 flex-shrink-0" />}
                                <div>
                                    <h4 className="font-black text-sm uppercase tracking-widest mb-1">{uploadFeedback.success ? 'Success' : 'Attention'}</h4>
                                    <p className="text-xs font-medium opacity-90">{uploadFeedback.message}</p>
                                </div>
                                <button onClick={() => setUploadFeedback(null)} className="ml-auto opacity-40 hover:opacity-100 transition-opacity">
                                    <X size={16} />
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Right Content: Listing Area */}
                    <div className="lg:col-span-9 space-y-6">
                        {/* Search & Bulk Section */}
                        <div className="bg-white p-4 rounded-[1.5rem] border border-slate-100 shadow-sm flex flex-col md:flex-row gap-4 items-center">
                            <div className="relative flex-1 group w-full">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
                                <input
                                    type="text"
                                    placeholder="Search assets by name or ID..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full pl-12 pr-6 py-4 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:outline-none focus:bg-white focus:border-blue-600 transition-all placeholder:text-slate-300"
                                />
                            </div>
                            <button
                                onClick={fetchAssets}
                                className="px-4 py-2 text-[10px] font-bold text-blue-400 hover:text-blue-300 uppercase tracking-widest transition-all rounded-lg hover:bg-blue-500/5 flex items-center gap-2"
                            >
                                <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                                Sync
                            </button>
                        </div>

                        {/* Drag and Drop Zone */}
                        <div
                            onDragEnter={handleDrag}
                            onDragLeave={handleDrag}
                            onDragOver={handleDrag}
                            onDrop={handleDrop}
                            className={`relative border-2 border-dashed rounded-[2.5rem] p-12 text-center transition-all duration-300 ${dragActive ? 'border-blue-600 bg-blue-50/50 scale-[1.01] shadow-xl shadow-blue-100/50' : 'border-slate-200 bg-white hover:border-blue-300 hover:bg-slate-50/50'}`}
                        >
                            <div className="w-20 h-20 bg-blue-50 rounded-[2rem] flex items-center justify-center text-blue-600 mx-auto mb-6 shadow-sm border border-blue-100">
                                <Upload size={32} />
                            </div>
                            <h3 className="text-xl font-black text-slate-900 mb-2">Drop assets here to upload</h3>
                            <p className="text-slate-400 text-sm font-medium max-w-sm mx-auto mb-6">
                                Supports JPG, PNG, WEBP, and GIF up to <span className="text-blue-600 font-bold">10MB</span> per file.
                            </p>
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="px-8 py-3 bg-white border-2 border-slate-100 text-slate-600 rounded-xl font-black text-xs uppercase tracking-widest hover:border-blue-600 hover:text-blue-600 transition-all shadow-sm"
                            >
                                Select from computer
                            </button>
                            {dragActive && (
                                <div className="absolute inset-0 z-10 rounded-[2.5rem] flex items-center justify-center bg-blue-600/10 backdrop-blur-[2px]">
                                    <div className="bg-white px-8 py-4 rounded-2xl shadow-2xl font-black text-blue-600 flex items-center gap-3 animate-bounce">
                                        <Plus size={20} />
                                        Drop to add to {selectedCategory || 'images'}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Grid View */}
                        {loading ? (
                            <div className="py-20 flex flex-col items-center justify-center gap-4 bg-white rounded-[2.5rem] border border-slate-100 shadow-sm">
                                <div className="w-12 h-12 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin"></div>
                                <span className="text-slate-400 font-bold text-[10px] uppercase tracking-[0.2em]">Accessing media vault...</span>
                            </div>
                        ) : filteredAssets.length === 0 ? (
                            <div className="py-32 flex flex-col items-center justify-center gap-6 bg-white rounded-[2.5rem] border border-slate-100 shadow-sm">
                                <div className="w-24 h-24 bg-slate-50 rounded-[3rem] flex items-center justify-center text-slate-200 border border-slate-100">
                                    <FileImage size={48} />
                                </div>
                                <div className="text-center">
                                    <h3 className="text-xl font-black text-slate-400">Library is empty</h3>
                                    <p className="text-slate-400 text-xs font-medium mt-2 max-w-xs uppercase tracking-widest">No assets found in {selectedCategory || 'this collection'}</p>
                                </div>
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6 pb-20">
                                {filteredAssets.map(asset => (
                                    <div key={asset.filename} className="group relative bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden hover:shadow-2xl hover:shadow-blue-200/50 hover:-translate-y-2 transition-all duration-500 text-left">
                                        {/* Image Preview Container */}
                                        <div className="aspect-square bg-slate-50 relative overflow-hidden flex items-center justify-center">
                                            {(asset?.type || '').startsWith('image/') ? (
                                                <img
                                                    src={getPreviewUrl(asset)}
                                                    alt={asset.original_name}
                                                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                                                    onError={(e) => {
                                                        e.target.onerror = null;
                                                        e.target.src = 'https://placehold.co/400x400/indigo/white?text=Preview+Unavailable';
                                                    }}
                                                />
                                            ) : (
                                                <div className="flex flex-col items-center gap-3 text-slate-300">
                                                    <FileImage size={40} />
                                                    <span className="text-[10px] font-black uppercase tracking-widest">{(asset?.type || 'unknown/file').split('/')[1]}</span>
                                                </div>
                                            )}

                                            {/* Hover Toolbar */}
                                            <div className="absolute inset-x-4 bottom-4 flex justify-between gap-2 translate-y-20 group-hover:translate-y-0 transition-transform duration-500 z-10">
                                                <button
                                                    onClick={() => copyToClipboard(asset.url)}
                                                    className="flex-1 py-3 bg-white/95 backdrop-blur-md rounded-xl shadow-2xl flex items-center justify-center text-slate-700 hover:text-blue-600 transition-colors"
                                                    title="Copy Public URL"
                                                >
                                                    <Copy size={16} />
                                                </button>
                                                <button
                                                    onClick={() => setPreviewAsset(asset)}
                                                    className="flex-1 py-3 bg-blue-600 rounded-xl shadow-2xl shadow-blue-200 flex items-center justify-center text-white hover:bg-blue-700 transition-colors"
                                                    title="Quick Preview"
                                                >
                                                    <Eye size={16} />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(asset.filename)}
                                                    className="flex-1 py-3 bg-rose-50 text-rose-500 rounded-xl hover:bg-rose-100 transition-colors"
                                                    title="Delete Asset"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>

                                            {/* Gradient Overlay for better readability */}
                                            <div className="absolute inset-0 bg-gradient-to-t from-slate-900/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
                                        </div>

                                        {/* Asset Info Card */}
                                        <div className="p-5">
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="text-[9px] font-black text-blue-600 bg-blue-50 px-2 py-1 rounded-md uppercase tracking-widest">
                                                    {asset.category}
                                                </span>
                                                <span className="text-[10px] font-bold text-slate-400">
                                                    {formatSize(asset.size)}
                                                </span>
                                            </div>
                                            <h4 className="text-sm font-black text-slate-900 truncate mb-1" title={asset.original_name}>
                                                {asset.original_name}
                                            </h4>
                                            <p className="text-[10px] font-medium text-slate-400 truncate">
                                                {new Date(asset.uploaded_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* --- Asset Preview Modal --- */}
                {previewAsset && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <div
                            className="absolute inset-0 bg-slate-900/60 backdrop-blur-md transition-opacity duration-300"
                            onClick={() => setPreviewAsset(null)}
                        />
                        <div className="relative bg-white w-full max-w-4xl rounded-[3rem] shadow-2xl overflow-hidden animate-zoom-in text-left">
                            <button
                                onClick={() => setPreviewAsset(null)}
                                className="absolute top-8 right-8 w-12 h-12 bg-white rounded-2xl border border-slate-100 flex items-center justify-center text-slate-400 hover:text-rose-500 hover:rotate-90 transition-all z-20"
                            >
                                <X size={24} />
                            </button>

                            <div className="grid grid-cols-1 md:grid-cols-2">
                                <div className="bg-slate-50 flex items-center justify-center p-12 min-h-[400px]">
                                    {(previewAsset?.type || '').startsWith('image/') ? (
                                        <img
                                            src={getPreviewUrl(previewAsset)}
                                            alt="Preview"
                                            className="max-w-full max-h-[500px] rounded-3xl shadow-2xl object-scale-down"
                                        />
                                    ) : (
                                        <div className="flex flex-col items-center gap-4 text-slate-200">
                                            <FileImage size={120} />
                                            <span className="text-xl font-black uppercase tracking-widest text-slate-300">No Preview</span>
                                        </div>
                                    )}
                                </div>
                                <div className="p-10 md:p-12 flex flex-col">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-6">
                                            <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 shadow-sm">
                                                <FileImage size={24} />
                                            </div>
                                            <div>
                                                <h3 className="text-xl font-black text-slate-900 tracking-tight">Asset Specification</h3>
                                                <p className="text-slate-400 font-bold text-[10px] uppercase tracking-widest mt-1">Digital Resource Metadata</p>
                                            </div>
                                        </div>

                                        <div className="space-y-6">
                                            <div>
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Canonical Name</label>
                                                <p className="text-sm font-bold text-slate-900 break-all bg-slate-50 p-3 rounded-xl border border-slate-100">{previewAsset.original_name}</p>
                                            </div>
                                            <div className="grid grid-cols-2 gap-6">
                                                <div>
                                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">MIME Type</label>
                                                    <p className="text-sm font-bold text-slate-700 capitalize">{(previewAsset?.type || 'unknown/file').split('/')[1]}</p>
                                                </div>
                                                <div>
                                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">File Size</label>
                                                    <p className="text-sm font-bold text-slate-700">{formatSize(previewAsset.size)}</p>
                                                </div>
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Public Access Path</label>
                                                <div className="flex items-center gap-2 group cursor-pointer" onClick={() => copyToClipboard(previewAsset.url)}>
                                                    <div className="flex-1 text-[11px] font-mono text-blue-600 bg-blue-50/50 p-4 rounded-xl border border-blue-100 group-hover:border-blue-400 transition-colors truncate">
                                                        {previewAsset.url}
                                                    </div>
                                                    <div className="w-14 h-14 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-100 group-hover:scale-105 transition-transform">
                                                        <Copy size={20} />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="pt-10 flex items-center gap-4">
                                        <a
                                            href={getPreviewUrl(previewAsset)}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex-1 py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-slate-800 transition-all"
                                        >
                                            <ExternalLink size={16} />
                                            Open Full Res
                                        </a>
                                        <button
                                            onClick={() => handleDelete(previewAsset.filename)}
                                            className="px-6 py-4 bg-rose-50 text-rose-500 rounded-2xl font-bold hover:bg-rose-100 transition-all"
                                        >
                                            <Trash2 size={20} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* --- Global Utility Styles --- */}
            <style dangerouslySetInnerHTML={{
                __html: `
                @keyframes fade-in {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                @keyframes zoom-in {
                    from { opacity: 0; transform: scale(0.95) translateY(20px); }
                    to { opacity: 1; transform: scale(1) translateY(0); }
                }
                .animate-fade-in { animation: fade-in 0.4s ease-out forwards; }
                .animate-zoom-in { animation: zoom-in 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
                .hide-scrollbar::-webkit-scrollbar { width: 0px; background: transparent; }
                .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
            `}} />
        </SaaSLayout>
    );
};

export default AdminAssetManager;
