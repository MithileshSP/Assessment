// Temporary file to hold the manual user creation modal content
// This will be inserted into AdminDashboardNew.jsx

{/* Add Users Modal - Mode Selection and Forms */ }
{
    showUserUploadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="p-6 border-b border-gray-200">
                    <h2 className="text-2xl font-bold text-gray-900">Add Users</h2>
                    <p className="text-sm text-gray-600 mt-1">
                        {addUserMode === 'choose' && 'Choose how you want to add users'}
                        {addUserMode === 'csv' && 'Upload users via CSV file'}
                        {addUserMode === 'manual' && 'Create a new user manually'}
                    </p>
                </div>

                <div className="p-6">
                    {/* Mode Selection */}
                    {addUserMode === 'choose' && (
                        <div className="space-y-4">
                            <button
                                onClick={() => setAddUserMode('csv')}
                                className="w-full p-6 border-2 border-gray-200 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-all text-left"
                            >
                                <div className="flex items-start gap-4">
                                    <Upload className="w-6 h-6 text-blue-600 mt-1" />
                                    <div>
                                        <h3 className="text-lg font-semibold text-gray-900 mb-2">Upload CSV File</h3>
                                        <p className="text-sm text-gray-600">Import multiple users at once using a CSV file</p>
                                    </div>
                                </div>
                            </button>

                            <button
                                onClick={() => setAddUserMode('manual')}
                                className="w-full p-6 border-2 border-gray-200 rounded-lg hover:border-green-400 hover:bg-green-50 transition-all text-left"
                            >
                                <div className="flex items-start gap-4">
                                    <Plus className="w-6 h-6 text-green-600 mt-1" />
                                    <div>
                                        <h3 className="text-lg font-semibold text-gray-900 mb-2">Add User Manually</h3>
                                        <p className="text-sm text-gray-600">Create a single user with custom details</p>
                                    </div>
                                </div>
                            </button>
                        </div>
                    )}

                    {/* CSV Upload Mode */}
                    {addUserMode === 'csv' && (
                        <div className="space-y-4">
                            <button
                                onClick={downloadUsersCsvTemplate}
                                className="w-full px-4 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-semibold flex items-center justify-center gap-2"
                            >
                                <Download size={16} /> Download CSV Template
                            </button>

                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">Select CSV File:</label>
                                <input
                                    type="file"
                                    accept=".csv"
                                    onChange={(e) => setUserCsvFile(e.target.files[0])}
                                    className="w-full px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg hover:border-gray-400 cursor-pointer"
                                />
                                {userCsvFile && (
                                    <p className="mt-2 text-sm text-gray-600">
                                        📄 Selected: <strong>{userCsvFile.name}</strong>
                                    </p>
                                )}
                            </div>

                            {userUploadResult && (
                                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                                    <p className="text-green-800 font-semibold mb-2">✅ Upload Complete!</p>
                                    <p className="text-sm text-green-700">✓ Added: {userUploadResult.added} user(s)</p>
                                    <p className="text-sm text-green-700">⊘ Skipped: {userUploadResult.skipped} user(s)</p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Manual Creation Mode */}
                    {addUserMode === 'manual' && (
                        <div className="space-y-4">
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
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-3">
                    {addUserMode !== 'choose' && (
                        <button
                            onClick={() => {
                                setAddUserMode('choose');
                                setUserCsvFile(null);
                                setUserUploadResult(null);
                            }}
                            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-semibold"
                        >
                            Back
                        </button>
                    )}
                    <button
                        onClick={() => {
                            setShowUserUploadModal(false);
                            setAddUserMode('choose');
                            setUserCsvFile(null);
                            setUserUploadResult(null);
                        }}
                        className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-semibold"
                    >
                        Close
                    </button>
                    {addUserMode === 'csv' && (
                        <button
                            onClick={handleCsvUpload}
                            disabled={!userCsvFile}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Upload CSV
                        </button>
                    )}
                    {addUserMode === 'manual' && (
                        <button
                            onClick={handleCreateUser}
                            disabled={creatingUser || !newUser.username || !newUser.password}
                            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            {creatingUser ? 'Creating...' : 'Create User'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    )
}
