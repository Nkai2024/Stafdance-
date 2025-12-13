export enum UserRole {
  ADMIN = 'ADMIN',
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
  coords: Coords;
  radius: number; // in meters
}

export interface User {
  id: string;
  name: string;
  username: string;
  role: UserRole;
  hospitalId?: string; // Links staff to a specific hospital
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