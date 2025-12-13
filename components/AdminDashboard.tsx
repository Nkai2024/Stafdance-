import React, { useState, useEffect } from 'react';
import { Hospital } from '../types';
import { getHospitals, saveHospital } from '../services/storage';
import { getCurrentPosition } from '../services/geoUtils';
import { PlusCircle, MapPin, Loader2, LogOut, Building } from 'lucide-react';

interface AdminDashboardProps {
  onLogout: () => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ onLogout }) => {
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  
  // Forms
  const [name, setName] = useState('');
  const [regNumber, setRegNumber] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loadingGeo, setLoadingGeo] = useState(false);

  useEffect(() => {
    setHospitals(getHospitals());
  }, []);

  const handleRegisterHospital = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoadingGeo(true);
    try {
      const position = await getCurrentPosition();
      const newHospital: Hospital = {
        id: crypto.randomUUID(),
        name,
        registrationNumber: regNumber,
        username,
        password,
        coords: {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy
        },
        radius: 15
      };
      saveHospital(newHospital);
      
      // Reset Form
      setName('');
      setRegNumber('');
      setUsername('');
      setPassword('');
      
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
      <div className="flex justify-between items-center bg-white p-4 rounded-lg shadow-sm border">
        <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
           <Building className="w-6 h-6 text-blue-600" /> System Administration
        </h2>
        <button onClick={onLogout} className="flex items-center gap-2 text-red-600 hover:bg-red-50 px-3 py-2 rounded transition">
           <LogOut className="w-4 h-4" /> Logout
        </button>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <h3 className="text-xl font-semibold mb-4 flex items-center gap-2 text-slate-800">
            <PlusCircle className="w-5 h-5 text-blue-600" /> Register New Hospital
          </h3>
          <p className="text-sm text-slate-500 mb-4 bg-blue-50 p-3 rounded">
            <strong>Instruction:</strong> You must be physically present at the hospital location to register it. The system locks the geolocation coordinates upon registration.
          </p>
          <form onSubmit={handleRegisterHospital} className="space-y-4">
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
            <button type="submit" disabled={loadingGeo} className="w-full bg-blue-600 text-white py-3 rounded hover:bg-blue-700 transition flex justify-center items-center gap-2">
              {loadingGeo ? <Loader2 className="animate-spin w-4 h-4" /> : <MapPin className="w-4 h-4" />}
              {loadingGeo ? 'Acquiring GPS...' : 'Capture Location & Create'}
            </button>
          </form>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <h3 className="text-xl font-semibold mb-4 text-slate-800">Active Hospitals</h3>
          <div className="space-y-3 max-h-[500px] overflow-y-auto">
            {hospitals.map(h => (
              <div key={h.id} className="p-4 bg-slate-50 rounded border border-slate-200">
                <div className="font-bold text-slate-800">{h.name}</div>
                <div className="text-sm text-slate-600">Reg: {h.registrationNumber}</div>
                <div className="mt-2 text-xs flex gap-4 text-slate-500">
                   <span>User: <span className="font-mono bg-slate-200 px-1 rounded">{h.username}</span></span>
                   <span>Pass: <span className="font-mono bg-slate-200 px-1 rounded">{h.password}</span></span>
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