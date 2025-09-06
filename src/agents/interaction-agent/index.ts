import type { AgentContext, AgentRequest, AgentResponse } from '@agentuity/sdk';
import { db } from '../../database/connection';
import { summaries, contentItems, conversations, users } from '../../database/schema';
import { eq, desc, and, like, or } from 'drizzle-orm';
import { ChatOpenAI } from '@langchain/openai';
import { PromptTemplate } from '@langchain/core/prompts';
import type { Conversation, ConversationContext } from '../../shared/types';

/**
 * User Interaction Handler Agent
 * 
 * Handles user questions and provides responses based on stored summaries.
 * Implements conversational AI with context awareness.
 * 
 * Capabilities:
 * - Answer questions about summarized content
 * - Search through summaries and content
 * - Maintain conversation context
 * - Generate text and audio responses
 * - Provide source citations
 */

interface InteractionAgentRequest {
  action: 'ping' | 'ask' | 'search' | 'get_recent' | 'conversation_history';
  userId?: string;
  query?: string;
  responseType?: 'text' | 'audio';
  context?: ConversationContext;
  limit?: number;
}

// Initialize AI model for conversation
const llm = new ChatOpenAI({
  modelName: 'gpt-4o-mini',
  temperature: 0.7,
  openAIApiKey: process.env.OPENAI_API_KEY,
});

// Conversation prompt template
const conversationPrompt = PromptTemplate.fromTemplate(`
You are Novi, a friendly AI companion that helps users stay informed about their content sources.
You have access to summaries of YouTube videos, RSS articles, and newsletters that the user follows.

User Question: {query}

Relevant Summaries:
{summaries}

Previous Context: {context}

Please provide a helpful, conversational response based on the available information. If you reference specific content, mention the source. If you don't have enough information to answer the question, say so politely and suggest how the user might find the information.

Keep your response natural and friendly, as if you're a knowledgeable friend helping them stay up to date.
`);

