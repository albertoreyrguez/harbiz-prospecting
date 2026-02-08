import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { getUserWorkspaceId } from '@/lib/workspace';

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export async function POST(request: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const payload = (await request.json()) as {
    query?: string;
    country?: string;
    count?: number;
  };

  if (!payload.query) return NextResponse.json({ error: 'query is required' }, { status: 400 });

  const count = Number.isFinite(payload.count) ? Math.min(Math.max(Number(payload.count), 1), 50) : 10;

  const admin = createAdminClient();
  const workspaceId = await getUserWorkspaceId(admin, user.id);

  const { data: run, error: runError } = await admin
    .from('search_runs')
    .insert({
      workspace_id: workspaceId,
      owner_id: user.id,
      query: payload.query,
      filters: { country: payload.country ?? null, source: 'mock-seed' },
      results_count: count
    })
    .select('id')
    .single();

  if (runError || !run) {
    return NextResponse.json({ error: runError?.message ?? 'Failed to create search run' }, { status: 400 });
  }

  const querySlug = slugify(payload.query).slice(0, 10) || 'prospect';
  const nowSuffix = Date.now().toString().slice(-6);

  const mockProfiles = Array.from({ length: count }).map((_, index) => {
    const handle = `${querySlug}_${nowSuffix}_${index + 1}`;

    return {
      instagram_handle: handle,
      full_name: `Mock Prospect ${index + 1}`,
      business_type: index % 2 === 0 ? 'Gym' : 'Personal Trainer',
      city: index % 3 === 0 ? 'Madrid' : 'Mexico City',
      country: payload.country ?? (index % 2 === 0 ? 'Spain' : 'Mexico'),
      source_payload: {
        mocked: true,
        search_run_id: run.id,
        query: payload.query
      }
    };
  });

  const { data: profiles, error: profilesError } = await admin
    .from('profiles')
    .upsert(mockProfiles, { onConflict: 'instagram_handle' })
    .select('id,instagram_handle');

  if (profilesError || !profiles) {
    return NextResponse.json({ error: profilesError?.message ?? 'Failed to insert profiles' }, { status: 400 });
  }

  const leadRows = profiles.map((profile) => ({
    workspace_id: workspaceId,
    profile_id: profile.id,
    owner_id: user.id,
    status: 'new' as const,
    notes: null,
    source_query: payload.query,
    confidence: 50,
    discovered_at: new Date().toISOString()
  }));

  const { data: leads, error: leadsError } = await admin
    .from('leads')
    .upsert(leadRows, { onConflict: 'workspace_id,profile_id', ignoreDuplicates: true })
    .select('id');

  if (leadsError) {
    return NextResponse.json({ error: leadsError.message }, { status: 400 });
  }

  return NextResponse.json({
    runId: run.id,
    insertedProfiles: profiles.length,
    insertedLeads: leads?.length ?? 0
  });
}
