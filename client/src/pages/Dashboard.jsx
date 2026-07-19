import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import StatsSummary from '../components/StatsSummary';
import UrlForm from '../components/UrlForm';
import UrlList from '../components/UrlList';
import AnalyticsDashboard from '../components/AnalyticsDashboard';
import AdminPanel from '../components/AdminPanel';

export default function Dashboard() {
  const [urls, setUrls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('links');
  const navigate = useNavigate();

  const fetchUser = async () => {
    const token = localStorage.getItem('accessToken');
    if (!token) return;

    try {
      const response = await fetch('/api/v1/auth/me', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const json = await response.json();
        setUser(json.data.user);
        localStorage.setItem('username', json.data.user.username);
      }
    } catch (err) {
      console.error('Error fetching user profile:', err);
    }
  };

  const fetchUrls = async () => {
    setError('');
    const token = localStorage.getItem('accessToken');
    
    if (!token) {
      navigate('/login');
      return;
    }

    try {
      const response = await fetch('/api/v1/urls', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const json = await response.json();

      if (response.status === 401) {
        // Token expired or invalid, clear and redirect to login
        localStorage.removeItem('accessToken');
        localStorage.removeItem('username');
        navigate('/login');
        return;
      }

      if (!response.ok) {
        throw new Error(json.message || 'Failed to fetch links');
      }

      setUrls(json.data.urls || []);
      window.dispatchEvent(new Event('refreshNotifications'));
    } catch (err) {
      setError(err.message || 'Error communicating with backend server.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUser();
    fetchUrls();
  }, []);

  const handleLogout = () => {
    setUrls([]);
    setUser(null);
  };

  return (
    <div className="dashboard-layout">
      <Navbar user={user} onProfileUpdate={setUser} onLogout={handleLogout} />
      
      <main className="dashboard-main">
        {error && <div className="alert alert-danger">{error}</div>}
        
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '60px' }}>
            <span className="spinner" style={{ width: '40px', height: '40px', borderLeftColor: 'var(--color-primary)' }}></span>
            <span style={{ marginLeft: '12px', fontSize: '1.1rem', color: 'var(--text-muted)' }}>Loading Dashboard...</span>
          </div>
        ) : (
          <>
            {/* Glassmorphic Tab Selector */}
            <div 
              className="glass-panel" 
              style={{ 
                display: 'flex', 
                gap: '8px', 
                marginBottom: '28px', 
                padding: '6px', 
                borderRadius: 'var(--radius-md)',
                maxWidth: user?.role === 'admin' ? '500px' : '360px'
              }}
            >
              <button 
                onClick={() => setActiveTab('links')}
                style={{
                  flex: 1,
                  background: activeTab === 'links' ? 'linear-gradient(135deg, var(--color-primary) 0%, #312e81 100%)' : 'none',
                  border: 'none',
                  color: activeTab === 'links' ? '#ffffff' : 'var(--text-muted)',
                  fontSize: '0.95rem',
                  fontWeight: '600',
                  padding: '10px 16px',
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer',
                  transition: 'all var(--transition-fast)',
                  boxShadow: activeTab === 'links' ? 'var(--shadow-sm)' : 'none'
                }}
              >
                My Links
              </button>
              <button 
                onClick={() => setActiveTab('analytics')}
                style={{
                  flex: 1,
                  background: activeTab === 'analytics' ? 'linear-gradient(135deg, var(--color-primary) 0%, #312e81 100%)' : 'none',
                  border: 'none',
                  color: activeTab === 'analytics' ? '#ffffff' : 'var(--text-muted)',
                  fontSize: '0.95rem',
                  fontWeight: '600',
                  padding: '10px 16px',
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer',
                  transition: 'all var(--transition-fast)',
                  boxShadow: activeTab === 'analytics' ? 'var(--shadow-sm)' : 'none'
                }}
              >
                Analytics
              </button>
              {user?.role === 'admin' && (
                <button 
                  onClick={() => setActiveTab('admin')}
                  style={{
                    flex: 1,
                    background: activeTab === 'admin' ? 'linear-gradient(135deg, var(--color-primary) 0%, #312e81 100%)' : 'none',
                    border: 'none',
                    color: activeTab === 'admin' ? '#ffffff' : 'var(--text-muted)',
                    fontSize: '0.95rem',
                    fontWeight: '600',
                    padding: '10px 16px',
                    borderRadius: 'var(--radius-sm)',
                    cursor: 'pointer',
                    transition: 'all var(--transition-fast)',
                    boxShadow: activeTab === 'admin' ? 'var(--shadow-sm)' : 'none'
                  }}
                >
                  Admin Panel
                </button>
              )}
            </div>

            {/* Tab content rendering */}
            {activeTab === 'links' ? (
              <>
                <StatsSummary urls={urls} />
                <UrlForm onUrlCreated={fetchUrls} />
                <UrlList urls={urls} onUrlDeleted={fetchUrls} onRefresh={fetchUrls} />
              </>
            ) : activeTab === 'analytics' ? (
              <AnalyticsDashboard />
            ) : (
              <AdminPanel />
            )}
          </>
        )}
      </main>
    </div>
  );
}
