import { API_BASE } from '../apiConfig';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import ImageViewer from './ImageViewer';
import { SilkyDateInput } from './SilkyInputs';
import { FoundItem, MatchResult, Language, AuthenticatedUser } from '../types';
import { translations } from '../translations';
import { formatDate, formatDateTime } from '../utils';

// Fix Leaflet marker icon issue
// @ts-ignore
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface MatchResultsProps {
  matches: MatchResult[];
  database: FoundItem[];
  onBack: () => void;
  lang: Language;
  user: AuthenticatedUser;
  token: string;
}

const MatchResults: React.FC<MatchResultsProps> = ({ matches, database, onBack, lang, user, token }) => {
  const t = translations[lang];
  const isRTL = lang === 'ar' || lang === 'ur' || lang === 'fa';
  const [showMapModal, setShowMapModal] = useState<{ lat: number, lng: number, name: string } | null>(null);
  const [viewingImage, setViewingImage] = useState<string | null>(null);
  const [claimingItem, setClaimingItem] = useState<FoundItem | null>(null);
  useEffect(() => {
    if (claimingItem) setClaimError(null);
  }, [claimingItem]);
  const [viewingDetails, setViewingDetails] = useState<FoundItem | null>(null);
  const [claimForm, setClaimForm] = useState({
    description: '',
    lostDate: '',
    lostTime: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [claimSuccess, setClaimSuccess] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);

  const getFullItem = (id: string) => database.find(item => item.id === id);

  const handleClaimSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!claimingItem) return;

    setIsSubmitting(true);
    try {
      const response = await fetch(API_BASE + '/api/claims', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          itemId: claimingItem.id,
          description: claimForm.description,
          lostDate: claimForm.lostDate,
          lostTime: claimForm.lostTime,
          userFullName: user.fullName || user.username,
          userPassport: user.passport || '',
          userPhone: user.phone || '',
          userEmail: user.email || '',
          itemName: lang === 'en' && claimingItem.nameEn ? claimingItem.nameEn : claimingItem.name,
          itemImage: claimingItem.imageUrl || ''
        })
      });

      if (response.ok) {
        setClaimSuccess(true);
        setClaimError(null);
        setTimeout(() => {
          setClaimSuccess(false);
          setClaimingItem(null);
          setClaimForm({ description: '', lostDate: '', lostTime: '' });
        }, 3000);
      } else {
        const data = await response.json();
        if (data.message === 'You have already submitted a claim for this item.') {
          setClaimError(t.alreadyClaimed);
        } else {
          setClaimError(data.message || 'Failed to submit claim');
        }
      }
    } catch (error) {
      console.error('Failed to submit claim:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={`space-y-8 animate-in fade-in zoom-in duration-500 ${isRTL ? 'text-right' : 'text-left'}`}>
      <div className="flex items-center justify-between">
        <div className={isRTL ? 'text-right' : 'text-left'}>
          <h2 className="text-3xl font-bold text-slate-800 dark:text-white">{t.matchResults}</h2>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            {isRTL ? `تم العثور على ${matches.length} تطابقات محتملة في قاعدة بياناتنا.` : `Found ${matches.length} potential matches in our database.`}
          </p>
        </div>
        <button 
          onClick={onBack}
          className="text-emerald-700 dark:text-emerald-500 hover:underline font-medium text-sm flex items-center"
        >
          <i className={`fas fa-redo ${isRTL ? 'ml-2' : 'mr-2'}`}></i>{t.newSearch}
        </button>
      </div>

      {matches.length === 0 ? (
        <div className="bg-white/80 dark:bg-[#162923]/60 backdrop-blur-xl rounded-3xl p-12 text-center border border-slate-200 dark:border-emerald-900/20 shadow-xl">
          <div className="bg-slate-50 dark:bg-[#0f1f1a] w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
            <i className="fas fa-search text-slate-400 dark:text-slate-600 text-3xl"></i>
          </div>
          <h3 className="text-xl font-bold text-slate-800 dark:text-white">{t.noMatch}</h3>
          <p className="text-slate-500 dark:text-slate-400 mt-3 max-w-md mx-auto">
            {isRTL 
              ? 'لم نتمكن من العثور على عنصر يطابق وصفك في الوقت الحالي. لا تقلق، لقد تم حفظ بلاغك وسنقوم بإخطارك في حال العثور عليه.'
              : "We couldn't find an item matching your description right now. Don't worry, your report has been saved and we will notify you if a match is turned in."}
          </p>
          <button 
            onClick={onBack}
            className="mt-8 bg-emerald-700 text-white px-8 py-3 rounded-xl font-bold shadow-lg shadow-emerald-700/20 hover:bg-emerald-800 transition-all"
          >
            {isRTL ? 'العودة' : 'Go Back'}
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {matches.map((match) => {
            const item = getFullItem(match.itemId);
            if (!item) return null;

            return (
              <div 
                key={item.id} 
                className={`bg-white/80 dark:bg-[#162923]/60 backdrop-blur-xl rounded-3xl shadow-xl overflow-hidden border border-slate-100 dark:border-emerald-900/20 flex flex-col md:flex-row ${isRTL ? 'md:flex-row-reverse' : ''}`}
              >
                <div className={`bg-slate-50 dark:bg-[#061410] w-full md:w-1/3 min-h-[200px] flex items-center justify-center border-b md:border-b-0 ${isRTL ? 'md:border-l' : 'md:border-r'} border-slate-200 dark:border-emerald-900/20 relative overflow-hidden`}>
                  {item.imageUrl ? (
                    <img 
                      src={item.imageUrl} 
                      alt={lang === 'en' && item.nameEn ? item.nameEn : item.name}
                      className="w-full h-full object-cover cursor-pointer hover:opacity-90 transition-opacity"
                      onClick={() => setViewingImage(item.imageUrl!)}
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <i className="fas fa-box-open text-slate-300 dark:text-slate-700 text-6xl"></i>
                  )}
                  <div className={`absolute top-4 ${isRTL ? 'right-4' : 'left-4'} bg-emerald-600 text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-widest shadow-lg z-10`}>
                    {Math.round(match.matchScore * 100)}% Match
                  </div>
                </div>

                  <div className="p-8 md:w-2/3 flex flex-col">
                  <div className="flex-grow">
                    <h3 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">
                      {lang === 'en' && item.nameEn ? item.nameEn : item.name}
                    </h3>
                    <p className="text-slate-600 dark:text-slate-400 mb-4 line-clamp-2">
                      {lang === 'en' && item.descriptionEn ? item.descriptionEn : item.description}
                    </p>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                      <div className="flex items-center space-x-2 rtl:space-x-reverse text-sm text-slate-500 dark:text-slate-400">
                        <i className="fas fa-map-marker-alt text-emerald-600 w-4"></i>
                        <span>{lang === 'en' && item.foundLocationEn ? item.foundLocationEn : item.foundLocation}</span>
                        {item.coordinates && (
                          <button 
                            onClick={() => setShowMapModal({ lat: item.coordinates!.lat, lng: item.coordinates!.lng, name: lang === 'en' && item.nameEn ? item.nameEn : item.name })}
                            className="text-emerald-600 hover:text-emerald-700 transition-colors"
                            title={isRTL ? 'عرض على الخريطة' : 'View on Map'}
                          >
                            <i className="fas fa-map-marked-alt ml-2 rtl:mr-2"></i>
                          </button>
                        )}
                      </div>
                      <div className="flex items-center space-x-2 rtl:space-x-reverse text-sm text-slate-500 dark:text-slate-400">
                        <i className="fas fa-calendar-alt text-emerald-600 w-4"></i>
                        <span>{isRTL ? 'وجد بتاريخ' : 'Found on'} {formatDate(item.dateFound)}</span>
                      </div>
                    </div>

                    <div className="bg-amber-50 dark:bg-amber-950/20 rounded-2xl p-4 border border-amber-100 dark:border-amber-900/40">
                      <h4 className="text-amber-800 dark:text-amber-400 font-bold text-sm flex items-center mb-1 rtl:space-x-reverse">
                        <i className={`fas fa-info-circle ${isRTL ? 'ml-2' : 'mr-2'}`}></i>
                        {t.retrieval}
                      </h4>
                      <p className="text-xs text-amber-700 dark:text-amber-500 leading-relaxed font-medium">
                        <strong>{t.office}:</strong> {item.pickupOffice}<br/>
                        {item.pickupInstructions}
                      </p>
                    </div>
                  </div>

                  <div className="mt-8 flex flex-col sm:flex-row gap-4">
                    <button 
                      onClick={() => setClaimingItem(item)}
                      className="flex-grow bg-emerald-700 hover:bg-emerald-800 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-emerald-700/20"
                    >
                      {t.claimItem}
                    </button>
                    <button 
                      onClick={() => setViewingDetails(item)}
                      className="px-6 py-3 border-2 border-slate-200 dark:border-emerald-900/20 hover:border-slate-300 dark:hover:border-emerald-700/30 rounded-xl font-bold text-slate-600 dark:text-slate-400 transition-all"
                    >
                      {t.moreDetails}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="bg-white/80 dark:bg-[#162923]/60 backdrop-blur-xl rounded-3xl p-8 border border-slate-200 dark:border-emerald-900/20 shadow-sm">
        <h4 className="font-bold text-slate-800 dark:text-white mb-2">{isRTL ? 'هل تحتاج إلى مزيد من المساعدة؟' : 'Need Further Assistance?'}</h4>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {isRTL 
            ? 'إذا لم تكن أي من هذه النتائج صحيحة، يمكنك زيارة مركز المفقودات المركزي بالقرب من برج الساعة في مكة المكرمة أو بوابة 25 في المدينة المنورة.'
            : 'If none of these results are correct, you can visit the Central Lost & Found Hub near the Clock Tower in Makkah or Gate 25 in Madina.'}
        </p>
      </div>

      <AnimatePresence>
        {showMapModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md"
          >
            <div className="bg-white dark:bg-[#061410] w-full max-w-3xl rounded-[32px] shadow-2xl overflow-hidden border border-slate-200 dark:border-emerald-900/20">
              <div className="p-6 border-b border-slate-100 dark:border-emerald-900/10 flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold text-slate-800 dark:text-white">{showMapModal.name}</h3>
                  <p className="text-xs text-slate-500">{isRTL ? 'موقع العثور على العنصر' : 'Exact location where item was found'}</p>
                </div>
                <button onClick={() => setShowMapModal(null)} className="p-2 text-slate-500 hover:text-slate-800 dark:hover:text-white transition-colors">
                  <i className="fas fa-times text-xl"></i>
                </button>
              </div>
              <div className="h-[450px] w-full">
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
              <div className="p-6 bg-slate-50 dark:bg-emerald-950/20 flex justify-end">
                <button 
                  onClick={() => setShowMapModal(null)}
                  className="px-8 py-3 bg-emerald-700 text-white font-bold rounded-xl shadow-lg shadow-emerald-700/20"
                >
                  {isRTL ? 'إغلاق' : 'Close'}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Claim Modal */}
      <AnimatePresence>
        {claimingItem && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-white dark:bg-[#061410] w-full max-w-lg rounded-[32px] shadow-2xl overflow-hidden border border-slate-200 dark:border-emerald-900/20"
            >
              <div className="p-8">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-2xl font-bold text-slate-800 dark:text-white">{t.claimTitle}</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">{t.claimSub}</p>
                  </div>
                  <button onClick={() => setClaimingItem(null)} className="p-2 text-slate-400 hover:text-slate-600 transition-colors">
                    <i className="fas fa-times text-xl"></i>
                  </button>
                </div>

                <AnimatePresence mode="wait">
                  {claimSuccess ? (
                    <motion.div 
                      key="success"
                      initial={{ opacity: 0, scale: 0.9, y: 20 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.9, y: 20 }}
                      className="py-12 text-center"
                    >
                      <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
                        <i className="fas fa-check text-emerald-600 text-3xl"></i>
                      </div>
                      <h4 className="text-xl font-bold text-slate-800 dark:text-white mb-2">{isRTL ? 'تم الإرسال!' : 'Submitted!'}</h4>
                      <p className="text-slate-500 dark:text-slate-400">{t.claimSuccess}</p>
                    </motion.div>
                  ) : (
                    <motion.form 
                      key="form"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      onSubmit={handleClaimSubmit} 
                      className="space-y-6"
                    >
                      {claimError && (
                        <div className="p-4 bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 text-sm font-bold rounded-2xl border border-rose-200 dark:border-rose-900/50 flex items-center space-x-3 rtl:space-x-reverse">
                          <i className="fas fa-exclamation-circle text-lg"></i>
                          <span>{claimError}</span>
                        </div>
                      )}
                    <div className="bg-slate-50 dark:bg-emerald-950/20 p-4 rounded-2xl border border-slate-100 dark:border-emerald-900/10 mb-6">
                      <div className="flex items-center space-x-3 rtl:space-x-reverse">
                        <div className="w-12 h-12 rounded-xl overflow-hidden bg-white dark:bg-[#061410]">
                          {claimingItem.imageUrl ? (
                            <img 
                              src={claimingItem.imageUrl} 
                              alt="" 
                              className="w-full h-full object-cover cursor-pointer hover:opacity-90 transition-opacity" 
                              onClick={() => setViewingImage(claimingItem.imageUrl!)}
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-300">
                              <i className="fas fa-box"></i>
                            </div>
                          )}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{isRTL ? 'العنصر المختار' : 'Selected Item'}</p>
                          <p className="font-bold text-slate-800 dark:text-white">{lang === 'en' && claimingItem.nameEn ? claimingItem.nameEn : claimingItem.name}</p>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest px-1">
                        {t.claimDescription}
                      </label>
                      <textarea 
                        required
                        value={claimForm.description}
                        onChange={(e) => setClaimForm({...claimForm, description: e.target.value})}
                        className="w-full px-5 py-4 rounded-2xl bg-slate-50 dark:bg-[#0f1f1a] border border-slate-200 dark:border-emerald-900/20 focus:ring-2 focus:ring-emerald-500 outline-none transition-all min-h-[120px] text-slate-800 dark:text-white"
                        placeholder={isRTL ? 'يرجى تقديم أكبر قدر ممكن من التفاصيل...' : 'Please provide as much detail as possible...'}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <SilkyDateInput
                          label={t.claimDate}
                          required
                          min={new Date(new Date().setFullYear(new Date().getFullYear() - 20)).toISOString().split('T')[0]}
                          max={new Date().toISOString().split('T')[0]}
                          value={claimForm.lostDate}
                          onChange={(val) => setClaimForm({...claimForm, lostDate: val})}
                          isRTL={isRTL}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest px-1">
                          {t.claimTime}
                        </label>
                        <input 
                          type="time"
                          required
                          value={claimForm.lostTime}
                          onChange={(e) => setClaimForm({...claimForm, lostTime: e.target.value})}
                          className="w-full px-5 py-4 rounded-2xl bg-slate-50 dark:bg-[#0f1f1a] border border-slate-200 dark:border-emerald-900/20 focus:ring-2 focus:ring-emerald-500 outline-none transition-all text-slate-800 dark:text-white"
                        />
                      </div>
                    </div>

                    <button 
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-bold py-4 rounded-2xl transition-all shadow-xl shadow-emerald-700/20 flex items-center justify-center space-x-2 rtl:space-x-reverse disabled:opacity-50"
                    >
                      {isSubmitting ? (
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      ) : (
                        <>
                          <i className="fas fa-paper-plane"></i>
                          <span>{t.submitClaim}</span>
                        </>
                      )}
                    </button>
                  </motion.form>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Details Modal */}
      <AnimatePresence>
        {viewingDetails && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-white dark:bg-[#061410] w-full max-w-2xl rounded-[32px] shadow-2xl overflow-hidden border border-slate-200 dark:border-emerald-900/20 max-h-[90vh] overflow-y-auto custom-scrollbar"
            >
              <div className="relative h-64 bg-slate-100 dark:bg-[#0f1f1a]">
                {viewingDetails.imageUrl ? (
                  <img 
                    src={viewingDetails.imageUrl} 
                    alt="" 
                    className="w-full h-full object-cover cursor-pointer hover:opacity-90 transition-opacity" 
                    onClick={() => setViewingImage(viewingDetails.imageUrl!)}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-300">
                    <i className="fas fa-box text-6xl"></i>
                  </div>
                )}
                <button 
                  onClick={() => setViewingDetails(null)}
                  className="absolute top-6 right-6 w-10 h-10 bg-black/50 backdrop-blur-md text-white rounded-full flex items-center justify-center hover:bg-black/70 transition-all z-10"
                >
                  <i className="fas fa-times"></i>
                </button>
              </div>

              <div className="p-8">
                <div className="flex items-center space-x-2 rtl:space-x-reverse mb-2">
                  <span className="px-3 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-[10px] font-bold rounded-full uppercase tracking-widest">
                    {viewingDetails.category}
                  </span>
                  <span className="px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[10px] font-bold rounded-full uppercase tracking-widest">
                    ID: {viewingDetails.id}
                  </span>
                </div>

                <h3 className="text-3xl font-bold text-slate-800 dark:text-white mb-4">
                  {lang === 'en' && viewingDetails.nameEn ? viewingDetails.nameEn : viewingDetails.name}
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                  <div className="space-y-4">
                    <div className="flex items-start space-x-3 rtl:space-x-reverse">
                      <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center flex-shrink-0">
                        <i className="fas fa-map-marker-alt text-emerald-600"></i>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{isRTL ? 'موقع العثور' : 'Found Location'}</p>
                        <p className="text-slate-700 dark:text-slate-200 font-medium">
                          {lang === 'en' && viewingDetails.foundLocationEn ? viewingDetails.foundLocationEn : viewingDetails.foundLocation}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-3 rtl:space-x-reverse">
                      <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center flex-shrink-0">
                        <i className="fas fa-calendar-alt text-emerald-600"></i>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{isRTL ? 'تاريخ العثور' : 'Date Found'}</p>
                        <p className="text-slate-700 dark:text-slate-200 font-medium">{formatDate(viewingDetails.dateFound)}</p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-start space-x-3 rtl:space-x-reverse">
                      <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center flex-shrink-0">
                        <i className="fas fa-building text-emerald-600"></i>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t.office}</p>
                        <p className="text-slate-700 dark:text-slate-200 font-medium">{viewingDetails.pickupOffice}</p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-3 rtl:space-x-reverse">
                      <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center flex-shrink-0">
                        <i className="fas fa-clock text-emerald-600"></i>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{isRTL ? 'وقت التسجيل' : 'Registered At'}</p>
                        <p className="text-slate-700 dark:text-slate-200 font-medium">{formatDateTime(viewingDetails.timestamp)}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4 mb-8">
                  <h4 className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-wider">{isRTL ? 'الوصف الكامل' : 'Full Description'}</h4>
                  <div className="p-6 bg-slate-50 dark:bg-[#0f1f1a] rounded-2xl border border-slate-100 dark:border-emerald-900/10 text-slate-600 dark:text-slate-400 leading-relaxed">
                    {lang === 'en' && viewingDetails.descriptionEn ? viewingDetails.descriptionEn : viewingDetails.description}
                  </div>
                </div>

                <div className="bg-amber-50 dark:bg-amber-950/20 rounded-2xl p-6 border border-amber-100 dark:border-amber-900/40 mb-8">
                  <h4 className="text-amber-800 dark:text-amber-400 font-bold text-sm flex items-center mb-2 rtl:space-x-reverse">
                    <i className={`fas fa-info-circle ${isRTL ? 'ml-2' : 'mr-2'}`}></i>
                    {t.retrieval}
                  </h4>
                  <p className="text-sm text-amber-700 dark:text-amber-500 leading-relaxed">
                    {viewingDetails.pickupInstructions}
                  </p>
                </div>

                <div className="flex space-x-4 rtl:space-x-reverse">
                  <button 
                    onClick={() => {
                      setClaimingItem(viewingDetails);
                      setViewingDetails(null);
                    }}
                    className="flex-grow bg-emerald-700 hover:bg-emerald-800 text-white font-bold py-4 rounded-2xl transition-all shadow-xl shadow-emerald-700/20"
                  >
                    {t.claimItem}
                  </button>
                  <button 
                    onClick={() => setViewingDetails(null)}
                    className="px-8 py-4 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold rounded-2xl hover:bg-slate-200 transition-all"
                  >
                    {isRTL ? 'إغلاق' : 'Close'}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      {viewingImage && (
        <ImageViewer
          images={[viewingImage]}
          onClose={() => setViewingImage(null)}
          isRTL={isRTL}
        />
      )}
    </div>
  );
};

export default MatchResults;
