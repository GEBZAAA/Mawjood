import { API_BASE } from './apiConfig';
import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { City, AuthenticatedUser, Step, View, Language } from './types';
import { translations } from './translations';
import AuthForm from './components/AuthForm';
import Dashboard from './components/Dashboard';
import SearchSection from './components/SearchSection';
import LostItemForm from './components/LostItemForm';
import ReportLostItemForm from './components/ReportLostItemForm';
import ProfileSection from './components/ProfileSection';
import SettingsSection from './components/SettingsSection';
import NotificationSection from './components/NotificationSection';
import AdminDashboard from './components/AdminDashboard';
import BottomNav from './components/BottomNav';
import Sidebar from './components/Sidebar';
import LiveBackground from './components/LiveBackground';
import MatchResults from './components/MatchResults';
import HelpModal from './components/HelpModal';
import { performSemanticMatch } from './services/geminiService';
import { FOUND_ITEMS_DATABASE, SUPPORTED_LANGUAGES } from './constants';
import { FoundItem, MatchResult, LostItemReport } from './types';
import { formatDate, formatDateTime } from './utils';

const App: React.FC = () => {
  const [lang, setLang] = useState<Language>('en');
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('theme');
    if (saved) return saved === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });
  
  const [step, setStep] = useState<Step>('AUTH');
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [activeView, setActiveView] = useState<View>('HOME');
  const [viewKey, setViewKey] = useState(0);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('user_token'));
  const [user, setUser] = useState<AuthenticatedUser | null>(() => {
    const saved = localStorage.getItem('user_data');
    return saved ? JSON.parse(saved) : null;
  });
  const [isAdminView, setIsAdminView] = useState(true);
  const [selectedCity, setSelectedCity] = useState<City>(City.MECCA);
  const [searchResults, setSearchResults] = useState<MatchResult[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [unreadFeedbackCount, setUnreadFeedbackCount] = useState(0);
  const lastLostItemCountRef = useRef(0);
  const [showNewLostItemToast, setShowNewLostItemToast] = useState(false);
  const [items, setItems] = useState<FoundItem[]>([]);
  const [lostItems, setLostItems] = useState<LostItemReport[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [profileInitialView, setProfileInitialView] = useState<'INFO' | 'SETTINGS' | 'REPORTS'>('INFO');
  const profileMenuRef = React.useRef<HTMLDivElement>(null);
  const notificationsRef = React.useRef<HTMLDivElement>(null);

  const t = useMemo(() => translations[lang], [lang]);
  const isRTL = lang === 'ar' || lang === 'ur' || lang === 'fa';

  // Helper for resilient fetch
  const fetchWithRetry = async (url: string, options: RequestInit = {}, retries = 2, delay = 1000): Promise<Response> => {
    try {
      const fullUrl = url.startsWith('/api/') ? `${API_BASE}${url}` : url;
    const response = await fetch(fullUrl, options);
      if (!response.ok && response.status >= 500 && retries > 0) {
        throw new Error(`Server error: ${response.status}`);
      }
      return response;
    } catch (error) {
      if (retries > 0) {
        console.warn(`Fetch failed for ${url}, retrying in ${delay}ms... (${retries} left)`, error);
        await new Promise(resolve => setTimeout(resolve, delay));
        return fetchWithRetry(url, options, retries - 1, delay * 2);
      }
      throw error;
    }
  };

  // Fetch items on mount
  useEffect(() => {
    const checkHealth = async () => {
      try {
        const res = await fetchWithRetry('/api/health');
        if (res.ok) {
          const data = await res.json();
          console.log('[API] Health Check Success:', data);
        } else {
          console.warn('[API] Health Check Status:', res.status);
        }
      } catch (e) {
        console.error('[API] Health Check Failed:', e);
      }
    };
    checkHealth();

    const fetchItems = async () => {
      try {
        const response = await fetchWithRetry('/api/items');
        if (response.ok) {
          const data = await response.json();
          // If DB is empty, use the hardcoded ones as fallback for first time
          if (data.length === 0) {
            setItems(FOUND_ITEMS_DATABASE);
          } else {
            setItems(data);
          }
        }
      } catch (error) {
        console.error('Failed to fetch items:', error);
        setItems(FOUND_ITEMS_DATABASE);
      }
    };
    fetchItems();

    const fetchLostItems = async () => {
      try {
        const response = await fetchWithRetry('/api/lost-items');
        if (response.ok) {
          const data = await response.json();
          const pendingCount = data.filter((i: any) => i.status === 'PENDING').length;
          if (pendingCount > lastLostItemCountRef.current && (user?.role === 'ADMIN' || user?.role === 'MANAGER')) {
            setShowNewLostItemToast(true);
            setTimeout(() => setShowNewLostItemToast(false), 5000);
          }
          lastLostItemCountRef.current = pendingCount;
          setLostItems(data);
        }
      } catch (error) {
        console.error('Failed to fetch lost items:', error);
      }
    };
    fetchLostItems();
    const interval = setInterval(fetchLostItems, 30000);
    return () => clearInterval(interval);
  }, []);

  // Handle clicks outside profile menu and notifications
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setShowProfileMenu(false);
      }
      if (notificationsRef.current && !notificationsRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Poll for unread feedback if admin/manager
  useEffect(() => {
    if ((user?.role === 'ADMIN' || user?.role === 'MANAGER') && token) {
      const fetchUnread = async (retries = 3) => {
        try {
          const response = await fetchWithRetry('/api/feedback', {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (response.ok) {
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
              const feedbacks = await response.json();
              const unread = feedbacks.filter((f: any) => !f.read).length;
              setUnreadFeedbackCount(unread);
            } else {
              const text = await response.text();
              console.error('Expected JSON from /api/feedback but got:', text.substring(0, 100));
            }
          } else if (response.status === 401 || response.status === 403) {
            console.warn('Auth failed for unread count, logging out. Status:', response.status);
            resetApp();
          }
        } catch (error) {
          if (retries > 0) {
            console.log(`Retrying fetch unread count... (${retries} left)`);
            setTimeout(() => fetchUnread(retries - 1), 2000);
          } else {
            console.error('Failed to fetch unread count after retries:', error);
          }
        }
      };
      
      fetchUnread();
      const interval = setInterval(() => fetchUnread(0), 30000);
      return () => clearInterval(interval);
    }
  }, [user, token]);

  useEffect(() => {
    if (user && token) {
      const fetchNotifications = async () => {
        try {
          const response = await fetchWithRetry('/api/notifications', {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (response.ok) {
            const data = await response.json();
            setNotifications(data);
          }
        } catch (error) {
          console.error('Failed to fetch notifications:', error);
        }
      };
      fetchNotifications();
      const interval = setInterval(fetchNotifications, 30000);
      return () => clearInterval(interval);
    }
  }, [user, token]);

  // Apply theme to document root
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  const toggleLang = () => setLang(prev => prev === 'en' ? 'ar' : 'en');
  const toggleTheme = () => setIsDarkMode(prev => !prev);

  // Restore step if user is logged in
  useEffect(() => {
    if (token && user) {
      setStep('MAIN');
      setIsAdminView(user.role === 'ADMIN' || user.role === 'MANAGER');
    }
  }, []);

  const handleLogin = (token: string, user: AuthenticatedUser) => {
    setToken(token);
    setUser(user);
    if (user.role === 'ADMIN' || user.role === 'MANAGER') {
      setLang('ar');
      setIsAdminView(true);
    } else {
      setIsAdminView(false);
    }
    setStep('MAIN');
    localStorage.setItem('user_token', token);
    localStorage.setItem('user_data', JSON.stringify(user));
  };

  const handleSearch = async (report: LostItemReport) => {
    console.log("Starting search for:", report);
    setIsSearching(true);
    setSearchResults(null);
    
    try {
      let matches: MatchResult[] = [];
      
      // 1. Try server-side search first for text if name is provided
      if (report.name && report.name.trim().length > 0) {
        const searchUrl = `/api/search?q=${encodeURIComponent(report.name)}&city=${report.city}`;
        const response = await fetchWithRetry(searchUrl);
        if (response.ok) {
          const serverResults = await response.json();
          if (serverResults.length > 0) {
            matches = serverResults.map((item: FoundItem) => ({
              itemId: item.id,
              matchScore: 0.8, // Base score for text match
              reason: "Text match found in database"
            }));
          }
        }
      }

      // 2. If we have an image, or if server search found nothing, or to enhance results
      // we run the semantic matching
      if ((report.images && report.images.length > 0) || matches.length === 0) {
        const approvedItems = items.filter(item => item.status === 'APPROVED' && item.city === report.city);
        console.log(`Running semantic match against ${approvedItems.length} items`);
        const semanticResults = await performSemanticMatch(report, approvedItems);
        
        // Merge results, prioritizing higher scores
        const existingIds = new Set(matches.map(m => m.itemId));
        semanticResults.forEach(res => {
          if (existingIds.has(res.itemId)) {
            const index = matches.findIndex(m => m.itemId === res.itemId);
            if (res.matchScore > matches[index].matchScore) {
              matches[index] = res;
            }
          } else {
            matches.push(res);
          }
        });
      }

      // Sort, filter by score (min 50%), and limit
      const filteredMatches = matches
        .filter(m => m.matchScore >= 0.5)
        .sort((a, b) => b.matchScore - a.matchScore);
        
      setSearchResults(filteredMatches.slice(0, 10));
    } catch (error) {
      console.error("Search failed:", error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleAddItem = async (newItem: FoundItem) => {
    try {
      const response = await fetchWithRetry('/api/items', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(newItem)
      });
      if (response.ok) {
        const savedItem = await response.json();
        setItems(prev => [savedItem, ...prev]);
        
        // Check if this new found item matches any reported lost items
        // Only check pending items in the same city to reduce API calls
        const relevantLostItems = lostItems.filter(li => li.status === 'PENDING' && li.city === savedItem.city);
        
        for (const lostItem of relevantLostItems) {
          // Add a significant delay to avoid hitting rate limits in the loop
          await new Promise(resolve => setTimeout(resolve, 1000));
          const results = await performSemanticMatch(lostItem, [savedItem], true);
          if (results && results.length > 0 && results[0].matchScore > 0.7) {
            // Create notification for the user who lost the item
            await fetchWithRetry('/api/notifications', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify({
                userId: lostItem.userId,
                type: 'MATCH_FOUND',
                message: `A found item might match your lost item: ${lostItem.name}`,
                messageAr: `قد يتطابق عنصر تم العثور عليه مع العنصر المفقود: ${lostItem.name}`,
                lostItemId: lostItem.id,
                foundItemId: savedItem.id
              })
            });
          }
        }
      }
    } catch (error) {
      console.error('Failed to save item:', error);
      // Fallback to local state if API fails
      setItems(prev => [newItem, ...prev]);
    }
  };

  const handleReportLostItem = async (newItem: LostItemReport) => {
    try {
      const response = await fetchWithRetry('/api/lost-items', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(newItem)
      });
      
      let savedLostItem = newItem;
      if (response.ok) {
        savedLostItem = await response.json();
        setLostItems(prev => [savedLostItem, ...prev]);
      } else {
        setLostItems(prev => [newItem, ...prev]);
      }
      
      // Check for matches with existing found items
      const approvedItems = items.filter(item => item.status === 'APPROVED' && item.city === savedLostItem.city);
      const results = await performSemanticMatch(savedLostItem, approvedItems);
      
      if (results && results.length > 0 && results[0].matchScore > 0.7) {
        // High confidence match found!
        await fetchWithRetry('/api/notifications', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            userId: user?.username,
            type: 'MATCH_FOUND',
            message: `A found item might match your lost item: ${savedLostItem.name}`,
            messageAr: `قد يتطابق عنصر تم العثور عليه مع العنصر المفقود: ${savedLostItem.name}`,
            lostItemId: savedLostItem.id,
            foundItemId: results[0].itemId
          })
        });
        
        alert(isRTL 
          ? 'تم العثور على عنصر مشابه! يرجى التحقق من الإشعارات الخاصة بك.' 
          : 'A similar item was found! Please check your notifications.');
      }
    } catch (error) {
      console.error('Failed to report lost item:', error);
      setLostItems(prev => [newItem, ...prev]);
    }
  };

  const handleDeleteItem = async (id: string) => {
    console.log('Deleting item:', id);
    try {
      const response = await fetchWithRetry(`/api/items/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      console.log('Delete response:', response.status);
      if (response.ok) {
        setItems(prev => prev.filter(item => item.id !== id));
      } else {
        const errorData = await response.json();
        console.error('Delete failed:', errorData);
      }
    } catch (error) {
      console.error('Failed to delete item:', error);
    }
  };

  const handleDeleteLostItem = async (id: string) => {
    try {
      const response = await fetchWithRetry(`/api/lost-items/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        setLostItems(prev => prev.filter(item => item.id !== id));
      }
    } catch (error) {
      console.error('Failed to delete lost item:', error);
    }
  };

  const handleResolveLostItem = async (id: string) => {
    try {
      const response = await fetchWithRetry(`/api/lost-items/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: 'RESOLVED' })
      });
      if (response.ok) {
        setLostItems(prev => prev.map(item => 
          item.id === id ? { ...item, status: 'RESOLVED' } : item
        ));
      }
    } catch (error) {
      console.error('Failed to resolve lost item:', error);
    }
  };

  const handleUpdateLostItem = async (updatedItem: LostItemReport) => {
    try {
      const response = await fetchWithRetry(`/api/lost-items/${updatedItem.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(updatedItem)
      });
      if (response.ok) {
        setLostItems(prev => prev.map(item => 
          item.id === updatedItem.id ? updatedItem : item
        ));
      }
    } catch (error) {
      console.error('Failed to update lost item:', error);
    }
  };

  const handleApproveItem = async (id: string) => {
    console.log('Approving item:', id);
    try {
      const response = await fetchWithRetry(`/api/items/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: 'APPROVED' })
      });
      console.log('Approve response:', response.status);
      if (response.ok) {
        setItems(prev => prev.map(item => 
          item.id === id ? { ...item, status: 'APPROVED' } : item
        ));
      } else {
        const errorData = await response.json();
        console.error('Approve failed:', errorData);
      }
    } catch (error) {
      console.error('Failed to approve item:', error);
    }
  };

  const handleUpdateItem = async (updatedItem: FoundItem) => {
    try {
      const response = await fetchWithRetry(`/api/items/${updatedItem.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(updatedItem)
      });
      if (response.ok) {
        const savedItem = await response.json();
        setItems(prev => prev.map(item => 
          item.id === savedItem.id ? savedItem : item
        ));
      }
    } catch (error) {
      console.error('Failed to update item:', error);
      setItems(prev => prev.map(item => 
        item.id === updatedItem.id ? updatedItem : item
      ));
    }
  };

  const resetApp = useCallback(() => {
    setStep('AUTH');
    setUser(null);
    setToken(null);
    setActiveView('HOME');
    setLang('en');
    localStorage.removeItem('user_token');
    localStorage.removeItem('user_data');
  }, []);

  const handleViewChange = (view: View) => {
    // Reset search states when navigating to ensure we go to the base view
    setIsSearching(false);
    setSearchResults(null);

    if (view === activeView) {
      setViewKey(prev => prev + 1);
    } else {
      setActiveView(view);
      setViewKey(0);
    }
  };

  const renderView = () => {
    if ((user?.role === 'ADMIN' || user?.role === 'MANAGER') && isAdminView) {
      return (
        <AdminDashboard 
          lang={lang} 
          token={token!}
          onLogout={resetApp} 
          items={items}
          lostItems={lostItems}
          user={user}
          onAddItem={handleAddItem}
          onDeleteItem={handleDeleteItem}
          onDeleteLostItem={handleDeleteLostItem}
          onResolveLostItem={handleResolveLostItem}
          onUpdateLostItem={handleUpdateLostItem}
          onApproveItem={handleApproveItem}
          onUpdateItem={handleUpdateItem}
          onToggleView={() => setIsAdminView(false)}
        />
      );
    }

    const getViewContent = () => {
      if (isSearching) {
        return (
          <div className="flex flex-col items-center justify-center min-h-[400px] space-y-6">
            <div className="relative">
              <div className="w-20 h-20 border-4 border-emerald-500/20 border-t-emerald-600 rounded-full animate-spin"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <i className="fas fa-brain text-emerald-600 animate-pulse"></i>
              </div>
            </div>
            <div className="text-center">
              <h3 className="text-xl font-bold text-slate-800 dark:text-white">{t.searching}</h3>
              <p className="text-slate-500 dark:text-slate-400 mt-2">{t.scanning}</p>
            </div>
          </div>
        );
      }

      if (searchResults) {
        return (
          <MatchResults 
            matches={searchResults} 
            database={items} 
            onBack={() => setSearchResults(null)} 
            lang={lang} 
            user={user!}
            token={token!}
          />
        );
      }

      switch (activeView) {
        case 'HOME':
          return <Dashboard 
                    user={user!} 
                    city={selectedCity}
                    onCityToggle={() => setSelectedCity(prev => prev === City.MECCA ? City.MADINA : City.MECCA)}
                    onAction={setActiveView}
                    lang={lang}
                    onReportFound={(newItem) => handleAddItem(newItem)}
                    items={items}
                  />;
        case 'SEARCH':
          return <SearchSection 
                    city={selectedCity} 
                    onMatch={handleSearch} 
                    lang={lang} 
                  />;
        case 'REPORT_FOUND':
          return <LostItemForm 
                    city={selectedCity}
                    user={user!}
                    onReport={(newItem) => {
                      handleAddItem(newItem as any);
                    }}
                    onBack={() => setActiveView('HOME')} 
                    lang={lang} 
                  />;
        case 'REPORT_LOST':
          return <ReportLostItemForm 
                    city={selectedCity}
                    user={user!}
                    onReport={(newItem) => {
                      handleReportLostItem(newItem);
                    }}
                    onBack={() => setActiveView('HOME')} 
                    lang={lang} 
                  />;
        case 'PROFILE':
          return (
            <ProfileSection 
              key={`profile-${viewKey}-${profileInitialView}`}
              user={user!} 
              items={items}
              lostItems={lostItems}
              onUpdateItem={handleUpdateItem}
              onDeleteItem={handleDeleteItem}
              onDeleteLostItem={handleDeleteLostItem}
              onLogout={resetApp} 
              onUpdateUser={(updatedUser) => setUser(updatedUser as AuthenticatedUser)}
              lang={lang} 
              token={token!}
              initialView={profileInitialView}
            />
          );
        case 'SETTINGS':
          return (
            <SettingsSection 
              user={user!} 
              lang={lang}
              onBack={() => setActiveView('HOME')}
            />
          );
        case 'NOTIFICATIONS':
          return (
            <NotificationSection 
              notifications={notifications} 
              lang={lang} 
              onMarkRead={async (id) => {
                try {
                  await fetchWithRetry(`/api/notifications/${id}/read`, {
                    method: 'PUT',
                    headers: { 'Authorization': `Bearer ${token}` }
                  });
                  setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
                } catch (e) {
                  console.error('Failed to mark read', e);
                }
              }} 
              onBack={() => setActiveView('HOME')} 
            />
          );
        default:
          return <Dashboard 
                    user={user!} 
                    city={selectedCity}
                    onCityToggle={() => setSelectedCity(prev => prev === City.MECCA ? City.MADINA : City.MECCA)}
                    onAction={setActiveView}
                    lang={lang}
                  />;
      }
    };

    return (
      <AnimatePresence mode="wait">
        <motion.div
          key={`${isSearching ? 'searching' : searchResults ? 'results' : activeView}-${lang}`}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.3 }}
        >
          {getViewContent()}
        </motion.div>
      </AnimatePresence>
    );
  };

  const TopControls = () => {
    const [showLangMenu, setShowLangMenu] = useState(false);
    const langMenuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (langMenuRef.current && !langMenuRef.current.contains(event.target as Node)) {
          setShowLangMenu(false);
        }
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
      <div className="flex items-center space-x-2 rtl:space-x-reverse relative">
        <button 
          onClick={toggleTheme}
          aria-label="Toggle Theme"
          className="p-2 w-10 h-10 rounded-xl bg-white dark:bg-[#162923] text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-emerald-900/20 transition-all flex items-center justify-center shadow-sm border border-slate-200 dark:border-emerald-900/20"
        >
          <i className={`fas ${isDarkMode ? 'fa-sun text-amber-400' : 'fa-moon text-indigo-600'}`}></i>
        </button>
        
        <div className="relative" ref={langMenuRef}>
          <button 
            onClick={() => setShowLangMenu(!showLangMenu)}
            className="px-4 py-2 h-10 rounded-xl bg-white dark:bg-[#162923] hover:bg-slate-100 dark:hover:bg-emerald-900/20 text-slate-700 dark:text-slate-300 font-bold text-sm transition-all flex items-center space-x-2 rtl:space-x-reverse shadow-sm border border-slate-200 dark:border-emerald-900/20"
          >
            <i className="fas fa-globe text-emerald-600"></i>
            <span className="uppercase">{lang}</span>
            <i className={`fas fa-chevron-down text-[10px] transition-transform ${showLangMenu ? 'rotate-180' : ''}`}></i>
          </button>

          <AnimatePresence>
            {showLangMenu && (
              <>
                <div 
                  className="fixed inset-0 z-40" 
                  onClick={() => setShowLangMenu(false)}
                ></div>
                <motion.div 
                  initial={{ opacity: 0, y: -10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -10, scale: 0.95 }}
                  transition={{ type: "spring", damping: 20, stiffness: 300 }}
                  className={`absolute top-full mt-2 ${isRTL ? 'left-0' : 'right-0'} w-48 bg-white dark:bg-[#061410] rounded-2xl shadow-2xl border border-slate-200 dark:border-emerald-900/20 py-2 z-50 overflow-hidden`}
                >
                  <div className="px-4 py-2 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest border-b border-slate-100 dark:border-emerald-900/10 mb-1">
                    Select Language
                  </div>
                  <div className="max-h-64 overflow-y-auto custom-scrollbar">
                    {SUPPORTED_LANGUAGES.map((l) => (
                      <button
                        key={l.code}
                        onClick={() => {
                          setLang(l.code as Language);
                          setShowLangMenu(false);
                        }}
                        className={`w-full flex items-center justify-between px-4 py-3 text-sm transition-colors ${
                          lang === l.code 
                            ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 font-bold' 
                            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-emerald-900/10'
                        }`}
                      >
                        <div className="flex items-center space-x-3 rtl:space-x-reverse">
                          <span className="text-xs font-bold uppercase w-8 h-8 flex items-center justify-center bg-slate-100 dark:bg-emerald-900/30 rounded-lg shrink-0 text-emerald-600 dark:text-emerald-400">
                            {l.code}
                          </span>
                          <div className="text-left rtl:text-right">
                            <div className="leading-none">{l.nativeName}</div>
                            <div className="text-[10px] opacity-60 mt-0.5">{l.name}</div>
                          </div>
                        </div>
                        {lang === l.code && <i className="fas fa-check text-[10px]"></i>}
                      </button>
                    ))}
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#FDFCFB] dark:bg-transparent text-slate-900 dark:text-slate-100 flex flex-col md:flex-row overflow-hidden transition-colors duration-300 relative">
      <div className="hidden dark:block">
        <LiveBackground />
      </div>

      {/* New Lost Item Toast */}
      <AnimatePresence>
        {showNewLostItemToast && (
          <motion.div
            initial={{ opacity: 0, y: -50, x: '-50%' }}
            animate={{ opacity: 1, y: 20, x: '-50%' }}
            exit={{ opacity: 0, y: -50, x: '-50%' }}
            className="fixed top-0 left-1/2 z-[100] bg-emerald-600 text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center space-x-3 rtl:space-x-reverse cursor-pointer"
            onClick={() => {
              setShowNewLostItemToast(false);
              setActiveView('ADMIN');
            }}
          >
            <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
              <i className="fas fa-bullhorn"></i>
            </div>
            <div>
              <p className="text-sm font-bold">{isRTL ? 'بلاغ فقد جديد!' : 'New Lost Report!'}</p>
              <p className="text-[10px] opacity-90">{isRTL ? 'تم استلام بلاغ فقد جديد في النظام' : 'A new lost item report has been received'}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      <AnimatePresence mode="wait">
        {step === 'AUTH' ? (
          <motion.div 
            key={`auth-${lang}`}
            initial={{ opacity: 0, scale: 0.95, filter: 'blur(10px)' }}
            animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
            exit={{ opacity: 0, scale: 1.05, filter: 'blur(10px)' }}
            transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
            className="min-h-screen w-full flex flex-col items-center justify-center p-4 relative"
            dir={isRTL ? 'rtl' : 'ltr'}
          >
            <div className="absolute top-6 left-6 rtl:right-6 rtl:left-auto z-50">
              <button 
                onClick={() => setIsAdminMode(!isAdminMode)}
                className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-slate-700 dark:text-slate-300 text-[10px] font-bold uppercase tracking-wider border border-slate-300 dark:border-white/10 transition-all backdrop-blur-md"
              >
                {isAdminMode ? t.userLogin : t.adminLogin}
              </button>
            </div>
            <div className="absolute top-6 right-6 rtl:left-6 rtl:right-auto z-50">
              <TopControls />
            </div>
            <div className="max-w-md w-full">
              <div className="text-center mb-8">
                 <div className={`inline-block ${isAdminMode ? 'bg-slate-800' : 'bg-emerald-700'} p-4 rounded-3xl shadow-xl mb-4 transition-colors`}>
                   <i className={`fas ${isAdminMode ? 'fa-user-cog' : 'fa-user-shield'} text-3xl text-white`}></i>
                 </div>
                 <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white uppercase">
                   {isAdminMode ? t.managementPortal : t.userPortal}
                 </h1>
                 <p className="text-slate-500 dark:text-slate-400 font-medium">
                   {isAdminMode ? t.adminManagement : t.securityLogistics}
                 </p>
              </div>
              <AuthForm onLogin={handleLogin} lang={lang} isAdmin={isAdminMode} />
            </div>
          </motion.div>
        ) : (
          <motion.div 
            key={`main-${lang}`}
            initial={{ opacity: 0, scale: 0.98, filter: 'blur(5px)' }}
            animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
            exit={{ opacity: 0, scale: 1.02, filter: 'blur(5px)' }}
            transition={{ duration: 0.4, ease: "easeInOut" }}
            className="w-full flex flex-col md:flex-row h-screen overflow-hidden"
            dir={isRTL ? 'rtl' : 'ltr'}
          >
            {(!isAdminView || (user?.role !== 'ADMIN' && user?.role !== 'MANAGER')) && (
              <Sidebar 
                activeView={activeView} 
                onViewChange={handleViewChange} 
                lang={lang} 
                onHelp={() => setIsHelpOpen(true)}
              />
            )}

            <main className={`flex-grow relative ${isAdminView ? 'overflow-hidden' : 'overflow-y-auto'} pb-24 md:pb-0 h-screen custom-scrollbar bg-[#F7E1BE] dark:bg-transparent`}>
            <header className="sticky top-0 z-40 backdrop-blur-md bg-[#F8D6B3] dark:bg-[#061410]/70 border-b border-slate-200/50 dark:border-emerald-900/20 px-6 h-16 flex items-center justify-between transition-colors duration-300">
                <div className="flex items-center space-x-2 rtl:space-x-reverse">
                  <span className="font-bold text-emerald-900 dark:text-emerald-500 tracking-tighter">
                    {isAdminView 
                      ? (t.managementPortal?.toUpperCase() || 'MANAGEMENT PORTAL') 
                      : (t.userPortal?.toUpperCase() || 'USER PORTAL')}
                  </span>
                </div>
                <div className="flex items-center space-x-4 rtl:space-x-reverse">
                  {(user?.role === 'ADMIN' || user?.role === 'MANAGER') && !isAdminView && (
                    <button 
                      onClick={() => setIsAdminView(true)}
                      className="px-3 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 text-[10px] font-bold rounded-full hover:bg-amber-200 transition-all uppercase tracking-widest"
                    >
                      {t.switchToStaffView || 'SWITCH TO STAFF VIEW'}
                    </button>
                  )}
                  <TopControls />
                  
                  {!isAdminView && (
                    <div className="relative" ref={notificationsRef}>
                      <button 
                        onClick={() => setShowNotifications(!showNotifications)}
                        className="relative p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-emerald-900/20 rounded-full transition-colors"
                      >
                        <i className="fas fa-bell"></i>
                        {notifications.filter(n => !n.read).length > 0 && (
                          <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                        )}
                      </button>
                      
                      <AnimatePresence>
                        {showNotifications && (
                          <motion.div
                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 10, scale: 0.95 }}
                            className="absolute top-full right-0 mt-2 w-80 bg-white dark:bg-[#0f1f1a] border border-slate-200 dark:border-emerald-900/30 rounded-xl shadow-2xl z-50 overflow-hidden"
                          >
                            <div className="p-3 bg-slate-50 dark:bg-emerald-900/10 border-b border-slate-100 dark:border-emerald-900/20 flex justify-between items-center">
                              <h3 className="text-sm font-bold text-slate-800 dark:text-white">
                                {isRTL ? 'الإشعارات' : 'Notifications'}
                              </h3>
                              <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium bg-emerald-100 dark:bg-emerald-900/30 px-2 py-0.5 rounded-full">
                                {notifications.filter(n => !n.read).length} {isRTL ? 'جديد' : 'New'}
                              </span>
                            </div>
                            <div className="max-h-64 overflow-y-auto custom-scrollbar">
                              {notifications.length === 0 ? (
                                <div className="p-4 text-center text-slate-500 dark:text-slate-400 text-sm">
                                  {isRTL ? 'لا توجد إشعارات' : 'No notifications'}
                                </div>
                              ) : (
                                notifications.map(notification => (
                                  <div 
                                    key={notification.id} 
                                    className={`p-3 border-b border-slate-100 dark:border-emerald-900/10 hover:bg-slate-50 dark:hover:bg-emerald-900/5 transition-colors cursor-pointer ${!notification.read ? 'bg-emerald-50/50 dark:bg-emerald-900/10' : ''}`}
                                    onClick={async () => {
                                      if (!notification.read) {
                                        try {
                                          await fetchWithRetry(`/api/notifications/${notification.id}/read`, {
                                            method: 'PUT',
                                            headers: { 'Authorization': `Bearer ${token}` }
                                          });
                                          setNotifications(prev => prev.map(n => n.id === notification.id ? { ...n, read: true } : n));
                                        } catch (e) {
                                          console.error('Failed to mark read', e);
                                        }
                                      }
                                    }}
                                  >
                                    <div className="flex items-start space-x-3 rtl:space-x-reverse">
                                      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${notification.type === 'MATCH_FOUND' ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400' : 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400'}`}>
                                        <i className={`fas ${notification.type === 'MATCH_FOUND' ? 'fa-search' : 'fa-bell'} text-xs`}></i>
                                      </div>
                                      <div>
                                        <p className={`text-[10px] uppercase tracking-widest font-bold ${!notification.read ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
                                          {isRTL ? notification.titleAr || notification.title : notification.title}
                                        </p>
                                        <p className={`text-xs mt-0.5 ${!notification.read ? 'font-medium text-slate-800 dark:text-white' : 'text-slate-600 dark:text-slate-300'}`}>
                                          {isRTL ? notification.messageAr || notification.message : notification.message}
                                        </p>
                                        <p className="text-[10px] text-slate-400 mt-1">
                                          {formatDateTime(notification.createdAt)}
                                        </p>
                                      </div>
                                    </div>
                                  </div>
                                ))
                              )}
                            </div>
                            {notifications.length > 0 && (
                              <button 
                                onClick={() => {
                                  setActiveView('NOTIFICATIONS');
                                  setShowNotifications(false);
                                }}
                                className="w-full py-2 text-center text-[10px] text-emerald-600 font-bold hover:bg-slate-50 dark:hover:bg-emerald-900/10 transition-colors border-t border-slate-100 dark:border-emerald-900/20 uppercase tracking-widest"
                              >
                                {isRTL ? 'عرض الكل' : 'View All'}
                              </button>
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}

                  <div className="flex items-center relative" ref={profileMenuRef}>
                    <button 
                      onClick={() => setShowProfileMenu(!showProfileMenu)}
                      className="flex items-center space-x-3 rtl:space-x-reverse hover:bg-slate-100 dark:hover:bg-emerald-900/20 p-1.5 rounded-xl transition-all"
                    >
                      <div className={`${isRTL ? 'text-left' : 'text-right'} block`}>
                        <p className="text-xs font-bold text-slate-800 dark:text-white leading-tight truncate max-w-[80px] sm:max-w-[150px]">{user?.username}</p>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-widest leading-tight hidden sm:block">{isRTL ? 'حساب موثق' : 'Verified Account'}</p>
                      </div>
                      <div className="w-8 h-8 rounded-full bg-emerald-700 flex items-center justify-center text-white text-xs font-bold shadow-lg shadow-emerald-700/20">
                        {user?.username?.charAt(0) || 'U'}
                      </div>
                    </button>

                    <AnimatePresence>
                      {showProfileMenu && (
                        <motion.div
                          initial={{ opacity: 0, y: 10, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 10, scale: 0.95 }}
                          className="absolute top-full right-0 mt-2 w-64 bg-white dark:bg-[#0f1f1a] border border-slate-200 dark:border-emerald-900/30 rounded-xl shadow-2xl z-50 overflow-hidden"
                        >
                          <div className="p-4 bg-slate-50 dark:bg-emerald-900/10 border-b border-slate-100 dark:border-emerald-900/20 flex items-center space-x-3 rtl:space-x-reverse">
                            <div className="w-10 h-10 rounded-full bg-emerald-700 flex items-center justify-center text-white text-sm font-bold shadow-lg shadow-emerald-700/20 shrink-0">
                              {user?.username?.charAt(0) || 'U'}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-bold text-slate-800 dark:text-white truncate">{user?.fullName || user?.username}</p>
                              <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate mt-0.5">{user?.email || user?.phone}</p>
                            </div>
                          </div>
                          <div className="p-2 space-y-1">
                            {!isAdminView && (
                              <>
                                <button
                                  onClick={() => {
                                    setProfileInitialView('INFO');
                                    setActiveView('PROFILE');
                                    setShowProfileMenu(false);
                                  }}
                                  className="w-full flex items-center space-x-3 rtl:space-x-reverse px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-emerald-900/20 rounded-lg transition-colors"
                                >
                                  <i className="fas fa-user-circle text-emerald-600"></i>
                                  <span className="flex-1 text-start">{t.viewProfile} - {user?.fullName?.split(' ')[0] || user?.fullName || (isRTL ? 'ضيف' : 'Guest')}</span>
                                </button>
                                <button
                                  onClick={() => {
                                    setProfileInitialView('SETTINGS');
                                    setActiveView('PROFILE');
                                    setShowProfileMenu(false);
                                  }}
                                  className="w-full flex items-center space-x-3 rtl:space-x-reverse px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-emerald-900/20 rounded-lg transition-colors"
                                >
                                  <i className="fas fa-cog text-emerald-600"></i>
                                  <span>{t.settings}</span>
                                </button>
                                <button
                                  onClick={() => {
                                    setIsHelpOpen(true);
                                    setShowProfileMenu(false);
                                  }}
                                  className="w-full flex md:hidden items-center space-x-3 rtl:space-x-reverse px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-emerald-900/20 rounded-lg transition-colors"
                                >
                                  <i className="fas fa-question-circle text-emerald-600"></i>
                                  <span>{t.help}</span>
                                </button>
                                <div className="h-px bg-slate-100 dark:bg-emerald-900/20 mx-2 my-1" />
                              </>
                            )}
                            <button
                              onClick={() => {
                                resetApp();
                                setShowProfileMenu(false);
                              }}
                              className="w-full flex items-center space-x-3 rtl:space-x-reverse px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-lg transition-colors"
                            >
                              <i className="fas fa-sign-out-alt"></i>
                              <span>{t.logout}</span>
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
                </header>
              <div className={isAdminView ? "w-full" : "max-w-7xl mx-auto p-4 md:p-10 min-h-[calc(100vh-64px)] flex flex-col"}>
                {renderView()}
              </div>
            </main>

            {user?.role !== 'ADMIN' && <BottomNav activeView={activeView} onViewChange={handleViewChange} lang={lang} />}
          </motion.div>
        )}
      </AnimatePresence>

      <HelpModal 
        isOpen={isHelpOpen} 
        onClose={() => setIsHelpOpen(false)} 
        lang={lang} 
        user={user || undefined}
      />
    </div>
  );
};

export default App;
