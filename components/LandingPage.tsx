'use client';

import React, { useState } from 'react';

export interface AuthUser {
  username: string;
  name: string;
  role: string;
  avatar?: string;
}

interface LandingPageProps {
  collegeName?: string;
  onLogin: (user: AuthUser) => void;
}

export function LandingPage({
  collegeName = 'Nimapara Autonomous College',
  onLogin,
}: LandingPageProps) {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin123');
  const [role, setRole] = useState('Controller of Examinations');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const performLogin = (targetUser: string, targetRole: string) => {
    const nameMap: Record<string, string> = {
      'Controller of Examinations': 'Dr. K. C. Mohapatra (Controller)',
      'Dean / Administrator': 'Prof. S. R. Dash (Dean Academics)',
      'Examination Tabulator': 'Examination Tabulator',
    };

    const user: AuthUser = {
      username: targetUser.trim(),
      name: nameMap[targetRole] || 'Examination Administrator',
      role: targetRole,
    };

    try {
      sessionStorage.setItem('result_erp_auth', JSON.stringify(user));
    } catch {}

    onLogin(user);
  };

  const handleSignIn = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(null);

    if (!username.trim()) {
      setError('Please enter your administrator username or ID.');
      return;
    }
    if (!password.trim()) {
      setError('Please enter your password.');
      return;
    }

    setLoading(true);

    setTimeout(() => {
      // Validate credentials (demo admin/admin123 or any 4+ char password)
      if (
        (username.trim().toLowerCase() === 'admin' && password === 'admin123') ||
        password.length >= 4
      ) {
        performLogin(username, role);
      } else {
        setError('Invalid credentials. Default demo credentials: admin / admin123');
        setLoading(false);
      }
    }, 300);
  };

  const handleQuickAccess = (demoRole: string) => {
    setUsername('admin');
    setPassword('admin123');
    setRole(demoRole);
    setError(null);
    setLoading(true);

    setTimeout(() => {
      performLogin('admin', demoRole);
    }, 200);
  };

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#f8fafc',
      fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      color: '#1e293b',
    }}>
      {/* Classic Institutional Header */}
      <header style={{
        backgroundColor: '#ffffff',
        borderBottom: '1px solid #e2e8f0',
        padding: '16px 28px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          {/* Institutional Crest Icon */}
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '8px',
            backgroundColor: '#1e3a8a',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 800,
            fontSize: '18px',
            letterSpacing: '0.5px',
            boxShadow: '0 2px 6px rgba(30, 58, 138, 0.3)',
          }}>
            NAC
          </div>
          <div>
            <div style={{
              fontSize: '17px',
              fontWeight: 700,
              color: '#0f172a',
              letterSpacing: '-0.2px',
            }}>
              {collegeName}
            </div>
            <div style={{
              fontSize: '12px',
              color: '#64748b',
              fontWeight: 500,
            }}>
              Autonomous Examination &amp; Result Tabulation System
            </div>
          </div>
        </div>

        <div style={{
          fontSize: '12px',
          fontWeight: 600,
          color: '#1e3a8a',
          backgroundColor: '#eff6ff',
          padding: '6px 14px',
          borderRadius: '999px',
          border: '1px solid #bfdbfe',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
        }}>
          <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: '#2563eb' }} />
          Examination Portal
        </div>
      </header>

      {/* Main Centered Sign-In Container */}
      <main style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '36px 16px',
      }}>
        <div style={{
          width: '100%',
          maxWidth: '440px',
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.02)',
          padding: '36px 32px',
        }}>
          {/* Card Header */}
          <div style={{ textAlign: 'center', marginBottom: '28px' }}>
            <div style={{
              width: '52px',
              height: '52px',
              margin: '0 auto 14px',
              borderRadius: '50%',
              backgroundColor: '#eff6ff',
              border: '1px solid #dbeafe',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#1e3a8a',
            }}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                <path d="m9 12 2 2 4-4" />
              </svg>
            </div>
            <h1 style={{
              margin: '0 0 6px 0',
              fontSize: '22px',
              fontWeight: 700,
              color: '#0f172a',
              letterSpacing: '-0.3px',
            }}>
              Portal Sign In
            </h1>
            <p style={{
              margin: 0,
              fontSize: '13px',
              color: '#64748b',
              lineHeight: 1.4,
            }}>
              Enter your authorized administrator credentials to manage examination results and student registries.
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div style={{
              backgroundColor: '#fef2f2',
              border: '1px solid #fecaca',
              color: '#b91c1c',
              padding: '10px 14px',
              borderRadius: '8px',
              fontSize: '13px',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}>
              <span style={{ fontSize: '15px' }}>⚠️</span>
              <span>{error}</span>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSignIn} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Role Select */}
            <div>
              <label style={{
                display: 'block',
                fontSize: '13px',
                fontWeight: 600,
                color: '#334155',
                marginBottom: '6px',
              }}>
                Examination Role
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  backgroundColor: '#ffffff',
                  fontSize: '14px',
                  color: '#0f172a',
                  outline: 'none',
                  cursor: 'pointer',
                }}
              >
                <option value="Controller of Examinations">Controller of Examinations</option>
                <option value="Dean / Administrator">Dean / Administrator</option>
                <option value="Examination Tabulator">Examination Tabulator / Faculty</option>
              </select>
            </div>

            {/* Username Field */}
            <div>
              <label style={{
                display: 'block',
                fontSize: '13px',
                fontWeight: 600,
                color: '#334155',
                marginBottom: '6px',
              }}>
                Username / Admin ID
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter username (e.g. admin)"
                required
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  backgroundColor: '#ffffff',
                  fontSize: '14px',
                  color: '#0f172a',
                  outline: 'none',
                }}
              />
            </div>

            {/* Password Field */}
            <div>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '6px',
              }}>
                <label style={{
                  fontSize: '13px',
                  fontWeight: 600,
                  color: '#334155',
                }}>
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    border: 'none',
                    background: 'none',
                    color: '#2563eb',
                    fontSize: '12px',
                    fontWeight: 500,
                    cursor: 'pointer',
                    padding: 0,
                  }}
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  backgroundColor: '#ffffff',
                  fontSize: '14px',
                  color: '#0f172a',
                  outline: 'none',
                }}
              />
            </div>

            {/* Sign In Button */}
            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '12px',
                marginTop: '6px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: '#1e3a8a',
                color: '#ffffff',
                fontSize: '14px',
                fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
                boxShadow: '0 2px 4px rgba(30, 58, 138, 0.2)',
                transition: 'background-color 0.15s ease',
              }}
              onMouseOver={(e) => {
                if (!loading) e.currentTarget.style.backgroundColor = '#1d4ed8';
              }}
              onMouseOut={(e) => {
                if (!loading) e.currentTarget.style.backgroundColor = '#1e3a8a';
              }}
            >
              {loading ? 'Authenticating...' : 'Sign In to Portal'}
            </button>
          </form>

          {/* Quick Access Demo Section */}
          <div style={{
            marginTop: '24px',
            paddingTop: '20px',
            borderTop: '1px solid #f1f5f9',
          }}>
            <div style={{
              fontSize: '12px',
              color: '#64748b',
              marginBottom: '10px',
              textAlign: 'center',
              fontWeight: 500,
            }}>
              Quick Instant Demo Access:
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                onClick={() => handleQuickAccess('Controller of Examinations')}
                style={{
                  flex: 1,
                  padding: '7px 8px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  backgroundColor: '#f8fafc',
                  color: '#334155',
                  fontSize: '12px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
                onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#f1f5f9')}
                onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#f8fafc')}
              >
                🎓 Controller
              </button>
              <button
                type="button"
                onClick={() => handleQuickAccess('Dean / Administrator')}
                style={{
                  flex: 1,
                  padding: '7px 8px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  backgroundColor: '#f8fafc',
                  color: '#334155',
                  fontSize: '12px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
                onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#f1f5f9')}
                onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#f8fafc')}
              >
                🏛️ Dean
              </button>
              <button
                type="button"
                onClick={() => handleQuickAccess('Examination Tabulator')}
                style={{
                  flex: 1,
                  padding: '7px 8px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  backgroundColor: '#f8fafc',
                  color: '#334155',
                  fontSize: '12px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
                onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#f1f5f9')}
                onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#f8fafc')}
              >
                📝 Tabulator
              </button>
            </div>
            <div style={{
              textAlign: 'center',
              fontSize: '11px',
              color: '#94a3b8',
              marginTop: '10px',
            }}>
              Default credentials: <code style={{ color: '#475569', fontWeight: 600 }}>admin</code> / <code style={{ color: '#475569', fontWeight: 600 }}>admin123</code>
            </div>
          </div>
        </div>
      </main>

      {/* Classic Institutional Footer */}
      <footer style={{
        backgroundColor: '#ffffff',
        borderTop: '1px solid #e2e8f0',
        padding: '16px 28px',
        fontSize: '12px',
        color: '#64748b',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
      }}>
        <div>
          &copy; {new Date().getFullYear()} {collegeName}. Autonomous College CBCS &amp; NEP Examination Regulations.
        </div>
        <div style={{ display: 'flex', gap: '16px', color: '#94a3b8' }}>
          <span>Tamper-evident Audit Logging</span>
          <span>•</span>
          <span>Authorized Access Only</span>
        </div>
      </footer>
    </div>
  );
}
