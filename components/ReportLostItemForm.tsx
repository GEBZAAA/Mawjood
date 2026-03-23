import React, { useState, useRef } from 'react';
import { City, Language, LostItemReport, User } from '../types';
import { translations } from '../translations';
import { analyzeItemImage } from '../services/geminiService';
import MapPicker from './MapPicker';
import { SilkyDateInput } from './SilkyInputs';
import { motion, AnimatePresence } from 'framer-motion';

interface ReportLostItemFormProps {
  city: City;
  user: User;
  onReport: (item: LostItemReport) => void;
  onBack: () => void;
  lang: Language;
}

const ReportLostItemForm: React.FC<ReportLostItemFormProps> = ({ city, user, onReport, onBack, lang }) => {
  const [currentCity, setCurrentCity] = useState<City>(city);
  const t = translations[lang];
  const isRTL = lang === 'ar' || lang === 'ur' || lang === 'fa';
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    date: '',
    images: [] as string[],
    coordinates: null as { lat: number, lng: number } | null
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [aiProcessing, setAiProcessing] = useState(false);
  const [toast, setToast] = useState<{ type: 'error' | 'success', message: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const remainingSlots = 5 - formData.images.length;
    const filesToProcess = files.slice(0, remainingSlots);

    if (files.length > remainingSlots) {
      setToast({ type: 'error', message: isRTL ? 'يمكنك تحميل ما يصل إلى 5 صور فقط' : 'You can only upload up to 5 images' });
    }

    for (const fileObj of filesToProcess) {
      const file = fileObj as File;
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result as string;
        setFormData(prev => ({ ...prev, images: [...prev.images, base64] }));

        // AI Image Analysis (only for first image if name/desc empty)
        if (formData.images.length === 0 && !formData.name && !formData.description) {
          setAiProcessing(true);
          try {
            const base64Data = base64.split(',')[1];
            const mimeType = file.type;
            const analysis = await analyzeItemImage(base64Data, mimeType);
            
            if (analysis.description || analysis.category) {
              setFormData(prev => ({ 
                ...prev, 
                description: analysis.description || prev.description,
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

  const removeImage = (index: number) => {
    setFormData(prev => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index)
    }));
  };

  const validateForm = () => {
    return formData.name.trim() !== '' && formData.description.trim() !== '' && formData.date.trim() !== '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setShowErrors(true);

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    
    try {
      const itemToAdd: LostItemReport = {
        id: `LI-USER-${Date.now()}`,
        name: formData.name,
        description: formData.description,
        city: currentCity,
        images: formData.images,
        status: 'PENDING',
        userId: (user as any).passportNumber || user.email,
        dateLost: formData.date,
        coordinates: formData.coordinates || undefined,
      };

      onReport(itemToAdd);
      setIsSuccess(true);
      setShowErrors(false);
    } catch (error) {
      console.error('Submission failed:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white/80 dark:bg-[#162923]/60 backdrop-blur-xl rounded-[40px] shadow-xl border border-slate-100 dark:border-emerald-900/20 p-12 text-center space-y-8"
      >
        <div className="w-24 h-24 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 rounded-full flex items-center justify-center text-5xl mx-auto shadow-2xl shadow-emerald-500/20">
          <i className="fas fa-check-circle"></i>
        </div>
        
        <div className="space-y-4">
          <h2 className="text-4xl font-black text-slate-800 dark:text-white tracking-tight">
            {isRTL ? 'شكراً لك!' : 'Thank You!'}
          </h2>
          <p className="text-lg text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
            {t.submissionSuccess}
          </p>
        </div>

        <button 
          onClick={onBack}
          className="px-10 py-4 bg-emerald-700 text-white rounded-2xl font-bold hover:bg-emerald-600 transition-all shadow-xl shadow-emerald-900/20"
        >
          {t.home}
        </button>
      </motion.div>
    );
  }

  return (
    <div className="relative">
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-2xl shadow-xl border backdrop-blur-md ${
              toast.type === 'error' ? 'bg-rose-500/90 border-rose-400 text-white' : 'bg-emerald-500/90 border-emerald-400 text-white'
            }`}
          >
            <div className="flex items-center space-x-3 rtl:space-x-reverse">
              <i className={`fas ${toast.type === 'error' ? 'fa-exclamation-circle' : 'fa-check-circle'}`}></i>
              <span className="font-bold text-sm">{toast.message}</span>
              <button onClick={() => setToast(null)} className="ml-2 hover:opacity-70">
                <i className="fas fa-times"></i>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white/40 dark:bg-[#162923]/40 backdrop-blur-2xl rounded-[40px] shadow-2xl border border-white/20 dark:border-emerald-900/20 p-8 md:p-12"
      >
      <button 
        onClick={onBack}
        className="mb-10 text-slate-500 dark:text-slate-400 hover:text-emerald-700 dark:hover:text-emerald-500 flex items-center space-x-2 rtl:space-x-reverse transition-all group"
      >
        <div className="w-10 h-10 rounded-full bg-white/50 dark:bg-emerald-900/20 flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition-all shadow-sm">
          <i className={`fas ${isRTL ? 'fa-arrow-right' : 'fa-arrow-left'}`}></i>
        </div>
        <span className="text-sm font-bold tracking-tight">{t.home}</span>
      </button>

      <div className="mb-12 space-y-2">
        <h2 className="text-4xl font-black text-slate-800 dark:text-white tracking-tight">{t.reportLost || 'Report Lost Item'}</h2>
        <p className="text-lg text-slate-500 dark:text-slate-400 leading-relaxed">
          {isRTL ? 'أبلغ عن شيء فقدته ليتم إعلامك إذا تم العثور عليه من قبل الآخرين.' : 'Report something you lost to be notified if it is found by others.'}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-12">
        <AnimatePresence>
          {isSubmitting && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-md flex flex-col items-center justify-center text-white"
            >
              <div className="w-20 h-20 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin mb-6 shadow-2xl shadow-emerald-500/20"></div>
              <p className="text-2xl font-black tracking-tight">
                {isRTL ? 'جاري الإرسال...' : 'Submitting...'}
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* City Selection */}
        <div className="space-y-6">
          <label className="block text-[10px] font-black text-slate-400 dark:text-slate-600 uppercase tracking-[0.2em]">
            {isRTL ? 'اختر المدينة' : 'SELECT CITY'}
          </label>
          <div className="grid grid-cols-2 gap-6">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              type="button"
              onClick={() => setCurrentCity(City.MECCA)}
              className={`flex flex-col items-center justify-center p-8 rounded-[32px] border-2 transition-all gap-4 relative overflow-hidden group ${
                currentCity === City.MECCA
                  ? 'border-emerald-600 bg-emerald-50/50 dark:bg-emerald-900/20 ring-8 ring-emerald-500/5'
                  : 'border-white/20 dark:border-emerald-900/10 bg-white/30 dark:bg-[#0f1f1a]/30 hover:border-emerald-200'
              }`}
            >
              <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-2xl shadow-lg transition-all ${
                currentCity === City.MECCA ? 'bg-emerald-600 text-white scale-110' : 'bg-white/80 dark:bg-emerald-900/30 text-slate-400'
              }`}>
                <i className="fas fa-kaaba"></i>
              </div>
              <span className={`font-black uppercase tracking-tighter text-lg ${
                currentCity === City.MECCA ? 'text-emerald-900 dark:text-emerald-400' : 'text-slate-400'
              }`}>
                {t.mecca}
              </span>
              {currentCity === City.MECCA && (
                <motion.div layoutId="city-active-lost" className="absolute bottom-2 w-2 h-2 bg-emerald-600 rounded-full" />
              )}
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              type="button"
              onClick={() => setCurrentCity(City.MADINA)}
              className={`flex flex-col items-center justify-center p-8 rounded-[32px] border-2 transition-all gap-4 relative overflow-hidden group ${
                currentCity === City.MADINA
                  ? 'border-emerald-600 bg-emerald-50/50 dark:bg-emerald-900/20 ring-8 ring-emerald-500/5'
                  : 'border-white/20 dark:border-emerald-900/10 bg-white/30 dark:bg-[#0f1f1a]/30 hover:border-emerald-200'
              }`}
            >
              <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-2xl shadow-lg transition-all ${
                currentCity === City.MADINA ? 'bg-emerald-600 text-white scale-110' : 'bg-white/80 dark:bg-emerald-900/30 text-slate-400'
              }`}>
                <i className="fas fa-mosque"></i>
              </div>
              <span className={`font-black uppercase tracking-tighter text-lg ${
                currentCity === City.MADINA ? 'text-emerald-900 dark:text-emerald-400' : 'text-slate-400'
              }`}>
                {t.madina}
              </span>
              {currentCity === City.MADINA && (
                <motion.div layoutId="city-active-lost" className="absolute bottom-2 w-2 h-2 bg-emerald-600 rounded-full" />
              )}
            </motion.button>
          </div>
        </div>

        {/* Image Upload Section (Optional) */}
        <div className="space-y-6">
          <label className="block text-[10px] font-black text-slate-400 dark:text-slate-600 uppercase tracking-[0.2em]">
            {t.itemImage} ({formData.images.length}/5) - {isRTL ? 'اختياري' : 'OPTIONAL'}
          </label>
          
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-6">
            <AnimatePresence>
              {formData.images.map((img, index) => (
                <motion.div 
                  key={index}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className="relative aspect-square rounded-[28px] overflow-hidden group border border-white/20 dark:border-emerald-900/20 shadow-md"
                >
                  <img src={img} alt={`Upload ${index}`} className="w-full h-full object-cover" />
                  <button 
                    type="button"
                    onClick={() => removeImage(index)}
                    className="absolute top-2 right-2 w-8 h-8 bg-rose-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all shadow-lg"
                  >
                    <i className="fas fa-times text-xs"></i>
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>
            
            {formData.images.length < 5 && (
              <motion.div 
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => !aiProcessing && fileInputRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (aiProcessing) return;
                  const files = Array.from(e.dataTransfer.files);
                  if (files.length > 0) {
                    const event = { target: { files: e.dataTransfer.files } } as any;
                    handleImageUpload(event);
                  }
                }}
                className={`aspect-square rounded-[28px] border-2 border-dashed transition-all cursor-pointer flex flex-col items-center justify-center border-white/30 dark:border-emerald-900/20 hover:border-emerald-500 bg-white/20 dark:bg-[#0f1f1a]/20 hover:bg-white/40 ${aiProcessing ? 'opacity-70 cursor-wait' : ''}`}
              >
                <div className="text-center p-4">
                  <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-sm">
                    <i className="fas fa-camera text-lg"></i>
                  </div>
                  <p className="text-xs font-black text-slate-500 uppercase tracking-wider">{t.uploadImage}</p>
                </div>
              </motion.div>
            )}
          </div>

          <AnimatePresence>
            {aiProcessing && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex items-center space-x-3 rtl:space-x-reverse px-4 py-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl"
              >
                <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest animate-pulse">
                  {t.aiAnalyzing}
                </span>
              </motion.div>
            )}
          </AnimatePresence>
          
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleImageUpload} 
            accept="image/*" 
            multiple
            className="hidden" 
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-4">
            <label className="block text-[10px] font-black text-slate-400 dark:text-slate-600 uppercase tracking-[0.2em]">{t.itemName}</label>
            <input
              type="text"
              className={`w-full px-6 py-5 rounded-2xl bg-white/50 dark:bg-[#0f1f1a]/50 border ${showErrors && !formData.name.trim() ? 'border-rose-500' : 'border-white/20 dark:border-emerald-900/20'} focus:ring-8 focus:ring-emerald-500/5 focus:border-emerald-500 outline-none transition-all text-lg font-bold text-slate-900 dark:text-white placeholder:text-slate-400`}
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              placeholder={isRTL ? 'مثال: هاتف آيفون 13' : 'e.g. iPhone 13'}
            />
            {showErrors && !formData.name.trim() && (
              <p className="text-[10px] font-bold text-rose-500 uppercase tracking-widest">{t.fieldRequired}</p>
            )}
          </div>

          <div className="space-y-4">
            <SilkyDateInput
              label={isRTL ? 'تاريخ الفقدان' : 'DATE LOST'}
              min={new Date(new Date().setFullYear(new Date().getFullYear() - 20)).toISOString().split('T')[0]}
              max={new Date().toISOString().split('T')[0]}
              value={formData.date}
              onChange={(val) => setFormData({ ...formData, date: val })}
              isRTL={isRTL}
            />
            {showErrors && !formData.date.trim() && (
              <p className="text-[10px] font-bold text-rose-500 uppercase tracking-widest">{t.fieldRequired}</p>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <label className="block text-[10px] font-black text-slate-400 dark:text-slate-600 uppercase tracking-[0.2em]">{t.itemDesc}</label>
          <textarea
            rows={4}
            className={`w-full px-6 py-5 rounded-2xl bg-white/50 dark:bg-[#0f1f1a]/50 border ${showErrors && !formData.description.trim() ? 'border-rose-500' : 'border-white/20 dark:border-emerald-900/20'} focus:ring-8 focus:ring-emerald-500/5 focus:border-emerald-500 outline-none transition-all resize-none text-lg font-medium text-slate-900 dark:text-white placeholder:text-slate-400`}
            value={formData.description}
            onChange={(e) => setFormData({...formData, description: e.target.value})}
            placeholder={isRTL ? 'صف الشيء المفقود بالتفصيل...' : 'Describe the lost item in detail...'}
          />
          {showErrors && !formData.description.trim() && (
            <p className="text-[10px] font-bold text-rose-500 uppercase tracking-widest">{t.fieldRequired}</p>
          )}
        </div>

        <div className="space-y-6">
          <label className="block text-[10px] font-black text-slate-400 dark:text-slate-600 uppercase tracking-[0.2em]">
            {isRTL ? 'الموقع التقريبي على الخريطة' : 'APPROXIMATE LOCATION ON MAP'}
          </label>
          <div className="rounded-[32px] overflow-hidden border border-white/20 dark:border-emerald-900/20 shadow-lg p-6 md:p-8 bg-white/20 dark:bg-emerald-900/5">
            <MapPicker 
              city={currentCity} 
              lang={lang} 
              hideCityButtons={true}
              centerOnSelect={true}
              onCityChange={(newCity) => setCurrentCity(newCity)}
              onLocationSelect={(lat, lng) => setFormData(prev => ({ ...prev, coordinates: lat ? { lat, lng } : null }))} 
            />
          </div>
        </div>

        <motion.button
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-emerald-700 hover:bg-emerald-600 text-white font-black py-6 rounded-2xl shadow-2xl shadow-emerald-700/20 transition-all flex items-center justify-center space-x-4 text-xl disabled:opacity-50 uppercase tracking-widest"
        >
          {isSubmitting ? (
            <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
          ) : (
            <>
              <span>{t.submitForApproval || 'Submit Report'}</span>
              <i className="fas fa-paper-plane"></i>
            </>
          )}
        </motion.button>
      </form>
    </motion.div>
  </div>
);
};

export default ReportLostItemForm;
