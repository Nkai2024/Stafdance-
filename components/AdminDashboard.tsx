import React, { useState, useEffect } from 'react';
import { Hospital, User, UserRole, AttendanceRecord } from '../types';
import { getHospitals, saveHospital, getUsers, saveUser, getAttendanceRecords, updateUser } from '../services/storage';
import { getCurrentPosition } from '../services/geoUtils';
import { analyzeAttendance } from '../services/geminiService';
import { PlusCircle, MapPin, Users, FileText, AlertTriangle, ShieldCheck, BrainCircuit, Loader2, LogIn, Smartphone, RefreshCw, XCircle } from 'lucide-react';

interface AdminDashboardProps {
  onSwitchUser: (user: User) => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ onSwitchUser }) => {
  const [activeTab, setActiveTab] = useState<'hospitals' | 'staff' | 'logs'>('hospitals');
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [staff, setStaff] = useState<User[]>([]);
  const [logs, setLogs] = useState<AttendanceRecord[]>([]);
  
  // Forms
  const [newHospitalName, setNewHospitalName] = useState('');
  const [newHospitalReg, setNewHospitalReg] = useState('');
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffUsername, setNewStaffUsername] = useState('');
  const [loadingGeo, setLoadingGeo] = useState(false);
  const [creationMsg, setCreationMsg] = useState('');

  // AI
  const [aiAnalysis, setAiAnalysis] = useState<string>('');
  const [analyzing, setAnalyzing] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    setHospitals(getHospitals());
    setStaff(getUsers().filter(u => u.role === UserRole.STAFF));
    setLogs(getAttendanceRecords().reverse()); // Newest first
  };

  const handleRegisterHospital = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoadingGeo(true);
    try {
      const position = await getCurrentPosition();
      const newHospital: Hospital = {
        id: crypto.randomUUID(),
        name: newHospitalName,
        registrationNumber: newHospitalReg,
        coords: {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy
        },
        radius: 15 // Default 15m as per request
      };
      saveHospital(newHospital);
      setNewHospitalName('');
      setNewHospitalReg('');
      loadData();
      alert(`Hospital Registered successfully at your current location!`);
    } catch (error) {
      alert("Failed to get geolocation. Please allow permissions.");
      console.error(error);
    } finally {
      setLoadingGeo(false);
    }
  };

  const handleCreateStaff = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStaffName || !newStaffUsername) return;
    
    const newUser: User = {
      id: crypto.randomUUID(),
      name: newStaffName,
      username: newStaffUsername,
      role: UserRole.STAFF,
    };
    saveUser(newUser);
    setNewStaffName('');
    setNewStaffUsername('');
    setCreationMsg(`Created user ${newUser.username}. They can bind their device on first login.`);
    loadData();
    setTimeout(() => setCreationMsg(''), 5000);
  };

  const handleResetDevice = (user: User) => {
    if (confirm(`Are you sure you want to reset the device lock for ${user.name}? This will allow them to log in from a NEW phone.`)) {
      const updatedUser = { ...user, boundDeviceId: undefined };
      updateUser(updatedUser);
      loadData();
      alert(`Device binding cleared for ${user.name}.`);
    }
  };

  const runAnalysis = async () => {
    setAnalyzing(true);
    const result = await analyzeAttendance(logs, hospitals);
    setAiAnalysis(result);
    setAnalyzing(false);
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-3xl font-bold text-slate-800">Admin Control Panel</h2>
        {/* Navigation Tabs - Blue Theme */}
        <div className="flex gap-2">
          <button 
            onClick={() => setActiveTab('hospitals')}
            className={`px-4 py-2 rounded-lg flex items-center gap-2 ${activeTab === 'hospitals' ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 border'}`}
          >
            <MapPin className="w-4 h-4" /> Hospitals
          </button>
          <button 
            onClick={() => setActiveTab('staff')}
            className={`px-4 py-2 rounded-lg flex items-center gap-2 ${activeTab === 'staff' ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 border'}`}
          >
            <Users className="w-4 h-4" /> Staff
          </button>
          <button 
            onClick={() => setActiveTab('logs')}
            className={`px-4 py-2 rounded-lg flex items-center gap-2 ${activeTab === 'logs' ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 border'}`}
          >
            <FileText className="w-4 h-4" /> Logs
          </button>
        </div>
      </div>

      {activeTab === 'hospitals' && (
        <div className="grid md:grid-cols-2 gap-8">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <h3 className="text-xl font-semibold mb-4 flex items-center gap-2 text-slate-800">
              <PlusCircle className="w-5 h-5 text-blue-600" /> Register New Hospital
            </h3>
            <p className="text-sm text-slate-500 mb-4">
              Stand at the hospital's central location (e.g., reception) and click register. 
              The system will automatically capture the geolocation (Accuracy ~5-15m).
            </p>
            <form onSubmit={handleRegisterHospital} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Hospital Name</label>
                <input 
                  type="text" 
                  value={newHospitalName}
                  onChange={e => setNewHospitalName(e.target.value)}
                  className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="e.g. Saint Mary's General"
                  required 
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Registration Number</label>
                <input 
                  type="text" 
                  value={newHospitalReg}
                  onChange={e => setNewHospitalReg(e.target.value)}
                  className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="e.g. REG-10024"
                  required 
                />
              </div>
              <button 
                type="submit" 
                disabled={loadingGeo}
                className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 transition flex justify-center items-center gap-2"
              >
                {loadingGeo ? <Loader2 className="animate-spin w-4 h-4" /> : <MapPin className="w-4 h-4" />}
                {loadingGeo ? 'Acquiring Geolocation...' : 'Capture Location & Register'}
              </button>
            </form>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <h3 className="text-xl font-semibold mb-4 text-slate-800">Registered Hospitals</h3>
            <div className="space-y-3 max-h-[400px] overflow-y-auto">
              {hospitals.length === 0 && <p className="text-slate-400">No hospitals registered yet.</p>}
              {hospitals.map(h => (
                <div key={h.id} className="p-3 bg-slate-50 rounded border border-slate-200 flex justify-between items-start">
                  <div>
                    <div className="font-bold text-slate-800">{h.name}</div>
                    <div className="text-xs text-slate-500">Reg: {h.registrationNumber}</div>
                    <div className="text-xs text-slate-500 mt-1">
                      Lat: {h.coords.latitude.toFixed(5)}, Lng: {h.coords.longitude.toFixed(5)}
                    </div>
                  </div>
                  <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full border border-blue-200">
                    {h.radius}m Radius
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'staff' && (
        <div className="grid md:grid-cols-2 gap-8">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <h3 className="text-xl font-semibold mb-4 flex items-center gap-2 text-slate-800">
              <Users className="w-5 h-5 text-green-600" /> Create Staff Account
            </h3>
            {creationMsg && (
              <div className="mb-4 p-3 bg-green-50 text-green-700 rounded text-sm border border-green-200 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4" /> {creationMsg}
              </div>
            )}
            <form onSubmit={handleCreateStaff} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
                <input 
                  type="text" 
                  value={newStaffName}
                  onChange={e => setNewStaffName(e.target.value)}
                  className="w-full p-2 border rounded focus:ring-2 focus:ring-green-500 outline-none"
                  placeholder="e.g. Dr. Jane Doe"
                  required 
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Username (for login)</label>
                <input 
                  type="text" 
                  value={newStaffUsername}
                  onChange={e => setNewStaffUsername(e.target.value)}
                  className="w-full p-2 border rounded focus:ring-2 focus:ring-green-500 outline-none"
                  placeholder="e.g. janedoe"
                  required 
                />
              </div>
              {/* Green button for staff creation */}
              <button 
                type="submit" 
                className="w-full bg-green-600 text-white py-2 rounded hover:bg-green-700 transition"
              >
                Create Account
              </button>
            </form>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <h3 className="text-xl font-semibold mb-4 text-slate-800">Staff Directory</h3>
            <div className="space-y-3 max-h-[400px] overflow-y-auto">
              {staff.length === 0 && <p className="text-slate-400">No staff accounts created yet.</p>}
              {staff.map(s => (
                <div key={s.id} className="p-3 bg-slate-50 rounded border border-slate-200 flex justify-between items-center hover:bg-slate-50 transition group">
                  <div className="flex items-center gap-3">
                    <div className="bg-slate-200 w-8 h-8 rounded-full flex items-center justify-center text-slate-600 font-bold">
                      {s.name[0]}
                    </div>
                    <div>
                      <div className="font-bold text-slate-800 flex items-center gap-2">
                         {s.name}
                         {s.boundDeviceId ? (
                            <span title="Device Bound" className="text-green-600"><Smartphone className="w-4 h-4" /></span>
                         ) : (
                            <span title="No Device Bound" className="text-slate-300"><Smartphone className="w-4 h-4" /></span>
                         )}
                      </div>
                      <div className="text-xs text-slate-500">@{s.username}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {s.boundDeviceId ? (
                       <button 
                       onClick={() => handleResetDevice(s)}
                       title="Reset Device Lock"
                       className="text-slate-400 hover:text-red-600 p-1.5 rounded-full hover:bg-red-50 transition"
                     >
                       <RefreshCw className="w-4 h-4" />
                     </button>
                    ) : (
                      <span className="text-[10px] text-slate-400 bg-slate-100 px-2 py-1 rounded">Open</span>
                    )}
                    <button 
                      onClick={() => onSwitchUser(s)}
                      className="flex items-center gap-1 text-xs bg-white border border-slate-300 px-3 py-1.5 rounded-md hover:border-green-400 hover:text-green-700 hover:bg-green-50 transition shadow-sm text-slate-600 font-medium"
                    >
                      <LogIn className="w-3 h-3" /> Login
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'logs' && (
        <div className="space-y-6">
           {/* AI Section Gradient - Blue to Green */}
           <div className="bg-gradient-to-r from-blue-50 to-green-50 p-6 rounded-xl border border-blue-100">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-lg font-bold text-blue-900 flex items-center gap-2">
                  <BrainCircuit className="w-5 h-5" /> AI Insights
                </h3>
                <p className="text-sm text-blue-800 mt-1 max-w-2xl">
                  Use Gemini to analyze attendance patterns, detect frequent geolocation warnings, and summarize staff hours.
                </p>
              </div>
              <button 
                onClick={runAnalysis}
                disabled={analyzing}
                className="bg-blue-600 text-white px-4 py-2 rounded shadow hover:bg-blue-700 disabled:opacity-50 transition flex items-center gap-2"
              >
                {analyzing ? <Loader2 className="animate-spin w-4 h-4" /> : 'Analyze Records'}
              </button>
            </div>
            {aiAnalysis && (
              <div className="mt-4 p-4 bg-white rounded border border-blue-100 text-slate-700 whitespace-pre-wrap text-sm leading-relaxed">
                {aiAnalysis}
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-4 bg-slate-50 border-b flex justify-between items-center">
              <h3 className="font-semibold text-slate-800">Attendance Log</h3>
              <span className="text-xs text-slate-500">{logs.length} records found</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-slate-500 bg-slate-50 uppercase text-xs font-semibold">
                  <tr>
                    <th className="px-6 py-3">Staff</th>
                    <th className="px-6 py-3">Hospital</th>
                    <th className="px-6 py-3">Check In</th>
                    <th className="px-6 py-3">Duration</th>
                    <th className="px-6 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-6 py-8 text-center text-slate-400">
                        No attendance records yet.
                      </td>
                    </tr>
                  )}
                  {logs.map(log => (
                    <tr key={log.id} className="border-b last:border-0 hover:bg-slate-50">
                      <td className="px-6 py-4 font-medium text-slate-900">{log.userName}</td>
                      <td className="px-6 py-4 text-slate-600">{log.hospitalName}</td>
                      <td className="px-6 py-4 text-slate-600">
                        {new Date(log.checkInTime).toLocaleString()}
                        <div className="text-xs text-slate-400 mt-1">
                          {Math.round(log.distanceFromCenter)}m from center
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-600">
                        {log.checkOutTime ? (
                          <span className="font-mono">
                            {log.durationMinutes} min
                          </span>
                        ) : (
                          // Active status green
                          <span className="text-green-600 animate-pulse font-medium">Active Now</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {log.flagged ? (
                          <span className="inline-flex items-center gap-1 bg-red-100 text-red-700 px-2 py-1 rounded text-xs font-medium border border-red-200">
                            <AlertTriangle className="w-3 h-3" /> Location Mismatch
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-medium border border-green-200">
                            <ShieldCheck className="w-3 h-3" /> Verified
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;