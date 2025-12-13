import React, { useState, useEffect } from 'react';
import { Hospital, User, UserRole, AttendanceRecord } from '../types';
import { getStaffByHospital, saveUser, deleteUser, generateHospitalConfigLink, getAttendanceRecords, exportLogs } from '../services/storage';
import StaffDashboard from './StaffDashboard';
import { Users, UserPlus, Settings, LogOut, Copy, Share2, FileDown, Trash2, KeyRound } from 'lucide-react';

interface HospitalPortalProps {
  hospital: Hospital;
  onLogout: () => void;
}

const HospitalPortal: React.FC<HospitalPortalProps> = ({ hospital, onLogout }) => {
  const [view, setView] = useState<'SELECT_PROFILE' | 'MANAGER' | 'STAFF_ACTIVE'>('SELECT_PROFILE');
  const [staffList, setStaffList] = useState<User[]>([]);
  const [selectedStaff, setSelectedStaff] = useState<User | null>(null);
  
  // Manager State
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffPin, setNewStaffPin] = useState('');
  const [linkCopied, setLinkCopied] = useState(false);
  const [logs, setLogs] = useState<AttendanceRecord[]>([]);

  // Staff Login State
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');

  useEffect(() => {
    loadData();
  }, [hospital.id]);

  const loadData = () => {
    setStaffList(getStaffByHospital(hospital.id));
    setLogs(getAttendanceRecords().filter(r => r.hospitalId === hospital.id).reverse());
  };

  const handleAddStaff = (e: React.FormEvent) => {
    e.preventDefault();
    const newUser: User = {
      id: crypto.randomUUID(),
      name: newStaffName,
      role: UserRole.STAFF,
      hospitalId: hospital.id,
      pin: newStaffPin,
    };
    saveUser(newUser);
    setNewStaffName('');
    setNewStaffPin('');
    loadData();
  };

  const handleDeleteStaff = (id: string) => {
    if (confirm('Are you sure you want to remove this staff member?')) {
      deleteUser(id);
      loadData();
    }
  };

  const handleStaffSelect = (user: User) => {
    setSelectedStaff(user);
    setPinInput('');
    setPinError('');
  };

  const handleStaffLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedStaff && pinInput === selectedStaff.pin) {
      setView('STAFF_ACTIVE');
    } else {
      setPinError('Incorrect PIN');
    }
  };

  const handleShareLink = () => {
    const link = generateHospitalConfigLink(hospital.id);
    navigator.clipboard.writeText(link);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 3000);
  };

  const handleExportLogs = () => {
    const data = exportLogs(hospital.id);
    navigator.clipboard.writeText(data);
    alert("Logs copied to clipboard! You can paste this into a file or email to Admin.");
  };

  // --- RENDER: STAFF ACTIVE MODE ---
  if (view === 'STAFF_ACTIVE' && selectedStaff) {
    return (
      <StaffDashboard 
        user={selectedStaff} 
        onLogout={() => {
          setSelectedStaff(null);
          setView('SELECT_PROFILE');
        }} 
      />
    );
  }

  // --- RENDER: MANAGER MODE ---
  if (view === 'MANAGER') {
    return (
      <div className="p-4 max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-slate-800">Hospital Manager: {hospital.name}</h2>
          <button onClick={() => setView('SELECT_PROFILE')} className="text-blue-600 hover:underline">
            Back to Staff Selection
          </button>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Add Staff */}
          <div className="bg-white p-6 rounded-xl border shadow-sm">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-green-600" /> Add New Staff
            </h3>
            <form onSubmit={handleAddStaff} className="space-y-4">
              <input 
                type="text" 
                placeholder="Staff Full Name" 
                value={newStaffName} 
                onChange={e => setNewStaffName(e.target.value)}
                className="w-full p-2 border rounded" 
                required 
              />
              <input 
                type="text" 
                placeholder="Create 4-digit PIN" 
                maxLength={4}
                value={newStaffPin} 
                onChange={e => setNewStaffPin(e.target.value)}
                className="w-full p-2 border rounded" 
                required 
              />
              <button className="w-full bg-green-600 text-white py-2 rounded hover:bg-green-700">Add Staff Member</button>
            </form>
            
            <div className="mt-8 pt-6 border-t">
              <h4 className="font-semibold mb-2 flex items-center gap-2">
                <Share2 className="w-4 h-4 text-blue-600" /> Share App Access
              </h4>
              <p className="text-xs text-slate-500 mb-3">
                Send this link to staff. It will install the app and automatically configure it for {hospital.name}.
              </p>
              <button 
                onClick={handleShareLink}
                className="w-full border border-blue-200 bg-blue-50 text-blue-700 py-2 rounded flex items-center justify-center gap-2 hover:bg-blue-100 transition"
              >
                {linkCopied ? <span className="font-bold">Link Copied!</span> : <><Copy className="w-4 h-4" /> Copy Access Link</>}
              </button>
            </div>

            <div className="mt-4 pt-4 border-t">
               <h4 className="font-semibold mb-2 flex items-center gap-2">
                <FileDown className="w-4 h-4 text-slate-600" /> Data Export
              </h4>
              <button onClick={handleExportLogs} className="w-full border border-slate-200 text-slate-700 py-2 rounded hover:bg-slate-50">
                Copy Attendance Logs (JSON)
              </button>
            </div>
          </div>

          {/* List Staff */}
          <div className="bg-white p-6 rounded-xl border shadow-sm">
            <h3 className="font-semibold mb-4">Staff List</h3>
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {staffList.map(s => (
                <div key={s.id} className="flex justify-between items-center p-2 bg-slate-50 rounded">
                  <div>
                    <div className="font-medium">{s.name}</div>
                    <div className="text-xs text-slate-500">PIN: {s.pin}</div>
                  </div>
                  <button onClick={() => handleDeleteStaff(s.id)} className="text-red-400 hover:text-red-600 p-2">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- RENDER: PROFILE SELECTION (DEFAULT) ---
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-white border-b p-4 shadow-sm flex justify-between items-center sticky top-0 z-10">
        <div>
          <h1 className="font-bold text-lg text-slate-800">{hospital.name}</h1>
          <p className="text-xs text-slate-500">Reg: {hospital.registrationNumber}</p>
        </div>
        <div className="flex gap-2">
           <button onClick={() => setView('MANAGER')} className="p-2 text-slate-400 hover:text-blue-600 border border-transparent hover:border-blue-100 rounded">
             <Settings className="w-5 h-5" />
           </button>
           <button onClick={onLogout} className="p-2 text-slate-400 hover:text-red-600 border border-transparent hover:border-red-100 rounded">
             <LogOut className="w-5 h-5" />
           </button>
        </div>
      </header>

      <main className="flex-grow p-4">
        <div className="max-w-md mx-auto">
          <h2 className="text-center text-xl font-bold text-slate-700 mb-6 mt-4">Who is checking in?</h2>
          
          {selectedStaff ? (
            <div className="bg-white p-6 rounded-xl shadow-lg border border-blue-100">
               <button onClick={() => setSelectedStaff(null)} className="text-sm text-slate-400 mb-4 hover:text-slate-600">← Back to list</button>
               <div className="text-center mb-6">
                 <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-2">
                   {selectedStaff.name[0]}
                 </div>
                 <h3 className="text-lg font-bold">{selectedStaff.name}</h3>
                 <p className="text-sm text-slate-500">Enter your PIN to verify</p>
               </div>
               
               <form onSubmit={handleStaffLogin} className="space-y-4">
                 <input 
                   type="password" 
                   value={pinInput}
                   onChange={e => setPinInput(e.target.value)}
                   maxLength={4}
                   className="w-full text-center text-2xl tracking-widest py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                   placeholder="0000"
                   autoFocus
                 />
                 {pinError && <div className="text-red-600 text-center text-sm">{pinError}</div>}
                 <button className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700">
                   Verify & Access
                 </button>
               </form>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {staffList.map(s => (
                <button
                  key={s.id}
                  onClick={() => handleStaffSelect(s)}
                  className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 hover:border-blue-400 hover:shadow-md transition text-center group"
                >
                  <div className="w-12 h-12 bg-slate-100 text-slate-500 rounded-full flex items-center justify-center text-lg font-bold mx-auto mb-2 group-hover:bg-blue-100 group-hover:text-blue-600 transition-colors">
                    {s.name[0]}
                  </div>
                  <div className="font-medium text-slate-800 truncate">{s.name}</div>
                </button>
              ))}
              {staffList.length === 0 && (
                <div className="col-span-2 text-center py-10 text-slate-400 bg-white rounded-xl border border-dashed">
                  <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  No staff members found.<br/>Switch to Manager Mode to add staff.
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default HospitalPortal;