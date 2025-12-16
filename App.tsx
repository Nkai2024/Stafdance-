import React, { useState, useEffect } from 'react';
import { Hospital, UserRole } from './types';
import { initMockData, loginHospital, importHospitalConfig, syncFromSupabase } from './services/storage';
import AdminDashboard from './components/AdminDashboard';
import HospitalPortal from './components/HospitalPortal';
import { Activity, Building2, Lock, Shield, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';

const App: React.FC = () => {
  // Auth State
  const [isAdmin, setIsAdmin] = useState(false);
  const [activeHospital, setActiveHospital] = useState<Hospital | null>(null);
  
  // Login Form State
  const [hospitalUser, setHospitalUser] = useState('');
  const [hospitalPass, setHospitalPass] = useState('');
  const [error, setError] = useState('');
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [adminKey, setAdminKey] = useState('');

  // Config Import State
  const [importStatus, setImportStatus] = useState<{success: boolean, message: string} | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    initMockData();

    // 1. Attempt Cloud Sync on Load
    const performSync = async () => {
      setIsSyncing(true);
      await syncFromSupabase();
      setIsSyncing(false);
    };
    performSync();

    // 2. Check for Config Link (Deep Link Sync)
    const params = new URLSearchParams(window.location.search);
    const config = params.get('config');
    if (config) {
      const result = importHospitalConfig(config);
      setImportStatus(result);
      // Clean URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const handleHospitalLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const hospital = loginHospital(hospitalUser, hospitalPass);
    if (hospital) {
      setActiveHospital(hospital);
      setError('');
    } else {
      setError('Invalid Credentials. Please try again.');
    }
  };

  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    // Simple mock admin check
    if (adminKey === 'admin123') {
      setIsAdmin(true);
      setError('');
    } else {
      setError('Invalid System Admin Key');
    }
  };

  const handleLogout = () => {
    setActiveHospital(null);
    setIsAdmin(false);
    setHospitalUser('');
    setHospitalPass('');
    setAdminKey('');
  };

  // --- RENDER ---

  // 1. Super Admin View
  if (isAdmin) {
    return (
      <div className="min-h-screen bg-slate-50">
        <AdminDashboard onLogout={handleLogout} />
      </div>
    );
  }

  // 2. Hospital Portal (Staff & Manager View)
  if (activeHospital) {
    return (
      <div className="min-h-screen bg-slate-50">
        <HospitalPortal hospital={activeHospital} onLogout={handleLogout} />
      </div>
    );
  }

  // 3. Login Screen
  return (
    <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-4">
       {importStatus && (
        <div className={`fixed top-4 left-0 right-0 max-w-md mx-auto p-4 rounded-lg shadow-xl flex items-center gap-3 animate-bounce ${importStatus.success ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
           {importStatus.success ? <CheckCircle2 className="w-6 h-6" /> : <AlertCircle className="w-6 h-6" />}
           <div>
             <div className="font-bold">{importStatus.success ? 'Setup Complete!' : 'Error'}</div>
             <div className="text-sm">{importStatus.message}</div>
           </div>
           <button onClick={() => setImportStatus(null)} className="ml-auto text-white/80 hover:text-white">✕</button>
        </div>
      )}

      {isSyncing && (
         <div className="fixed top-4 right-4 bg-white/90 p-2 rounded-full shadow-lg flex items-center gap-2 text-xs font-bold text-blue-600 z-50">
            <RefreshCw className="w-4 h-4 animate-spin" /> Syncing...
         </div>
      )}

      <div className="bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden border border-slate-200">
        <div className="bg-blue-600 p-8 text-center text-white">
          <Activity className="w-12 h-12 mx-auto mb-3" />
          <h1 className="text-2xl font-bold">MediGuard</h1>
          <p className="text-blue-100 text-sm">Hospital Attendance System</p>
        </div>

        <div className="p-8">
          {!showAdminLogin ? (
            <form onSubmit={handleHospitalLogin} className="space-y-4">
              <div className="text-center mb-6">
                <h2 className="text-lg font-semibold text-slate-800">Hospital Login</h2>
                <p className="text-sm text-slate-500">Enter your hospital credentials to access staff portal.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Hospital Username</label>
                <div className="relative">
                  <input
                    type="text"
                    value={hospitalUser}
                    onChange={e => setHospitalUser(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="Username"
                    required
                  />
                  <Building2 className="w-5 h-5 text-slate-400 absolute left-3 top-3.5" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
                <div className="relative">
                  <input
                    type="password"
                    value={hospitalPass}
                    onChange={e => setHospitalPass(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="••••••••"
                    required
                  />
                  <Lock className="w-5 h-5 text-slate-400 absolute left-3 top-3.5" />
                </div>
              </div>

              {error && <div className="text-red-600 text-sm text-center bg-red-50 p-2 rounded">{error}</div>}

              <button type="submit" className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 transition shadow-lg shadow-blue-200">
                Enter Hospital Portal
              </button>

              <div className="mt-4 pt-4 border-t text-center">
                <button type="button" onClick={() => setShowAdminLogin(true)} className="text-xs text-slate-400 hover:text-blue-600">
                  System Admin Login
                </button>
              </div>
            </form>
          ) : (
             <form onSubmit={handleAdminLogin} className="space-y-4">
              <div className="text-center mb-6">
                <h2 className="text-lg font-semibold text-slate-800 flex items-center justify-center gap-2">
                  <Shield className="w-5 h-5" /> System Admin
                </h2>
                <p className="text-sm text-slate-500">For registering new hospitals only.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">System Key</label>
                <input
                  type="password"
                  value={adminKey}
                  onChange={e => setAdminKey(e.target.value)}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 outline-none"
                  placeholder="Enter Key (admin123)"
                  autoFocus
                />
              </div>

              {error && <div className="text-red-600 text-sm text-center bg-red-50 p-2 rounded">{error}</div>}

              <button type="submit" className="w-full bg-slate-800 text-white py-3 rounded-lg font-bold hover:bg-slate-900 transition">
                Access Control Panel
              </button>

              <div className="mt-4 text-center">
                <button type="button" onClick={() => setShowAdminLogin(false)} className="text-sm text-blue-600 hover:underline">
                  Back to Hospital Login
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default App;