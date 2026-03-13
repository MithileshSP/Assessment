import { useState, useEffect } from 'react';
import SaaSLayout from '../components/SaaSLayout';
import api, { BASE_URL } from '../services/api';
import {
  UserPlus,
  Upload,
  Download,
  Edit2,
  Trash2,
  Search,
  User,
  Users,
  Shield,
  GraduationCap,
  Activity,
  CheckCircle,
  AlertCircle,
  X,
  Hash,
  Lock,
  Unlock,
  Filter
} from 'lucide-react';

export default function UserManagement() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [csvFile, setCsvFile] = useState(null);
  const [uploadResult, setUploadResult] = useState(null);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [colFilters, setColFilters] = useState({
    fullName: '',
    username: '',
    rollNo: '',
    email: '',
    isBlocked: ''
  });
  const [activeFilters, setActiveFilters] = useState({}); // Track which column filters are visible

  const [formData, setFormData] = useState({
    username: '',
    password: '',
    email: '',
    fullName: '',
    rollNo: '',
    role: 'student'
  });

  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 1
  });

  useEffect(() => {
    loadUsers();
  }, [pagination.page, roleFilter, search, colFilters]); // Reload when page, role, search, or colFilters change

  // Debounce search to avoid too many requests
  useEffect(() => {
    const timer = setTimeout(() => {
      setPagination(prev => ({ ...prev, page: 1 })); // Reset to page 1 on search or colFilters change
    }, 500);
    return () => clearTimeout(timer);
  }, [search, colFilters]);

  useEffect(() => {
    setPagination(prev => ({ ...prev, page: 1 })); // Reset to page 1 on role change
  }, [roleFilter]);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const response = await api.get('/users', {
        params: {
          page: pagination.page,
          limit: pagination.limit,
          search: search.trim(),
          role: roleFilter,
          ...colFilters
        }
      });

      // Handle both old array format (fallback) and new paginated format
      if (Array.isArray(response.data)) {
        setUsers(response.data);
        // Manually paginate if backend returns full array (backward compatibility)
        setPagination(prev => ({
          ...prev,
          total: response.data.length,
          totalPages: 1
        }));
      } else {
        setUsers(response.data.users);
        setPagination(prev => ({
          ...prev,
          total: response.data.pagination.total,
          totalPages: response.data.pagination.totalPages
        }));
      }
    } catch (error) {
      console.error('Failed to load users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      setPagination(prev => ({ ...prev, page: newPage }));
    }
  };

  const handleAddUser = async (e) => {
    e.preventDefault();
    try {
      await api.post('/users', formData);
      setShowAddModal(false);
      setFormData({ username: '', password: '', email: '', fullName: '', rollNo: '', role: 'student' });
      loadUsers();
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to add user');
    }
  };

  const handleUpdateUser = async (e) => {
    e.preventDefault();
    try {
      await api.put(`/users/${editingUser.id}`, formData);
      setEditingUser(null);
      setFormData({ username: '', password: '', email: '', fullName: '', rollNo: '', role: 'student' });
      loadUsers();
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to update user');
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!window.confirm('Are you sure you want to delete this user?')) return;
    try {
      await api.delete(`/users/${userId}`);
      loadUsers();
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to delete user');
    }
  };

  const handleToggleBlock = async (userId) => {
    try {
      const response = await api.patch(`/users/${userId}/toggle-block`);
      // Update the local state to reflect the change
      setUsers(users.map(u =>
        u.id === userId ? { ...u, isBlocked: response.data.isBlocked } : u
      ));
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to toggle block status');
    }
  };

  const handleColFilterChange = (key, value) => {
    setColFilters(prev => ({ ...prev, [key]: typeof value === 'string' ? value.trim() : value }));
  };

  const toggleFilter = (key) => {
    setActiveFilters(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleCsvUpload = async () => {
    if (!csvFile) return;
    const data = new FormData();
    data.append('file', csvFile);
    try {
      const response = await api.post('/users/upload-csv', data, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setUploadResult(response.data);
      loadUsers();
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to upload CSV');
    }
  };

  // Client-side filtering removed as backend now handles it
  // const filteredUsers = ... (logic moved to backend)
  const displayUsers = users; // Users are already filtered from backend

  const getRoleIcon = (role) => {
    switch (role) {
      case 'admin': return <Shield size={14} className="text-blue-600" />;
      case 'faculty': return <GraduationCap size={14} className="text-blue-500" />;
      default: return <User size={14} className="text-blue-400" />;
    }
  };

  const getRoleStyles = (role) => {
    switch (role) {
      case 'admin': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'faculty': return 'bg-blue-50 text-blue-700 border-blue-100';
      default: return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  return (
    <SaaSLayout>
      <div className="space-y-8 text-left">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">User Management</h1>
            <p className="text-slate-500 mt-1 text-sm font-medium">Directly manage accounts for Students, Faculty, and Admins.</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowUploadModal(true)}
              className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-md text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors shadow-sm"
            >
              <Upload size={14} /> Bulk Import
            </button>
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 px-5 py-1.5 bg-slate-900 text-white rounded-md text-xs font-bold hover:bg-slate-800 transition-all shadow-sm"
            >
              <UserPlus size={14} /> Create User
            </button>
          </div>
        </div>

        {/* Search & Stats Bar */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6 animate-fade-in-up delay-100">
          <div className="md:col-span-1 lg:col-span-2 xl:col-span-3 flex items-center gap-4">
            <div className="relative flex-1 group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-slate-600 transition-colors" size={14} />
              <input
                type="text"
                placeholder="Search..."
                className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-md focus:ring-2 focus:ring-slate-100 focus:border-slate-400 outline-none text-xs shadow-sm transition-all"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="relative group">
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="appearance-none pl-4 pr-10 py-2 bg-white border border-slate-200 rounded-md focus:ring-2 focus:ring-slate-100 focus:border-slate-400 outline-none text-xs font-bold text-slate-700 shadow-sm transition-all cursor-pointer min-w-[140px]"
              >
                <option value="all">All Roles</option>
                <option value="student">Students</option>
                <option value="faculty">Faculty</option>
                <option value="admin">Admins</option>
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                <Users size={14} />
              </div>
            </div>
          </div>

          <div className="bg-slate-900 rounded-md p-4 text-white flex items-center justify-between shadow-md">
            <div>
              <p className="text-[9px] font-bold opacity-70 uppercase tracking-widest text-left">Active Base</p>
              <p className="text-2xl font-bold text-left mt-0.5">
                {pagination.total}
                <span className="text-[10px] ml-1 opacity-50 font-medium">Results</span>
              </p>
            </div>
            <div className="w-10 h-10 rounded-md bg-white/10 flex items-center justify-center backdrop-blur-sm">
              <Activity size={20} className="opacity-80" />
            </div>
          </div>
        </div>

        {/* Users Table */}
        <div className="bg-white rounded-md border border-slate-200 shadow-sm overflow-hidden text-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 sticky top-0 z-10 border-b border-slate-200 shadow-[0_1px_0_0_rgba(0,0,0,0.05)] text-slate-500 font-bold text-[10px] uppercase tracking-widest leading-none">
                <tr className="h-10">
                  <th className="px-6 py-4">
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center justify-between gap-2">
                        <span>User</span>
                        <button
                          onClick={() => toggleFilter('fullName')}
                          className={`p-1 rounded hover:bg-slate-200 transition-colors ${colFilters.fullName ? 'text-blue-600 bg-blue-50' : 'text-slate-400'}`}
                        >
                          <Filter size={12} />
                        </button>
                      </div>
                      {activeFilters.fullName && (
                        <div className="relative group/filter animate-in fade-in slide-in-from-top-1 duration-200">
                          <Search size={10} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within/filter:text-blue-500 transition-colors" />
                          <input
                            type="text"
                            placeholder="Filter Name..."
                            value={colFilters.fullName}
                            onChange={(e) => handleColFilterChange('fullName', e.target.value)}
                            className="w-full pl-6 pr-2 py-1.5 bg-white border border-slate-200 rounded-lg text-[9px] font-bold normal-case tracking-normal outline-none focus:border-blue-500 transition-all"
                            autoFocus
                          />
                        </div>
                      )}
                    </div>
                  </th>
                  <th className="px-6 py-4">
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center justify-between gap-2">
                        <span>Roll No</span>
                        <button
                          onClick={() => toggleFilter('rollNo')}
                          className={`p-1 rounded hover:bg-slate-200 transition-colors ${colFilters.rollNo ? 'text-blue-600 bg-blue-50' : 'text-slate-400'}`}
                        >
                          <Filter size={12} />
                        </button>
                      </div>
                      {activeFilters.rollNo && (
                        <div className="relative group/filter animate-in fade-in slide-in-from-top-1 duration-200">
                          <Hash size={10} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within/filter:text-blue-500 transition-colors" />
                          <input
                            type="text"
                            placeholder="Filter Roll..."
                            value={colFilters.rollNo}
                            onChange={(e) => handleColFilterChange('rollNo', e.target.value)}
                            className="w-full pl-6 pr-2 py-1.5 bg-white border border-slate-200 rounded-lg text-[9px] font-bold normal-case tracking-normal outline-none focus:border-blue-500 transition-all font-mono"
                            autoFocus
                          />
                        </div>
                      )}
                    </div>
                  </th>
                  <th className="px-6 py-4">
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center justify-between gap-2">
                        <span>Email</span>
                        <button
                          onClick={() => toggleFilter('email')}
                          className={`p-1 rounded hover:bg-slate-200 transition-colors ${colFilters.email ? 'text-blue-600 bg-blue-50' : 'text-slate-400'}`}
                        >
                          <Filter size={12} />
                        </button>
                      </div>
                      {activeFilters.email && (
                        <div className="relative group/filter animate-in fade-in slide-in-from-top-1 duration-200">
                          <Search size={10} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within/filter:text-blue-500 transition-colors" />
                          <input
                            type="text"
                            placeholder="Filter Email..."
                            value={colFilters.email}
                            onChange={(e) => handleColFilterChange('email', e.target.value)}
                            className="w-full pl-6 pr-2 py-1.5 bg-white border border-slate-200 rounded-lg text-[9px] font-bold normal-case tracking-normal outline-none focus:border-blue-500 transition-all"
                            autoFocus
                          />
                        </div>
                      )}
                    </div>
                  </th>
                  <th className="px-6 py-4 text-left">
                    <div className="flex items-center gap-2">
                      <span>Role</span>
                    </div>
                  </th>
                  <th className="px-6 py-4">
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center justify-between gap-2">
                        <span>Status</span>
                        <button
                          onClick={() => toggleFilter('isBlocked')}
                          className={`p-1 rounded hover:bg-slate-200 transition-colors ${colFilters.isBlocked ? 'text-blue-600 bg-blue-50' : 'text-slate-400'}`}
                        >
                          <Filter size={12} />
                        </button>
                      </div>
                      {activeFilters.isBlocked && (
                        <select
                          value={colFilters.isBlocked}
                          onChange={(e) => handleColFilterChange('isBlocked', e.target.value)}
                          className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-[9px] font-bold normal-case tracking-normal outline-none focus:border-blue-500 transition-all cursor-pointer animate-in fade-in slide-in-from-top-1 duration-200"
                          autoFocus
                        >
                          <option value="">All</option>
                          <option value="false">Active</option>
                          <option value="true">Blocked</option>
                        </select>
                      )}
                    </div>
                  </th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {loading ? (
                  <tr><td colSpan="6" className="p-20 text-center text-slate-400">Loading user records...</td></tr>
                ) : displayUsers.length === 0 ? (
                  <tr><td colSpan="6" className="p-20 text-center text-slate-400">No users match your criteria.</td></tr>
                ) : (
                  displayUsers.map((user) => (
                    <tr key={user.id} className="hover:bg-slate-50 transition-colors group even:bg-slate-50/20">
                      <td className="px-6 py-2">
                        <div className="flex items-center gap-3">
                          <div className={`w-7 h-7 rounded-md flex items-center justify-center font-bold text-[10px] border border-black/5 ${getRoleStyles(user.role)}`}>
                            {user.fullName?.charAt(0) || user.username.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-bold text-slate-900 leading-tight">{user.fullName || 'No Name Set'}</p>
                            <p className="text-[10px] text-slate-400 font-medium">@{user.username}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-2">
                        <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-50 text-slate-700 font-mono text-[10px] border border-slate-200">
                          <Hash size={10} className="text-slate-400" />
                          {user.rollNo || '—'}
                        </div>
                      </td>
                      <td className="px-6 py-2 font-medium text-slate-500 text-xs">
                        {user.email || '—'}
                      </td>
                      <td className="px-6 py-2">
                        <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border font-bold text-[9px] uppercase tracking-wider ${getRoleStyles(user.role)}`}>
                          {getRoleIcon(user.role)}
                          {user.role}
                        </div>
                      </td>
                      <td className="px-6 py-2">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleToggleBlock(user.id)}
                            className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors focus:outline-none ${user.isBlocked
                              ? 'bg-rose-500'
                              : 'bg-emerald-500'
                              }`}
                          >
                            <span
                              className={`inline-block h-2.5 w-2.5 transform rounded-full bg-white shadow-sm transition-transform ${user.isBlocked ? 'translate-x-0.5' : 'translate-x-4'
                                }`}
                            />
                          </button>
                          <span className={`text-[10px] font-bold ${user.isBlocked ? 'text-rose-600' : 'text-emerald-600'}`}>
                            {user.isBlocked ? 'Blocked' : 'Active'}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => {
                              setEditingUser(user);
                              setFormData({
                                username: user.username,
                                password: '',
                                email: user.email || '',
                                fullName: user.fullName || '',
                                rollNo: user.rollNo || '',
                                role: user.role || 'student'
                              });
                            }}
                            className="p-1.5 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            onClick={() => handleDeleteUser(user.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-slate-50/50">
            <div className="text-xs text-slate-500 font-medium">
              Showing page <span className="font-bold text-slate-700">{pagination.page}</span> of <span className="font-bold text-slate-700">{pagination.totalPages}</span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handlePageChange(pagination.page - 1)}
                disabled={pagination.page === 1}
                className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 disabled:opacity-50 hover:bg-slate-50 transition-colors shadow-sm"
              >
                Previous
              </button>
              <button
                onClick={() => handlePageChange(pagination.page + 1)}
                disabled={pagination.page === pagination.totalPages}
                className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 disabled:opacity-50 hover:bg-slate-50 transition-colors shadow-sm"
              >
                Next
              </button>
            </div>
          </div>
        </div>

        {/* Modals are kept similar but styled to match */}
        {/* Modals - Enterprise Redesign */}
        {(showAddModal || editingUser) && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-sm max-w-md w-full overflow-hidden animate-fade-in border border-slate-200">
              <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-bold text-slate-900">
                    {editingUser ? 'Update Profile' : 'Create New Identity'}
                  </h2>
                  <button onClick={() => { setShowAddModal(false); setEditingUser(null); }} className="p-2 hover:bg-slate-100 rounded-md text-slate-400 transition-colors">
                    <X size={18} />
                  </button>
                </div>

                <form onSubmit={editingUser ? handleUpdateUser : handleAddUser} className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Username</label>
                    <input
                      type="text"
                      value={formData.username}
                      onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-md focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-sm font-medium transition-all"
                      required
                      disabled={!!editingUser}
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                      Password {editingUser && '(optional)'}
                    </label>
                    <input
                      type="password"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-md focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-sm font-medium transition-all"
                      required={!editingUser}
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Full Name</label>
                    <input
                      type="text"
                      value={formData.fullName}
                      onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-md focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-sm font-medium transition-all"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Roll No</label>
                      <input
                        type="text"
                        value={formData.rollNo}
                        onChange={(e) => setFormData({ ...formData, rollNo: e.target.value })}
                        placeholder="e.g., 737624..."
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-md focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-sm font-mono transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Access Role</label>
                      <select
                        value={formData.role}
                        onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-md focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-sm font-bold text-slate-700 transition-all appearance-none cursor-pointer"
                      >
                        <option value="student">Student</option>
                        <option value="faculty">Faculty</option>
                        <option value="admin">Admin</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Email Address</label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-md focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-sm font-medium transition-all"
                    />
                  </div>

                  <div className="flex gap-3 mt-6">
                    <button
                      type="button"
                      onClick={() => { setShowAddModal(false); setEditingUser(null); }}
                      className="flex-1 py-2.5 border border-slate-200 text-slate-600 rounded-md font-bold text-xs uppercase tracking-widest hover:bg-slate-50 transition-all active:scale-[0.98]"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="flex-1 py-2.5 bg-blue-600 text-white rounded-md font-bold text-xs uppercase tracking-widest hover:bg-blue-700 transition-all active:scale-[0.98] shadow-sm"
                    >
                      {editingUser ? 'Save Changes' : 'Create User'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* CSV Modal - Simplified for brevity in this tool call, but conceptually identical styling */}
        {/* CSV Modal - Enterprise Redesign */}
        {showUploadModal && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-sm max-w-2xl w-full p-8 overflow-hidden animate-fade-in border border-slate-200">
              <div className="flex justify-between items-center mb-8">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">Bulk Import Hub</h2>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Registry Management Assistant</p>
                </div>
                <button onClick={() => setShowUploadModal(false)} className="p-2 hover:bg-slate-100 rounded-md text-slate-400 transition-colors">
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-6">
                <div className="bg-slate-50 p-5 rounded-md border border-slate-200">
                  <h3 className="text-[10px] font-bold text-blue-600 uppercase tracking-[0.2em] mb-3 flex items-center gap-2">
                    <AlertCircle size={14} /> Format Guidelines
                  </h3>
                  <div className="bg-slate-900 p-3 rounded-md text-blue-300 font-mono text-[10px] mb-3 border border-white/5">
                    email,fullName,rollNo,username,password,role
                  </div>
                  <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
                    <strong className="text-slate-700">Auto-Mapping:</strong> Users uploaded via CSV will be automatically linked to their Google account if the email matches during login.
                  </p>
                </div>

                <div className="border border-dashed border-slate-200 rounded-md p-10 text-center group hover:border-blue-300 transition-all bg-slate-50/30">
                  <Upload className="mx-auto text-slate-300 group-hover:text-blue-500 transition-colors mb-4" size={32} />
                  <input
                    type="file"
                    accept=".csv"
                    onChange={(e) => setCsvFile(e.target.files[0])}
                    className="hidden"
                    id="csv-upload"
                  />
                  <label htmlFor="csv-upload" className="cursor-pointer text-blue-600 hover:text-blue-700 font-bold text-xs uppercase tracking-widest transition-colors block">
                    {csvFile ? csvFile.name : 'Select CSV Registry File'}
                  </label>
                  {!csvFile && <p className="text-[9px] text-slate-400 font-bold mt-2 uppercase tracking-wide">Max size: 10MB • Format: CSV</p>}
                </div>

                <div className="flex gap-4">
                  <button
                    onClick={handleCsvUpload}
                    disabled={!csvFile}
                    className="flex-1 py-3 bg-blue-600 text-white rounded-md font-bold text-xs uppercase tracking-widest hover:bg-blue-700 disabled:opacity-30 shadow-sm transition-all active:scale-[0.98]"
                  >
                    Execute Import
                  </button>
                  <button
                    onClick={() => window.open(`${BASE_URL}/users/sample-csv`, '_blank')}
                    className="px-5 py-3 bg-white border border-slate-200 text-slate-600 rounded-md font-bold text-xs uppercase tracking-widest hover:bg-slate-50 transition-all"
                    title="Download Template"
                  >
                    <Download size={18} />
                  </button>
                </div>

                {uploadResult && (
                  <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-md flex items-center gap-3 text-emerald-700 text-[10px] font-bold uppercase tracking-widest">
                    <CheckCircle size={16} />
                    Import Results: {uploadResult.added} processed • {uploadResult.skipped} skipped
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </SaaSLayout>
  );
}
