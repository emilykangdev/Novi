import { mysqlTable, varchar, text, timestamp, json, int, boolean, index } from 'drizzle-orm/mysql-core';
import { relations } from 'drizzle-orm';

// Users table for authentication and preferences
export const users = mysqlTable('users', {
  id: varchar('id', { length: 255 }).primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  name: varchar('name', { length: 255 }),
  avatar: text('avatar'),
  preferences: json('preferences').$type<{
    notificationSettings?: {
      email: boolean;
      push: boolean;
    };
    contentSources?: string[];
    summaryFrequency?: 'realtime' | 'daily' | 'weekly';
  }>(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow(),
}, (table) => ({
  emailIdx: index('email_idx').on(table.email),
}));

// Content sources (YouTube channels, RSS feeds, newsletters)
export const contentSources = mysqlTable('content_sources', {
  id: varchar('id', { length: 255 }).primaryKey(),
  userId: varchar('user_id', { length: 255 }).notNull(),
  type: varchar('type', { length: 50 }).notNull(), // 'youtube', 'rss', 'newsletter'
  name: varchar('name', { length: 255 }).notNull(),
  url: text('url').notNull(),
  metadata: json('metadata').$type<{
    channelId?: string;
    feedUrl?: string;
    lastChecked?: string;
    isActive?: boolean;
  }>(),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow(),
}, (table) => ({
  userIdx: index('user_idx').on(table.userId),
  typeIdx: index('type_idx').on(table.type),
}));

// Raw content items (videos, articles, newsletters)
export const contentItems = mysqlTable('content_items', {
  id: varchar('id', { length: 255 }).primaryKey(),
  sourceId: varchar('source_id', { length: 255 }).notNull(),
  type: varchar('type', { length: 50 }).notNull(),
  title: varchar('title', { length: 500 }).notNull(),
  url: text('url'),
  content: text('content'), // Full content/transcript
  metadata: json('metadata').$type<{
    author?: string;
    publishedAt?: string;
    duration?: number;
    thumbnailUrl?: string;
    tags?: string[];
  }>(),
  publishedAt: timestamp('published_at'),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  sourceIdx: index('source_idx').on(table.sourceId),
  publishedIdx: index('published_idx').on(table.publishedAt),
  typeIdx: index('type_idx').on(table.type),
}));

// AI-generated summaries
export const summaries = mysqlTable('summaries', {
  id: varchar('id', { length: 255 }).primaryKey(),
  contentItemId: varchar('content_item_id', { length: 255 }).notNull(),
  userId: varchar('user_id', { length: 255 }).notNull(),
  summary: text('summary').notNull(),
  keyPoints: json('key_points').$type<string[]>(),
  sentiment: varchar('sentiment', { length: 50 }), // 'positive', 'negative', 'neutral'
  topics: json('topics').$type<string[]>(),
  aiModel: varchar('ai_model', { length: 100 }), // Which AI model generated this
  confidence: int('confidence'), // 0-100 confidence score
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  contentIdx: index('content_idx').on(table.contentItemId),
  userIdx: index('user_idx').on(table.userId),
  createdIdx: index('created_idx').on(table.createdAt),
}));

// Storage locations (Notion pages, Google Docs)
export const storageLocations = mysqlTable('storage_locations', {
  id: varchar('id', { length: 255 }).primaryKey(),
  summaryId: varchar('summary_id', { length: 255 }).notNull(),
  provider: varchar('provider', { length: 50 }).notNull(), // 'notion', 'google_docs'
  externalId: varchar('external_id', { length: 255 }).notNull(), // Page ID, Doc ID
  url: text('url'),
  metadata: json('metadata').$type<{
    pageTitle?: string;
    parentId?: string;
    permissions?: string[];
  }>(),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  summaryIdx: index('summary_idx').on(table.summaryId),
  providerIdx: index('provider_idx').on(table.provider),
}));

// User interactions and conversations
export const conversations = mysqlTable('conversations', {
  id: varchar('id', { length: 255 }).primaryKey(),
  userId: varchar('user_id', { length: 255 }).notNull(),
  query: text('query').notNull(),
  response: text('response').notNull(),
  context: json('context').$type<{
    relatedSummaries?: string[];
    sources?: string[];
    confidence?: number;
  }>(),
  responseType: varchar('response_type', { length: 50 }), // 'text', 'audio'
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  userIdx: index('user_idx').on(table.userId),
  createdIdx: index('created_idx').on(table.createdAt),
}));

// Define relationships
export const usersRelations = relations(users, ({ many }) => ({
  contentSources: many(contentSources),
  summaries: many(summaries),
  conversations: many(conversations),
}));

export const contentSourcesRelations = relations(contentSources, ({ one, many }) => ({
  user: one(users, {
    fields: [contentSources.userId],
    references: [users.id],
  }),
  contentItems: many(contentItems),
}));

export const contentItemsRelations = relations(contentItems, ({ one, many }) => ({
  source: one(contentSources, {
    fields: [contentItems.sourceId],
    references: [contentSources.id],
  }),
  summaries: many(summaries),
}));

export const summariesRelations = relations(summaries, ({ one, many }) => ({
  contentItem: one(contentItems, {
    fields: [summaries.contentItemId],
    references: [contentItems.id],
  }),
  user: one(users, {
    fields: [summaries.userId],
    references: [users.id],
  }),
  storageLocations: many(storageLocations),
}));

export const storageLocationsRelations = relations(storageLocations, ({ one }) => ({
  summary: one(summaries, {
    fields: [storageLocations.summaryId],
    references: [summaries.id],
  }),
}));

export const conversationsRelations = relations(conversations, ({ one }) => ({
  user: one(users, {
    fields: [conversations.userId],
    references: [users.id],
  }),
}));
