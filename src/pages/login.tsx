import { useState, useEffect } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '@/components/providers/auth-provider';
import {
  Mail, Lock, Eye, EyeOff, CircleAlert, ArrowRight, Check,
  KeyRound, ArrowLeft,
} from 'lucide-react';
import { toast } from 'sonner';
import { API_URL } from '@/lib/env';
import { brand } from '@/config/brand';
import type { ApiResponse } from '@/types';

// Sign In. Restyled to the Claude Design handoff (Admin Login.html): ink-green
// brand panel + white form panel. Wired to the real auth flow (validation,
// show/hide password, remember, error surface).
//
// Branding is client-configurable via src/config/brand.ts (Sam ask
// 2026-06-15) — the internal "Stato" wordmark and generic marketing bullets
// were removed in favour of "<brand> — <tagline>".

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

  // Brand the browser tab too (Sam 2026-06-15: clients shouldn't see "Stato").
  // Uses the hostname-resolved brand from src/config/brand.ts.
  useEffect(() => {
    document.title = `${brand.name} — ${brand.tagline}`;
  }, []);

  // ─── Forgot-password OTP flow (Sam 2026-06-10) ───
  // 'signin' shows the normal form; the other steps drive the 3-step reset.
  const [mode, setMode] = useState<'signin' | 'fp-email' | 'fp-code' | 'fp-newpw'>('signin');
  const [fpEmail, setFpEmail] = useState('');
  const [fpCode, setFpCode] = useState('');
  const [fpResetToken, setFpResetToken] = useState('');
  const [fpNewPw, setFpNewPw] = useState('');
  const [fpConfirm, setFpConfirm] = useState('');
  const [fpShowPw, setFpShowPw] = useState(false);
  const [fpError, setFpError] = useState('');
  const [fpLoading, setFpLoading] = useState(false);

  function openForgot() {
    setFpEmail(email.trim());
    setFpCode('');
    setFpResetToken('');
    setFpNewPw('');
    setFpConfirm('');
    setFpError('');
    setMode('fp-email');
  }

  function backToSignin() {
    setFpError('');
    setMode('signin');
  }

  // Step 1 — request a code. Backend always returns success (no enumeration),
  // so we always advance to the code step.
  async function fpSendCode(e: React.FormEvent) {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fpEmail.trim())) { setFpError('Enter a valid email address'); return; }
    setFpLoading(true);
    setFpError('');
    try {
      await fetch(`${API_URL}/api/v1/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: fpEmail.trim() }),
      });
      toast.success('Code sent', { description: 'If that email is registered, a 6-digit code is on its way.' });
      setMode('fp-code');
    } catch {
      setFpError('Network error — please try again');
    } finally { setFpLoading(false); }
  }

  // Step 2 — verify the code, capture the reset token.
  async function fpVerifyCode(e: React.FormEvent) {
    e.preventDefault();
    if (!/^\d{6}$/.test(fpCode.trim())) { setFpError('Enter the 6-digit code'); return; }
    setFpLoading(true);
    setFpError('');
    try {
      const res = await fetch(`${API_URL}/api/v1/auth/verify-reset-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: fpEmail.trim(), code: fpCode.trim() }),
      });
      const data: ApiResponse<{ resetToken: string }> = await res.json();
      if (data.status === 'success' && data.data?.resetToken) {
        setFpResetToken(data.data.resetToken);
        setMode('fp-newpw');
      } else {
        setFpError(data.message || 'Invalid or expired code');
      }
    } catch {
      setFpError('Network error — please try again');
    } finally { setFpLoading(false); }
  }

  // Step 3 — set the new password.
  async function fpResetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (fpNewPw.length < 8) { setFpError('Password must be at least 8 characters'); return; }
    if (fpNewPw !== fpConfirm) { setFpError('Passwords do not match'); return; }
    setFpLoading(true);
    setFpError('');
    try {
      const res = await fetch(`${API_URL}/api/v1/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resetToken: fpResetToken, newPassword: fpNewPw }),
      });
      const data: ApiResponse<{ message: string }> = await res.json();
      if (data.status === 'success') {
        toast.success('Password reset', { description: 'You can now sign in with your new password.' });
        setPassword('');
        setMode('signin');
      } else {
        setFpError(data.message || 'Could not reset password — start again');
      }
    } catch {
      setFpError('Network error — please try again');
    } finally { setFpLoading(false); }
  }

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
          {/* Only the brand name, centered. Logo wordmark, tagline, sign-in
              subtitle and footer were removed per request. */}
          {brand.logoUrl ? (
            <img className="auth-logo-img" src={brand.logoUrl} alt={brand.name} style={{ maxHeight: 56, width: 'auto' }} />
          ) : (
            <span className="auth-brand-name">{brand.name}</span>
          )}
        </div>
      </div>

      {/* Form panel */}
      <div className="auth-form-wrap">
        {mode === 'signin' ? (
          <form className="auth-card" onSubmit={handleSubmit} noValidate>
            <h1 className="auth-title">Sign in to {brand.name}</h1>
            <p className="auth-sub">Sign in with your account to access your dashboard.</p>

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
              <button type="button" className="link" onClick={openForgot}>Forgot password?</button>
            </div>

            <button type="submit" className="btn b-primary b-block" disabled={loading}>
              {loading ? <><span className="spinner" /> Signing in…</> : <>Sign in <ArrowRight className="size-[16px]" /></>}
            </button>
          </form>
        ) : (
          <form
            className="auth-card"
            onSubmit={mode === 'fp-email' ? fpSendCode : mode === 'fp-code' ? fpVerifyCode : fpResetPassword}
            noValidate
          >
            <button type="button" className="link" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 14 }} onClick={backToSignin}>
              <ArrowLeft className="size-[14px]" /> Back to sign in
            </button>

            <h1 className="auth-title">Reset your password</h1>
            <p className="auth-sub">
              {mode === 'fp-email' && 'Enter your work email and we’ll send a 6-digit code.'}
              {mode === 'fp-code' && `Enter the 6-digit code sent to ${fpEmail}.`}
              {mode === 'fp-newpw' && 'Choose a new password for your account.'}
            </p>

            {fpError && (
              <div className="field-err" style={{ marginBottom: 16 }}><CircleAlert className="size-[13px]" />{fpError}</div>
            )}

            {mode === 'fp-email' && (
              <div className="field">
                <label className="field-label" htmlFor="fp-email">Work email</label>
                <div className="field-input">
                  <span className="lic"><Mail className="size-[18px]" /></span>
                  <input id="fp-email" type="email" autoComplete="username" placeholder="you@stato.com"
                    value={fpEmail} autoFocus
                    onChange={(e) => { setFpEmail(e.target.value); if (fpError) setFpError(''); }} />
                </div>
              </div>
            )}

            {mode === 'fp-code' && (
              <div className="field">
                <label className="field-label" htmlFor="fp-code">6-digit code</label>
                <div className="field-input">
                  <span className="lic"><KeyRound className="size-[18px]" /></span>
                  <input id="fp-code" inputMode="numeric" autoComplete="one-time-code" placeholder="123456" maxLength={6}
                    value={fpCode} autoFocus
                    style={{ letterSpacing: 4, fontVariantNumeric: 'tabular-nums' }}
                    onChange={(e) => { setFpCode(e.target.value.replace(/\D/g, '').slice(0, 6)); if (fpError) setFpError(''); }} />
                </div>
                <button type="button" className="link" style={{ marginTop: 8 }} onClick={fpSendCode} disabled={fpLoading}>
                  Resend code
                </button>
              </div>
            )}

            {mode === 'fp-newpw' && (
              <>
                <div className="field">
                  <label className="field-label" htmlFor="fp-newpw">New password</label>
                  <div className="field-input">
                    <span className="lic"><Lock className="size-[18px]" /></span>
                    <input id="fp-newpw" type={fpShowPw ? 'text' : 'password'} autoComplete="new-password" placeholder="Min 8 characters"
                      value={fpNewPw} autoFocus
                      onChange={(e) => { setFpNewPw(e.target.value); if (fpError) setFpError(''); }} />
                    <button type="button" className="field-eye" tabIndex={-1} title={fpShowPw ? 'Hide' : 'Show'} onClick={() => setFpShowPw((s) => !s)}>
                      {fpShowPw ? <EyeOff className="size-[17px]" /> : <Eye className="size-[17px]" />}
                    </button>
                  </div>
                </div>
                <div className="field">
                  <label className="field-label" htmlFor="fp-confirm">Confirm new password</label>
                  <div className="field-input">
                    <span className="lic"><Lock className="size-[18px]" /></span>
                    <input id="fp-confirm" type={fpShowPw ? 'text' : 'password'} autoComplete="new-password" placeholder="Re-enter the new password"
                      value={fpConfirm}
                      onChange={(e) => { setFpConfirm(e.target.value); if (fpError) setFpError(''); }} />
                  </div>
                </div>
              </>
            )}

            <button type="submit" className="btn b-primary b-block" disabled={fpLoading}>
              {fpLoading ? (
                <><span className="spinner" /> Working…</>
              ) : mode === 'fp-email' ? (
                <>Send code <ArrowRight className="size-[16px]" /></>
              ) : mode === 'fp-code' ? (
                <>Verify code <ArrowRight className="size-[16px]" /></>
              ) : (
                <>Reset password <ArrowRight className="size-[16px]" /></>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
