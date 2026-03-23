import { API_BASE } from '../apiConfig';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Language } from '../types';
import { translations } from '../translations';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
  user?: { username: string };
}

const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose, lang, user }) => {
  const t = translations[lang];
  const isRTL = lang === 'ar' || lang === 'ur' || lang === 'fa';
  const [feedback, setFeedback] = useState('');
  const [feedbackType, setFeedbackType] = useState<'GENERAL' | 'COMPLAINT' | 'RECOMMENDATION'>('GENERAL');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  
  useEffect(() => {
    if (isSuccess && isOpen) {
      const timer = setTimeout(() => {
        onClose();
        // Small delay to reset state after animation finishes
        setTimeout(() => setIsSuccess(false), 500);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [isSuccess, isOpen, onClose]);

  const handleSubmitFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedback.trim()) return;

    setIsSubmitting(true);
    try {
      // Real integration: Send feedback to the backend
      const response = await fetch(API_BASE + '/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          feedback, 
          type: feedbackType,
          lang, 
          submittedBy: user?.username || 'Anonymous',
          timestamp: new Date().toISOString() 
        }),
      });

      if (response.ok) {
        setIsSuccess(true);
        setFeedback('');
        // Removed automatic close to show the big success message
      }
    } catch (error) {
      console.error('Failed to submit feedback:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-y-auto">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-md"
          />
          
          <motion.div
            layout
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative bg-white/40 dark:bg-[#162923]/40 backdrop-blur-2xl w-full max-w-[92vw] md:max-w-lg rounded-[32px] md:rounded-[40px] shadow-2xl overflow-hidden border border-white/20 dark:border-emerald-900/20"
          >
            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-500"></div>
            
            <AnimatePresence mode="wait">
              {isSuccess ? (
                <motion.div
                  key="success-view"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="p-12 flex flex-col items-center text-center space-y-8 min-h-[400px] justify-center"
                >
                  <motion.div 
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", damping: 12, stiffness: 200, delay: 0.2 }}
                    className="w-28 h-28 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-[32px] flex items-center justify-center text-6xl shadow-2xl shadow-emerald-500/20"
                  >
                    <i className="fas fa-check-circle"></i>
                  </motion.div>
                  
                  <div className="space-y-3">
                    <motion.h2 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.4 }}
                      className="text-4xl font-black text-slate-800 dark:text-white tracking-tight leading-tight"
                    >
                      {isRTL ? 'شكراً لك!' : 'Thank You!'}
                    </motion.h2>
                    <motion.p 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.5 }}
                      className="text-lg text-slate-500 dark:text-slate-400 max-w-xs mx-auto leading-relaxed"
                    >
                      {t.feedbackSuccess.includes('!') ? t.feedbackSuccess.split('!')[1].trim() : t.feedbackSuccess}
                    </motion.p>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="help-content"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <div className="p-5 md:p-10">
                    <div className="flex justify-between items-start mb-5 md:mb-10">
                      <div className="space-y-1">
                        <h2 className="text-xl md:text-3xl font-black text-slate-800 dark:text-white tracking-tight leading-none">{t.helpTitle}</h2>
                        <p className="text-[10px] md:text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{t.helpSub}</p>
                      </div>
                      <button 
                        onClick={onClose}
                        className="w-9 h-9 md:w-12 md:h-12 rounded-xl md:rounded-2xl bg-white/50 dark:bg-emerald-900/20 flex items-center justify-center text-slate-400 hover:bg-emerald-600 hover:text-white transition-all shadow-sm"
                      >
                        <i className="fas fa-times text-base md:text-xl"></i>
                      </button>
                    </div>

                    <div className="space-y-5 md:space-y-8">
                      {/* Email Support Option */}
                      <motion.a 
                        whileHover={{ scale: 1.02, y: -2 }}
                        whileTap={{ scale: 0.98 }}
                        href="mailto:info@alharamain.gov.sa?subject=Help Request - MAWJOOD"
                        className="flex items-center p-4 md:p-6 rounded-[20px] md:rounded-[28px] bg-white/50 dark:bg-[#0f1f1a]/50 border border-white/20 dark:border-emerald-900/20 hover:bg-white/80 dark:hover:bg-[#0f1f1a]/80 transition-all group shadow-sm"
                      >
                        <div className="w-10 h-10 md:w-14 md:h-14 bg-emerald-600 text-white rounded-xl md:rounded-2xl flex items-center justify-center text-base md:text-xl shadow-lg shadow-emerald-600/20 group-hover:rotate-12 transition-transform">
                          <i className="fas fa-envelope"></i>
                        </div>
                        <div className={`flex-grow ${isRTL ? 'mr-4 text-right' : 'ml-4 text-left'}`}>
                          <h3 className="font-black text-emerald-900 dark:text-emerald-400 text-sm md:text-lg tracking-tight">{t.emailSupport}</h3>
                          <p className="text-[9px] md:text-xs text-slate-500 dark:text-slate-500 font-medium">{t.emailSupportSub}</p>
                        </div>
                        <i className={`fas ${isRTL ? 'fa-chevron-left' : 'fa-chevron-right'} text-emerald-300 dark:text-emerald-800 text-[10px] md:text-base`}></i>
                      </motion.a>

                      <div className="relative py-2">
                        <div className="absolute inset-0 flex items-center">
                          <div className="w-full border-t border-white/20 dark:border-emerald-900/10"></div>
                        </div>
                        <div className="relative flex justify-center text-[10px] uppercase tracking-[0.3em] font-black text-slate-400 dark:text-slate-600 bg-transparent px-6">
                          {isRTL ? 'أو' : 'OR'}
                        </div>
                      </div>

                      {/* Feedback Form */}
                      <div className="space-y-6">
                        <div className="flex items-center space-x-3 rtl:space-x-reverse">
                          <div className="w-10 h-10 bg-amber-100 dark:bg-amber-900/20 text-amber-600 rounded-xl flex items-center justify-center shadow-sm">
                            <i className="fas fa-comment-dots"></i>
                          </div>
                          <div className="space-y-0.5">
                            <h3 className="font-black text-slate-800 dark:text-white tracking-tight">{t.feedbackTitle}</h3>
                            <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">{t.feedbackSub}</p>
                          </div>
                        </div>
                        
                        <form onSubmit={handleSubmitFeedback} className="space-y-6">
                          <div className="grid grid-cols-3 gap-3 mb-2">
                            {[
                              { id: 'GENERAL', label: t.feedbackGeneral, icon: 'fa-comment' },
                              { id: 'RECOMMENDATION', label: t.feedbackRecommendation, icon: 'fa-lightbulb' },
                              { id: 'COMPLAINT', label: t.feedbackComplaint, icon: 'fa-exclamation-circle' }
                            ].map((type) => (
                              <motion.button
                                key={type.id}
                                type="button"
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => setFeedbackType(type.id as any)}
                                className={`relative flex items-center justify-center px-2 py-3 rounded-2xl text-[10px] font-black transition-all border overflow-hidden ${
                                  feedbackType === type.id
                                    ? 'border-emerald-600 text-white shadow-xl shadow-emerald-600/20'
                                    : 'bg-white/30 dark:bg-[#0f1f1a]/30 border-white/20 dark:border-emerald-900/20 text-slate-600 dark:text-slate-400 hover:border-emerald-500'
                                }`}
                              >
                                {feedbackType === type.id && (
                                  <motion.div
                                    layoutId="activeFeedbackType"
                                    className="absolute inset-0 bg-emerald-600"
                                    style={{ zIndex: -1 }}
                                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                                  />
                                )}
                                <i className={`fas ${type.icon} ${isRTL ? 'ml-2.5' : 'mr-2.5'}`}></i>
                                <span className="uppercase tracking-wider">{type.label}</span>
                              </motion.button>
                            ))}
                          </div>

                          <textarea
                            value={feedback}
                            onChange={(e) => setFeedback(e.target.value)}
                            placeholder={t.feedbackPlaceholder}
                            className="w-full h-28 md:h-40 px-4 md:px-6 py-3 md:py-5 rounded-[20px] md:rounded-[28px] border border-white/20 dark:border-emerald-900/20 bg-white/50 dark:bg-[#0f1f1a]/50 text-slate-800 dark:text-white text-sm md:text-lg font-medium outline-none focus:ring-8 focus:ring-emerald-500/5 focus:border-emerald-500 transition-all resize-none placeholder:text-slate-400"
                          />
                          
                          <motion.button
                            whileHover={{ scale: 1.01 }}
                            whileTap={{ scale: 0.99 }}
                            type="submit"
                            disabled={isSubmitting || !feedback.trim() || isSuccess}
                            className={`w-full py-3.5 md:py-6 rounded-xl md:rounded-2xl font-black text-sm md:text-lg transition-all flex items-center justify-center shadow-2xl uppercase tracking-widest ${
                              isSuccess 
                                ? 'bg-emerald-500 text-white shadow-emerald-500/20' 
                                : 'bg-emerald-700 hover:bg-emerald-600 text-white shadow-emerald-700/20 disabled:opacity-50 disabled:cursor-not-allowed'
                            }`}
                          >
                            {isSubmitting ? (
                              <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
                            ) : isSuccess ? (
                              <>
                                <i className="fas fa-check-circle mr-3 rtl:ml-3"></i>
                                {t.feedbackSuccess}
                              </>
                            ) : (
                              <>
                                <span>{t.submitFeedback}</span>
                                <i className="fas fa-paper-plane ml-3 rtl:mr-3"></i>
                              </>
                            )}
                          </motion.button>
                        </form>
                      </div>
                    </div>
                  </div>
                  
                  <div className="p-5 md:p-8 bg-white/20 dark:bg-emerald-950/20 border-t border-white/10 dark:border-emerald-900/10 flex flex-col md:flex-row items-center justify-center gap-4 md:gap-6">
                    <motion.a 
                      whileHover={{ scale: 1.05 }}
                      href="tel:1966"
                      className="flex items-center text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em] hover:text-emerald-600 transition-colors"
                    >
                      <div className="w-8 h-8 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 rounded-full flex items-center justify-center mr-3 rtl:ml-3 shadow-sm">
                        <i className="fas fa-phone-alt text-xs"></i>
                      </div>
                      1966 - {isRTL ? 'الطوارئ' : 'EMERGENCY'}
                    </motion.a>
                    <div className="hidden md:block w-1.5 h-1.5 bg-slate-300 dark:bg-emerald-900/40 rounded-full"></div>
                    <motion.a 
                      whileHover={{ scale: 1.05 }}
                      href="mailto:info@alharamain.gov.sa" 
                      className="flex items-center text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em] hover:text-emerald-600 transition-colors"
                    >
                      <div className="w-8 h-8 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 rounded-full flex items-center justify-center mr-3 rtl:ml-3 shadow-sm">
                        <i className="fas fa-envelope text-xs"></i>
                      </div>
                      info@alharamain.gov.sa
                    </motion.a>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default HelpModal;
