import type { AgentContext, AgentRequest, AgentResponse } from '@agentuity/sdk';
import { db } from '../../database/connection';
import { contentSources, contentItems, summaries } from '../../database/schema';
import { eq, desc, and } from 'drizzle-orm';
import { ChatOpenAI } from '@langchain/openai';
import { PromptTemplate } from '@langchain/core/prompts';
import type { YouTubeVideo, SummarizationRequest } from '../../shared/types';
import { getToolsForAgent, isComposioEnabled } from '../../integrations/composio';
import { isSupabaseEnabled, upsertContentItemSB, upsertSummarySB } from '../../database/supabase';

/**
 * YouTube Summarization Agent
 * 
 * Monitors YouTube channels and creates video summaries.
 * Integrates with YouTube API and transcript services.
 * 
 * Capabilities:
 * - Monitor YouTube channels for new videos
 * - Extract video transcripts
 * - Generate AI summaries with key points
 * - Store summaries in database and external storage
 */

interface YouTubeAgentRequest {
  action: 'ping' | 'monitor' | 'summarize' | 'get_transcript' | 'add_source' | 'list_sources' | 'remove_source' | 'validate_channel';
  sourceId?: string;
  contentItemId?: string;
  userId?: string;
  videoId?: string;
  channelUrl?: string;
  playlistUrl?: string;
  name?: string;
  force?: boolean;
}

// Initialize AI model for summarization
const llm = new ChatOpenAI({
  modelName: 'gpt-4o-mini',
  temperature: 0.3,
  openAIApiKey: process.env.OPENAI_API_KEY,
});

// Summarization prompt template
const summaryPrompt = PromptTemplate.fromTemplate(`
You are an expert content summarizer. Create a comprehensive summary of this YouTube video.

Video Title: {title}
Channel: {channel}
Duration: {duration}
Transcript: {transcript}

Please provide:
1. A concise summary (2-3 paragraphs)
2. Key points (3-5 bullet points)
3. Main topics/themes
4. Overall sentiment (positive/negative/neutral)

Format your response as JSON:
{{
  "summary": "Your summary here...",
  "keyPoints": ["Point 1", "Point 2", "Point 3"],
  "topics": ["Topic 1", "Topic 2"],
  "sentiment": "positive|negative|neutral",
  "confidence": 85
}}
`);

