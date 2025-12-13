import React, { useState, useEffect } from 'react';
import { User, UserRole } from './types';
import { validateAndLoginUser, initMockData, getUsers, getOrCreateDeviceId } from './services/storage';
import AdminDashboard from './components/AdminDashboard';
import StaffDashboard from './components/StaffDashboard';
import { Activity, Lock, Stethoscope, Shield, User as UserIcon, Smartphone, WifiOff, Wifi, CloudLightning } from 'lucide-react';

// Main App Component
const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const [currentDeviceId, setCurrentDeviceId] = useState('');
  
  // Network State
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showSyncMsg, setShowSyncMsg] = useState(false);

  useEffect(() => {
    initMockData();
    // Load users for the demo quick-login list
    setAvailableUsers(getUsers());
    setCurrentDeviceId(getOrCreateDeviceId());

    // Network Listeners
    const handleOnline = () => {
      setIsOnline(true);
      setShowSyncMsg(true);
      // Hide sync message after 3 seconds
      setTimeout(() => setShowSyncMsg(false), 3000);
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    performLogin(username);
  };

  const performLogin = (uName: string) => {
    const result = validateAndLoginUser(uName);
    
    if (result.success && result.user) {
      setUser(result.user);
      setError('');
    } else {
      setError(result.error || 'Login failed.');
    }
  };

  const handleLogout = () => {
    setUser(null);
    setUsername('');
    // Refresh the list when logging out, so newly created staff appear
    setAvailableUsers(getUsers());
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Network Status Bar */}
      {!isOnline && (
        <div className="bg-amber-500 text-white text-xs font-bold text-center py-1 flex items-center justify-center gap-2">
          <WifiOff className="w-3 h-3" /> Offline Mode: Attendance data is saving locally and will sync when connection restores.
        </div>
      )}
      {showSyncMsg && isOnline && (
        <div className="bg-green-600 text-white text-xs font-bold text-center py-1 flex items-center justify-center gap-2 animate-pulse">
          <CloudLightning className="w-3 h-3" /> Connection Restored: Data Synchronized.
        </div>
      )}

      {user ? (
        <>
          <header className="bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm">
            <div className="max-w-6xl mx-auto px-4 py-3 flex justify-between items-center">
               <div className="flex items-center gap-2 text-blue-700">
                 <Activity className="w-6 h-6" />
                 <h1 className="text-xl font-bold tracking-tight">MediGuard</h1>
               </div>
               <div className="flex items-center gap-4">
                  <span className="text-sm text-slate-500 hidden sm:block">
                    {user.role === UserRole.ADMIN ? 'Administrator' : 'Staff Member'}
                  </span>
                  <button 
                    onClick={handleLogout}
                    className="text-sm font-medium text-slate-600 hover:text-blue-700"
                  >
                    Logout
                  </button>
               </div>
            </div>
          </header>
          <main className="py-6 flex-grow">
            {user.role === UserRole.ADMIN ? (
              <AdminDashboard onSwitchUser={setUser} />
            ) : (
              <StaffDashboard user={user} onLogout={handleLogout} />
            )}
          </main>
        </>
      ) : (
        <div className="flex-grow flex flex-col items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden">
            {/* Header Gradient Blue to Green */}
            <div className="bg-gradient-to-br from-blue-600 to-green-600 p-8 text-center">
              <div className="mx-auto w-16 h-16 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm mb-4 border border-white/30">
                <Stethoscope className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-white mb-1">MediGuard Attendance</h1>
              <p className="text-blue-50 text-sm">Secure Location-Based Tracking</p>
            </div>
            
            <div className="p-8">
              <form onSubmit={handleLogin} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Username</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                      placeholder="Enter your username"
                      autoFocus
                    />
                    <Lock className="w-5 h-5 text-slate-400 absolute left-3 top-3.5" />
                  </div>
                </div>
                
                {error && (
                  <div className="text-red-600 text-sm text-center bg-red-50 border border-red-100 p-3 rounded font-medium animate-pulse">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 transition shadow-lg shadow-blue-200"
                >
                  Secure Login
                </button>
              </form>

              {/* Device Info Footer */}
              <div className="mt-6 text-center text-xs text-slate-400">
                 Device ID: <span className="font-mono">{currentDeviceId.slice(0,8)}...</span>
              </div>

              {/* Quick Login Section for Demo */}
              <div className="mt-8 pt-6 border-t border-slate-100">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 text-center">
                  Quick Login (Demo Mode)
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {availableUsers.map(u => (
                    <button
                      key={u.id}
                      onClick={() => performLogin(u.username)}
                      className="flex items-center gap-2 p-2 rounded-lg border border-slate-200 hover:border-blue-400 hover:bg-blue-50 transition text-left group"
                    >
                      {/* Admin Blue, Staff Green */}
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold relative ${
                        u.role === UserRole.ADMIN ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
                      }`}>
                        {u.role === UserRole.ADMIN ? <Shield className="w-4 h-4" /> : <UserIcon className="w-4 h-4" />}
                        {u.role === UserRole.STAFF && u.boundDeviceId && (
                          <div className="absolute -top-1 -right-1 bg-green-500 rounded-full p-0.5 border border-white">
                            <Smartphone className="w-2 h-2 text-white" />
                          </div>
                        )}
                      </div>
                      <div className="overflow-hidden">
                        <div className="text-sm font-medium text-slate-700 truncate group-hover:text-blue-700">{u.name}</div>
                        <div className="text-xs text-slate-400 truncate flex items-center gap-1">
                           @{u.username}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;