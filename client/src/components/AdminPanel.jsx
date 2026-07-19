import React, { useState, useEffect, useCallback } from 'react';
import { getShortBaseUrl } from '../utils/urlHelper';
import { 
  Users, 
  Link2, 
  TrendingUp, 
  UserCheck, 
  Trash2, 
  ShieldAlert, 
  Search, 
  RefreshCw, 
  ArrowUpRight, 
  Lock, 
  Unlock,
  AlertTriangle,
  Activity,
  Server,
  CheckCircle,
  XCircle,
  Cpu
} from 'lucide-react';

export default function AdminPanel() {
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [urls, setUrls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Tab/Search States
  const [subTab, setSubTab] = useState('users'); // 'users', 'urls', 'health', 'requestLogs', 'errorLogs'
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modal Confirm State
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    type: '', // 'user' or 'url'
    id: '',
    name: ''
  });
  const [actionLoading, setActionLoading] = useState(false);

  // Health & Logs States
  const [health, setHealth] = useState(null);
  const [requestLogs, setRequestLogs] = useState([]);
  const [errorLogs, setErrorLogs] = useState([]);
  const [healthLoading, setHealthLoading] = useState(false);
  const [logsLoading, setLogsLoading] = useState(false);
  const [expandedErrors, setExpandedErrors] = useState({});
  const [logLimit, setLogLimit] = useState(100);

  const fetchHealthData = useCallback(async (silent = false) => {
    if (!silent) setHealthLoading(true);
    try {
      const response = await fetch('/health');
      const data = await response.json();
      setHealth(data);
    } catch (err) {
      console.error('Failed to fetch health data:', err);
    } finally {
      if (!silent) setHealthLoading(false);
    }
  }, []);

  const fetchLogsData = useCallback(async () => {
    setLogsLoading(true);
    setError('');
    const token = localStorage.getItem('accessToken');
    if (!token) {
      setError('Authentication token not found. Please log in.');
      setLogsLoading(false);
      return;
    }
    try {
      const headers = { 'Authorization': `Bearer ${token}` };
      const [reqLogsRes, errLogsRes] = await Promise.all([
        fetch(`/api/v1/admin/logs/requests?limit=${logLimit}`, { headers }),
        fetch(`/api/v1/admin/logs/errors?limit=${logLimit}`, { headers })
      ]);

      const reqLogsJson = await reqLogsRes.json();
      const errLogsJson = await errLogsRes.json();

      if (!reqLogsRes.ok) throw new Error(reqLogsJson.message || 'Failed to fetch request logs');
      if (!errLogsRes.ok) throw new Error(errLogsJson.message || 'Failed to fetch error logs');

      setRequestLogs(reqLogsJson.data.logs || []);
      setErrorLogs(errLogsJson.data.logs || []);
    } catch (err) {
      setError(err.message || 'An error occurred while loading logs.');
    } finally {
      setLogsLoading(false);
    }
  }, [logLimit]);

  // Sync health checks and logs fetching with tab transitions
  useEffect(() => {
    if (subTab === 'health') {
      fetchHealthData();
      const interval = setInterval(() => {
        fetchHealthData(true);
      }, 10000); // 10s auto-refresh for health metrics
      return () => clearInterval(interval);
    }
  }, [subTab, fetchHealthData]);

  useEffect(() => {
    if (subTab === 'requestLogs' || subTab === 'errorLogs') {
      fetchLogsData();
    }
  }, [subTab, fetchLogsData]);

  const fetchAdminData = async () => {
    setLoading(true);
    setError('');
    const token = localStorage.getItem('accessToken');
    
    if (!token) {
      setError('Authentication token not found. Please log in.');
      setLoading(false);
      return;
    }

    try {
      const headers = { 'Authorization': `Bearer ${token}` };
      
      const [statsRes, usersRes, urlsRes] = await Promise.all([
        fetch('/api/v1/admin/stats', { headers }),
        fetch('/api/v1/admin/users', { headers }),
        fetch('/api/v1/admin/urls', { headers })
      ]);

      const statsJson = await statsRes.json();
      const usersJson = await usersRes.json();
      const urlsJson = await urlsRes.json();

      if (!statsRes.ok) throw new Error(statsJson.message || 'Failed to fetch admin stats');
      if (!usersRes.ok) throw new Error(usersJson.message || 'Failed to fetch users');
      if (!urlsRes.ok) throw new Error(urlsJson.message || 'Failed to fetch urls');

      setStats(statsJson.data.stats);
      setUsers(usersJson.data.users || []);
      setUrls(urlsJson.data.urls || []);
    } catch (err) {
      setError(err.message || 'An error occurred while loading admin dashboard.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
  }, []);

  const handleToggleDisable = async (userId) => {
    setError('');
    const token = localStorage.getItem('accessToken');
    if (!token) return;

    try {
      const response = await fetch(`/api/v1/admin/users/${userId}/toggle-disable`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const json = await response.json();
      if (!response.ok) {
        throw new Error(json.message || 'Failed to toggle user status');
      }

      // Update local state
      setUsers(users.map(u => u._id === userId ? { ...u, isDisabled: json.data.user.isDisabled } : u));
      
      // Re-fetch stats to update active users count
      const statsRes = await fetch('/api/v1/admin/stats', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const statsJson = await statsRes.json();
      if (statsRes.ok) {
        setStats(statsJson.data.stats);
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const openConfirmModal = (type, id, name) => {
    setConfirmModal({
      isOpen: true,
      type,
      id,
      name
    });
  };

  const closeConfirmModal = () => {
    setConfirmModal({
      isOpen: false,
      type: '',
      id: '',
      name: ''
    });
  };

  const handleConfirmDelete = async () => {
    setActionLoading(true);
    const token = localStorage.getItem('accessToken');
    const { type, id } = confirmModal;

    try {
      const response = await fetch(`/api/v1/admin/${type === 'user' ? 'users' : 'urls'}/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const json = await response.json();
      if (!response.ok) {
        throw new Error(json.message || `Failed to delete ${type}`);
      }

      // Update local state
      if (type === 'user') {
        setUsers(users.filter(u => u._id !== id));
      } else {
        setUrls(urls.filter(u => u._id !== id));
      }

      // Refresh stats
      const statsRes = await fetch('/api/v1/admin/stats', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const statsJson = await statsRes.json();
      if (statsRes.ok) {
        setStats(statsJson.data.stats);
      }

      closeConfirmModal();
    } catch (err) {
      setError(err.message);
      closeConfirmModal();
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '100px 0' }}>
        <span className="spinner" style={{ width: '48px', height: '48px', borderLeftColor: 'var(--color-primary)' }}></span>
        <span style={{ marginTop: '16px', fontSize: '1.1rem', color: 'var(--text-muted)' }}>Loading Admin Portal...</span>
      </div>
    );
  }

  // Filtered lists based on search query
  const filteredUsers = users.filter(user => 
    user.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredUrls = urls.filter(url => 
    url.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    url.shortCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
    url.originalUrl.toLowerCase().includes(searchQuery.toLowerCase()) ||
    url.createdBy?.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    url.createdBy?.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="admin-panel" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Header section */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '1.8rem', fontWeight: '700' }}>Platform Administration</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '4px' }}>
            Manage platform users, monitor short link traffic, and oversee system records.
          </p>
        </div>
        <button onClick={fetchAdminData} className="btn btn-secondary btn-icon" title="Refresh Admin Data">
          <RefreshCw size={16} />
        </button>
      </div>

      {error && (
        <div className="alert alert-danger" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <ShieldAlert size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* Stats Summary Row */}
      {stats && (
        <div className="metrics-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
          
          <div className="glass-panel metric-card" style={{ display: 'flex', padding: '20px', gap: '16px', alignItems: 'center', borderLeft: '3px solid var(--color-primary)' }}>
            <div className="metric-icon" style={{ backgroundColor: 'rgba(79, 70, 229, 0.1)', color: 'var(--color-primary)', width: '48px', height: '48px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Users size={24} />
            </div>
            <div className="metric-info">
              <span className="metric-label" style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'block' }}>Total Users</span>
              <span className="metric-value" style={{ fontSize: '1.8rem', fontWeight: '700', color: '#ffffff' }}>{stats.totalUsers}</span>
            </div>
          </div>

          <div className="glass-panel metric-card" style={{ display: 'flex', padding: '20px', gap: '16px', alignItems: 'center', borderLeft: '3px solid var(--color-secondary)' }}>
            <div className="metric-icon" style={{ backgroundColor: 'rgba(6, 182, 212, 0.1)', color: 'var(--color-secondary)', width: '48px', height: '48px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Link2 size={24} />
            </div>
            <div className="metric-info">
              <span className="metric-label" style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'block' }}>Total URLs</span>
              <span className="metric-value" style={{ fontSize: '1.8rem', fontWeight: '700', color: '#ffffff' }}>{stats.totalUrls}</span>
            </div>
          </div>

          <div className="glass-panel metric-card" style={{ display: 'flex', padding: '20px', gap: '16px', alignItems: 'center', borderLeft: '3px solid var(--color-success)' }}>
            <div className="metric-icon" style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', color: 'var(--color-success)', width: '48px', height: '48px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <TrendingUp size={24} />
            </div>
            <div className="metric-info">
              <span className="metric-label" style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'block' }}>Total Clicks</span>
              <span className="metric-value" style={{ fontSize: '1.8rem', fontWeight: '700', color: '#ffffff' }}>{stats.totalClicks}</span>
            </div>
          </div>

          <div className="glass-panel metric-card" style={{ display: 'flex', padding: '20px', gap: '16px', alignItems: 'center', borderLeft: '3px solid var(--color-warning)' }}>
            <div className="metric-icon" style={{ backgroundColor: 'rgba(245, 158, 11, 0.1)', color: 'var(--color-warning)', width: '48px', height: '48px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <UserCheck size={24} />
            </div>
            <div className="metric-info">
              <span className="metric-label" style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'block' }}>Active Users</span>
              <span className="metric-value" style={{ fontSize: '1.8rem', fontWeight: '700', color: '#ffffff' }}>{stats.activeUsers}</span>
            </div>
          </div>

        </div>
      )}

      {/* Main Content Area */}
      <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        
        {/* Navigation & Search Controls */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          
          {/* Subtabs */}
          <div style={{ display: 'flex', gap: '8px', backgroundColor: 'rgba(255, 255, 255, 0.05)', padding: '4px', borderRadius: 'var(--radius-md)', flexWrap: 'wrap' }}>
            <button 
              onClick={() => { setSubTab('users'); setSearchQuery(''); }}
              style={{
                background: subTab === 'users' ? 'var(--color-primary)' : 'none',
                border: 'none',
                color: '#ffffff',
                fontSize: '0.9rem',
                fontWeight: '600',
                padding: '8px 16px',
                borderRadius: 'var(--radius-sm)',
                cursor: 'pointer',
                transition: 'all var(--transition-fast)'
              }}
            >
              Users ({users.length})
            </button>
            <button 
              onClick={() => { setSubTab('urls'); setSearchQuery(''); }}
              style={{
                background: subTab === 'urls' ? 'var(--color-primary)' : 'none',
                border: 'none',
                color: '#ffffff',
                fontSize: '0.9rem',
                fontWeight: '600',
                padding: '8px 16px',
                borderRadius: 'var(--radius-sm)',
                cursor: 'pointer',
                transition: 'all var(--transition-fast)'
              }}
            >
              URLs ({urls.length})
            </button>
            <button 
              onClick={() => { setSubTab('health'); setSearchQuery(''); }}
              style={{
                background: subTab === 'health' ? 'var(--color-primary)' : 'none',
                border: 'none',
                color: '#ffffff',
                fontSize: '0.9rem',
                fontWeight: '600',
                padding: '8px 16px',
                borderRadius: 'var(--radius-sm)',
                cursor: 'pointer',
                transition: 'all var(--transition-fast)'
              }}
            >
              Server Health
            </button>
            <button 
              onClick={() => { setSubTab('requestLogs'); setSearchQuery(''); }}
              style={{
                background: subTab === 'requestLogs' ? 'var(--color-primary)' : 'none',
                border: 'none',
                color: '#ffffff',
                fontSize: '0.9rem',
                fontWeight: '600',
                padding: '8px 16px',
                borderRadius: 'var(--radius-sm)',
                cursor: 'pointer',
                transition: 'all var(--transition-fast)'
              }}
            >
              Request Logs
            </button>
            <button 
              onClick={() => { setSubTab('errorLogs'); setSearchQuery(''); }}
              style={{
                background: subTab === 'errorLogs' ? 'var(--color-primary)' : 'none',
                border: 'none',
                color: '#ffffff',
                fontSize: '0.9rem',
                fontWeight: '600',
                padding: '8px 16px',
                borderRadius: 'var(--radius-sm)',
                cursor: 'pointer',
                transition: 'all var(--transition-fast)'
              }}
            >
              Error Logs
            </button>
          </div>

          {/* Search bar */}
          {subTab !== 'health' && (
            <div style={{ position: 'relative', minWidth: '260px' }}>
              <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>
                <Search size={16} />
              </span>
              <input 
                type="text" 
                placeholder={
                  subTab === 'users' 
                    ? "Search users by username/email..." 
                    : subTab === 'urls'
                    ? "Search urls by title/short code/creator..."
                    : subTab === 'requestLogs'
                    ? "Search request logs..."
                    : subTab === 'errorLogs'
                    ? "Search error logs..."
                    : ""
                } 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="form-control"
                style={{ paddingLeft: '38px', margin: 0, width: '100%' }}
              />
            </div>
          )}

        </div>

        {/* Tab content rendering */}
        {subTab === 'users' ? (
          /* Users list */
          <div style={{ overflowX: 'auto', borderRadius: 'var(--radius-md)' }}>
            {filteredUsers.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
                No users found.
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '700px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.1)', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    <th style={{ padding: '12px 16px' }}>User Details</th>
                    <th style={{ padding: '12px 16px' }}>Joined Date</th>
                    <th style={{ padding: '12px 16px' }}>Role</th>
                    <th style={{ padding: '12px 16px' }}>Status</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map(user => (
                    <tr 
                      key={user._id} 
                      style={{ 
                        borderBottom: '1px solid rgba(255, 255, 255, 0.05)', 
                        transition: 'background 0.2s',
                        background: user.isDisabled ? 'rgba(239, 68, 68, 0.03)' : 'none'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.02)'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = user.isDisabled ? 'rgba(239, 68, 68, 0.03)' : 'none'}
                    >
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div style={{ width: '38px', height: '38px', borderRadius: '50%', backgroundColor: 'rgba(255, 255, 255, 0.1)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {user.profilePicture ? (
                              <img src={user.profilePicture} alt={user.username} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                              <Users size={18} style={{ color: 'var(--text-muted)' }} />
                            )}
                          </div>
                          <div>
                            <span style={{ fontWeight: '600', color: '#ffffff', display: 'block' }}>{user.username}</span>
                            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{user.email}</span>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '14px 16px', fontSize: '0.9rem' }}>
                        {new Date(user.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        <span 
                          style={{ 
                            fontSize: '0.75rem', 
                            fontWeight: '700', 
                            textTransform: 'uppercase',
                            padding: '3px 8px',
                            borderRadius: '4px',
                            backgroundColor: user.role === 'admin' ? 'rgba(79, 70, 229, 0.2)' : 'rgba(255, 255, 255, 0.07)',
                            color: user.role === 'admin' ? 'var(--color-primary)' : 'var(--text-muted)'
                          }}
                        >
                          {user.role}
                        </span>
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        <span 
                          style={{ 
                            fontSize: '0.75rem', 
                            fontWeight: '600',
                            padding: '3px 8px',
                            borderRadius: '12px',
                            backgroundColor: user.isDisabled ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                            color: user.isDisabled ? 'var(--color-danger)' : 'var(--color-success)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: user.isDisabled ? 'var(--color-danger)' : 'var(--color-success)' }}></span>
                          {user.isDisabled ? 'Disabled' : 'Active'}
                        </span>
                      </td>
                      <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '8px' }}>
                          <button 
                            onClick={() => handleToggleDisable(user._id)}
                            className="btn btn-secondary btn-icon"
                            style={{ 
                              height: '32px', 
                              width: '32px',
                              padding: 0,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: user.isDisabled ? 'var(--color-success)' : 'var(--color-warning)'
                            }}
                            title={user.isDisabled ? "Enable account" : "Disable account"}
                          >
                            {user.isDisabled ? <Unlock size={14} /> : <Lock size={14} />}
                          </button>
                          <button 
                            onClick={() => openConfirmModal('user', user._id, user.username)}
                            className="btn btn-secondary btn-icon"
                            style={{ 
                              height: '32px', 
                              width: '32px',
                              padding: 0,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: 'var(--color-danger)'
                            }}
                            title="Delete user profile"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ) : subTab === 'urls' ? (
          /* URLs list */
          <div style={{ overflowX: 'auto', borderRadius: 'var(--radius-md)' }}>
            {filteredUrls.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
                No shortened links found.
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '800px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.1)', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    <th style={{ padding: '12px 16px' }}>Link details</th>
                    <th style={{ padding: '12px 16px' }}>Short Link</th>
                    <th style={{ padding: '12px 16px' }}>Created By</th>
                    <th style={{ padding: '12px 16px' }}>Clicks</th>
                    <th style={{ padding: '12px 16px' }}>Created Date</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUrls.map(url => (
                    <tr 
                      key={url._id} 
                      style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)', transition: 'background 0.2s' }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.02)'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'none'}
                    >
                      <td style={{ padding: '14px 16px', maxWidth: '300px' }}>
                        <span style={{ fontWeight: '600', color: '#ffffff', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {url.title || 'Untitled Link'}
                        </span>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {url.originalUrl}
                        </span>
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        <a 
                          href={`${getShortBaseUrl()}/${url.shortCode}`} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          style={{ color: 'var(--color-secondary)', display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.9rem' }}
                        >
                          {url.shortCode} <ArrowUpRight size={12} />
                        </a>
                      </td>
                      <td style={{ padding: '14px 16px', fontSize: '0.85rem' }}>
                        {url.createdBy ? (
                          <>
                            <span style={{ display: 'block', color: '#ffffff' }}>{url.createdBy.username}</span>
                            <span style={{ color: 'var(--text-muted)' }}>{url.createdBy.email}</span>
                          </>
                        ) : (
                          <span style={{ color: 'var(--color-danger)' }}>Orphaned User</span>
                        )}
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        <span style={{ fontWeight: '600', color: '#ffffff' }}>{url.clicks}</span>
                      </td>
                      <td style={{ padding: '14px 16px', fontSize: '0.9rem' }}>
                        {new Date(url.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                      </td>
                      <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                        <button 
                          onClick={() => openConfirmModal('url', url._id, url.shortCode)}
                          className="btn btn-secondary btn-icon"
                          style={{ 
                            height: '32px', 
                            width: '32px',
                            padding: 0,
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'var(--color-danger)'
                          }}
                          title="Delete short link"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ) : subTab === 'health' ? (
          /* Health check panel */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {healthLoading && !health ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}>
                <span className="spinner" style={{ width: '32px', height: '32px', borderLeftColor: 'var(--color-primary)' }}></span>
              </div>
            ) : health ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {/* Status indicator bar */}
                <div 
                  className="glass-panel" 
                  style={{ 
                    padding: '16px 20px', 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center', 
                    borderLeft: health.status === 'success' ? '4px solid var(--color-success)' : '4px solid var(--color-danger)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    {health.status === 'success' ? (
                      <CheckCircle style={{ color: 'var(--color-success)' }} size={24} />
                    ) : (
                      <XCircle style={{ color: 'var(--color-danger)' }} size={24} />
                    )}
                    <div>
                      <span style={{ fontWeight: '700', fontSize: '1.1rem' }}>
                        System Status: {health.status === 'success' ? 'HEALTHY' : 'UNHEALTHY'}
                      </span>
                      <span style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        Last Diagnostic check: {new Date(health.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                  <button 
                    onClick={() => fetchHealthData(false)} 
                    className="btn btn-secondary btn-icon" 
                    style={{ padding: '8px 12px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px', height: 'auto' }}
                    disabled={healthLoading}
                  >
                    <RefreshCw size={14} className={healthLoading ? 'spin-animation' : ''} />
                    <span>Check Now</span>
                  </button>
                </div>

                {/* Services Health */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
                  {/* MongoDB */}
                  <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: '600' }}>DATABASE</span>
                      <Server size={18} style={{ color: 'var(--color-primary)' }} />
                    </div>
                    <div>
                      <h4 style={{ fontSize: '1.2rem', fontWeight: '700' }}>MongoDB</h4>
                      <span 
                        style={{ 
                          display: 'inline-flex', 
                          alignItems: 'center', 
                          gap: '6px', 
                          fontSize: '0.9rem', 
                          fontWeight: '600', 
                          color: health.database === 'connected' ? 'var(--color-success)' : 'var(--color-danger)',
                          marginTop: '4px'
                        }}
                      >
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: health.database === 'connected' ? 'var(--color-success)' : 'var(--color-danger)' }}></span>
                        {health.database.toUpperCase()}
                      </span>
                    </div>
                  </div>

                  {/* Redis */}
                  <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: '600' }}>CACHE SYSTEM</span>
                      <Cpu size={18} style={{ color: 'var(--color-secondary)' }} />
                    </div>
                    <div>
                      <h4 style={{ fontSize: '1.2rem', fontWeight: '700' }}>Redis Cache</h4>
                      <span 
                        style={{ 
                          display: 'inline-flex', 
                          alignItems: 'center', 
                          gap: '6px', 
                          fontSize: '0.9rem', 
                          fontWeight: '600', 
                          color: health.redis === 'connected' ? 'var(--color-success)' : 'var(--color-danger)',
                          marginTop: '4px'
                        }}
                      >
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: health.redis === 'connected' ? 'var(--color-success)' : 'var(--color-danger)' }}></span>
                        {health.redis.toUpperCase()}
                      </span>
                    </div>
                  </div>

                  {/* Uptime */}
                  <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: '600' }}>SERVER RUNTIME</span>
                      <Activity size={18} style={{ color: 'var(--color-warning)' }} />
                    </div>
                    <div>
                      <h4 style={{ fontSize: '1.2rem', fontWeight: '700' }}>Process Uptime</h4>
                      <span style={{ display: 'block', fontSize: '1.1rem', fontWeight: '600', color: '#ffffff', marginTop: '4px' }}>
                        {health.uptimeFormatted}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        ({health.uptime.toLocaleString()} seconds)
                      </span>
                    </div>
                  </div>
                </div>

                {/* Memory Details */}
                <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: '700', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '10px' }}>
                    Node.js Process Memory Usage
                  </h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '20px' }}>
                    <div>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block' }}>RSS (Resident Set Size)</span>
                      <span style={{ fontSize: '1.4rem', fontWeight: '700', color: '#ffffff' }}>{health.memoryUsage.rss}</span>
                    </div>
                    <div>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block' }}>Heap Total</span>
                      <span style={{ fontSize: '1.4rem', fontWeight: '700', color: '#ffffff' }}>{health.memoryUsage.heapTotal}</span>
                    </div>
                    <div>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block' }}>Heap Used</span>
                      <span style={{ fontSize: '1.4rem', fontWeight: '700', color: 'var(--color-secondary)' }}>{health.memoryUsage.heapUsed}</span>
                    </div>
                    <div>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block' }}>External Memory</span>
                      <span style={{ fontSize: '1.4rem', fontWeight: '700', color: '#ffffff' }}>{health.memoryUsage.external}</span>
                    </div>
                  </div>
                  
                  {(() => {
                    const usedVal = parseFloat(health.memoryUsage.heapUsed);
                    const totalVal = parseFloat(health.memoryUsage.heapTotal);
                    const pct = isNaN(usedVal) || isNaN(totalVal) ? 0 : Math.min(100, (usedVal / totalVal) * 100);
                    return (
                      <div style={{ marginTop: '10px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
                          <span>Heap Memory Allocation</span>
                          <span>{pct.toFixed(1)}% Used</span>
                        </div>
                        <div style={{ width: '100%', height: '8px', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
                          <div 
                            style={{ 
                              width: `${pct}%`, 
                              height: '100%', 
                              backgroundColor: pct > 85 ? 'var(--color-danger)' : pct > 60 ? 'var(--color-warning)' : 'var(--color-success)',
                              borderRadius: '4px',
                              transition: 'width 0.5s ease-out'
                            }}
                          />
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
                Failed to fetch system diagnostics. Check if the server is running.
              </div>
            )}
          </div>
        ) : subTab === 'requestLogs' ? (
          /* Request logs panel */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Log Limit:</span>
                <select 
                  value={logLimit} 
                  onChange={(e) => setLogLimit(Number(e.target.value))} 
                  className="form-control"
                  style={{ width: '100px', padding: '6px 12px', margin: 0 }}
                >
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                  <option value={200}>200</option>
                  <option value={500}>500</option>
                </select>
              </div>
              <button 
                onClick={fetchLogsData} 
                className="btn btn-secondary btn-icon" 
                style={{ padding: '8px 12px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px', height: 'auto' }}
                disabled={logsLoading}
              >
                <RefreshCw size={14} className={logsLoading ? 'spin-animation' : ''} />
                <span>Reload Logs</span>
              </button>
            </div>

            {logsLoading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}>
                <span className="spinner" style={{ width: '32px', height: '32px', borderLeftColor: 'var(--color-primary)' }}></span>
              </div>
            ) : (
              <div 
                style={{ 
                  backgroundColor: '#05070f', 
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 'var(--radius-md)', 
                  padding: '20px', 
                  fontFamily: 'Courier New, Courier, monospace', 
                  fontSize: '0.85rem', 
                  maxHeight: '500px', 
                  overflowY: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  boxShadow: 'inset 0 0 10px rgba(0,0,0,0.8)'
                }}
              >
                {(() => {
                  const filteredRequestLogs = requestLogs.filter(log => !searchQuery || log.message.toLowerCase().includes(searchQuery.toLowerCase()));

                  if (filteredRequestLogs.length === 0) {
                    return (
                      <span style={{ color: 'var(--text-muted)', textAlign: 'center', display: 'block', padding: '20px' }}>
                        No request logs found matching criteria.
                      </span>
                    );
                  }

                  return filteredRequestLogs.map((log, idx) => {
                    let msgColor = '#a8b2c1';
                    if (log.message.includes(' 20') || log.message.includes(' 30')) {
                      msgColor = '#10b981';
                    } else if (log.message.includes(' 40') || log.message.includes(' 50')) {
                      msgColor = '#ef4444';
                    } else if (log.level === 'warn') {
                      msgColor = '#f59e0b';
                    }
                    
                    return (
                      <div key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)', paddingBottom: '4px', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                        <span style={{ color: '#06b6d4', marginRight: '8px' }}>[{log.timestamp}]</span>
                        <span style={{ 
                          color: log.level === 'error' ? 'var(--color-danger)' : log.level === 'warn' ? 'var(--color-warning)' : '#4f46e5',
                          fontWeight: '700',
                          marginRight: '8px',
                          textTransform: 'uppercase'
                        }}>
                          {log.level}
                        </span>
                        <span style={{ color: msgColor }}>{log.message}</span>
                      </div>
                    );
                  });
                })()}
              </div>
            )}
          </div>
        ) : (
          /* Error logs panel */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Log Limit:</span>
                <select 
                  value={logLimit} 
                  onChange={(e) => setLogLimit(Number(e.target.value))} 
                  className="form-control"
                  style={{ width: '100px', padding: '6px 12px', margin: 0 }}
                >
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                  <option value={200}>200</option>
                  <option value={500}>500</option>
                </select>
              </div>
              <button 
                onClick={fetchLogsData} 
                className="btn btn-secondary btn-icon" 
                style={{ padding: '8px 12px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px', height: 'auto' }}
                disabled={logsLoading}
              >
                <RefreshCw size={14} className={logsLoading ? 'spin-animation' : ''} />
                <span>Reload Logs</span>
              </button>
            </div>

            {logsLoading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}>
                <span className="spinner" style={{ width: '32px', height: '32px', borderLeftColor: 'var(--color-primary)' }}></span>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {(() => {
                  const filteredErrorLogs = errorLogs.filter(log => 
                    !searchQuery || 
                    log.message.toLowerCase().includes(searchQuery.toLowerCase()) || 
                    (log.stack && log.stack.toLowerCase().includes(searchQuery.toLowerCase()))
                  );

                  if (filteredErrorLogs.length === 0) {
                    return (
                      <div className="glass-panel" style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
                        No error logs found matching criteria.
                      </div>
                    );
                  }

                  return filteredErrorLogs.map((log, idx) => {
                    const logId = `${log.timestamp}-${idx}`;
                    const isExpanded = !!expandedErrors[logId];

                    return (
                      <div 
                        key={logId} 
                        className="glass-panel" 
                        style={{ 
                          padding: '16px 20px', 
                          borderLeft: '4px solid var(--color-danger)', 
                          display: 'flex', 
                          flexDirection: 'column', 
                          gap: '12px',
                          backgroundColor: 'rgba(239, 68, 68, 0.02)'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
                          <div style={{ flex: 1, minWidth: '240px' }}>
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block' }}>
                              {log.timestamp}
                            </span>
                            <strong style={{ fontSize: '0.95rem', color: '#ffffff', display: 'block', marginTop: '4px', wordBreak: 'break-all' }}>
                              {log.message}
                            </strong>
                          </div>
                          {log.stack && (
                            <button 
                              onClick={() => setExpandedErrors({
                                ...expandedErrors,
                                [logId]: !isExpanded
                              })}
                              className="btn btn-secondary"
                              style={{ padding: '6px 12px', fontSize: '0.8rem', height: 'auto' }}
                            >
                              {isExpanded ? 'Hide Traceback' : 'View Traceback'}
                            </button>
                          )}
                        </div>

                        {isExpanded && log.stack && (
                          <pre 
                            style={{ 
                              backgroundColor: '#05070f', 
                              padding: '16px', 
                              borderRadius: 'var(--radius-sm)', 
                              fontSize: '0.8rem', 
                              overflowX: 'auto', 
                              color: '#ff8888',
                              fontFamily: 'Courier New, Courier, monospace',
                              whiteSpace: 'pre',
                              margin: 0,
                              border: '1px solid rgba(239, 68, 68, 0.15)'
                            }}
                          >
                            {log.stack}
                          </pre>
                        )}
                      </div>
                    );
                  });
                })()}
              </div>
            )}
          </div>
        )}

      </div>

      {/* Confirmation Modal */}
      {confirmModal.isOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000,
          backdropFilter: 'blur(8px)',
          animation: 'fadeIn 0.2s ease-out'
        }}>
          <div className="glass-panel" style={{
            width: '100%',
            maxWidth: '440px',
            padding: '28px',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 10px 10px -5px rgba(0, 0, 0, 0.4)',
            textAlign: 'center'
          }}>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              color: 'var(--color-danger)',
              marginBottom: '16px'
            }}>
              <AlertTriangle size={28} />
            </div>

            <h3 style={{ fontSize: '1.3rem', fontWeight: '700', marginBottom: '8px', color: '#ffffff' }}>
              Confirm Deletion
            </h3>
            
            <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', marginBottom: '24px', lineHeight: '1.5' }}>
              Are you sure you want to delete the {confirmModal.type} <strong>{confirmModal.name}</strong>?
              {confirmModal.type === 'user' ? (
                <span style={{ display: 'block', marginTop: '8px', color: 'var(--color-warning)', fontSize: '0.85rem', fontWeight: '600' }}>
                  ⚠️ This will permanently delete all links and traffic logs created by this user. This action is irreversible.
                </span>
              ) : (
                <span style={{ display: 'block', marginTop: '8px', color: 'var(--color-warning)', fontSize: '0.85rem', fontWeight: '600' }}>
                  ⚠️ This will permanently deactivate the shortcode and delete all click metrics.
                </span>
              )}
            </p>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button 
                onClick={closeConfirmModal}
                className="btn btn-secondary"
                disabled={actionLoading}
                style={{ flex: 1 }}
              >
                Cancel
              </button>
              <button 
                onClick={handleConfirmDelete}
                className="btn btn-danger"
                disabled={actionLoading}
                style={{ 
                  flex: 1, 
                  backgroundColor: 'var(--color-danger)',
                  borderColor: 'var(--color-danger)',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
              >
                {actionLoading ? (
                  <span className="spinner" style={{ width: '16px', height: '16px', borderLeftColor: '#ffffff' }}></span>
                ) : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
