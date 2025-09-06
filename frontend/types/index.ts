// Shared types for the React Native frontend

export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  preferences?: UserPreferences;
  createdAt: string;
}

export interface UserPreferences {
  notificationSettings?: {
    email: boolean;
    push: boolean;
  };
  contentSources?: string[];
  summaryFrequency?: 'realtime' | 'daily' | 'weekly';
}

export interface ContentSource {
  id: string;
  type: 'youtube' | 'rss' | 'newsletter';
  name: string;
  url: string;
  isActive: boolean;
  lastChecked?: string;
}

export interface Summary {
  id: string;
  title: string;
  summary: string;
  keyPoints?: string[];
  topics?: string[];
  sentiment?: 'positive' | 'negative' | 'neutral';
  confidence?: number;
  createdAt: string;
  contentType: 'video' | 'article' | 'newsletter';
  contentUrl?: string;
  author?: string;
}

export interface Conversation {
  id: string;
  query: string;
  response: string;
  relatedSummaries?: Summary[];
  confidence?: number;
  createdAt: string;
  responseType?: 'text' | 'audio';
  audioUrl?: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

// Navigation types
export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
};

export type MainTabParamList = {
  Home: undefined;
  Chat: undefined;
  Sources: undefined;
  Profile: undefined;
};

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
};

// Component prop types
export interface SummaryCardProps {
  summary: Summary;
  onPress?: () => void;
}

export interface ChatMessageProps {
  message: Conversation;
  isUser: boolean;
}

export interface VoiceInputProps {
  onTranscript: (text: string) => void;
  isListening: boolean;
  onStartListening: () => void;
  onStopListening: () => void;
}

export interface ContentSourceCardProps {
  source: ContentSource;
  onToggle: (id: string, active: boolean) => void;
  onEdit?: (source: ContentSource) => void;
  onDelete?: (id: string) => void;
}

// Audio types
export interface AudioPlaybackState {
  isPlaying: boolean;
  duration: number;
  position: number;
  isLoaded: boolean;
}

export interface VoiceRecordingState {
  isRecording: boolean;
  duration: number;
  uri?: string;
}

// Form types
export interface LoginForm {
  email: string;
  password: string;
}

export interface RegisterForm {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
}

export interface AddSourceForm {
  type: 'youtube' | 'rss' | 'newsletter';
  name: string;
  url: string;
}

// Store types (AuthState removed - using Firebase Auth directly)

export interface ChatState {
  conversations: Conversation[];
  isLoading: boolean;
  currentQuery: string;
  setCurrentQuery: (query: string) => void;
  sendMessage: (query: string, responseType?: 'text' | 'audio') => Promise<void>;
  clearConversations: () => void;
}

export interface SourcesState {
  sources: ContentSource[];
  isLoading: boolean;
  addSource: (source: AddSourceForm) => Promise<void>;
  updateSource: (id: string, updates: Partial<ContentSource>) => Promise<void>;
  deleteSource: (id: string) => Promise<void>;
  toggleSource: (id: string, active: boolean) => Promise<void>;
  refreshSources: () => Promise<void>;
}

export interface SummariesState {
  summaries: Summary[];
  isLoading: boolean;
  refreshSummaries: () => Promise<void>;
  getSummariesByType: (type: string) => Summary[];
  searchSummaries: (query: string) => Summary[];
}
