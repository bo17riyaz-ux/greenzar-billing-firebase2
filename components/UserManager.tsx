
import React, { useState } from 'react';
import { User } from '../types';
import { Plus, User as UserIcon, Shield, Lock } from 'lucide-react';

interface Props {
  users: User[];
  setUsers: (users: User[]) => void;
}

export const UserManager: React.FC<Props> = ({ users, setUsers }) => {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formData, setFormData] = useState<User>({ username: '', password: '', role: 'user' });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.username || !formData.password) return;

    if (users.some(u => u.username.toLowerCase() === formData.username.toLowerCase())) {
        alert('Username already exists');
        return;
    }

    setUsers([...users, formData]);
    closeForm();
  };

  const closeForm = () => {
    setFormData({ username: '', password: '', role: 'user' });
    setIsFormOpen(false);
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">User Management</h2>
          <p className="text-slate-500">Manage access control for the billing system.</p>
        </div>
        <button 
          onClick={() => setIsFormOpen(true)}
          className="bg-sky-600 hover:bg-sky-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors shadow-sm font-medium"
        >
          <Plus size={18} /> Add User
        </button>
      </div>

      {isFormOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md animate-in fade-in zoom-in duration-200">
            <h3 className="text-xl font-bold mb-4">Add New User</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Username</label>
                  <input 
                    autoFocus
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-sky-500 outline-none"
                    value={formData.username}
                    onChange={e => setFormData({...formData, username: e.target.value})}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
                  <input 
                    type="text"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-sky-500 outline-none"
                    value={formData.password}
                    onChange={e => setFormData({...formData, password: e.target.value})}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Role</label>
                  <select
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-sky-500 outline-none bg-white"
                    value={formData.role}
                    onChange={e => setFormData({...formData, role: e.target.value})}
                  >
                      <option value="user">User</option>
                      <option value="admin">Admin</option>
                  </select>
                </div>

              <div className="flex justify-end gap-3 mt-6">
                <button type="button" onClick={closeForm} className="text-slate-500 hover:text-slate-700 px-4 py-2">Cancel</button>
                <button type="submit" className="bg-sky-600 hover:bg-sky-700 text-white px-6 py-2 rounded-lg font-medium">Create User</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="px-6 py-4 font-bold text-slate-600 text-xs uppercase tracking-wider">Username</th>
              <th className="px-6 py-4 font-bold text-slate-600 text-xs uppercase tracking-wider">Role</th>
              <th className="px-6 py-4 font-bold text-slate-600 text-xs uppercase tracking-wider">Password</th>
              <th className="px-6 py-4 font-bold text-slate-600 text-xs uppercase tracking-wider text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.map((user, index) => (
              <tr key={index} className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                     <div className="p-2 bg-slate-100 rounded-full text-slate-500">
                        <UserIcon size={16} />
                     </div>
                     <span className="font-semibold text-slate-800">{user.username}</span>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                     {user.role === 'admin' ? <Shield size={14} className="text-sky-600" /> : <UserIcon size={14} className="text-slate-400" />}
                     <span className={`text-sm capitalize ${user.role === 'admin' ? 'font-bold text-sky-700' : 'text-slate-600'}`}>
                         {user.role || 'user'}
                     </span>
                  </div>
                </td>
                <td className="px-6 py-4">
                    <div className="flex items-center gap-2 text-slate-400 font-mono text-sm">
                       <Lock size={14} /> <span>{user.password}</span>
                    </div>
                </td>
                <td className="px-6 py-4 text-right">
                  {/* Delete button removed per user request */}
                  <span className="text-xs text-slate-300">Protected</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      <div className="mt-4 p-4 bg-yellow-50 text-yellow-800 text-sm rounded-lg border border-yellow-100">
         <strong>Note:</strong> Changes made here will be synced to the Google Sheet automatically.
      </div>
    </div>
  );
};
