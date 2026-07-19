import React, { useState } from 'react';
import { getShortBaseUrl } from '../utils/urlHelper';
import { Search, Copy, Check, Trash2, ExternalLink, RefreshCw, Edit2, X, ChevronLeft, ChevronRight, QrCode, Pin, Star, Archive, StickyNote, Lock, Clock, Calendar } from 'lucide-react';
import QrCodeModal from './QrCodeModal';

export default function UrlList({ urls = [], onUrlDeleted, onRefresh }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOption, setSortOption] = useState('newest');
  const [filterStatus, setFilterStatus] = useState('all');
  const [copiedId, setCopiedId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const [filterCategory, setFilterCategory] = useState('all');
  const [filterTag, setFilterTag] = useState('all');

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(5);

  // Edit modal states
  const [editingUrl, setEditingUrl] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [editOriginalUrl, setEditOriginalUrl] = useState('');
  const [editCustomAlias, setEditCustomAlias] = useState('');
  const [editExpiresAt, setEditExpiresAt] = useState('');
  const [editIsActive, setEditIsActive] = useState(true);
  const [editCategory, setEditCategory] = useState('');
  const [editTags, setEditTags] = useState([]);
  const [editNote, setEditNote] = useState('');
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState('');
  const [editIsPasswordProtected, setEditIsPasswordProtected] = useState(false);
  const [editPassword, setEditPassword] = useState('');
  const [editConfirmPassword, setEditConfirmPassword] = useState('');
  const [editExpirationType, setEditExpirationType] = useState('none');
  const [editCustomExpiryDate, setEditCustomExpiryDate] = useState('');

  // Filtering states
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

  // QR modal states
  const [selectedUrlForQr, setSelectedUrlForQr] = useState(null);
  const [isQrOpen, setIsQrOpen] = useState(false);

  const handleQuickUpdate = async (id, updates) => {
    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`/api/v1/urls/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(updates)
      });

      const json = await response.json();
      if (!response.ok) {
        throw new Error(json.message || 'Failed to update link');
      }

      if (onRefresh) onRefresh();
    } catch (err) {
      alert(err.message || 'Error updating link');
    }
  };

  // 1. Filter links based on search
  let processedUrls = urls.filter((url) => {
    const term = searchTerm.toLowerCase();
    return (
      (url.title && url.title.toLowerCase().includes(term)) ||
      url.originalUrl.toLowerCase().includes(term) ||
      url.shortCode.toLowerCase().includes(term) ||
      (url.customAlias && url.customAlias.toLowerCase().includes(term))
    );
  });

  // 2. Filter links based on active/inactive/expired status
  processedUrls = processedUrls.filter((url) => {
    // Show archived links ONLY when "archived" status is selected
    if (filterStatus === 'archived') {
      return url.isArchived;
    }
    
    // Otherwise, skip archived links by default
    if (url.isArchived) {
      return false;
    }

    if (filterStatus === 'all') return true;
    
    const isExpired = url.expiresAt && new Date(url.expiresAt) < new Date();
    
    if (filterStatus === 'active') {
      return url.isActive && !isExpired;
    }
    if (filterStatus === 'inactive') {
      return !url.isActive;
    }
    if (filterStatus === 'expired') {
      return isExpired;
    }
    return true;
  });

  // 2a. Filter links based on Category
  processedUrls = processedUrls.filter((url) => {
    if (filterCategory === 'all') return true;
    if (filterCategory === 'none') return !url.category;
    return url.category === filterCategory;
  });

  // 2b. Filter links based on Tag
  processedUrls = processedUrls.filter((url) => {
    if (filterTag === 'all') return true;
    if (filterTag === 'none') return !url.tags || url.tags.length === 0;
    return url.tags && url.tags.includes(filterTag);
  });

  // 2c. Filter links based on Favorites
  if (showFavoritesOnly) {
    processedUrls = processedUrls.filter((url) => url.isFavorite);
  }

  // 3. Sort links
  processedUrls.sort((a, b) => {
    // Pinned links always float to the top
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;

    switch (sortOption) {
      case 'newest':
        return new Date(b.createdAt) - new Date(a.createdAt);
      case 'oldest':
        return new Date(a.createdAt) - new Date(b.createdAt);
      case 'clicks-desc':
        return (b.clicks || 0) - (a.clicks || 0);
      case 'clicks-asc':
        return (a.clicks || 0) - (b.clicks || 0);
      case 'title-az':
        return (a.title || '').localeCompare(b.title || '');
      case 'title-za':
        return (b.title || '').localeCompare(a.title || '');
      default:
        return 0;
    }
  });

  // 4. Calculate pagination
  const totalItems = processedUrls.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  const activePage = Math.min(currentPage, totalPages);

  const startIndex = (activePage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
  const paginatedUrls = processedUrls.slice(startIndex, endIndex);

  const handleCopy = (id, shortCode) => {
    const shortLink = `${getShortBaseUrl()}/${shortCode}`;
    navigator.clipboard.writeText(shortLink).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this shortened link?')) {
      return;
    }
    
    setDeletingId(id);
    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`/api/v1/urls/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to delete URL');
      }

      if (onUrlDeleted) onUrlDeleted();
    } catch (err) {
      alert(err.message || 'Error deleting URL');
    } finally {
      setDeletingId(null);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    const d = new Date(dateStr);
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const formatDateForInput = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const tzOffset = d.getTimezoneOffset() * 60000;
    return (new Date(d.getTime() - tzOffset)).toISOString().slice(0, 16);
  };

  const handleEditClick = (url) => {
    setEditingUrl(url);
    setEditTitle(url.title || '');
    setEditOriginalUrl(url.originalUrl || '');
    setEditCustomAlias(url.customAlias || '');
    setEditExpiresAt(formatDateForInput(url.expiresAt));
    setEditIsActive(url.isActive !== undefined ? url.isActive : true);
    setEditCategory(url.category || '');
    setEditTags(url.tags || []);
    setEditNote(url.note || '');
    setEditIsPasswordProtected(url.isPasswordProtected || false);
    setEditPassword('');
    setEditConfirmPassword('');
    if (url.expiresAt) {
      setEditExpirationType('custom');
      setEditCustomExpiryDate(formatDateForInput(url.expiresAt));
    } else {
      setEditExpirationType('none');
      setEditCustomExpiryDate('');
    }
    setEditError('');
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editOriginalUrl) {
      setEditError('Original URL is required.');
      return;
    }

    setEditLoading(true);
    setEditError('');

    try {
      const token = localStorage.getItem('accessToken');
      
      let expiresVal = null;
      if (editExpirationType === '1day') {
        expiresVal = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      } else if (editExpirationType === '7days') {
        expiresVal = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      } else if (editExpirationType === '30days') {
        expiresVal = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      } else if (editExpirationType === 'custom') {
        if (editCustomExpiryDate) {
          expiresVal = new Date(editCustomExpiryDate).toISOString();
        }
      }
      
      if (expiresVal && new Date(expiresVal) <= new Date() && expiresVal !== editingUrl.expiresAt) {
        throw new Error('Expiration date must be in the future.');
      }

      const bodyData = {
        title: editTitle,
        originalUrl: editOriginalUrl,
        customAlias: editCustomAlias || '',
        expiresAt: expiresVal,
        isActive: editIsActive,
        category: editCategory || '',
        tags: editTags,
        note: editNote
      };

      if (editIsPasswordProtected) {
        if (editPassword) {
          if (editPassword !== editConfirmPassword) {
            throw new Error('Passwords do not match.');
          }
          bodyData.password = editPassword;
        } else if (!editingUrl.isPasswordProtected) {
          throw new Error('Please enter a password to enable protection.');
        }
      } else {
        if (editingUrl.isPasswordProtected) {
          bodyData.password = ''; // sending empty string clears password in backend
        }
      }

      const response = await fetch(`/api/v1/urls/${editingUrl._id || editingUrl.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(bodyData)
      });

      const json = await response.json();

      if (!response.ok) {
        throw new Error(json.message || 'Failed to update shortened link');
      }

      setEditingUrl(null);
      if (onRefresh) onRefresh();
    } catch (err) {
      setEditError(err.message || 'Error updating URL');
    } finally {
      setEditLoading(false);
    }
  };

  const handlePageChange = (pageNum) => {
    setCurrentPage(pageNum);
  };

  const renderStatusBadge = (url) => {
    const isExpired = url.expiresAt && new Date(url.expiresAt) < new Date();
    if (!url.isActive) {
      return (
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          padding: '2px 8px',
          borderRadius: '4px',
          fontSize: '0.75rem',
          fontWeight: '600',
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          color: 'var(--color-danger)',
          border: '1px solid rgba(239, 68, 68, 0.2)'
        }}>
          Inactive
        </span>
      );
    }
    if (isExpired) {
      return (
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          padding: '2px 8px',
          borderRadius: '4px',
          fontSize: '0.75rem',
          fontWeight: '600',
          backgroundColor: 'rgba(245, 158, 11, 0.1)',
          color: 'var(--color-warning)',
          border: '1px solid rgba(245, 158, 11, 0.2)'
        }}>
          Expired
        </span>
      );
    }
    return (
      <span style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 8px',
        borderRadius: '4px',
        fontSize: '0.75rem',
        fontWeight: '600',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        color: 'var(--color-success)',
        border: '1px solid rgba(16, 185, 129, 0.2)'
      }}>
        Active
      </span>
    );
  };

  return (
    <div className="url-list-section">
      <div className="list-header" style={{ marginBottom: '24px' }}>
        <h2>Your Shortened URLs</h2>
        
        <div className="url-list-controls">
          <div className="search-container" style={{ flexGrow: 1, maxWidth: '280px', minWidth: '160px' }}>
            <Search size={16} className="search-icon" />
            <input
              type="text"
              placeholder="Search links..."
              className="search-input"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>

          <select
            className="form-select"
            value={filterStatus}
            onChange={(e) => {
              setFilterStatus(e.target.value);
              setCurrentPage(1);
            }}
            title="Filter by status"
          >
            <option value="all">All Status</option>
            <option value="active">Active Only</option>
            <option value="inactive">Inactive Only</option>
            <option value="expired">Expired Only</option>
            <option value="archived">Archived Only</option>
          </select>

          <button
            type="button"
            onClick={() => {
              setShowFavoritesOnly(!showFavoritesOnly);
              setCurrentPage(1);
            }}
            className={`btn btn-secondary ${showFavoritesOnly ? 'active-star-filter' : ''}`}
            title={showFavoritesOnly ? "Show all links" : "Show favorites only"}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              borderColor: showFavoritesOnly ? 'var(--color-warning)' : '',
              color: showFavoritesOnly ? 'var(--color-warning)' : '',
              background: showFavoritesOnly ? 'rgba(245, 158, 11, 0.05)' : ''
            }}
          >
            <Star size={14} fill={showFavoritesOnly ? 'var(--color-warning)' : 'none'} />
            <span>Favorites</span>
          </button>

          <select
            className="form-select"
            value={filterCategory}
            onChange={(e) => {
              setFilterCategory(e.target.value);
              setCurrentPage(1);
            }}
            title="Filter by Category"
          >
            <option value="all">All Categories</option>
            <option value="Work">Work</option>
            <option value="College">College</option>
            <option value="Portfolio">Portfolio</option>
            <option value="Social">Social</option>
            <option value="Marketing">Marketing</option>
            <option value="none">No Category</option>
          </select>

          <select
            className="form-select"
            value={filterTag}
            onChange={(e) => {
              setFilterTag(e.target.value);
              setCurrentPage(1);
            }}
            title="Filter by Tag"
          >
            <option value="all">All Tags</option>
            <option value="Docker">Docker</option>
            <option value="React">React</option>
            <option value="AWS">AWS</option>
            <option value="AI">AI</option>
            <option value="none">No Tags</option>
          </select>

          <select
            className="form-select"
            value={sortOption}
            onChange={(e) => {
              setSortOption(e.target.value);
              setCurrentPage(1);
            }}
            title="Sort by"
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
            <option value="clicks-desc">Clicks: High to Low</option>
            <option value="clicks-asc">Clicks: Low to High</option>
            <option value="title-az">Title: A-Z</option>
            <option value="title-za">Title: Z-A</option>
          </select>

          <select
            className="form-select"
            value={itemsPerPage}
            onChange={(e) => {
              setItemsPerPage(Number(e.target.value));
              setCurrentPage(1);
            }}
            title="Items per page"
            style={{ width: '80px' }}
          >
            <option value={5}>5 / page</option>
            <option value={10}>10 / page</option>
            <option value={20}>20 / page</option>
          </select>
          
          <button onClick={onRefresh} className="btn btn-secondary btn-icon" title="Refresh links">
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      <div className="table-container">
        {processedUrls.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">
              <Search size={32} />
            </div>
            <h3>No links found</h3>
            <p>
              {searchTerm || filterStatus !== 'all'
                ? "No matching shortened links found for your search or filter criteria."
                : "Create your first shortened link using the form above!"}
            </p>
          </div>
        ) : (
          <>
            <table className="url-table">
              <thead>
                <tr>
                  <th>Link Description</th>
                  <th>Short URL</th>
                  <th>Clicks</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedUrls.map((url) => {
                  const shortUrl = `${getShortBaseUrl()}/${url.shortCode}`;
                  return (
                    <tr 
                      key={url._id || url.id}
                      className={`${url.isPinned ? 'pinned-row' : ''} ${url.isArchived ? 'archived-row' : ''}`}
                    >
                      <td>
                        <div className="url-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: '600', fontSize: '0.975rem' }}>{url.title || 'Untitled Link'}</span>
                          {url.isPasswordProtected && (
                            <Lock size={14} style={{ flexShrink: 0, color: 'var(--color-warning)' }} title="Password Protected" />
                          )}
                          
                          {/* Pinned & Favorite Quick Toggles */}
                          <button
                            onClick={() => handleQuickUpdate(url._id || url.id, { isPinned: !url.isPinned })}
                            style={{
                              background: 'none',
                              border: 'none',
                              padding: '2px',
                              cursor: 'pointer',
                              color: url.isPinned ? 'var(--color-primary)' : 'var(--text-muted)',
                              opacity: url.isPinned ? 1 : 0.4,
                              display: 'inline-flex',
                              alignItems: 'center',
                              transition: 'all var(--transition-fast)'
                            }}
                            title={url.isPinned ? "Unpin Link" : "Pin Link"}
                          >
                            <Pin size={14} style={{ transform: url.isPinned ? 'rotate(0deg)' : 'rotate(45deg)' }} fill={url.isPinned ? 'var(--color-primary)' : 'none'} />
                          </button>

                          <button
                            onClick={() => handleQuickUpdate(url._id || url.id, { isFavorite: !url.isFavorite })}
                            style={{
                              background: 'none',
                              border: 'none',
                              padding: '2px',
                              cursor: 'pointer',
                              color: url.isFavorite ? 'var(--color-warning)' : 'var(--text-muted)',
                              opacity: url.isFavorite ? 1 : 0.4,
                              display: 'inline-flex',
                              alignItems: 'center',
                              transition: 'all var(--transition-fast)'
                            }}
                            title={url.isFavorite ? "Remove from Favorites" : "Add to Favorites"}
                          >
                            <Star size={14} fill={url.isFavorite ? 'var(--color-warning)' : 'none'} />
                          </button>

                          {url.category && (
                            <span className="category-badge" data-category={url.category}>
                              {url.category}
                            </span>
                          )}
                        </div>
                        <div className="url-long" title={url.originalUrl}>
                          {url.originalUrl}
                        </div>
                        {url.tags && url.tags.length > 0 && (
                          <div className="url-tags-list">
                            {url.tags.map(tag => (
                              <span key={tag} className="tag-badge">#{tag}</span>
                            ))}
                          </div>
                        )}
                        {url.note && (
                          <div className="url-note-container" title="Personal Note">
                            <StickyNote size={12} style={{ flexShrink: 0, marginTop: '2px' }} />
                            <span style={{ wordBreak: 'break-word' }}>{url.note}</span>
                          </div>
                        )}
                        {url.expiresAt && (() => {
                          const isExpired = new Date(url.expiresAt) < new Date();
                          return (
                            <div className="url-expiry-container" style={{ 
                              display: 'flex', 
                              alignItems: 'center', 
                              gap: '6px', 
                              fontSize: '0.78rem', 
                              color: isExpired ? 'var(--color-danger)' : 'var(--text-muted)', 
                              marginTop: '6px',
                              opacity: isExpired ? 0.9 : 0.8
                            }}>
                              <Calendar size={12} style={{ color: isExpired ? 'var(--color-danger)' : 'var(--color-primary)' }} />
                              <span>
                                {isExpired ? 'Expired on: ' : 'Expires: '}
                                {formatDate(url.expiresAt)} at {new Date(url.expiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                          );
                        })()}
                      </td>
                      <td>
                        <a 
                          href={shortUrl} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="url-short-link"
                        >
                          {url.shortCode}
                          <ExternalLink size={14} />
                        </a>
                      </td>
                      <td>
                        <span className="clicks-badge">
                          {url.clicks || 0}
                        </span>
                      </td>
                      <td>
                        {renderStatusBadge(url)}
                      </td>
                      <td>
                        <span className="date-text">
                          {formatDate(url.createdAt)}
                        </span>
                      </td>
                      <td>
                        <div className="actions-cell">
                          <button
                            onClick={() => handleCopy(url._id || url.id, url.shortCode)}
                            className="btn btn-secondary btn-icon"
                            title="Copy Link"
                          >
                            {copiedId === (url._id || url.id) ? (
                              <Check size={14} className="text-success" />
                            ) : (
                              <Copy size={14} />
                            )}
                          </button>
                          
                          <button
                            onClick={() => handleEditClick(url)}
                            className="btn btn-secondary btn-icon"
                            title="Edit Link"
                          >
                            <Edit2 size={14} />
                          </button>

                          <button
                            onClick={() => {
                              setSelectedUrlForQr(url);
                              setIsQrOpen(true);
                            }}
                            className="btn btn-secondary btn-icon"
                            title="Generate QR Code"
                          >
                            <QrCode size={14} />
                          </button>

                          <button
                            onClick={() => handleQuickUpdate(url._id || url.id, { isArchived: !url.isArchived })}
                            className="btn btn-secondary btn-icon"
                            title={url.isArchived ? "Unarchive Link" : "Archive Link"}
                          >
                            <Archive size={14} className={url.isArchived ? "text-success" : ""} />
                          </button>

                          <button
                            onClick={() => handleDelete(url._id || url.id)}
                            className="btn btn-danger btn-icon"
                            disabled={deletingId === (url._id || url.id)}
                            title="Delete Link"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Pagination Controls */}
            <div className="pagination-container">
              <span className="pagination-info">
                Showing <strong>{startIndex + 1}</strong> to{' '}
                <strong>{endIndex}</strong> of <strong>{totalItems}</strong> entries
              </span>
              
              <div className="pagination-buttons">
                <button
                  className="pagination-btn"
                  onClick={() => handlePageChange(activePage - 1)}
                  disabled={activePage === 1}
                  title="Previous Page"
                >
                  <ChevronLeft size={16} />
                </button>
                
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                  <button
                    key={pageNum}
                    className={`pagination-btn ${activePage === pageNum ? 'active' : ''}`}
                    onClick={() => handlePageChange(pageNum)}
                  >
                    {pageNum}
                  </button>
                ))}
                
                <button
                  className="pagination-btn"
                  onClick={() => handlePageChange(activePage + 1)}
                  disabled={activePage === totalPages}
                  title="Next Page"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Edit Modal Overlay */}
      {editingUrl && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Edit Shortened Link</h3>
              <button className="modal-close-btn" onClick={() => setEditingUrl(null)} disabled={editLoading}>
                <X size={18} />
              </button>
            </div>
            
            <form onSubmit={handleEditSubmit}>
              <div className="modal-body">
                {editError && <div className="alert alert-danger">{editError}</div>}
                
                <div className="form-group">
                  <label className="form-label">Link Title</label>
                  <input
                    type="text"
                    className="form-input"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    placeholder="e.g. My Website"
                    disabled={editLoading}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Original URL</label>
                  <input
                    type="text"
                    className="form-input"
                    value={editOriginalUrl}
                    onChange={(e) => setEditOriginalUrl(e.target.value)}
                    placeholder="e.g. https://google.com"
                    required
                    disabled={editLoading}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Custom Alias (Optional)</label>
                  <input
                    type="text"
                    className="form-input"
                    value={editCustomAlias}
                    onChange={(e) => setEditCustomAlias(e.target.value)}
                    placeholder="e.g. custom-code"
                    disabled={editLoading}
                  />
                  <small style={{ display: 'block', marginTop: '6px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    Note: Modifying this changes your shortened URL path. Leave blank to generate a random 6-character code instead.
                  </small>
                </div>

                <div className="form-group">
                  <label className="form-label">Expiration Setting</label>
                  <div style={{ position: 'relative' }}>
                    <select
                      className="form-input"
                      value={editExpirationType}
                      onChange={(e) => {
                        setEditExpirationType(e.target.value);
                        if (e.target.value !== 'custom') {
                          setEditCustomExpiryDate('');
                        }
                      }}
                      disabled={editLoading}
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

                {editExpirationType === 'custom' && (
                  <div className="form-group" style={{ animation: 'fadeIn 0.2s ease' }}>
                    <label className="form-label">Custom Expiration Date & Time</label>
                    <input
                      type="datetime-local"
                      className="form-input"
                      value={editCustomExpiryDate}
                      onChange={(e) => setEditCustomExpiryDate(e.target.value)}
                      disabled={editLoading}
                      required
                    />
                    <small style={{ display: 'block', marginTop: '6px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      Link will deactivate automatically after this timestamp.
                    </small>
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label">Category</label>
                  <select
                    className="form-input"
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value)}
                    disabled={editLoading}
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
                  <label className="form-label">Personal Note</label>
                  <textarea
                    className="form-input"
                    value={editNote}
                    onChange={(e) => setEditNote(e.target.value)}
                    placeholder="Add a private note about this link..."
                    disabled={editLoading}
                    rows={2}
                    style={{ resize: 'vertical', minHeight: '60px' }}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Tags</label>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '6px' }}>
                    {['Docker', 'React', 'AWS', 'AI'].map(tag => {
                      const isSelected = editTags.includes(tag);
                      return (
                        <button
                          key={tag}
                          type="button"
                          className={`tag-pill-btn ${isSelected ? 'selected' : ''}`}
                          onClick={() => {
                            if (isSelected) {
                              setEditTags(editTags.filter(t => t !== tag));
                            } else {
                              setEditTags([...editTags, tag]);
                            }
                          }}
                          disabled={editLoading}
                        >
                          {tag}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="form-group" style={{ marginTop: '20px' }}>
                  <label className="switch-container">
                    <input
                      type="checkbox"
                      className="switch-input"
                      checked={editIsPasswordProtected}
                      onChange={(e) => {
                        setEditIsPasswordProtected(e.target.checked);
                        if (!e.target.checked) {
                          setEditPassword('');
                          setEditConfirmPassword('');
                        }
                      }}
                      disabled={editLoading}
                    />
                    <span className="switch-slider"></span>
                    <span className="switch-label">Enable Password Protection</span>
                  </label>
                </div>

                {editIsPasswordProtected && (
                  <>
                    <div className="form-group">
                      <label className="form-label">
                        New Password {editingUrl.isPasswordProtected && '(Leave blank to keep current)'}
                      </label>
                      <input
                        type="password"
                        className="form-input"
                        placeholder="••••••••"
                        value={editPassword}
                        onChange={(e) => setEditPassword(e.target.value)}
                        disabled={editLoading}
                        required={!editingUrl.isPasswordProtected}
                      />
                    </div>

                    {editPassword && (
                      <div className="form-group">
                        <label className="form-label">Confirm New Password</label>
                        <input
                          type="password"
                          className="form-input"
                          placeholder="••••••••"
                          value={editConfirmPassword}
                          onChange={(e) => setEditConfirmPassword(e.target.value)}
                          disabled={editLoading}
                          required
                        />
                      </div>
                    )}
                  </>
                )}

                <div className="form-group" style={{ marginTop: '24px' }}>
                  <label className="switch-container">
                    <input
                      type="checkbox"
                      className="switch-input"
                      checked={editIsActive}
                      onChange={(e) => setEditIsActive(e.target.checked)}
                      disabled={editLoading}
                    />
                    <span className="switch-slider"></span>
                    <span className="switch-label">Link Status (Active)</span>
                  </label>
                </div>
              </div>
              
              <div className="modal-footer">
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={() => setEditingUrl(null)} 
                  disabled={editLoading}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary" 
                  disabled={editLoading}
                >
                  {editLoading ? (
                    <>
                      <span className="spinner" style={{ marginRight: '6px' }}></span>
                      Saving...
                    </>
                  ) : (
                    'Save Changes'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QR Code Customization Modal */}
      {isQrOpen && selectedUrlForQr && (
        <QrCodeModal
          isOpen={isQrOpen}
          onClose={() => {
            setIsQrOpen(false);
            setSelectedUrlForQr(null);
          }}
          urlObj={selectedUrlForQr}
        />
      )}
    </div>
  );
}
