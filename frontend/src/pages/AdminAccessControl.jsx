import React, { useState, useEffect, useCallback } from 'react';
import SaaSLayout from '../components/SaaSLayout';
import api from '../services/api';
import {
    Shield,
    Users,
    CheckCircle,
    XCircle,
    Save,
    Search,
    ChevronRight,
    Lock,
    Unlock,
    AlertCircle
} from 'lucide-react';

const AdminAccessControl = () => {
    const [admins, setAdmins] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedAdmin, setSelectedAdmin] = useState(null);
    const [menuItems, setMenuItems] = useState([]);
    const [permissions, setPermissions] = useState([]);
    const [saving, setSaving] = useState(false);
    const [toast, setToast] = useState(null);
    const [search, setSearch] = useState('');

    const showToast = (msg, type = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3000);
    };

    const loadData = useCallback(async () => {
        try {
            setLoading(true);
            const [usersRes, menuRes] = await Promise.all([
                api.get('/users?role=admin&limit=100'),
                api.get('/admin/menu-items')
            ]);

            // Backend might return { users: [...] } or just [...]
            const adminList = usersRes.data.users || usersRes.data || [];
            setAdmins(adminList);
            setMenuItems(menuRes.data || []);
        } catch (err) {
            showToast('Failed to load data', 'error');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const handleSelectAdmin = async (admin) => {
        setSelectedAdmin(admin);
        try {
            const res = await api.get(`/admin/users/${admin.id}/permissions`);
            setPermissions(res.data.permissions || []);
        } catch (err) {
            showToast('Failed to load permissions', 'error');
        }
    };

    const handleTogglePermission = (id) => {
        setPermissions(prev =>
            prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
        );
    };

    const handleSave = async () => {
        if (!selectedAdmin) return;
        setSaving(true);
        try {
            await api.patch(`/admin/users/${selectedAdmin.id}/permissions`, { permissions });
            showToast('Permissions updated successfully');
            // Update local admin list if needed
            setAdmins(prev => prev.map(a => a.id === selectedAdmin.id ? { ...a, permissions } : a));
        } catch (err) {
            showToast(err.response?.data?.error || 'Failed to update permissions', 'error');
        } finally {
            setSaving(false);
        }
    };

    const filteredAdmins = admins.filter(a =>
        (a.fullName || a.full_name || '').toLowerCase().includes(search.toLowerCase()) ||
        a.username.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <SaaSLayout title="Access Control" subtitle="Manage granular permissions for Admin users">
            {toast && (
                <div className={`fixed top-6 right-6 z-50 px-4 py-3 rounded-xl shadow-lg text-sm font-bold text-white flex items-center gap-2 animate-in fade-in slide-in-from-top-4 ${toast.type === 'error' ? 'bg-rose-600' : 'bg-emerald-600'}`}>
                    {toast.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle size={18} />}
                    {toast.msg}
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 h-full">
                {/* Admin List */}
                <div className="lg:col-span-4 flex flex-col gap-4">
                    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[700px]">
                        <div className="p-6 border-b border-slate-100 bg-slate-50/50">
                            <h3 className="text-lg font-black text-slate-900 flex items-center gap-2 mb-4">
                                <Users size={20} className="text-blue-600" />
                                Administrators
                            </h3>
                            <div className="relative group">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={16} />
                                <input
                                    type="text"
                                    placeholder="Search admins..."
                                    className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-100 outline-none text-sm transition-all"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
                            {loading ? (
                                [1, 2, 3, 4].map(i => <div key={i} className="h-16 bg-slate-50 rounded-2xl animate-pulse" />)
                            ) : filteredAdmins.length === 0 ? (
                                <div className="text-center py-10">
                                    <p className="text-slate-400 text-sm italic">No admins found</p>
                                </div>
                            ) : (
                                filteredAdmins.map(admin => (
                                    <button
                                        key={admin.id}
                                        onClick={() => handleSelectAdmin(admin)}
                                        className={`w-full flex items-center justify-between p-4 rounded-2xl transition-all duration-300 group ${selectedAdmin?.id === admin.id ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'hover:bg-slate-50 text-slate-600'}`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm ${selectedAdmin?.id === admin.id ? 'bg-white/20' : 'bg-slate-100'}`}>
                                                {(admin.fullName || admin.full_name || admin.username)[0].toUpperCase()}
                                            </div>
                                            <div className="text-left">
                                                <p className={`font-bold leading-tight ${selectedAdmin?.id === admin.id ? 'text-white' : 'text-slate-900'}`}>{admin.fullName || admin.full_name}</p>
                                                <p className={`text-[10px] uppercase tracking-wider font-bold ${selectedAdmin?.id === admin.id ? 'text-blue-100' : 'text-slate-400'}`}>@{admin.username}</p>
                                            </div>
                                        </div>
                                        <ChevronRight size={16} className={`transition-transform ${selectedAdmin?.id === admin.id ? 'translate-x-1' : 'opacity-0 group-hover:opacity-100'}`} />
                                    </button>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                {/* Permissions Panel */}
                <div className="lg:col-span-8">
                    {selectedAdmin ? (
                        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[700px] animate-in fade-in slide-in-from-right-4 duration-300">
                            <div className="p-8 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                                <div>
                                    <h3 className="text-2xl font-black text-slate-900 leading-tight">
                                        Permissions for {selectedAdmin.fullName || selectedAdmin.full_name}
                                    </h3>
                                    <p className="text-slate-500 font-medium mt-1">Select which pages this admin is allowed to access.</p>
                                </div>
                                <button
                                    onClick={handleSave}
                                    disabled={saving || selectedAdmin.is_master || selectedAdmin.isMaster}
                                    className={`flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-black transition-all shadow-lg ${saving ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-slate-900 text-white hover:bg-blue-600 hover:shadow-blue-600/20 active:scale-95'}`}
                                >
                                    {saving ? <div className="w-4 h-4 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" /> : <Save size={18} />}
                                    Save Changes
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                                {(selectedAdmin.is_master || selectedAdmin.isMaster) ? (
                                    <div className="bg-amber-50 border border-amber-100 p-6 rounded-2xl flex items-start gap-4">
                                        <Shield className="text-amber-500 shrink-0" size={24} />
                                        <div>
                                            <h4 className="font-bold text-amber-900">Master Administrator</h4>
                                            <p className="text-sm text-amber-800 mt-1">This user is a Master Admin and has full access to all pages. Their permissions cannot be restricted.</p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {menuItems.map(item => {
                                            if (item.id === 'dashboard' || item.id === 'access-control') return null;
                                            const isChecked = permissions.includes(item.id);
                                            return (
                                                <div
                                                    key={item.id}
                                                    onClick={() => handleTogglePermission(item.id)}
                                                    className={`group p-4 rounded-2xl border-2 transition-all cursor-pointer flex items-center justify-between ${isChecked ? 'border-blue-500 bg-blue-50/50' : 'border-slate-100 bg-white hover:border-slate-200'}`}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className={`p-2 rounded-xl transition-colors ${isChecked ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-400 group-hover:bg-slate-200'}`}>
                                                            {isChecked ? <Unlock size={18} /> : <Lock size={18} />}
                                                        </div>
                                                        <span className={`font-bold text-sm ${isChecked ? 'text-blue-900' : 'text-slate-600'}`}>{item.label}</span>
                                                    </div>
                                                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${isChecked ? 'bg-blue-500 border-blue-500 text-white' : 'border-slate-200 bg-white'}`}>
                                                        {isChecked && <CheckCircle size={14} strokeWidth={3} />}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}

                                <div className="mt-8 bg-slate-50 border border-slate-100 p-6 rounded-2xl">
                                    <h4 className="font-bold text-slate-900 mb-2 flex items-center gap-2">
                                        <AlertCircle size={16} className="text-blue-500" />
                                        Important Note
                                    </h4>
                                    <ul className="text-xs text-slate-500 space-y-2 list-disc pl-4 font-medium">
                                        <li>Dashboard is always visible to all Admin users.</li>
                                        <li>If no specific permissions are checked, the admin will have access to all pages by default (Legacy behavior).</li>
                                        <li>Users must refresh the page for sidebar changes to take effect if they are currently logged in.</li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-white rounded-3xl border border-slate-200 border-dashed border-2 flex flex-col items-center justify-center h-[700px] text-slate-400">
                            <Shield size={64} className="opacity-10 mb-6" />
                            <p className="font-black text-xl uppercase tracking-widest opacity-20">Select an Administrator</p>
                            <p className="text-sm font-medium opacity-40 mt-2">to manage their granular page permissions</p>
                        </div>
                    )}
                </div>
            </div>
        </SaaSLayout>
    );
};

export default AdminAccessControl;
