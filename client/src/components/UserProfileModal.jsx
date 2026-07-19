import React, { useState, useRef, useEffect } from 'react';
import { 
  X, 
  User, 
  Mail, 
  Key, 
  Trash2, 
  Camera, 
  Loader2, 
  ShieldAlert, 
  Lock, 
  Check, 
  AlertTriangle 
} from 'lucide-react';

export default function UserProfileModal({ isOpen, onClose, user, onProfileUpdate, onLogout }) {
  const [activeTab, setActiveTab] = useState('profile');
  
  // Profile inputs state
  const [username, setUsername] = useState(user?.username || '');
  const [email, setEmail] = useState(user?.email || '');
  const [avatar, setAvatar] = useState(user?.profilePicture || '');
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [profileSuccess, setProfileSuccess] = useState('');
  
  // Avatar upload states
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [avatarError, setAvatarError] = useState('');

  // Password inputs state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');

  // Delete inputs state
  const [confirmText, setConfirmText] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const fileInputRef = useRef(null);

  // Sync state if user prop changes
  useEffect(() => {
    if (user) {
      setUsername(user.username || '');
      setEmail(user.email || '');
      setAvatar(user.profilePicture || '');
    }
  }, [user]);

  if (!isOpen) return null;

  const getHeaders = () => {
    const token = localStorage.getItem('accessToken');
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
  };

  // Profile update (Username & Email)
  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setProfileLoading(true);
    setProfileError('');
    setProfileSuccess('');

    if (!username.trim() || !email.trim()) {
      setProfileError('Username and email are required.');
      setProfileLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/v1/auth/update-me', {
        method: 'PATCH',
        headers: getHeaders(),
        body: JSON.stringify({ username, email })
      });

      const json = await response.json();

      if (!response.ok) {
        throw new Error(json.message || 'Failed to update profile.');
      }

      // Update parent state & storage
      localStorage.setItem('username', json.data.user.username);
      onProfileUpdate(json.data.user);
      setProfileSuccess(json.message || 'Profile updated successfully!');
    } catch (err) {
      setProfileError(err.message);
    } finally {
      setProfileLoading(false);
    }
  };

  // Avatar conversion and upload
  const handleAvatarChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      setAvatarError('Image size exceeds 2MB limit.');
      return;
    }

    setAvatarLoading(true);
    setAvatarError('');

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = async () => {
      const base64Data = reader.result;
      try {
        const response = await fetch('/api/v1/auth/profile-picture', {
          method: 'PATCH',
          headers: getHeaders(),
          body: JSON.stringify({ profilePicture: base64Data })
        });

        const json = await response.json();

        if (!response.ok) {
          throw new Error(json.message || 'Failed to upload profile picture.');
        }

        setAvatar(json.data.user.profilePicture);
        onProfileUpdate(json.data.user);
      } catch (err) {
        setAvatarError(err.message);
      } finally {
        setAvatarLoading(false);
      }
    };
    reader.onerror = () => {
      setAvatarError('Error reading file.');
      setAvatarLoading(false);
    };
  };

  // Avatar Removal
  const handleRemoveAvatar = async () => {
    setAvatarLoading(true);
    setAvatarError('');
    try {
      const response = await fetch('/api/v1/auth/profile-picture', {
        method: 'PATCH',
        headers: getHeaders(),
        body: JSON.stringify({ profilePicture: '' })
      });

      const json = await response.json();

      if (!response.ok) {
        throw new Error(json.message || 'Failed to remove profile picture.');
      }

      setAvatar('');
      onProfileUpdate(json.data.user);
    } catch (err) {
      setAvatarError(err.message);
    } finally {
      setAvatarLoading(false);
    }
  };

  // Password Change
  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPasswordLoading(true);
    setPasswordError('');
    setPasswordSuccess('');

    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match.');
      setPasswordLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/v1/auth/change-password', {
        method: 'PATCH',
        headers: getHeaders(),
        body: JSON.stringify({ currentPassword, newPassword })
      });

      const json = await response.json();

      if (!response.ok) {
        throw new Error(json.message || 'Failed to change password.');
      }

      // Update local storage token to stay logged in
      localStorage.setItem('accessToken', json.data.accessToken);
      setPasswordSuccess('Password updated successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setPasswordError(err.message);
    } finally {
      setPasswordLoading(false);
    }
  };

  // Account Deletion
  const handleDeleteAccount = async (e) => {
    e.preventDefault();
    if (confirmText !== user?.username) {
      setDeleteError('Confirmation username does not match.');
      return;
    }

    setDeleteLoading(true);
    setDeleteError('');

    try {
      const response = await fetch('/api/v1/auth/delete-me', {
        method: 'DELETE',
        headers: getHeaders()
      });

      const json = await response.json();

      if (!response.ok) {
        throw new Error(json.message || 'Failed to delete account.');
      }

      // Log out user
      onClose();
      onLogout();
    } catch (err) {
      setDeleteError(err.message);
      setDeleteLoading(false);
    }
  };

  const getInitials = () => {
    if (!username) return 'U';
    return username.substring(0, 2).toUpperCase();
  };

  return (
    <div className="modal-overlay" onClick={onClose} style={{ display: 'flex', zIndex: 1100 }}>
      <div 
        className="modal-content glass-panel profile-modal-content" 
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '640px', width: '90%' }}
      >
        {/* Header */}
        <div className="modal-header">
          <div className="modal-title-with-icon">
            <div className="modal-title-icon-bg">
              <User className="text-primary" size={20} />
            </div>
            <div>
              <h3>Profile Settings</h3>
              <p className="modal-subtitle">Manage your account information and preferences</p>
            </div>
          </div>
          <button className="modal-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Modal Layout Grid */}
        <div className="profile-modal-body">
          
          {/* Left Navigation Tabs */}
          <div className="profile-sidebar">
            <button 
              className={`profile-tab-btn ${activeTab === 'profile' ? 'active' : ''}`}
              onClick={() => setActiveTab('profile')}
            >
              <User size={16} />
              Profile Details
            </button>
            <button 
              className={`profile-tab-btn ${activeTab === 'security' ? 'active' : ''}`}
              onClick={() => setActiveTab('security')}
            >
              <Key size={16} />
              Security Settings
            </button>
            <button 
              className={`profile-tab-btn ${activeTab === 'danger' ? 'active' : ''}`}
              onClick={() => setActiveTab('danger')}
            >
              <Trash2 size={16} />
              Danger Zone
            </button>
          </div>

          {/* Right Content Panels */}
          <div className="profile-content">
            
            {/* TAB: PROFILE DETAILS */}
            {activeTab === 'profile' && (
              <div className="profile-tab-content">
                <h4 className="profile-section-title">Personal Information</h4>
                
                {/* Avatar upload section */}
                <div className="avatar-upload-container">
                  <div className="avatar-preview-wrapper">
                    {avatar ? (
                      <img src={avatar} alt="Avatar Preview" className="avatar-preview-img" />
                    ) : (
                      <div className="avatar-preview-initials">{getInitials()}</div>
                    )}
                    <button 
                      onClick={() => fileInputRef.current.click()} 
                      className="avatar-change-badge"
                      title="Upload Avatar"
                      disabled={avatarLoading}
                    >
                      {avatarLoading ? <Loader2 size={14} className="anim-rotate" /> : <Camera size={14} />}
                    </button>
                  </div>
                  
                  <div className="avatar-upload-info">
                    <span className="avatar-upload-title">Profile Picture</span>
                    <p className="avatar-upload-desc">JPG or PNG. Max size of 2MB.</p>
                    {avatar && (
                      <button 
                        type="button" 
                        onClick={handleRemoveAvatar} 
                        className="btn-remove-avatar"
                        disabled={avatarLoading}
                      >
                        Remove picture
                      </button>
                    )}
                  </div>
                  
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleAvatarChange} 
                    style={{ display: 'none' }} 
                    accept="image/*"
                  />
                </div>

                {avatarError && <div className="alert alert-danger" style={{ padding: '8px 12px', fontSize: '0.85rem' }}>{avatarError}</div>}

                {/* Profile Form */}
                <form onSubmit={handleUpdateProfile} className="profile-form">
                  {profileError && <div className="alert alert-danger">{profileError}</div>}
                  {profileSuccess && <div className="alert alert-success">{profileSuccess}</div>}

                  <div className="form-group">
                    <label className="form-label">Username</label>
                    <div className="input-with-icon-wrapper">
                      <User size={16} className="input-icon-left" />
                      <input 
                        type="text" 
                        className="form-input icon-padding" 
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="Username"
                        disabled={profileLoading}
                        required
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Email Address</label>
                    <div className="input-with-icon-wrapper">
                      <Mail size={16} className="input-icon-left" />
                      <input 
                        type="email" 
                        className="form-input icon-padding" 
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="Email Address"
                        disabled={profileLoading}
                        required
                      />
                    </div>
                    {!user?.isVerified && (
                      <p className="email-status-warning">
                        * Email is unverified.
                      </p>
                    )}
                  </div>

                  <button 
                    type="submit" 
                    className="btn btn-primary"
                    disabled={profileLoading}
                    style={{ width: '100%', marginTop: '8px' }}
                  >
                    {profileLoading ? (
                      <>
                        <Loader2 size={16} className="anim-rotate" style={{ marginRight: '8px' }} />
                        Saving Changes...
                      </>
                    ) : (
                      'Save Profile Details'
                    )}
                  </button>
                </form>
              </div>
            )}

            {/* TAB: SECURITY */}
            {activeTab === 'security' && (
              <div className="profile-tab-content">
                <h4 className="profile-section-title">Change Password</h4>
                
                <form onSubmit={handleChangePassword} className="profile-form">
                  {passwordError && <div className="alert alert-danger">{passwordError}</div>}
                  {passwordSuccess && <div className="alert alert-success">{passwordSuccess}</div>}

                  <div className="form-group">
                    <label className="form-label">Current Password</label>
                    <div className="input-with-icon-wrapper">
                      <Lock size={16} className="input-icon-left" />
                      <input 
                        type="password" 
                        className="form-input icon-padding" 
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        placeholder="Current password"
                        disabled={passwordLoading}
                        required
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">New Password</label>
                    <div className="input-with-icon-wrapper">
                      <Key size={16} className="input-icon-left" />
                      <input 
                        type="password" 
                        className="form-input icon-padding" 
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Min. 8 characters"
                        disabled={passwordLoading}
                        minLength={8}
                        required
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Confirm New Password</label>
                    <div className="input-with-icon-wrapper">
                      <Check size={16} className="input-icon-left" />
                      <input 
                        type="password" 
                        className="form-input icon-padding" 
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Verify your new password"
                        disabled={passwordLoading}
                        minLength={8}
                        required
                      />
                    </div>
                  </div>

                  <button 
                    type="submit" 
                    className="btn btn-primary"
                    disabled={passwordLoading}
                    style={{ width: '100%', marginTop: '8px' }}
                  >
                    {passwordLoading ? (
                      <>
                        <Loader2 size={16} className="anim-rotate" style={{ marginRight: '8px' }} />
                        Updating Password...
                      </>
                    ) : (
                      'Update Password'
                    )}
                  </button>
                </form>
              </div>
            )}

            {/* TAB: DANGER ZONE */}
            {activeTab === 'danger' && (
              <div className="profile-tab-content">
                <div className="danger-zone-header-box">
                  <ShieldAlert className="danger-icon" size={24} />
                  <div>
                    <h4>Delete Account Permanently</h4>
                    <p>Once deleted, your account and all associated URLs, click history, and logs will be permanently erased. This cannot be undone.</p>
                  </div>
                </div>

                <form onSubmit={handleDeleteAccount} className="profile-form" style={{ marginTop: '20px' }}>
                  {deleteError && <div className="alert alert-danger">{deleteError}</div>}

                  <div className="form-group">
                    <label className="form-label">
                      To confirm, type your username <strong style={{ color: 'var(--color-danger)' }}>{user?.username}</strong>:
                    </label>
                    <input 
                      type="text" 
                      className="form-input" 
                      value={confirmText}
                      onChange={(e) => setConfirmText(e.target.value)}
                      placeholder="Type username to confirm"
                      disabled={deleteLoading}
                      required
                    />
                  </div>

                  <button 
                    type="submit" 
                    className="btn btn-danger btn-icon"
                    disabled={deleteLoading || confirmText !== user?.username}
                    style={{ width: '100%', justifyContent: 'center', gap: '8px' }}
                  >
                    {deleteLoading ? (
                      <>
                        <Loader2 size={16} className="anim-rotate" />
                        Deleting Account...
                      </>
                    ) : (
                      <>
                        <AlertTriangle size={16} />
                        Permanently Delete Account
                      </>
                    )}
                  </button>
                </form>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
