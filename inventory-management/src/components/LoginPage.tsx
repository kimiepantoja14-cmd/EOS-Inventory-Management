/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { UserRecord } from '../types';
import { Building2, ShieldCheck, Mail, Key, UserCheck, AlertCircle, Sparkles, UserPlus, ArrowLeft, Lock } from 'lucide-react';

interface LoginPageProps {
  users: UserRecord[];
  onLoginEvent: (user: UserRecord | null, emailEntered: string, isSuccess: boolean, reason?: string) => void;
  onAddUser?: (newUsr: Omit<UserRecord, 'id'>) => void;
  onEditUser?: (updatedUsr: UserRecord) => void;
}

export default function LoginPage({ users, onLoginEvent, onAddUser, onEditUser }: LoginPageProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Fields for registration
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regRole, setRegRole] = useState<'Manager' | 'Staff'>('Staff');

  // Fields for setting password first-time
  const [pendingPasswordSetupUser, setPendingPasswordSetupUser] = useState<UserRecord | null>(null);
  const [setupPassword, setSetupPassword] = useState('');
  const [setupConfirm, setSetupConfirm] = useState('');

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!email) {
      setErrorMessage('Please type a valid corporate email Address.');
      return;
    }

    let matchedUser = users.find(u => u.email.toLowerCase().trim() === email.toLowerCase().trim());

    // Shorthand alias support to prevent administrator login lockdown
    if (!matchedUser && (email.toLowerCase().trim() === 'admin' || email.toLowerCase().trim() === 'admin@equiprime.ph' || email.toLowerCase().trim() === 'admin@test.com')) {
      matchedUser = users.find(u => u.role === 'Admin');
    }

    if (!matchedUser) {
      onLoginEvent(null, email, false, 'Email address is not registered in central system.');
      setErrorMessage('Access Denied. Email address is not registered in the system.');
      return;
    }

    // Force system Admin account to always remain active and approved to prevent manual or state lockdown
    if (matchedUser.role === 'Admin') {
      matchedUser.isApproved = true;
      matchedUser.status = 'Active';
      if (!matchedUser.password) {
        matchedUser.password = '1234';
      }
    }

    if (!matchedUser.isApproved) {
      onLoginEvent(matchedUser, email, false, 'Account registration is pending Admin Approval.');
      setErrorMessage('⚠️ Access Pending. Your corporate account request is waiting for Admin approval.');
      return;
    }

    if (matchedUser.status === 'Inactive') {
      onLoginEvent(matchedUser, email, false, 'Corporate account is deactivated by Admin.');
      setErrorMessage('Deactivated Session. This account has been deactivated by an Administrator.');
      return;
    }

    // Checking if user has a password set
    if (!matchedUser.password) {
      // User is approved but hasn't configured a password yet
      setPendingPasswordSetupUser(matchedUser);
      return;
    }

    // Standard login validation
    if (password !== matchedUser.password) {
      onLoginEvent(matchedUser, email, false, 'Invalid PIN / password entered.');
      setErrorMessage('Incorrect password. Please verify your credentials and try again.');
      return;
    }

    // Checking if user must change password upon initial login
    if (matchedUser.mustChangePassword) {
      setPendingPasswordSetupUser(matchedUser);
      return;
    }

    // Success Authentication
    onLoginEvent(matchedUser, email, true, `Authenticated successfully using secure credentials.`);
  };

  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!regName || !regEmail) {
      setErrorMessage('Please complete all registration fields.');
      return;
    }

    const emailInUse = users.some(u => u.email.toLowerCase().trim() === regEmail.toLowerCase().trim());
    if (emailInUse) {
      setErrorMessage('This corporate email is already registered in our database.');
      return;
    }

    // Configure default permissions based on role
    const defaultPermissions = regRole === 'Manager' ? {
      canEditItems: true,
      canEditSuppliers: true,
      canEditPurchaseOrders: true,
      canEditSalesOrders: true,
      canManageUsers: false,
      canAdjustStock: true,
      canRevertLifecycle: true,
      canSeePricing: true,
      allowedTabs: ['dashboard', 'items', 'purchase', 'sales', 'warehouses', 'suppliers', 'customers', 'fifo-lots', 'tracking-hub', 'user-security', 'reports', 'machine-logs']
    } : {
      canEditItems: false,
      canEditSuppliers: false,
      canEditPurchaseOrders: false,
      canEditSalesOrders: false,
      canManageUsers: false,
      canAdjustStock: false,
      canRevertLifecycle: false,
      canSeePricing: true,
      allowedTabs: ['dashboard', 'items', 'purchase', 'sales', 'warehouses', 'suppliers', 'customers', 'fifo-lots', 'machine-logs']
    };

    if (onAddUser) {
      onAddUser({
        name: regName,
        email: regEmail,
        role: regRole,
        status: 'Inactive',
        isApproved: false,
        password: '',
        permissions: defaultPermissions
      });

      setSuccessMessage('🎉 Registration Request Submitted! An Admin must approve your profile before you can configure credentials.');
      setRegName('');
      setRegEmail('');
      setRegRole('Staff');
      setIsRegisterMode(false);
    } else {
      setErrorMessage('Internal registry error. Integration not found.');
    }
  };

  const handleSavePasswordSetup = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    
    if (!setupPassword) {
      setErrorMessage('Password cannot be empty.');
      return;
    }

    if (setupPassword !== setupConfirm) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    if (pendingPasswordSetupUser && onEditUser) {
      const updatedUser = {
        ...pendingPasswordSetupUser,
        password: setupPassword,
        mustChangePassword: false,
        status: 'Active' as const // Ensure active status
      };

      onEditUser(updatedUser);

      // Authenticate directly upon setting password
      onLoginEvent(updatedUser, updatedUser.email, true, 'Custom unique password set up successfully. Logging in.');
      setPendingPasswordSetupUser(null);
    }
  };

  return (
    <div id="login-container-root" className="min-h-screen w-full bg-[#0B0F19] flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans items-center relative overflow-hidden">
      {/* Decorative gradient glowing spots */}
      <div className="absolute top-[-10%] right-[-14%] w-[500px] h-[500px] rounded-full bg-indigo-600/15 blur-3xl" />
      <div className="absolute bottom-[-10%] left-[-14%] w-[500px] h-[500px] rounded-full bg-indigo-900/10 blur-3xl" />

      {/* Corporate Badge Header */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center z-10 space-y-3">
        <div className="inline-flex p-3 bg-indigo-600 text-white rounded-2xl shadow-xl shadow-indigo-500/10 border border-indigo-400/20">
          <Building2 className="w-8 h-8" />
        </div>
        <h2 className="text-3xl font-extrabold text-white tracking-tight">EOS Inventory Management</h2>
        <p className="text-xs text-slate-400 font-mono uppercase tracking-[0.16em]">
          🏢 Heavy Equipment Dispatches & Inventory Suite
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md z-10 px-4 sm:px-0">
        <div id="login-card-node" className="bg-[#111827] border border-slate-800 rounded-2xl shadow-2xl overflow-hidden p-6 sm:p-8 space-y-6">
          
          {/* PASSWORD SETUP FORM */}
          {pendingPasswordSetupUser ? (
            <div className="space-y-4 text-left">
              <div className="border-b border-slate-800 pb-4 text-center">
                <Lock className="w-7 h-7 text-indigo-400 mx-auto mb-2" />
                <h3 className="text-base font-bold text-slate-200">
                  {pendingPasswordSetupUser.mustChangePassword ? 'Reset Your Password' : 'Configure Credentials'}
                </h3>
                <p className="text-[11px] text-slate-400 mt-1 mt-0.5">
                  {pendingPasswordSetupUser.mustChangePassword
                    ? <>Security Policy: You are required to update your password before logging in, <b>{pendingPasswordSetupUser.name}</b>.</>
                    : <>Welcome <b>{pendingPasswordSetupUser.name}</b>! Your account was approved. Please set up your unique password below.</>}
                </p>
              </div>

              {errorMessage && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-300 rounded-lg flex items-start gap-2 text-[11px]">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <form onSubmit={handleSavePasswordSetup} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider block font-mono">
                    New Password / PIN:
                  </label>
                  <input
                    type="password"
                    required
                    value={setupPassword}
                    onChange={(e) => setSetupPassword(e.target.value)}
                    placeholder="Create a strong password"
                    className="w-full px-3.5 py-2 border border-slate-800 rounded-lg bg-slate-950 text-slate-100 font-mono text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider block font-mono">
                    Confirm Password:
                  </label>
                  <input
                    type="password"
                    required
                    value={setupConfirm}
                    onChange={(e) => setSetupConfirm(e.target.value)}
                    placeholder="Retype password to verify"
                    className="w-full px-3.5 py-2 border border-slate-800 rounded-lg bg-slate-950 text-slate-100 font-mono text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <div className="flex gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => setPendingPasswordSetupUser(null)}
                    className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-lg transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg transition-all cursor-pointer text-center"
                  >
                    Save & Sign In
                  </button>
                </div>
              </form>
            </div>
          ) : isRegisterMode ? (
            /* REGISTRATION REQUEST FORM */
            <div className="space-y-4 text-left animate-in fade-in duration-150">
              <div className="border-b border-slate-800 pb-4 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setIsRegisterMode(false)}
                  className="p-1.5 rounded-lg bg-slate-850 border border-slate-850 hover:border-slate-700 hover:bg-slate-800 text-slate-400 transition-colors cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <div>
                  <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wide">Register Account Request</h3>
                  <p className="text-[10px] text-slate-500 mt-0.5">Corporate onboarding authorization</p>
                </div>
              </div>

              {errorMessage && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-300 rounded-lg flex items-start gap-2 text-[11px]">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <form onSubmit={handleRegisterSubmit} className="space-y-4 text-xs font-sans">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider block font-mono">
                    Full Employee Name:
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. John Doe"
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    className="w-full px-3.5 py-2 border border-slate-800 rounded-lg bg-slate-950 text-slate-100 font-medium text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider block font-mono">
                    Corporate Email Address:
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="name@equiprime.ph"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    className="w-full px-3.5 py-2 border border-slate-800 rounded-lg bg-slate-950 text-slate-100 font-mono text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider block font-mono">
                    Requested Work Designation:
                  </label>
                  <select
                    value={regRole}
                    onChange={(e) => setRegRole(e.target.value as 'Manager' | 'Staff')}
                    className="w-full px-3.5 py-2 border border-slate-800 rounded-lg bg-slate-950 text-slate-200 font-semibold text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                  >
                    <option value="Staff">Staff (Operations and Dispatches)</option>
                    <option value="Manager">Manager (Planning and Approvals)</option>
                  </select>
                </div>

                <button
                  type="submit"
                  className="w-full flex justify-center items-center gap-1.5 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-lg transition-all select-none cursor-pointer"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>Submit Access Request</span>
                </button>
              </form>
            </div>
          ) : (
            /* STANDARD INTRUSION-SAFE LOGIN FORM */
            <div className="space-y-4 text-left animate-in fade-in duration-150">
              <div className="border-b border-slate-800 pb-4 text-center">
                <h3 className="text-sm font-bold text-slate-200">Authenticate Staff Session</h3>
                <p className="text-[11px] text-slate-500 mt-1">
                  Input security gate parameters to launch workspace session.
                </p>
              </div>

              {successMessage && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg flex items-start gap-1.5 text-[11px] leading-relaxed">
                  <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
                  <span>{successMessage}</span>
                </div>
              )}

              {errorMessage && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-300 rounded-lg flex items-start gap-2 text-[11px] leading-relaxed">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <form onSubmit={handleFormSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider block font-mono">
                    Corporate Email Address:
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                    <input
                      type="email"
                      required
                      placeholder="e.g. employee@equiprime.ph"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 border border-slate-800 rounded-lg bg-slate-950 text-slate-100 font-medium text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider block font-mono">
                    Password / Gate PIN:
                  </label>
                  <div className="relative">
                    <Key className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                    <input
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 border border-slate-800 rounded-lg bg-slate-950 text-slate-100 font-mono text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 text-xs bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-850 text-white font-extrabold rounded-lg flex items-center justify-center gap-1.5 transition-all select-none cursor-pointer"
                >
                  <UserCheck className="w-4 h-4" />
                  Authenticate & Launch
                </button>
              </form>

              <div className="pt-4 border-t border-slate-900 flex justify-between items-center text-[11px]">
                <button
                  onClick={() => setIsRegisterMode(true)}
                  className="text-indigo-400 hover:text-indigo-305 transition-colors font-medium flex items-center gap-1 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Register Employee Request
                </button>
                <span className="text-slate-600 font-mono">Gate v2.4</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
