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
  Shield,
  GraduationCap,
  Activity,
  CheckCircle,
  AlertCircle,
  X
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

  const [formData, setFormData] = useState({
    username: '',
    password: '',
    email: '',
    fullName: '',
    role: 'student'
  });

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const response = await api.get('/users');
      setUsers(response.data);
    } catch (error) {
      console.error('Failed to load users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddUser = async (e) => {
    e.preventDefault();
    try {
      await api.post('/users', formData);
      setShowAddModal(false);
      setFormData({ username: '', password: '', email: '', fullName: '', role: 'student' });
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
      setFormData({ username: '', password: '', email: '', fullName: '', role: 'student' });
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

  const filteredUsers = users.filter(u =>
    u.username?.toLowerCase().includes(search.toLowerCase()) ||
    u.fullName?.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase())
  );

  const getRoleIcon = (role) => {
    switch (role) {
      case 'admin': return <Shield size={14} className="text-purple-500" />;
      case 'faculty': return <GraduationCap size={14} className="text-orange-500" />;
      default: return <User size={14} className="text-blue-500" />;
    }
  };

  const getRoleStyles = (role) => {
    switch (role) {
      case 'admin': return 'bg-purple-50 text-purple-700 border-purple-100';
      case 'faculty': return 'bg-orange-50 text-orange-700 border-orange-100';
      default: return 'bg-blue-50 text-blue-700 border-blue-100';
    }
  };

  return (
    <SaaSLayout>
      <div className="space-y-8 text-left">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">User Management</h1>
            <p className="text-slate-500 mt-1">Directly manage accounts for Students, Faculty, and Admins.</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowUploadModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors shadow-sm"
            >
              <Upload size={16} /> Bulk Import
            </button>
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 px-6 py-2 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-blue-600 transition-all shadow-lg shadow-slate-900/10"
            >
              <UserPlus size={16} /> Create User
            </button>
          </div>
        </div>

        {/* Search & Stats Bar */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-3 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Search by name, email or username..."
              className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 text-sm shadow-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="bg-blue-600 rounded-2xl p-4 text-white flex items-center justify-between shadow-lg shadow-blue-600/20">
            <div>
              <p className="text-[10px] font-bold opacity-60 uppercase tracking-widest text-left">Active Base</p>
              <p className="text-2xl font-bold text-left">{users.length} Users</p>
            </div>
            <Activity size={24} className="opacity-40" />
          </div>
        </div>

        {/* Users Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden text-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50/50 text-slate-500 font-bold text-[11px] uppercase tracking-widest border-b border-slate-100">
                <tr>
                  <th className="px-6 py-4">User</th>
                  <th className="px-6 py-4">Contact</th>
                  <th className="px-6 py-4">Role</th>
                  <th className="px-6 py-4">Joined</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {loading ? (
                  <tr><td colSpan="5" className="p-20 text-center text-slate-400">Loading user records...</td></tr>
                ) : filteredUsers.length === 0 ? (
                  <tr><td colSpan="5" className="p-20 text-center text-slate-400">No users match your criteria.</td></tr>
                ) : (
                  filteredUsers.map((user) => (
                    <tr key={user.id} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs ${getRoleStyles(user.role)}`}>
                            {user.fullName?.charAt(0) || user.username.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-bold text-slate-900">{user.fullName || 'No Name Set'}</p>
                            <p className="text-[11px] text-slate-400 font-medium">@{user.username}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 font-medium text-slate-500">
                        {user.email || '—'}
                      </td>
                      <td className="px-6 py-4">
                        <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border font-bold text-[10px] uppercase tracking-wider ${getRoleStyles(user.role)}`}>
                          {getRoleIcon(user.role)}
                          {user.role}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-400 font-medium">
                        {new Date(user.createdAt || Date.now()).toLocaleDateString()}
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
                                role: user.role || 'student'
                              });
                            }}
                            className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            onClick={() => handleDeleteUser(user.id)}
                            className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modals are kept similar but styled to match */}
        {(showAddModal || editingUser) && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden animate-fade-in border border-slate-100">
              <div className="p-8">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-bold text-slate-900">
                    {editingUser ? 'Update Profile' : 'Create New Identity'}
                  </h2>
                  <button onClick={() => { setShowAddModal(false); setEditingUser(null); }} className="p-2 hover:bg-slate-100 rounded-full text-slate-400">
                    <X size={20} />
                  </button>
                </div>

                <form onSubmit={editingUser ? handleUpdateUser : handleAddUser} className="space-y-5">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2">Username</label>
                    <input
                      type="text"
                      value={formData.username}
                      onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                      className="w-full px-4 py-3 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 text-sm font-medium"
                      required
                      disabled={!!editingUser}
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2">
                      Password {editingUser && '(optional)'}
                    </label>
                    <input
                      type="password"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className="w-full px-4 py-3 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 text-sm font-medium"
                      required={!editingUser}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4 uppercase tracking-widest">
                    <div className="col-span-2">
                      <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2">Full Name</label>
                      <input
                        type="text"
                        value={formData.fullName}
                        onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                        className="w-full px-4 py-3 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 text-sm font-medium"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2">Email Address</label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full px-4 py-3 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 text-sm font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2">Access Role</label>
                    <select
                      value={formData.role}
                      onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                      className="w-full px-4 py-3 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 text-sm font-bold text-slate-700"
                    >
                      <option value="student">Student Account</option>
                      <option value="faculty">Faculty Member</option>
                      <option value="admin">System Admin</option>
                    </select>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-xl shadow-blue-600/20 mt-4"
                  >
                    {editingUser ? 'Save Changes' : 'Generate Account'}
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* CSV Modal - Simplified for brevity in this tool call, but conceptually identical styling */}
        {showUploadModal && (
          <div className="fixed inset-0 bg-slate-900/4 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full p-8 overflow-hidden animate-fade-in border border-slate-100 uppercase tracking-widest font-bold">
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-2xl font-bold text-slate-900 normal-case tracking-normal">Bulk Import Hub</h2>
                <button onClick={() => setShowUploadModal(false)} className="p-2 hover:bg-slate-100 rounded-full text-slate-400">
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-6">
                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                  <h3 className="text-xs font-bold text-blue-600 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <AlertCircle size={14} /> Format Guidelines
                  </h3>
                  <div className="bg-[#1e293b] p-4 rounded-xl text-blue-300 font-mono text-[10px] mb-4">
                    username,password,fullName,email,role
                  </div>
                  <p className="text-xs text-slate-400 normal-case tracking-normal font-medium leading-relaxed">
                    Ensure your CSV follows the header structure above. Role defaults to 'student' if omitted.
                  </p>
                </div>

                <div className="border-2 border-dashed border-slate-200 rounded-2xl p-12 text-center group hover:border-blue-400 transition-colors">
                  <Upload className="mx-auto text-slate-300 group-hover:text-blue-500 transition-colors mb-4" size={32} />
                  <input
                    type="file"
                    accept=".csv"
                    onChange={(e) => setCsvFile(e.target.files[0])}
                    className="hidden"
                    id="csv-upload"
                  />
                  <label htmlFor="csv-upload" className="cursor-pointer text-blue-600 hover:text-blue-700 font-bold text-sm underline normal-case tracking-normal">
                    {csvFile ? csvFile.name : 'Select a CSV file from your computer'}
                  </label>
                </div>

                <div className="flex gap-4">
                  <button
                    onClick={handleCsvUpload}
                    disabled={!csvFile}
                    className="flex-1 py-4 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 disabled:opacity-30 shadow-xl shadow-blue-600/20"
                  >
                    Execute Import
                  </button>
                  <button
                    onClick={() => window.open(`${BASE_URL}/users/sample-csv`, '_blank')}
                    className="px-6 py-4 bg-white border border-slate-200 text-slate-600 rounded-2xl font-bold hover:bg-slate-50 transition-colors"
                  >
                    <Download size={20} />
                  </button>
                </div>

                {uploadResult && (
                  <div className="p-4 bg-emerald-50 rounded-xl flex items-center gap-3 text-emerald-700 text-xs font-bold">
                    <CheckCircle size={16} />
                    Success: Added {uploadResult.added}, Skipped {uploadResult.skipped}
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
