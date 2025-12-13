import React, { useState, useEffect } from 'react';
import { User, Hospital, AttendanceRecord } from '../types';
import { getHospitals, getActiveRecord, saveAttendanceRecord, updateAttendanceRecord } from '../services/storage';
import { getCurrentPosition, calculateDistance } from '../services/geoUtils';
import { MapPin, LogIn, LogOut, Clock, AlertCircle, Building2 } from 'lucide-react';

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

  useEffect(() => {
    setHospitals(getHospitals());
    // Check if user has an ongoing shift
    const current = getActiveRecord(user.id);
    if (current) {
      setActiveShift(current);
      setSelectedHospitalId(current.hospitalId);
    }
  }, [user.id]);

  useEffect(() => {
    let interval: number | undefined;
    if (activeShift && !activeShift.checkOutTime) {
      // Calculate initial offset
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

  const formatDuration = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    
    // Pad with leading zeros
    const hh = hours.toString().padStart(2, '0');
    const mm = minutes.toString().padStart(2, '0');
    const ss = seconds.toString().padStart(2, '0');
    
    return `${hh}:${mm}:${ss}`;
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
      const isWithinRange = distance <= hospital.radius + 15; // Allowing 15m buffer for GPS drift

      // If outside range, we still log but we flag it and warn the user
      const isFlagged = !isWithinRange;

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
      };

      saveAttendanceRecord(newRecord);
      setActiveShift(newRecord);

      if (isFlagged) {
        setStatusMessage({
          type: 'warning',
          text: `Warning: You are ${Math.round(distance)}m away from the hospital center. This check-in has been flagged for admin review.`
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
      // We check location again on checkout to ensure they are still there
      const position = await getCurrentPosition();
      const userCoords = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy
      };

      // Calculate checkout distance logic
      const hospital = hospitals.find(h => h.id === activeShift.hospitalId);
      let isCheckoutFlagged = false;
      let dist = 0;

      if (hospital) {
        dist = calculateDistance(userCoords, hospital.coords);
        // 15m buffer
        if (dist > hospital.radius + 15) {
          isCheckoutFlagged = true;
        }
      }

      const checkInTime = new Date(activeShift.checkInTime).getTime();
      const checkOutTime = new Date().getTime();
      const durationMinutes = Math.round((checkOutTime - checkInTime) / 60000);

      const updatedRecord: AttendanceRecord = {
        ...activeShift,
        checkOutTime: new Date().toISOString(),
        checkOutCoords: userCoords,
        durationMinutes,
        // Mark as flagged if check-in was flagged OR check-out is flagged
        flagged: activeShift.flagged || isCheckoutFlagged
      };

      updateAttendanceRecord(updatedRecord);
      setActiveShift(undefined);
      
      if (isCheckoutFlagged) {
         setStatusMessage({
          type: 'warning',
          text: `Shift ended. Warning: You are ${Math.round(dist)}m away from the location. This checkout has been flagged.`
        });
      } else {
        setStatusMessage({
          type: 'success',
          text: `Shift ended successfully. Total duration: ${durationMinutes} minutes.`
        });
      }

    } catch (err: any) {
       // If geo fails on checkout, just close the record but flag warning in UI
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
       setStatusMessage({
        type: 'warning',
        text: `Shift ended without location verification (GPS Error). Duration: ${durationMinutes} mins.`
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto p-6 bg-white rounded-xl shadow-lg border border-slate-100 mt-10">
      <div className="flex justify-between items-center mb-6 border-b pb-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Staff Portal</h2>
          <p className="text-sm text-slate-500">Welcome, {user.name}</p>
        </div>
        <button 
          onClick={onLogout}
          className="text-sm text-red-600 hover:text-red-800 font-medium"
        >
          Sign Out
        </button>
      </div>

      {statusMessage && (
        <div className={`p-4 rounded-lg mb-6 text-sm flex gap-3 items-start ${
          statusMessage.type === 'warning' ? 'bg-amber-50 text-amber-800 border border-amber-200' :
          statusMessage.type === 'error' ? 'bg-red-50 text-red-800 border border-red-200' :
          'bg-green-50 text-green-800 border border-green-200'
        }`}>
          {statusMessage.type === 'warning' ? <AlertCircle className="w-5 h-5 shrink-0" /> : <MapPin className="w-5 h-5 shrink-0" />}
          {statusMessage.text}
        </div>
      )}

      {geoError && (
        <div className="p-4 bg-red-50 text-red-700 rounded-lg mb-6 text-sm border border-red-200">
          <strong>Location Error:</strong> {geoError}. Please ensure GPS is enabled and permissions granted.
        </div>
      )}

      {!activeShift ? (
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Select Working Hospital</label>
            <div className="space-y-2">
              {hospitals.map(h => (
                <button
                  key={h.id}
                  onClick={() => setSelectedHospitalId(h.id)}
                  // Uses Green for selection
                  className={`w-full p-3 rounded-lg border text-left transition flex items-center gap-3 ${
                    selectedHospitalId === h.id 
                    ? 'border-green-500 bg-green-50 ring-1 ring-green-500' 
                    : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <Building2 className={`w-5 h-5 ${selectedHospitalId === h.id ? 'text-green-600' : 'text-slate-400'}`} />
                  <div>
                    <div className="font-semibold text-slate-800">{h.name}</div>
                    <div className="text-xs text-slate-500">Reg: {h.registrationNumber}</div>
                  </div>
                </button>
              ))}
              {hospitals.length === 0 && <p className="text-sm text-slate-500 italic">No hospitals registered by Admin yet.</p>}
            </div>
          </div>

          <button
            onClick={handleCheckIn}
            disabled={!selectedHospitalId || loading}
            // Green for Start
            className="w-full bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition flex justify-center items-center gap-2 shadow-lg shadow-green-100"
          >
            {loading ? 'Verifying Location...' : (
              <>
                <LogIn className="w-5 h-5" /> Start Shift
              </>
            )}
          </button>
        </div>
      ) : (
        <div className="text-center space-y-6">
          {/* Active Shift Green Pulse */}
          <div className="py-8 bg-green-50 rounded-full w-40 h-40 mx-auto flex flex-col justify-center items-center border-4 border-green-100 animate-pulse relative">
            <Clock className="w-10 h-10 text-green-600 mb-2" />
            <span className="text-green-900 font-bold text-lg">On Duty</span>
            <div className="mt-2 text-2xl font-mono font-bold text-green-800 tracking-wider">
               {formatDuration(elapsed)}
            </div>
            <span className="text-xs text-green-600 mt-1">
               Started: {new Date(activeShift.checkInTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
            </span>
          </div>
          
          <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
             <h3 className="font-medium text-slate-800 mb-1">{activeShift.hospitalName}</h3>
             <p className="text-sm text-slate-500">You are currently checked in.</p>
             {activeShift.flagged && (
               <p className="text-xs text-amber-600 mt-2 font-medium">Note: Check-in was flagged (Out of range).</p>
             )}
          </div>

          <button
            onClick={handleCheckOut}
            disabled={loading}
            // Red for Stop
            className="w-full bg-red-600 text-white py-3 rounded-lg font-semibold hover:bg-red-700 disabled:opacity-50 transition flex justify-center items-center gap-2 shadow-lg shadow-red-100"
          >
             {loading ? 'Processing...' : (
              <>
                <LogOut className="w-5 h-5" /> Clock Out
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
};

export default StaffDashboard;