import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Upload, Download, Plus, Loader2 } from 'lucide-react';
import api from '../services/api';

export default function AddUsers() {
    const navigate = useNavigate();
    const [mode, setMode] = useState('choose'); // 'choose', 'csv', 'manual'

    // CSV upload state
    const [csvFile, setCsvFile] = useState(null);
    const [uploadResult, setUploadResult] = useState(null);
    const [uploading, setUploading] = useState(false);

    // Manual user state
    const [newUser, setNewUser] = useState({
        username: '',
        password: '',
        fullName: '',
        email: '',
        role: 'student'
    });
    const [creating, setCreating] = useState(false);

    const handleCsvUpload = async () => {
        if (!csvFile) {
            alert('Please select a CSV file');
            return;
        }

        const formData = new FormData();
        formData.append('file', csvFile);

        try {
            setUploading(true);
            const response = await api.post('/users/upload-csv', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            setUploadResult(response.data);
            alert(`Successfully added ${response.data.added} user(s)!`);
            setCsvFile(null);
        } catch (error) {
            console.error('Upload error:', error);
            alert('Failed to upload CSV: ' + (error.response?.data?.error || error.message));
        } finally {
            setUploading(false);
        }
    };

    const downloadTemplate = async () => {
        try {
            const response = await api.get('/users/sample-csv', { responseType: 'blob' });
            const blob = response.data;
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = 'users-sample.csv';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Download error:', error);
            alert('Failed to download template');
        }
    };

    const handleCreateUser = async () => {
        if (!newUser.username || !newUser.password) {
            alert('Username and password are required');
            return;
        }

        try {
            setCreating(true);
            await api.post('/users', {
                username: newUser.username,
                password: newUser.password,
                fullName: newUser.fullName || null,
                email: newUser.email || null,
                role: newUser.role || 'student'
            });

            alert(`User "${newUser.username}" created successfully!`);
            setNewUser({ username: '', password: '', fullName: '', email: '', role: 'student' });
            navigate('/admin/dashboard');
        } catch (error) {
            console.error('User creation error:', error);
            alert(error.response?.data?.error || 'Failed to create user');
        } finally {
            setCreating(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 p-6">
            <div className="max-w-3xl mx-auto">
                {/* Header */}
                <div className="mb-6">
                    <button
                        onClick={() => navigate('/admin/dashboard')}
                        className="mb-4 flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5" />
                        Back to Dashboard
                    </button>
                    <h1 className="text-3xl font-bold text-gray-900">Add Users</h1>
                    <p className="text-gray-600 mt-2">
                        {mode === 'choose' && 'Choose how you want to add users to the system'}
                        {mode === 'csv' && 'Upload multiple users via CSV file'}
                        {mode === 'manual' && 'Create a new user manually'}
                    </p>
                </div>

                {/* Mode Selection */}
                {mode === 'choose' && (
                    <div className="space-y-4">
                        <button
                            onClick={() => setMode('csv')}
                            className="w-full p-6 bg-white border-2 border-gray-200 rounded-lg hover:border-blue-400 hover:shadow-lg transition-all text-left"
                        >
                            <div className="flex items-start gap-4">
                                <div className="p-3 bg-blue-100 rounded-lg">
                                    <Upload className="w-6 h-6 text-blue-600" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-semibold text-gray-900 mb-2">Upload CSV File</h3>
                                    <p className="text-gray-600">Import multiple users at once using a CSV file</p>
                                </div>
                            </div>
                        </button>

                        <button
                            onClick={() => setMode('manual')}
                            className="w-full p-6 bg-white border-2 border-gray-200 rounded-lg hover:border-green-400 hover:shadow-lg transition-all text-left"
                        >
                            <div className="flex items-start gap-4">
                                <div className="p-3 bg-green-100 rounded-lg">
                                    <Plus className="w-6 h-6 text-green-600" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-semibold text-gray-900 mb-2">Add User Manually</h3>
                                    <p className="text-gray-600">Create a single user with custom details</p>
                                </div>
                            </div>
                        </button>
                    </div>
                )}

                {/* CSV Upload Mode */}
                {mode === 'csv' && (
                    <div className="bg-white rounded-lg shadow p-6 space-y-6">
                        <button
                            onClick={() => setMode('choose')}
                            className="text-gray-600 hover:text-gray-900 flex items-center gap-2 mb-4"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            Back to options
                        </button>

                        <button
                            onClick={downloadTemplate}
                            className="w-full px-4 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-semibold flex items-center justify-center gap-2"
                        >
                            <Download size={20} /> Download CSV Template
                        </button>

                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">Select CSV File:</label>
                            <input
                                type="file"
                                accept=".csv"
                                onChange={(e) => setCsvFile(e.target.files[0])}
                                className="w-full px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg hover:border-gray-400 cursor-pointer"
                            />
                            {csvFile && (
                                <p className="mt-2 text-sm text-gray-600">
                                    📄 Selected: <strong>{csvFile.name}</strong>
                                </p>
                            )}
                        </div>

                        {uploadResult && (
                            <div className={`p-4 rounded-lg border ${uploadResult.errors ? 'bg-yellow-50 border-yellow-200' : 'bg-green-50 border-green-200'}`}>
                                <p className={`font-semibold mb-2 ${uploadResult.errors ? 'text-yellow-800' : 'text-green-800'}`}>
                                    {uploadResult.errors ? '⚠️ Upload Completed with Issues' : '✅ Upload Complete!'}
                                </p>
                                <div className="space-y-1 mb-3">
                                    <p className="text-sm text-green-700">✓ Added: {uploadResult.added} user(s)</p>
                                    <p className="text-sm text-gray-600">⊘ Skipped: {uploadResult.skipped} user(s)</p>
                                </div>

                                {uploadResult.errors && uploadResult.errors.length > 0 && (
                                    <div className="mt-3 pt-3 border-t border-yellow-200">
                                        <p className="text-sm font-semibold text-red-700 mb-2">Error Report:</p>
                                        <ul className="list-disc list-inside space-y-1">
                                            {uploadResult.errors.map((error, index) => (
                                                <li key={index} className="text-sm text-red-600 font-mono bg-white/50 p-1 rounded">
                                                    {error}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        )}

                        <button
                            onClick={handleCsvUpload}
                            disabled={!csvFile || uploading}
                            className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {uploading ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    Uploading...
                                </>
                            ) : (
                                <>
                                    <Upload size={20} />
                                    Upload CSV
                                </>
                            )}
                        </button>
                    </div>
                )}

                {/* Manual Creation Mode */}
                {mode === 'manual' && (
                    <div className="bg-white rounded-lg shadow p-6 space-y-6">
                        <button
                            onClick={() => setMode('choose')}
                            className="text-gray-600 hover:text-gray-900 flex items-center gap-2 mb-4"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            Back to options
                        </button>

                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                                Username <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={newUser.username}
                                onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                placeholder="Enter username"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                                Password <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="password"
                                value={newUser.password}
                                onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                placeholder="Enter password"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">Full Name</label>
                            <input
                                type="text"
                                value={newUser.fullName}
                                onChange={(e) => setNewUser({ ...newUser, fullName: e.target.value })}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                placeholder="Enter full name (optional)"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">Email</label>
                            <input
                                type="email"
                                value={newUser.email}
                                onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                placeholder="Enter email (optional)"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">Role</label>
                            <select
                                value={newUser.role}
                                onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            >
                                <option value="student">Student</option>
                                <option value="admin">Admin</option>
                            </select>
                        </div>

                        <button
                            onClick={handleCreateUser}
                            disabled={creating || !newUser.username || !newUser.password}
                            className="w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {creating ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    Creating...
                                </>
                            ) : (
                                <>
                                    <Plus size={20} />
                                    Create User
                                </>
                            )}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
