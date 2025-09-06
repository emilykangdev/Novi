import { createClient, SupabaseClient } from '@supabase/supabase-js';

let _sb: SupabaseClient | null = null;

export function isSupabaseEnabled(): boolean {
  return !!process.env.SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY;
}

export function getSupabase(): SupabaseClient | null {
  if (!isSupabaseEnabled()) return null;
  if (_sb) return _sb;
  _sb = createClient(
    process.env.SUPABASE_URL as string,
    process.env.SUPABASE_SERVICE_ROLE_KEY as string,
    { auth: { persistSession: false } }
  );
  return _sb;
}

export async function upsertContentItemSB(item: {
  id: string;
  source_id: string;
  type: string;
  title: string;
  url?: string | null;
  content?: string | null;
  metadata?: any;
  published_at?: string | null;
  created_at?: string | null;
}) {
  const sb = getSupabase();
  if (!sb) return { error: 'supabase_disabled' } as const;
  const { error } = await sb.from('content_items').upsert([item], { onConflict: 'id' });
  return { error } as const;
}

export async function upsertSummarySB(summary: {
  id: string;
  content_item_id: string;
  user_id: string;
  summary: string;
  key_points?: string[] | null;
  sentiment?: string | null;
  topics?: string[] | null;
  ai_model?: string | null;
  confidence?: number | null;
  created_at?: string | null;
}) {
  const sb = getSupabase();
  if (!sb) return { error: 'supabase_disabled' } as const;
  const { error } = await sb.from('summaries').upsert([summary], { onConflict: 'id' });
  return { error } as const;
}

export async function upsertStorageLocationSB(loc: {
  id: string;
  summary_id: string;
  provider: string;
  external_id: string;
  url?: string | null;
  metadata?: any;
  created_at?: string | null;
}) {
  const sb = getSupabase();
  if (!sb) return { error: 'supabase_disabled' } as const;
  const { error } = await sb.from('storage_locations').upsert([loc], { onConflict: 'id' });
  return { error } as const;
}
