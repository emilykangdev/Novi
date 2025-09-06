// Shared TypeScript types for Novi

export interface User {
  id: string;
  email: string;
  name?: string;
  avatar?: string;
  preferences?: UserPreferences;
  createdAt: Date;
  updatedAt: Date;
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
  userId: string;
  type: 'youtube' | 'rss' | 'newsletter';
  name: string;
  url: string;
  metadata?: ContentSourceMetadata;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ContentSourceMetadata {
  channelId?: string;
  feedUrl?: string;
  lastChecked?: string;
  isActive?: boolean;
}

export interface ContentItem {
  id: string;
  sourceId: string;
  type: 'video' | 'article' | 'newsletter';
  title: string;
  url?: string;
  content?: string;
  metadata?: ContentItemMetadata;
  publishedAt?: Date;
  createdAt: Date;
}

export interface ContentItemMetadata {
  author?: string;
  publishedAt?: string;
  duration?: number;
  thumbnailUrl?: string;
  tags?: string[];
}

export interface Summary {
  id: string;
  contentItemId: string;
  userId: string;
  summary: string;
  keyPoints?: string[];
  sentiment?: 'positive' | 'negative' | 'neutral';
  topics?: string[];
  aiModel?: string;
  confidence?: number;
  createdAt: Date;
}

export interface StorageLocation {
  id: string;
  summaryId: string;
  provider: 'notion' | 'google_docs';
  externalId: string;
  url?: string;
  metadata?: StorageMetadata;
  createdAt: Date;
}

export interface StorageMetadata {
  pageTitle?: string;
  parentId?: string;
  permissions?: string[];
}

export interface Conversation {
  id: string;
  userId: string;
  query: string;
  response: string;
  context?: ConversationContext;
  responseType?: 'text' | 'audio';
  createdAt: Date;
}

export interface ConversationContext {
  relatedSummaries?: string[];
  sources?: string[];
  confidence?: number;
}

// Agent-specific types
export interface AgentTask {
  id: string;
  type: 'summarize' | 'monitor' | 'respond';
  payload: any;
  priority: 'low' | 'medium' | 'high';
  scheduledAt?: Date;
  completedAt?: Date;
  error?: string;
}

export interface SummarizationRequest {
  contentItem: ContentItem;
  userId: string;
  options?: {
    maxLength?: number;
    includeKeyPoints?: boolean;
    includeSentiment?: boolean;
    includeTopics?: boolean;
  };
}

export interface SummarizationResponse {
  summary: Summary;
  storageLocations?: StorageLocation[];
  error?: string;
}

// API Response types
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

// Audio/Speech types
export interface AudioRequest {
  text: string;
  voiceId?: string;
  options?: {
    speed?: number;
    pitch?: number;
    volume?: number;
  };
}

export interface AudioResponse {
  audioUrl: string;
  duration: number;
  format: string;
}

// External service types
export interface YouTubeVideo {
  id: string;
  title: string;
  description: string;
  publishedAt: string;
  channelId: string;
  channelTitle: string;
  thumbnails: {
    default: { url: string };
    medium: { url: string };
    high: { url: string };
  };
  duration: string;
  transcript?: string;
}

export interface RSSItem {
  title: string;
  link: string;
  description: string;
  pubDate: string;
  author?: string;
  categories?: string[];
  content?: string;
}

export interface NotionPage {
  id: string;
  title: string;
  url: string;
  parentId?: string;
  properties: Record<string, any>;
  content: any[];
}

export interface GoogleDoc {
  id: string;
  title: string;
  url: string;
  content: string;
  permissions: Array<{
    type: string;
    role: string;
    emailAddress?: string;
  }>;
}
