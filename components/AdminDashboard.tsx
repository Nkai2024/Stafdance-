import React, { useState, useEffect } from 'react';
import { Hospital } from '../types';
import { getHospitals, saveHospital, updateHospital, deleteHospital } from '../services/storage';
import { isCloudConfigured, updateSupabaseConfig, clearSupabaseConfig } from '../services/supabaseClient';
import { getCurrentPosition } from '../services/geoUtils';
import { PlusCircle, MapPin, Loader2, LogOut, Building, Trash2, Edit2, XCircle, Save, Cloud, CheckCircle, Database, AlertTriangle } from 'lucide-react';

interface AdminDashboardProps {
  onLogout: () => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ onLogout }) => {
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  
  // Cloud Config State
  const [showCloudConfig, setShowCloudConfig] = useState(false);
  const [sbUrl, setSbUrl] = useState('');
  const [sbKey, setSbKey] = useState('');

  // Forms
  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [regNumber, setRegNumber] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [logViewPassword, setLogViewPassword] = useState('');
  const [loadingGeo, setLoadingGeo] = useState(false);

  useEffect(() => {
    setHospitals(getHospitals());
  }, []);

  const resetForm = () => {
    setEditId(null);
    setName('');
    setRegNumber('');
    setUsername('');
    setPassword('');
    setLogViewPassword('');
  };

  const handleEditClick = (hospital: Hospital) => {
    setEditId(hospital.id);
    setName(hospital.name);
    setRegNumber(hospital.registrationNumber);
    setUsername(hospital.username);
    setPassword(hospital.password);
    setLogViewPassword(hospital.logViewPassword || '');
  };

  const handleDeleteClick = (id: string, hospitalName: string) => {
    if (window.confirm(`WARNING: Are you sure you want to delete ${hospitalName}?\n\nThis will remove the hospital and ALL associated staff accounts from this device. This action cannot be undone.`)) {
      deleteHospital(id);
      setHospitals(getHospitals());
      if (editId === id) resetForm();
    }
  };

  const handleCloudSave = (e: React.FormEvent) => {
    e.preventDefault();
    if(sbUrl && sbKey) {
      updateSupabaseConfig(sbUrl, sbKey);
    }
  };

  const handleDisconnectCloud = () => {
    if(confirm("Disconnect from cloud database? The app will revert to local storage only.")) {
      clearSupabaseConfig();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (editId) {
      const original = hospitals.find(h => h.id === editId);
      if (!original) return;

      const updatedHospital: Hospital = {
        ...original,
        name,
        registrationNumber: regNumber,
        username,
        password,
        logViewPassword,
      };
      
      updateHospital(updatedHospital);
      setHospitals(getHospitals());
      resetForm();
      alert("Hospital details updated successfully.");
      return;
    }

    setLoadingGeo(true);
    try {
      const position = await getCurrentPosition();
      const newHospital: Hospital = {
        id: crypto.randomUUID(),
        name,
        registrationNumber: regNumber,
        username,
        password,
        logViewPassword,
        coords: {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy
        },
        radius: 15
      };
      saveHospital(newHospital);
      
      resetForm();
      setHospitals(getHospitals());
      alert(`Hospital Registered! Login Username: ${username}`);
    } catch (error) {
      alert("Failed to get geolocation. Please allow permissions.");
    } finally {
      setLoadingGeo(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-center bg-white p-4 rounded-lg shadow-sm border gap-4">
        <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
           <Building className="w-6 h-6 text-blue-600" /> System Administration
        </h2>
        <div className="flex gap-2">
          <button 
            onClick={() => setShowCloudConfig(!showCloudConfig)} 
            className={`flex items-center gap-2 px-3 py-2 rounded transition border ${isCloudConfigured ? 'bg-green-50 text-green-700 border-green-200' : 'bg-slate-50 text-slate-600 border-slate-200'}`}
          >
             {isCloudConfigured ? <CheckCircle className="w-4 h-4" /> : <Cloud className="w-4 h-4" />} 
             {isCloudConfigured ? 'Cloud Connected' : 'Setup Cloud'}
          </button>
          <button onClick={onLogout} className="flex items-center gap-2 text-red-600 hover:bg-red-50 px-3 py-2 rounded transition">
             <LogOut className="w-4 h-4" /> Logout
          </button>
        </div>
      </div>

      {/* CLOUD CONFIG PANEL */}
      {showCloudConfig && (
        <div className="bg-slate-800 text-white p-6 rounded-xl shadow-lg border border-slate-700 animate-in fade-in slide-in-from-top-4">
          <div className="flex items-center gap-2 mb-4">
            <Database className="w-5 h-5 text-blue-400" />
            <h3 className="text-lg font-bold">Cloud Database Setup (Supabase)</h3>
          </div>
          
          {isCloudConfigured ? (
            <div className="space-y-4">
               <div className="bg-green-900/30 border border-green-800 p-4 rounded flex items-start gap-3">
                 <CheckCircle className="w-5 h-5 text-green-400 shrink-0 mt-0.5" />
                 <div>
                   <p className="font-semibold text-green-400">Database Connected</p>
                   <p className="text-sm text-green-200/70">Your application is currently syncing with the cloud. Data is safe.</p>
                 </div>
               </div>
               <button onClick={handleDisconnectCloud} className="text-red-400 hover:text-red-300 text-sm hover:underline">
                 Disconnect and remove keys
               </button>
            </div>
          ) : (
            <form onSubmit={handleCloudSave} className="space-y-4">
              <p className="text-slate-300 text-sm">Enter your Supabase project details to enable real-time syncing across devices.</p>
              
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Project URL</label>
                  <input 
                    type="text" 
                    value={sbUrl} 
                    onChange={e => setSbUrl(e.target.value)}
                    placeholder="https://xyz.supabase.co" 
                    className="w-full p-2 rounded bg-slate-900 border border-slate-700 text-white focus:border-blue-500 outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Anon API Key</label>
                  <input 
                    type="password" 
                    value={sbKey} 
                    onChange={e => setSbKey(e.target.value)}
                    placeholder="eyJhbGciOiJIUzI1NiIsInR5..." 
                    className="w-full p-2 rounded bg-slate-900 border border-slate-700 text-white focus:border-blue-500 outline-none"
                    required
                  />
                </div>
              </div>
              <div className="flex justify-end pt-2">
                <button className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded font-bold transition">Connect Database</button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* MAIN CONTENT GRID */}
      <div className="grid md:grid-cols-2 gap-8">
        {/* FORM SECTION */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 h-fit">
          <h3 className="text-xl font-semibold mb-4 flex items-center gap-2 text-slate-800">
            {editId ? <Edit2 className="w-5 h-5 text-amber-600" /> : <PlusCircle className="w-5 h-5 text-blue-600" />}
            {editId ? 'Edit Hospital Details' : 'Register New Hospital'}
          </h3>
          
          <p className="text-sm text-slate-500 mb-4 bg-slate-50 p-3 rounded">
            {editId ? (
              <strong>Editing mode:</strong> 
            ) : (
              <strong>Instruction:</strong>
            )} 
            {editId 
              ? " Update the details below. Location coordinates remain unchanged." 
              : " You must be physically present at the hospital location to register it. GPS will be captured on submit."}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Hospital Name</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full p-2 border rounded outline-none focus:ring-2 focus:ring-blue-500" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Registration Number</label>
              <input type="text" value={regNumber} onChange={e => setRegNumber(e.target.value)} className="w-full p-2 border rounded outline-none focus:ring-2 focus:ring-blue-500" required />
            </div>
            <div className="grid grid-cols-2 gap-4">
               <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Login Username</label>
                <input type="text" value={username} onChange={e => setUsername(e.target.value)} className="w-full p-2 border rounded outline-none focus:ring-2 focus:ring-blue-500" required />
               </div>
               <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Login Password</label>
                <input type="text" value={password} onChange={e => setPassword(e.target.value)} className="w-full p-2 border rounded outline-none focus:ring-2 focus:ring-blue-500" required />
               </div>
            </div>
             <div className="bg-amber-50 p-3 rounded border border-amber-100">
                <label className="block text-sm font-bold text-amber-800 mb-1">Log View Password</label>
                <input type="text" value={logViewPassword} onChange={e => setLogViewPassword(e.target.value)} className="w-full p-2 border border-amber-200 rounded outline-none focus:ring-2 focus:ring-amber-500" placeholder="Required for PDF export" required />
                <p className="text-xs text-amber-700 mt-1">This password is required to download attendance logs.</p>
             </div>
            
            <div className="flex gap-2 pt-2">
              {editId && (
                <button type="button" onClick={resetForm} className="flex-1 bg-slate-200 text-slate-700 py-3 rounded hover:bg-slate-300 transition flex justify-center items-center gap-2">
                  <XCircle className="w-4 h-4" /> Cancel
                </button>
              )}
              
              <button type="submit" disabled={loadingGeo} className={`flex-1 text-white py-3 rounded transition flex justify-center items-center gap-2 ${editId ? 'bg-amber-600 hover:bg-amber-700' : 'bg-blue-600 hover:bg-blue-700'}`}>
                {loadingGeo ? <Loader2 className="animate-spin w-4 h-4" /> : (editId ? <Save className="w-4 h-4" /> : <MapPin className="w-4 h-4" />)}
                {loadingGeo ? 'Acquiring GPS...' : (editId ? 'Update Details' : 'Capture & Create')}
              </button>
            </div>
          </form>
        </div>

        {/* LIST SECTION */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <h3 className="text-xl font-semibold mb-4 text-slate-800">Active Hospitals</h3>
          <div className="space-y-3 max-h-[600px] overflow-y-auto">
            {hospitals.length === 0 && <p className="text-slate-400 italic">No hospitals registered yet.</p>}
            {hospitals.map(h => (
              <div key={h.id} className={`p-4 rounded border transition relative group ${editId === h.id ? 'bg-amber-50 border-amber-300 ring-1 ring-amber-300' : 'bg-slate-50 border-slate-200 hover:border-blue-300'}`}>
                
                {/* Action Buttons */}
                <div className="absolute top-3 right-3 flex gap-2">
                  <button 
                    onClick={() => handleEditClick(h)}
                    className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-amber-100 rounded bg-white border border-slate-200 shadow-sm"
                    title="Edit Hospital"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => handleDeleteClick(h.id, h.name)}
                    className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-100 rounded bg-white border border-red-200 shadow-sm flex items-center gap-1 px-2"
                    title="Delete Hospital"
                  >
                    <Trash2 className="w-4 h-4" /> <span className="text-xs font-bold">Delete</span>
                  </button>
                </div>

                <div className="pr-20">
                  <div className="font-bold text-slate-800 text-lg">{h.name}</div>
                  <div className="text-sm text-slate-600 mb-2">Reg: {h.registrationNumber}</div>
                </div>

                <div className="mt-2 text-xs grid grid-cols-2 gap-2 text-slate-500 bg-white p-2 rounded border border-slate-100">
                   <span>Login User: <span className="font-mono text-slate-700">{h.username}</span></span>
                   <span>Login Pass: <span className="font-mono text-slate-700">{h.password}</span></span>
                   <span className="col-span-2 border-t pt-1 mt-1 text-amber-700">
                     Log View Pass: <span className="font-mono font-bold">{h.logViewPassword || 'Not Set'}</span>
                   </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;