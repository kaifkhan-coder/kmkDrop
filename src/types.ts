export type ThemeMode = 'dark' | 'light' | 'oled';

export interface UserSession {
  id: string;
  email: string;
  name: string;
  initials: string;
  provider?: 'magic_link' | 'google';
  authenticatedAt: number;
}

export interface FileMetadata {
  id: string;
  name: string;
  size: number;
  type: string;
  lastModified?: number;
  totalChunks: number;
  checksum?: string;
  iv?: string; // Base64
}

export type TransferStatus = 'idle' | 'connecting' | 'preparing' | 'transferring' | 'paused' | 'completed' | 'failed' | 'cancelled';

export interface TransferProgress {
  fileId: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  bytesTransferred: number;
  percent: number;
  speedBps: number;
  etaSeconds: number;
  status: TransferStatus;
  currentChunk: number;
  totalChunks: number;
  direction: 'sending' | 'receiving';
  peerDeviceName?: string;
  transportMode: 'webrtc' | 'relay';
  error?: string;
}

export interface ReceivedFileItem {
  id: string;
  name: string;
  size: number;
  type: string;
  blob: Blob;
  url: string;
  checksum: string;
  verified: boolean;
  receivedAt: number;
  senderDevice?: string;
}

export interface TransferHistoryItem {
  id: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  direction: 'sent' | 'received';
  timestamp: number;
  speedAvgBps?: number;
  peerName?: string;
  status: 'completed' | 'cancelled' | 'failed';
  downloadUrl?: string;
}

export interface PeerDevice {
  id: string;
  deviceName: string;
  deviceType: 'mobile' | 'desktop' | 'tablet' | 'unknown';
}

export interface FeedbackSubmission {
  id: string;
  rating: number; // 1-5
  category: 'suggestion' | 'bug' | 'evaluation' | 'feature';
  feedbackText: string;
  userEmail: string;
  userName?: string;
  targetEmail: string;
  deviceInfo?: string;
  transferStats?: {
    totalSent: number;
    totalReceived: number;
  };
  submittedAt: number;
}

export interface PeerTextMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderDeviceType: 'mobile' | 'desktop' | 'tablet' | 'unknown';
  text: string;
  timestamp: number;
  direction: 'sent' | 'received';
}

export interface ActivePeerUser {
  id: string;
  name: string;
  email?: string;
  deviceType: 'mobile' | 'desktop' | 'tablet' | 'unknown';
  deviceName: string;
  roomId: string;
  joinedAt: number;
  lastActive: number;
  status: 'active' | 'idle' | 'online';
  isSelf?: boolean;
}

export interface ActiveUsersStats {
  totalOnlineUsers: number;
  totalRooms: number;
  users: ActivePeerUser[];
  timestamp: number;
}

export interface AdminUserRecord {
  id: string;
  name: string;
  email?: string;
  deviceType: 'mobile' | 'desktop' | 'tablet' | 'unknown';
  deviceName: string;
  roomId?: string;
  firstSeen: number;
  lastActive: number;
  transferCount: number;
  status: 'online' | 'offline';
}

export interface AdminFeedbackRecord {
  id: string;
  targetRecipient: string;
  rating: number;
  category: string;
  feedbackText: string;
  userEmail: string;
  userName: string;
  deviceInfo?: string;
  transferStats?: any;
  isMandatorySecondUsage?: boolean;
  submittedAt: number;
  status: string;
}

export interface AdminStats {
  totalTrackedUsers: number;
  activeConnections: number;
  activeRooms: number;
  totalFeedback: number;
  averageRating: number;
  uptimeSeconds: number;
  timestamp: number;
}

export interface AdminSession {
  token: string;
  email: string;
  name: string;
  authenticatedAt: number;
}