export default async function Agent(
  req: AgentRequest,
  resp: AgentResponse,
  ctx: AgentContext
) {
  try {
    const request: InteractionAgentRequest = await req.json();
    
    console.log(`[Interaction Agent] Processing action: ${request.action}`);

    switch (request.action) {
      case 'ping':
        return resp.json({ success: true, agent: 'interaction-agent', timestamp: new Date().toISOString() });
      
      case 'ask':
        return await handleUserQuestion(resp, ctx, request);
      
      case 'search':
        return await handleSearch(resp, ctx, request);
      
      case 'get_recent':
        return await handleGetRecent(resp, ctx, request);
      
      case 'conversation_history':
        return await handleConversationHistory(resp, ctx, request);
      
      default:
        return resp.json({
          success: false,
          error: `Unknown action: ${request.action}`,
          timestamp: new Date().toISOString()
        });
    }
  } catch (error) {
    console.error('[Interaction Agent] Error:', error);
    return resp.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
}

async function handleUserQuestion(resp: AgentResponse, ctx: AgentContext, request: InteractionAgentRequest) {
  try {
    if (!request.query || !request.userId) {
      return resp.json({
        success: false,
        error: 'query and userId are required',
        timestamp: new Date().toISOString()
      });
    }

    // Search for relevant summaries
    const relevantSummaries = await searchSummaries(request.userId, request.query, 5);
    
    // Get recent conversation context
    const recentConversations = await db
      .select()
      .from(conversations)
      .where(eq(conversations.userId, request.userId))
      .orderBy(desc(conversations.createdAt))
      .limit(3);

    // Format summaries for the prompt
    const summariesText = relevantSummaries.map((summary, index) => 
      `${index + 1}. ${summary.contentTitle} (${summary.contentType})
      Summary: ${summary.summary}
      Key Points: ${summary.keyPoints?.join(', ') || 'None'}
      Topics: ${summary.topics?.join(', ') || 'None'}
      ---`
    ).join('\n');

    // Format previous context
    const contextText = recentConversations.map(conv => 
      `Q: ${conv.query}\nA: ${conv.response}`
    ).join('\n---\n');

    // Generate response using AI
    const prompt = await conversationPrompt.format({
      query: request.query,
      summaries: summariesText || 'No relevant summaries found.',
      context: contextText || 'No previous context.'
    });

    const aiResponse = await llm.invoke(prompt);
    const responseText = aiResponse.content as string;

    // Save conversation to database
    const conversationId = `conv_${generateId()}_${Date.now()}`;
    await db.insert(conversations).values({
      id: conversationId,
      userId: request.userId,
      query: request.query,
      response: responseText,
      context: {
        relatedSummaries: relevantSummaries.map(s => s.id),
        sources: relevantSummaries.map(s => s.contentTitle),
        confidence: calculateConfidence(relevantSummaries.length, request.query)
      },
      responseType: request.responseType || 'text',
      createdAt: new Date()
    });

    // TODO: Generate audio response if requested
    let audioUrl = undefined;
    if (request.responseType === 'audio') {
      // audioUrl = await generateAudioResponse(responseText);
    }

    return resp.json({
      success: true,
      data: {
        conversationId: conversationId,
        response: responseText,
        audioUrl: audioUrl,
        relatedSummaries: relevantSummaries.map(s => ({
          id: s.id,
          title: s.contentTitle,
          type: s.contentType,
          summary: s.summary.substring(0, 200) + '...'
        })),
        confidence: calculateConfidence(relevantSummaries.length, request.query)
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[Interaction Agent] Question handling error:', error);
    return resp.json({
      success: false,
      error: error instanceof Error ? error.message : 'Question handling failed',
      timestamp: new Date().toISOString()
    });
  }
}

async function handleSearch(resp: AgentResponse, ctx: AgentContext, request: InteractionAgentRequest) {
  try {
    if (!request.query || !request.userId) {
      return resp.json({
        success: false,
        error: 'query and userId are required for search',
        timestamp: new Date().toISOString()
      });
    }

    const results = await searchSummaries(request.userId, request.query, request.limit || 10);

    return resp.json({
      success: true,
      data: {
        query: request.query,
        results: results.map(summary => ({
          id: summary.id,
          title: summary.contentTitle,
          type: summary.contentType,
          summary: summary.summary,
          keyPoints: summary.keyPoints,
          topics: summary.topics,
          createdAt: summary.createdAt
        })),
        total: results.length
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[Interaction Agent] Search error:', error);
    return resp.json({
      success: false,
      error: error instanceof Error ? error.message : 'Search failed',
      timestamp: new Date().toISOString()
    });
  }
}

async function handleGetRecent(resp: AgentResponse, ctx: AgentContext, request: InteractionAgentRequest) {
  try {
    if (!request.userId) {
      return resp.json({
        success: false,
        error: 'userId is required',
        timestamp: new Date().toISOString()
      });
    }

    const recentSummaries = await db
      .select({
        id: summaries.id,
        summary: summaries.summary,
        keyPoints: summaries.keyPoints,
        topics: summaries.topics,
        sentiment: summaries.sentiment,
        createdAt: summaries.createdAt,
        contentTitle: contentItems.title,
        contentType: contentItems.type,
        contentUrl: contentItems.url
      })
      .from(summaries)
      .innerJoin(contentItems, eq(summaries.contentItemId, contentItems.id))
      .where(eq(summaries.userId, request.userId))
      .orderBy(desc(summaries.createdAt))
      .limit(request.limit || 20);

    return resp.json({
      success: true,
      data: {
        summaries: recentSummaries,
        total: recentSummaries.length
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[Interaction Agent] Get recent error:', error);
    return resp.json({
      success: false,
      error: error instanceof Error ? error.message : 'Get recent failed',
      timestamp: new Date().toISOString()
    });
  }
}

async function handleConversationHistory(resp: AgentResponse, ctx: AgentContext, request: InteractionAgentRequest) {
  try {
    if (!request.userId) {
      return resp.json({
        success: false,
        error: 'userId is required',
        timestamp: new Date().toISOString()
      });
    }

    const history = await db
      .select()
      .from(conversations)
      .where(eq(conversations.userId, request.userId))
      .orderBy(desc(conversations.createdAt))
      .limit(request.limit || 50);

    return resp.json({
      success: true,
      data: {
        conversations: history,
        total: history.length
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[Interaction Agent] Conversation history error:', error);
    return resp.json({
      success: false,
      error: error instanceof Error ? error.message : 'Conversation history failed',
      timestamp: new Date().toISOString()
    });
  }
}

// Helper functions
async function searchSummaries(userId: string, query: string, limit: number) {
  // Simple text search - in production, use vector search or full-text search
  const searchTerms = query.toLowerCase().split(' ').filter(term => term.length > 2);
  
  const results = await db
    .select({
      id: summaries.id,
      summary: summaries.summary,
      keyPoints: summaries.keyPoints,
      topics: summaries.topics,
      sentiment: summaries.sentiment,
      createdAt: summaries.createdAt,
      contentTitle: contentItems.title,
      contentType: contentItems.type,
      contentUrl: contentItems.url
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

  return results;
}

function calculateConfidence(resultsCount: number, query: string): number {
  // Simple confidence calculation based on results found and query complexity
  const baseConfidence = Math.min(resultsCount * 20, 80);
  const queryComplexity = query.split(' ').length;
  const complexityBonus = Math.min(queryComplexity * 2, 20);
  
  return Math.min(baseConfidence + complexityBonus, 95);
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}
