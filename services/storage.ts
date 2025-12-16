import { Hospital, User, AttendanceRecord, UserRole } from '../types';

const HOSPITALS_KEY = 'mediguard_hospitals';
const USERS_KEY = 'mediguard_users';
const ATTENDANCE_KEY = 'mediguard_attendance';
const DEVICE_ID_KEY = 'mediguard_device_id';

// --- Device Security ---
export const getOrCreateDeviceId = (): string => {
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
};

// --- Config Sync (Link Generation) ---
export const generateHospitalConfigLink = (hospitalId: string): string => {
  const hospital = getHospitals().find(h => h.id === hospitalId);
  const staff = getUsers().filter(u => u.hospitalId === hospitalId);
  
  if (!hospital) return '';

  const payload = {
    hospital,
    staff,
    timestamp: Date.now()
  };

  // Create a base64 encoded string of the configuration
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

    // 1. Save Hospital (Update if exists, add if not)
    const hospitals = getHospitals();
    const hIndex = hospitals.findIndex(h => h.id === payload.hospital.id);
    if (hIndex >= 0) {
      hospitals[hIndex] = payload.hospital;
    } else {
      hospitals.push(payload.hospital);
    }
    localStorage.setItem(HOSPITALS_KEY, JSON.stringify(hospitals));

    // 2. Save Staff (Merge)
    const users = getUsers();
    payload.staff.forEach((newStaff: User) => {
      const uIndex = users.findIndex(u => u.id === newStaff.id);
      if (uIndex >= 0) {
        users[uIndex] = newStaff;
      } else {
        users.push(newStaff);
      }
    });
    localStorage.setItem(USERS_KEY, JSON.stringify(users));

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

    const currentRecords = getAttendanceRecords();
    let updatedCount = 0;

    incomingRecords.forEach(incoming => {
      const index = currentRecords.findIndex(c => c.id === incoming.id);
      
      if (index === -1) {
        // New record
        currentRecords.push(incoming);
        updatedCount++;
      } else {
        // Update existing only if incoming has more info (e.g. checkout time)
        const existing = currentRecords[index];
        if (!existing.checkOutTime && incoming.checkOutTime) {
          currentRecords[index] = incoming;
          updatedCount++;
        }
      }
    });

    localStorage.setItem(ATTENDANCE_KEY, JSON.stringify(currentRecords));
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

export const saveHospital = (hospital: Hospital) => {
  const hospitals = getHospitals();
  hospitals.push(hospital);
  localStorage.setItem(HOSPITALS_KEY, JSON.stringify(hospitals));
};

export const updateHospital = (updatedHospital: Hospital) => {
  const hospitals = getHospitals();
  const index = hospitals.findIndex(h => h.id === updatedHospital.id);
  if (index !== -1) {
    hospitals[index] = updatedHospital;
    localStorage.setItem(HOSPITALS_KEY, JSON.stringify(hospitals));
  }
};

export const deleteHospital = (hospitalId: string) => {
  const hospitals = getHospitals().filter(h => h.id !== hospitalId);
  localStorage.setItem(HOSPITALS_KEY, JSON.stringify(hospitals));
  
  // Also clean up staff associated with this hospital to keep data clean
  const users = getUsers().filter(u => u.hospitalId !== hospitalId);
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
};

// --- Users ---
export const getUsers = (): User[] => {
  const data = localStorage.getItem(USERS_KEY);
  return data ? JSON.parse(data) : [];
};

export const getStaffByHospital = (hospitalId: string): User[] => {
  return getUsers().filter(u => u.hospitalId === hospitalId && u.role === UserRole.STAFF);
};

export const saveUser = (user: User) => {
  const users = getUsers();
  users.push(user);
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
};

export const updateUser = (updatedUser: User) => {
  const users = getUsers();
  const index = users.findIndex(u => u.id === updatedUser.id);
  if (index !== -1) {
    users[index] = updatedUser;
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  }
};

export const deleteUser = (userId: string) => {
    const users = getUsers().filter(u => u.id !== userId);
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
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

export const saveAttendanceRecord = (record: AttendanceRecord) => {
  const records = getAttendanceRecords();
  records.push(record);
  localStorage.setItem(ATTENDANCE_KEY, JSON.stringify(records));
};

export const updateAttendanceRecord = (updatedRecord: AttendanceRecord) => {
  const records = getAttendanceRecords();
  const index = records.findIndex(r => r.id === updatedRecord.id);
  if (index !== -1) {
    records[index] = updatedRecord;
    localStorage.setItem(ATTENDANCE_KEY, JSON.stringify(records));
  }
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