import { Composio } from '@composio/core';
import { LangChainProvider } from '@composio/langchain';

let _client: Composio | null = null;

export function isComposioEnabled(): boolean {
  return !!process.env.COMPOSIO_API_KEY;
}

export function getComposio(): Composio | null {
  if (!isComposioEnabled()) return null;
  if (_client) return _client;
  _client = new Composio({
    apiKey: process.env.COMPOSIO_API_KEY as string,
    provider: new LangChainProvider(),
  });
  return _client;
}

export const TOOLKITS_BY_AGENT: Record<string, string[]> = {
  'youtube-agent': ['youtube', 'youtube_data', 'youtube_transcript'],
  'rss-agent': ['web', 'scraper', 'firecrawl', 'serpapi'],
  'newsletter-agent': ['gmail'],
  'interaction-agent': ['notion', 'google_docs', 'google_drive'],
  orchestrator: [],
};

export async function getToolsForAgent(
  userId: string,
  agentId: keyof typeof TOOLKITS_BY_AGENT
): Promise<any[]> {
  const client = getComposio();
  if (!client) return [];
  const toolkits = TOOLKITS_BY_AGENT[agentId] || [];
  if (toolkits.length === 0) return [];
  try {
    const tools = await client.tools.get(userId, { toolkits, limit: 50 });
    return tools || [];
  } catch (err) {
    console.error('[Composio] Failed to fetch tools:', err);
    return [];
  }
}
