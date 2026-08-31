// Multiple planning sessions per account: list cloud sessions, switch
// the active one, archive the current, delete old ones. The active
// session still lives in usePlanningSession and syncs to its own row.

import type { WizardStep } from '../store/planningSession';
import { usePlanningSession } from '../store/planningSession';
import { getSupabase, isBackendConfigured } from '../supabase/client';
import type { FieldClock } from '../sync/fieldClock';
import { syncActiveSession } from '../sync/engine';

export interface SessionSummary {
  id: string;
  name: string;
  windowStart: string;
  windowEnd: string;
  started: boolean;
  updatedAt: string;
  isActive: boolean;
}

function requireBackend() {
  if (!isBackendConfigured()) {
    throw new Error('Planning-session management needs the cloud backend — sign in first.');
  }
  return getSupabase();
}

export async function listSessions(): Promise<SessionSummary[]> {
  const supabase = requireBackend();
  const { data, error } = await supabase
    .from('planning_sessions')
    .select('id, data, updated_at')
    .eq('deleted', false)
    .order('updated_at', { ascending: false });
  if (error) throw new Error(error.message);
  const activeId = usePlanningSession.getState().cloudId;
  return (data ?? []).map((row) => {
    const d = (row.data ?? {}) as Record<string, unknown>;
    return {
      id: row.id as string,
      name: (d.name as string) ?? '',
      windowStart: (d.windowStart as string) ?? '',
      windowEnd: (d.windowEnd as string) ?? '',
      started: Boolean(d.started),
      updatedAt: row.updated_at as string,
      isActive: row.id === activeId,
    };
  });
}

/** Save the current session to the cloud, then load another one. */
export async function switchToSession(id: string): Promise<void> {
  const supabase = requireBackend();
  await syncActiveSession();
  const { data, error } = await supabase
    .from('planning_sessions')
    .select('id, data, clock')
    .eq('id', id)
    .eq('deleted', false)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error('That session no longer exists.');
  const fields = (data.data ?? {}) as Record<string, unknown>;
  usePlanningSession.setState({
    ...(fields as object),
    step: (fields.step as WizardStep) ?? 'window',
    started: Boolean(fields.started),
    reviewEdits: (fields.reviewEdits as Record<string, never>) ?? {},
    reviewRemoved: (fields.reviewRemoved as string[]) ?? [],
    _clock: (data.clock as FieldClock) ?? {},
    cloudId: id,
  });
}

/** Save the current session to the cloud and begin a fresh one. */
export async function archiveAndStartNew(): Promise<void> {
  await syncActiveSession();
  usePlanningSession.getState().start();
}

export async function deleteSession(id: string): Promise<void> {
  const supabase = requireBackend();
  const { error } = await supabase
    .from('planning_sessions')
    .update({ deleted: true, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw new Error(error.message);
  const s = usePlanningSession.getState();
  if (s.cloudId === id) s.reset();
}
