export type UserRole = 'driver' | 'admin';

export interface UserProfile {
  uid: string;
  email: string;
  displayName?: string;
  role: UserRole;
  createdAt: string;
}

export interface Note {
  id: string;
  userId: string;
  latitude: number;
  longitude: number;
  address?: string;
  category: string;
  transcription: string;
  voiceCommand?: string;
  audioDuration?: number;
  createdAt: string;
  synced?: boolean;
  offlineCreated?: boolean;
}

export interface PresetLocation {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  address: string;
  category: string;
  description: string;
  regionBreadcrumb?: string;
}

export interface PushNotification {
  id: string;
  title: string;
  message: string;
  type: 'sync' | 'alert' | 'recording' | 'tag';
  timestamp: string;
}
