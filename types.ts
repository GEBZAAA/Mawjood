
export enum City {
  MECCA = 'Makkah',
  MADINA = 'Madina'
}

export type Language = 'en' | 'ar' | 'ur' | 'id' | 'tr' | 'fr' | 'ms' | 'bn' | 'hi' | 'de' | 'fa' | 'ru' | 'zh' | 'es' | 'pt' | 'ha' | 'sw' | 'so';

export interface User {
  passportNumber: string;
  fullName: string;
  email: string;
  phoneNumber?: string;
  password?: string;
  gender?: 'male' | 'female' | 'prefer-not-to-say';
  nationality?: string;
  dob?: string;
}

export interface AuthenticatedUser extends User {
  username: string;
  role: string;
}

export interface FoundItem {
  id: string;
  name: string;
  nameEn?: string;
  description: string;
  descriptionEn?: string;
  foundLocation: string;
  foundLocationEn?: string;
  city: City;
  dateFound: string;
  pickupOffice: string;
  pickupInstructions: string;
  imageUrl?: string;
  imageUrls?: string[];
  status?: 'APPROVED' | 'PENDING' | 'PENDING_DELETION';
  coordinates?: { lat: number; lng: number };
  submittedBy?: string;
  createdAt?: string;
}

export interface LostItemReport {
  id?: string;
  name: string;
  description: string;
  city: City;
  images: string[]; // base64 array
  status?: 'PENDING' | 'MATCHED' | 'RESOLVED';
  userId?: string;
  dateLost?: string;
  createdAt?: string;
  coordinates?: { lat: number; lng: number };
}

export interface MatchResult {
  itemId: string;
  matchScore: number;
  reason: string;
}

export interface ClaimRequest {
  id: string;
  itemId: string;
  userId: string;
  userName: string;
  userPassport: string;
  userPhone: string;
  userEmail: string;
  itemName: string;
  itemImage: string;
  description: string;
  lostDate: string;
  lostTime: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  timestamp: string;
}

export type View = 'HOME' | 'SEARCH' | 'REPORT_FOUND' | 'REPORT_LOST' | 'PROFILE' | 'HELP' | 'SETTINGS' | 'NOTIFICATIONS';
export type Step = 'AUTH' | 'MAIN';

export interface Notification {
  id: string;
  userId: string;
  title: string;
  titleAr?: string;
  message: string;
  messageAr?: string;
  type: 'CLAIM_APPROVED' | 'REPORT_APPROVED' | 'REPORT_THANK_YOU' | 'GENERAL' | 'MATCH_FOUND';
  read: boolean;
  createdAt: string;
}
