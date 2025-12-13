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

// --- Users ---
export const getUsers = (): User[] => {
  const data = localStorage.getItem(USERS_KEY);
  return data ? JSON.parse(data) : [];
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

/**
 * Handles the secure login process enforcing "One Device One Phone"
 */
export const validateAndLoginUser = (username: string): { success: boolean, error?: string, user?: User } => {
  const users = getUsers();
  const targetUser = users.find(u => u.username === username);

  if (!targetUser) {
    return { success: false, error: 'User not found. Check username.' };
  }

  // Admin bypasses device locks for management purposes
  if (targetUser.role === UserRole.ADMIN) {
    return { success: true, user: targetUser };
  }

  const currentDeviceId = getOrCreateDeviceId();

  // SECURITY CHECK 1: Is this device already owned by ANOTHER staff member?
  // Prevent Staff A from logging in on Staff B's phone.
  const deviceOwner = users.find(u => u.boundDeviceId === currentDeviceId && u.id !== targetUser.id);
  if (deviceOwner) {
    return {
      success: false,
      error: `Security Alert: This device is already registered to ${deviceOwner.name}. You cannot log in here.`
    };
  }

  // SECURITY CHECK 2: Is this user already bound to a DIFFERENT device?
  // Prevent Staff A (who has Phone A) from logging in on Phone B.
  if (targetUser.boundDeviceId && targetUser.boundDeviceId !== currentDeviceId) {
    return {
      success: false,
      error: `Security Alert: Your account is linked to a different device. Please use your registered phone or ask Admin to reset.`
    };
  }

  // If checks pass, BIND the device if it's the first time
  if (!targetUser.boundDeviceId) {
    targetUser.boundDeviceId = currentDeviceId;
    updateUser(targetUser); // Save the binding permanently
  }

  return { success: true, user: targetUser };
};

// kept for backward compatibility if needed, but validateAndLoginUser is preferred
export const loginUser = (username: string): User | null => {
  const res = validateAndLoginUser(username);
  return res.success && res.user ? res.user : null;
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
  // Find record where checkOutTime is missing
  return records.find(r => r.userId === userId && !r.checkOutTime);
};

// Initialize Admin if empty
export const initMockData = () => {
  const users = getUsers();
  if (!users.some(u => u.role === UserRole.ADMIN)) {
    saveUser({
      id: 'admin-1',
      name: 'Hospital Administrator',
      username: 'admin',
      role: UserRole.ADMIN
    });
  }
};