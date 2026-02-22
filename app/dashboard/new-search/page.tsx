'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Select } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { generateHarbizCopy } from '@/lib/harbizCopy';

type SearchLead = {
  id: string;
  status: string;
  source_query: string | null;
  confidence: number | null;
  discovered_at: string;
  profiles: {
    instagram_handle: string;
    full_name: string | null;
    business_type: string | null;
    city: string | null;
    country: string | null;
    bio?: string | null; // por si lo añadimos luego desde API
  } | null;
};

type SearchResponse = {
  runId: string;
  queryCount: number;
  failures: string[];
  leads: SearchLead[];
};

export default function NewSearchPage() {
  // Location = macro: país / ciudad, país / Online, país
  const [location, setLocation] = useState('CDMX, Mexico');

  // Keywords = micro: barrio, modalidad, nicho, etc.
  const [keywords, setKeywords] = useState('personal trainer fuerza polanco');

  const [profileType, setProfileType] = useState<'PT' | 'Center'>('PT');
  const [count, setCount] = useState(20);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SearchResponse | null>(null);
  const [progress, setProgress] = useState(0);
  const [displayProcessed, setDisplayProcessed] = useState(0);

  // ⚠️ TEMPORAL: en esta pantalla no tenemos el email del usuario autenticado.
  // Más adelante lo hacemos automático desde backend.
  const ownerEmailForCopy = 'albertorey@harbiz.io';

  // estimación fija solo para la barrita de progreso
  const totalQueries = useMemo(() => 40, []);

  useEffect(() => {
    if (!loading) {
      setProgress(0);
      setDisplayProcessed(0);
      return;
    }

    const timer = setInterval(() => {
      setProgress((prev) => Math.min(prev + 2, 92));
      setDisplayProcessed((prev) => Math.min(prev + 1, totalQueries));
    }, 450);

    return () => clearInterval(timer);
  }, [loading, totalQueries]);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    const response = await fetch('/api/search-instagram', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        location: location.trim(),
        keywords: keywords.trim(),
        profileType,
        count
      })
    });

    const payload = (await response.json()) as SearchResponse | { error: string };

    if (!response.ok) {
      setError('error' in payload ? payload.error : 'Search failed');
      setLoading(false);
      return;
    }

    setProgress(100);
    setDisplayProcessed((payload as SearchResponse).queryCount);
    setResult(payload as SearchResponse);
    setLoading(false);
  };

  const onSeedDemoData = async () => {
    setLoading(true);
    setError(null);

    const response = await fetch('/api/mock-seed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `${profileType} ${keywords} ${location}`,
        country: location,
        count: 10
      })
    });

    if (!response.ok) {
      const payload = (await response.json()) as { error?: string };
      setError(payload.error ?? 'Unable to seed data');
      setLoading(false);
      return;
    }

    setLoading(false);
  };

  async function handleSendDM(username: string, message: string) {
    try {
      await navigator.clipboard.writeText(message);
      window.open(`https://www.instagram.com/${username}/`, '_blank', 'noopener,noreferrer');
      // opcional: alert corto
      // alert("Copiado ✅ Pega el mensaje en Instagram (Cmd/Ctrl+V) y envía.");
    } catch {
      window.open(`https://www.instagram.com/${username}/`, '_blank', 'noopener,noreferrer');
      alert('No pude copiar automáticamente. Copia el mensaje manualmente:\n\n' + message);
    }
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Instagram deep search</h1>
          <p className="text-sm text-slate-500">Serper search + dedupe + scoring + workspace lead creation.</p>
        </div>
        <Button variant="secondary" onClick={onSeedDemoData} disabled={loading}>
          Seed demo data
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Search parameters</CardTitle>
          <CardDescription>
            Usa <b>Location</b> para el “macro” (país / ciudad, país / Online, país). Usa <b>Keywords</b> para barrio, nicho, modalidad, etc.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4 md:grid-cols-2" onSubmit={onSubmit}>
            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                value={location}
                onChange={(event) => setLocation(event.target.value)}
                placeholder="Ej: Mexico | CDMX, Mexico | Online, Colombia"
                required
              />
              <p className="text-xs text-slate-500">
                Ejemplos: <b>Mexico</b> (solo país), <b>Buenos Aires, Argentina</b> (ciudad + país), <b>Online, Mexico</b> (online en país).
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="keywords">Keywords</Label>
              <Input
                id="keywords"
                value={keywords}
                onChange={(event) => setKeywords(event.target.value)}
                placeholder="Ej: personal trainer fuerza polanco | coach online recomposición"
                required
              />
              <p className="text-xs text-slate-500">
                Mete aquí filtros finos: barrio (Polanco/Belgrano), modalidad (online), nicho (fuerza/pilates), etc.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="profileType">Profile type</Label>
              <Select
                id="profileType"
                value={profileType}
                onChange={(event) => setProfileType(event.target.value as 'PT' | 'Center')}
              >
                <option value="PT">PT</option>
                <option value="Center">Center</option>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="count">Lead count</Label>
              <Input
                id="count"
                type="number"
                min={1}
                max={100}
                value={count}
                onChange={(event) => setCount(Number(event.target.value))}
                required
              />
            </div>

            <div className="md:col-span-2">
              <Button type="submit" disabled={loading}>
                {loading ? 'Running search...' : 'Run search'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {loading ? (
        <Card>
          <CardHeader>
            <CardTitle>Searching</CardTitle>
            <CardDescription>
              Searching {displayProcessed}/{totalQueries} queries
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Progress value={progress} />
          </CardContent>
        </Card>
      ) : null}

      {error ? <p className="text-sm text-rose-600">{error}</p> : null}

      {result ? (
        <Card>
          <CardHeader>
            <CardTitle>Results ({result.leads.length})</CardTitle>
            <CardDescription>
              Search run {result.runId} · {result.queryCount} queries · failures: {result.failures.length}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Instagram</TableHead>
                  <TableHead>Business type</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Confidence</TableHead>
                  <TableHead>Copy</TableHead>
                  <TableHead>DM</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.leads.map((lead) => {
                  const handle = (lead.profiles?.instagram_handle ?? '').replace(/^@/, '');

                  // Si en el futuro la API devuelve profiles.bio, lo usamos.
                  // Si no, usamos source_query como fallback (no ideal, pero genera algo).
                  const bioFallback = (lead as any)?.profiles?.bio ?? lead.source_query ?? '';

                  const copy = generateHarbizCopy({
                    ownerEmail: ownerEmailForCopy,
                    displayName: lead.profiles?.full_name ?? '',
                    bio: bioFallback,
                  });

                  return (
                    <TableRow key={lead.id}>
                      <TableCell>
                        {handle ? (
                          <a
                            href={`https://instagram.com/${handle}`}
                            target="_blank"
                            rel="noreferrer"
                            className="hover:underline"
                          >
                            @{handle}
                          </a>
                        ) : (
                          '-'
                        )}
                      </TableCell>

                      <TableCell>{lead.profiles?.business_type ?? '-'}</TableCell>
                      <TableCell>
                        {[lead.profiles?.city, lead.profiles?.country].filter(Boolean).join(', ') || '-'}
                      </TableCell>
                      <TableCell>{lead.confidence ?? '-'}</TableCell>

                      <TableCell className="min-w-[340px]">
                        <textarea
                          readOnly
                          value={copy}
                          className="w-full rounded border border-slate-200 p-2 text-xs leading-5"
                          rows={5}
                        />
                      </TableCell>

                      <TableCell>
                        {handle ? (
                          <Button
                            onClick={() => handleSendDM(handle, copy)}
                            className="whitespace-nowrap"
                          >
                            Enviar DM
                          </Button>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}
    </section>
  );
}