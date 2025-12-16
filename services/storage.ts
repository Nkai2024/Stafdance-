import { Hospital, User, AttendanceRecord, UserRole } from '../types';
import { supabase } from './supabaseClient';

const HOSPITALS_KEY = 'mediguard_hospitals';
const USERS_KEY = 'mediguard_users';
const ATTENDANCE_KEY = 'mediguard_attendance';
const DEVICE_ID_KEY = 'mediguard_device_id';

// --- Synchronization Logic ---

export const syncFromSupabase = async (): Promise<{success: boolean, message: string}> => {
  if (!navigator.onLine) return { success: false, message: 'Offline' };

  try {
    // 1. Fetch Hospitals
    const { data: hospitals, error: hError } = await supabase.from('hospitals').select('*');
    if (hospitals && !hError) {
      localStorage.setItem(HOSPITALS_KEY, JSON.stringify(hospitals));
    }

    // 2. Fetch Users
    const { data: users, error: uError } = await supabase.from('users').select('*');
    if (users && !uError) {
      // Map database columns back to TS interface if necessary (snake_case to camelCase is auto-handled by JS usually, but explicit mapping is safer if Supabase isn't configured for camelCase)
      // Assuming straightforward mapping for now based on the schema provided.
      const mappedUsers = users.map((u: any) => ({
        id: u.id,
        name: u.name,
        role: u.role,
        hospitalId: u.hospital_id,
        pin: u.pin,
        boundDeviceId: u.bound_device_id,
        profilePicture: u.profile_picture
      }));
      localStorage.setItem(USERS_KEY, JSON.stringify(mappedUsers));
    }

    // 3. Fetch Attendance
    const { data: attendance, error: aError } = await supabase.from('attendance_records').select('*');
    if (attendance && !aError) {
       const mappedAttendance = attendance.map((r: any) => ({
         id: r.id,
         userId: r.user_id,
         userName: r.user_name,
         hospitalId: r.hospital_id,
         hospitalName: r.hospital_name,
         checkInTime: r.check_in_time,
         checkOutTime: r.check_out_time,
         checkInCoords: r.check_in_coords,
         checkOutCoords: r.check_out_coords,
         flagged: r.flagged,
         distanceFromCenter: r.distance_from_center,
         durationMinutes: r.duration_minutes,
         checkInDeviceId: r.check_in_device_id,
         checkOutDeviceId: r.check_out_device_id,
         anomaly: r.anomaly
       }));
       localStorage.setItem(ATTENDANCE_KEY, JSON.stringify(mappedAttendance));
    }

    return { success: true, message: 'Data synced from cloud' };
  } catch (err) {
    console.error("Sync Error:", err);
    return { success: false, message: 'Sync failed' };
  }
};

// --- Device Security ---
export const getOrCreateDeviceId = (): string => {
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
};

// --- Config Sync (Legacy Link Generation - still useful for quick sharing) ---
export const generateHospitalConfigLink = (hospitalId: string): string => {
  const hospital = getHospitals().find(h => h.id === hospitalId);
  const staff = getUsers().filter(u => u.hospitalId === hospitalId);
  
  if (!hospital) return '';

  const payload = {
    hospital,
    staff,
    timestamp: Date.now()
  };

  const encoded = btoa(JSON.stringify(payload));
  const url = new URL(window.location.href);
  url.searchParams.set('config', encoded);
  return url.toString();
};

export const importHospitalConfig = (encoded: string): { success: boolean, message: string, hospitalName?: string } => {
  try {
    const json = atob(encoded);
    const payload = JSON.parse(json);
    
    if (!payload.hospital || !payload.staff) throw new Error("Invalid Config");

    const hospitals = getHospitals();
    const hIndex = hospitals.findIndex(h => h.id === payload.hospital.id);
    if (hIndex >= 0) {
      hospitals[hIndex] = payload.hospital;
    } else {
      hospitals.push(payload.hospital);
    }
    localStorage.setItem(HOSPITALS_KEY, JSON.stringify(hospitals));
    // Also sync to cloud
    saveHospital(payload.hospital); 

    const users = getUsers();
    payload.staff.forEach((newStaff: User) => {
      saveUser(newStaff); // This handles local + cloud
    });

    return { success: true, message: 'Configuration imported successfully.', hospitalName: payload.hospital.name };
  } catch (e) {
    console.error(e);
    return { success: false, message: 'Failed to import configuration. Link may be corrupted.' };
  }
};

// --- Attendance Sync (Manual) ---
export const exportAttendanceData = (hospitalId: string, userId?: string): string => {
  const records = getAttendanceRecords().filter(r => 
    r.hospitalId === hospitalId && (!userId || r.userId === userId)
  );
  return btoa(JSON.stringify(records));
};

export const importAttendanceData = (encodedData: string): { success: boolean, count: number } => {
  try {
    const incomingRecords: AttendanceRecord[] = JSON.parse(atob(encodedData));
    if (!Array.isArray(incomingRecords)) return { success: false, count: 0 };

    let updatedCount = 0;
    incomingRecords.forEach(incoming => {
       saveAttendanceRecord(incoming); // Uses the updated save logic (Local + Cloud)
       updatedCount++;
    });

    return { success: true, count: updatedCount };
  } catch (e) {
    console.error("Import failed", e);
    return { success: false, count: 0 };
  }
};

