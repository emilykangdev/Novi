import { elevenLabsService } from './elevenlabs';
import { storageManager } from '../storage';
import { db } from '../database/connection';
import { conversations, summaries, contentItems } from '../database/schema';
import { eq, desc, and, like, or } from 'drizzle-orm';
import type { Conversation, ConversationContext, AudioRequest } from '../shared/types';

/**
 * User Interaction Service
 * 
 * Handles user questions, generates responses, and manages conversation history.
 * Integrates with AI agents, audio generation, and storage systems.
 */

export class InteractionService {
  /**
   * Process a user query and generate a response
   */
  async processQuery(
    userId: string,
    query: string,
    responseType: 'text' | 'audio' = 'text'
  ): Promise<Conversation> {
    try {
      // Search for relevant summaries
      const relevantSummaries = await this.searchRelevantContent(userId, query);
      
      // Get conversation context
      const context = await this.getConversationContext(userId);
      
      // Generate AI response (this would call the interaction agent)
      const aiResponse = await this.generateAIResponse(query, relevantSummaries, context);
      
      // Generate audio if requested
      let audioUrl: string | undefined;
      if (responseType === 'audio' && elevenLabsService.isConfigured()) {
        try {
          const audioRequest: AudioRequest = {
            text: aiResponse,
            options: {
              stability: 0.5,
              similarity_boost: 0.5
            }
          };
          const audioResponse = await elevenLabsService.generateAudio(audioRequest);
          audioUrl = audioResponse.audioUrl;
        } catch (audioError) {
          console.error('Audio generation failed:', audioError);
          // Continue without audio
        }
      }
      
      // Save conversation to database
      const conversationId = `conv_${generateId()}_${Date.now()}`;
      const conversation: Conversation = {
        id: conversationId,
        userId,
        query,
        response: aiResponse,
        context: {
          relatedSummaries: relevantSummaries.map(s => s.id),
          sources: relevantSummaries.map(s => s.title),
          confidence: this.calculateConfidence(relevantSummaries.length, query)
        },
        responseType,
        audioUrl,
        createdAt: new Date().toISOString()
      };
      
      await db.insert(conversations).values({
        id: conversationId,
        userId,
        query,
        response: aiResponse,
        context: conversation.context,
        responseType,
        createdAt: new Date()
      });
      
      return conversation;
      
    } catch (error) {
      console.error('Query processing error:', error);
      throw new Error('Failed to process query');
    }
  }

  /**
   * Search for relevant content based on user query
   */
  private async searchRelevantContent(userId: string, query: string, limit: number = 5) {
    const searchTerms = query.toLowerCase().split(' ').filter(term => term.length > 2);
    
    if (searchTerms.length === 0) {
      // Return recent summaries if no search terms
      return await db
        .select({
          id: summaries.id,
          title: contentItems.title,
          summary: summaries.summary,
          keyPoints: summaries.keyPoints,
          topics: summaries.topics,
          createdAt: summaries.createdAt
        })
        .from(summaries)
        .innerJoin(contentItems, eq(summaries.contentItemId, contentItems.id))
        .where(eq(summaries.userId, userId))
        .orderBy(desc(summaries.createdAt))
        .limit(limit);
    }
    
    return await db
      .select({
        id: summaries.id,
        title: contentItems.title,
        summary: summaries.summary,
        keyPoints: summaries.keyPoints,
        topics: summaries.topics,
        createdAt: summaries.createdAt
      })
      .from(summaries)
      .innerJoin(contentItems, eq(summaries.contentItemId, contentItems.id))
      .where(
        and(
          eq(summaries.userId, userId),
          or(
            ...searchTerms.map(term => like(summaries.summary, `%${term}%`)),
            ...searchTerms.map(term => like(contentItems.title, `%${term}%`))
          )
        )
      )
      .orderBy(desc(summaries.createdAt))
      .limit(limit);
  }

  /**
   * Get recent conversation context
   */
  private async getConversationContext(userId: string): Promise<ConversationContext> {
    const recentConversations = await db
      .select()
      .from(conversations)
      .where(eq(conversations.userId, userId))
      .orderBy(desc(conversations.createdAt))
      .limit(3);

    return {
      relatedSummaries: [],
      sources: [],
      confidence: 0
    };
  }

  /**
   * Generate AI response (placeholder - would call interaction agent)
   */
  private async generateAIResponse(
    query: string,
    relevantSummaries: any[],
    context: ConversationContext
  ): Promise<string> {
    // This is a placeholder implementation
    // In the real system, this would call the interaction agent via Agentuity
    
    if (relevantSummaries.length === 0) {
      return "I don't have any relevant summaries to answer your question. Try adding some content sources or asking about something else!";
    }
    
    const summaryTitles = relevantSummaries.map(s => s.title).join(', ');
    
    return `Based on your content summaries, I found information related to: ${summaryTitles}. Here's what I can tell you: ${relevantSummaries[0].summary.substring(0, 200)}... Would you like me to elaborate on any specific aspect?`;
  }

  /**
   * Calculate confidence score based on available information
   */
  private calculateConfidence(resultsCount: number, query: string): number {
    const baseConfidence = Math.min(resultsCount * 20, 80);
    const queryComplexity = query.split(' ').length;
    const complexityBonus = Math.min(queryComplexity * 2, 20);
    
    return Math.min(baseConfidence + complexityBonus, 95);
  }

  /**
   * Get conversation history for a user
   */
  async getConversationHistory(userId: string, limit: number = 50): Promise<Conversation[]> {
    const dbConversations = await db
      .select()
      .from(conversations)
      .where(eq(conversations.userId, userId))
      .orderBy(desc(conversations.createdAt))
      .limit(limit);

    return dbConversations.map(conv => ({
      id: conv.id,
      userId: conv.userId,
      query: conv.query,
      response: conv.response,
      context: conv.context as ConversationContext,
      responseType: conv.responseType as 'text' | 'audio',
      createdAt: conv.createdAt.toISOString()
    }));
  }

  /**
   * Delete conversation history
   */
  async clearConversationHistory(userId: string): Promise<void> {
    await db
      .delete(conversations)
      .where(eq(conversations.userId, userId));
  }

  /**
   * Generate audio for existing text response
   */
  async generateAudioForResponse(conversationId: string): Promise<string | null> {
    if (!elevenLabsService.isConfigured()) {
      throw new Error('Audio service not configured');
    }

    try {
      const conversation = await db
        .select()
        .from(conversations)
        .where(eq(conversations.id, conversationId))
        .limit(1);

      if (conversation.length === 0) {
        throw new Error('Conversation not found');
      }

      const audioRequest: AudioRequest = {
        text: conversation[0].response,
        options: {
          stability: 0.5,
          similarity_boost: 0.5
        }
      };

      const audioResponse = await elevenLabsService.generateAudio(audioRequest);
      
      // Update conversation with audio URL
      await db
        .update(conversations)
        .set({ responseType: 'audio' })
        .where(eq(conversations.id, conversationId));

      return audioResponse.audioUrl;
    } catch (error) {
      console.error('Audio generation error:', error);
      return null;
    }
  }
}

// Helper function
function generateId(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

export const interactionService = new InteractionService();
