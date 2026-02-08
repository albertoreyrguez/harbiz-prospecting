'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/browser';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignup, setIsSignup] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    let authError: { message: string } | null = null;

    if (isSignup) {
      const { error } = await supabase.auth.signUp({ email, password });
      authError = error;
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      authError = error;
    }

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    const bootstrapResponse = await fetch('/api/auth/bootstrap', { method: 'POST' });
    if (!bootstrapResponse.ok) {
      const payload = (await bootstrapResponse.json()) as { error?: string };
      setError(payload.error ?? 'Unable to initialize workspace');
      setLoading(false);
      return;
    }

    router.replace('/dashboard');
    router.refresh();
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Harbiz Prospecting</CardTitle>
          <CardDescription>{isSignup ? 'Create your SDR account' : 'Sign in with your internal account'}</CardDescription>
        </CardHeader>

        <CardContent>
          <form className="space-y-4" onSubmit={onSubmit}>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                autoComplete="email"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                minLength={6}
                autoComplete={isSignup ? 'new-password' : 'current-password'}
              />
            </div>

            {error ? <p className="text-sm text-rose-600">{error}</p> : null}

            <Button type="submit" disabled={loading} className="w-full">
              {loading ? 'Please wait...' : isSignup ? 'Create account' : 'Login'}
            </Button>
          </form>

          <Button type="button" variant="secondary" onClick={() => setIsSignup((value) => !value)} className="mt-4 w-full">
            {isSignup ? 'Already have an account? Login' : 'Need an account? Sign up'}
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
