import type { AgentContext, AgentRequest, AgentResponse } from '@agentuity/sdk';
import { db, checkDatabaseConnection } from '../../database/connection';
import { contentSources, contentItems, summaries } from '../../database/schema';
import { eq, and, desc } from 'drizzle-orm';
import type { SummarizationRequest, AgentTask } from '../../shared/types';

/**
 * Content Orchestrator Agent
 * 
 * This is the main orchestrator that coordinates all content summarization agents.
 * It runs 24/7 and manages the workflow of content monitoring, summarization, and storage.
 * 
 * Responsibilities:
 * - Monitor content sources for new items
 * - Coordinate with specialized agents (YouTube, RSS, Newsletter)
 * - Manage task queues and priorities
 * - Handle error recovery and retries
 * - Provide status updates and health checks
 */

interface OrchestratorRequest {
  action: 'monitor' | 'summarize' | 'status' | 'health';
  payload?: {
    userId?: string;
    sourceId?: string;
    contentItemId?: string;
    force?: boolean;
  };
}

export default async function Agent(
  req: AgentRequest,
  resp: AgentResponse,
  ctx: AgentContext
) {
  try {
    // Parse the request
    const request: OrchestratorRequest = await req.json();
    
    console.log(`[Orchestrator] Processing action: ${request.action}`);

    switch (request.action) {
      case 'health':
        return await handleHealthCheck(resp, ctx);
      
      case 'status':
        return await handleStatusCheck(resp, ctx, request.payload?.userId);
      
      case 'monitor':
        return await handleMonitoring(resp, ctx, request.payload);
      
      case 'summarize':
        return await handleSummarization(resp, ctx, request.payload);
      
      default:
        return resp.json({
          success: false,
          error: `Unknown action: ${request.action}`,
          timestamp: new Date().toISOString()
        });
    }
  } catch (error) {
    console.error('[Orchestrator] Error:', error);
    return resp.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
}

async function handleHealthCheck(resp: AgentResponse, ctx: AgentContext) {
  const dbHealthy = await checkDatabaseConnection();
  
  // Check if other agents are responsive
  const agentHealth = await checkAgentHealth(ctx);
  
  const health = {
    status: dbHealthy && agentHealth.allHealthy ? 'healthy' : 'unhealthy',
    database: dbHealthy ? 'connected' : 'disconnected',
    agents: agentHealth,
    timestamp: new Date().toISOString()
  };
  
  return resp.json({
    success: true,
    data: health,
    timestamp: new Date().toISOString()
  });
}

async function checkAgentHealth(ctx: AgentContext) {
  const agents = ['youtube-agent', 'rss-agent', 'newsletter-agent', 'interaction-agent'];
  const results: Record<string, boolean> = {};
  
  for (const agentName of agents) {
    try {
      const agent = await ctx.getAgent({ name: agentName });
      const response = await agent.run({ action: 'ping' });
      const data = await response.data.json();
      results[agentName] = data.success === true;
    } catch (error) {
      console.error(`[Orchestrator] Agent ${agentName} health check failed:`, error);
      results[agentName] = false;
    }
  }
  
  return {
    ...results,
    allHealthy: Object.values(results).every(healthy => healthy)
  };
}

async function handleStatusCheck(resp: AgentResponse, ctx: AgentContext, userId?: string) {
  try {
    // Get recent summaries and activity
    const recentSummaries = await db
      .select()
      .from(summaries)
      .where(userId ? eq(summaries.userId, userId) : undefined)
      .orderBy(desc(summaries.createdAt))
      .limit(10);
    
    // Get active content sources
    const activeSources = await db
      .select()
      .from(contentSources)
      .where(
        and(
          userId ? eq(contentSources.userId, userId) : undefined,
          eq(contentSources.isActive, true)
        )
      );
    
    const status = {
      recentSummaries: recentSummaries.length,
      activeSources: activeSources.length,
      lastActivity: recentSummaries[0]?.createdAt || null,
      sources: activeSources.map(source => ({
        id: source.id,
        name: source.name,
        type: source.type,
        lastChecked: source.metadata?.lastChecked || null
      }))
    };
    
    return resp.json({
      success: true,
      data: status,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Orchestrator] Status check error:', error);
    return resp.json({
      success: false,
      error: error instanceof Error ? error.message : 'Status check failed',
      timestamp: new Date().toISOString()
    });
  }
}

async function handleMonitoring(resp: AgentResponse, ctx: AgentContext, payload?: any) {
  try {
    console.log('[Orchestrator] Starting content monitoring cycle');
    
    // Get all active content sources
    const sources = await db
      .select()
      .from(contentSources)
      .where(eq(contentSources.isActive, true));
    
    const results = [];
    
    // Process each source type with appropriate agent
    for (const source of sources) {
      try {
        let agentName: string;
        
        switch (source.type) {
          case 'youtube':
            agentName = 'youtube-agent';
            break;
          case 'rss':
            agentName = 'rss-agent';
            break;
          case 'newsletter':
            agentName = 'newsletter-agent';
            break;
          default:
            console.warn(`[Orchestrator] Unknown source type: ${source.type}`);
            continue;
        }
        
        // Delegate to specialized agent
        const agent = await ctx.getAgent({ name: agentName });
        const response = await agent.run({
          action: 'monitor',
          sourceId: source.id,
          force: payload?.force || false
        });
        
        const result = await response.data.json();
        results.push({
          sourceId: source.id,
          sourceName: source.name,
          type: source.type,
          success: result.success,
          newItems: result.data?.newItems || 0,
          error: result.error
        });
        
      } catch (error) {
        console.error(`[Orchestrator] Error monitoring source ${source.id}:`, error);
        results.push({
          sourceId: source.id,
          sourceName: source.name,
          type: source.type,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
    
    return resp.json({
      success: true,
      data: {
        sourcesProcessed: sources.length,
        results: results,
        summary: {
          successful: results.filter(r => r.success).length,
          failed: results.filter(r => !r.success).length,
          totalNewItems: results.reduce((sum, r) => sum + (r.newItems || 0), 0)
        }
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('[Orchestrator] Monitoring error:', error);
    return resp.json({
      success: false,
      error: error instanceof Error ? error.message : 'Monitoring failed',
      timestamp: new Date().toISOString()
    });
  }
}

async function handleSummarization(resp: AgentResponse, ctx: AgentContext, payload?: any) {
  try {
    if (!payload?.contentItemId) {
      return resp.json({
        success: false,
        error: 'contentItemId is required for summarization',
        timestamp: new Date().toISOString()
      });
    }
    
    // Get the content item
    const contentItem = await db
      .select()
      .from(contentItems)
      .where(eq(contentItems.id, payload.contentItemId))
      .limit(1);
    
    if (contentItem.length === 0) {
      return resp.json({
        success: false,
        error: 'Content item not found',
        timestamp: new Date().toISOString()
      });
    }
    
    // Determine which agent to use based on content type
    let agentName: string;
    switch (contentItem[0].type) {
      case 'video':
        agentName = 'youtube-agent';
        break;
      case 'article':
        agentName = 'rss-agent';
        break;
      case 'newsletter':
        agentName = 'newsletter-agent';
        break;
      default:
        return resp.json({
          success: false,
          error: `Unknown content type: ${contentItem[0].type}`,
          timestamp: new Date().toISOString()
        });
    }
    
    // Delegate to specialized agent
    const agent = await ctx.getAgent({ name: agentName });
    const response = await agent.run({
      action: 'summarize',
      contentItemId: payload.contentItemId,
      userId: payload.userId
    });
    
    const result = await response.data.json();
    
    return resp.json({
      success: result.success,
      data: result.data,
      error: result.error,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('[Orchestrator] Summarization error:', error);
    return resp.json({
      success: false,
      error: error instanceof Error ? error.message : 'Summarization failed',
      timestamp: new Date().toISOString()
    });
  }
}
