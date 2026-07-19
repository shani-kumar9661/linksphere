import React from 'react';
import { Link, BarChart2 } from 'lucide-react';

export default function StatsSummary({ urls = [] }) {
  const totalLinks = urls.length;
  const totalClicks = urls.reduce((sum, url) => sum + (url.clicks || 0), 0);

  return (
    <div className="metrics-grid">
      <div className="glass-panel metric-card">
        <div className="metric-icon">
          <Link size={24} />
        </div>
        <div className="metric-info">
          <span className="metric-label">Total Links</span>
          <span className="metric-value">{totalLinks}</span>
        </div>
      </div>
      
      <div className="glass-panel metric-card">
        <div className="metric-icon">
          <BarChart2 size={24} />
        </div>
        <div className="metric-info">
          <span className="metric-label">Total Click Traffic</span>
          <span className="metric-value">{totalClicks}</span>
        </div>
      </div>
    </div>
  );
}
