import React, { useState, useEffect } from 'react';
import { Hospital, User, UserRole, AttendanceRecord } from '../types';
import { getStaffByHospital, saveUser, deleteUser, generateHospitalConfigLink, getAttendanceRecords, importAttendanceData } from '../services/storage';
import { generateAttendancePDF } from '../services/pdfGenerator';
import StaffDashboard from './StaffDashboard';
import { Users, UserPlus, Settings, LogOut, Copy, Share2, FileDown, Trash2, Calendar, RefreshCw, Clipboard } from 'lucide-react';

interface HospitalPortalProps {
  hospital: Hospital;
  onLogout: () => void;
}

const HospitalPortal: React.FC<HospitalPortalProps> = ({ hospital, onLogout }) => {
  const [view, setView] = useState<'SELECT_PROFILE' | 'MANAGER' | 'STAFF_ACTIVE'>('SELECT_PROFILE');
  const [staffList, setStaffList] = useState<User[]>([]);
  const [selectedStaff, setSelectedStaff] = useState<User | null>(null);
  
  // Staff Login State
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');

  // Manager State
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffPin, setNewStaffPin] = useState('');
  const [linkCopied, setLinkCopied] = useState(false);
  const [showLogPassPrompt, setShowLogPassPrompt] = useState(false);
  const [logPassInput, setLogPassInput] = useState('');
  const [logPassError, setLogPassError] = useState('');
  
  // Date Range State
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Sync State
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [syncDataInput, setSyncDataInput] = useState('');
  const [syncResult, setSyncResult] = useState<string>('');

  useEffect(() => {
    loadData();
    // Default date range: 1st of current month to today
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    setStartDate(firstDay.toISOString().split('T')[0]);
    setEndDate(now.toISOString().split('T')[0]);
  }, [hospital.id]);

  const loadData = () => {
    setStaffList(getStaffByHospital(hospital.id));
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

  const handleLogExport = (e: React.FormEvent) => {
    e.preventDefault();
    // Validate password
    const storedPass = hospital.logViewPassword || '';
    const inputPass = logPassInput || '';

    if (inputPass === storedPass && storedPass !== '') {
      setLogPassError('');
      setShowLogPassPrompt(false);
      setLogPassInput('');
      
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);

      const logs = getAttendanceRecords().filter(r => {
        if (r.hospitalId !== hospital.id) return false;
        const rDate = new Date(r.checkInTime);
        return rDate >= start && rDate <= end;
      });

      if (logs.length === 0) {
        alert("No attendance records found for the selected date range.");
        return;
      }
      generateAttendancePDF(logs, hospital.name);
    } else {
      setLogPassError('Incorrect password. Please contact Admin if you forgot it.');
    }
  };

  const handleImportSync = (e: React.FormEvent) => {
    e.preventDefault();
    if (!syncDataInput) return;
    
    const result = importAttendanceData(syncDataInput);
    if (result.success) {
      setSyncResult(`Success! Updated ${result.count} records.`);
      setSyncDataInput('');
      setTimeout(() => {
        setShowSyncModal(false);
        setSyncResult('');
      }, 2000);
    } else {
      setSyncResult('Failed. Invalid data code.');
    }
  };


  if (view === 'STAFF_ACTIVE' && selectedStaff) {
    return (
      <StaffDashboard 
        user={selectedStaff} 
        onLogout={() => {
          setSelectedStaff(null);
          setView('SELECT_PROFILE');
          loadData(); 
        }} 
      />
    );
  }

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
          <div className="bg-white p-6 rounded-xl border shadow-sm space-y-6">
            
            {/* ADD STAFF */}
            <div>
              <h3 className="font-semibold mb-4 flex items-center gap-2"><UserPlus className="w-5 h-5 text-green-600" /> Add New Staff</h3>
              <form onSubmit={handleAddStaff} className="space-y-4">
                <input type="text" placeholder="Staff Full Name" value={newStaffName} onChange={e => setNewStaffName(e.target.value)} className="w-full p-2 border rounded" required />
                <input type="text" placeholder="Create 4-digit PIN" maxLength={4} value={newStaffPin} onChange={e => setNewStaffPin(e.target.value)} className="w-full p-2 border rounded" required />
                <button className="w-full bg-green-600 text-white py-2 rounded hover:bg-green-700">Add Staff Member</button>
              </form>
            </div>

            {/* SYNC DATA */}
             <div className="pt-6 border-t">
              <h4 className="font-semibold mb-2 flex items-center gap-2"><RefreshCw className="w-4 h-4 text-purple-600" /> Sync Staff Records</h4>
              <p className="text-xs text-slate-500 mb-3">Staff data is stored on their devices. Use this to manually merge their records into this dashboard.</p>
              <button onClick={() => setShowSyncModal(true)} className="w-full border border-purple-200 bg-purple-50 text-purple-700 py-2 rounded flex items-center justify-center gap-2 hover:bg-purple-100 transition">
                <Clipboard className="w-4 h-4" /> Import Staff Data Code
              </button>
              
              {showSyncModal && (
                 <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                   <div className="bg-white p-6 rounded-xl shadow-xl w-full max-w-md">
                     <h3 className="font-bold text-lg mb-2">Import Attendance Data</h3>
                     <p className="text-sm text-slate-600 mb-4">Paste the sync code provided by your staff member below.</p>
                     
                     <form onSubmit={handleImportSync}>
                       <textarea 
                          value={syncDataInput} 
                          onChange={e => setSyncDataInput(e.target.value)} 
                          className="w-full h-32 p-2 border rounded text-xs font-mono bg-slate-50"
                          placeholder="Paste code here..."
                       ></textarea>
                       
                       {syncResult && (
                         <div className={`text-sm mt-2 font-bold ${syncResult.includes('Success') ? 'text-green-600' : 'text-red-600'}`}>
                           {syncResult}
                         </div>
                       )}

                       <div className="flex gap-2 mt-4">
                         <button type="button" onClick={() => setShowSyncModal(false)} className="flex-1 py-2 bg-slate-200 rounded">Cancel</button>
                         <button type="submit" className="flex-1 py-2 bg-purple-600 text-white rounded hover:bg-purple-700">Merge Records</button>
                       </div>
                     </form>
                   </div>
                 </div>
              )}
            </div>

            {/* SHARE APP */}
            <div className="pt-6 border-t">
              <h4 className="font-semibold mb-2 flex items-center gap-2"><Share2 className="w-4 h-4 text-blue-600" /> Share App Access</h4>
              <button onClick={handleShareLink} className="w-full border border-blue-200 bg-blue-50 text-blue-700 py-2 rounded flex items-center justify-center gap-2 hover:bg-blue-100 transition">
                {linkCopied ? <span className="font-bold">Link Copied!</span> : <><Copy className="w-4 h-4" /> Copy Access Link</>}
              </button>
            </div>

            {/* DATA EXPORT */}
            <div className="pt-6 border-t">
              <h4 className="font-semibold mb-2 flex items-center gap-2"><FileDown className="w-4 h-4 text-slate-600" /> Data Export</h4>
              <button onClick={() => setShowLogPassPrompt(true)} className="w-full border border-slate-200 text-slate-700 py-2 rounded hover:bg-slate-50">Download Attendance PDF</button>
              {showLogPassPrompt && (
                <form onSubmit={handleLogExport} className="mt-4 p-4 bg-slate-50 rounded-lg border">
                  <div className="mb-4 space-y-2">
                    <label className="block text-xs font-bold text-slate-500 uppercase">Date Range</label>
                    <div className="flex gap-2">
                      <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full p-2 border rounded text-sm" required />
                      <span className="self-center text-slate-400">-</span>
                      <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full p-2 border rounded text-sm" required />
                    </div>
                  </div>

                  <p className="text-sm font-medium mb-2">Enter Log View Password</p>
                  <input type="password" value={logPassInput} onChange={e => setLogPassInput(e.target.value)} className="w-full p-2 border rounded" autoFocus />
                  {logPassError && <p className="text-xs text-red-500 mt-1">{logPassError}</p>}
                  <div className="flex gap-2 mt-2">
                    <button type="button" onClick={() => {setShowLogPassPrompt(false); setLogPassError('');}} className="w-full text-sm text-center py-2 rounded bg-slate-200 hover:bg-slate-300">Cancel</button>
                    <button type="submit" className="w-full text-sm text-center py-2 rounded bg-blue-600 text-white hover:bg-blue-700">Download</button>
                  </div>
                </form>
              )}
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl border shadow-sm">
            <h3 className="font-semibold mb-4">Staff List</h3>
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {staffList.map(s => (
                <div key={s.id} className="flex justify-between items-center p-2 bg-slate-50 rounded">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-slate-200 overflow-hidden flex items-center justify-center">
                        {s.profilePicture ? (
                            <img src={s.profilePicture} alt="Pic" className="w-full h-full object-cover" />
                        ) : (
                            <span className="text-xs font-bold text-slate-500">{s.name[0]}</span>
                        )}
                    </div>
                    <div>
                        <div className="font-medium">{s.name}</div>
                        <div className="text-xs text-slate-500">PIN: {s.pin}</div>
                    </div>
                  </div>
                  <button onClick={() => handleDeleteStaff(s.id)} className="text-red-400 hover:text-red-600 p-2"><Trash2 className="w-4 h-4" /></button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-white border-b p-4 shadow-sm flex justify-between items-center sticky top-0 z-10">
        <div>
          <h1 className="font-bold text-lg text-slate-800">{hospital.name}</h1>
          <p className="text-xs text-slate-500">Reg: {hospital.registrationNumber}</p>
        </div>
        <div className="flex gap-2">
           <button onClick={() => setView('MANAGER')} className="p-2 text-slate-400 hover:text-blue-600 border border-transparent hover:border-blue-100 rounded"><Settings className="w-5 h-5" /></button>
           <button onClick={onLogout} className="p-2 text-slate-400 hover:text-red-600 border border-transparent hover:border-red-100 rounded"><LogOut className="w-5 h-5" /></button>
        </div>
      </header>

      <main className="flex-grow p-4">
        <div className="max-w-md mx-auto">
          <h2 className="text-center text-xl font-bold text-slate-700 mb-6 mt-4">Who is checking in?</h2>
          
          {selectedStaff ? (
            <div className="bg-white p-6 rounded-xl shadow-lg border border-blue-100">
               <button onClick={() => setSelectedStaff(null)} className="text-sm text-slate-400 mb-4 hover:text-slate-600">← Back to list</button>
               <div className="text-center mb-6">
                 <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-3 shadow-inner overflow-hidden">
                    {selectedStaff.profilePicture ? (
                        <img src={selectedStaff.profilePicture} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                        selectedStaff.name[0]
                    )}
                 </div>
                 <h3 className="text-lg font-bold">{selectedStaff.name}</h3>
                 <p className="text-sm text-slate-500">Enter your PIN to verify</p>
               </div>
               
               <form onSubmit={handleStaffLogin} className="space-y-4">
                 <input type="password" value={pinInput} onChange={e => setPinInput(e.target.value)} maxLength={4} className="w-full text-center text-2xl tracking-widest py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="0000" autoFocus />
                 {pinError && <div className="text-red-600 text-center text-sm">{pinError}</div>}
                 <button className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700">Verify & Access</button>
               </form>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {staffList.map(s => (
                <button key={s.id} onClick={() => handleStaffSelect(s)} className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 hover:border-blue-400 hover:shadow-md transition text-center group">
                  <div className="w-12 h-12 bg-slate-100 text-slate-500 rounded-full flex items-center justify-center text-lg font-bold mx-auto mb-2 group-hover:bg-blue-100 group-hover:text-blue-600 transition-colors overflow-hidden">
                    {s.profilePicture ? (
                        <img src={s.profilePicture} alt="P" className="w-full h-full object-cover" />
                    ) : (
                        s.name[0]
                    )}
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