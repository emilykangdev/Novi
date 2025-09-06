import type { AgentContext, AgentRequest, AgentResponse } from '@agentuity/sdk';
import { db } from '../../database/connection';
import { contentSources, contentItems, summaries } from '../../database/schema';
import { eq, desc, and } from 'drizzle-orm';
import { ChatOpenAI } from '@langchain/openai';
import { PromptTemplate } from '@langchain/core/prompts';
import type { YouTubeVideo, SummarizationRequest } from '../../shared/types';

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
  action: 'ping' | 'monitor' | 'summarize' | 'get_transcript';
  sourceId?: string;
  contentItemId?: string;
  userId?: string;
  videoId?: string;
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
        await db.insert(contentItems).values({
          id: `video_${video.id}_${Date.now()}`,
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
        newItems: newItems
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
        transcript = await getVideoTranscript(videoId);
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

    const transcript = await getVideoTranscript(request.videoId);
    
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

async function getVideoTranscript(videoId: string): Promise<string> {
  // TODO: Implement transcript extraction using youtube-transcript or similar
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
