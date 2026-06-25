import React, { useState, useEffect } from 'react';
import { UserPlus, Edit2, Trash2, ShieldAlert, Shield } from 'lucide-react';
import { storage } from '../utils/storage';
import { Modal } from '../components/Modal';



export const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<any[]>([]);
  const [currentSession, setCurrentSession] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  // Add/Edit user modal
  const [showAddEditModal, setShowAddEditModal] = useState(false);
  const [editingUser, setEditingUser] = useState<any | null>(null);

  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [userRole, setUserRole] = useState<'Administrator' | 'Restaurant Owner'>('Restaurant Owner');
  
  const [formError, setFormError] = useState('');

  // Delete Confirm modal
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [userToDelete, setUserToDelete] = useState<any | null>(null);

  useEffect(() => {
    setUsers(storage.getUsers());
    const session = storage.getAuth();
    setCurrentSession(session);
    if (session && session.role === 'Administrator') {
      setIsAdmin(true);
    }
  }, []);

  const handleOpenAdd = () => {
    setEditingUser(null);
    setUsername('');
    setFullName('');
    setPassword('');
    setConfirmPassword('');
    setUserRole('Restaurant Owner');
    setFormError('');
    setShowAddEditModal(true);
  };

  const handleOpenEdit = (user: any) => {
    setEditingUser(user);
    setUsername(user.username);
    setFullName(user.fullName);
    setPassword(user.password || '');
    setConfirmPassword(user.password || '');
    setUserRole(user.role);
    setFormError('');
    setShowAddEditModal(true);
  };

  const handleSaveUser = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!username.trim()) {
      setFormError('Username is required');
      return;
    }
    if (username.trim().length < 3) {
      setFormError('Username must be at least 3 characters');
      return;
    }
    if (!fullName.trim()) {
      setFormError('Full name is required');
      return;
    }
    if (!password) {
      setFormError('Password is required');
      return;
    }
    if (password.length < 4) {
      setFormError('Password must be at least 4 characters');
      return;
    }
    if (password !== confirmPassword) {
      setFormError('Passwords do not match');
      return;
    }

    const currentUsers = [...users];

    // Username unique check
    const nameExists = currentUsers.some(
      (u) =>
        u.username.toLowerCase() === username.trim().toLowerCase() &&
        u.id !== editingUser?.id
    );

    if (nameExists) {
      setFormError('Username already exists');
      return;
    }

    if (editingUser) {
      // Edit
      const updated = currentUsers.map((u) => {
        if (u.id === editingUser.id) {
          return {
            ...u,
            username: username.trim(),
            fullName: fullName.trim(),
            password: password,
            role: userRole
          };
        }
        return u;
      });
      storage.setUsers(updated);
      setUsers(updated);
    } else {
      // Add
      const newUser = {
        id: storage.generateId(),
        username: username.trim(),
        fullName: fullName.trim(),
        password: password,
        role: userRole,
        createdDate: new Date().toISOString(),
        status: 'active' as const
      };
      const updated = [...currentUsers, newUser];
      storage.setUsers(updated);
      setUsers(updated);
    }

    setShowAddEditModal(false);
    setEditingUser(null);
  };

  const handleToggleStatus = (user: any) => {
    // Cannot deactivate own account
    if (user.id === currentSession?.userId) {
      alert('You cannot deactivate your own account.');
      return;
    }

    const updated = users.map((u) => {
      if (u.id === user.id) {
        return {
          ...u,
          status: u.status === 'active' ? ('inactive' as const) : ('active' as const)
        };
      }
      return u;
    });
    storage.setUsers(updated);
    setUsers(updated);
  };

  const handleOpenDelete = (user: any) => {
    if (user.id === currentSession?.userId) {
      alert('You cannot delete your own account.');
      return;
    }
    setUserToDelete(user);
    setShowDeleteConfirm(true);
  };

  const handleDeleteConfirm = () => {
    if (userToDelete) {
      const updated = users.filter((u) => u.id !== userToDelete.id);
      storage.setUsers(updated);
      setUsers(updated);
      setShowDeleteConfirm(false);
      setUserToDelete(null);
    }
  };

  if (!isAdmin) {
    return (
      <div className="flex h-screen overflow-hidden bg-bg-page font-sans text-text-primary transition-all duration-[220ms] ease-in-out">
        <div className="flex-1 flex flex-col justify-center items-center p-8 text-center text-text-muted">
          <ShieldAlert className="w-12 h-12 text-warning mb-2" />
          <h2 className="text-[16px] font-medium sentence-case">Access Denied</h2>
          <p className="text-[14px] max-w-sm mt-1 sentence-case">
            Only restaurant administrators are authorized to access and modify restaurant billing accounts.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container custom-scrollbar transition-all duration-[220ms] ease-in-out select-none">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="page-title sentence-case">
            Users Management
          </h1>
          <p className="page-subtitle mt-0.5 sentence-case">
            Manage system access permissions and credentials
          </p>
        </div>
          <button
            onClick={handleOpenAdd}
            className="h-[36px] bg-primary hover:bg-primary-dark text-white rounded-btn px-4 text-[13px] font-medium flex items-center gap-1.5 transition-colors duration-150 shadow-card"
          >
            <UserPlus className="w-4 h-4" />
            Add user
          </button>
        </div>

        {/* Users Table */}
        <div className="bg-bg-card border border-border rounded-card shadow-card overflow-hidden">
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse custom-table">
              <thead>
                <tr className="bg-bg-page/50 border-b border-border/80 text-text-muted">
                  <th className="p-4 font-medium">Username</th>
                  <th className="p-4 font-medium">Full Name</th>
                  <th className="p-4 font-medium">Role</th>
                  <th className="p-4 font-medium">Created Date</th>
                  <th className="p-4 font-medium text-center">Status</th>
                  <th className="p-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-bg-page/20 transition-all duration-100">
                    <td className="p-4 font-semibold font-mono text-primary select-text">
                      {user.username}
                    </td>
                    <td className="p-4 font-medium text-text-primary select-text sentence-case">
                      {user.fullName}
                    </td>
                    <td className="p-4">
                      <span className="flex items-center gap-1 text-[12px] text-text-muted font-medium sentence-case">
                        <Shield className="w-3.5 h-3.5 text-primary shrink-0" />
                        {user.role}
                      </span>
                    </td>
                    <td className="p-4 text-text-muted">
                      {new Date(user.createdDate).toLocaleDateString()}
                    </td>
                    <td className="p-4">
                      <div className="flex justify-center">
                        <button
                          onClick={() => handleToggleStatus(user)}
                          disabled={user.id === currentSession?.userId}
                          className={`text-[11px] px-2 py-0.5 border rounded-badge font-semibold tracking-wide transition-all ${
                            user.status === 'active'
                              ? 'bg-[#DCFCE7] text-[#166534] border-[#86EFAC] hover:bg-[#bbf7d0]'
                              : 'bg-[#FEE2E2] text-[#991B1B] border-[#FCA5A5] hover:bg-[#fecaca]'
                          } disabled:opacity-50 disabled:cursor-not-allowed`}
                        >
                          {user.status === 'active' ? 'Active' : 'Suspended'}
                        </button>
                      </div>
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => handleOpenEdit(user)}
                          className="p-1.5 text-text-muted hover:text-primary hover:bg-bg-page rounded-btn transition-all duration-150"
                          title="Edit Credentials"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleOpenDelete(user)}
                          disabled={user.id === currentSession?.userId}
                          className="p-1.5 text-text-muted hover:text-danger-custom hover:bg-bg-page rounded-btn transition-all duration-150 disabled:opacity-30 disabled:cursor-not-allowed"
                          title="Delete User"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      {/* --- ADD/EDIT USER MODAL --- */}
      <Modal
        isOpen={showAddEditModal}
        onClose={() => setShowAddEditModal(false)}
        title={editingUser ? 'Edit credentials' : 'Add user'}
      >
        <form onSubmit={handleSaveUser} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="usrName">Username *</label>
            <input
              id="usrName"
              type="text"
              placeholder="e.g. jdoe"
              value={username}
              disabled={!!editingUser}
              onChange={(e) => setUsername(e.target.value)}
              className={formError && !username ? 'border-danger-custom' : ''}
              autoComplete="off"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="usrFull">Full name *</label>
            <input
              id="usrFull"
              type="text"
              placeholder="e.g. John Doe"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className={formError && !fullName ? 'border-danger-custom' : ''}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="usrPass">Password *</label>
            <input
              id="usrPass"
              type="password"
              placeholder="Minimum 4 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={formError && (!password || password.length < 4) ? 'border-danger-custom' : ''}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="usrConfirm">Confirm password *</label>
            <input
              id="usrConfirm"
              type="password"
              placeholder="Re-enter password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className={formError && password !== confirmPassword ? 'border-danger-custom' : ''}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="usrRole">Role *</label>
            <select
              id="usrRole"
              value={userRole}
              onChange={(e) => setUserRole(e.target.value as any)}
              disabled={editingUser?.id === currentSession?.userId}
            >
              <option value="Administrator">Administrator</option>
              <option value="Restaurant Owner">Restaurant Owner</option>
            </select>
          </div>

          {formError && (
            <span className="text-[13px] text-danger-custom font-medium mt-1 sentence-case">
              {formError}
            </span>
          )}

          <div className="flex items-center gap-3 pt-2 border-t border-border">
            <button
              type="button"
              onClick={() => setShowAddEditModal(false)}
              className="flex-1 h-[36px] border border-border text-text-primary rounded-btn hover:bg-bg-page text-[14px] font-medium transition-colors duration-150"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 h-[36px] bg-primary text-white rounded-btn hover:bg-primary-dark text-[14px] font-medium transition-colors duration-150"
            >
              Save Credentials
            </button>
          </div>
        </form>
      </Modal>

      {/* --- DELETE CONFIRMATION DIALOG --- */}
      <Modal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        title="Confirm deletion"
      >
        <div className="flex flex-col gap-4">
          <p className="text-[14px] text-text-muted leading-relaxed sentence-case">
            Are you sure you want to delete user "{userToDelete?.username}"? This will terminate their billing account login credentials permanently.
          </p>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(false)}
              className="flex-1 h-[36px] border border-border text-text-primary rounded-btn hover:bg-bg-page text-[14px] font-medium transition-colors duration-150"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDeleteConfirm}
              className="flex-1 h-[36px] border border-danger-custom text-danger-custom rounded-btn hover:bg-danger-custom/5 text-[14px] font-medium transition-colors duration-150"
            >
              Delete
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
