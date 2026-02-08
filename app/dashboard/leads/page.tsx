'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { LEAD_STATUSES, LeadStatus } from '@/lib/constants';
import { LeadStatusBadge } from '@/components/lead-status-badge';

type LeadRow = {
  id: string;
  owner_id?: string | null;
  owner_label?: string | null; // ✅ NUEVO
  status: LeadStatus;
  notes: string | null;
  source_query: string | null;
  confidence: number | null;
  discovered_at: string;
  created_at: string;
  profiles: {
    id: string;
    instagram_handle: string;
    full_name: string | null;
    business_type: string | null;
    city: string | null;
    country: string | null;
  } | null;
};

function uniqSorted(values: string[]) {
  return Array.from(new Set(values.map((v) => v.trim()).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b)
  );
}

export default function LeadsPage() {
  const [status, setStatus] = useState<'all' | LeadStatus>('all');
  const [search, setSearch] = useState('');

  const [country, setCountry] = useState('all');
  const [city, setCity] = useState('all');
  const [ownerId, setOwnerId] = useState('all');

  const [rows, setRows] = useState<LeadRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const countryOptions = useMemo(() => {
    const list = rows.map((r) => r.profiles?.country).filter(Boolean) as string[];
    return uniqSorted(list);
  }, [rows]);

  const cityOptions = useMemo(() => {
    const base = rows.filter((r) => {
      if (country === 'all') return true;
      return (r.profiles?.country ?? '') === country;
    });
    const list = base.map((r) => r.profiles?.city).filter(Boolean) as string[];
    return uniqSorted(list);
  }, [rows, country]);

  // ✅ owner options con label humano, pero manteniendo ownerId como value
  const ownerOptions = useMemo(() => {
    const pairs = rows
      .map((r) => ({
        id: r.owner_id ?? '',
        label: r.owner_label ?? r.owner_id ?? ''
      }))
      .filter((x) => x.id && x.label);

    // dedupe por id
    const map = new Map<string, string>();
    for (const p of pairs) {
      if (!map.has(p.id)) map.set(p.id, p.label);
    }

    const list = Array.from(map.entries())
      .map(([id, label]) => ({ id, label }))
      .sort((a, b) => a.label.localeCompare(b.label));

    return list;
  }, [rows]);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();

    if (status !== 'all') params.set('status', status);
    if (search.trim()) params.set('search', search.trim());

    if (country !== 'all') params.set('country', country);
    if (city !== 'all') params.set('city', city);
    if (ownerId !== 'all') params.set('ownerId', ownerId);

    const qs = params.toString();
    return qs ? `?${qs}` : '';
  }, [status, search, country, city, ownerId]);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/leads${queryString}`);
      const payload = (await response.json()) as { leads?: LeadRow[]; error?: string };

      if (!response.ok) {
        if (!cancelled) {
          setError(payload.error ?? 'Unable to load leads');
          setLoading(false);
        }
        return;
      }

      if (!cancelled) {
        setRows(payload.leads ?? []);
        setLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [queryString]);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Leads</h1>
          <p className="text-sm text-slate-500">Workspace-scoped leads and qualification workflow.</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Input
              placeholder="Search by handle or name"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />

            <Select value={status} onChange={(event) => setStatus(event.target.value as 'all' | LeadStatus)}>
              <option value="all">All statuses</option>
              {LEAD_STATUSES.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </Select>

            <Select
              value={country}
              onChange={(event) => {
                setCountry(event.target.value);
                setCity('all');
              }}
            >
              <option value="all">All countries</option>
              {countryOptions.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>

            <Select value={city} onChange={(event) => setCity(event.target.value)}>
              <option value="all">All cities</option>
              {cityOptions.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>

            <Select value={ownerId} onChange={(event) => setOwnerId(event.target.value)} className="lg:col-span-2">
              <option value="all">All SDRs</option>
              {ownerOptions.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </Select>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <Card>
          <CardContent className="space-y-2 pt-6">
            {Array.from({ length: 8 }).map((_, index) => (
              <Skeleton key={index} className="h-10 w-full" />
            ))}
          </CardContent>
        </Card>
      ) : null}

      {error ? <p className="text-sm text-rose-600">{error}</p> : null}

      {!loading && !error ? (
        <Card>
          <CardContent className="pt-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Profile</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>SDR</TableHead>
                  <TableHead>Confidence</TableHead>
                  <TableHead>Discovered</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((lead) => {
                  const handle = lead.profiles?.instagram_handle ?? '';
                  const clean = handle.replace(/^@/, '');

                  return (
                    <TableRow key={lead.id}>
                      <TableCell>
                        <Link href={`/dashboard/leads/${lead.id}`} className="font-medium text-blue-700 hover:text-blue-600">
                          {lead.profiles?.full_name ?? lead.profiles?.instagram_handle ?? '—'}
                        </Link>

                        {clean ? (
                          <p className="text-xs text-slate-500">
                            <a
                              href={`https://www.instagram.com/${clean}/`}
                              target="_blank"
                              rel="noreferrer"
                              className="hover:underline"
                            >
                              @{clean}
                            </a>
                          </p>
                        ) : null}
                      </TableCell>

                      <TableCell>{lead.profiles?.business_type ?? '-'}</TableCell>
                      <TableCell>{[lead.profiles?.city, lead.profiles?.country].filter(Boolean).join(', ') || '-'}</TableCell>
                      <TableCell>
                        <LeadStatusBadge status={lead.status} />
                      </TableCell>

                      <TableCell className="text-sm text-slate-700">
                        {lead.owner_label ?? lead.owner_id ?? '-'}
                      </TableCell>

                      <TableCell>{lead.confidence ?? '-'}</TableCell>
                      <TableCell>{new Date(lead.discovered_at).toLocaleDateString()}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

            {rows.length === 0 ? <p className="py-6 text-sm text-slate-500">No leads found for this filter.</p> : null}
          </CardContent>
        </Card>
      ) : null}
    </section>
  );
}
