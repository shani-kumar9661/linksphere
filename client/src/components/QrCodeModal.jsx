import React, { useState, useEffect, useCallback } from 'react';
import { getShortBaseUrl } from '../utils/urlHelper';
import QRCode from 'qrcode';
import { Download, RefreshCw, X, QrCode, ExternalLink, Check, Copy, Sparkles } from 'lucide-react';

export default function QrCodeModal({ isOpen, onClose, urlObj }) {
  const [targetType, setTargetType] = useState('short'); // 'short' or 'original'
  const [fgColor, setFgColor] = useState('#4f46e5'); // primary indigo
  const [bgColor, setBgColor] = useState('#ffffff'); // white background
  const [size, setSize] = useState(512); // Export resolution
  const [margin, setMargin] = useState(3); // margin spacing
  const [errorCorrectionLevel, setErrorCorrectionLevel] = useState('M'); // L, M, Q, H
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isRotating, setIsRotating] = useState(false);

  const shortCode = urlObj?.shortCode || '';
  const originalUrl = urlObj?.originalUrl || '';
  const title = urlObj?.title || 'Untitled Link';

  // Construct short link using dynamic base URL
  const shortLink = `${getShortBaseUrl()}/${shortCode}`;
  const activeLink = targetType === 'short' ? shortLink : originalUrl;

  const generateQrCode = useCallback(async () => {
    if (!isOpen || !urlObj) return;
    setGenerating(true);
    try {
      const opts = {
        width: size,
        margin: margin,
        errorCorrectionLevel: errorCorrectionLevel,
        color: {
          dark: fgColor,
          light: bgColor,
        },
      };

      const dataUrl = await QRCode.toDataURL(activeLink, opts);
      setQrDataUrl(dataUrl);
    } catch (err) {
      console.error('QR Code generation failed:', err);
    } finally {
      setTimeout(() => {
        setGenerating(false);
      }, 200);
    }
  }, [isOpen, urlObj, size, margin, errorCorrectionLevel, fgColor, bgColor, activeLink]);

  // Regenerate when inputs change
  useEffect(() => {
    generateQrCode();
  }, [generateQrCode]);

  const handleRegenerate = () => {
    setIsRotating(true);
    generateQrCode();
    setTimeout(() => setIsRotating(false), 800);
  };

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = qrDataUrl;
    link.download = `linksphere-qr-${shortCode}-${targetType}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(activeLink).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  // Safe checks for rendering
  if (!isOpen || !urlObj) return null;

  // Curated color swatches matching the LinkSphere palette
  const fgPresets = ['#4f46e5', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#0f172a'];
  const bgPresets = ['#ffffff', '#f8fafc', '#f1f5f9', '#e2e8f0', '#0a0e1a'];

  return (
    <div className="modal-overlay" onClick={onClose} style={{ display: 'flex', zIndex: 1100 }}>
      <div 
        className="modal-content qr-modal-content glass-panel" 
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '780px', width: '90%' }}
      >
        <div className="modal-header">
          <div className="modal-title-with-icon">
            <div className="modal-title-icon-bg">
              <QrCode className="text-primary" size={20} />
            </div>
            <div>
              <h3>QR Code Generator</h3>
              <p className="modal-subtitle">Generate & Customize QR Code for "{title}"</p>
            </div>
          </div>
          <button className="modal-close-btn" onClick={onClose} disabled={generating}>
            <X size={18} />
          </button>
        </div>

        <div className="qr-modal-body">
          {/* Left Column: Interactive Settings */}
          <div className="qr-settings-panel">
            {/* Setting: Target Link */}
            <div className="qr-form-section">
              <label className="form-label font-semibold">QR Code Target</label>
              <div className="qr-toggle-group">
                <button
                  type="button"
                  className={`qr-toggle-btn ${targetType === 'short' ? 'active' : ''}`}
                  onClick={() => setTargetType('short')}
                >
                  <Sparkles size={14} style={{ marginRight: '6px' }} />
                  Short URL (Tracked)
                </button>
                <button
                  type="button"
                  className={`qr-toggle-btn ${targetType === 'original' ? 'active' : ''}`}
                  onClick={() => setTargetType('original')}
                >
                  <ExternalLink size={14} style={{ marginRight: '6px' }} />
                  Original Destination
                </button>
              </div>
              <div className="qr-target-preview">
                <span className="qr-target-text" title={activeLink}>
                  {activeLink}
                </span>
                <button 
                  onClick={handleCopyLink} 
                  className="qr-target-copy"
                  title="Copy encoded link"
                >
                  {copied ? <Check size={13} className="text-success" strokeWidth={3} /> : <Copy size={13} />}
                </button>
              </div>
            </div>

            {/* Colors Section */}
            <div className="qr-form-section">
              <label className="form-label font-semibold">Foreground Color (QR Code)</label>
              <div className="color-picker-wrapper">
                <input
                  type="color"
                  className="color-picker-input"
                  value={fgColor}
                  onChange={(e) => setFgColor(e.target.value)}
                />
                <div className="color-swatches">
                  {fgPresets.map((color) => (
                    <button
                      key={color}
                      type="button"
                      className={`color-swatch-btn ${fgColor.toLowerCase() === color.toLowerCase() ? 'active' : ''}`}
                      style={{ backgroundColor: color }}
                      onClick={() => setFgColor(color)}
                      title={color}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="qr-form-section">
              <label className="form-label font-semibold">Background Color</label>
              <div className="color-picker-wrapper">
                <input
                  type="color"
                  className="color-picker-input"
                  value={bgColor}
                  onChange={(e) => setBgColor(e.target.value)}
                />
                <div className="color-swatches">
                  {bgPresets.map((color) => (
                    <button
                      key={color}
                      type="button"
                      className={`color-swatch-btn ${bgColor.toLowerCase() === color.toLowerCase() ? 'active' : ''}`}
                      style={{ backgroundColor: color }}
                      onClick={() => setBgColor(color)}
                      title={color}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Layout Options: Size & Margin */}
            <div className="qr-grid-options">
              <div className="qr-form-section">
                <label className="form-label font-semibold">Size (Resolution)</label>
                <select
                  className="form-select w-full"
                  value={size}
                  onChange={(e) => setSize(Number(e.target.value))}
                >
                  <option value={256}>256 x 256 px</option>
                  <option value={512}>512 x 512 px</option>
                  <option value={1024}>1024 x 1024 px</option>
                </select>
              </div>

              <div className="qr-form-section">
                <label className="form-label font-semibold">Margin: {margin}</label>
                <input
                  type="range"
                  min="0"
                  max="6"
                  className="form-range"
                  value={margin}
                  onChange={(e) => setMargin(Number(e.target.value))}
                />
              </div>
            </div>

            {/* Error Correction */}
            <div className="qr-form-section">
              <label className="form-label font-semibold">Error Correction Level</label>
              <div className="qr-error-level-group">
                {['L', 'M', 'Q', 'H'].map((level) => {
                  let desc = '';
                  if (level === 'L') desc = 'Low (7%)';
                  if (level === 'M') desc = 'Medium (15%)';
                  if (level === 'Q') desc = 'Quartile (25%)';
                  if (level === 'H') desc = 'High (30%)';

                  return (
                    <button
                      key={level}
                      type="button"
                      className={`error-level-btn ${errorCorrectionLevel === level ? 'active' : ''}`}
                      onClick={() => setErrorCorrectionLevel(level)}
                      title={`${desc} recovery capacity`}
                    >
                      <span className="error-level-letter">{level}</span>
                      <span className="error-level-desc">{desc.split(' ')[0]}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right Column: Visual Preview Panel */}
          <div className="qr-preview-panel">
            <div className="qr-preview-container">
              {generating && (
                <div className="qr-preview-loading">
                  <span className="spinner" style={{ width: '45px', height: '45px', borderLeftColor: 'var(--color-primary)' }}></span>
                </div>
              )}
              {qrDataUrl ? (
                <img 
                  src={qrDataUrl} 
                  alt={`QR Code for ${activeLink}`}
                  className="qr-preview-image"
                  style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)' }}
                />
              ) : (
                <div className="qr-preview-fallback">
                  <QrCode size={48} className="text-muted" />
                  <span>Loading Preview...</span>
                </div>
              )}
            </div>

            <div className="qr-action-buttons">
              <button 
                type="button" 
                onClick={handleRegenerate}
                className="btn btn-secondary"
                disabled={generating}
                style={{ flexGrow: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <RefreshCw size={15} className={`mr-2 ${isRotating ? 'anim-rotate' : ''}`} style={{ marginRight: '6px' }} />
                Regenerate QR
              </button>

              <button 
                type="button" 
                onClick={handleDownload}
                className="btn btn-primary"
                disabled={!qrDataUrl || generating}
                style={{ flexGrow: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <Download size={15} style={{ marginRight: '6px' }} />
                Download PNG
              </button>
            </div>
            
            <p className="qr-preview-tip">
              * The standard QR contains click-tracking capabilities. High recovery levels (Q/H) allow the QR code to function even if partly damaged or dirty.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
