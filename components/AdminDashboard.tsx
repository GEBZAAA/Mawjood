import { API_BASE } from '../apiConfig';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { City, Language, FoundItem, AuthenticatedUser, LostItemReport } from '../types';
import { translations } from '../translations';
import { analyzeItemImage, translateItemFields, translateToArabic, performSemanticMatch } from '../services/geminiService';
import { formatDate, formatDateTime } from '../utils';
import MapPicker from './MapPicker';
import ImageViewer from './ImageViewer';
import { SilkyDateInput } from './SilkyInputs';

// Fix Leaflet marker icon issue
// @ts-ignore
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface AdminDashboardProps {
  lang: Language;
  token: string;
  onLogout: () => void;
  items: FoundItem[];
  lostItems: LostItemReport[];
  user: AuthenticatedUser;
  onAddItem: (item: FoundItem) => void;
  onDeleteItem: (id: string) => void;
  onDeleteLostItem: (id: string) => void;
  onResolveLostItem: (id: string) => void;
  onUpdateLostItem: (item: LostItemReport) => void;
  onApproveItem: (id: string) => void;
  onUpdateItem: (item: FoundItem) => void;
  onToggleView: () => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ lang, token, onLogout, items, lostItems, user, onAddItem, onDeleteItem, onDeleteLostItem, onResolveLostItem, onUpdateLostItem, onApproveItem, onUpdateItem, onToggleView }) => {
  const t = translations[lang];
  const isRTL = lang === 'ar' || lang === 'ur' || lang === 'fa';
  const isAdmin = user.role === 'ADMIN';
  const isManager = user.role === 'MANAGER';
  
  const [feedbacks, setFeedbacks] = useState<any[]>([]);
  const [claims, setClaims] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'ITEMS' | 'LOST_ITEMS' | 'FEEDBACK' | 'PENDING' | 'ADMINS' | 'CLAIMS'>('ITEMS');
  const [feedbackFilter, setFeedbackFilter] = useState<'ALL' | 'GENERAL' | 'COMPLAINT' | 'RECOMMENDATION'>('ALL');
  const [pendingCityFilter, setPendingCityFilter] = useState<'ALL' | City.MECCA | City.MADINA>('ALL');
  const [registeredCityFilter, setRegisteredCityFilter] = useState<'ALL' | City.MECCA | City.MADINA>('ALL');
  const [lostItemsCityFilter, setLostItemsCityFilter] = useState<'ALL' | City.MECCA | City.MADINA>('ALL');
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [showAdminForm, setShowAdminForm] = useState(false);
  const [admins, setAdmins] = useState<any[]>([]);
  const [newAdmin, setNewAdmin] = useState({ username: '', password: '', role: 'ADMIN' });
  const [editingItem, setEditingItem] = useState<FoundItem | null>(null);
  const [editingLostItem, setEditingLostItem] = useState<LostItemReport | null>(null);
  const [showMapModal, setShowMapModal] = useState<{ lat: number, lng: number, name: string } | null>(null);
  const [viewerImages, setViewerImages] = useState<string[] | null>(null);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [newItem, setNewItem] = useState({
    name: '',
    description: '',
    gateLocation: '',
    date: '',
    city: City.MECCA,
    images: [] as string[],
    lat: null as number | null,
    lng: null as number | null
  });
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [lostItemToDelete, setLostItemToDelete] = useState<string | null>(null);
  const [lostItemToResolve, setLostItemToResolve] = useState<string | null>(null);
  const [adminToDelete, setAdminToDelete] = useState<string | null>(null);
  const [editingAdmin, setEditingAdmin] = useState<any>(null);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [adminViewMode, setAdminViewMode] = useState<'ADMINS' | 'USERS'>(user.role === 'MANAGER' ? 'ADMINS' : 'USERS');
  const [adminSearchTerm, setAdminSearchTerm] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFeedback, setSelectedFeedback] = useState<any | null>(null);
  const [selectedClaim, setSelectedClaim] = useState<any | null>(null);
  const [itemClaimsModal, setItemClaimsModal] = useState<{ itemId: string, itemName: string } | null>(null);
  const [claimsTab, setClaimsTab] = useState<'ALL' | 'SUSPICIOUS'>('ALL');
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [uploaderInfo, setUploaderInfo] = useState<any | null>(null);
  const [fetchingUser, setFetchingUser] = useState(false);
  const [fetchingUploader, setFetchingUploader] = useState(false);
  const [showDeleteSelfModal, setShowDeleteSelfModal] = useState(false);
  const [deleteSelfPasswords, setDeleteSelfPasswords] = useState({ password: '', confirmPassword: '' });
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const matchesAny = (fields: (string | undefined | null)[], search: string) => {
    if (!search) return true;
    const tokens = search.toLowerCase().split(/\s+/).filter(t => t.length > 0);
    return tokens.every(token => 
      fields.some(field => field?.toLowerCase()?.includes(token))
    );
  };

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [aiProcessing, setAiProcessing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [bannedUsers, setBannedUsers] = useState<any[]>([]);
  const [showBanModal, setShowBanModal] = useState<{ email?: string, phoneNumber?: string } | null>(null);
  const [banForm, setBanForm] = useState({ duration: '86400000', reason: '' }); // Default 24h
  const [isBanDurationOpen, setIsBanDurationOpen] = useState(false);
  const [lostItemsTab, setLostItemsTab] = useState<'REPORTED' | 'AI_SUGGESTIONS'>('REPORTED');
  const [aiMatches, setAiMatches] = useState<any[]>([]);
  const [matchingInProgress, setMatchingInProgress] = useState(false);
  const [selectedMatchLostItem, setSelectedMatchLostItem] = useState<any | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fileInputEditRef = useRef<HTMLInputElement>(null);
  
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const remainingSlots = 10 - newItem.images.length;
    const filesToProcess = files.slice(0, remainingSlots);

    for (const fileObj of filesToProcess) {
      const file = fileObj as File;
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result as string;
        setNewItem(prev => ({ ...prev, images: [...prev.images, base64] }));
        
        // AI Image Analysis (only for first image if desc empty)
        if (newItem.images.length === 0 && !newItem.description) {
          setAiProcessing(true);
          try {
            const base64Data = base64.split(',')[1];
            const mimeType = file.type;
            const analysis = await analyzeItemImage(base64Data, mimeType);
            
            if (analysis.description) {
              setNewItem(prev => ({ 
                ...prev, 
                description: analysis.description,
                name: analysis.category || prev.name
              }));
            }
          } catch (error) {
            console.error('AI Analysis failed:', error);
          } finally {
            setAiProcessing(false);
          }
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const removeNewItemImage = (index: number) => {
    setNewItem(prev => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index)
    }));
  };

  const removeEditingItemImage = (index: number) => {
    setEditingItem(prev => {
      if (!prev) return null;
      const imgs = prev.imageUrls || (prev.imageUrl ? [prev.imageUrl] : []);
      const newImgs = imgs.filter((_, i) => i !== index);
      return {
        ...prev,
        imageUrl: newImgs[0] || '',
        imageUrls: newImgs
      };
    });
  };

  const removeEditingLostItemImage = (index: number) => {
    if (!editingLostItem) return;
    setEditingLostItem(prev => {
      if (!prev) return null;
      const newImgs = prev.images.filter((_, i) => i !== index);
      return { ...prev, images: newImgs };
    });
  };

  useEffect(() => {
    fetchFeedbacks();
    fetchAdmins();
    fetchClaims();
    fetchBannedUsers();
    const interval = setInterval(() => {
      fetchFeedbacks();
      fetchAdmins();
      fetchClaims();
      fetchBannedUsers();
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchBannedUsers = async () => {
    try {
      const response = await fetch(API_BASE + '/api/mgmt/banned', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setBannedUsers(data);
      }
    } catch (error) {
      console.error('Failed to fetch banned users:', error);
    }
  };

  const handleBanUser = async () => {
    if (!showBanModal) return;
    
    if (banForm.duration === 'REMOVE_BAN') {
      const existingBan = bannedUsers.find(b => 
        (showBanModal.email && b.email === showBanModal.email) || 
        (showBanModal.phoneNumber && b.phoneNumber === showBanModal.phoneNumber)
      );
      if (existingBan) {
        await handleUnbanUser(existingBan.id);
        setShowBanModal(null);
        return;
      } else {
        setErrorMessage(isRTL ? 'المستخدم غير محظور حالياً' : 'User is not currently banned');
        return;
      }
    }

    try {
      setLoading(true);
      const response = await fetch(API_BASE + '/api/mgmt/ban', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          email: showBanModal.email,
          phoneNumber: showBanModal.phoneNumber,
          duration: banForm.duration === 'PERMANENT' ? 'PERMANENT' : parseInt(banForm.duration),
          reason: banForm.reason
        })
      });

      if (response.ok) {
        setSuccessMessage(isRTL ? 'تم حظر المستخدم بنجاح' : 'User banned successfully');
        setShowBanModal(null);
        setBanForm({ duration: '86400000', reason: '' });
        fetchBannedUsers();
      } else {
        const error = await response.json();
        setErrorMessage(error.message || 'Failed to ban user');
      }
    } catch (error) {
      setErrorMessage('Failed to ban user');
    } finally {
      setLoading(false);
    }
  };

  const handleUnbanUser = async (id: string) => {
    try {
      const response = await fetch(`${API_BASE}/api/mgmt/ban/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        setSuccessMessage(isRTL ? 'تم إلغاء حظر المستخدم' : 'User unbanned successfully');
        fetchBannedUsers();
      }
    } catch (error) {
      setErrorMessage('Failed to unban user');
    }
  };

  const runAiMatching = async () => {
    setMatchingInProgress(true);
    try {
      const pendingLost = lostItems.filter(i => i.status === 'PENDING');
      const approvedFound = items.filter(i => i.status === 'APPROVED');
      const groupedMatches: any[] = [];

      for (const lost of pendingLost) {
        const results = await performSemanticMatch(lost, approvedFound);
        if (results && results.length > 0) {
          const matchesForThisLost: any[] = [];
          results.forEach(res => {
            if (res.matchScore > 0.6) {
              const foundItem = approvedFound.find(i => i.id === res.itemId);
              if (foundItem) {
                matchesForThisLost.push({
                  id: `MATCH-${lost.id}-${foundItem.id}`,
                  foundItem: foundItem,
                  score: res.matchScore,
                  reason: res.reason
                });
              }
            }
          });
          
          if (matchesForThisLost.length > 0) {
            groupedMatches.push({
              lostItem: lost,
              matches: matchesForThisLost.sort((a, b) => b.score - a.score)
            });
          }
        }
      }
      setAiMatches(groupedMatches);
    } catch (error) {
      console.error('AI Matching failed:', error);
    } finally {
      setMatchingInProgress(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'LOST_ITEMS' && lostItemsTab === 'AI_SUGGESTIONS') {
      runAiMatching();
    }
  }, [activeTab, lostItemsTab]);

  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  useEffect(() => {
    if (errorMessage) {
      const timer = setTimeout(() => setErrorMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [errorMessage]);

  const fetchAdmins = async () => {
    try {
      const response = await fetch(API_BASE + '/api/mgmt/accounts', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const data = await response.json();
          setAdmins(data);
        } else {
          const text = await response.text();
          console.error('Expected JSON from /api/mgmt/accounts but got:', text.substring(0, 100));
        }
      } else {
        const text = await response.text();
        if (response.status === 401 || response.status === 403) {
          console.warn('Auth failed for admins, logging out. Status:', response.status);
          onLogout();
        } else if (text.includes('<html>')) {
          console.error('HTML Error Response from /api/mgmt/accounts (GET):', text.substring(0, 100));
        }
      }
    } catch (error) {
      console.error('Failed to fetch admins:', error);
    }
  };

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage(null);
    try {
      const response = await fetch(API_BASE + '/api/mgmt/accounts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(newAdmin)
      });
      
      if (response.ok) {
        setSuccessMessage(t.adminCreated);
        setNewAdmin({ username: '', password: '', role: 'ADMIN' });
        setShowAdminForm(false);
        fetchAdmins();
      } else {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const data = await response.json();
          setErrorMessage(data.message || t.adminExists);
        } else {
          const text = await response.text();
          console.error('Non-JSON error response:', text);
          if (text.includes('403 Forbidden') && text.includes('<html>')) {
            setErrorMessage('Access Forbidden (403). This might be a security block from the server proxy. Please try again or contact support.');
          } else {
            setErrorMessage(`Server error: ${response.status}`);
          }
        }
      }
    } catch (error) {
      console.error('Failed to create admin:', error);
      setErrorMessage('Network error. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/mgmt/accounts/${editingAdmin.originalUsername}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          newUsername: editingAdmin.username,
          newPassword: editingAdmin.password,
          role: editingAdmin.role
        })
      });

      if (response.ok) {
        setEditingAdmin(null);
        fetchAdmins();
        setSuccessMessage(t.adminUpdated);
        setTimeout(() => setSuccessMessage(null), 3000);
      } else {
        const data = await response.json();
        setErrorMessage(data.message || 'Failed to update admin');
        setTimeout(() => setErrorMessage(null), 3000);
      }
    } catch (error) {
      console.error('Failed to update admin:', error);
      setErrorMessage('Network error occurred');
      setTimeout(() => setErrorMessage(null), 3000);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/mgmt/accounts/${editingUser.originalUsername}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          newUsername: editingUser.username,
          newPassword: editingUser.password,
          fullName: editingUser.fullName,
          email: editingUser.email,
          passportNumber: editingUser.passportNumber,
          phoneNumber: editingUser.phoneNumber
        })
      });

      if (response.ok) {
        setEditingUser(null);
        fetchAdmins();
        setSuccessMessage(isRTL ? 'تم تحديث بيانات المستخدم بنجاح' : 'User updated successfully');
        setTimeout(() => setSuccessMessage(null), 3000);
      } else {
        const data = await response.json();
        setErrorMessage(data.message || 'Failed to update user');
        setTimeout(() => setErrorMessage(null), 3000);
      }
    } catch (error) {
      console.error('Failed to update user:', error);
      setErrorMessage('Network error occurred');
      setTimeout(() => setErrorMessage(null), 3000);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAdmin = async (username: string) => {
    if (username === user.username) {
      if (isManager) {
        setShowDeleteSelfModal(true);
      } else {
        setErrorMessage(t.adminDeleteSelf);
      }
      return;
    }
    
    const adminToDeleteObj = admins.find(a => a.username === username);
    if (adminToDeleteObj && adminToDeleteObj.role === 'MANAGER') {
      setErrorMessage(t.cannotDeleteOtherManager);
      return;
    }
    
    setAdminToDelete(username);
  };

  const handleDeleteSelf = async (e: React.FormEvent) => {
    e.preventDefault();
    if (deleteSelfPasswords.password !== deleteSelfPasswords.confirmPassword) {
      setErrorMessage(t.passwordMismatch);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(API_BASE + '/api/mgmt/delete-self', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(deleteSelfPasswords)
      });

      if (response.ok) {
        onLogout();
      } else {
        const data = await response.json();
        setErrorMessage(data.message || t.incorrectPassword);
      }
    } catch (error) {
      console.error('Failed to delete self:', error);
      setErrorMessage('Network error occurred');
    } finally {
      setLoading(false);
    }
  };

  const confirmDeleteAdmin = async () => {
    if (!adminToDelete) return;
    try {
      const response = await fetch(`${API_BASE}/api/mgmt/accounts/${adminToDelete}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        setSuccessMessage(t.adminDeleteSuccess);
        fetchAdmins();
      } else {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const data = await response.json();
          setErrorMessage(data.message || 'Failed to delete admin');
        } else {
          const text = await response.text();
          console.error('Non-JSON error response:', text);
          setErrorMessage(`Server error: ${response.status}`);
        }
      }
    } catch (error) {
      console.error('Failed to delete admin:', error);
    } finally {
      setAdminToDelete(null);
    }
  };

  const handleCityChange = (city: City) => {
    setNewItem({ ...newItem, city, lat: null, lng: null });
  };

  const fetchFeedbacks = async (retries = 3) => {
    try {
      const response = await fetch(API_BASE + '/api/feedback', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const data = await response.json();
          setFeedbacks(data);
        } else {
          const text = await response.text();
          console.error('Expected JSON from /api/feedback (GET) but got:', text.substring(0, 100));
        }
      } else if (response.status === 401 || response.status === 403) {
        console.warn('Auth failed for feedbacks, logging out. Status:', response.status);
        onLogout();
      }
    } catch (error) {
      if (retries > 0) {
        setTimeout(() => fetchFeedbacks(retries - 1), 2000);
      } else {
        console.error('Failed to fetch feedbacks after retries:', error);
      }
    }
  };

  const fetchClaims = async (retries = 3) => {
    try {
      const response = await fetch(API_BASE + '/api/claims', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const data = await response.json();
          setClaims(data);
        } else {
          const text = await response.text();
          console.error('Expected JSON from /api/claims but got:', text.substring(0, 100));
        }
      } else if (response.status === 401 || response.status === 403) {
        console.warn('Auth failed for claims, logging out. Status:', response.status);
        onLogout();
      }
    } catch (error) {
      if (retries > 0) {
        setTimeout(() => fetchClaims(retries - 1), 2000);
      } else {
        console.error('Failed to fetch claims after retries:', error);
      }
    }
  };

  const handleViewClaim = async (claim: any) => {
    setSelectedClaim(claim);
    setUploaderInfo(null);
    const item = items.find(i => i.id === claim.itemId);
    if (item && item.submittedBy) {
      fetchUploaderInfo(item.submittedBy);
    }
  };

  const handleUpdateClaimStatus = async (claimId: string, status: 'APPROVED' | 'REJECTED') => {
    try {
      const response = await fetch(`${API_BASE}/api/claims/${claimId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status })
      });
      if (response.ok) {
        setSuccessMessage(status === 'APPROVED' ? t.approvalSuccess : t.rejectionSuccess);
        fetchClaims();
      }
    } catch (error) {
      console.error('Failed to update claim status:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const response = await fetch(API_BASE + '/api/feedback/mark-read', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ ids: feedbacks.map(f => f.id) })
      });
      if (response.ok) {
        fetchFeedbacks();
      }
    } catch (error) {
      console.error('Failed to mark as read:', error);
    }
  };

  const markAsRead = async (id: string) => {
    try {
      const response = await fetch(API_BASE + '/api/feedback/mark-read', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ ids: [id] })
      });
      if (response.ok) {
        fetchFeedbacks();
      }
    } catch (error) {
      console.error('Failed to mark as read:', error);
    }
  };

  const fetchUserInfo = async (username: string) => {
    if (username === 'Anonymous') return;
    setFetchingUser(true);
    try {
      const response = await fetch(`${API_BASE}/api/mgmt/users/${username}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setSelectedUser(data);
      } else {
        setErrorMessage(t.noUsersFound);
      }
    } catch (error) {
      console.error('Failed to fetch user info:', error);
    } finally {
      setFetchingUser(false);
    }
  };

  const fetchUploaderInfo = async (username: string) => {
    if (!username || username === 'Anonymous') {
      setUploaderInfo(null);
      return;
    }
    setFetchingUploader(true);
    try {
      const response = await fetch(`${API_BASE}/api/mgmt/users/${username}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setUploaderInfo(data);
      } else {
        setUploaderInfo(null);
      }
    } catch (error) {
      console.error('Failed to fetch uploader info:', error);
      setUploaderInfo(null);
    } finally {
      setFetchingUploader(false);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploading(true);
    try {
      // Auto-translate Arabic fields to English for search/multilingual support
      const translations = await translateItemFields({
        name: newItem.name,
        description: newItem.description,
        location: newItem.gateLocation,
        city: newItem.city
      });

      const itemToAdd: FoundItem = {
        id: `FI-${Date.now()}`,
        name: newItem.name,
        nameEn: translations.nameEn,
        description: newItem.description,
        descriptionEn: translations.descriptionEn,
        foundLocation: newItem.gateLocation,
        foundLocationEn: translations.locationEn,
        city: newItem.city,
        dateFound: newItem.date,
        pickupOffice: 'Main Security Office',
        pickupInstructions: 'Visit the security desk with ID.',
        imageUrl: newItem.images[0],
        imageUrls: newItem.images,
        status: 'APPROVED',
        ...(newItem.lat && newItem.lng ? { coordinates: { lat: newItem.lat, lng: newItem.lng } } : {})
      };
      
      onAddItem(itemToAdd);
      
      setShowUploadForm(false);
      setNewItem({
        name: '',
        description: '',
        gateLocation: '',
        date: '',
        city: City.MECCA,
        images: [] as string[],
        lat: null,
        lng: null
      });
    } catch (error) {
      console.error('Upload failed:', error);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = (id: string) => {
    setItemToDelete(id);
  };

  const confirmDeleteItem = async () => {
    if (!itemToDelete) return;
    const item = items.find(i => i.id === itemToDelete);
    try {
      await onDeleteItem(itemToDelete);
      if (item?.status === 'PENDING') {
        setSuccessMessage(t.rejectionSuccess);
      } else {
        setSuccessMessage(isRTL ? 'تم الحذف بنجاح' : 'Item deleted successfully');
      }
    } catch (error) {
      setErrorMessage(isRTL ? 'فشل الحذف' : 'Failed to delete item');
    } finally {
      setItemToDelete(null);
    }
  };

  const confirmDeleteLostItem = async () => {
    if (!lostItemToDelete) return;
    try {
      await onDeleteLostItem(lostItemToDelete);
      setSuccessMessage(isRTL ? 'تم حذف البلاغ بنجاح' : 'Lost report deleted successfully');
    } catch (error) {
      setErrorMessage(isRTL ? 'فشل حذف البلاغ' : 'Failed to delete lost report');
    } finally {
      setLostItemToDelete(null);
    }
  };

  const confirmResolveLostItem = async () => {
    if (!lostItemToResolve) return;
    try {
      await onResolveLostItem(lostItemToResolve);
      setSuccessMessage(isRTL ? 'تم حل البلاغ بنجاح' : 'Lost report resolved successfully');
    } catch (error) {
      setErrorMessage(isRTL ? 'فشل حل البلاغ' : 'Failed to resolve lost report');
    } finally {
      setLostItemToResolve(null);
    }
  };

  const handleApprove = async (id: string) => {
    try {
      await onApproveItem(id);
      setSuccessMessage(t.approvalSuccess);
    } catch (error) {
      setErrorMessage(isRTL ? 'فشل الموافقة' : 'Failed to approve item');
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    setUploading(true);
    setErrorMessage(null);
    try {
      // Auto-translate if changed
      const translations = await translateItemFields({
        name: editingItem.name,
        description: editingItem.description,
        location: editingItem.foundLocation,
        city: editingItem.city
      });
      
      const updatedItem = {
        ...editingItem,
        nameEn: translations.nameEn,
        descriptionEn: translations.descriptionEn,
        foundLocationEn: translations.locationEn
      };

      await onUpdateItem(updatedItem);
      setSuccessMessage(isRTL ? 'تم تحديث العنصر بنجاح' : 'Item updated successfully');
      setEditingItem(null);
    } catch (error) {
      console.error('Update failed:', error);
      setErrorMessage(isRTL ? 'فشل التحديث. يرجى المحاولة مرة أخرى.' : 'Update failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleUpdateLostItemSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLostItem) return;
    
    setUploading(true);
    try {
      await onUpdateLostItem(editingLostItem);
      setEditingLostItem(null);
      setSuccessMessage(isRTL ? 'تم تحديث البلاغ بنجاح' : 'Report updated successfully');
    } catch (error) {
      console.error('Lost item update failed:', error);
      setErrorMessage(isRTL ? 'فشل في تحديث البلاغ' : 'Failed to update report');
    } finally {
      setUploading(false);
    }
  };

  const unreadCount = feedbacks.filter(f => !f.read).length;
  const pendingApprovalsCount = items.filter(item => 
    (item.status === 'PENDING' || item.status === 'PENDING_DELETION') &&
    (pendingCityFilter === 'ALL' || item.city === pendingCityFilter)
  ).length;
  const lostItemsPendingCount = lostItems.filter(item => 
    item.status === 'PENDING' &&
    (lostItemsCityFilter === 'ALL' || item.city === lostItemsCityFilter)
  ).length;
  const pendingClaimsCount = claims.filter(c => c.status === 'PENDING').length;

  const hasSuspiciousClaims = React.useMemo(() => {
    const userClaimCounts: Record<string, number> = {};
    claims.forEach(c => {
      userClaimCounts[c.userEmail] = (userClaimCounts[c.userEmail] || 0) + 1;
    });
    return Object.values(userClaimCounts).some(count => count > 3);
  }, [claims]);

  const filteredFeedbacks = feedbacks.filter(f => 
    (feedbackFilter === 'ALL' ? true : f.type === feedbackFilter) &&
    matchesAny([f.message, f.userEmail, f.userName, f.id], searchTerm)
  );

  const approvedItems = items.filter(item => 
    item.status === 'APPROVED' && 
    (registeredCityFilter === 'ALL' || item.city === registeredCityFilter) &&
    matchesAny([
      item.name, item.nameEn, 
      item.description, item.descriptionEn, 
      item.foundLocation, item.foundLocationEn, 
      item.id, item.city, item.pickupOffice
    ], searchTerm)
  ).sort((a, b) => new Date(b.createdAt || b.dateFound).getTime() - new Date(a.createdAt || a.dateFound).getTime());

  const filteredLostItems = lostItems.filter(item => 
    (lostItemsCityFilter === 'ALL' || item.city === lostItemsCityFilter) &&
    matchesAny([
      item.name, item.description, 
      item.userEmail, item.id, item.city
    ], searchTerm)
  ).sort((a, b) => new Date(b.createdAt || b.dateLost || '').getTime() - new Date(a.createdAt || a.dateLost || '').getTime());

  const pendingItems = items.filter(item => 
    (item.status === 'PENDING' || item.status === 'PENDING_DELETION') &&
    (pendingCityFilter === 'ALL' || item.city === pendingCityFilter) &&
    matchesAny([
      item.name, item.nameEn, 
      item.description, item.descriptionEn, 
      item.foundLocation, item.foundLocationEn, 
      item.id, item.city
    ], searchTerm)
  ).sort((a, b) => new Date(b.createdAt || b.dateFound).getTime() - new Date(a.createdAt || a.dateFound).getTime());

  const filteredClaims = (claimsTab === 'ALL' 
    ? claims 
    : claims.filter(c => claims.filter(allC => allC.userEmail === c.userEmail).length > 8)
  ).filter(c => 
    matchesAny([c.userEmail, c.userName, c.itemName, c.description, c.id, c.userPassport, c.userPhone], searchTerm)
  );

  const filteredAiMatches = aiMatches.filter(group => 
    matchesAny([
      group.lostItem.name, 
      group.lostItem.description, 
      group.lostItem.userEmail, 
      group.lostItem.id
    ], searchTerm)
  );

  return (
    <>
      {/* Image Viewer */}
      {viewerImages && (
        <ImageViewer
          images={viewerImages}
          initialIndex={viewerIndex}
          onClose={() => setViewerImages(null)}
          isRTL={isRTL}
        />
      )}

      {/* Success Message Toast */}
      <AnimatePresence>
        {successMessage && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[9999] px-6 py-3 bg-emerald-600 text-white rounded-full shadow-2xl flex items-center gap-3"
          >
            <i className="fas fa-check-circle"></i>
            <span className="font-medium">{successMessage}</span>
            <button onClick={() => setSuccessMessage(null)} className="ml-2 hover:opacity-70">
              <i className="fas fa-times"></i>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {errorMessage && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[9999] px-6 py-3 bg-red-600 text-white rounded-full shadow-2xl flex items-center gap-3"
          >
            <i className="fas fa-exclamation-circle"></i>
            <span className="font-medium">{errorMessage}</span>
            <button onClick={() => setErrorMessage(null)} className="ml-2 hover:opacity-70">
              <i className="fas fa-times"></i>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Self Modal */}
      <AnimatePresence>
        {showDeleteSelfModal && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowDeleteSelfModal(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-md bg-white dark:bg-gray-900 rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="p-6">
                <div className="w-12 h-12 bg-red-100 dark:bg-red-900/20 text-red-600 rounded-full flex items-center justify-center mb-4 mx-auto">
                  <i className="fas fa-user-slash text-xl"></i>
                </div>
                <h3 className="text-xl font-bold text-center mb-2 dark:text-white">
                  {t.deleteMyAccount}
                </h3>
                <p className="text-sm text-slate-500 text-center mb-6">
                  {isRTL ? 'يرجى إدخال كلمة المرور مرتين للتأكيد' : 'Please enter your password twice to confirm'}
                </p>
                
                <form onSubmit={handleDeleteSelf} className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">{t.confirmDeletePassword}</label>
                    <input 
                      type="password"
                      required
                      value={deleteSelfPasswords.password}
                      onChange={(e) => setDeleteSelfPasswords({...deleteSelfPasswords, password: e.target.value})}
                      className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-emerald-950/20 border border-slate-200 dark:border-emerald-900/20 focus:ring-2 focus:ring-emerald-500 outline-none transition-all text-sm dark:text-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">{t.confirmDeletePasswordAgain}</label>
                    <input 
                      type="password"
                      required
                      value={deleteSelfPasswords.confirmPassword}
                      onChange={(e) => setDeleteSelfPasswords({...deleteSelfPasswords, confirmPassword: e.target.value})}
                      className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-emerald-950/20 border border-slate-200 dark:border-emerald-900/20 focus:ring-2 focus:ring-emerald-500 outline-none transition-all text-sm dark:text-white"
                    />
                    {deleteSelfPasswords.confirmPassword && (
                      <div className={`mt-1 flex items-center space-x-2 rtl:space-x-reverse transition-all duration-300 ${deleteSelfPasswords.password === deleteSelfPasswords.confirmPassword ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'}`}>
                        <i className={`fas ${deleteSelfPasswords.password === deleteSelfPasswords.confirmPassword ? 'fa-check-circle' : 'fa-times-circle'} text-xs`}></i>
                        <span className="text-[10px] font-black uppercase tracking-widest">
                          {deleteSelfPasswords.password === deleteSelfPasswords.confirmPassword ? t.passwordsMatch : t.passwordsDoNotMatch}
                        </span>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex gap-3 mt-6">
                    <button
                      type="button"
                      onClick={() => setShowDeleteSelfModal(false)}
                      className="flex-1 px-4 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors dark:text-white"
                    >
                      {t.cancel}
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
                    >
                      {loading ? (isRTL ? 'جاري الحذف...' : 'Deleting...') : t.deleteAccountBtn}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {(itemToDelete || adminToDelete || lostItemToDelete || lostItemToResolve) && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => { setItemToDelete(null); setAdminToDelete(null); setLostItemToDelete(null); setLostItemToResolve(null); }}
              className="absolute inset-0 bg-black/60 backdrop-blur-xl"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-md bg-white/80 dark:bg-[#162923]/80 backdrop-blur-2xl rounded-[40px] shadow-2xl overflow-hidden border border-white/20 dark:border-emerald-900/20"
            >
              <div className="p-8">
                <div className={`w-16 h-16 ${lostItemToResolve ? 'bg-emerald-100 dark:bg-emerald-900/20 text-emerald-600' : 'bg-red-100 dark:bg-red-900/20 text-red-600'} rounded-3xl flex items-center justify-center mb-6 mx-auto shadow-lg`}>
                  <i className={`fas ${lostItemToResolve ? 'fa-check-circle' : 'fa-exclamation-triangle'} text-2xl`}></i>
                </div>
                <h3 className="text-2xl font-black text-center mb-2 text-slate-800 dark:text-white tracking-tight">
                  {lostItemToResolve ? (isRTL ? 'هل أنت متأكد من حل هذا البلاغ؟' : 'Are you sure you want to resolve this report?') : 
                   lostItemToDelete ? (isRTL ? 'هل أنت متأكد من حذف هذا البلاغ؟' : 'Are you sure you want to delete this report?') :
                   itemToDelete ? t.deleteConfirm : t.deleteAdminConfirm}
                </h3>
                <p className="text-center text-slate-500 dark:text-slate-400 text-sm mb-8">
                  {isRTL ? 'لا يمكن التراجع عن هذا الإجراء.' : 'This action cannot be undone.'}
                </p>
                <div className="flex gap-4">
                  <button
                    onClick={() => { setItemToDelete(null); setAdminToDelete(null); setLostItemToDelete(null); setLostItemToResolve(null); }}
                    className="flex-1 px-6 py-4 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/10 transition-all"
                  >
                    {t.cancel}
                  </button>
                  <button
                    onClick={lostItemToResolve ? confirmResolveLostItem : lostItemToDelete ? confirmDeleteLostItem : itemToDelete ? confirmDeleteItem : confirmDeleteAdmin}
                    className={`flex-1 px-6 py-4 ${lostItemToResolve ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/30' : 'bg-red-600 hover:bg-red-700 shadow-red-600/30'} text-white rounded-2xl font-bold shadow-xl transition-all hover:scale-[1.02] active:scale-[0.98]`}
                  >
                    {isRTL ? 'تأكيد' : 'Confirm'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="flex flex-col lg:flex-row min-h-[calc(100vh-64px)] bg-creamy dark:bg-[#061410] transition-colors duration-300 relative overflow-hidden" dir={isRTL ? 'rtl' : 'ltr'}>
        {/* Decorative background elements */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-emerald-500/10 blur-[120px] rounded-full animate-pulse" />
          <div className="absolute -bottom-[10%] -right-[10%] w-[40%] h-[40%] bg-emerald-600/10 blur-[120px] rounded-full animate-pulse delay-700" />
        </div>

        {/* Sidebar */}
        <aside className="w-full lg:w-72 bg-white/40 dark:bg-[#162923]/40 backdrop-blur-2xl border-b lg:border-b-0 lg:border-r rtl:lg:border-r-0 rtl:lg:border-l border-white/20 dark:border-emerald-900/20 flex flex-col sticky top-0 lg:h-[calc(100vh-64px)] z-40">
          <div className="p-6 border-b border-white/10 dark:border-emerald-900/10">
            <h2 className="text-2xl font-black text-emerald-700 dark:text-emerald-500 tracking-tighter">MAWJOOD</h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{t.managementPortal}</p>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar">
            <nav className="p-4 space-y-2">
              {[
                { id: 'ITEMS', icon: 'fa-box', label: t.viewItems },
                { id: 'LOST_ITEMS', icon: 'fa-bullhorn', label: t.reportLost || 'Lost Items', badge: lostItemsPendingCount, badgeColor: 'bg-rose-500' },
                { id: 'PENDING', icon: 'fa-clock', label: t.pendingApprovals, badge: pendingApprovalsCount, badgeColor: 'bg-indigo-500' },
                { id: 'FEEDBACK', icon: 'fa-comment-alt', label: t.viewFeedback, badge: unreadCount, badgeColor: 'bg-violet-600' },
                { id: 'CLAIMS', icon: 'fa-hand-holding-heart', label: t.viewClaims, badge: pendingClaimsCount, badgeColor: 'bg-sky-500' },
                { id: 'ADMINS', icon: 'fa-user-shield', label: t.manageAccounts || (isRTL ? 'إدارة الحسابات' : 'Manage Accounts'), condition: isAdmin || isManager }
              ].map((item) => (
                (item.condition === undefined || item.condition) && (
                  <button
                    key={item.id}
                    onClick={() => { setActiveTab(item.id as any); setSearchTerm(''); }}
                    className={`w-full flex items-center px-4 py-3 rounded-2xl text-sm font-bold transition-all relative group hover:scale-[1.02] active:scale-[0.98] ${
                      activeTab === item.id 
                        ? 'bg-emerald-700 text-white shadow-xl shadow-emerald-700/30' 
                        : 'text-slate-500 hover:bg-white/50 dark:hover:bg-emerald-900/20'
                    }`}
                  >
                    <i className={`fas ${item.icon} w-6 transition-transform group-hover:scale-110 ${isRTL ? 'ml-2' : 'mr-2'}`}></i>
                    <span>{item.label}</span>
                    {item.badge !== undefined && item.badge > 0 && (
                      <span className={`absolute ${isRTL ? 'left-4' : 'right-4'} top-1.35 -translate-y-1/2 w-5 h-5 ${item.badgeColor} text-white text-[10px] flex items-center justify-center rounded-full border-2 border-white dark:border-[#162923] shadow-md animate-pulse`}>
                        {item.badge}
                      </span>
                    )}
                  </button>
                )
              ))}
            </nav>

            {/* Sidebar Stats Grid */}
            <div className="px-4 py-4 border-t border-white/10 dark:border-emerald-900/10">
              <div className="space-y-2">
                {[
                  { label: isRTL ? 'العناصر' : 'Items', value: items.length, icon: 'fa-box', color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
                  { label: isRTL ? 'معلق' : 'Pending', value: pendingItems.length, icon: 'fa-clock', color: 'text-amber-500', bg: 'bg-amber-500/10' },
                  { label: isRTL ? 'ملاحظات' : 'Feedback', value: feedbacks.length, icon: 'fa-comment-alt', color: 'text-blue-500', bg: 'bg-blue-500/10' },
                  { label: isRTL ? 'فريق العمل' : 'Staff', value: admins.filter(a => a.role === 'ADMIN' || a.role === 'MANAGER').length, icon: 'fa-users-cog', color: 'text-purple-500', bg: 'bg-purple-500/10' }
                ].map((stat, idx) => (
                  <motion.div 
                    key={idx}
                    initial={{ opacity: 0, x: isRTL ? 20 : -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="bg-white/60 dark:bg-emerald-900/20 p-3 rounded-2xl border border-white/20 dark:border-emerald-900/30 shadow-sm group hover:scale-[1.02] active:scale-[0.98] transition-all cursor-default"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3 rtl:space-x-reverse">
                        <div className={`w-8 h-8 ${stat.bg} rounded-lg flex items-center justify-center shadow-inner`}>
                          <i className={`fas ${stat.icon} ${stat.color} text-sm`}></i>
                        </div>
                        <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">{stat.label}</span>
                      </div>
                      <div className="text-xl font-black text-slate-800 dark:text-white tracking-tighter tabular-nums">{stat.value}</div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>

          <div className="p-4 border-t border-white/10 dark:border-emerald-900/10 space-y-2 mt-auto">
            <button 
              onClick={onToggleView}
              className="w-full flex items-center px-4 py-3 rounded-2xl text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50/50 dark:hover:bg-emerald-900/20 transition-all uppercase tracking-widest"
            >
              <i className="fas fa-exchange-alt w-6 transition-transform group-hover:rotate-180"></i>
              <span>{t.switchToUserView || 'SWITCH TO USER VIEW'}</span>
            </button>
            <button 
              onClick={onLogout}
              className="w-full flex items-center px-4 py-3 rounded-2xl text-xs font-bold text-red-500 hover:bg-red-50/50 dark:hover:bg-red-900/20 transition-all uppercase tracking-widest"
            >
              <i className="fas fa-sign-out-alt w-6 transition-transform group-hover:-translate-x-1 rtl:group-hover:translate-x-1"></i>
              <span>{t.logout}</span>
            </button>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 flex flex-col h-[calc(100vh-64px)] overflow-hidden relative z-10">
          <div className="p-4 md:p-8 pb-0 shrink-0">
            {/* Tab Content Header */}
            <motion.div 
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white/40 dark:bg-[#162923]/40 backdrop-blur-2xl p-6 rounded-[40px] border border-white/20 dark:border-emerald-900/20 shadow-2xl"
          >
            <div className={`flex flex-col ${(activeTab === 'CLAIMS' || activeTab === 'ADMINS') ? 'items-start' : 'md:flex-row md:items-center justify-between'} gap-4 mb-8`}>
              <div>
                <h2 className="text-3xl font-black text-slate-800 dark:text-white tracking-tight">
                  {activeTab === 'ITEMS' ? t.registeredItems : 
                   activeTab === 'LOST_ITEMS' ? (t.reportLost || 'Lost Items') :
                   activeTab === 'PENDING' ? t.pendingApprovals : 
                   activeTab === 'FEEDBACK' ? t.feedbackDashboard : 
                   activeTab === 'CLAIMS' ? t.claimRequests : 
                   (adminViewMode === 'ADMINS' ? t.adminList : t.showUsers)}
                </h2>
                <p className="text-slate-500 dark:text-slate-400 mt-1 font-medium">
                  {activeTab === 'ITEMS' ? t.manageLostItems : 
                   activeTab === 'LOST_ITEMS' ? (isRTL ? 'إدارة العناصر المفقودة المبلغ عنها' : 'Manage reported lost items') :
                   activeTab === 'PENDING' ? (isRTL ? 'مراجعة العناصر الجديدة' : 'Review new item submissions') :
                   activeTab === 'FEEDBACK' ? t.allFeedback :
                   activeTab === 'CLAIMS' ? (isRTL ? 'إدارة طلبات الاستلام' : 'Manage item claim requests') :
                   (adminViewMode === 'ADMINS' ? (isRTL ? 'إدارة فريق العمل' : 'Manage system administrators') : (isRTL ? 'إدارة المستخدمين' : 'Manage users'))}
                </p>
              </div>

              <div className="flex items-center gap-3">
                {activeTab === 'CLAIMS' && (
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => setClaimsTab('ALL')}
                      className={`px-6 py-3 rounded-2xl text-xs font-bold transition-all border shadow-sm ${
                        claimsTab === 'ALL'
                          ? 'bg-emerald-700 text-white border-emerald-700 shadow-lg shadow-emerald-700/20'
                          : 'bg-white dark:bg-emerald-950/40 text-slate-500 border-slate-200 dark:border-emerald-900/20 hover:border-emerald-500/50'
                      }`}
                    >
                      {isRTL ? 'جميع الطلبات' : 'All Claims'}
                    </button>
                    <button
                      onClick={() => setClaimsTab('SUSPICIOUS')}
                      className={`px-6 py-3 rounded-2xl text-xs font-bold transition-all flex items-center space-x-2 rtl:space-x-reverse border shadow-sm ${
                        claimsTab === 'SUSPICIOUS'
                          ? 'bg-rose-600 text-white border-rose-600 shadow-lg shadow-rose-600/20'
                          : 'bg-white dark:bg-emerald-950/40 text-slate-500 border-slate-200 dark:border-emerald-900/20 hover:border-rose-500/50'
                      }`}
                    >
                      <i className="fas fa-user-secret"></i>
                      <span>{isRTL ? 'نشاط مشبوه' : 'Suspicious Activity'}</span>
                      {claims.filter(c => claims.filter(allC => allC.userEmail === c.userEmail).length > 8).length > 0 && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${claimsTab === 'SUSPICIOUS' ? 'bg-white text-rose-600' : 'bg-rose-100 text-rose-600'}`}>
                          {new Set(claims.filter(c => claims.filter(allC => allC.userEmail === c.userEmail).length > 8).map(c => c.userEmail)).size}
                        </span>
                      )}
                    </button>
                  </div>
                )}

                {activeTab === 'ADMINS' && isManager && (
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => setAdminViewMode('ADMINS')}
                      className={`px-6 py-3 rounded-2xl text-xs font-bold transition-all border shadow-sm ${
                        adminViewMode === 'ADMINS'
                          ? 'bg-emerald-700 text-white border-emerald-700 shadow-lg shadow-emerald-700/20'
                          : 'bg-white dark:bg-emerald-950/40 text-slate-500 border-slate-200 dark:border-emerald-900/20 hover:border-emerald-500/50'
                      }`}
                    >
                      {t.showAdmins}
                    </button>
                    <button
                      onClick={() => setAdminViewMode('USERS')}
                      className={`px-6 py-3 rounded-2xl text-xs font-bold transition-all border shadow-sm ${
                        adminViewMode === 'USERS'
                          ? 'bg-emerald-700 text-white border-emerald-700 shadow-lg shadow-emerald-700/20'
                          : 'bg-white dark:bg-emerald-950/40 text-slate-500 border-slate-200 dark:border-emerald-900/20 hover:border-emerald-500/50'
                      }`}
                    >
                      {t.showUsers}
                    </button>
                  </div>
                )}

                {activeTab === 'ADMINS' && adminViewMode === 'ADMINS' && (
                  <button 
                    onClick={() => setShowAdminForm(true)}
                    className="px-6 py-3.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-2xl font-bold shadow-xl shadow-emerald-700/30 transition-all flex items-center space-x-2 rtl:space-x-reverse hover:scale-[1.02] active:scale-[0.98]"
                  >
                    <i className="fas fa-user-plus"></i>
                    <span>{t.addAdmin}</span>
                  </button>
                )}

                {activeTab === 'ITEMS' && (
                  <button 
                    onClick={() => setShowUploadForm(true)}
                    className="px-6 py-3.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-2xl font-bold shadow-xl shadow-emerald-700/30 transition-all flex items-center space-x-2 rtl:space-x-reverse hover:scale-[1.02] active:scale-[0.98]"
                  >
                    <i className="fas fa-plus"></i>
                    <span>{t.uploadMissingItem}</span>
                  </button>
                )}

                {activeTab === 'FEEDBACK' && unreadCount > 0 && (
                  <button 
                    onClick={markAllAsRead}
                    className="px-6 py-3.5 bg-slate-800 hover:bg-slate-900 text-white rounded-2xl font-bold shadow-xl transition-all flex items-center space-x-2 rtl:space-x-reverse hover:scale-[1.02] active:scale-[0.98]"
                  >
                    <i className="fas fa-check-double"></i>
                    <span>{t.markAllRead}</span>
                  </button>
                )}
              </div>
            </div>

      {activeTab === 'FEEDBACK' && (
        <div className="flex flex-wrap gap-2 mb-4">
          {[
            { id: 'ALL', label: t.allFeedback, icon: 'fa-list' },
            { id: 'GENERAL', label: t.feedbackGeneral, icon: 'fa-comment' },
            { id: 'COMPLAINT', label: t.feedbackComplaint, icon: 'fa-exclamation-circle' },
            { id: 'RECOMMENDATION', label: t.feedbackRecommendation, icon: 'fa-lightbulb' }
          ].map((filter) => (
            <button
              key={filter.id}
              onClick={() => setFeedbackFilter(filter.id as any)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center border ${
                feedbackFilter === filter.id
                  ? 'bg-emerald-600 border-emerald-600 text-white shadow-lg shadow-emerald-600/20'
                  : 'bg-white dark:bg-[#0f1f1a] border-slate-200 dark:border-emerald-900/20 text-slate-600 dark:text-slate-400 hover:border-emerald-500'
              }`}
            >
              <i className={`fas ${filter.icon} ${isRTL ? 'ml-2' : 'mr-2'}`}></i>
              {filter.label}
            </button>
          ))}
        </div>
      )}

      {activeTab === 'PENDING' && (
        <div className="flex flex-wrap gap-2 mb-4">
          {[
            { id: 'ALL', label: isRTL ? 'الكل' : 'All', icon: 'fa-list' },
            { id: City.MECCA, label: isRTL ? 'مكة المكرمة' : 'Makkah', icon: 'fa-kaaba' },
            { id: City.MADINA, label: isRTL ? 'المدينة المنورة' : 'Madina', icon: 'fa-mosque' }
          ].map((filter) => (
            <button
              key={filter.id}
              onClick={() => setPendingCityFilter(filter.id as any)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center border ${
                pendingCityFilter === filter.id
                  ? 'bg-emerald-600 border-emerald-600 text-white shadow-lg shadow-emerald-600/20'
                  : 'bg-white dark:bg-[#0f1f1a] border-slate-200 dark:border-emerald-900/20 text-slate-600 dark:text-slate-400 hover:border-emerald-500'
              }`}
            >
              <i className={`fas ${filter.icon} ${isRTL ? 'ml-2' : 'mr-2'}`}></i>
              {filter.label}
            </button>
          ))}
        </div>
      )}

      {activeTab === 'ITEMS' && (
        <div className="flex flex-wrap gap-2 mb-4">
          {[
            { id: 'ALL', label: isRTL ? 'الكل' : 'All', icon: 'fa-list' },
            { id: City.MECCA, label: isRTL ? 'مكة المكرمة' : 'Makkah', icon: 'fa-kaaba' },
            { id: City.MADINA, label: isRTL ? 'المدينة المنورة' : 'Madina', icon: 'fa-mosque' }
          ].map((filter) => (
            <button
              key={filter.id}
              onClick={() => setRegisteredCityFilter(filter.id as any)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center border ${
                registeredCityFilter === filter.id
                  ? 'bg-emerald-600 border-emerald-600 text-white shadow-lg shadow-emerald-600/20'
                  : 'bg-white dark:bg-[#0f1f1a] border-slate-200 dark:border-emerald-900/20 text-slate-600 dark:text-slate-400 hover:border-emerald-500'
              }`}
            >
              <i className={`fas ${filter.icon} ${isRTL ? 'ml-2' : 'mr-2'}`}></i>
              {filter.label}
            </button>
          ))}
        </div>
      )}

      {activeTab === 'LOST_ITEMS' && (
        <div className="flex flex-wrap gap-2 mb-4">
          {[
            { id: 'ALL', label: isRTL ? 'الكل' : 'All', icon: 'fa-list' },
            { id: City.MECCA, label: isRTL ? 'مكة المكرمة' : 'Makkah', icon: 'fa-kaaba' },
            { id: City.MADINA, label: isRTL ? 'المدينة المنورة' : 'Madina', icon: 'fa-mosque' }
          ].map((filter) => (
            <button
              key={filter.id}
              onClick={() => setLostItemsCityFilter(filter.id as any)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center border ${
                lostItemsCityFilter === filter.id
                  ? 'bg-emerald-600 border-emerald-600 text-white shadow-lg shadow-emerald-600/20'
                  : 'bg-white dark:bg-[#0f1f1a] border-slate-200 dark:border-emerald-900/20 text-slate-600 dark:text-slate-400 hover:border-emerald-500'
              }`}
            >
              <i className={`fas ${filter.icon} ${isRTL ? 'ml-2' : 'mr-2'}`}></i>
              {filter.label}
            </button>
          ))}
        </div>
      )}
            </motion.div>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-8 pt-4">
            <div className="bg-white dark:bg-[#061410]/40 rounded-3xl border border-slate-200 dark:border-emerald-900/20 overflow-hidden shadow-sm">
        <div className="p-6 border-b border-slate-100 dark:border-emerald-900/10 flex items-center justify-between">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="flex items-center justify-between w-full"
            >
              <h3 className="font-bold text-slate-800 dark:text-white">
                {activeTab === 'ITEMS' ? t.registeredItems : activeTab === 'LOST_ITEMS' ? (t.reportLost || 'Lost Items') : activeTab === 'PENDING' ? t.pendingApprovals : activeTab === 'ADMINS' ? (adminViewMode === 'ADMINS' ? t.adminList : t.showUsers) : activeTab === 'CLAIMS' ? t.claimRequests : t.feedbackDashboard}
              </h3>
              <span className="px-3 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-xs font-bold rounded-full">
                {activeTab === 'ITEMS' ? approvedItems.length : activeTab === 'LOST_ITEMS' ? filteredLostItems.length : activeTab === 'PENDING' ? pendingItems.length : activeTab === 'ADMINS' ? admins.filter(a => adminViewMode === 'ADMINS' ? (a.role === 'ADMIN' || a.role === 'MANAGER') : a.role === 'USER').length : activeTab === 'CLAIMS' ? claims.length : filteredFeedbacks.length} {activeTab === 'FEEDBACK' ? t.feedbackGeneral : activeTab === 'ADMINS' ? (adminViewMode === 'ADMINS' ? t.adminPortal : t.userPortal) : activeTab === 'CLAIMS' ? t.claimRequests : t.item}
              </span>
            </motion.div>
          </AnimatePresence>
        </div>
        
        <div className="bg-white dark:bg-[#162923] rounded-[40px] border border-slate-200 dark:border-emerald-900/20 shadow-xl overflow-hidden transition-colors duration-300">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.02 }}
              transition={{ duration: 0.3 }}
              className="p-2 md:p-6"
            >
              {activeTab !== 'ADMINS' && (
                <div className="-mx-2 md:-mx-6 mb-6 p-4 bg-slate-50/50 dark:bg-emerald-950/10 border-b border-slate-100 dark:border-emerald-900/10">
                  <div className="relative">
                    <i className={`fas fa-search absolute ${isRTL ? 'right-4' : 'left-4'} top-1/2 -translate-y-1/2 text-slate-400`}></i>
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder={
                        activeTab === 'ITEMS' ? (isRTL ? 'البحث عن العناصر...' : 'Search items...') :
                        activeTab === 'LOST_ITEMS' ? (isRTL ? 'البحث عن البلاغات...' : 'Search reports...') :
                        activeTab === 'PENDING' ? (isRTL ? 'البحث في الطلبات المعلقة...' : 'Search pending approvals...') :
                        activeTab === 'FEEDBACK' ? (
                          feedbackFilter === 'ALL' ? (isRTL ? 'البحث في جميع المراجعات...' : 'Search all reviews...') :
                          feedbackFilter === 'GENERAL' ? (isRTL ? 'البحث في الملاحظات...' : 'Search feedback...') :
                          feedbackFilter === 'COMPLAINT' ? (isRTL ? 'البحث في الشكاوى...' : 'Search complaints...') :
                          (isRTL ? 'البحث في الاقتراحات...' : 'Search recommendations...')
                        ) :
                        activeTab === 'CLAIMS' ? (isRTL ? 'البحث في طلبات الاستلام...' : 'Search claims...') :
                        (isRTL ? 'بحث...' : 'Search...')
                      }
                      className={`w-full ${isRTL ? 'pr-12 pl-4' : 'pl-12 pr-4'} py-3 bg-white dark:bg-[#0f1f1a] border border-slate-200 dark:border-emerald-900/20 rounded-2xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition-all dark:text-white shadow-sm`}
                    />
                  </div>
                </div>
              )}
              {activeTab === 'LOST_ITEMS' && (
                <div className="flex items-center space-x-3 rtl:space-x-reverse mb-6">
                  <button 
                    onClick={() => setLostItemsTab('REPORTED')}
                    className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                      lostItemsTab === 'REPORTED' 
                        ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20' 
                        : 'bg-white dark:bg-emerald-950/20 text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    {isRTL ? 'البلاغات المقدمة' : 'Reported Lost'}
                  </button>
                  <button 
                    onClick={() => setLostItemsTab('AI_SUGGESTIONS')}
                    className={`px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center space-x-2 rtl:space-x-reverse ${
                      lostItemsTab === 'AI_SUGGESTIONS' 
                        ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/20' 
                        : 'bg-white dark:bg-emerald-950/20 text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    <i className="fas fa-robot"></i>
                    <span>{isRTL ? 'اقتراحات الذكاء الاصطناعي' : 'AI Suggestions'}</span>
                    {aiMatches.length > 0 && (
                      <span className="bg-white text-purple-600 text-[10px] px-1.5 py-0.5 rounded-full">
                        {aiMatches.length}
                      </span>
                    )}
                  </button>
                </div>
              )}
              {activeTab === 'ITEMS' || activeTab === 'PENDING' || activeTab === 'LOST_ITEMS' ? (
            <table className="w-full text-left rtl:text-right">
              <thead className="bg-slate-50 dark:bg-emerald-950/20 text-[10px] uppercase tracking-widest text-slate-500 dark:text-slate-500 font-bold">
                <tr>
                  <th className="px-6 py-4">{t.item}</th>
                  <th className="px-6 py-4">{lostItemsTab === 'AI_SUGGESTIONS' ? (isRTL ? 'صاحب البلاغ' : 'Reporter') : t.location}</th>
                  <th className="px-6 py-4">{t.date}</th>
                  <th className="px-6 py-4">{t.actions}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-emerald-900/10">
                {loading ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center space-y-3">
                        <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                        <span className="text-sm text-slate-500">{isRTL ? 'جاري التحميل...' : 'Loading items...'}</span>
                      </div>
                    </td>
                  </tr>
                ) : (activeTab === 'ITEMS' ? approvedItems : activeTab === 'LOST_ITEMS' ? filteredLostItems : pendingItems).length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-slate-500">
                      {activeTab === 'ITEMS' ? (isRTL ? 'لا توجد عناصر مسجلة حالياً' : 'No items registered yet') : activeTab === 'LOST_ITEMS' ? (isRTL ? 'لا توجد عناصر مفقودة مسجلة حالياً' : 'No lost items registered yet') : (
                        pendingCityFilter === 'ALL' ? t.noPendingItems : (isRTL ? `لا توجد طلبات معلقة في ${pendingCityFilter === City.MECCA ? 'مكة' : 'المدينة'}` : `No pending items in ${pendingCityFilter}`)
                      )}
                    </td>
                  </tr>
                ) : activeTab === 'LOST_ITEMS' ? (
                  lostItemsTab === 'AI_SUGGESTIONS' ? (
                    matchingInProgress ? (
                      <tr>
                        <td colSpan={4} className="px-6 py-12 text-center">
                          <div className="flex flex-col items-center">
                            <div className="w-12 h-12 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin mb-4"></div>
                            <p className="text-sm font-bold text-purple-600 animate-pulse">
                              {isRTL ? 'جاري البحث عن تطابقات باستخدام الذكاء الاصطناعي...' : 'AI is searching for potential matches...'}
                            </p>
                          </div>
                        </td>
                      </tr>
                    ) : filteredAiMatches.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-6 py-12 text-center text-slate-500">
                          {isRTL ? 'لا توجد تطابقات مقترحة حالياً' : 'No suggested matches found'}
                        </td>
                      </tr>
                    ) : (
                      filteredAiMatches.map((group) => (
                        <tr key={group.lostItem.id} className="hover:bg-purple-50/30 dark:hover:bg-purple-900/5 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-center space-x-4 rtl:space-x-reverse">
                              <div className="w-12 h-12 rounded-lg bg-slate-100 dark:bg-emerald-900/20 overflow-hidden shadow-sm">
                                <img src={group.lostItem.images?.[0]} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                              </div>
                              <div>
                                <div className="text-sm font-black text-slate-800 dark:text-white">
                                  {group.lostItem.name}
                                </div>
                                <div className="flex items-center mt-0.5">
                                  <span className="text-[10px] font-bold text-purple-600 bg-purple-100 dark:bg-purple-900/30 px-1.5 py-0.5 rounded">
                                    {group.matches.length} {isRTL ? 'تطابقات مقترحة' : 'Suggested Matches'}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center space-x-2 rtl:space-x-reverse">
                              <button 
                                onClick={() => fetchUserInfo(group.lostItem.userId!)}
                                className="p-2 text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/10 rounded-lg transition-all"
                                title={isRTL ? 'بيانات صاحب البلاغ' : 'Lost Reporter Info'}
                              >
                                <i className="fas fa-user-tag"></i>
                              </button>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300">
                              {formatDate(group.lostItem.dateLost)}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center space-x-2 rtl:space-x-reverse">
                              <button 
                                onClick={() => setSelectedMatchLostItem(group)}
                                className="px-3 py-1.5 bg-purple-600 text-white text-[10px] font-bold rounded-lg hover:bg-purple-700 transition-all shadow-lg shadow-purple-600/20 flex items-center space-x-1 rtl:space-x-reverse"
                              >
                                <i className="fas fa-list-ul"></i>
                                <span>{isRTL ? 'عرض التطابقات' : 'View Matches'}</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )
                  ) :
                    filteredLostItems.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-emerald-900/5 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-3 rtl:space-x-reverse">
                          <div 
                            className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-emerald-900/20 flex items-center justify-center overflow-hidden cursor-pointer hover:opacity-80 transition-opacity"
                            onClick={() => {
                              if (item.images && item.images.length > 0) {
                                setViewerImages(item.images);
                                setViewerIndex(0);
                              }
                            }}
                          >
                            {item.images && item.images.length > 0 ? (
                              <img src={item.images[0]} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            ) : (
                              <i className="fas fa-bullhorn text-slate-400"></i>
                            )}
                          </div>
                          <div>
                            <div className="flex items-center">
                              <div className="text-sm font-bold text-slate-800 dark:text-white mr-2 rtl:ml-2">
                                {item.name}
                              </div>
                            </div>
                            <div className="text-xs text-slate-500 line-clamp-1 max-w-[200px]">
                              {item.description}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-[10px] text-slate-500">{item.city}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">{formatDate(item.dateLost)}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-2 rtl:space-x-reverse">
                          <button 
                            onClick={() => fetchUserInfo(item.userId!)}
                            className="p-2 text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/10 rounded-lg transition-all"
                            title={t.viewUserInfo}
                          >
                            <i className="fas fa-id-card"></i>
                          </button>
                          <button 
                            onClick={() => setEditingLostItem(item)}
                            className="p-2 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/10 rounded-lg transition-all"
                            title={t.edit}
                          >
                            <i className="fas fa-edit"></i>
                          </button>
                          <button 
                            onClick={() => setLostItemToDelete(item.id!)}
                            className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-lg transition-all"
                            title={isRTL ? 'حذف' : 'Delete'}
                          >
                            <i className="fas fa-trash-alt"></i>
                          </button>
                          {item.status !== 'RESOLVED' && (
                            <button 
                              onClick={() => setLostItemToResolve(item.id!)}
                              className="p-2 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/10 rounded-lg transition-all"
                              title={isRTL ? 'موافقة / حل' : 'Approve / Resolve'}
                            >
                              <i className="fas fa-check-circle"></i>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : activeTab === 'PENDING' ? (
                  <>
                    {/* Makkah Section */}
                    {(pendingCityFilter === 'ALL' || pendingCityFilter === City.MECCA) && pendingItems.filter(i => i.city === City.MECCA).length > 0 && (
                      <>
                        <tr className="bg-slate-100/50 dark:bg-emerald-900/10">
                          <td colSpan={4} className="px-6 py-2 text-[10px] font-black text-emerald-600 uppercase tracking-widest border-y border-slate-100 dark:border-emerald-900/10">
                            {isRTL ? 'مكة المكرمة' : 'Makkah'}
                          </td>
                        </tr>
                        {pendingItems.filter(i => i.city === City.MECCA).map((item) => (
                          <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-emerald-900/5 transition-colors">
                            <td className="px-6 py-4">
                              <div className="flex items-center space-x-3 rtl:space-x-reverse">
                                <div 
                                  className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-emerald-900/20 flex items-center justify-center overflow-hidden cursor-pointer hover:opacity-90 transition-opacity"
                                  onClick={() => {
                                    if (item.imageUrl) {
                                      setViewerImages([item.imageUrl]);
                                      setViewerIndex(0);
                                    }
                                  }}
                                >
                                  {item.imageUrl ? (
                                    <img src={item.imageUrl} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                  ) : (
                                    <i className="fas fa-box text-slate-400"></i>
                                  )}
                                </div>
                                <div>
                                  <div className="flex items-center">
                                    <div className="text-sm font-bold text-slate-800 dark:text-white mr-2 rtl:ml-2">
                                      {lang === 'en' && item.nameEn ? item.nameEn : item.name}
                                    </div>
                                    {item.status === 'PENDING_DELETION' && (
                                      <span className="px-2 py-0.5 bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400 text-[8px] font-black uppercase tracking-widest rounded-full">
                                        {isRTL ? 'طلب حذف' : 'Delete Request'}
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-xs text-slate-500 line-clamp-1 max-w-[200px]">
                                    {lang === 'en' && item.descriptionEn ? item.descriptionEn : item.description}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex flex-col">
                                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                  {lang === 'en' && item.foundLocationEn ? item.foundLocationEn : item.foundLocation}
                                </span>
                                <span className="text-[10px] text-slate-500">{item.city}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">{formatDate(item.dateFound)}</span>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center space-x-2 rtl:space-x-reverse">
                                {item.status !== 'PENDING_DELETION' && (
                                  <button 
                                    onClick={() => setEditingItem(item)}
                                    className="p-2 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/10 rounded-lg transition-all"
                                    title={t.edit}
                                  >
                                    <i className="fas fa-edit"></i>
                                  </button>
                                )}
                                <button 
                                  onClick={() => fetchUserInfo(item.submittedBy)}
                                  className="p-2 text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/10 rounded-lg transition-all"
                                  title={t.viewUserInfo}
                                >
                                  <i className="fas fa-user"></i>
                                </button>
                                <button 
                                  onClick={() => item.status === 'PENDING_DELETION' ? handleDelete(item.id) : handleApprove(item.id)}
                                  className={`px-3 py-1.5 ${item.status === 'PENDING_DELETION' ? 'bg-rose-600 hover:bg-rose-700' : 'bg-emerald-600 hover:bg-emerald-700'} text-white text-[10px] font-bold rounded-lg transition-all`}
                                >
                                  {item.status === 'PENDING_DELETION' ? (isRTL ? 'تأكيد الحذف' : 'Confirm Delete') : t.approve}
                                </button>
                                <button 
                                  onClick={() => item.status === 'PENDING_DELETION' ? handleApprove(item.id) : handleDelete(item.id)}
                                  className="px-3 py-1.5 bg-red-500/10 text-red-500 hover:bg-red-500/20 text-[10px] font-bold rounded-lg transition-all"
                                >
                                  {item.status === 'PENDING_DELETION' ? (isRTL ? 'رفض الحذف' : 'Reject Delete') : t.reject}
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </>
                    )}

                    {/* Madina Section */}
                    {(pendingCityFilter === 'ALL' || pendingCityFilter === City.MADINA) && pendingItems.filter(i => i.city === City.MADINA).length > 0 && (
                      <>
                        <tr className="bg-slate-100/50 dark:bg-emerald-900/10">
                          <td colSpan={4} className="px-6 py-2 text-[10px] font-black text-emerald-600 uppercase tracking-widest border-y border-slate-100 dark:border-emerald-900/10">
                            {isRTL ? 'المدينة المنورة' : 'Madina'}
                          </td>
                        </tr>
                        {pendingItems.filter(i => i.city === City.MADINA).map((item) => (
                          <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-emerald-900/5 transition-colors">
                            <td className="px-6 py-4">
                              <div className="flex items-center space-x-3 rtl:space-x-reverse">
                                <div 
                                  className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-emerald-900/20 flex items-center justify-center overflow-hidden cursor-pointer hover:opacity-90 transition-opacity"
                                  onClick={() => {
                                    if (item.imageUrl) {
                                      setViewerImages([item.imageUrl]);
                                      setViewerIndex(0);
                                    }
                                  }}
                                >
                                  {item.imageUrl ? (
                                    <img src={item.imageUrl} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                  ) : (
                                    <i className="fas fa-box text-slate-400"></i>
                                  )}
                                </div>
                                <div>
                                  <div className="flex items-center">
                                    <div className="text-sm font-bold text-slate-800 dark:text-white mr-2 rtl:ml-2">
                                      {lang === 'en' && item.nameEn ? item.nameEn : item.name}
                                    </div>
                                    {item.status === 'PENDING_DELETION' && (
                                      <span className="px-2 py-0.5 bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400 text-[8px] font-black uppercase tracking-widest rounded-full">
                                        {isRTL ? 'طلب حذف' : 'Delete Request'}
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-xs text-slate-500 line-clamp-1 max-w-[200px]">
                                    {lang === 'en' && item.descriptionEn ? item.descriptionEn : item.description}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex flex-col">
                                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                  {lang === 'en' && item.foundLocationEn ? item.foundLocationEn : item.foundLocation}
                                </span>
                                <span className="text-[10px] text-slate-500">{item.city}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">{formatDate(item.dateFound)}</span>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center space-x-2 rtl:space-x-reverse">
                                {item.status !== 'PENDING_DELETION' && (
                                  <button 
                                    onClick={() => setEditingItem(item)}
                                    className="p-2 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/10 rounded-lg transition-all"
                                    title={t.edit}
                                  >
                                    <i className="fas fa-edit"></i>
                                  </button>
                                )}
                                <button 
                                  onClick={() => fetchUserInfo(item.submittedBy)}
                                  className="p-2 text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/10 rounded-lg transition-all"
                                  title={t.viewUserInfo}
                                >
                                  <i className="fas fa-user"></i>
                                </button>
                                <button 
                                  onClick={() => item.status === 'PENDING_DELETION' ? handleDelete(item.id) : handleApprove(item.id)}
                                  className={`px-3 py-1.5 ${item.status === 'PENDING_DELETION' ? 'bg-rose-600 hover:bg-rose-700' : 'bg-emerald-600 hover:bg-emerald-700'} text-white text-[10px] font-bold rounded-lg transition-all`}
                                >
                                  {item.status === 'PENDING_DELETION' ? (isRTL ? 'تأكيد الحذف' : 'Confirm Delete') : t.approve}
                                </button>
                                <button 
                                  onClick={() => item.status === 'PENDING_DELETION' ? handleApprove(item.id) : handleDelete(item.id)}
                                  className="px-3 py-1.5 bg-red-500/10 text-red-500 hover:bg-red-500/20 text-[10px] font-bold rounded-lg transition-all"
                                >
                                  {item.status === 'PENDING_DELETION' ? (isRTL ? 'رفض الحذف' : 'Reject Delete') : t.reject}
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </>
                    )}
                  </>
                ) :
                  approvedItems.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-emerald-900/5 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-3 rtl:space-x-reverse">
                          <div 
                            className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-emerald-900/20 flex items-center justify-center overflow-hidden cursor-pointer hover:opacity-90 transition-opacity"
                            onClick={() => {
                              if (item.imageUrl) {
                                setViewerImages([item.imageUrl]);
                                setViewerIndex(0);
                              }
                            }}
                          >
                            {item.imageUrl ? (
                              <img src={item.imageUrl} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            ) : (
                              <i className="fas fa-box text-slate-400"></i>
                            )}
                          </div>
                          <div>
                            <div className="flex items-center">
                              <div className="text-sm font-bold text-slate-800 dark:text-white mr-2 rtl:ml-2">
                                {lang === 'en' && item.nameEn ? item.nameEn : item.name}
                              </div>
                              {item.status === 'PENDING_DELETION' && (
                                <span className="px-2 py-0.5 bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400 text-[8px] font-black uppercase tracking-widest rounded-full">
                                  {isRTL ? 'طلب حذف' : 'Delete Request'}
                                </span>
                              )}
                              {claims.filter(c => c.itemId === item.id && c.status === 'PENDING').length > 0 && (
                                <span className="px-2 py-0.5 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 text-[8px] font-black uppercase tracking-widest rounded-full ml-1 rtl:mr-1">
                                  {claims.filter(c => c.itemId === item.id && c.status === 'PENDING').length} {isRTL ? 'مطالبات' : 'Claims'}
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-slate-500 line-clamp-1 max-w-[200px]">
                              {lang === 'en' && item.descriptionEn ? item.descriptionEn : item.description}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                            {lang === 'en' && item.foundLocationEn ? item.foundLocationEn : item.foundLocation}
                          </span>
                          <span className="text-[10px] text-slate-500">{item.city}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">{formatDate(item.dateFound)}</span>
                      </td>
                      <td className="px-6 py-4">
                          <div className="flex items-center space-x-2 rtl:space-x-reverse">
                            <button 
                              onClick={() => fetchUserInfo(item.submittedBy)}
                              className="p-2 text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/10 rounded-lg transition-all"
                              title={t.viewUserInfo}
                            >
                              <i className="fas fa-user"></i>
                            </button>
                            <button 
                              onClick={() => setEditingItem(item)}
                              className="p-2 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/10 rounded-lg transition-all"
                              title={t.edit}
                            >
                              <i className="fas fa-edit"></i>
                            </button>
                            <button 
                              onClick={() => handleDelete(item.id)}
                              className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-lg transition-all"
                              title={isRTL ? 'حذف' : 'Delete'}
                            >
                              <i className="fas fa-trash-alt"></i>
                            </button>
                            {(item.coordinates?.lat && item.coordinates?.lng) && (
                              <button 
                                onClick={() => setShowMapModal({ lat: item.coordinates!.lat, lng: item.coordinates!.lng, name: item.name })}
                                className="p-2 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/10 rounded-lg transition-all"
                                title={isRTL ? 'عرض الموقع' : 'View Location'}
                              >
                                <i className="fas fa-map-marked-alt"></i>
                              </button>
                            )}
                          </div>
                      </td>
                    </tr>
                  ))
                }
              </tbody>
            </table>
          ) : activeTab === 'ADMINS' ? (
            <>
              <div className="-mx-2 md:-mx-6 p-4 bg-slate-50/50 dark:bg-emerald-950/10 border-b border-slate-100 dark:border-emerald-900/10">
                <div className="relative">
                  <i className={`fas fa-search absolute ${isRTL ? 'right-4' : 'left-4'} top-1/2 -translate-y-1/2 text-slate-400`}></i>
                  <input
                    type="text"
                    value={adminSearchTerm}
                    onChange={(e) => setAdminSearchTerm(e.target.value)}
                    placeholder={adminViewMode === 'ADMINS' ? (isRTL ? 'البحث عن مشرف...' : 'Search admins...') : (isRTL ? 'البحث عن مستخدم...' : 'Search users...')}
                    className={`w-full ${isRTL ? 'pr-12 pl-4' : 'pl-12 pr-4'} py-3 bg-white dark:bg-[#0f1f1a] border border-slate-200 dark:border-emerald-900/20 rounded-2xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition-all dark:text-white`}
                  />
                </div>
              </div>
              <table className="w-full text-left rtl:text-right">
                <thead className="bg-slate-50 dark:bg-emerald-950/20 text-[10px] uppercase tracking-widest text-slate-500 dark:text-slate-500 font-bold">
                  <tr>
                    <th className="px-6 py-4">{adminViewMode === 'ADMINS' ? t.adminUsername : t.fullName}</th>
                    <th className="px-6 py-4">{adminViewMode === 'ADMINS' ? t.adminRole : t.email}</th>
                    {adminViewMode === 'USERS' && <th className="px-6 py-4">{t.phone}</th>}
                    <th className="px-6 py-4">{t.adminActions}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-emerald-900/10">
                  {adminViewMode === 'ADMINS' ? (
                    admins.filter(a => (a.role === 'ADMIN' || a.role === 'MANAGER') && matchesAny([a.username, a.fullName, a.email, a.id], adminSearchTerm)).length === 0 ? (
                      <tr>
                        <td colSpan={3} className="px-6 py-12 text-center text-slate-500">
                          {isRTL ? 'لا يوجد مشرفون' : 'No admins found'}
                        </td>
                      </tr>
                    ) : (
                      admins.filter(a => (a.role === 'ADMIN' || a.role === 'MANAGER') && matchesAny([a.username, a.fullName, a.email, a.id], adminSearchTerm)).map((admin) => (
                        <tr key={admin.username} className="hover:bg-slate-50 dark:hover:bg-emerald-900/5 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-center space-x-3 rtl:space-x-reverse">
                              <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600">
                                <i className="fas fa-user-shield"></i>
                              </div>
                              <span className="text-sm font-bold text-slate-800 dark:text-white">{admin.username}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${
                              admin.role === 'ADMIN' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                            }`}>
                              {admin.role}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center space-x-2 rtl:space-x-reverse">
                              {(user.role === 'ADMIN' || (user.role === 'MANAGER' && (admin.role !== 'MANAGER' || admin.username === user.username))) ? (
                                <>
                                  <button 
                                    onClick={() => setEditingAdmin({ ...admin, originalUsername: admin.username, password: '' })}
                                    className="p-2 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/10 rounded-lg transition-all"
                                    title={t.edit}
                                  >
                                    <i className="fas fa-edit"></i>
                                  </button>
                                  <button 
                                    onClick={() => handleDeleteAdmin(admin.username)}
                                    className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-lg transition-all"
                                    title={t.adminActions}
                                  >
                                    <i className="fas fa-trash-alt"></i>
                                  </button>
                                </>
                              ) : (
                                <span className="text-[10px] text-slate-400 italic">
                                  {isRTL ? 'غير مسموح' : 'Restricted'}
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )
                  ) : (
                    admins.filter(a => a.role === 'USER' && matchesAny([
                      a.username, a.fullName, a.email, a.passportNumber, a.phoneNumber, a.id
                    ], adminSearchTerm)).length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-6 py-12 text-center text-slate-500">
                          {t.noUsersFound}
                        </td>
                      </tr>
                    ) : (
                      admins.filter(a => a.role === 'USER' && matchesAny([
                        a.username, a.fullName, a.email, a.passportNumber, a.phoneNumber, a.id
                      ], adminSearchTerm)).map((u) => (
                        <tr key={u.username} className="hover:bg-slate-50 dark:hover:bg-emerald-900/5 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-center space-x-3 rtl:space-x-reverse">
                              <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600">
                                <i className="fas fa-user"></i>
                              </div>
                              <div className="flex flex-col">
                                <div className="flex items-center space-x-2 rtl:space-x-reverse">
                                  <span className="text-sm font-bold text-slate-800 dark:text-white">{u.fullName || u.username}</span>
                                  {claims.filter(c => c.userEmail === u.email).length > 3 && (
                                    <div className="flex items-center px-1.5 py-0.5 bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 text-[8px] font-black rounded uppercase tracking-tighter animate-pulse border border-rose-200 dark:border-rose-900/50">
                                      <i className="fas fa-exclamation-triangle mr-1 rtl:ml-1"></i>
                                      {t.suspiciousActivity}
                                    </div>
                                  )}
                                </div>
                                <span className="text-[10px] text-slate-500">{u.passportNumber || u.username}</span>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-xs text-slate-600 dark:text-slate-400">{u.email || '-'}</span>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-xs text-slate-600 dark:text-slate-400">{u.phoneNumber || '-'}</span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center space-x-2 rtl:space-x-reverse">
                              <button 
                                onClick={() => setEditingUser({ ...u, originalUsername: u.username, password: '' })}
                                className="p-2 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/10 rounded-lg transition-all"
                                title={t.edit}
                              >
                                <i className="fas fa-edit"></i>
                              </button>
                              <button 
                                onClick={() => setShowBanModal({ email: u.email, phoneNumber: u.phoneNumber })}
                                className="p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/10 rounded-lg transition-all"
                                title={isRTL ? 'حظر المستخدم' : 'Ban User'}
                              >
                                <i className="fas fa-user-slash"></i>
                              </button>
                              <button 
                                onClick={() => handleDeleteAdmin(u.username)}
                                className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-lg transition-all"
                                title={t.adminActions}
                              >
                                <i className="fas fa-trash-alt"></i>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    ))}
                  </tbody>
                </table>
              </>
          ) : activeTab === 'CLAIMS' ? (
            <div className="space-y-6">
              {claimsTab === 'SUSPICIOUS' && bannedUsers.length > 0 && (
                <div className="space-y-4 mb-8">
                  <div className="flex items-center space-x-2 rtl:space-x-reverse text-rose-600 dark:text-rose-400">
                    <i className="fas fa-user-slash"></i>
                    <h4 className="text-sm font-black uppercase tracking-widest">{isRTL ? 'المستخدمون المحظورون' : 'Banned Users'}</h4>
                  </div>
                  <div className="overflow-x-auto bg-rose-50/30 dark:bg-rose-900/5 rounded-2xl border border-rose-100 dark:border-rose-900/20">
                    <table className="w-full text-left rtl:text-right">
                      <thead className="bg-rose-100/50 dark:bg-rose-900/20 text-[10px] uppercase tracking-widest text-rose-700 dark:text-rose-400 font-bold">
                        <tr>
                          <th className="px-6 py-4">{isRTL ? 'المستخدم' : 'User'}</th>
                          <th className="px-6 py-4">{isRTL ? 'السبب' : 'Reason'}</th>
                          <th className="px-6 py-4">{isRTL ? 'تاريخ الانتهاء' : 'Expires At'}</th>
                          <th className="px-6 py-4">{isRTL ? 'الإجراءات' : 'Actions'}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-rose-100 dark:divide-rose-900/10">
                        {bannedUsers.map((ban) => (
                          <tr key={ban.id} className="hover:bg-rose-100/20 dark:hover:bg-rose-900/10 transition-colors">
                            <td className="px-6 py-4">
                              <div className="flex flex-col">
                                <span className="text-sm font-bold text-slate-800 dark:text-white">
                                  {ban.email || ban.phoneNumber}
                                </span>
                                <span className="text-[10px] text-slate-500">
                                  {ban.email ? (isRTL ? 'بريد إلكتروني' : 'Email') : (isRTL ? 'رقم هاتف' : 'Phone')}
                                </span>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 max-w-xs">
                                {ban.reason}
                              </p>
                            </td>
                            <td className="px-6 py-4">
                              <span className={`text-xs font-medium ${ban.expiresAt === 'PERMANENT' ? 'text-rose-600 font-black' : 'text-slate-600 dark:text-slate-400'}`}>
                                {ban.expiresAt === 'PERMANENT' 
                                  ? (isRTL ? 'دائم' : 'Permanent') 
                                  : formatDateTime(new Date(ban.expiresAt).toISOString())}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <button 
                                onClick={() => handleUnbanUser(ban.id)}
                                className="px-3 py-1.5 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 text-[10px] font-bold rounded-lg transition-all flex items-center space-x-1 rtl:space-x-reverse"
                              >
                                <i className="fas fa-unlock"></i>
                                <span>{isRTL ? 'إلغاء الحظر' : 'Unban'}</span>
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="w-full text-left rtl:text-right">
              <thead className="bg-slate-50 dark:bg-emerald-950/20 text-[10px] uppercase tracking-widest text-slate-500 dark:text-slate-500 font-bold">
                <tr>
                  <th className="px-6 py-4">{t.claimant}</th>
                  <th className="px-6 py-4">{t.item}</th>
                  <th className="px-6 py-4">{t.claimDetails}</th>
                  <th className="px-6 py-4">{isRTL ? 'الحالة' : 'Status'}</th>
                  <th className="px-6 py-4">{t.actions}</th>
                </tr>
              </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-emerald-900/10">
                  {filteredClaims.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                        {isRTL ? 'لا توجد طلبات استلام حالياً' : 'No claim requests yet'}
                      </td>
                    </tr>
                  ) : (
                    [...filteredClaims].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).map((claim) => (
                      <tr key={claim.id} className="hover:bg-slate-50 dark:hover:bg-emerald-900/5 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <div className="flex items-center space-x-2 rtl:space-x-reverse">
                              <span className="text-sm font-bold text-slate-800 dark:text-white">{claim.userName}</span>
                              {claims.filter(c => c.userEmail === claim.userEmail).length > 8 && (
                                <div className="flex items-center px-1.5 py-0.5 bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 text-[8px] font-black rounded uppercase tracking-tighter animate-pulse border border-rose-200 dark:border-rose-900/50">
                                  <i className="fas fa-exclamation-triangle mr-1 rtl:ml-1"></i>
                                  {isRTL ? 'مستخدم مشبوه' : 'Suspicious User'}
                                </div>
                              )}
                            </div>
                            <span className="text-[10px] text-slate-500">{claim.userEmail}</span>
                            <span className="text-[10px] text-slate-500">{claim.userPhone}</span>
                          </div>
                        </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-2 rtl:space-x-reverse">
                          <div 
                            className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-emerald-900/20 flex items-center justify-center overflow-hidden cursor-pointer hover:opacity-90 transition-opacity"
                            onClick={() => {
                              if (claim.itemImage) {
                                setViewerImages([claim.itemImage]);
                                setViewerIndex(0);
                              }
                            }}
                          >
                            {claim.itemImage ? (
                              <img src={claim.itemImage} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            ) : (
                              <i className="fas fa-box text-slate-400"></i>
                            )}
                          </div>
                          <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{claim.itemName}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col max-w-xs">
                          <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2">{claim.description}</p>
                          <span className="text-[10px] text-slate-500 mt-1">
                            {t.lostDate}: {claim.lostDate} {claim.lostTime}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          claim.status === 'PENDING' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                          claim.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                          'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400'
                        }`}>
                          {claim.status === 'PENDING' ? (isRTL ? 'قيد الانتظار' : 'Pending') :
                           claim.status === 'APPROVED' ? (isRTL ? 'تمت الموافقة' : 'Approved') :
                           (isRTL ? 'تم الرفض' : 'Rejected')}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-2 rtl:space-x-reverse">
                          <button 
                            onClick={() => handleViewClaim(claim)}
                            className="px-3 py-1.5 bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 text-[10px] font-bold rounded-lg transition-all flex items-center space-x-1 rtl:space-x-reverse"
                            title={t.details}
                          >
                            <i className="fas fa-info-circle"></i>
                            <span>{t.details}</span>
                          </button>
                          
                          <button 
                            onClick={() => setItemClaimsModal({ itemId: claim.itemId, itemName: claim.itemName })}
                            className="px-3 py-1.5 bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 text-[10px] font-bold rounded-lg transition-all flex items-center space-x-1 rtl:space-x-reverse"
                            title={isRTL ? 'عرض جميع الطلبات لهذا العنصر' : 'View all claims for this item'}
                          >
                            <i className="fas fa-list-ul"></i>
                            <span>{isRTL ? 'جميع الطلبات' : 'All Claims'}</span>
                          </button>

                          {(claim.status === 'PENDING' || claimsTab === 'SUSPICIOUS') && (
                            <>
                              <button 
                                onClick={() => handleUpdateClaimStatus(claim.id, 'APPROVED')}
                                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold rounded-lg transition-all"
                              >
                                {t.approve}
                              </button>
                              <button 
                                onClick={() => handleUpdateClaimStatus(claim.id, 'REJECTED')}
                                className="px-3 py-1.5 bg-red-500/10 text-red-500 hover:bg-red-500/20 text-[10px] font-bold rounded-lg transition-all"
                              >
                                {t.reject}
                              </button>
                            </>
                          )}
                          
                          {claims.filter(c => c.userEmail === claim.userEmail).length > 8 && (
                            <button 
                              onClick={() => setShowBanModal({ email: claim.userEmail, phoneNumber: claim.userPhone })}
                              className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-bold rounded-lg transition-all flex items-center space-x-1 rtl:space-x-reverse shadow-lg shadow-rose-600/20"
                              title={isRTL ? 'حظر المستخدم' : 'Ban User'}
                            >
                              <i className="fas fa-user-slash"></i>
                              <span>{isRTL ? 'حظر' : 'Ban'}</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            </div>
          </div>
          ) : (
            <table className="w-full text-left rtl:text-right">
              <thead className="bg-slate-50 dark:bg-emerald-950/20 text-[10px] uppercase tracking-widest text-slate-500 dark:text-slate-500 font-bold">
                <tr>
                  <th className="px-6 py-4">{t.feedbackType}</th>
                  <th className="px-6 py-4">{t.feedbackContent}</th>
                  <th className="px-6 py-4">{t.feedbackDate}</th>
                  <th className="px-6 py-4">{isRTL ? 'الحالة' : 'Status'}</th>
                  <th className="px-6 py-4">{t.actions}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-emerald-900/10">
                {filteredFeedbacks.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-slate-500">
                      {t.noFeedback}
                    </td>
                  </tr>
                ) : (
                  filteredFeedbacks.map((fb) => (
                    <tr key={fb.id} className={`hover:bg-slate-50 dark:hover:bg-emerald-900/5 transition-colors ${!fb.read ? 'bg-emerald-50/30 dark:bg-emerald-900/10' : ''}`}>
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center mr-3 rtl:ml-3 ${
                            fb.type === 'COMPLAINT' ? 'bg-red-100 text-red-600' :
                            fb.type === 'RECOMMENDATION' ? 'bg-amber-100 text-amber-600' :
                            'bg-blue-100 text-blue-600'
                          }`}>
                            <i className={`fas ${
                              fb.type === 'COMPLAINT' ? 'fa-exclamation-circle' :
                              fb.type === 'RECOMMENDATION' ? 'fa-lightbulb' :
                              'fa-comment'
                            }`}></i>
                          </div>
                          <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                            {fb.type === 'COMPLAINT' ? t.feedbackComplaint :
                             fb.type === 'RECOMMENDATION' ? t.feedbackRecommendation :
                             t.feedbackGeneral}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm text-slate-800 dark:text-white max-w-md leading-relaxed line-clamp-3">
                          {fb.content}
                        </p>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                            {formatDate(fb.timestamp)}
                          </span>
                          <span className="text-[10px] text-slate-500">
                            {new Date(fb.timestamp).toLocaleTimeString(lang === 'ar' ? 'ar-SA' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {!fb.read ? (
                          <span className="px-2 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-[10px] font-bold rounded-full uppercase tracking-wider">
                            {isRTL ? 'جديد' : 'New'}
                          </span>
                        ) : (
                          <span className="px-2 py-1 bg-slate-100 dark:bg-slate-800 text-slate-400 text-[10px] font-bold rounded-full uppercase tracking-wider">
                            {isRTL ? 'تمت القراءة' : 'Read'}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-2 rtl:space-x-reverse">
                          <button 
                            onClick={() => setSelectedFeedback(fb)}
                            className="px-3 py-1.5 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 text-[10px] font-bold rounded-lg transition-all flex items-center space-x-1 rtl:space-x-reverse"
                          >
                            <i className="fas fa-eye"></i>
                            <span>{t.viewContent}</span>
                          </button>
                          {fb.submittedBy && fb.submittedBy !== 'Anonymous' && (
                            <button 
                              onClick={() => fetchUserInfo(fb.submittedBy)}
                              className="px-3 py-1.5 bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 text-[10px] font-bold rounded-lg transition-all flex items-center space-x-1 rtl:space-x-reverse"
                            >
                              <i className="fas fa-user-circle"></i>
                              <span>{t.viewUserInfo}</span>
                            </button>
                          )}
                          {!fb.read && (
                            <button 
                              onClick={() => markAsRead(fb.id)}
                              className="px-3 py-1.5 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 text-[10px] font-bold rounded-lg transition-all flex items-center space-x-1 rtl:space-x-reverse"
                            >
                              <i className="fas fa-check"></i>
                              <span>{t.markAsRead}</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                  )}
              </tbody>
            </table>
          )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  </div>
</main>

      <AnimatePresence>
        {showAdminForm && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xl overflow-y-auto"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white/80 dark:bg-[#162923]/80 backdrop-blur-2xl w-full max-w-md rounded-[40px] shadow-2xl overflow-hidden border border-white/20 dark:border-emerald-900/20"
            >
              <div className="p-8 border-b border-white/10 dark:border-emerald-900/10 flex items-center justify-between bg-white/20 dark:bg-emerald-950/20">
                <div className="flex items-center space-x-3 rtl:space-x-reverse">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 shadow-inner">
                    <i className="fas fa-user-plus text-2xl"></i>
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">{t.addAdmin}</h3>
                    <p className="text-xs text-slate-500 font-medium">{isRTL ? 'إضافة حساب إداري جديد' : 'Add a new administrative account'}</p>
                  </div>
                </div>
                <button onClick={() => setShowAdminForm(false)} className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-400 hover:bg-rose-500 hover:text-white transition-all">
                  <i className="fas fa-times text-xl"></i>
                </button>
              </div>

              <form onSubmit={handleCreateAdmin} className="p-8 space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{t.adminUsername}</label>
                  <input 
                    type="text"
                    required
                    value={newAdmin.username}
                    onChange={(e) => setNewAdmin({...newAdmin, username: e.target.value})}
                    className="w-full px-5 py-4 rounded-2xl bg-white/50 dark:bg-emerald-950/20 border border-slate-200 dark:border-emerald-900/20 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all text-sm font-bold"
                    placeholder={t.adminUsername}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{t.adminPassword}</label>
                  <input 
                    type="password"
                    required
                    value={newAdmin.password}
                    onChange={(e) => setNewAdmin({...newAdmin, password: e.target.value})}
                    className="w-full px-5 py-4 rounded-2xl bg-white/50 dark:bg-emerald-950/20 border border-slate-200 dark:border-emerald-900/20 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all text-sm font-bold"
                    placeholder={t.adminPassword}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{t.adminRole}</label>
                  <select 
                    value={newAdmin.role}
                    onChange={(e) => setNewAdmin({...newAdmin, role: e.target.value})}
                    className="w-full px-5 py-4 rounded-2xl bg-white/50 dark:bg-emerald-950/20 border border-slate-200 dark:border-emerald-900/20 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all text-sm font-bold appearance-none"
                  >
                    <option value="ADMIN">ADMIN</option>
                    <option value="MANAGER">MANAGER</option>
                  </select>
                </div>

                <div className="pt-6 flex space-x-4 rtl:space-x-reverse">
                  <button
                    type="button"
                    onClick={() => setShowAdminForm(false)}
                    className="flex-1 px-6 py-4 bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 font-black rounded-2xl hover:bg-slate-200 dark:hover:bg-white/10 transition-all uppercase tracking-widest text-xs"
                  >
                    {t.cancel}
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-[2] px-6 py-4 bg-emerald-700 text-white font-black rounded-2xl shadow-xl shadow-emerald-700/30 hover:bg-emerald-800 transition-all flex items-center justify-center space-x-2 rtl:space-x-reverse disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-[0.98] uppercase tracking-widest text-xs"
                  >
                    {loading ? (
                      <div className="w-6 h-6 border-3 border-white border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      <>
                        <i className="fas fa-check"></i>
                        <span>{t.createAdminBtn}</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {editingAdmin && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xl overflow-y-auto"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white/80 dark:bg-[#162923]/80 backdrop-blur-2xl w-full max-w-md rounded-[40px] shadow-2xl overflow-hidden border border-white/20 dark:border-emerald-900/20"
            >
              <div className="p-8 border-b border-white/10 dark:border-emerald-900/10 flex items-center justify-between bg-white/20 dark:bg-emerald-950/20">
                <div className="flex items-center space-x-3 rtl:space-x-reverse">
                  <div className="w-12 h-12 rounded-2xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 shadow-inner">
                    <i className="fas fa-user-edit text-2xl"></i>
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">{t.editAdmin}</h3>
                    <p className="text-xs text-slate-500 font-medium">{isRTL ? 'تحديث بيانات الحساب الإداري' : 'Update administrative account details'}</p>
                  </div>
                </div>
                <button onClick={() => setEditingAdmin(null)} className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-400 hover:bg-rose-500 hover:text-white transition-all">
                  <i className="fas fa-times text-xl"></i>
                </button>
              </div>

              <form onSubmit={handleUpdateAdmin} className="p-8 space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{t.adminUsername}</label>
                  <input 
                    type="text"
                    required
                    value={editingAdmin.username}
                    onChange={(e) => setEditingAdmin({...editingAdmin, username: e.target.value})}
                    className="w-full px-5 py-4 rounded-2xl bg-white/50 dark:bg-emerald-950/20 border border-slate-200 dark:border-emerald-900/20 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all text-sm font-bold"
                    placeholder={t.adminUsername}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{t.adminPassword} ({t.leaveBlank})</label>
                  <input 
                    type="password"
                    value={editingAdmin.password}
                    onChange={(e) => setEditingAdmin({...editingAdmin, password: e.target.value})}
                    className="w-full px-5 py-4 rounded-2xl bg-white/50 dark:bg-emerald-950/20 border border-slate-200 dark:border-emerald-900/20 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all text-sm font-bold"
                    placeholder={t.newPassword}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{t.adminRole}</label>
                  <select 
                    value={editingAdmin.role}
                    onChange={(e) => setEditingAdmin({...editingAdmin, role: e.target.value})}
                    className="w-full px-5 py-4 rounded-2xl bg-white/50 dark:bg-emerald-950/20 border border-slate-200 dark:border-emerald-900/20 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all text-sm font-bold appearance-none"
                  >
                    <option value="ADMIN">ADMIN</option>
                    <option value="MANAGER">MANAGER</option>
                  </select>
                </div>

                <div className="pt-6 flex space-x-4 rtl:space-x-reverse">
                  <button
                    type="button"
                    onClick={() => setEditingAdmin(null)}
                    className="flex-1 px-6 py-4 bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 font-black rounded-2xl hover:bg-slate-200 dark:hover:bg-white/10 transition-all uppercase tracking-widest text-xs"
                  >
                    {t.cancel}
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-[2] px-6 py-4 bg-blue-600 text-white font-black rounded-2xl shadow-xl shadow-blue-600/30 hover:bg-blue-700 transition-all flex items-center justify-center space-x-2 rtl:space-x-reverse disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-[0.98] uppercase tracking-widest text-xs"
                  >
                    {loading ? (
                      <div className="w-6 h-6 border-3 border-white border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      <>
                        <i className="fas fa-save"></i>
                        <span>{t.updateAdmin}</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}

        {editingUser && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xl overflow-y-auto"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white/80 dark:bg-[#162923]/80 backdrop-blur-2xl w-full max-w-2xl rounded-[40px] shadow-2xl overflow-hidden border border-white/20 dark:border-emerald-900/20"
            >
              <div className="p-8 border-b border-white/10 dark:border-emerald-900/10 flex items-center justify-between bg-white/20 dark:bg-emerald-950/20">
                <div className="flex items-center space-x-3 rtl:space-x-reverse">
                  <div className="w-12 h-12 rounded-2xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 shadow-inner">
                    <i className="fas fa-user-edit text-2xl"></i>
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">{isRTL ? 'تعديل بيانات المستخدم' : 'Edit User Details'}</h3>
                    <p className="text-xs text-slate-500 font-medium">{isRTL ? 'تحديث المعلومات الشخصية للمستخدم' : 'Update user personal information'}</p>
                  </div>
                </div>
                <button onClick={() => setEditingUser(null)} className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-400 hover:bg-rose-500 hover:text-white transition-all">
                  <i className="fas fa-times text-xl"></i>
                </button>
              </div>

              <form onSubmit={handleUpdateUser} className="p-8 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{t.fullName}</label>
                    <input 
                      type="text"
                      required
                      value={editingUser.fullName}
                      onChange={(e) => setEditingUser({...editingUser, fullName: e.target.value})}
                      className="w-full px-5 py-4 rounded-2xl bg-white/50 dark:bg-emerald-950/20 border border-slate-200 dark:border-emerald-900/20 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all text-sm font-bold"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{t.email}</label>
                    <input 
                      type="email"
                      required
                      value={editingUser.email}
                      onChange={(e) => setEditingUser({...editingUser, email: e.target.value})}
                      className="w-full px-5 py-4 rounded-2xl bg-white/50 dark:bg-emerald-950/20 border border-slate-200 dark:border-emerald-900/20 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all text-sm font-bold"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{t.phone}</label>
                    <input 
                      type="text"
                      required
                      value={editingUser.phoneNumber}
                      onChange={(e) => setEditingUser({...editingUser, phoneNumber: e.target.value})}
                      className="w-full px-5 py-4 rounded-2xl bg-white/50 dark:bg-emerald-950/20 border border-slate-200 dark:border-emerald-900/20 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all text-sm font-bold"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{t.passportNumber}</label>
                    <input 
                      type="text"
                      required
                      value={editingUser.passportNumber}
                      onChange={(e) => setEditingUser({...editingUser, passportNumber: e.target.value})}
                      className="w-full px-5 py-4 rounded-2xl bg-white/50 dark:bg-emerald-950/20 border border-slate-200 dark:border-emerald-900/20 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all text-sm font-bold"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{t.adminUsername}</label>
                    <input 
                      type="text"
                      required
                      value={editingUser.username}
                      onChange={(e) => setEditingUser({...editingUser, username: e.target.value})}
                      className="w-full px-5 py-4 rounded-2xl bg-white/50 dark:bg-emerald-950/20 border border-slate-200 dark:border-emerald-900/20 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all text-sm font-bold"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{t.adminPassword} ({t.leaveBlank})</label>
                    <input 
                      type="password"
                      value={editingUser.password}
                      onChange={(e) => setEditingUser({...editingUser, password: e.target.value})}
                      className="w-full px-5 py-4 rounded-2xl bg-white/50 dark:bg-emerald-950/20 border border-slate-200 dark:border-emerald-900/20 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all text-sm font-bold"
                      placeholder={t.newPassword}
                    />
                  </div>
                </div>

                <div className="pt-6 flex space-x-4 rtl:space-x-reverse">
                  <button
                    type="button"
                    onClick={() => setEditingUser(null)}
                    className="flex-1 px-6 py-4 bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 font-black rounded-2xl hover:bg-slate-200 dark:hover:bg-white/10 transition-all uppercase tracking-widest text-xs"
                  >
                    {t.cancel}
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-[2] px-6 py-4 bg-blue-600 text-white font-black rounded-2xl shadow-xl shadow-blue-600/30 hover:bg-blue-700 transition-all flex items-center justify-center space-x-2 rtl:space-x-reverse disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-[0.98] uppercase tracking-widest text-xs"
                  >
                    {loading ? (
                      <div className="w-6 h-6 border-3 border-white border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      <>
                        <i className="fas fa-save"></i>
                        <span>{t.saveChanges}</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showUploadForm && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xl overflow-y-auto"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white/80 dark:bg-[#162923]/80 backdrop-blur-2xl w-full max-w-4xl rounded-[40px] shadow-2xl overflow-hidden border border-white/20 dark:border-emerald-900/20 my-8"
            >
              <div className="p-8 border-b border-white/10 dark:border-emerald-900/10 flex items-center justify-between bg-white/20 dark:bg-emerald-950/20">
                <div className="flex items-center space-x-3 rtl:space-x-reverse">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 shadow-inner">
                    <i className="fas fa-plus-circle text-2xl"></i>
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">{t.uploadMissingItem}</h3>
                    <p className="text-xs text-slate-500 font-medium">{isRTL ? 'إضافة تفاصيل المفقود الجديد' : 'Add details for the new lost item'}</p>
                  </div>
                </div>
                <button onClick={() => setShowUploadForm(false)} className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-400 hover:bg-rose-500 hover:text-white transition-all">
                  <i className="fas fa-times text-xl"></i>
                </button>
              </div>

              <form onSubmit={handleUpload} className="p-8">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                  <div className="space-y-8">
                    {/* Image Upload */}
                    <div className="space-y-4">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                        {isRTL ? 'صور المفقود' : 'Item Images'} ({newItem.images.length}/10)
                      </label>
                      <div className="grid grid-cols-3 gap-3">
                        {newItem.images.map((img, idx) => (
                          <motion.div 
                            key={idx} 
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="relative aspect-square rounded-2xl overflow-hidden group border border-white/20 dark:border-emerald-900/20 shadow-sm"
                          >
                            <img src={img} alt="" className="w-full h-full object-cover transition-transform group-hover:scale-110" />
                            <button 
                              type="button"
                              onClick={() => removeNewItemImage(idx)}
                              className="absolute top-2 right-2 w-6 h-6 bg-rose-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all hover:scale-110"
                            >
                              <i className="fas fa-times text-[10px]"></i>
                            </button>
                          </motion.div>
                        ))}
                        {newItem.images.length < 10 && (
                          <button 
                            type="button"
                            onClick={() => !aiProcessing && fileInputRef.current?.click()}
                            onDragOver={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                            }}
                            onDrop={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              const files = e.dataTransfer.files;
                              if (files && files.length > 0) {
                                const event = { target: { files } } as any;
                                handleFileChange(event);
                              }
                            }}
                            className={`aspect-square rounded-2xl border-2 border-dashed border-slate-200 dark:border-emerald-900/30 flex flex-col items-center justify-center hover:border-emerald-500 hover:bg-emerald-500/5 transition-all group ${aiProcessing ? 'opacity-50 cursor-wait' : ''}`}
                          >
                            {aiProcessing ? (
                              <div className="w-6 h-6 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                            ) : (
                              <>
                                <i className="fas fa-plus text-slate-300 group-hover:text-emerald-500 transition-colors"></i>
                                <span className="text-[10px] text-slate-400 mt-2 font-bold group-hover:text-emerald-500">{isRTL ? 'إضافة' : 'Add'}</span>
                              </>
                            )}
                          </button>
                        )}
                      </div>

                      <AnimatePresence>
                        {aiProcessing && (
                          <motion.div 
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="flex items-center space-x-2 rtl:space-x-reverse px-3 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl"
                          >
                            <div className="w-3 h-3 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                            <span className="text-[9px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest animate-pulse">
                              {t.aiAnalyzing}
                            </span>
                          </motion.div>
                        )}
                      </AnimatePresence>
                      <input 
                        type="file" 
                        ref={fileInputRef} 
                        onChange={handleFileChange} 
                        className="hidden" 
                        accept="image/*"
                        multiple
                        disabled={aiProcessing}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{t.itemName}</label>
                        <input 
                          type="text"
                          required
                          value={newItem.name}
                          onChange={(e) => setNewItem({...newItem, name: e.target.value})}
                          className="w-full px-5 py-4 rounded-2xl bg-white/50 dark:bg-emerald-950/20 border border-slate-200 dark:border-emerald-900/20 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all text-sm font-bold"
                          placeholder={t.itemName}
                        />
                      </div>
                      <div className="space-y-2">
                        <SilkyDateInput
                          label={t.date}
                          required
                          min={new Date(new Date().setFullYear(new Date().getFullYear() - 20)).toISOString().split('T')[0]}
                          max={new Date().toISOString().split('T')[0]}
                          value={newItem.date}
                          onChange={(val) => setNewItem({...newItem, date: val})}
                          isRTL={isRTL}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{t.gateLocation}</label>
                      <input 
                        type="text"
                        required
                        value={newItem.gateLocation}
                        onChange={(e) => setNewItem({...newItem, gateLocation: e.target.value})}
                        className="w-full px-5 py-4 rounded-2xl bg-white/50 dark:bg-emerald-950/20 border border-slate-200 dark:border-emerald-900/20 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all text-sm font-bold"
                        placeholder={isRTL ? 'مثال: بوابة الملك فهد' : 'e.g. King Fahd Gate'}
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{t.itemDesc}</label>
                      <textarea 
                        required
                        value={newItem.description}
                        onChange={(e) => setNewItem({...newItem, description: e.target.value})}
                        className="w-full px-5 py-4 rounded-2xl bg-white/50 dark:bg-emerald-950/20 border border-slate-200 dark:border-emerald-900/20 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all text-sm font-bold min-h-[120px] resize-none"
                        placeholder={t.itemDesc}
                      />
                    </div>
                  </div>

                  <div className="space-y-8">
                    <div className="space-y-4">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{isRTL ? 'الموقع على الخريطة' : 'Map Location'}</label>
                      <div className="rounded-[32px] overflow-hidden border border-white/20 dark:border-emerald-900/20 shadow-lg p-6 md:p-8 bg-white/20 dark:bg-emerald-900/5">
                        <MapPicker 
                          city={newItem.city}
                          lang={lang}
                          centerOnSelect={true}
                          initialLocation={newItem.lat && newItem.lng ? { lat: newItem.lat, lng: newItem.lng } : undefined}
                          onCityChange={(city) => handleCityChange(city)}
                          onLocationSelect={(lat, lng) => {
                            setNewItem({ ...newItem, lat, lng });
                          }}
                        />
                      </div>
                      {newItem.lat && newItem.lng && (
                        <div className="flex justify-between text-[10px] font-mono text-slate-400 px-2 bg-white/20 dark:bg-emerald-950/20 py-2 rounded-xl border border-white/10">
                          <span>LAT: {newItem.lat.toFixed(6)}</span>
                          <span>LNG: {newItem.lng.toFixed(6)}</span>
                        </div>
                      )}
                    </div>

                    <div className="pt-6 flex space-x-4 rtl:space-x-reverse">
                      <button
                        type="button"
                        onClick={() => setShowUploadForm(false)}
                        className="flex-1 px-6 py-4 bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 font-black rounded-2xl hover:bg-slate-200 dark:hover:bg-white/10 transition-all uppercase tracking-widest text-xs"
                      >
                        {t.cancel}
                      </button>
                      <button
                        type="submit"
                        disabled={uploading}
                        className="flex-[2] px-6 py-4 bg-emerald-700 text-white font-black rounded-2xl shadow-xl shadow-emerald-700/30 hover:bg-emerald-800 transition-all flex items-center justify-center space-x-2 rtl:space-x-reverse disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-[0.98] uppercase tracking-widest text-xs"
                      >
                        {uploading ? (
                          <div className="w-6 h-6 border-3 border-white border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                          <>
                            <i className="fas fa-check"></i>
                            <span>{t.uploadReport}</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      
      <AnimatePresence>
        {editingItem && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xl overflow-y-auto"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white/80 dark:bg-[#162923]/80 backdrop-blur-2xl w-full max-w-4xl rounded-[40px] shadow-2xl overflow-hidden border border-white/20 dark:border-emerald-900/20 my-8"
            >
              <div className="p-8 border-b border-white/10 dark:border-emerald-900/10 flex items-center justify-between bg-white/20 dark:bg-emerald-950/20">
                <div className="flex items-center space-x-3 rtl:space-x-reverse">
                  <div className="w-12 h-12 rounded-2xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 shadow-inner">
                    <i className="fas fa-edit text-2xl"></i>
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">{t.editItem}</h3>
                    <p className="text-xs text-slate-500 font-medium">{isRTL ? 'تحديث بيانات العنصر' : 'Update item information'}</p>
                  </div>
                </div>
                <button onClick={() => setEditingItem(null)} className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-400 hover:bg-rose-500 hover:text-white transition-all">
                  <i className="fas fa-times text-xl"></i>
                </button>
              </div>

              <form onSubmit={handleUpdate} className="p-8">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                  <div className="space-y-8">
                    <div className="space-y-4">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                        {t.itemImage} ({(editingItem.imageUrls || (editingItem.imageUrl ? [editingItem.imageUrl] : [])).length}/10)
                      </label>
                      <div className="grid grid-cols-3 gap-3">
                        {(editingItem.imageUrls || (editingItem.imageUrl ? [editingItem.imageUrl] : [])).map((img, idx) => (
                          <motion.div 
                            key={idx} 
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="relative aspect-square rounded-2xl overflow-hidden group border border-white/20 dark:border-emerald-900/20 shadow-sm"
                          >
                            <img src={img} alt="" className="w-full h-full object-cover transition-transform group-hover:scale-110" />
                            <button 
                              type="button"
                              onClick={() => removeEditingItemImage(idx)}
                              className="absolute top-2 right-2 w-6 h-6 bg-rose-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all hover:scale-110"
                            >
                              <i className="fas fa-times text-[10px]"></i>
                            </button>
                          </motion.div>
                        ))}
                        {(editingItem.imageUrls || (editingItem.imageUrl ? [editingItem.imageUrl] : [])).length < 10 && (
                          <button 
                            type="button"
                            onClick={() => !aiProcessing && fileInputEditRef.current?.click()}
                            onDragOver={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                            }}
                            onDrop={async (e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              const files = Array.from(e.dataTransfer.files || []);
                              const currentImages = editingItem.imageUrls || (editingItem.imageUrl ? [editingItem.imageUrl] : []);
                              const remainingSlots = 10 - currentImages.length;
                              const filesToProcess = files.slice(0, remainingSlots);

                              for (const fileObj of filesToProcess) {
                                const file = fileObj as File;
                                const reader = new FileReader();
                                reader.onloadend = async () => {
                                  const base64 = reader.result as string;
                                  
                                  let analysisResult = null;
                                  // AI Analysis for editing item
                                  if (currentImages.length === 0 && !editingItem.description) {
                                    setAiProcessing(true);
                                    try {
                                      const base64Data = base64.split(',')[1];
                                      const mimeType = file.type;
                                      analysisResult = await analyzeItemImage(base64Data, mimeType);
                                    } catch (error) {
                                      console.error('AI Analysis failed:', error);
                                    } finally {
                                      setAiProcessing(false);
                                    }
                                  }

                                  setEditingItem(prev => {
                                    if (!prev) return null;
                                    const imgs = prev.imageUrls || (prev.imageUrl ? [prev.imageUrl] : []);
                                    if (imgs.length >= 10) return prev;
                                    
                                    if (analysisResult && analysisResult.description) {
                                      return {
                                        ...prev,
                                        description: analysisResult.description,
                                        name: analysisResult.category || prev.name,
                                        imageUrls: [...imgs, base64]
                                      };
                                    }

                                    return {
                                      ...prev,
                                      imageUrls: [...imgs, base64]
                                    };
                                  });
                                };
                                reader.readAsDataURL(file);
                              }
                            }}
                            className={`aspect-square rounded-2xl border-2 border-dashed border-slate-200 dark:border-emerald-900/30 flex flex-col items-center justify-center hover:border-blue-500 hover:bg-blue-500/5 transition-all group ${aiProcessing ? 'opacity-50 cursor-wait' : ''}`}
                          >
                            {aiProcessing ? (
                              <div className="w-6 h-6 border-3 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                            ) : (
                              <>
                                <i className="fas fa-plus text-slate-300 group-hover:text-blue-500 transition-colors"></i>
                                <span className="text-[10px] text-slate-400 mt-2 font-bold group-hover:text-blue-500">{isRTL ? 'إضافة' : 'Add'}</span>
                              </>
                            )}
                          </button>
                        )}
                      </div>
                      <input 
                        type="file" 
                        ref={fileInputEditRef} 
                        onChange={async (e) => {
                          const files = Array.from(e.target.files || []);
                          const currentImages = editingItem.imageUrls || (editingItem.imageUrl ? [editingItem.imageUrl] : []);
                          const remainingSlots = 10 - currentImages.length;
                          const filesToProcess = files.slice(0, remainingSlots);

                          for (const fileObj of filesToProcess) {
                            const file = fileObj as File;
                            const reader = new FileReader();
                            reader.onloadend = async () => {
                              const base64 = reader.result as string;
                              setEditingItem(prev => {
                                if (!prev) return null;
                                const imgs = prev.imageUrls || (prev.imageUrl ? [prev.imageUrl] : []);
                                const newImgs = [...imgs, base64];
                                return {
                                  ...prev,
                                  imageUrl: newImgs[0],
                                  imageUrls: newImgs
                                };
                              });
                              
                              // AI Image Analysis (only for first image if desc empty)
                              if (currentImages.length === 0 && !editingItem.description) {
                                setAiProcessing(true);
                                try {
                                  const base64Data = base64.split(',')[1];
                                  const mimeType = file.type;
                                  const analysis = await analyzeItemImage(base64Data, mimeType);
                                  
                                  if (analysis.description) {
                                    setEditingItem(prev => prev ? ({ 
                                      ...prev, 
                                      description: analysis.description,
                                      name: analysis.category || prev.name
                                    }) : null);
                                  }
                                } catch (error) {
                                  console.error('AI Analysis failed:', error);
                                } finally {
                                  setAiProcessing(false);
                                }
                              }
                            };
                            reader.readAsDataURL(file);
                          }
                        }} 
                        className="hidden" 
                        accept="image/*"
                        multiple
                        disabled={aiProcessing}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{t.itemName}</label>
                        <input 
                          type="text"
                          required
                          value={editingItem.name}
                          onChange={(e) => setEditingItem({...editingItem, name: e.target.value})}
                          className="w-full px-5 py-4 rounded-2xl bg-white/50 dark:bg-emerald-950/20 border border-slate-200 dark:border-emerald-900/20 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all text-sm font-bold"
                        />
                      </div>
                      <div className="space-y-2">
                        <SilkyDateInput
                          label={t.date}
                          required
                          min={new Date(new Date().setFullYear(new Date().getFullYear() - 20)).toISOString().split('T')[0]}
                          max={new Date().toISOString().split('T')[0]}
                          value={editingItem.dateFound}
                          onChange={(val) => setEditingItem({...editingItem, dateFound: val})}
                          isRTL={isRTL}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{t.gateLocation}</label>
                      <input 
                        type="text"
                        required
                        value={editingItem.foundLocation}
                        onChange={(e) => setEditingItem({...editingItem, foundLocation: e.target.value})}
                        className="w-full px-5 py-4 rounded-2xl bg-white/50 dark:bg-emerald-950/20 border border-slate-200 dark:border-emerald-900/20 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all text-sm font-bold"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{t.itemDesc}</label>
                      <textarea 
                        required
                        value={editingItem.description}
                        onChange={(e) => setEditingItem({...editingItem, description: e.target.value})}
                        className="w-full px-5 py-4 rounded-2xl bg-white/50 dark:bg-emerald-950/20 border border-slate-200 dark:border-emerald-900/20 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all text-sm font-bold min-h-[120px] resize-none"
                      />
                    </div>
                  </div>

                  <div className="space-y-8">
                    <div className="space-y-4">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{isRTL ? 'الموقع على الخريطة' : 'Map Location'}</label>
                      <div className="rounded-[32px] overflow-hidden border border-white/20 dark:border-emerald-900/20 shadow-lg p-6 md:p-8 bg-white/20 dark:bg-emerald-900/5">
                        <MapPicker 
                          city={editingItem.city}
                          lang={lang}
                          initialLocation={editingItem.coordinates}
                          onCityChange={(city) => setEditingItem({ ...editingItem, city })}
                          onLocationSelect={(lat, lng) => {
                            setEditingItem({ ...editingItem, coordinates: lat && lng ? { lat, lng } : undefined });
                          }}
                        />
                      </div>
                      {editingItem.coordinates && (
                        <div className="flex justify-between text-[10px] font-mono text-slate-400 px-2 bg-white/20 dark:bg-emerald-950/20 py-2 rounded-xl border border-white/10">
                          <span>LAT: {editingItem.coordinates.lat.toFixed(6)}</span>
                          <span>LNG: {editingItem.coordinates.lng.toFixed(6)}</span>
                        </div>
                      )}
                    </div>

                    <div className="pt-6 flex space-x-4 rtl:space-x-reverse">
                      <button
                        type="button"
                        onClick={() => setEditingItem(null)}
                        className="flex-1 px-6 py-4 bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 font-black rounded-2xl hover:bg-slate-200 dark:hover:bg-white/10 transition-all uppercase tracking-widest text-xs"
                      >
                        {t.cancel}
                      </button>
                      
                      {editingItem.status === 'PENDING' && (
                        <button
                          type="button"
                          disabled={uploading}
                          onClick={async (e) => {
                            // First update with edits, then approve
                            await handleUpdate(e as any);
                            handleApprove(editingItem.id);
                          }}
                          className="flex-1 px-6 py-4 bg-emerald-600 text-white font-black rounded-2xl shadow-xl shadow-emerald-600/30 hover:bg-emerald-700 transition-all flex items-center justify-center space-x-2 rtl:space-x-reverse disabled:opacity-50 uppercase tracking-widest text-xs"
                        >
                          <i className="fas fa-check-double"></i>
                          <span>{isRTL ? 'حفظ وموافقة' : 'Save & Approve'}</span>
                        </button>
                      )}

                      <button
                        type="submit"
                        disabled={uploading}
                        className="flex-[2] px-6 py-4 bg-blue-600 text-white font-black rounded-2xl shadow-xl shadow-blue-600/30 hover:bg-blue-700 transition-all flex items-center justify-center space-x-2 rtl:space-x-reverse disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-[0.98] uppercase tracking-widest text-xs"
                      >
                        {uploading ? (
                          <div className="w-6 h-6 border-3 border-white border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                          <>
                            <i className="fas fa-save"></i>
                            <span>{t.updateItem}</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}

        {editingLostItem && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xl overflow-y-auto"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white/80 dark:bg-[#162923]/80 backdrop-blur-2xl w-full max-w-4xl rounded-[40px] shadow-2xl overflow-hidden border border-white/20 dark:border-emerald-900/20 max-h-[90vh] overflow-y-auto custom-scrollbar"
            >
              <div className="p-8 border-b border-white/10 dark:border-emerald-900/10 flex items-center justify-between bg-white/20 dark:bg-emerald-950/20">
                <div className="flex items-center space-x-3 rtl:space-x-reverse">
                  <div className="w-12 h-12 rounded-2xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 shadow-inner">
                    <i className="fas fa-edit text-2xl"></i>
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">{isRTL ? 'تعديل بلاغ مفقود' : 'Edit Lost Report'}</h3>
                    <p className="text-xs text-slate-500 font-medium">{isRTL ? 'تحديث بيانات بلاغ الفقد' : 'Update lost report information'}</p>
                  </div>
                </div>
                <button onClick={() => setEditingLostItem(null)} className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-400 hover:bg-rose-500 hover:text-white transition-all">
                  <i className="fas fa-times text-xl"></i>
                </button>
              </div>

              <form onSubmit={handleUpdateLostItemSubmit} className="p-8">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div className="space-y-6">
                    <div className="space-y-4">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                        {t.itemImage} ({editingLostItem.images.length}/10)
                      </label>
                      <div className="grid grid-cols-3 gap-3">
                        <AnimatePresence mode="popLayout">
                          {editingLostItem.images.map((img, idx) => (
                            <motion.div 
                              key={idx}
                              layout
                              initial={{ scale: 0.8, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              exit={{ scale: 0.8, opacity: 0 }}
                              className="relative aspect-square rounded-2xl overflow-hidden group border border-slate-200 dark:border-emerald-900/20 shadow-sm"
                            >
                              <img src={img} alt="" className="w-full h-full object-cover" />
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <button 
                                  type="button"
                                  onClick={() => removeEditingLostItemImage(idx)}
                                  className="w-8 h-8 bg-rose-500 text-white rounded-xl flex items-center justify-center hover:scale-110 transition-transform shadow-lg"
                                >
                                  <i className="fas fa-trash-alt text-xs"></i>
                                </button>
                              </div>
                            </motion.div>
                          ))}
                        </AnimatePresence>
                        {editingLostItem.images.length < 10 && (
                          <motion.button 
                            layout
                            type="button"
                            onClick={() => !aiProcessing && fileInputEditRef.current?.click()}
                            onDragOver={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                            }}
                            onDrop={async (e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              const files = Array.from(e.dataTransfer.files || []);
                              const remainingSlots = 10 - editingLostItem.images.length;
                              const filesToProcess = files.slice(0, remainingSlots);

                              for (const fileObj of filesToProcess) {
                                const file = fileObj as File;
                                const reader = new FileReader();
                                reader.onloadend = async () => {
                                  const base64 = reader.result as string;
                                  setEditingLostItem(prev => {
                                    if (!prev) return null;
                                    return {
                                      ...prev,
                                      images: [...prev.images, base64]
                                    };
                                  });
                                };
                                reader.readAsDataURL(file);
                              }
                            }}
                            className={`aspect-square rounded-2xl border-2 border-dashed border-slate-200 dark:border-emerald-900/30 flex flex-col items-center justify-center hover:border-blue-500 hover:bg-blue-50/50 dark:hover:bg-blue-900/10 transition-all group ${aiProcessing ? 'opacity-50 cursor-wait' : ''}`}
                          >
                            {aiProcessing ? (
                              <div className="w-6 h-6 border-3 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                            ) : (
                              <>
                                <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-white/5 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                                  <i className="fas fa-plus text-slate-400 group-hover:text-blue-500"></i>
                                </div>
                                <span className="text-[10px] font-bold text-slate-400 group-hover:text-blue-500 uppercase tracking-tighter">{t.add}</span>
                              </>
                            )}
                          </motion.button>
                        )}
                      </div>
                      <input 
                        type="file" 
                        ref={fileInputEditRef} 
                        onChange={async (e) => {
                          const files = Array.from(e.target.files || []);
                          const remainingSlots = 10 - editingLostItem.images.length;
                          const filesToProcess = files.slice(0, remainingSlots);

                          for (const fileObj of filesToProcess) {
                            const file = fileObj as File;
                            const reader = new FileReader();
                            reader.onloadend = async () => {
                              const base64 = reader.result as string;
                              setEditingLostItem(prev => {
                                if (!prev) return null;
                                return {
                                  ...prev,
                                  images: [...prev.images, base64]
                                };
                              });
                            };
                            reader.readAsDataURL(file);
                          }
                        }} 
                        className="hidden" 
                        accept="image/*"
                        multiple
                        disabled={aiProcessing}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{t.itemName}</label>
                        <input 
                          type="text"
                          required
                          value={editingLostItem.name}
                          onChange={(e) => setEditingLostItem({...editingLostItem, name: e.target.value})}
                          className="w-full px-5 py-4 rounded-2xl bg-white/50 dark:bg-emerald-950/20 border border-slate-200 dark:border-emerald-900/20 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all text-sm font-bold"
                        />
                      </div>
                      <div className="space-y-2">
                        <SilkyDateInput
                          label={t.date}
                          required
                          value={editingLostItem.dateLost}
                          onChange={(val) => setEditingLostItem({...editingLostItem, dateLost: val})}
                          isRTL={isRTL}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{t.city}</label>
                      <select 
                        value={editingLostItem.city}
                        onChange={(e) => setEditingLostItem({...editingLostItem, city: e.target.value as City})}
                        className="w-full px-5 py-4 rounded-2xl bg-white/50 dark:bg-emerald-950/20 border border-slate-200 dark:border-emerald-900/20 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all text-sm font-bold appearance-none"
                      >
                        <option value={City.MECCA}>{t.mecca}</option>
                        <option value={City.MADINA}>{t.madina}</option>
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{t.itemDesc}</label>
                      <textarea 
                        required
                        value={editingLostItem.description}
                        onChange={(e) => setEditingLostItem({...editingLostItem, description: e.target.value})}
                        className="w-full px-5 py-4 rounded-2xl bg-white/50 dark:bg-emerald-950/20 border border-slate-200 dark:border-emerald-900/20 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all text-sm font-bold min-h-[120px] resize-none"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col justify-end space-y-4">
                    <div className="flex space-x-4 rtl:space-x-reverse">
                      <button
                        type="button"
                        onClick={() => setEditingLostItem(null)}
                        className="flex-1 px-6 py-4 bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 font-black rounded-2xl hover:bg-slate-200 dark:hover:bg-white/10 transition-all uppercase tracking-widest text-xs"
                      >
                        {t.cancel}
                      </button>
                      
                      <button
                        type="submit"
                        disabled={uploading}
                        className="flex-[2] px-6 py-4 bg-blue-600 text-white font-black rounded-2xl shadow-xl shadow-blue-600/30 hover:bg-blue-700 transition-all flex items-center justify-center space-x-2 rtl:space-x-reverse disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-[0.98] uppercase tracking-widest text-xs"
                      >
                        {uploading ? (
                          <div className="w-6 h-6 border-3 border-white border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                          <>
                            <i className="fas fa-save"></i>
                            <span>{t.updateItem}</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedFeedback && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedFeedback(null)}
            className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xl"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white/80 dark:bg-[#162923]/80 backdrop-blur-2xl w-full max-w-lg rounded-[40px] shadow-2xl overflow-hidden border border-white/20 dark:border-emerald-900/20"
            >
              <div className="p-8 border-b border-white/10 dark:border-emerald-900/10 flex items-center justify-between bg-white/20 dark:bg-emerald-950/20">
                <div className="flex items-center space-x-3 rtl:space-x-reverse">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-inner ${
                    selectedFeedback.type === 'COMPLAINT' ? 'bg-red-100 text-red-600' :
                    selectedFeedback.type === 'RECOMMENDATION' ? 'bg-amber-100 text-amber-600' :
                    'bg-blue-100 text-blue-600'
                  }`}>
                    <i className={`fas ${
                      selectedFeedback.type === 'COMPLAINT' ? 'fa-exclamation-circle' :
                      selectedFeedback.type === 'RECOMMENDATION' ? 'fa-lightbulb' :
                      'fa-comment'
                    } text-2xl`}></i>
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">
                      {selectedFeedback.type === 'COMPLAINT' ? t.feedbackComplaint :
                       selectedFeedback.type === 'RECOMMENDATION' ? t.feedbackRecommendation :
                       t.feedbackGeneral}
                    </h3>
                    <p className="text-xs text-slate-500 font-medium">{new Date(selectedFeedback.timestamp).toLocaleString()}</p>
                  </div>
                </div>
                <button onClick={() => setSelectedFeedback(null)} className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-400 hover:bg-rose-500 hover:text-white transition-all">
                  <i className="fas fa-times text-xl"></i>
                </button>
              </div>
              <div className="p-8">
                <div className="bg-white/50 dark:bg-emerald-950/20 p-8 rounded-[32px] border border-slate-100 dark:border-emerald-900/10 shadow-inner">
                  <p className="text-slate-800 dark:text-white leading-relaxed whitespace-pre-wrap font-medium">
                    {selectedFeedback.content}
                  </p>
                </div>
                <div className="mt-8 flex justify-end">
                  <button 
                    onClick={() => {
                      if (!selectedFeedback.read) markAsRead(selectedFeedback.id);
                      setSelectedFeedback(null);
                    }}
                    className="px-10 py-4 bg-emerald-700 text-white font-black rounded-2xl shadow-xl shadow-emerald-700/30 hover:bg-emerald-800 transition-all hover:scale-[1.02] active:scale-[0.98] uppercase tracking-widest text-xs"
                  >
                    {isRTL ? 'إغلاق' : 'Close'}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedUser && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedUser(null)}
            className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xl"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white/80 dark:bg-[#162923]/80 backdrop-blur-2xl w-full max-w-md rounded-[40px] shadow-2xl overflow-hidden border border-white/20 dark:border-emerald-900/20"
            >
              <div className="p-8 border-b border-white/10 dark:border-emerald-900/10 flex items-center justify-between bg-white/20 dark:bg-emerald-950/20">
                <div className="flex items-center space-x-3 rtl:space-x-reverse">
                  <div className="w-12 h-12 rounded-2xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 shadow-inner">
                    <i className="fas fa-user-circle text-2xl"></i>
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">{t.userDetails}</h3>
                    <p className="text-xs text-slate-500 font-medium">{isRTL ? 'معلومات الحساب' : 'Account information'}</p>
                  </div>
                </div>
                <button onClick={() => setSelectedUser(null)} className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-400 hover:bg-rose-500 hover:text-white transition-all">
                  <i className="fas fa-times text-xl"></i>
                </button>
              </div>
              <div className="p-8 space-y-6">
                <div className="grid grid-cols-1 gap-6">
                  <div className="p-4 rounded-2xl bg-white/50 dark:bg-emerald-950/20 border border-slate-100 dark:border-emerald-900/10 shadow-inner">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{t.fullName}</label>
                    <p className="text-base font-bold text-slate-800 dark:text-white mt-1">{selectedUser.fullName || '-'}</p>
                  </div>
                  <div className="p-4 rounded-2xl bg-white/50 dark:bg-emerald-950/20 border border-slate-100 dark:border-emerald-900/10 shadow-inner">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{t.email}</label>
                    <p className="text-base font-bold text-slate-600 dark:text-slate-300 mt-1">{selectedUser.email || '-'}</p>
                  </div>
                  <div className="p-4 rounded-2xl bg-white/50 dark:bg-emerald-950/20 border border-slate-100 dark:border-emerald-900/10 shadow-inner">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{t.phone}</label>
                    <p className="text-base font-bold text-slate-600 dark:text-slate-300 mt-1">{selectedUser.phoneNumber || '-'}</p>
                  </div>
                  <div className="p-4 rounded-2xl bg-white/50 dark:bg-emerald-950/20 border border-slate-100 dark:border-emerald-900/10 shadow-inner">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{t.passport}</label>
                    <p className="text-base font-bold text-slate-600 dark:text-slate-300 mt-1 font-mono tracking-wider">{selectedUser.passportNumber || '-'}</p>
                  </div>
                </div>
                <div className="pt-4 flex justify-end">
                  <button 
                    onClick={() => setSelectedUser(null)}
                    className="w-full px-8 py-4 bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 font-black rounded-2xl hover:bg-slate-200 dark:hover:bg-white/10 transition-all uppercase tracking-widest text-xs"
                  >
                    {isRTL ? 'إغلاق' : 'Close'}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Ban Modal */}
      <AnimatePresence>
        {showBanModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white dark:bg-emerald-950 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-100 dark:border-emerald-900/20"
            >
              <div className="p-6 border-b border-slate-100 dark:border-emerald-900/10 flex justify-between items-center bg-rose-50 dark:bg-rose-900/10">
                <div className="flex items-center space-x-3 rtl:space-x-reverse">
                  <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center text-rose-600">
                    <i className="fas fa-user-slash text-lg"></i>
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-slate-800 dark:text-white tracking-tight">
                      {isRTL ? 'حظر المستخدم' : 'Ban User'}
                    </h3>
                    <p className="text-[10px] text-rose-600 font-bold uppercase tracking-widest">
                      {showBanModal.email || showBanModal.phoneNumber}
                    </p>
                  </div>
                </div>
                <button onClick={() => setShowBanModal(null)} className="text-slate-400 hover:text-slate-600 transition-colors">
                  <i className="fas fa-times"></i>
                </button>
              </div>
              
              <div className="p-6 space-y-4">
                <div className="relative">
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">
                    {isRTL ? 'مدة الحظر' : 'Ban Duration'}
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsBanDurationOpen(!isBanDurationOpen)}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-emerald-900/10 border border-slate-100 dark:border-emerald-900/10 rounded-xl text-sm focus:ring-2 focus:ring-rose-500 outline-none transition-all flex items-center justify-between group"
                  >
                    <span className="font-bold text-slate-700 dark:text-white">
                      {[
                        { value: '3600000', label: isRTL ? 'ساعة واحدة' : '1 Hour' },
                        { value: '86400000', label: isRTL ? '24 ساعة' : '24 Hours' },
                        { value: '604800000', label: isRTL ? 'أسبوع واحد' : '1 Week' },
                        { value: '2592000000', label: isRTL ? 'شهر واحد' : '1 Month' },
                        { value: 'PERMANENT', label: isRTL ? 'دائم' : 'Permanent' },
                        { value: 'REMOVE_BAN', label: isRTL ? 'إزالة الحظر' : 'Remove Ban' }
                      ].find(d => d.value === banForm.duration)?.label}
                    </span>
                    <i className={`fas fa-chevron-down text-slate-400 transition-transform duration-300 ${isBanDurationOpen ? 'rotate-180' : ''}`}></i>
                  </button>
                  
                  <AnimatePresence>
                    {isBanDurationOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: -10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -10, scale: 0.95 }}
                        className="absolute z-[110] top-full left-0 right-0 mt-2 bg-white dark:bg-[#1a2e28] border border-slate-100 dark:border-emerald-900/20 rounded-2xl shadow-2xl overflow-hidden"
                      >
                        <div className="p-2 space-y-1">
                          {[
                            { value: '3600000', label: isRTL ? 'ساعة واحدة' : '1 Hour' },
                            { value: '86400000', label: isRTL ? '24 ساعة' : '24 Hours' },
                            { value: '604800000', label: isRTL ? 'أسبوع واحد' : '1 Week' },
                            { value: '2592000000', label: isRTL ? 'شهر واحد' : '1 Month' },
                            { value: 'PERMANENT', label: isRTL ? 'دائم' : 'Permanent' },
                            { value: 'REMOVE_BAN', label: isRTL ? 'إزالة الحظر' : 'Remove Ban' }
                          ].map((option) => (
                            <button
                              key={option.value}
                              type="button"
                              onClick={() => {
                                setBanForm({ ...banForm, duration: option.value });
                                setIsBanDurationOpen(false);
                              }}
                              className={`w-full px-4 py-3 rounded-xl text-sm font-bold text-left rtl:text-right transition-all flex items-center justify-between ${
                                banForm.duration === option.value 
                                  ? (option.value === 'REMOVE_BAN' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'bg-rose-500 text-white shadow-lg shadow-rose-500/20')
                                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-emerald-900/10'
                              }`}
                            >
                              <span className={option.value === 'REMOVE_BAN' && banForm.duration !== option.value ? 'text-emerald-600 dark:text-emerald-400' : ''}>
                                {option.label}
                              </span>
                              {banForm.duration === option.value && <i className="fas fa-check text-[10px]"></i>}
                            </button>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
                
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">
                    {isRTL ? 'سبب الحظر' : 'Reason for Ban'}
                  </label>
                  <textarea 
                    value={banForm.reason}
                    onChange={(e) => setBanForm({ ...banForm, reason: e.target.value })}
                    placeholder={isRTL ? 'أدخل سبب الحظر هنا...' : 'Enter reason for ban...'}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-emerald-900/10 border border-slate-100 dark:border-emerald-900/10 rounded-xl text-sm focus:ring-2 focus:ring-rose-500 outline-none transition-all h-24 resize-none"
                  />
                </div>
                
                <div className="bg-rose-50 dark:bg-rose-900/10 p-4 rounded-xl border border-rose-100 dark:border-rose-900/20">
                  <div className="flex items-start space-x-2 rtl:space-x-reverse">
                    <i className="fas fa-info-circle text-rose-600 mt-0.5"></i>
                    <p className="text-[10px] text-rose-700 dark:text-rose-400 leading-relaxed">
                      {isRTL 
                        ? 'سيؤدي هذا الإجراء إلى منع المستخدم من تسجيل الدخول أو إنشاء حساب جديد باستخدام هذا البريد الإلكتروني أو رقم الهاتف للمدة المحددة.' 
                        : 'This action will prevent the user from logging in or creating a new account using this email or phone number for the specified duration.'}
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="p-6 bg-slate-50 dark:bg-emerald-900/10 flex space-x-3 rtl:space-x-reverse">
                <button 
                  onClick={() => setShowBanModal(null)}
                  className="flex-1 px-4 py-3 bg-white dark:bg-emerald-950 text-slate-600 dark:text-slate-400 text-sm font-bold rounded-xl border border-slate-200 dark:border-emerald-900/20 hover:bg-slate-50 transition-all"
                >
                  {isRTL ? 'إلغاء' : 'Cancel'}
                </button>
                <button 
                  onClick={handleBanUser}
                  disabled={loading || !banForm.reason}
                  className="flex-1 px-4 py-3 bg-rose-600 hover:bg-rose-700 text-white text-sm font-bold rounded-xl shadow-lg shadow-rose-600/20 disabled:opacity-50 transition-all flex items-center justify-center space-x-2 rtl:space-x-reverse"
                >
                  {loading ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  ) : (
                    <>
                      <i className="fas fa-user-slash"></i>
                      <span>{isRTL ? 'تأكيد الحظر' : 'Confirm Ban'}</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {itemClaimsModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setItemClaimsModal(null)}
            className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xl"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white/80 dark:bg-[#162923]/80 backdrop-blur-2xl w-full max-w-4xl rounded-[40px] shadow-2xl overflow-hidden border border-white/20 dark:border-emerald-900/20"
            >
              <div className="p-8 border-b border-white/10 dark:border-emerald-900/10 flex items-center justify-between bg-white/20 dark:bg-emerald-950/20">
                <div className="flex items-center space-x-3 rtl:space-x-reverse">
                  <div className="w-12 h-12 rounded-2xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-amber-600 shadow-inner">
                    <i className="fas fa-list-ul text-2xl"></i>
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">
                      {isRTL ? 'جميع طلبات الاستلام للعنصر' : 'All Claims for Item'}: {itemClaimsModal.itemName}
                    </h3>
                    <p className="text-xs text-slate-500 font-medium">
                      {claims.filter(c => c.itemId === itemClaimsModal.itemId).length} {isRTL ? 'طلبات' : 'claims'}
                    </p>
                  </div>
                </div>
                <button onClick={() => setItemClaimsModal(null)} className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-400 hover:bg-rose-500 hover:text-white transition-all">
                  <i className="fas fa-times text-xl"></i>
                </button>
              </div>
              
              <div className="p-8 overflow-y-auto max-h-[60vh] custom-scrollbar">
                <table className="w-full text-left rtl:text-right">
                  <thead className="bg-white/30 dark:bg-emerald-950/20 text-[10px] uppercase tracking-[0.2em] text-slate-400 font-black">
                    <tr>
                      <th className="px-6 py-4">{t.claimant}</th>
                      <th className="px-6 py-4">{t.claimDetails}</th>
                      <th className="px-6 py-4">{isRTL ? 'الحالة' : 'Status'}</th>
                      <th className="px-6 py-4 text-center">{t.actions}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-emerald-900/10">
                    {claims.filter(c => c.itemId === itemClaimsModal.itemId).map((claim) => (
                      <tr key={claim.id} className="hover:bg-white/40 dark:hover:bg-emerald-900/5 transition-colors group">
                        <td className="px-6 py-5">
                          <div className="flex flex-col">
                            <span className="text-sm font-black text-slate-800 dark:text-white">{claim.userName}</span>
                            <span className="text-[10px] text-slate-400 font-medium">{claim.userEmail}</span>
                          </div>
                        </td>
                        <td className="px-6 py-5">
                          <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-1 font-medium">{claim.description}</p>
                        </td>
                        <td className="px-6 py-5">
                          <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest shadow-sm ${
                            claim.status === 'PENDING' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                            claim.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                            'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400'
                          }`}>
                            {claim.status === 'PENDING' ? (isRTL ? 'قيد الانتظار' : 'Pending') :
                             claim.status === 'APPROVED' ? (isRTL ? 'تمت الموافقة' : 'Approved') :
                             (isRTL ? 'تم الرفض' : 'Rejected')}
                          </span>
                        </td>
                        <td className="px-6 py-5">
                          <div className="flex items-center justify-center space-x-2 rtl:space-x-reverse">
                            <button 
                              onClick={() => {
                                setItemClaimsModal(null);
                                handleViewClaim(claim);
                              }}
                              className="w-9 h-9 bg-blue-500/10 text-blue-500 hover:bg-blue-500 hover:text-white rounded-xl transition-all flex items-center justify-center shadow-sm"
                              title={t.details}
                            >
                              <i className="fas fa-info-circle"></i>
                            </button>
                            <button 
                              onClick={() => {
                                setItemClaimsModal(null);
                                fetchUserInfo(claim.userId);
                              }}
                              className="w-9 h-9 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500 hover:text-white rounded-xl transition-all flex items-center justify-center shadow-sm"
                              title={isRTL ? 'معلومات المستخدم' : 'User Info'}
                            >
                              <i className="fas fa-user"></i>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              <div className="p-8 border-t border-white/10 dark:border-emerald-900/10 flex justify-end bg-white/20 dark:bg-emerald-950/20">
                <button 
                  onClick={() => setItemClaimsModal(null)}
                  className="px-10 py-4 bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 font-black rounded-2xl hover:bg-slate-200 dark:hover:bg-white/10 transition-all uppercase tracking-widest text-xs"
                >
                  {t.close}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {selectedClaim && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedClaim(null)}
            className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xl"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white/80 dark:bg-[#162923]/80 backdrop-blur-2xl w-full max-w-2xl rounded-[40px] shadow-2xl overflow-hidden border border-white/20 dark:border-emerald-900/20"
            >
              <div className="p-8 border-b border-white/10 dark:border-emerald-900/10 flex items-center justify-between bg-white/20 dark:bg-emerald-950/20">
                <div className="flex items-center space-x-3 rtl:space-x-reverse">
                  <div className="w-12 h-12 rounded-2xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 shadow-inner">
                    <i className="fas fa-file-invoice text-2xl"></i>
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">{t.claimDetails}</h3>
                    <p className="text-xs text-slate-500 font-medium">{new Date(selectedClaim.timestamp).toLocaleString()}</p>
                  </div>
                </div>
                <button onClick={() => setSelectedClaim(null)} className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-400 hover:bg-rose-500 hover:text-white transition-all">
                  <i className="fas fa-times text-xl"></i>
                </button>
              </div>
              
              <div className="p-8 overflow-y-auto max-h-[70vh] custom-scrollbar">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Claimant Info */}
                  <div className="space-y-6">
                    <h4 className="text-xs font-black text-emerald-600 uppercase tracking-[0.2em] border-b border-emerald-100 dark:border-emerald-900/20 pb-2">
                      {t.claimantInfo}
                    </h4>
                    <div className="space-y-4">
                      <div className="p-4 rounded-2xl bg-white/50 dark:bg-emerald-950/20 border border-slate-100 dark:border-emerald-900/10 shadow-inner">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{t.fullName}</label>
                        <p className="text-sm font-black text-slate-800 dark:text-white mt-1">{selectedClaim.userName}</p>
                      </div>
                      <div className="p-4 rounded-2xl bg-white/50 dark:bg-emerald-950/20 border border-slate-100 dark:border-emerald-900/10 shadow-inner">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{t.email}</label>
                        <p className="text-sm font-bold text-slate-600 dark:text-slate-300 mt-1">{selectedClaim.userEmail}</p>
                      </div>
                      <div className="p-4 rounded-2xl bg-white/50 dark:bg-emerald-950/20 border border-slate-100 dark:border-emerald-900/10 shadow-inner">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{t.phone}</label>
                        <p className="text-sm font-bold text-slate-600 dark:text-slate-300 mt-1">{selectedClaim.userPhone}</p>
                      </div>
                      <div className="p-4 rounded-2xl bg-white/50 dark:bg-emerald-950/20 border border-slate-100 dark:border-emerald-900/10 shadow-inner">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{t.passport}</label>
                        <p className="text-sm font-bold text-slate-600 dark:text-slate-300 mt-1 font-mono tracking-wider">{selectedClaim.userPassport}</p>
                      </div>
                    </div>
                  </div>

                  {/* Item Info */}
                  <div className="space-y-6">
                    <h4 className="text-xs font-black text-emerald-600 uppercase tracking-[0.2em] border-b border-emerald-100 dark:border-emerald-900/20 pb-2">
                      {t.itemInfo}
                    </h4>
                    <div className="space-y-4">
                      <div className="p-4 rounded-2xl bg-white/50 dark:bg-emerald-950/20 border border-slate-100 dark:border-emerald-900/10 shadow-inner">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{t.item}</label>
                        <p className="text-sm font-black text-slate-800 dark:text-white mt-1">{selectedClaim.itemName}</p>
                      </div>
                      <div className="p-4 rounded-2xl bg-white/50 dark:bg-emerald-950/20 border border-slate-100 dark:border-emerald-900/10 shadow-inner">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{t.description}</label>
                        <p className="text-sm font-medium text-slate-600 dark:text-slate-300 leading-relaxed mt-1">{selectedClaim.description}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 rounded-2xl bg-white/50 dark:bg-emerald-950/20 border border-slate-100 dark:border-emerald-900/10 shadow-inner">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{t.lostDate}</label>
                          <p className="text-sm font-bold text-slate-600 dark:text-slate-300 mt-1">{selectedClaim.lostDate}</p>
                        </div>
                        <div className="p-4 rounded-2xl bg-white/50 dark:bg-emerald-950/20 border border-slate-100 dark:border-emerald-900/10 shadow-inner">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{t.lostTime}</label>
                          <p className="text-sm font-bold text-slate-600 dark:text-slate-300 mt-1">{selectedClaim.lostTime}</p>
                        </div>
                      </div>
                      {(selectedClaim.itemImageUrls || (selectedClaim.itemImage ? [selectedClaim.itemImage] : [])).length > 0 && (
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{t.itemImage}</label>
                          <div className="mt-2 grid grid-cols-2 gap-3">
                            {(selectedClaim.itemImageUrls || (selectedClaim.itemImage ? [selectedClaim.itemImage] : [])).map((img: string, idx: number) => (
                              <div key={idx} className="rounded-2xl overflow-hidden border border-slate-200 dark:border-emerald-900/20 aspect-video shadow-sm">
                                <img src={img} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Uploader Info */}
                  <div className="space-y-6 md:col-span-2 pt-8 border-t border-white/10 dark:border-emerald-900/10">
                    <h4 className="text-xs font-black text-blue-600 uppercase tracking-[0.2em] border-b border-blue-100 dark:border-blue-900/20 pb-2 flex items-center justify-between">
                      <span>{isRTL ? 'معلومات الناشر' : 'Uploader Information'}</span>
                      {fetchingUploader && <i className="fas fa-spinner fa-spin text-xs"></i>}
                    </h4>
                    {uploaderInfo ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="p-4 rounded-2xl bg-white/50 dark:bg-emerald-950/20 border border-slate-100 dark:border-emerald-900/10 shadow-inner">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{t.fullName}</label>
                          <p className="text-sm font-black text-slate-800 dark:text-white mt-1">{uploaderInfo.fullName}</p>
                        </div>
                        <div className="p-4 rounded-2xl bg-white/50 dark:bg-emerald-950/20 border border-slate-100 dark:border-emerald-900/10 shadow-inner">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{t.email}</label>
                          <p className="text-sm font-bold text-slate-600 dark:text-slate-300 mt-1">{uploaderInfo.email}</p>
                        </div>
                        <div className="p-4 rounded-2xl bg-white/50 dark:bg-emerald-950/20 border border-slate-100 dark:border-emerald-900/10 shadow-inner">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{t.phone}</label>
                          <p className="text-sm font-bold text-slate-600 dark:text-slate-300 mt-1">{uploaderInfo.phone}</p>
                        </div>
                        <div className="p-4 rounded-2xl bg-white/50 dark:bg-emerald-950/20 border border-slate-100 dark:border-emerald-900/10 shadow-inner">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{t.passport}</label>
                          <p className="text-sm font-bold text-slate-600 dark:text-slate-300 mt-1 font-mono tracking-wider">{uploaderInfo.passport || 'N/A'}</p>
                        </div>
                      </div>
                    ) : !fetchingUploader && (
                      <p className="text-xs text-slate-400 italic font-medium">
                        {isRTL ? 'معلومات الناشر غير متوفرة أو مجهولة' : 'Uploader information not available or anonymous'}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="p-8 border-t border-white/10 dark:border-emerald-900/10 flex justify-end space-x-4 rtl:space-x-reverse bg-white/20 dark:bg-emerald-950/20">
                <button 
                  onClick={() => setSelectedClaim(null)}
                  className="px-10 py-4 bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 font-black rounded-2xl hover:bg-slate-200 dark:hover:bg-white/10 transition-all uppercase tracking-widest text-xs"
                >
                  {t.close}
                </button>
                {selectedClaim.status === 'PENDING' && (
                  <div className="flex space-x-4 rtl:space-x-reverse">
                    <button 
                      onClick={() => {
                        handleUpdateClaimStatus(selectedClaim.id, 'REJECTED');
                        setSelectedClaim(null);
                      }}
                      className="px-8 py-4 bg-rose-500/10 text-rose-500 font-black rounded-2xl hover:bg-rose-500 hover:text-white transition-all uppercase tracking-widest text-xs shadow-sm"
                    >
                      {t.reject}
                    </button>
                    <button 
                      onClick={() => {
                        handleUpdateClaimStatus(selectedClaim.id, 'APPROVED');
                        setSelectedClaim(null);
                      }}
                      className="px-8 py-4 bg-emerald-700 text-white font-black rounded-2xl shadow-xl shadow-emerald-700/30 hover:bg-emerald-800 transition-all hover:scale-[1.02] active:scale-[0.98] uppercase tracking-widest text-xs"
                    >
                      {t.approve}
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedMatchLostItem && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedMatchLostItem(null)}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xl"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white/80 dark:bg-[#162923]/80 backdrop-blur-2xl w-full max-w-5xl rounded-[40px] shadow-2xl overflow-hidden border border-white/20 dark:border-emerald-900/20"
            >
              <div className="p-8 border-b border-white/10 dark:border-emerald-900/10 flex items-center justify-between bg-white/20 dark:bg-emerald-950/20">
                <div className="flex items-center space-x-3 rtl:space-x-reverse">
                  <div className="w-12 h-12 rounded-2xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-purple-600 shadow-inner">
                    <i className="fas fa-robot text-2xl"></i>
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">
                      {isRTL ? 'تطابقات مقترحة لـ' : 'Suggested Matches for'} {selectedMatchLostItem.lostItem.name}
                    </h3>
                    <p className="text-xs text-slate-500 font-medium uppercase tracking-widest">
                      {selectedMatchLostItem.matches.length} {isRTL ? 'تطابقات محتملة تم العثور عليها' : 'potential matches found'}
                    </p>
                  </div>
                </div>
                <button onClick={() => setSelectedMatchLostItem(null)} className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-400 hover:bg-rose-500 hover:text-white transition-all">
                  <i className="fas fa-times text-xl"></i>
                </button>
              </div>
              
              <div className="p-8 overflow-y-auto max-h-[70vh] custom-scrollbar">
                <div className="space-y-6">
                  {selectedMatchLostItem.matches.map((match: any) => (
                    <div key={match.id} className="p-6 rounded-3xl bg-white/50 dark:bg-emerald-950/20 border border-slate-100 dark:border-emerald-900/10 shadow-sm hover:shadow-md transition-all">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                        <div className="flex items-center space-x-4 rtl:space-x-reverse">
                          <div className="w-20 h-20 rounded-2xl overflow-hidden border-2 border-white dark:border-emerald-900/20 shadow-sm">
                            <img src={match.foundItem.imageUrl} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          </div>
                          <div>
                            <h4 className="text-lg font-black text-slate-800 dark:text-white">{match.foundItem.name}</h4>
                            <div className="flex items-center mt-1 space-x-2 rtl:space-x-reverse">
                              <span className="text-[10px] font-bold text-purple-600 bg-purple-100 dark:bg-purple-900/30 px-2 py-1 rounded-full">
                                {Math.round(match.score * 100)}% Match
                              </span>
                              <span className="text-[10px] font-bold text-slate-500">
                                {isRTL ? 'وجد في:' : 'Found on:'} {formatDate(match.foundItem.dateFound)}
                              </span>
                            </div>
                            <p className="text-xs text-slate-500 mt-2 leading-relaxed max-w-md">
                              {match.reason}
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-3 rtl:space-x-reverse">
                          <button 
                            onClick={() => fetchUserInfo(match.foundItem.submittedBy!)}
                            className="p-3 bg-emerald-50 dark:bg-emerald-900/10 text-emerald-600 rounded-2xl hover:bg-emerald-100 transition-all flex items-center space-x-2 rtl:space-x-reverse"
                            title={isRTL ? 'بيانات صاحب البلاغ' : 'Reporter Info'}
                          >
                            <i className="fas fa-id-card"></i>
                            <span className="text-[10px] font-black uppercase tracking-widest">{isRTL ? 'بيانات صاحب البلاغ' : 'Reporter'}</span>
                          </button>
                          
                          <div className="h-10 w-px bg-slate-200 dark:bg-white/10 mx-2"></div>
                          
                          <button 
                            onClick={() => {
                              onResolveLostItem(selectedMatchLostItem.lostItem.id!);
                              setSuccessMessage(isRTL ? 'تم قبول التطابق' : 'Match accepted');
                              setAiMatches(prev => prev.filter(m => m.lostItem.id !== selectedMatchLostItem.lostItem.id));
                              setSelectedMatchLostItem(null);
                            }}
                            className="px-6 py-3 bg-emerald-600 text-white text-xs font-black rounded-2xl hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-600/20"
                          >
                            {isRTL ? 'قبول' : 'Accept'}
                          </button>
                          <button 
                            onClick={() => {
                              const updatedMatches = selectedMatchLostItem.matches.filter((m: any) => m.id !== match.id);
                              if (updatedMatches.length === 0) {
                                setAiMatches(prev => prev.filter(m => m.lostItem.id !== selectedMatchLostItem.lostItem.id));
                                setSelectedMatchLostItem(null);
                              } else {
                                setSelectedMatchLostItem({ ...selectedMatchLostItem, matches: updatedMatches });
                                setAiMatches(prev => prev.map(m => m.lostItem.id === selectedMatchLostItem.lostItem.id ? { ...m, matches: updatedMatches } : m));
                              }
                            }}
                            className="px-6 py-3 bg-rose-500/10 text-rose-500 text-xs font-black rounded-2xl hover:bg-rose-500 hover:text-white transition-all"
                          >
                            {isRTL ? 'رفض' : 'Reject'}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="p-8 bg-white/20 dark:bg-emerald-950/20 flex justify-end">
                <button 
                  onClick={() => setSelectedMatchLostItem(null)}
                  className="px-10 py-4 bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 font-black rounded-2xl hover:bg-slate-200 dark:hover:bg-white/10 transition-all uppercase tracking-widest text-xs"
                >
                  {isRTL ? 'إغلاق' : 'Close'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {fetchingUser && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-xl"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white/80 dark:bg-[#162923]/80 backdrop-blur-2xl p-10 rounded-[40px] shadow-2xl flex flex-col items-center space-y-6 border border-white/20 dark:border-emerald-900/20"
            >
              <div className="relative">
                <div className="w-20 h-20 border-4 border-emerald-100 dark:border-emerald-900/20 rounded-full"></div>
                <div className="w-20 h-20 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin absolute top-0 left-0"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <i className="fas fa-user-circle text-2xl text-emerald-600 animate-pulse"></i>
                </div>
              </div>
              <div className="text-center space-y-2">
                <p className="text-xl font-black text-slate-800 dark:text-white tracking-tight">
                  {isRTL ? 'جاري جلب البيانات...' : 'Fetching User Details...'}
                </p>
                <p className="text-xs text-slate-500 font-medium uppercase tracking-widest">
                  {isRTL ? 'يرجى الانتظار لحظة' : 'Please wait a moment'}
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showMapModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xl"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white/80 dark:bg-[#162923]/80 backdrop-blur-2xl w-full max-w-4xl rounded-[40px] shadow-2xl overflow-hidden border border-white/20 dark:border-emerald-900/20"
            >
              <div className="p-8 border-b border-white/10 dark:border-emerald-900/10 flex items-center justify-between bg-white/20 dark:bg-emerald-950/20">
                <div className="flex items-center space-x-3 rtl:space-x-reverse">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 shadow-inner">
                    <i className="fas fa-map-marked-alt text-2xl"></i>
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">{showMapModal.name}</h3>
                    <p className="text-xs text-slate-500 font-medium uppercase tracking-widest">{isRTL ? 'موقع العثور على العنصر' : 'Exact location where item was found'}</p>
                  </div>
                </div>
                <button onClick={() => setShowMapModal(null)} className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-400 hover:bg-rose-500 hover:text-white transition-all">
                  <i className="fas fa-times text-xl"></i>
                </button>
              </div>
              <div className="p-4">
                <div className="h-[500px] rounded-[32px] overflow-hidden border border-slate-200 dark:border-emerald-900/20 shadow-inner">
                  <MapContainer 
                    center={[showMapModal.lat, showMapModal.lng]} 
                    zoom={18} 
                    style={{ height: '100%', width: '100%' }}
                  >
                    <TileLayer
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    />
                    <Marker position={[showMapModal.lat, showMapModal.lng]} />
                  </MapContainer>
                </div>
              </div>
              <div className="p-8 bg-white/20 dark:bg-emerald-950/20 flex justify-between items-center">
                <div className="text-xs font-black text-slate-400 font-mono tracking-widest bg-slate-100 dark:bg-white/5 px-4 py-2 rounded-xl">
                  {showMapModal.lat.toFixed(6)}, {showMapModal.lng.toFixed(6)}
                </div>
                <button 
                  onClick={() => setShowMapModal(null)}
                  className="px-10 py-4 bg-emerald-700 text-white font-black rounded-2xl shadow-xl shadow-emerald-700/30 hover:bg-emerald-800 transition-all hover:scale-[1.02] active:scale-[0.98] uppercase tracking-widest text-xs"
                >
                  {isRTL ? 'إغلاق' : 'Close'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      </div>
    </>
  );
};

export default AdminDashboard;
