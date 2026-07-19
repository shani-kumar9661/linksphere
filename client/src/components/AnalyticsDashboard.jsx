import React, { useState, useEffect } from 'react';
import { getShortBaseUrl } from '../utils/urlHelper';
import { BarChart2, Calendar, Globe, Laptop, RefreshCw, Star, TrendingUp, Compass, ArrowUpRight } from 'lucide-react';

export default function AnalyticsDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchAnalytics = async () => {
    setLoading(true);
    setError('');
    const token = localStorage.getItem('accessToken');
    
    if (!token) {
      setError('Authentication token not found. Please log in.');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/v1/analytics/dashboard', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const json = await response.json();

      if (!response.ok) {
        throw new Error(json.message || 'Failed to fetch analytics data');
      }

      setData(json.data);
    } catch (err) {
      setError(err.message || 'Error communicating with backend server.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '100px 0' }}>
        <span className="spinner" style={{ width: '48px', height: '48px', borderLeftColor: 'var(--color-primary)' }}></span>
        <span style={{ marginTop: '16px', fontSize: '1.1rem', color: 'var(--text-muted)' }}>Analyzing redirection logs...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
        <div style={{ color: 'var(--color-danger)', fontSize: '1.2rem', fontWeight: '600', marginBottom: '12px' }}>
          Unable to Load Analytics
        </div>
        <div style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>{error}</div>
        <button onClick={fetchAnalytics} className="btn btn-secondary" style={{ display: 'inline-flex', gap: '8px' }}>
          <RefreshCw size={16} /> Retry
        </button>
      </div>
    );
  }

  if (!data || !data.stats) {
    return (
      <div className="glass-panel" style={{ padding: '60px', textAlign: 'center' }}>
        <h3 style={{ marginBottom: '12px' }}>No analytics data found</h3>
        <p style={{ color: 'var(--text-muted)' }}>Try creating a short link and visiting it to generate stats.</p>
      </div>
    );
  }

  const { stats, breakdowns, chartData } = data;
  const hasClicks = stats.totalClicks > 0;

  // Simple Helper to calculate percentages for progress bars
  const renderProgressBar = (count, total) => {
    const percentage = total > 0 ? Math.round((count / total) * 100) : 0;
    return (
      <div className="progress-bar-container" style={{ width: '100%', height: '8px', backgroundColor: 'rgba(255, 255, 255, 0.05)', borderRadius: '4px', overflow: 'hidden', marginTop: '6px' }}>
        <div 
          className="progress-bar-fill" 
          style={{ 
            width: `${percentage}%`, 
            height: '100%', 
            background: 'linear-gradient(90deg, var(--color-primary) 0%, var(--color-secondary) 100%)',
            borderRadius: '4px',
            transition: 'width 0.8s cubic-bezier(0.4, 0, 0.2, 1)'
          }}
        ></div>
      </div>
    );
  };

  // Find max count for SVG scaling
  const maxDayCount = chartData ? Math.max(...chartData.map(d => d.count), 1) : 1;

  return (
    <div className="analytics-dashboard" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Header section with refresh button */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '1.8rem', fontWeight: '700' }}>Link Performance Analytics</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '4px' }}>
            Real-time insights across your shortened URLs.
          </p>
        </div>
        <button onClick={fetchAnalytics} className="btn btn-secondary btn-icon" title="Refresh stats">
          <RefreshCw size={16} />
        </button>
      </div>

      {/* Stats Summary Cards */}
      <div className="metrics-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        
        <div className="glass-panel metric-card" style={{ display: 'flex', padding: '20px', gap: '16px', alignItems: 'center' }}>
          <div className="metric-icon" style={{ backgroundColor: 'rgba(79, 70, 229, 0.1)', color: 'var(--color-primary)', width: '48px', height: '48px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <TrendingUp size={24} />
          </div>
          <div className="metric-info">
            <span className="metric-label" style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'block' }}>Total Redirects</span>
            <span className="metric-value" style={{ fontSize: '1.8rem', fontWeight: '700', color: '#ffffff' }}>{stats.totalClicks}</span>
          </div>
        </div>

        <div className="glass-panel metric-card" style={{ display: 'flex', padding: '20px', gap: '16px', alignItems: 'center' }}>
          <div className="metric-icon" style={{ backgroundColor: 'rgba(6, 182, 212, 0.1)', color: 'var(--color-secondary)', width: '48px', height: '48px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Calendar size={24} />
          </div>
          <div className="metric-info">
            <span className="metric-label" style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'block' }}>Today's Traffic</span>
            <span className="metric-value" style={{ fontSize: '1.8rem', fontWeight: '700', color: '#ffffff' }}>{stats.todayClicks}</span>
          </div>
        </div>

        <div className="glass-panel metric-card" style={{ display: 'flex', padding: '20px', gap: '16px', alignItems: 'center' }}>
          <div className="metric-icon" style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', color: 'var(--color-success)', width: '48px', height: '48px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <BarChart2 size={24} />
          </div>
          <div className="metric-info">
            <span className="metric-label" style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'block' }}>Weekly Clicks</span>
            <span className="metric-value" style={{ fontSize: '1.8rem', fontWeight: '700', color: '#ffffff' }}>{stats.weeklyClicks}</span>
          </div>
        </div>

        <div className="glass-panel metric-card" style={{ display: 'flex', padding: '20px', gap: '16px', alignItems: 'center' }}>
          <div className="metric-icon" style={{ backgroundColor: 'rgba(245, 158, 11, 0.1)', color: 'var(--color-warning)', width: '48px', height: '48px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Calendar size={24} />
          </div>
          <div className="metric-info">
            <span className="metric-label" style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'block' }}>Monthly Clicks</span>
            <span className="metric-value" style={{ fontSize: '1.8rem', fontWeight: '700', color: '#ffffff' }}>{stats.monthlyClicks}</span>
          </div>
        </div>

      </div>

      {/* Most Popular URL Card */}
      {stats.mostPopularUrl ? (
        <div className="glass-panel" style={{ padding: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
            <div style={{ backgroundColor: 'rgba(245, 158, 11, 0.1)', color: 'var(--color-warning)', width: '48px', height: '48px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Star size={24} />
            </div>
            <div>
              <span style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: 'var(--color-warning)', fontWeight: '700', display: 'block', letterSpacing: '0.05em' }}>Most Popular URL</span>
              <h3 style={{ fontSize: '1.2rem', margin: '4px 0 2px 0' }}>{stats.mostPopularUrl.title}</h3>
              <a 
                href={`${getShortBaseUrl()}/${stats.mostPopularUrl.shortCode}`} 
                target="_blank" 
                rel="noopener noreferrer" 
                style={{ color: 'var(--color-secondary)', fontSize: '0.9rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
              >
                {stats.mostPopularUrl.shortCode} <ArrowUpRight size={14} />
              </a>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span style={{ display: 'block', color: 'var(--text-muted)', fontSize: '0.85rem' }}>Popularity Peak</span>
            <span style={{ fontSize: '1.8rem', fontWeight: '700', color: '#ffffff' }}>{stats.mostPopularUrl.clicks} Clicks</span>
          </div>
        </div>
      ) : (
        <div className="glass-panel" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
          No "Most Popular Link" identified yet. Visit a short URL to log traffic.
        </div>
      )}

      {/* Click Traffic SVG Chart & Breakdowns */}
      {hasClicks ? (
        <>
          {/* Daily Activity Chart */}
          <div className="glass-panel" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <TrendingUp size={18} /> Daily Click Traffic (Last 7 Days)
            </h3>
            
            {/* SVG Visualizer */}
            <div style={{ width: '100%', height: '180px', position: 'relative', marginTop: '10px' }}>
              <svg viewBox="0 0 700 180" width="100%" height="100%" preserveAspectRatio="none">
                {/* Horizontal grid lines */}
                <line x1="40" y1="20" x2="680" y2="20" stroke="rgba(255, 255, 255, 0.05)" strokeWidth="1" />
                <line x1="40" y1="75" x2="680" y2="75" stroke="rgba(255, 255, 255, 0.05)" strokeWidth="1" />
                <line x1="40" y1="130" x2="680" y2="130" stroke="rgba(255, 255, 255, 0.05)" strokeWidth="1" />
                <line x1="40" y1="150" x2="680" y2="150" stroke="rgba(255, 255, 255, 0.1)" strokeWidth="1" />

                {/* Bars for data points */}
                {chartData.map((day, idx) => {
                  const x = 70 + idx * 95;
                  const barHeight = (day.count / maxDayCount) * 110; // scale max height to 110px
                  const y = 150 - barHeight;
                  
                  return (
                    <g key={day.date}>
                      {/* Interactive Bar */}
                      <rect 
                        x={x - 15}
                        y={y}
                        width="30"
                        height={barHeight}
                        fill="url(#chartGrad)"
                        rx="4"
                        style={{ transition: 'all 0.5s ease' }}
                      />
                      
                      {/* Bar Count Tag */}
                      {day.count > 0 && (
                        <text 
                          x={x}
                          y={y - 8}
                          fill="#ffffff"
                          fontSize="11"
                          fontWeight="600"
                          textAnchor="middle"
                        >
                          {day.count}
                        </text>
                      )}
                      
                      {/* Date Label */}
                      <text 
                        x={x}
                        y="170"
                        fill="var(--text-muted)"
                        fontSize="11"
                        textAnchor="middle"
                      >
                        {day.formattedDate}
                      </text>
                    </g>
                  );
                })}

                {/* Gradients */}
                <defs>
                  <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-secondary)" />
                    <stop offset="100%" stopColor="var(--color-primary)" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
          </div>

          {/* Breakdown Grids */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
            
            {/* Countries and Locations */}
            <div className="glass-panel" style={{ padding: '24px' }}>
              <h3 style={{ fontSize: '1.1rem', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
                <Globe size={18} /> Top Locations
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {breakdowns.countries.length > 0 ? (
                  breakdowns.countries.map(item => (
                    <div key={item._id}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                        <span style={{ fontWeight: '500' }}>{item._id || 'Unknown'}</span>
                        <span style={{ color: 'var(--text-muted)' }}>{item.count} clicks ({Math.round((item.count / stats.totalClicks) * 100)}%)</span>
                      </div>
                      {renderProgressBar(item.count, stats.totalClicks)}
                    </div>
                  ))
                ) : (
                  <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '20px 0' }}>No location data logged.</div>
                )}
              </div>
            </div>

            {/* Referrers */}
            <div className="glass-panel" style={{ padding: '24px' }}>
              <h3 style={{ fontSize: '1.1rem', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
                <Compass size={18} /> Referrers / Traffic Source
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {breakdowns.referrers.length > 0 ? (
                  breakdowns.referrers.map(item => (
                    <div key={item._id}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                        <span style={{ fontWeight: '500', wordBreak: 'break-all' }}>{item._id || 'Direct'}</span>
                        <span style={{ color: 'var(--text-muted)' }}>{item.count} clicks ({Math.round((item.count / stats.totalClicks) * 100)}%)</span>
                      </div>
                      {renderProgressBar(item.count, stats.totalClicks)}
                    </div>
                  ))
                ) : (
                  <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '20px 0' }}>No referrer data logged.</div>
                )}
              </div>
            </div>

            {/* Browsers */}
            <div className="glass-panel" style={{ padding: '24px' }}>
              <h3 style={{ fontSize: '1.1rem', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
                <Compass size={18} /> Top Browsers
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {breakdowns.browsers.length > 0 ? (
                  breakdowns.browsers.map(item => (
                    <div key={item._id}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                        <span style={{ fontWeight: '500' }}>{item._id || 'Unknown'}</span>
                        <span style={{ color: 'var(--text-muted)' }}>{item.count} clicks ({Math.round((item.count / stats.totalClicks) * 100)}%)</span>
                      </div>
                      {renderProgressBar(item.count, stats.totalClicks)}
                    </div>
                  ))
                ) : (
                  <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '20px 0' }}>No browser data logged.</div>
                )}
              </div>
            </div>

            {/* Devices & OS */}
            <div className="glass-panel" style={{ padding: '24px' }}>
              <h3 style={{ fontSize: '1.1rem', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
                <Laptop size={18} /> Device Types & OS
              </h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {/* Devices sub-breakdown */}
                <div>
                  <span style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: '700', letterSpacing: '0.05em', display: 'block', marginBottom: '10px' }}>Device Profile</span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {breakdowns.devices.length > 0 ? (
                      breakdowns.devices.map(item => (
                        <div key={item._id}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                            <span>{item._id || 'Desktop'}</span>
                            <span style={{ color: 'var(--text-muted)' }}>{item.count} ({Math.round((item.count / stats.totalClicks) * 100)}%)</span>
                          </div>
                          {renderProgressBar(item.count, stats.totalClicks)}
                        </div>
                      ))
                    ) : (
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No devices logged.</div>
                    )}
                  </div>
                </div>

                {/* OS sub-breakdown */}
                <div>
                  <span style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: '700', letterSpacing: '0.05em', display: 'block', marginBottom: '10px' }}>Operating System</span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {breakdowns.operatingSystems.length > 0 ? (
                      breakdowns.operatingSystems.map(item => (
                        <div key={item._id}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                            <span>{item._id || 'Unknown'}</span>
                            <span style={{ color: 'var(--text-muted)' }}>{item.count} ({Math.round((item.count / stats.totalClicks) * 100)}%)</span>
                          </div>
                          {renderProgressBar(item.count, stats.totalClicks)}
                        </div>
                      ))
                    ) : (
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No Operating Systems logged.</div>
                    )}
                  </div>
                </div>
              </div>
            </div>

          </div>
        </>
      ) : (
        <div className="glass-panel" style={{ padding: '60px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ backgroundColor: 'rgba(79, 70, 229, 0.05)', color: 'var(--color-primary)', width: '64px', height: '64px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>
            <BarChart2 size={32} />
          </div>
          <h3 style={{ fontSize: '1.25rem', marginBottom: '8px' }}>No visitor traffic recorded yet</h3>
          <p style={{ color: 'var(--text-muted)', maxWidth: '400px', fontSize: '0.9rem', lineHeight: '1.6' }}>
            Your short links are ready! Share them on forums, emails, or social media. Once a link is clicked, visitor demographics, referral logs, and analytics will instantly display here.
          </p>
        </div>
      )}

    </div>
  );
}
