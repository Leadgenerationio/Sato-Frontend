import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '@/components/providers/auth-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Eye,
  EyeOff,
  Loader2,
  Lock,
} from 'lucide-react';
import { toast } from 'sonner';
import { Logo, LogoWhite } from '@/components/shared/logo';

export function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  if (user) return <Navigate to={user.role === 'client' ? '/portal' : '/'} replace />;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { error: err, user: loggedInUser } = await login(email.trim(), password.trim());
    setLoading(false);

    if (err) {
      setError(err);
      toast.error('Login failed', { description: err });
    } else {
      toast.success('Welcome back!', { description: 'You have been signed in successfully.' });
      navigate(loggedInUser?.role === 'client' ? '/portal' : '/');
    }
  }

  return (
    <div className="relative flex min-h-screen overflow-hidden">

      {/* ─── Left Panel ─── */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        {/* Black animated gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950 animate-gradient" />

        {/* Floating orbs */}
        <div className="absolute top-20 left-16 size-72 rounded-full bg-white/[0.03] blur-3xl animate-float-slow" />
        <div className="absolute bottom-20 right-16 size-96 rounded-full bg-white/[0.02] blur-3xl animate-float-delayed" />
        <div className="absolute top-1/2 left-1/3 size-48 rounded-full bg-white/[0.02] blur-2xl animate-float" />

        {/* Grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,.4) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.4) 1px, transparent 1px)',
            backgroundSize: '60px 60px',
          }}
        />

        {/* Sam (27 May 2026): asked for a minimal login page — keep only
            the logo on the left, drop the hero copy / feature cards /
            stats. Centered logo reads as professional brand mark for
            client-facing demos. */}
        <div className="relative z-10 flex items-center justify-center p-12 xl:p-16 w-full">
          <div className="animate-slide-up">
            <LogoWhite size="md" />
          </div>
        </div>
      </div>

      {/* ─── Right Panel ─── */}
      <main className="flex flex-1 items-center justify-center bg-neutral-50 p-6 sm:p-10 relative">

        <div className="relative z-10 w-full max-w-[calc(100%-1rem)] sm:max-w-[400px]">

          {/* Mobile logo */}
          <div className="mb-10 flex flex-col items-center lg:hidden animate-scale-in">
            <Logo size="xl" />
            <p className="text-sm text-neutral-500 mt-2">Business Management System</p>
          </div>

          {/* Login card */}
          <div className="rounded-2xl border border-neutral-200 bg-white shadow-xl shadow-neutral-200/50 animate-slide-up delay-100">

            {/* Header */}
            <div className="px-8 pt-8 pb-0 text-center">
              <div className="inline-flex items-center justify-center size-12 rounded-full bg-neutral-100 mb-4">
                <Lock className="size-5 text-neutral-700" />
              </div>
              <h2 className="text-xl font-semibold text-neutral-900">Welcome back</h2>
              <p className="text-sm text-neutral-500 mt-1">Enter your credentials to continue</p>
            </div>

            {/* Form */}
            <div className="p-8">
              <form onSubmit={handleSubmit} className="space-y-5">
                {error && (
                  <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600 animate-scale-in">
                    <div className="size-1.5 shrink-0 rounded-full bg-red-500 animate-pulse" />
                    {error}
                  </div>
                )}

                <div className="space-y-2 animate-slide-up delay-200">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@stato.app"
                    autoComplete="email"
                    className="h-11"
                    required
                  />
                </div>

                <div className="space-y-2 animate-slide-up delay-300">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      autoComplete="current-password"
                      className="h-11 pr-11"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-0 top-0 flex h-full items-center px-3 text-neutral-400 hover:text-neutral-700 transition-colors"
                      tabIndex={-1}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                </div>

                <div className="animate-slide-up delay-400 pt-1">
                  <Button
                    type="submit"
                    className="w-full h-11 bg-neutral-900 hover:bg-neutral-800 text-white shadow-lg shadow-neutral-900/20 hover:shadow-neutral-900/30 transition-all duration-300 hover:scale-[1.01]"
                    disabled={loading}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        Signing in...
                      </>
                    ) : (
                      'Sign in'
                    )}
                  </Button>
                </div>
              </form>
            </div>

            {/* Sam (27 May 2026) — removed the "Need an account? Contact
                the Octogle Team" panel. Client-facing demo wants a clean
                Stato-only login. */}
            <div className="pb-2" />
          </div>
        </div>
      </main>
    </div>
  );
}