// --- Hospitals ---
export const getHospitals = (): Hospital[] => {
  const data = localStorage.getItem(HOSPITALS_KEY);
  return data ? JSON.parse(data) : [];
};

export const saveHospital = async (hospital: Hospital) => {
  // 1. Local
  const hospitals = getHospitals();
  // Check if exists to update or push
  const index = hospitals.findIndex(h => h.id === hospital.id);
  if (index !== -1) hospitals[index] = hospital;
  else hospitals.push(hospital);
  localStorage.setItem(HOSPITALS_KEY, JSON.stringify(hospitals));

  // 2. Cloud
  if (navigator.onLine) {
    await supabase.from('hospitals').upsert(hospital);
  }
};

export const updateHospital = async (updatedHospital: Hospital) => {
  await saveHospital(updatedHospital);
};

export const deleteHospital = async (hospitalId: string) => {
  // 1. Local
  const hospitals = getHospitals().filter(h => h.id !== hospitalId);
  localStorage.setItem(HOSPITALS_KEY, JSON.stringify(hospitals));
  
  const users = getUsers().filter(u => u.hospitalId !== hospitalId);
  localStorage.setItem(USERS_KEY, JSON.stringify(users));

  // 2. Cloud
  if (navigator.onLine) {
    await supabase.from('hospitals').delete().eq('id', hospitalId);
    // Optional: cascade delete users via Supabase foreign keys, 
    // or manually delete here if no FK constraints.
    await supabase.from('users').delete().eq('hospital_id', hospitalId); 
  }
};

// --- Users ---
export const getUsers = (): User[] => {
  const data = localStorage.getItem(USERS_KEY);
  return data ? JSON.parse(data) : [];
};

export const getStaffByHospital = (hospitalId: string): User[] => {
  return getUsers().filter(u => u.hospitalId === hospitalId && u.role === UserRole.STAFF);
};

export const saveUser = async (user: User) => {
  // 1. Local
  const users = getUsers();
  const index = users.findIndex(u => u.id === user.id);
  if (index !== -1) users[index] = user;
  else users.push(user);
  localStorage.setItem(USERS_KEY, JSON.stringify(users));

  // 2. Cloud
  if (navigator.onLine) {
    const dbUser = {
      id: user.id,
      name: user.name,
      role: user.role,
      hospital_id: user.hospitalId,
      pin: user.pin,
      bound_device_id: user.boundDeviceId,
      profile_picture: user.profilePicture // Ensure your Supabase column is TEXT (base64 can be large)
    };
    await supabase.from('users').upsert(dbUser);
  }
};

export const updateUser = async (updatedUser: User) => {
  await saveUser(updatedUser);
};

export const deleteUser = async (userId: string) => {
    // 1. Local
    const users = getUsers().filter(u => u.id !== userId);
    localStorage.setItem(USERS_KEY, JSON.stringify(users));

    // 2. Cloud
    if (navigator.onLine) {
      await supabase.from('users').delete().eq('id', userId);
    }
};

export const loginHospital = (username: string, password: string): Hospital | null => {
  const hospitals = getHospitals();
  return hospitals.find(h => h.username === username && h.password === password) || null;
};

// --- Attendance ---
export const getAttendanceRecords = (): AttendanceRecord[] => {
  const data = localStorage.getItem(ATTENDANCE_KEY);
  return data ? JSON.parse(data) : [];
};

export const saveAttendanceRecord = async (record: AttendanceRecord) => {
  // 1. Local
  const records = getAttendanceRecords();
  // Check if exists (for upsert logic)
  const index = records.findIndex(r => r.id === record.id);
  if (index !== -1) records[index] = record;
  else records.push(record);
  localStorage.setItem(ATTENDANCE_KEY, JSON.stringify(records));

  // 2. Cloud
  if (navigator.onLine) {
    const dbRecord = {
      id: record.id,
      user_id: record.userId,
      user_name: record.userName,
      hospital_id: record.hospitalId,
      hospital_name: record.hospitalName,
      check_in_time: record.checkInTime,
      check_out_time: record.checkOutTime,
      check_in_coords: record.checkInCoords,
      check_out_coords: record.checkOutCoords,
      flagged: record.flagged,
      distance_from_center: record.distanceFromCenter,
      duration_minutes: record.durationMinutes,
      check_in_device_id: record.checkInDeviceId,
      check_out_device_id: record.checkOutDeviceId,
      anomaly: record.anomaly
    };
    await supabase.from('attendance_records').upsert(dbRecord);
  }
};

export const updateAttendanceRecord = async (updatedRecord: AttendanceRecord) => {
  await saveAttendanceRecord(updatedRecord);
};

export const getActiveRecord = (userId: string): AttendanceRecord | undefined => {
  const records = getAttendanceRecords();
  return records.find(r => r.userId === userId && !r.checkOutTime);
};

// Initialize Mock Data
export const initMockData = () => {
  // Check for Super Admin
  const users = getUsers();
  if (!users.some(u => u.role === UserRole.ADMIN)) {
    saveUser({
      id: 'admin-super',
      name: 'System Owner',
      role: UserRole.ADMIN,
      hospitalId: '',
      pin: '0000'
    });
  }
};