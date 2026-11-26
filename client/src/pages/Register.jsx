import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { GraduationCap, Mail, Lock, User, Eye, EyeOff, ArrowRight, Check } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Register() {
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpExpiresAt, setOtpExpiresAt] = useState(null);
  const [resendAt, setResendAt] = useState(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [resendSecondsLeft, setResendSecondsLeft] = useState(0);
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { requestRegisterOtp, verifyRegisterOtp, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) navigate('/dashboard', { replace: true });
  }, [user]);

  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now();
      setSecondsLeft(otpExpiresAt ? Math.max(Math.floor((otpExpiresAt - now) / 1000), 0) : 0);
      setResendSecondsLeft(resendAt ? Math.max(Math.floor((resendAt - now) / 1000), 0) : 0);
    }, 1000);
    return () => clearInterval(timer);
  }, [otpExpiresAt, resendAt]);

  useEffect(() => {
    if (otpSent && otpExpiresAt && Date.now() >= otpExpiresAt) {
      setError('OTP expired. Please resend OTP.');
    }
  }, [otpSent, otpExpiresAt, secondsLeft]);

  const pwStrength = (pw) => {
    let s = 0;
    if (pw.length >= 8) s++;
    if (/[A-Z]/.test(pw)) s++;
    if (/[0-9]/.test(pw)) s++;
    if (/[^A-Za-z0-9]/.test(pw)) s++;
    return s;
  };

  const strength = pwStrength(form.password);
  const strengthColors = ['', '#ef4444', '#f59e0b', '#10b981', '#6366f1'];
  const strengthLabels = ['', 'Weak', 'Fair', 'Good', 'Strong'];

  const handle = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (!otpSent) {
        if (!form.name.trim() || !form.email.trim() || !form.password) {
          setError('Name, email and password are required');
          setLoading(false);
          return;
        }
        if (form.password.length < 6) {
          setError('Password must be at least 6 characters');
          setLoading(false);
          return;
        }
        const data = await requestRegisterOtp(form.name, form.email, form.password);
        setOtpSent(true);
        const ttl = Number(data?.expiresInSeconds || 600);
        const resendWait = Number(data?.resendAfterSeconds || 60);
        const now = Date.now();
        setOtpExpiresAt(now + ttl * 1000);
        setResendAt(now + resendWait * 1000);
        setSecondsLeft(ttl);
        setResendSecondsLeft(resendWait);
        setError('');
        if (data?.devOtp) {
          toast.success(`Email SMTP not configured. Use this OTP for now: ${data.devOtp}`, { duration: 9000 });
        } else {
          toast.success('OTP sent to your email');
        }
      } else {
        if (secondsLeft <= 0) {
          setError('OTP expired. Please resend OTP.');
          setLoading(false);
          return;
        }
        if (!otp.trim()) {
          setError('Please enter OTP');
          setLoading(false);
          return;
        }
        await verifyRegisterOtp(form.email, otp.trim());
        toast.success('Email verified. Account created! 🎓');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-bg" />
      <motion.div className="auth-card" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <div className="auth-logo">
          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 56, height: 56, borderRadius: 16, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', boxShadow: '0 4px 20px rgba(99,102,241,0.4)', marginBottom: '1rem' }}>
            <GraduationCap size={28} color="white" />
          </div>
        </div>
        <h1 className="auth-title">Create Account</h1>
        <p className="auth-subtitle">Join your batchmates on NCET Paper Tracker</p>

        {error && (
          <div className="alert alert-error">
            {error}
          </div>
        )}

        <form onSubmit={handle}>
          {!otpSent && (
            <>
              <div className="form-group">
                <label className="form-label">Full Name</label>
                <div style={{ position: 'relative' }}>
                  <User size={16} style={{ position: 'absolute', left: '0.9rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                  <input
                    type="text"
                    className="form-control"
                    style={{ paddingLeft: '2.5rem' }}
                    placeholder="Your full name"
                    value={form.name}
                    onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                    required
                    autoComplete="name"
                  />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Email Address</label>
                <div style={{ position: 'relative' }}>
                  <Mail size={16} style={{ position: 'absolute', left: '0.9rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                  <input
                    type="email"
                    className="form-control"
                    style={{ paddingLeft: '2.5rem' }}
                    placeholder="your@email.com"
                    value={form.email}
                    onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                    required
                    autoComplete="email"
                  />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Password</label>
                <div style={{ position: 'relative' }}>
                  <Lock size={16} style={{ position: 'absolute', left: '0.9rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                  <input
                    type={showPw ? 'text' : 'password'}
                    className="form-control"
                    style={{ paddingLeft: '2.5rem', paddingRight: '2.5rem' }}
                    placeholder="Min. 6 characters"
                    value={form.password}
                    onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                    required
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(p => !p)}
                    style={{ position: 'absolute', right: '0.9rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '0.25rem' }}
                  >
                    {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {form.password && (
                  <div style={{ marginTop: '0.5rem' }}>
                    <div style={{ display: 'flex', gap: '4px', marginBottom: '4px' }}>
                      {[1, 2, 3, 4].map(i => (
                        <div key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: i <= strength ? strengthColors[strength] : 'var(--border)', transition: 'all 0.2s' }} />
                      ))}
                    </div>
                    <span style={{ fontSize: '0.75rem', color: strengthColors[strength] }}>{strengthLabels[strength]}</span>
                  </div>
                )}
              </div>
            </>
          )}

          {otpSent && (
            <div className="form-group">
              <label className="form-label">Enter OTP sent to {form.email}</label>
              <input
                type="text"
                className="form-control"
                placeholder="6-digit OTP"
                value={otp}
                onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                required
              />
              <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Check your inbox and spam folder. OTP expires in {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, '0')}.
              </div>
            </div>
          )}

          <div style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 10, padding: '0.75rem 1rem', marginBottom: '1.25rem' }}>
            {['Access all previous year papers', 'AI-powered question predictions', 'Share anonymous notes'].map((b, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: i < 2 ? '0.4rem' : 0 }}>
                <Check size={13} style={{ color: '#10b981', flexShrink: 0 }} /> {b}
              </div>
            ))}
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', justifyContent: 'center', padding: '0.8rem' }}
            disabled={loading}
          >
            {loading ? (otpSent ? 'Verifying OTP...' : 'Sending OTP...') : <><span>{otpSent ? 'Verify OTP & Create Account' : 'Send OTP'}</span> <ArrowRight size={16} /></>}
          </button>

          {otpSent && (
            <button
              type="button"
              className="btn btn-secondary"
              style={{ width: '100%', justifyContent: 'center', padding: '0.75rem', marginTop: '0.6rem' }}
              disabled={loading}
              onClick={async () => {
                if (resendSecondsLeft > 0) return;
                setError('');
                setLoading(true);
                try {
                  const data = await requestRegisterOtp(form.name, form.email, form.password);
                  const ttl = Number(data?.expiresInSeconds || 600);
                  const resendWait = Number(data?.resendAfterSeconds || 60);
                  const now = Date.now();
                  setOtpExpiresAt(now + ttl * 1000);
                  setResendAt(now + resendWait * 1000);
                  setSecondsLeft(ttl);
                  setResendSecondsLeft(resendWait);
                  setOtp('');
                  setError('');
                  if (data?.devOtp) {
                    toast.success(`Email SMTP not configured. Use this OTP for now: ${data.devOtp}`, { duration: 9000 });
                  } else {
                    toast.success('OTP resent');
                  }
                } catch (err) {
                  setError(err.response?.data?.error || 'Failed to resend OTP');
                } finally {
                  setLoading(false);
                }
              }}
            >
              {resendSecondsLeft > 0 ? `Resend OTP in ${resendSecondsLeft}s` : 'Resend OTP'}
            </button>
          )}
        </form>

        <p className="auth-footer">
          Already have an account?{' '}
          <Link to="/login" className="auth-link">Sign in</Link>
        </p>
      </motion.div>
    </div>
  );
}
