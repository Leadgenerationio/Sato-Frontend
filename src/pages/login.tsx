import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '@/components/providers/auth-provider';
import {
  Mail, Lock, Eye, EyeOff, CircleAlert, ArrowRight, Check,
  BarChart3, Users, ShieldCheck,
} from 'lucide-react';
import { toast } from 'sonner';

// Stato — Admin Sign In. Restyled to the Claude Design handoff
// (Admin Login.html): ink-green brand panel + white form panel. Wired to the
// real auth flow (validation, show/hide password, remember, error surface).

const FEATURES = [
  { Icon: Users, label: 'Oversee every client portal in one console' },
  { Icon: BarChart3, label: 'Monitor lead deliveries & campaign performance' },
  { Icon: ShieldCheck, label: 'Approve creatives, invoices & compliance' },
];

export function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [remember, setRemember] = useState(true);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [serverError, setServerError] = useState('');
  const [loading, setLoading] = useState(false);

  if (user) {
    const isPortal = user.role === 'client' || user.role === 'client_admin';
    return <Navigate to={isPortal ? '/portal' : '/'} replace />;
  }

  function validate() {
    const e: { email?: string; password?: string } = {};
    if (!email.trim()) e.email = 'Enter your work email';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) e.email = 'Enter a valid email address';
    if (!password) e.password = 'Enter your password';
    return e;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setServerError('');
    const v = validate();
    setErrors(v);
    if (Object.keys(v).length) return;

    setLoading(true);
    const { error: err, user: loggedInUser } = await login(email.trim(), password.trim());
    setLoading(false);

    if (err) {
      setServerError(err);
      toast.error('Login failed', { description: err });
      return;
    }
    toast.success('Welcome back!', { description: 'You have been signed in successfully.' });
    const isPortal = loggedInUser?.role === 'client' || loggedInUser?.role === 'client_admin';
    navigate(isPortal ? '/portal' : '/');
  }

  return (
    <div className="statto-admin auth">
      {/* Brand panel */}
      <div className="auth-brand">
        <div className="auth-orb" />
        <div className="auth-orb two" />
        <div className="auth-brand-inner">
          <div className="auth-logo">
            <span className="auth-logo-mark"><BarChart3 className="size-[22px]" strokeWidth={2.6} /></span>
            <span className="auth-logo-word">Stato</span>
            <span className="auth-logo-tag">Admin</span>
          </div>
          <div className="auth-headline">
            <h1>Run every client from <em>one console.</em></h1>
            <p>Sign in to manage portals, track leads, and keep delivery, billing, and compliance on course.</p>
            <div className="auth-feats">
              {FEATURES.map((f) => (
                <div key={f.label} className="auth-feat">
                  <span className="auth-feat-ic"><f.Icon className="size-[18px]" /></span>{f.label}
                </div>
              ))}
            </div>
          </div>
          <div className="auth-foot">
            <span>© 2026 Stato</span>
            <a href="#">Privacy</a>
            <a href="#">Security</a>
            <a href="#">Status</a>
          </div>
        </div>
      </div>

      {/* Form panel */}
      <div className="auth-form-wrap">
        <form className="auth-card" onSubmit={handleSubmit} noValidate>
          <h1 className="auth-title">Sign in to Stato</h1>
          <p className="auth-sub">Use your Stato admin credentials. Access is restricted to authorised staff accounts.</p>

          {serverError && (
            <div className="field-err" style={{ marginBottom: 16 }}><CircleAlert className="size-[13px]" />{serverError}</div>
          )}

          <div className="field">
            <label className="field-label" htmlFor="email">Work email</label>
            <div className={'field-input' + (errors.email ? ' err' : '')}>
              <span className="lic"><Mail className="size-[18px]" /></span>
              <input id="email" type="email" autoComplete="username" placeholder="you@stato.com"
                value={email}
                onChange={(e) => { setEmail(e.target.value); if (errors.email) setErrors((p) => ({ ...p, email: undefined })); }} />
            </div>
            {errors.email && <div className="field-err"><CircleAlert className="size-[13px]" />{errors.email}</div>}
          </div>

          <div className="field">
            <label className="field-label" htmlFor="password">Password</label>
            <div className={'field-input' + (errors.password ? ' err' : '')}>
              <span className="lic"><Lock className="size-[18px]" /></span>
              <input id="password" type={show ? 'text' : 'password'} autoComplete="current-password" placeholder="••••••••"
                value={password}
                onChange={(e) => { setPassword(e.target.value); if (errors.password) setErrors((p) => ({ ...p, password: undefined })); }} />
              <button type="button" className="field-eye" tabIndex={-1} title={show ? 'Hide' : 'Show'} onClick={() => setShow((s) => !s)}>
                {show ? <EyeOff className="size-[17px]" /> : <Eye className="size-[17px]" />}
              </button>
            </div>
            {errors.password && <div className="field-err"><CircleAlert className="size-[13px]" />{errors.password}</div>}
          </div>

          <div className="field-row">
            <label className="checkbox">
              <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
              <span className="box"><Check className="size-[13px]" strokeWidth={3} /></span>
              Keep me signed in
            </label>
          </div>

          <button type="submit" className="btn b-primary b-block" disabled={loading}>
            {loading ? <><span className="spinner" /> Signing in…</> : <>Sign in <ArrowRight className="size-[16px]" /></>}
          </button>
        </form>
      </div>
    </div>
  );
}
