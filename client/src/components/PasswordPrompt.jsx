import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Lock, ArrowRight, ShieldAlert } from 'lucide-react';

export default function PasswordPrompt() {
  const { shortCode } = useParams();
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (!password) {
      setError('Please enter the password.');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`/api/v1/urls/verify-password/${shortCode}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ password })
      });

      const json = await response.json();

      if (!response.ok) {
        throw new Error(json.message || 'Incorrect password.');
      }

      const { originalUrl } = json.data;
      // Perform immediate redirection to destination url
      window.location.replace(originalUrl);
    } catch (err) {
      setError(err.message || 'Failed to verify password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="glass-panel auth-card">
        <div className="auth-header">
          <div className="auth-logo" style={{ color: 'var(--color-warning)' }}>
            <Lock size={32} />
            <span>LinkSphere</span>
          </div>
          <h2 className="auth-title">Password Required</h2>
          <p className="auth-subtitle">
            This shortened link is password protected. Enter the password below to access the destination URL.
          </p>
        </div>

        {error && (
          <div className="alert alert-danger" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShieldAlert size={16} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              type="password"
              className="form-input"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              autoFocus
              required
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', marginTop: '8px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="spinner"></span>
                Verifying...
              </>
            ) : (
              <>
                <span>Access Link</span>
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
