export enum UserRole {
  ADMIN = 'ADMIN', // Super Admin
  MANAGER = 'MANAGER', // Hospital Admin
  STAFF = 'STAFF'
}

export interface Coords {
  latitude: number;
  longitude: number;
  accuracy?: number;
}

export interface Hospital {
  id: string;
  name: string;
  registrationNumber: string;
  username: string; // Used for Hospital Login
  password: string; // Used for Hospital Login
  coords: Coords;
  radius: number; // in meters
}

export interface User {
  id: string;
  name: string;
  role: UserRole;
  hospitalId: string; // Links staff to a specific hospital
  pin: string; // Simple 4-digit pin for staff access
  boundDeviceId?: string; // Security: Locks user to a specific device/phone
}

export interface AttendanceRecord {
  id: string;
  userId: string;
  userName: string;
  hospitalId: string;
  hospitalName: string;
  checkInTime: string; // ISO string
  checkOutTime?: string; // ISO string
  checkInCoords: Coords;
  checkOutCoords?: Coords;
  flagged: boolean; // True if checked in/out outside radius
  distanceFromCenter: number; // in meters at check-in
  durationMinutes?: number;
}

export interface AttendanceStats {
  totalShifts: number;
  flaggedShifts: number;
  averageDuration: number;
}