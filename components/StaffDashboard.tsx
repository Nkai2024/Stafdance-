import React, { useState, useEffect, useRef } from 'react';
import { User, Hospital, AttendanceRecord } from '../types';
import { getHospitals, getActiveRecord, saveAttendanceRecord, updateAttendanceRecord, getOrCreateDeviceId, updateUser, getAttendanceRecords } from '../services/storage';
import { getCurrentPosition, calculateDistance } from '../services/geoUtils';
import { MapPin, LogIn, LogOut, Clock, AlertCircle, Building2, Camera, Upload, User as UserIcon, Calendar, CheckCircle } from 'lucide-react';

interface StaffDashboardProps {
  user: User;
  onLogout: () => void;
}

const StaffDashboard: React.FC<StaffDashboardProps> = ({ user, onLogout }) => {
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [selectedHospitalId, setSelectedHospitalId] = useState<string>('');
  const [activeShift, setActiveShift] = useState<AttendanceRecord | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [geoError, setGeoError] = useState<string>('');
  const [statusMessage, setStatusMessage] = useState<{type: 'success' | 'error' | 'warning', text: string} | null>(null);
  const [elapsed, setElapsed] = useState(0);
  
  // Profile & History State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [history, setHistory] = useState<AttendanceRecord[]>([]);
  const [stats, setStats] = useState({ lateDays: 0, earlyLeavings: 0, totalDays: 0 });

  useEffect(() => {
    setHospitals(getHospitals());
    const current = getActiveRecord(user.id);
    if (current) {
      setActiveShift(current);
      setSelectedHospitalId(current.hospitalId);
    }
    loadHistory();
  }, [user.id]);

  useEffect(() => {
    let interval: number | undefined;
    if (activeShift && !activeShift.checkOutTime) {
      const startTime = new Date(activeShift.checkInTime).getTime();
      setElapsed(Date.now() - startTime);
      interval = window.setInterval(() => {
        setElapsed(Date.now() - startTime);
      }, 1000);
    } else {
      setElapsed(0);
    }
    return () => clearInterval(interval);
  }, [activeShift]);

  const loadHistory = () => {
    const allRecords = getAttendanceRecords();
    // Filter for this user and sort by date descending
    const userRecords = allRecords
      .filter(r => r.userId === user.id)
      .sort((a, b) => new Date(b.checkInTime).getTime() - new Date(a.checkInTime).getTime());
    
    setHistory(userRecords);
    calculateStats(userRecords);
  };

  const calculateStats = (records: AttendanceRecord[]) => {
    let late = 0;
    let early = 0;

    records.forEach(r => {
      const checkIn = new Date(r.checkInTime);
      // Late logic: Check in after 8:05 AM
      if (checkIn.getHours() > 8 || (checkIn.getHours() === 8 && checkIn.getMinutes() > 5)) {
        late++;
      }

      if (r.checkOutTime) {
        const checkOut = new Date(r.checkOutTime);
        // Early logic: Check out before 5:00 PM (17:00)
        if (checkOut.getHours() < 17) {
          early++;
        }
      }
    });

    setStats({
      totalDays: records.length,
      lateDays: late,
      earlyLeavings: early
    });
  };

  const formatDuration = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    
    const hh = hours.toString().padStart(2, '0');
    const mm = minutes.toString().padStart(2, '0');
    const ss = seconds.toString().padStart(2, '0');
    
    return `${hh}:${mm}:${ss}`;
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Basic size check (limit to ~2MB to prevent LocalStorage issues)
      if (file.size > 2 * 1024 * 1024) {
        alert("Image is too large. Please select an image under 2MB.");
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        const updatedUser = { ...user, profilePicture: base64String };
        updateUser(updatedUser);
        // Force re-render is handled by parent usually, but since we receive prop 'user',
        // we might need to manually trigger or wait for parent refresh. 
        // For now, we update local state implicitly by how storage works or reload window.
        window.location.reload(); // Simple way to refresh user prop from storage in this architecture
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCheckIn = async () => {
    if (!selectedHospitalId) return;
    const hospital = hospitals.find(h => h.id === selectedHospitalId);
    if (!hospital) return;

    setLoading(true);
    setGeoError('');
    setStatusMessage(null);

    try {
      const position = await getCurrentPosition();
      const userCoords = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy
      };

      const distance = calculateDistance(userCoords, hospital.coords);
      const isWithinRange = distance <= hospital.radius + 15;
      const isFlagged = !isWithinRange;
      const deviceId = getOrCreateDeviceId();

      if (!user.boundDeviceId) {
        const updatedUser = { ...user, boundDeviceId: deviceId };
        updateUser(updatedUser);
      }
      
      const newRecord: AttendanceRecord = {
        id: crypto.randomUUID(),
        userId: user.id,
        userName: user.name,
        hospitalId: hospital.id,
        hospitalName: hospital.name,
        checkInTime: new Date().toISOString(),
        checkInCoords: userCoords,
        flagged: isFlagged,
        distanceFromCenter: distance,
        checkInDeviceId: deviceId,
      };

      saveAttendanceRecord(newRecord);
      setActiveShift(newRecord);
      loadHistory(); // Refresh history

      if (isFlagged) {
        setStatusMessage({
          type: 'warning',
          text: `Warning: You are ${Math.round(distance)}m away from the hospital. This check-in has been flagged.`
        });
      } else {
        setStatusMessage({
          type: 'success',
          text: 'Checked in successfully! Location verified.'
        });
      }

    } catch (err: any) {
      setGeoError(err.message || "Could not retrieve location.");
    } finally {
      setLoading(false);
    }
  };

  const handleCheckOut = async () => {
    if (!activeShift) return;

    setLoading(true);
    try {
      const position = await getCurrentPosition();
      const userCoords = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy
      };
      
      const hospital = hospitals.find(h => h.id === activeShift.hospitalId);
      let isCheckoutFlagged = false;
      let dist = 0;

      if (hospital) {
        dist = calculateDistance(userCoords, hospital.coords);
        if (dist > hospital.radius + 15) {
          isCheckoutFlagged = true;
        }
      }

      const checkInTime = new Date(activeShift.checkInTime).getTime();
      const checkOutTime = new Date().getTime();
      const durationMinutes = Math.round((checkOutTime - checkInTime) / 60000);

      const deviceId = getOrCreateDeviceId();
      let anomaly: 'DEVICE_MISMATCH' | undefined = undefined;
      if (user.boundDeviceId && deviceId !== user.boundDeviceId) {
        anomaly = 'DEVICE_MISMATCH';
      }

      const updatedRecord: AttendanceRecord = {
        ...activeShift,
        checkOutTime: new Date().toISOString(),
        checkOutCoords: userCoords,
        durationMinutes,
        flagged: activeShift.flagged || isCheckoutFlagged,
        checkOutDeviceId: deviceId,
        anomaly: anomaly,
      };

      updateAttendanceRecord(updatedRecord);
      setActiveShift(undefined);
      loadHistory(); // Refresh history
      
      if (anomaly) {
         setStatusMessage({
          type: 'error',
          text: `Shift ended. CRITICAL: A different device was used for checkout. This has been logged for admin review.`
        });
      } else if (isCheckoutFlagged) {
         setStatusMessage({
          type: 'warning',
          text: `Shift ended. Warning: You are ${Math.round(dist)}m away. This has been flagged.`
        });
      } else {
        setStatusMessage({
          type: 'success',
          text: `Shift ended successfully. Duration: ${durationMinutes} minutes.`
        });
      }

    } catch (err: any) {
       const checkInTime = new Date(activeShift.checkInTime).getTime();
       const checkOutTime = new Date().getTime();
       const durationMinutes = Math.round((checkOutTime - checkInTime) / 60000);
       
       const updatedRecord: AttendanceRecord = {
        ...activeShift,
        checkOutTime: new Date().toISOString(),
        durationMinutes
       };
       updateAttendanceRecord(updatedRecord);
       setActiveShift(undefined);
       loadHistory();
       setStatusMessage({
        type: 'warning',
        text: `Shift ended without location verification (GPS Error). Duration: ${durationMinutes} mins.`
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-4 mb-20">
      
      {/* HEADER WITH PROFILE PIC */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-4 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-20 bg-gradient-to-r from-blue-600 to-blue-400"></div>
        <div className="relative flex flex-col items-center">
            <div className="relative group">
                <div className="w-24 h-24 rounded-full border-4 border-white shadow-md bg-slate-100 flex items-center justify-center overflow-hidden">
                    {user.profilePicture ? (
                        <img src={user.profilePicture} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                        <UserIcon className="w-10 h-10 text-slate-300" />
                    )}
                </div>
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute bottom-0 right-0 bg-white p-2 rounded-full shadow border border-slate-200 text-slate-600 hover:text-blue-600"
                >
                    <Camera className="w-4 h-4" />
                </button>
                <input 
                    type="file" 
                    ref={fileInputRef} 
                    className="hidden" 
                    accept="image/*" 
                    onChange={handleImageUpload} 
                />
            </div>
            <h2 className="mt-3 text-xl font-bold text-slate-800">{user.name}</h2>
            <button onClick={onLogout} className="text-xs text-red-500 font-medium mt-1">Sign Out</button>
        </div>
        
        {/* STATS SUMMARY */}
        <div className="grid grid-cols-3 gap-2 mt-6 border-t pt-4">
            <div className="text-center">
                <div className="text-lg font-bold text-slate-700">{stats.totalDays}</div>
                <div className="text-[10px] uppercase text-slate-500 tracking-wider">Shifts</div>
            </div>
            <div className="text-center border-l border-r border-slate-100">
                <div className="text-lg font-bold text-amber-600">{stats.lateDays}</div>
                <div className="text-[10px] uppercase text-slate-500 tracking-wider">Late</div>
            </div>
            <div className="text-center">
                <div className="text-lg font-bold text-red-600">{stats.earlyLeavings}</div>
                <div className="text-[10px] uppercase text-slate-500 tracking-wider">Left Early</div>
            </div>
        </div>
      </div>

      {/* ACTION CARD */}
      <div className="bg-white rounded-xl shadow-lg border border-slate-100 p-6 mb-6">
        {statusMessage && (
            <div className={`p-4 rounded-lg mb-6 text-sm flex gap-3 items-start ${
            statusMessage.type === 'warning' ? 'bg-amber-50 text-amber-800 border border-amber-200' :
            statusMessage.type === 'error' ? 'bg-red-50 text-red-800 border border-red-200' :
            'bg-green-50 text-green-800 border border-green-200'
            }`}>
            <AlertCircle className="w-5 h-5 shrink-0" />
            {statusMessage.text}
            </div>
        )}

        {geoError && (
            <div className="p-4 bg-red-50 text-red-700 rounded-lg mb-6 text-sm border border-red-200">
            <strong>Location Error:</strong> {geoError}. Please ensure GPS is enabled.
            </div>
        )}

        {!activeShift ? (
            <div className="space-y-6">
            <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">Select Hospital</label>
                <div className="space-y-2">
                {hospitals.map(h => (
                    <button
                    key={h.id}
                    onClick={() => setSelectedHospitalId(h.id)}
                    className={`w-full p-3 rounded-lg border text-left transition flex items-center gap-3 ${
                        selectedHospitalId === h.id 
                        ? 'border-green-500 bg-green-50 ring-1 ring-green-500' 
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                    >
                    <Building2 className={`w-5 h-5 ${selectedHospitalId === h.id ? 'text-green-600' : 'text-slate-400'}`} />
                    <div>
                        <div className="font-semibold text-slate-800">{h.name}</div>
                    </div>
                    </button>
                ))}
                {hospitals.length === 0 && <p className="text-sm text-slate-500 italic">No hospitals found.</p>}
                </div>
            </div>

            <button
                onClick={handleCheckIn}
                disabled={!selectedHospitalId || loading}
                className="w-full bg-green-600 text-white py-4 rounded-xl font-bold hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition flex justify-center items-center gap-2 shadow-lg shadow-green-200"
            >
                {loading ? 'Verifying Location...' : (
                <>
                    <MapPin className="w-5 h-5" /> CHECK IN NOW
                </>
                )}
            </button>
            </div>
        ) : (
            <div className="text-center space-y-6">
            <div className="flex flex-col items-center">
                <div className="relative">
                    <div className="absolute inset-0 bg-green-500 blur-xl opacity-20 rounded-full animate-pulse"></div>
                    <Clock className="w-12 h-12 text-green-600 relative z-10 mb-2" />
                </div>
                <span className="text-green-900 font-bold text-lg">Shift Active</span>
                <div className="text-3xl font-mono font-bold text-slate-800 tracking-wider my-2">
                {formatDuration(elapsed)}
                </div>
                <div className="text-xs bg-slate-100 px-3 py-1 rounded-full text-slate-500">
                    Started at {new Date(activeShift.checkInTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                </div>
            </div>
            
            <div className="text-sm text-slate-500">
                Location verified at <span className="font-semibold text-slate-700">{activeShift.hospitalName}</span>
            </div>

            <button
                onClick={handleCheckOut}
                disabled={loading}
                className="w-full bg-red-50 text-red-600 border border-red-200 py-3 rounded-xl font-bold hover:bg-red-100 disabled:opacity-50 transition flex justify-center items-center gap-2"
            >
                {loading ? 'Processing...' : (
                <>
                    <LogOut className="w-5 h-5" /> End Shift
                </>
                )}
            </button>
            </div>
        )}
      </div>

      {/* HISTORY SECTION */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-slate-500" />
            <h3 className="font-semibold text-slate-700">My Attendance History</h3>
        </div>
        <div className="divide-y divide-slate-100">
            {history.length === 0 && (
                <div className="p-8 text-center text-slate-400 text-sm">No history yet.</div>
            )}
            {history.map(record => {
                const checkInDate = new Date(record.checkInTime);
                const isLate = checkInDate.getHours() > 8 || (checkInDate.getHours() === 8 && checkInDate.getMinutes() > 5);
                const isEarlyLeave = record.checkOutTime ? new Date(record.checkOutTime).getHours() < 17 : false;

                return (
                    <div key={record.id} className="p-4 flex justify-between items-center hover:bg-slate-50">
                        <div>
                            <div className="font-bold text-slate-800">{checkInDate.toLocaleDateString()}</div>
                            <div className="text-xs text-slate-500 mt-0.5">
                                {checkInDate.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})} 
                                {record.checkOutTime && ` - ${new Date(record.checkOutTime).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}`}
                            </div>
                            <div className="flex gap-1 mt-1">
                                {isLate && <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-medium">Late</span>}
                                {isEarlyLeave && <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-medium">Left Early</span>}
                                {!isLate && !isEarlyLeave && record.checkOutTime && <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-medium">On Time</span>}
                            </div>
                        </div>
                        <div className="text-right">
                            {record.checkOutTime ? (
                                <div className="text-sm font-mono font-medium text-slate-600">
                                    {Math.floor((record.durationMinutes || 0)/60)}h {(record.durationMinutes || 0)%60}m
                                </div>
                            ) : (
                                <span className="text-xs text-green-600 font-bold px-2 py-1 bg-green-50 rounded-full animate-pulse">Active</span>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
      </div>

    </div>
  );
};

export default StaffDashboard;