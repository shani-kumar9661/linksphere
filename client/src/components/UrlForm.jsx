import React, { useState } from 'react';
import { getShortBaseUrl } from '../utils/urlHelper';
import { Link2, Copy, Check, Sparkles, QrCode, Clock } from 'lucide-react';
import QrCodeModal from './QrCodeModal';

export default function UrlForm({ onUrlCreated }) {
  const [originalUrl, setOriginalUrl] = useState('');
  const [customAlias, setCustomAlias] = useState('');
  const [category, setCategory] = useState('');
  const [tags, setTags] = useState([]);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successResult, setSuccessResult] = useState(null);
  const [copied, setCopied] = useState(false);
  const [isQrOpen, setIsQrOpen] = useState(false);
  const [isPasswordProtected, setIsPasswordProtected] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [expirationType, setExpirationType] = useState('none');
  const [customExpiryDate, setCustomExpiryDate] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccessResult(null);
    setCopied(false);

    // Simple client-side validation
    if (!originalUrl) {
      setError('Please provide a URL to shorten.');
      setLoading(false);
      return;
    }

    if (isPasswordProtected) {
      if (!password) {
        setError('Please enter a password for protection.');
        setLoading(false);
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match.');
        setLoading(false);
        return;
      }
    }

    // Handle expiration date calculation
    let expiresAt;
    if (expirationType === '1day') {
      expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    } else if (expirationType === '7days') {
      expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    } else if (expirationType === '30days') {
      expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    } else if (expirationType === 'custom') {
      if (!customExpiryDate) {
        setError('Please select a custom expiration date.');
        setLoading(false);
        return;
      }
      const customDate = new Date(customExpiryDate);
      if (customDate <= new Date()) {
        setError('Expiration date must be in the future.');
        setLoading(false);
        return;
      }
      expiresAt = customDate.toISOString();
    }

    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch('/api/v1/urls', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          originalUrl,
          customAlias: customAlias ? customAlias.trim() : undefined,
          category: category || undefined,
          tags,
          note: note ? note.trim() : undefined,
          password: isPasswordProtected ? password : undefined,
          expiresAt
        })
      });

      const json = await response.json();

      if (!response.ok) {
        throw new Error(json.message || 'Something went wrong');
      }

      setSuccessResult(json.data.url);
      setOriginalUrl('');
      setCustomAlias('');
      setCategory('');
      setTags([]);
      setNote('');
      setIsPasswordProtected(false);
      setPassword('');
      setConfirmPassword('');
      setExpirationType('none');
      setCustomExpiryDate('');
      if (onUrlCreated) onUrlCreated();
    } catch (err) {
      setError(err.message || 'Failed to shorten URL');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (!successResult) return;
    
    // Construct the short link referencing the dynamic base URL
    const shortLink = `${getShortBaseUrl()}/${successResult.shortCode}`;
    
    navigator.clipboard.writeText(shortLink).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="glass-panel shortener-panel">
      <h3 className="shortener-title">
        <Sparkles size={20} className="text-secondary" />
        Shorten a Long Link
      </h3>
      
      {error && <div className="alert alert-danger">{error}</div>}
      
      <form onSubmit={handleSubmit}>
        <div className="shortener-grid">
          <div className="form-group">
            <label className="form-label">Destination URL</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g., https://very-long-link.com/deep/page/details"
              value={originalUrl}
              onChange={(e) => setOriginalUrl(e.target.value)}
              disabled={loading}
            />
          </div>
          
          <div className="form-group">
            <label className="form-label">Custom Alias (Optional)</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g., my-link"
              value={customAlias}
              onChange={(e) => setCustomAlias(e.target.value)}
              disabled={loading}
            />
          </div>
          
          <div className="form-group">
            <label className="form-label">Tags</label>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '6px' }}>
              {['Docker', 'React', 'AWS', 'AI'].map(tag => {
                const isSelected = tags.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    className={`tag-pill-btn ${isSelected ? 'selected' : ''}`}
                    onClick={() => {
                      if (isSelected) {
                        setTags(tags.filter(t => t !== tag));
                      } else {
                        setTags([...tags, tag]);
                      }
                    }}
                    disabled={loading}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Category</label>
            <select
              className="form-input"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              disabled={loading}
            >
              <option value="">None</option>
              <option value="Work">Work</option>
              <option value="College">College</option>
              <option value="Portfolio">Portfolio</option>
              <option value="Social">Social</option>
              <option value="Marketing">Marketing</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Expiration Setting</label>
            <div style={{ position: 'relative' }}>
              <select
                className="form-input"
                value={expirationType}
                onChange={(e) => {
                  setExpirationType(e.target.value);
                  if (e.target.value !== 'custom') {
                    setCustomExpiryDate('');
                  }
                }}
                disabled={loading}
                style={{ paddingLeft: '32px' }}
              >
                <option value="none">No Expiration</option>
                <option value="1day">Expire after 1 Day</option>
                <option value="7days">Expire after 7 Days</option>
                <option value="30days">Expire after 30 Days</option>
                <option value="custom">Custom Date</option>
              </select>
              <Clock size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            </div>
          </div>

          {expirationType === 'custom' && (
            <div className="form-group" style={{ animation: 'fadeIn 0.2s ease' }}>
              <label className="form-label">Custom Expiration Date & Time</label>
              <input
                type="datetime-local"
                className="form-input"
                value={customExpiryDate}
                onChange={(e) => setCustomExpiryDate(e.target.value)}
                disabled={loading}
                required
              />
            </div>
          )}

          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label className="switch-container">
              <input
                type="checkbox"
                className="switch-input"
                checked={isPasswordProtected}
                onChange={(e) => {
                  setIsPasswordProtected(e.target.checked);
                  if (!e.target.checked) {
                    setPassword('');
                    setConfirmPassword('');
                  }
                }}
                disabled={loading}
              />
              <span className="switch-slider"></span>
              <span className="switch-label">Enable Password Protection</span>
            </label>
          </div>

          {isPasswordProtected && (
            <>
              <div className="form-group">
                <label className="form-label">Password</label>
                <input
                  type="password"
                  className="form-input"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Confirm Password</label>
                <input
                  type="password"
                  className="form-input"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={loading}
                  required
                />
              </div>
            </>
          )}

          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label className="form-label">Personal Note (Optional)</label>
            <textarea
              className="form-input"
              placeholder="Add a private note about this link..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              disabled={loading}
              rows={2}
              style={{ resize: 'vertical', minHeight: '60px' }}
            />
          </div>
        </div>
        
        <div className="shortener-actions">
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? (
              <>
                <span className="spinner"></span>
                Shortening...
              </>
            ) : (
              <>
                <Link2 size={18} />
                Shorten Link
              </>
            )}
          </button>
        </div>
      </form>

      {successResult && (
        <div className="result-card">
          <div className="result-info">
            <span className="result-label">Successfully Shortened!</span>
            <span className="result-url">
              {`${getShortBaseUrl()}/${successResult.shortCode}`}
            </span>
          </div>
          <div className="result-actions" style={{ display: 'flex', gap: '8px' }}>
            <button onClick={handleCopy} className="btn btn-secondary btn-icon" title="Copy to clipboard">
              {copied ? (
                <Check size={18} className="text-success" />
              ) : (
                <Copy size={18} />
              )}
            </button>
            <button onClick={() => setIsQrOpen(true)} className="btn btn-secondary btn-icon" title="Generate QR Code">
              <QrCode size={18} />
            </button>
          </div>
        </div>
      )}

      {isQrOpen && successResult && (
        <QrCodeModal
          isOpen={isQrOpen}
          onClose={() => setIsQrOpen(false)}
          urlObj={successResult}
        />
      )}
    </div>
  );
}
