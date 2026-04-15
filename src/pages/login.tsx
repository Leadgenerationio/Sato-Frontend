import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '@/components/providers/auth-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Eye,
  EyeOff,
  Loader2,
  Shield,
  Zap,
  TrendingUp,
  Lock,
} from 'lucide-react';
import { toast } from 'sonner';
import { Logo, LogoWhite } from '@/components/shared/logo';

const demoAccounts = [
  { email: 'owner@stato.app', password: 'owner123', role: 'owner', color: 'bg-neutral-600' },
  { email: 'finance@stato.app', password: 'finance123', role: 'finance_admin', color: 'bg-emerald-600' },
  { email: 'ops@stato.app', password: 'ops123', role: 'ops_manager', color: 'bg-neutral-500' },
  { email: 'client@stato.app', password: 'client123', role: 'client', color: 'bg-amber-600' },
  { email: 'readonly@stato.app', password: 'readonly123', role: 'readonly', color: 'bg-neutral-400' },
];

const features = [
  { icon: TrendingUp, title: 'Real-time Analytics', desc: 'Track revenue, leads and campaigns live' },
  { icon: Shield, title: 'Role-Based Access', desc: '5 roles with granular permissions' },
  { icon: Zap, title: 'Automated Workflows', desc: 'Invoicing, chasing and delivery on autopilot' },
  { icon: TrendingUp, title: 'Financial Insights', desc: 'P&L, VAT reports and cash flow tracking' },
];

export function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<number | null>(null);

  if (user) return <Navigate to="/" replace />;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const err = await login(email.trim(), password.trim());
    setLoading(false);

    if (err) {
      setError(err);
      setSelectedAccount(null);
      toast.error('Login failed', { description: err });
    } else {
      toast.success('Welcome back!', { description: 'You have been signed in successfully.' });
      navigate('/');
    }
  }

  function fillDemo(account: typeof demoAccounts[number], index: number) {
    setEmail(account.email);
    setPassword(account.password);
    setSelectedAccount(index);
    setError('');
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

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-between p-12 xl:p-16 w-full">

          {/* Logo */}
          <div className="animate-slide-up">
            <LogoWhite size="md" />
          </div>

          {/* Hero */}
          <div className="max-w-lg">
            <h1 className="text-4xl xl:text-5xl font-bold text-white leading-tight animate-slide-up delay-100">
              Everything your business needs.{' '}
              <span className="text-neutral-400">One platform.</span>
            </h1>

            <p className="mt-6 text-base text-neutral-400 leading-relaxed animate-slide-up delay-200">
              Manage clients, campaigns, invoicing, and operations from a single dashboard built for lead generation businesses.
            </p>

            {/* Features */}
            <div className="mt-10 grid grid-cols-2 gap-4">
              {features.map((feature, i) => (
                <div
                  key={feature.title}
                  className={`group rounded-xl bg-white/[0.04] border border-white/[0.06] p-5 transition-all duration-300 hover:bg-white/[0.08] hover:border-white/10 hover:scale-[1.02] animate-slide-up delay-${(i + 3) * 100}`}
                >
                  <feature.icon className="size-5 text-neutral-500 mb-3 group-hover:text-white transition-colors" />
                  <p className="text-sm font-medium text-white">{feature.title}</p>
                  <p className="text-xs text-neutral-500 mt-1 leading-relaxed">{feature.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Stats */}
          <div className="flex items-center gap-10 animate-fade-in delay-800">
            {[
              { label: 'Active Clients', value: '200+' },
              { label: 'Leads Delivered', value: '50K+' },
              { label: 'Revenue Tracked', value: '$2M+' },
            ].map((stat) => (
              <div key={stat.label}>
                <p className="text-2xl font-bold text-white">{stat.value}</p>
                <p className="text-xs text-neutral-500 mt-1">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ─── Right Panel ─── */}
      <div className="flex flex-1 items-center justify-center bg-neutral-50 p-6 sm:p-10 relative">

        <div className="relative z-10 w-full max-w-[400px]">

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

            {/* Demo accounts */}
            <div className="px-8 pb-8 animate-slide-up delay-500">
              <div className="relative">
                <Separator />
                <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white px-3 text-xs text-neutral-400">
                  or try a demo account
                </span>
              </div>

              <div className="mt-6 space-y-2">
                {demoAccounts.map((account, i) => (
                  <button
                    key={account.email}
                    type="button"
                    onClick={() => fillDemo(account, i)}
                    className={`group flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm transition-all duration-200 ${
                      selectedAccount === i
                        ? 'border-neutral-900 bg-neutral-50 shadow-sm'
                        : 'border-neutral-200 hover:bg-neutral-50 hover:border-neutral-300'
                    }`}
                  >
                    <div className={`flex size-8 shrink-0 items-center justify-center rounded-full ${account.color} text-white text-xs font-bold transition-transform group-hover:scale-110`}>
                      {account.role[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-neutral-700 truncate">{account.email}</p>
                    </div>
                    <Badge variant="secondary" className="shrink-0 capitalize text-[10px] px-2">
                      {account.role.replace('_', ' ')}
                    </Badge>
                    {selectedAccount === i && (
                      <div className="size-2 rounded-full bg-neutral-900 animate-pulse shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-8 flex items-center justify-center text-xs text-neutral-400 animate-fade-in delay-800">
            <Logo size="sm" showText={false} className="opacity-30 scale-75" />
            <span className="ml-1">Stato Business Management</span>
          </div>
        </div>
      </div>
    </div>
  );
}
