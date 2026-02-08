'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

type DashboardPayload = {
  workspace: {
    workspaceName: string;
  };
  summary: {
    totalLeads: number;
    newLeads: number;
    contactedLeads: number;
    qualifiedLeads: number;
  };
  recentSearches: Array<{
    id: string;
    query: string;
    results_count: number;
    created_at: string;
  }>;
};

export default function DashboardPage() {
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const response = await fetch('/api/dashboard/summary');
      const payload = (await response.json()) as DashboardPayload | { error: string };

      if (!response.ok) {
        if (!cancelled) {
          setError('error' in payload ? payload.error : 'Failed to load dashboard');
          setLoading(false);
        }
        return;
      }

      if (!cancelled) {
        setData(payload as DashboardPayload);
        setLoading(false);
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-52" />
        <div className="grid gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-24 w-full" />
          ))}
        </div>
        <Skeleton className="h-56 w-full" />
      </div>
    );
  }

  if (error || !data) {
    return <p className="text-sm text-rose-600">{error ?? 'Unable to load dashboard'}</p>;
  }

  const cards = [
    { title: 'Total leads', value: data.summary.totalLeads },
    { title: 'New', value: data.summary.newLeads },
    { title: 'Contacted', value: data.summary.contactedLeads },
    { title: 'Qualified', value: data.summary.qualifiedLeads }
  ];

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Sales dashboard</h1>
        <p className="text-sm text-slate-500">Workspace performance and latest prospecting activity.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <Card key={card.title}>
            <CardHeader className="pb-2">
              <CardDescription>{card.title}</CardDescription>
              <CardTitle className="text-3xl">{card.value}</CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent searches</CardTitle>
          <CardDescription>Latest prospecting runs for your workspace</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {data.recentSearches.length === 0 ? (
              <p className="text-sm text-slate-500">No searches yet. Run your first search from New Search.</p>
            ) : (
              data.recentSearches.map((search) => (
                <div key={search.id} className="flex items-center justify-between rounded-md border bg-slate-50 px-3 py-2 text-sm">
                  <div>
                    <p className="font-medium text-slate-800">{search.query}</p>
                    <p className="text-xs text-slate-500">{new Date(search.created_at).toLocaleString()}</p>
                  </div>
                  <p className="text-sm font-medium text-slate-700">{search.results_count} leads</p>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
