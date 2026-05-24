/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { UserRecord, LoginSessionLog } from '../types';
import { Shield, ShieldAlert, UserCheck, UserPlus, Key, Eye, UserX, ToggleLeft, ToggleRight, Check, X, ShieldCheck, Database, Trash2, ShieldX } from 'lucide-react';

interface UserAccessManagerProps {
  users: UserRecord[];
  currentUser: UserRecord;
  onAddUser: (user: Omit<UserRecord, 'id'>) => void;
  onEditUser: (user: UserRecord) => void;
  onDeleteUser: (id: string) => void;
  onChangeCurrentUser: (user: UserRecord) => void;
  loginSessionLogs: LoginSessionLog[];
  onClearLogs?: () => void;
}

export default function UserAccessManager({
  users,
  currentUser,
  onAddUser,
  onEditUser,
  onDeleteUser,
  onChangeCurrentUser,
  loginSessionLogs,
  onClearLogs,
}: UserAccessManagerProps) {
  const [subTab, setSubTab] = useState<'matrix' | 'session_logs'>('matrix');
  const [logFilter, setLogFilter] = useState<'All' | 'SUCCESS' | 'FAILED'>('All');
  const [logSearch, setLogSearch] = useState('');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRecord | null>(null);
  const [newMustChangePassword, setNewMustChangePassword] = useState(true);

  // Form states for adding
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<'Admin' | 'Manager' | 'Staff'>('Staff');
  const [permissions, setPermissions] = useState<{
    canEditItems: boolean;
    canEditSuppliers: boolean;
    canEditPurchaseOrders: boolean;
    canEditSalesOrders: boolean;
    canManageUsers: boolean;
    canAdjustStock: boolean;
    canRevertLifecycle: boolean;
    canSeePricing: boolean;
    canViewAuditHistories: boolean;
    allowedTabs: string[];
  }>({
    canEditItems: false,
    canEditSuppliers: false,
    canEditPurchaseOrders: false,
    canEditSalesOrders: false,
    canManageUsers: false,
    canAdjustStock: false,
    canRevertLifecycle: false,
    canSeePricing: false,
    canViewAuditHistories: true,
    allowedTabs: ['dashboard', 'items', 'purchase', 'sales', 'warehouses', 'suppliers', 'customers', 'fifo-lots', 'machine-logs']
  });

  const resetAddForm = () => {
    setNewName('');
    setNewEmail('');
    setNewRole('Staff');
    setNewMustChangePassword(true);
    setPermissions({
      canEditItems: false,
      canEditSuppliers: false,
      canEditPurchaseOrders: false,
      canEditSalesOrders: false,
      canManageUsers: false,
      canAdjustStock: false,
      canRevertLifecycle: false,
      canSeePricing: false,
      canViewAuditHistories: true,
      allowedTabs: ['dashboard', 'items', 'purchase', 'sales', 'warehouses', 'suppliers', 'customers', 'fifo-lots', 'machine-logs']
    });
  };

  const handleRoleChange = (role: 'Admin' | 'Manager' | 'Staff') => {
    setNewRole(role);
    if (role === 'Admin') {
      setPermissions({
        canEditItems: true,
        canEditSuppliers: true,
        canEditPurchaseOrders: true,
        canEditSalesOrders: true,
        canManageUsers: true,
        canAdjustStock: true,
        canRevertLifecycle: true,
        canSeePricing: true,
        canViewAuditHistories: true,
        allowedTabs: ['dashboard', 'items', 'purchase', 'sales', 'warehouses', 'suppliers', 'customers', 'fifo-lots', 'tracking-hub', 'user-security', 'reports', 'machine-logs']
      });
    } else if (role === 'Manager') {
      setPermissions({
        canEditItems: true,
        canEditSuppliers: true,
        canEditPurchaseOrders: true,
        canEditSalesOrders: true,
        canManageUsers: false,
        canAdjustStock: true,
        canRevertLifecycle: true,
        canSeePricing: true,
        canViewAuditHistories: true,
        allowedTabs: ['dashboard', 'items', 'purchase', 'sales', 'warehouses', 'suppliers', 'customers', 'fifo-lots', 'tracking-hub', 'user-security', 'reports', 'machine-logs']
      });
    } else {
      setPermissions({
        canEditItems: false,
        canEditSuppliers: false,
        canEditPurchaseOrders: false,
        canEditSalesOrders: false,
        canManageUsers: false,
        canAdjustStock: false,
        canRevertLifecycle: false,
        canSeePricing: false,
        canViewAuditHistories: true,
        allowedTabs: ['dashboard', 'items', 'purchase', 'sales', 'warehouses', 'suppliers', 'customers', 'fifo-lots', 'machine-logs']
      });
    }
  };

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName || !newEmail) return;

    onAddUser({
      name: newName,
      email: newEmail,
      role: newRole,
      status: 'Active',
      mustChangePassword: newMustChangePassword,
      permissions,
    });

    resetAddForm();
    setIsAddOpen(false);
  };

  const handleTogglePermission = (user: UserRecord, key: keyof UserRecord['permissions']) => {
    if (currentUser.role !== 'Admin') {
      alert("⚠️ ACCESS DENIED! Only administrators are authorized to select or modify user permissions.");
      return;
    }
    if (user.role === 'Admin' && key === 'canManageUsers') {
      alert("Admin accounts must always retain user management permissions.");
      return;
    }
    const updated = {
      ...user,
      permissions: {
        ...user.permissions,
        [key]: !user.permissions[key],
      },
    };
    onEditUser(updated);
  };

  const handleStatusToggle = (user: UserRecord) => {
    if (user.id === currentUser.id) {
      alert("You cannot deactivate the active session profile.");
      return;
    }
    const updated = {
      ...user,
      status: (user.status === 'Active' ? 'Inactive' : 'Active') as 'Active' | 'Inactive',
    };
    onEditUser(updated);
  };

  const hasAccessToSettings = currentUser.role === 'Admin' || currentUser.permissions.canManageUsers;

  return (
    <div className="space-y-6 text-left">
      {/* Simulation Banner Selector */}
      <div className="bg-white text-slate-800 p-5 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4 border border-slate-200 shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-1 px-2 text-[10px] font-bold bg-indigo-600 text-white rounded font-mono uppercase tracking-wider">Active Demo Role</span>
            <span className="text-[11px] text-indigo-600 font-bold tracking-tight">Access Controller Sim</span>
          </div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight">Currently Simulating: <span className="text-emerald-600">{currentUser.name}</span></h2>
          <p className="text-xs text-slate-500">
            Current capabilities: {Object.entries(currentUser.permissions)
              .filter(([_, allowed]) => allowed)
              .map(([key]) => key.replace('can', ''))
              .join(', ') || 'Read-Only Access'}
          </p>
        </div>
        <div>
          <label className="text-xs text-slate-500 block font-bold mb-1.5 font-mono">CHANGE LOGGED-IN SIM USER:</label>
          <select
            value={currentUser.id}
            onChange={(e) => {
              const matched = users.find(u => u.id === e.target.value);
              if (matched) onChangeCurrentUser(matched);
            }}
            className="text-xs font-bold px-4 py-2 bg-white text-slate-800 rounded-lg border border-slate-300 outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer min-w-[220px]"
          >
            {users.map(u => (
              <option key={u.id} value={u.id}>
                {u.name} ({u.role})
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-gray-100">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">User accounts & Access Controls</h1>
          <p className="text-sm text-gray-500">
            Define system roles (Admin, Manager, Staff) and administer discrete feature permissions standard to your operations.
          </p>
        </div>
        {hasAccessToSettings && subTab === 'matrix' && (
          <button
            onClick={() => setIsAddOpen(true)}
            className="inline-flex items-center gap-2 justify-center px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-xs font-bold text-white rounded-lg transition-colors cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>Create User Account</span>
          </button>
        )}
      </div>

      {/* Sub tabs navigation row */}
      <div className="flex border-b border-slate-200 gap-1.5 pt-1.5">
        <button
          onClick={() => setSubTab('matrix')}
          className={`px-4.5 py-2.5 text-xs font-bold border-b-2 flex items-center gap-2 transition-all cursor-pointer ${
            subTab === 'matrix' ? 'border-indigo-600 text-indigo-700 font-extrabold' : 'border-transparent text-slate-500 hover:text-slate-705'
          }`}
        >
          <Shield className="w-4 h-4 text-indigo-600" />
          <span>User Permissions Matrix Matrix</span>
        </button>
        {currentUser.permissions.canViewAuditHistories !== false && (
          <button
            onClick={() => setSubTab('session_logs')}
            className={`px-4.5 py-2.5 text-xs font-bold border-b-2 flex items-center gap-2 transition-all cursor-pointer ${
              subTab === 'session_logs' ? 'border-indigo-600 text-indigo-700 font-extrabold' : 'border-transparent text-slate-500 hover:text-slate-705'
            }`}
          >
            <Key className="w-4 h-4 text-emerald-600" />
            <span>Session Logs Journal ({loginSessionLogs.length})</span>
          </button>
        )}
      </div>

      {subTab === 'matrix' || currentUser.permissions.canViewAuditHistories === false ? (
        !hasAccessToSettings ? (
          <div className="bg-amber-50 border border-amber-200 p-6 rounded-xl text-center space-y-3">
            <ShieldAlert className="w-12 h-12 text-amber-500 mx-auto" />
            <h3 className="text-base font-bold text-amber-900">Permission Restricted</h3>
            <p className="text-xs text-amber-700 max-w-md mx-auto">
              You are currently logged in as a <strong>{currentUser.role}</strong> without User Management access. 
              Use the top simulation dropdown to switch to the <strong>John Silverio (Admin)</strong> profile to edit users.
            </p>
          </div>
        ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* User Table Card */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-gray-100 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-gray-50 bg-gray-50/50">
              <h3 className="text-xs font-bold uppercase text-gray-600 font-mono tracking-wider">Registered System Users</h3>
            </div>
            <div className="divide-y divide-gray-50 max-h-[60vh] overflow-y-auto">
              {users.map(user => {
                const isAdmin = user.role === 'Admin';
                const isCurrent = user.id === currentUser.id;
                return (
                  <div key={user.id} className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors hover:bg-slate-50/30">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className={`p-2.5 rounded-lg shrink-0 ${
                        user.role === 'Admin' ? 'bg-indigo-50 text-indigo-600' :
                        user.role === 'Manager' ? 'bg-indigo-50/40 text-slate-600' : 'bg-gray-100 text-gray-500'
                      }`}>
                        <Shield className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 text-left">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-gray-900 truncate block">{user.name}</span>
                          {isCurrent && (
                            <span className="px-1.5 py-0.5 text-[8px] font-bold bg-emerald-100 text-emerald-800 rounded uppercase font-mono tracking-wide">
                              Active Sim
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-gray-400 block truncate font-mono">{user.email}</span>
                        <div className="mt-1 flex items-center gap-2.5">
                          <span className={`px-2 py-0.5 text-[10px] font-bold rounded-lg ${
                            user.role === 'Admin' ? 'bg-indigo-600 text-white' :
                            user.role === 'Manager' ? 'bg-slate-700 text-slate-100' : 'bg-gray-150 text-gray-600'
                          }`}>
                            {user.role}
                          </span>
                          {user.isApproved === false ? (
                            <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-100 text-amber-700 border border-amber-200 animate-pulse font-mono flex items-center gap-1">
                              Pending Approval
                            </span>
                          ) : (
                            <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                              user.status === 'Active' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                            }`}>
                              {user.status}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 px-1">
                      {/* Active Toggle or Approve Toggle */}
                      {user.isApproved === false ? (
                        <button
                          onClick={() => {
                            if (currentUser.role !== 'Admin') {
                              alert("⚠️ ACCESS DENIED! Only administrators are authorized to select or approve user profiles.");
                              return;
                            }
                            const updated = {
                              ...user,
                              isApproved: true,
                              status: 'Active' as const
                            };
                            onEditUser(updated);
                          }}
                          className="text-xs font-bold flex items-center gap-1 px-3 py-1.5 bg-emerald-650 hover:bg-emerald-700 text-white rounded-lg cursor-pointer transition-colors shadow-xs"
                        >
                          <ShieldCheck className="w-3.5 h-3.5" />
                          <span>Approve User</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => handleStatusToggle(user)}
                          disabled={isCurrent}
                          className={`text-xs font-bold flex items-center gap-1.5 px-2.5 py-1.5 border border-gray-200 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors disabled:opacity-30 disabled:cursor-not-allowed`}
                          title={isCurrent ? "Cannot deactivate yourself" : "Toggle active status"}
                        >
                          {user.status === 'Active' ? (
                            <span className="text-emerald-600 flex items-center gap-1"><UserCheck className="w-3.5 h-3.5" /> Deactivate</span>
                          ) : (
                            <span className="text-rose-500 flex items-center gap-1"><UserX className="w-3.5 h-3.5" /> Activate</span>
                          )}
                        </button>
                      )}

                      {/* Delete buttons for simulated profiles */}
                      <button
                        onClick={() => {
                          if (window.confirm(`Delete simulated profile for ${user.name}?`)) {
                            onDeleteUser(user.id);
                          }
                        }}
                        disabled={isCurrent || user.role === 'Admin'}
                        className="px-2.5 py-1.5 text-xs text-red-600 hover:text-red-800 border border-transparent hover:border-red-150 hover:bg-rose-50 rounded-lg cursor-pointer transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Quick Capability Matrix Configurator */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-xs p-5">
            <div className="flex items-center gap-2 mb-3.5 pb-2 border-b border-gray-50">
              <Key className="w-4 h-4 text-indigo-600" />
              <h3 className="text-xs font-extrabold text-gray-900 uppercase tracking-widest font-mono">Permission Matrix</h3>
            </div>
            {currentUser.role !== 'Admin' && (
              <div className="mb-4 p-3 bg-amber-50 border border-amber-250 text-amber-900 rounded-lg text-xs font-semibold flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
                <span>⚠️ VIEW-ONLY PRIVILEGES: Only simulation profiles with <b>Admin</b> role can toggle permission capabilities and select viewable system components.</span>
              </div>
            )}
            <p className="text-[11px] text-gray-500 mb-4 font-normal">
              Directly edit and toggle user permissions below. Changes take effect instantly for that user profile.
            </p>

            <div className="space-y-4">
              {users.map(u => (
                <div key={u.id} className="p-3 bg-gray-50 rounded-lg space-y-2 border border-gray-100">
                  <div className="flex justify-between items-center pb-1 border-b border-gray-200">
                    <span className="text-xs font-bold text-indigo-900">{u.name} ({u.role})</span>
                    <button
                      disabled={currentUser.role !== 'Admin'}
                      onClick={() => {
                        onEditUser({
                          ...u,
                          mustChangePassword: !u.mustChangePassword
                        });
                      }}
                      className={`px-1.5 py-0.5 text-[8px] font-bold rounded font-mono uppercase cursor-pointer select-none transition-all ${
                        u.mustChangePassword ? 'bg-amber-100 text-amber-800' : 'bg-slate-200/80 text-slate-500 hover:bg-slate-300'
                      }`}
                      title={u.mustChangePassword ? 'Click to cancel password reset requirement' : 'Force user to reset password on next login'}
                    >
                      {u.mustChangePassword ? 'PWD Update Required' : 'Force Pwd Reset'}
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[10px]">
                    <button
                      onClick={() => handleTogglePermission(u, 'canEditItems')}
                      disabled={currentUser.role !== 'Admin' || u.role === 'Admin'}
                      className={`flex justify-between items-center p-1 px-2 rounded font-semibold text-left select-none cursor-pointer ${
                        u.permissions.canEditItems ? 'bg-indigo-50 text-indigo-800' : 'bg-white text-gray-400 border border-gray-200'
                      }`}
                    >
                      <span>Edit Items</span>
                      {u.permissions.canEditItems ? <Check className="w-3 h-3 text-indigo-600" /> : <X className="w-3 h-3" />}
                    </button>

                    <button
                      onClick={() => handleTogglePermission(u, 'canEditSuppliers')}
                      disabled={currentUser.role !== 'Admin' || u.role === 'Admin'}
                      className={`flex justify-between items-center p-1 px-2 rounded font-semibold text-left select-none cursor-pointer ${
                        u.permissions.canEditSuppliers ? 'bg-indigo-50 text-indigo-800' : 'bg-white text-gray-400 border border-gray-200'
                      }`}
                    >
                      <span>Edit Suppliers</span>
                      {u.permissions.canEditSuppliers ? <Check className="w-3 h-3 text-indigo-600" /> : <X className="w-3 h-3" />}
                    </button>

                    <button
                      onClick={() => handleTogglePermission(u, 'canEditPurchaseOrders')}
                      disabled={currentUser.role !== 'Admin' || u.role === 'Admin'}
                      className={`flex justify-between items-center p-1 px-2 rounded font-semibold text-left select-none cursor-pointer ${
                        u.permissions.canEditPurchaseOrders ? 'bg-indigo-50 text-indigo-800' : 'bg-white text-gray-400 border border-gray-200'
                      }`}
                    >
                      <span>Edit POs</span>
                      {u.permissions.canEditPurchaseOrders ? <Check className="w-3 h-3 text-indigo-600" /> : <X className="w-3 h-3" />}
                    </button>

                    <button
                      onClick={() => handleTogglePermission(u, 'canEditSalesOrders')}
                      disabled={currentUser.role !== 'Admin' || u.role === 'Admin'}
                      className={`flex justify-between items-center p-1 px-2 rounded font-semibold text-left select-none cursor-pointer ${
                        u.permissions.canEditSalesOrders ? 'bg-indigo-50 text-indigo-800' : 'bg-white text-gray-400 border border-gray-200'
                      }`}
                    >
                      <span>Edit SOs</span>
                      {u.permissions.canEditSalesOrders ? <Check className="w-3 h-3 text-indigo-600" /> : <X className="w-3 h-3" />}
                    </button>

                    <button
                      onClick={() => handleTogglePermission(u, 'canAdjustStock')}
                      disabled={currentUser.role !== 'Admin' || u.role === 'Admin'}
                      className={`flex justify-between items-center p-1 px-2 rounded font-semibold text-left select-none cursor-pointer ${
                        u.permissions.canAdjustStock ? 'bg-indigo-50 text-indigo-800' : 'bg-white text-gray-400 border border-gray-200'
                      }`}
                    >
                      <span>Adjust Stock</span>
                      {u.permissions.canAdjustStock ? <Check className="w-3 h-3 text-indigo-600" /> : <X className="w-3 h-3" />}
                    </button>

                    <button
                      onClick={() => handleTogglePermission(u, 'canManageUsers')}
                      disabled={currentUser.role !== 'Admin' || u.role === 'Admin'}
                      className={`flex justify-between items-center p-1 px-2 rounded font-semibold text-left select-none cursor-pointer ${
                        u.permissions.canManageUsers ? 'bg-indigo-50 text-indigo-800' : 'bg-white text-gray-400 border border-gray-200'
                      }`}
                    >
                      <span>Manage Users</span>
                      {u.permissions.canManageUsers ? <Check className="w-3 h-3 text-indigo-600" /> : <X className="w-3 h-3" />}
                    </button>

                    <button
                      onClick={() => handleTogglePermission(u, 'canRevertLifecycle')}
                      disabled={currentUser.role !== 'Admin' || u.role === 'Admin'}
                      className={`flex justify-between items-center p-1 px-2 rounded font-semibold text-left select-none cursor-pointer ${
                        u.permissions.canRevertLifecycle ? 'bg-indigo-50 text-indigo-800' : 'bg-white text-gray-400 border border-gray-200'
                      }`}
                    >
                      <span>Revert Lifecycle</span>
                      {u.permissions.canRevertLifecycle ? <Check className="w-3 h-3 text-indigo-600" /> : <X className="w-3 h-3" />}
                    </button>

                    <button
                      onClick={() => handleTogglePermission(u, 'canSeePricing')}
                      disabled={currentUser.role !== 'Admin' || u.role === 'Admin'}
                      className={`flex justify-between items-center p-1 px-2 rounded font-semibold text-left select-none cursor-pointer ${
                        u.permissions.canSeePricing ? 'bg-indigo-50 text-indigo-800' : 'bg-white text-gray-450 border border-gray-200'
                      }`}
                      title="Admin can select which user can see cost/pricing of inventory items"
                    >
                      <span>See Pricing/Costs</span>
                      {u.permissions.canSeePricing ? <Check className="w-3 h-3 text-indigo-650" /> : <X className="w-3 h-3" />}
                    </button>

                    <button
                      onClick={() => handleTogglePermission(u, 'canViewAuditHistories')}
                      disabled={currentUser.role !== 'Admin' || u.role === 'Admin'}
                      className={`flex justify-between items-center p-1 px-2 rounded font-semibold text-left select-none cursor-pointer ${
                        u.permissions.canViewAuditHistories ? 'bg-indigo-50 text-indigo-800' : 'bg-white text-gray-450 border border-gray-200'
                      }`}
                      title="Admin can choose who can see audit histories"
                    >
                      <span>See Audit History</span>
                      {u.permissions.canViewAuditHistories ? <Check className="w-3 h-3 text-indigo-650" /> : <X className="w-3 h-3" />}
                    </button>
                  </div>

                  {/* Component tab visibility selector */}
                  <div className="pt-2.5 border-t border-slate-200/80 mt-2 space-y-1.5 text-left">
                    <span className="text-[9px] font-black text-slate-500 uppercase font-mono block">Allowed Views & Components</span>
                    <div className="grid grid-cols-2 gap-1 text-[9px]">
                      {[
                        { id: 'dashboard', name: 'Dashboard' },
                        { id: 'items', name: 'Inventory Catalog' },
                        { id: 'purchase', name: 'Purchase Orders' },
                        { id: 'sales', name: 'Sales Orders' },
                        { id: 'warehouses', name: 'Warehouse Hubs' },
                        { id: 'suppliers', name: 'Supplier Profiles' },
                        { id: 'customers', name: 'Customer Database' },
                        { id: 'fifo-lots', name: 'FIFO Stock Lots' },
                        { id: 'reports', name: 'Business Reports' },
                        { id: 'tracking-hub', name: 'Receipts Tracking (DR/GR)' },
                        { id: 'machine-logs', name: 'Machine Logs' },
                        { id: 'user-security', name: 'User Access Matrix' }
                      ].map(tab => {
                        const currentTabs = u.permissions.allowedTabs || ['dashboard', 'items', 'purchase', 'sales', 'warehouses', 'suppliers', 'customers', 'fifo-lots', 'tracking-hub', 'user-security', 'reports', 'machine-logs'];
                        const isChecked = currentTabs.includes(tab.id);
                        return (
                          <label key={tab.id} className="flex items-center gap-1.5 text-slate-700 font-semibold cursor-pointer">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              disabled={currentUser.role !== 'Admin' || u.role === 'Admin'}
                              onChange={() => {
                                let updatedTabs: string[];
                                if (isChecked) {
                                  updatedTabs = currentTabs.filter(t => t !== tab.id);
                                } else {
                                  updatedTabs = [...currentTabs, tab.id];
                                }
                                onEditUser({
                                  ...u,
                                  permissions: {
                                    ...u.permissions,
                                    allowedTabs: updatedTabs
                                  }
                                });
                              }}
                              className="w-3 h-3 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                            />
                            <span className="truncate">{tab.name}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        )
      ) : (
        /* SESSION AUDIT LOGS JOURNAL LEDGER */
        <div id="session-logs-panel" className="space-y-4">
          <div className="bg-white border border-gray-150 rounded-xl p-5 shadow-xs space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 font-sans pb-3 border-b border-gray-100">
              <div>
                <h3 className="text-sm font-bold text-slate-800 font-mono">🔑 JOURNAL SECURITY ARCHIVE</h3>
                <p className="text-[11px] text-slate-400 mt-1">Real-time journal capturing all employee log-in authentication sessions and failsafe audits.</p>
              </div>

              {/* Action trigger & filters */}
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  placeholder="Search user email or logs..."
                  value={logSearch}
                  onChange={(e) => setLogSearch(e.target.value)}
                  className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono focus:outline-hidden focus:ring-1 focus:ring-indigo-500 w-full sm:w-[180px]"
                />
                <select
                  value={logFilter}
                  onChange={(e) => setLogFilter(e.target.value as any)}
                  className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 cursor-pointer"
                >
                  <option value="All">All Events</option>
                  <option value="SUCCESS">Success Only</option>
                  <option value="FAILED">Failure Only</option>
                </select>
                {onClearLogs && currentUser.role === 'Admin' && (
                  <button
                    onClick={() => {
                      if (confirm("Are you sure you want to completely flush the Security Audit Logs? This is irreversible.")) {
                        onClearLogs();
                      }
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg text-xs font-bold transition-all cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Flush Ledger</span>
                  </button>
                )}
              </div>
            </div>

            {/* Logs Table / List Ledger */}
            <div className="overflow-x-auto rounded-xl border border-gray-100">
              <table className="min-w-full divide-y divide-gray-150 text-xs">
                <thead className="bg-slate-50 text-slate-500 font-mono font-semibold uppercase text-left">
                  <tr>
                    <th className="px-5 py-3 text-[10px]">Timestamp</th>
                    <th className="px-5 py-3 text-[10px]">Employee Identity Details & Email</th>
                    <th className="px-5 py-3 text-[10px]">Assigned Role</th>
                    <th className="px-5 py-3 text-[10px]">Authentication Status</th>
                    <th className="px-5 py-3 text-[10px] text-right">Failsafe Remark / Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 font-sans text-slate-700 bg-white">
                  {(() => {
                    const filtered = loginSessionLogs.filter((log) => {
                      const matchesStatus = logFilter === 'All' || log.status === logFilter;
                      const term = logSearch.toLowerCase();
                      const matchesTerm =
                        log.userName.toLowerCase().includes(term) ||
                        log.userEmail.toLowerCase().includes(term) ||
                        (log.reason && log.reason.toLowerCase().includes(term));
                      return matchesStatus && matchesTerm;
                    });

                    if (filtered.length === 0) {
                      return (
                        <tr>
                          <td colSpan={5} className="text-center py-16 text-slate-400 font-medium">
                            <ShieldX className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                            No session authentication logs found matching criteria.
                          </td>
                        </tr>
                      );
                    }

                    return [...filtered].reverse().map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-5 py-3.5 whitespace-nowrap font-mono text-[10px] text-slate-500">
                          {log.timestamp}
                        </td>
                        <td className="px-5 py-3.5 leading-relaxed">
                          <span className="font-bold text-slate-900 block">{log.userName || 'Unknown Identity'}</span>
                          <span className="font-mono text-[9px] text-slate-400 block">{log.userEmail}</span>
                        </td>
                        <td className="px-5 py-3.5 whitespace-nowrap">
                          <span className={`px-2 py-0.5 text-[9px] font-bold rounded uppercase ${
                            log.userRole === 'Admin' ? 'bg-amber-100 text-amber-800' :
                            log.userRole === 'Manager' ? 'bg-indigo-50 text-indigo-700' : 'bg-slate-100 text-slate-600'
                          }`}>
                            {log.userRole || 'Staff'}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                            log.status === 'SUCCESS' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${log.status === 'SUCCESS' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                            {log.status === 'SUCCESS' ? 'SUCCESS' : 'FAILED'}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-right font-mono text-[11px] text-slate-500 max-w-[240px] truncate" title={log.reason}>
                          {log.reason || 'N/A Verification Logged'}
                        </td>
                      </tr>
                    ));
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* CREATE USER MODAL */}
      {isAddOpen && (
        <div className="fixed inset-0 bg-black/45 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden text-left animate-in zoom-in-95 duration-100">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-indigo-600" />
                <h3 className="text-base font-bold text-gray-900 font-mono">Register New User Account</h3>
              </div>
              <button onClick={() => { setIsAddOpen(false); resetAddForm(); }} className="p-1 hover:bg-gray-100 text-gray-400 rounded-md">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleAddSubmit}>
              <div className="p-5 space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-600">Employee Full Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Juan dela Cruz"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="w-full text-xs px-3.5 py-2 border border-gray-250 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-indigo-500 font-medium"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-600">Work Email Address *</label>
                  <input
                    type="email"
                    required
                    placeholder="e.g. j.delacruz@enterprise.ph"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    className="w-full text-xs px-3.5 py-2 border border-gray-250 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-indigo-500 font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-600">Base Role Class *</label>
                  <select
                    value={newRole}
                    onChange={(e) => handleRoleChange(e.target.value as any)}
                    className="w-full text-xs px-3.5 py-2 border border-gray-250 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-indigo-500 font-semibold text-slate-700 bg-white"
                  >
                    <option value="Admin">Admin (Full Overlord Permissions)</option>
                    <option value="Manager">Manager (Edit operations, no user listing)</option>
                    <option value="Staff">Staff (Default Read-Only / Custom-Toggleable)</option>
                  </select>
                </div>

                <div className="flex items-center gap-2 py-0.5">
                  <input
                    type="checkbox"
                    id="newMustChangePassword"
                    checked={newMustChangePassword}
                    onChange={(e) => setNewMustChangePassword(e.target.checked)}
                    className="w-3.5 h-3.5 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 cursor-pointer text-indigo-600"
                  />
                  <label htmlFor="newMustChangePassword" className="text-xs font-bold text-gray-700 cursor-pointer select-none">
                    Force Password Change on Initial Login
                  </label>
                </div>

                <div className="p-3 bg-gray-50 rounded-lg space-y-2 border border-gray-150">
                  <span className="text-[10px] font-bold text-gray-500 block uppercase tracking-wide">Privilege Assignments</span>
                  <div className="grid grid-cols-2 gap-2 text-[10px]">
                    {Object.entries(permissions).map(([key, allowed]) => (
                      <div key={key} className="flex items-center gap-1.5 p-1 font-medium text-slate-600">
                        <input
                          type="checkbox"
                          checked={allowed}
                          disabled={newRole === 'Admin' || newRole === 'Manager'}
                          onChange={() => setPermissions(prev => ({ ...prev, [key]: !prev[key as keyof typeof permissions] }))}
                          className="rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        />
                        <span className="capitalize">{key.replace('can', '').replace(/([A-Z])/g, ' $1')}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="p-4 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => { setIsAddOpen(false); resetAddForm(); }}
                  className="px-4 py-2 text-xs font-semibold text-gray-500 hover:bg-gray-100 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-xs font-bold text-white rounded-lg cursor-pointer"
                >
                  Save Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
