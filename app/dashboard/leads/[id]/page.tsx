'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { LEAD_STATUSES, LeadStatus } from '@/lib/constants';
import { LeadStatusBadge } from '@/components/lead-status-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';

type LeadDetails = {
  id: string;
  status: LeadStatus;
  notes: string | null;
  source_query: string | null;
  confidence: number | null;
  discovered_at: string;
  created_at: string;
  updated_at: string;
  profiles: {
    instagram_handle: string;
    full_name: string | null;
    business_type: string | null;
    city: string | null;
    country: string | null;
  };
};

export default function LeadDetailPage() {
  const params = useParams<{ id: string }>();
  const leadId = params.id;

  const [lead, setLead] = useState<LeadDetails | null>(null);
  const [status, setStatus] = useState<LeadStatus>('new');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/leads/${leadId}`);
      const payload = (await response.json()) as { lead?: LeadDetails; error?: string };

      if (!response.ok) {
        if (!cancelled) {
          setError(payload.error ?? 'Unable to load lead');
          setLoading(false);
        }
        return;
      }

      if (!cancelled && payload.lead) {
        setLead(payload.lead);
        setStatus(payload.lead.status);
        setNotes(payload.lead.notes ?? '');
        setLoading(false);
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [leadId]);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setSaved(false);
    setError(null);

    const response = await fetch(`/api/leads/${leadId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, notes })
    });

    const payload = (await response.json()) as { lead?: LeadDetails; error?: string };

    if (!response.ok) {
      setError(payload.error ?? 'Unable to update lead');
      setSaving(false);
      return;
    }

    if (payload.lead) {
      setLead(payload.lead);
      setSaved(true);
    }

    setSaving(false);
  };

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-36 w-full" />
        <Skeleton className="h-60 w-full" />
      </div>
    );
  }

  if (error || !lead) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-rose-600">{error ?? 'Lead not found'}</p>
        <Link href="/dashboard/leads" className="text-sm text-blue-700">
          Back to leads
        </Link>
      </div>
    );
  }

  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <Link href="/dashboard/leads" className="text-sm text-blue-700">
          Back to leads
        </Link>
        <h1 className="text-2xl font-semibold">{lead.profiles.full_name ?? lead.profiles.instagram_handle}</h1>
        <p className="text-sm text-slate-500">@{lead.profiles.instagram_handle}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lead overview</CardTitle>
          <CardDescription>Current qualification context and discovery metadata.</CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 text-sm md:grid-cols-2">
            <div>
              <dt className="text-slate-500">Business type</dt>
              <dd>{lead.profiles.business_type ?? '-'}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Location</dt>
              <dd>{[lead.profiles.city, lead.profiles.country].filter(Boolean).join(', ') || '-'}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Discovered</dt>
              <dd>{new Date(lead.discovered_at).toLocaleString()}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Current status</dt>
              <dd>
                <LeadStatusBadge status={lead.status} />
              </dd>
            </div>
            <div className="md:col-span-2">
              <dt className="text-slate-500">Source query</dt>
              <dd className="break-all">{lead.source_query ?? '-'}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Update lead</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={onSubmit}>
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select id="status" value={status} onChange={(event) => setStatus(event.target.value as LeadStatus)}>
                {LEAD_STATUSES.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                rows={8}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Write outreach notes, objections, and next steps"
              />
            </div>

            {error ? <p className="text-sm text-rose-600">{error}</p> : null}
            {saved ? <p className="text-sm text-emerald-700">Lead updated successfully.</p> : null}

            <Button type="submit" disabled={saving}>
              {saving ? 'Saving...' : 'Save changes'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </section>
  );
}