export default async function Agent(
  req: AgentRequest,
  resp: AgentResponse,
  ctx: AgentContext
) {
  try {
    const request: YouTubeAgentRequest = await req.json();
    
    console.log(`[YouTube Agent] Processing action: ${request.action}`);

    switch (request.action) {
      case 'ping':
        return resp.json({ success: true, agent: 'youtube-agent', timestamp: new Date().toISOString() });
      case 'monitor':
        return await handleMonitoring(resp, ctx, request);
      case 'summarize':
        return await handleSummarization(resp, ctx, request);
      case 'get_transcript':
        return await handleTranscriptExtraction(resp, ctx, request);
      case 'add_source':
        return await handleAddSource(resp, ctx, request);
      case 'list_sources':
        return await handleListSources(resp, ctx, request);
      case 'remove_source':
        return await handleRemoveSource(resp, ctx, request);
      case 'validate_channel':
        return await handleValidateChannel(resp, ctx, request);
      default:
        return resp.json({
          success: false,
          error: `Unknown action: ${request.action}`,
          timestamp: new Date().toISOString()
        });
    }
  } catch (error) {
    console.error('[YouTube Agent] Error:', error);
    return resp.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
}

async function handleMonitoring(resp: AgentResponse, ctx: AgentContext, request: YouTubeAgentRequest) {
  try {
    if (!request.sourceId) {
      return resp.json({
        success: false,
        error: 'sourceId is required for monitoring',
        timestamp: new Date().toISOString()
      });
    }

    // Get the YouTube channel source
    const source = await db
      .select()
      .from(contentSources)
      .where(and(
        eq(contentSources.id, request.sourceId),
        eq(contentSources.type, 'youtube')
      ))
      .limit(1);

    if (source.length === 0) {
      return resp.json({
        success: false,
        error: 'YouTube source not found',
        timestamp: new Date().toISOString()
      });
    }

    const channelSource = source[0];
    const channelId = channelSource.metadata?.channelId || extractChannelIdFromUrl(channelSource.url);

    const composioTools = isComposioEnabled() ? await getToolsForAgent(channelSource.userId, 'youtube-agent') : [];

    if (!channelId) {
      return resp.json({
        success: false,
        error: 'Could not extract channel ID from source',
        timestamp: new Date().toISOString()
      });
    }

    // Get recent videos from YouTube API
    const videos = await fetchRecentVideos(channelId);
    let newItems = 0;

    for (const video of videos) {
      // Check if we already have this video
      const existing = await db
        .select()
        .from(contentItems)
        .where(and(
          eq(contentItems.sourceId, request.sourceId),
          eq(contentItems.url, `https://www.youtube.com/watch?v=${video.id}`)
        ))
        .limit(1);

      if (existing.length === 0) {
        // Create new content item
        const newId = `video_${video.id}_${Date.now()}`;
        await db.insert(contentItems).values({
          id: newId,
          sourceId: request.sourceId,
          type: 'video',
          title: video.title,
          url: `https://www.youtube.com/watch?v=${video.id}`,
          content: video.transcript || '',
          metadata: {
            author: video.channelTitle,
            publishedAt: video.publishedAt,
            duration: parseDuration(video.duration),
            thumbnailUrl: video.thumbnails.high.url,
            tags: []
          },
          publishedAt: new Date(video.publishedAt),
          createdAt: new Date()
        });
        if (isSupabaseEnabled()) {
          await upsertContentItemSB({
            id: newId,
            source_id: request.sourceId,
            type: 'video',
            title: video.title,
            url: `https://www.youtube.com/watch?v=${video.id}`,
            content: video.transcript || '',
            metadata: {
              author: video.channelTitle,
              publishedAt: video.publishedAt,
              duration: parseDuration(video.duration),
              thumbnailUrl: video.thumbnails.high.url,
              tags: []
            },
            published_at: new Date(video.publishedAt).toISOString(),
            created_at: new Date().toISOString()
          });
        }

        newItems++;
        console.log(`[YouTube Agent] Added new video: ${video.title}`);
      }
    }

    // Update source metadata
    await db
      .update(contentSources)
      .set({
        metadata: {
          ...channelSource.metadata,
          lastChecked: new Date().toISOString()
        },
        updatedAt: new Date()
      })
      .where(eq(contentSources.id, request.sourceId));

    return resp.json({
      success: true,
      data: {
        sourceId: request.sourceId,
        videosChecked: videos.length,
        newItems: newItems,
        composio: { enabled: isComposioEnabled(), toolsAvailable: composioTools.length }
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[YouTube Agent] Monitoring error:', error);
    return resp.json({
      success: false,
      error: error instanceof Error ? error.message : 'Monitoring failed',
      timestamp: new Date().toISOString()
    });
  }
}

async function handleSummarization(resp: AgentResponse, ctx: AgentContext, request: YouTubeAgentRequest) {
  try {
    if (!request.contentItemId || !request.userId) {
      return resp.json({
        success: false,
        error: 'contentItemId and userId are required for summarization',
        timestamp: new Date().toISOString()
      });
    }

    // Get the content item
    const contentItem = await db
      .select()
      .from(contentItems)
      .where(eq(contentItems.id, request.contentItemId))
      .limit(1);

    if (contentItem.length === 0) {
      return resp.json({
        success: false,
        error: 'Content item not found',
        timestamp: new Date().toISOString()
      });
    }

    const item = contentItem[0];
    
    // Get transcript if not available
    let transcript = item.content;
    if (!transcript && item.url) {
      const videoId = extractVideoIdFromUrl(item.url);
      if (videoId) {
        transcript = await getVideoTranscript(videoId, request.userId);
      }
    }

    if (!transcript) {
      return resp.json({
        success: false,
        error: 'No transcript available for this video',
        timestamp: new Date().toISOString()
      });
    }

    // Generate summary using AI
    const prompt = await summaryPrompt.format({
      title: item.title,
      channel: item.metadata?.author || 'Unknown',
      duration: formatDuration(item.metadata?.duration || 0),
      transcript: transcript.slice(0, 8000) // Limit transcript length
    });

    const response = await llm.invoke(prompt);
    const summaryData = JSON.parse(response.content as string);

    // Save summary to database
    const summaryId = `summary_${item.id}_${Date.now()}`;
    await db.insert(summaries).values({
      id: summaryId,
      contentItemId: request.contentItemId,
      userId: request.userId,
      summary: summaryData.summary,
      keyPoints: summaryData.keyPoints,
      sentiment: summaryData.sentiment,
      topics: summaryData.topics,
      aiModel: 'gpt-4o-mini',
      confidence: summaryData.confidence,
      createdAt: new Date()
    });

    if (isSupabaseEnabled()) {
      await upsertSummarySB({
        id: summaryId,
        content_item_id: request.contentItemId,
        user_id: request.userId,
        summary: summaryData.summary,
        key_points: summaryData.keyPoints ?? null,
        sentiment: summaryData.sentiment ?? null,
        topics: summaryData.topics ?? null,
        ai_model: 'gpt-4o-mini',
        confidence: summaryData.confidence ?? null,
        created_at: new Date().toISOString()
      });
    }

    // TODO: Store in external storage (Notion/Google Docs)
    // This will be handled by the storage integration

    return resp.json({
      success: true,
      data: {
        summaryId: summaryId,
        summary: summaryData.summary,
        keyPoints: summaryData.keyPoints,
        topics: summaryData.topics,
        sentiment: summaryData.sentiment,
        confidence: summaryData.confidence
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[YouTube Agent] Summarization error:', error);
    return resp.json({
      success: false,
      error: error instanceof Error ? error.message : 'Summarization failed',
      timestamp: new Date().toISOString()
    });
  }
}

async function handleTranscriptExtraction(resp: AgentResponse, ctx: AgentContext, request: YouTubeAgentRequest) {
  try {
    if (!request.videoId) {
      return resp.json({
        success: false,
        error: 'videoId is required for transcript extraction',
        timestamp: new Date().toISOString()
      });
    }

    const transcript = await getVideoTranscript(request.videoId, request.userId);
    
    return resp.json({
      success: true,
      data: { transcript },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[YouTube Agent] Transcript extraction error:', error);
    return resp.json({
      success: false,
      error: error instanceof Error ? error.message : 'Transcript extraction failed',
      timestamp: new Date().toISOString()
    });
  }
}

async function handleAddSource(resp: AgentResponse, ctx: AgentContext, request: YouTubeAgentRequest) {
  try {
    if (!request.userId || (!request.channelUrl && !request.playlistUrl)) {
      return resp.json({ success: false, error: 'userId and channelUrl or playlistUrl are required', timestamp: new Date().toISOString() });
    }

    const url = request.channelUrl || request.playlistUrl!;
    const channelId = extractChannelIdFromUrl(url);
    const name = request.name || url;

    const sourceId = `source_yt_${generateId()}_${Date.now()}`;
    await db.insert(contentSources).values({
      id: sourceId,
      userId: request.userId,
      type: 'youtube',
      name,
      url,
      metadata: { channelId: channelId || undefined, isActive: true, lastChecked: null as any },
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    return resp.json({ success: true, data: { sourceId, channelId }, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('[YouTube Agent] Add source error:', error);
    return resp.json({ success: false, error: error instanceof Error ? error.message : 'Add source failed', timestamp: new Date().toISOString() });
  }
}

async function handleListSources(resp: AgentResponse, ctx: AgentContext, request: YouTubeAgentRequest) {
  try {
    if (!request.userId) {
      return resp.json({ success: false, error: 'userId is required', timestamp: new Date().toISOString() });
    }

    const sources = await db
      .select()
      .from(contentSources)
      .where(and(eq(contentSources.userId, request.userId), eq(contentSources.type, 'youtube')));

    return resp.json({ success: true, data: { sources }, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('[YouTube Agent] List sources error:', error);
    return resp.json({ success: false, error: error instanceof Error ? error.message : 'List sources failed', timestamp: new Date().toISOString() });
  }
}

async function handleRemoveSource(resp: AgentResponse, ctx: AgentContext, request: YouTubeAgentRequest) {
  try {
    if (!request.sourceId) {
      return resp.json({ success: false, error: 'sourceId is required', timestamp: new Date().toISOString() });
    }

    await db.delete(contentSources).where(eq(contentSources.id, request.sourceId));
    return resp.json({ success: true, data: { removed: true }, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('[YouTube Agent] Remove source error:', error);
    return resp.json({ success: false, error: error instanceof Error ? error.message : 'Remove source failed', timestamp: new Date().toISOString() });
  }
}

async function handleValidateChannel(resp: AgentResponse, ctx: AgentContext, request: YouTubeAgentRequest) {
  try {
    if (!request.channelUrl) {
      return resp.json({ success: false, error: 'channelUrl is required', timestamp: new Date().toISOString() });
    }
    const channelId = extractChannelIdFromUrl(request.channelUrl);
    return resp.json({ success: true, data: { valid: !!channelId, channelId }, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('[YouTube Agent] Validate channel error:', error);
    return resp.json({ success: false, error: error instanceof Error ? error.message : 'Validate channel failed', timestamp: new Date().toISOString() });
  }
}

// Helper functions
function extractChannelIdFromUrl(url: string): string | null {
  const patterns = [
    /youtube\.com\/channel\/([a-zA-Z0-9_-]+)/,
    /youtube\.com\/c\/([a-zA-Z0-9_-]+)/,
    /youtube\.com\/user\/([a-zA-Z0-9_-]+)/,
    /youtube\.com\/@([a-zA-Z0-9_-]+)/
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  
  return null;
}

function extractVideoIdFromUrl(url: string): string | null {
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
}

async function fetchRecentVideos(channelId: string): Promise<YouTubeVideo[]> {
  // TODO: Implement YouTube API integration
  // For now, return mock data
  console.log(`[YouTube Agent] Fetching videos for channel: ${channelId}`);
  return [];
}

async function getVideoTranscript(videoId: string, userId?: string): Promise<string> {
  try {
    if (isComposioEnabled() && userId) {
      const tools: any[] = await getToolsForAgent(userId, 'youtube-agent');
      const transcriptTool = tools.find(t =>
        typeof t?.name === 'string' && t.name.toLowerCase().includes('transcript')
      );
      if (transcriptTool && typeof (transcriptTool as any).execute === 'function') {
        const result: any = await (transcriptTool as any).execute({ video_id: videoId, videoId });
        if (result) {
          if (typeof result === 'string') return result as string;
          if (result.transcript) return result.transcript as string;
        }
      }
    }
  } catch (err) {
    console.error('[YouTube Agent] Composio transcript fetch failed:', err);
  }
  console.log(`[YouTube Agent] Getting transcript for video: ${videoId}`);
  return '';
}

function parseDuration(duration: string): number {
  // Parse YouTube duration format (PT4M13S) to seconds
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  
  const hours = parseInt(match[1] || '0');
  const minutes = parseInt(match[2] || '0');
  const seconds = parseInt(match[3] || '0');
  
  return hours * 3600 + minutes * 60 + seconds;
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}
