import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Link2, 
  LogOut, 
  User, 
  Bell, 
  Check, 
  Trash2, 
  Clock, 
  Key, 
  PlusCircle, 
  AlertCircle,
  X
} from 'lucide-react';
import UserProfileModal from './UserProfileModal';

// Helper to format timestamps relative to current time
const formatRelativeTime = (dateString) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

export default function Navbar({ user, onProfileUpdate, onLogout }) {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const dropdownRef = useRef(null);

  const username = user?.username || localStorage.getItem('username') || 'User';
  const avatarUrl = user?.profilePicture || '';

  // Fetch notifications from the backend
  const fetchNotifications = async () => {
    const token = localStorage.getItem('accessToken');
    if (!token) return;

    try {
      const response = await fetch('/api/v1/notifications', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.status === 401) {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('username');
        navigate('/login');
        return;
      }

      if (response.ok) {
        const json = await response.json();
        setNotifications(json.data.notifications || []);
      }
    } catch (err) {
      console.error('Error fetching notifications:', err);
    }
  };

  useEffect(() => {
    // Initial fetch
    fetchNotifications();

    // Refresh listener for dashboard actions
    const handleRefresh = () => {
      fetchNotifications();
    };

    window.addEventListener('refreshNotifications', handleRefresh);

    // Poll every 10 seconds for real-time background link expirations
    const interval = setInterval(fetchNotifications, 10000);

    return () => {
      window.removeEventListener('refreshNotifications', handleRefresh);
      clearInterval(interval);
    };
  }, [navigate]);

  // Click outside to close dropdown hook
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleLogoutClick = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('username');
    if (onLogout) onLogout();
    navigate('/login');
  };

  const handleMarkRead = async (id) => {
    const token = localStorage.getItem('accessToken');
    if (!token) return;

    try {
      const response = await fetch(`/api/v1/notifications/${id}/read`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        // Update local state directly for speed, or refetch
        setNotifications(prev =>
          prev.map(n => n._id === id ? { ...n, isRead: true } : n)
        );
      }
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  };

  const handleMarkAllRead = async () => {
    const token = localStorage.getItem('accessToken');
    if (!token) return;

    try {
      const response = await fetch('/api/v1/notifications/all/read', {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        setNotifications(prev =>
          prev.map(n => ({ ...n, isRead: true }))
        );
      }
    } catch (err) {
      console.error('Failed to mark all as read:', err);
    }
  };

  const handleDelete = async (e, id) => {
    e.stopPropagation(); // Avoid triggering click to read or toggle dropdown
    const token = localStorage.getItem('accessToken');
    if (!token) return;

    try {
      const response = await fetch(`/api/v1/notifications/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        setNotifications(prev => prev.filter(n => n._id !== id));
      }
    } catch (err) {
      console.error('Failed to delete notification:', err);
    }
  };

  const handleClearAll = async () => {
    const token = localStorage.getItem('accessToken');
    if (!token) return;

    try {
      const response = await fetch('/api/v1/notifications/all', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        setNotifications([]);
      }
    } catch (err) {
      console.error('Failed to clear all notifications:', err);
    }
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'link_created':
        return <PlusCircle size={16} className="notif-type-icon text-success" />;
      case 'link_deleted':
        return <Trash2 size={16} className="notif-type-icon text-danger" />;
      case 'link_expired':
        return <Clock size={16} className="notif-type-icon text-warning" />;
      case 'password_changed':
        return <Key size={16} className="notif-type-icon text-accent" />;
      default:
        return <AlertCircle size={16} className="notif-type-icon text-muted" />;
    }
  };

  return (
    <nav className="navbar">
      <div className="navbar-brand">
        <Link2 size={24} />
        <span>LinkSphere</span>
      </div>
      
      <div className="navbar-user">
        {/* Notification Bell Dropdown Container */}
        <div className="notification-container" ref={dropdownRef}>
          <button 
            onClick={() => setIsOpen(!isOpen)}
            className={`btn-notification ${isOpen ? 'active' : ''}`}
            title="Notifications"
          >
            <Bell size={20} />
            {unreadCount > 0 && (
              <span className="notification-badge">{unreadCount}</span>
            )}
          </button>

          {isOpen && (
            <div className="notification-dropdown glass-panel">
              <div className="notification-header">
                <h3>Notifications</h3>
                {unreadCount > 0 && (
                  <button 
                    onClick={handleMarkAllRead}
                    className="btn-link"
                    style={{ fontSize: '0.8rem' }}
                  >
                    Mark all read
                  </button>
                )}
              </div>

              <div className="notification-body">
                {notifications.length === 0 ? (
                  <div className="notification-empty">
                    <div className="empty-bell-icon">
                      <Bell size={28} />
                    </div>
                    <p>All caught up!</p>
                    <span>No notifications yet.</span>
                  </div>
                ) : (
                  notifications.map(n => (
                    <div 
                      key={n._id}
                      onClick={() => !n.isRead && handleMarkRead(n._id)}
                      className={`notification-item ${!n.isRead ? 'unread' : ''}`}
                    >
                      <div className="notification-item-icon">
                        {getNotificationIcon(n.type)}
                      </div>
                      
                      <div className="notification-item-content">
                        <div className="notification-item-header">
                          <span className="notification-item-title">{n.title}</span>
                          <span className="notification-item-time">{formatRelativeTime(n.createdAt)}</span>
                        </div>
                        <p className="notification-item-msg">{n.message}</p>
                      </div>

                      <div className="notification-item-actions">
                        {!n.isRead && (
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleMarkRead(n._id);
                            }}
                            className="btn-icon-sm text-success"
                            title="Mark as read"
                          >
                            <Check size={14} />
                          </button>
                        )}
                        <button 
                          onClick={(e) => handleDelete(e, n._id)}
                          className="btn-icon-sm text-muted hover-danger"
                          title="Delete notification"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {notifications.length > 0 && (
                <div className="notification-footer">
                  <button 
                    onClick={handleClearAll}
                    className="btn-clear-all"
                  >
                    <Trash2 size={12} style={{ marginRight: '6px' }} />
                    Clear all notifications
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <button 
          className="user-badge" 
          onClick={() => setIsProfileOpen(true)}
          title="Profile Settings"
        >
          {avatarUrl ? (
            <img src={avatarUrl} alt="Avatar" className="user-badge-avatar" />
          ) : (
            <User size={16} />
          )}
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            {username}
            {user?.role === 'admin' && (
              <span style={{
                fontSize: '0.65rem',
                textTransform: 'uppercase',
                fontWeight: '800',
                backgroundColor: 'rgba(79, 70, 229, 0.3)',
                color: '#818cf8',
                padding: '2px 6px',
                borderRadius: '4px',
                letterSpacing: '0.05em'
              }}>
                Admin
              </span>
            )}
          </span>
        </button>
        
        <button 
          onClick={handleLogoutClick}
          className="btn btn-secondary btn-icon"
          title="Logout"
        >
          <LogOut size={16} />
        </button>
      </div>

      <UserProfileModal
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        user={user}
        onProfileUpdate={onProfileUpdate}
        onLogout={handleLogoutClick}
      />
    </nav>
  );
}
