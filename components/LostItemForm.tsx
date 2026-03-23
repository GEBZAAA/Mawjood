
import React, { useState, useRef } from 'react';
import { City, Language, FoundItem, User } from '../types';
import { translations } from '../translations';
import { analyzeItemImage, translateItemFields } from '../services/geminiService';
import MapPicker from './MapPicker';
import { SilkyDateInput } from './SilkyInputs';
import { motion, AnimatePresence } from 'framer-motion';

interface LostItemFormProps {
  city: City;
  user: User;
  onReport: (item: FoundItem) => void;
  onBack: () => void;
  lang: Language;
}

const LostItemForm: React.FC<LostItemFormProps> = ({ city, user, onReport, onBack, lang }) => {
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
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [toast, setToast] = useState<{ type: 'error' | 'success', message: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const remainingSlots = 10 - formData.images.length;
    const filesToProcess = files.slice(0, remainingSlots);

    if (files.length > remainingSlots) {
      setToast({ type: 'error', message: isRTL ? 'يمكنك تحميل ما يصل إلى 10 صور فقط' : 'You can only upload up to 10 images' });
    }

    for (const fileObj of filesToProcess) {
      const file = fileObj as File;
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result as string;
        setFormData(prev => ({ ...prev, images: [...prev.images, base64] }));
        
        // AI Analysis (only for the first image if name/desc are empty)
        if (formData.images.length === 0 && !formData.name) {
          setIsAnalyzing(true);
          try {
            const base64Data = base64.split(',')[1];
            const mimeType = file.type;
            const analysis = await analyzeItemImage(base64Data, mimeType);
            
            if (analysis.description) {
              setFormData(prev => ({
                ...prev,
                name: analysis.category || prev.name,
                description: analysis.description
              }));
            }
          } catch (error) {
            console.error("AI Analysis failed:", error);
          } finally {
            setIsAnalyzing(false);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.images.length === 0) {
      setToast({ type: 'error', message: isRTL ? 'يرجى تحميل صورة واحدة على الأقل' : 'Please upload at least one image' });
      return;
    }
    setIsSubmitting(true);
    
    try {
      // Auto-translate for the admin
      const translationsResult = await translateItemFields({
        name: formData.name,
        description: formData.description,
        location: currentCity === City.MECCA ? 'Masjid al-Haram' : 'Masjid an-Nabawi',
        city: currentCity
      });

      const itemToAdd: FoundItem = {
        id: `FI-USER-${Date.now()}`,
        name: formData.name,
        nameEn: translationsResult.nameEn,
        description: formData.description,
        descriptionEn: translationsResult.descriptionEn,
        foundLocation: currentCity === City.MECCA ? 'Masjid al-Haram' : 'Masjid an-Nabawi',
        foundLocationEn: translationsResult.locationEn,
        city: currentCity,
        dateFound: formData.date,
        pickupOffice: 'Security Office',
        pickupInstructions: 'Pending verification',
        imageUrl: formData.images[0],
        imageUrls: formData.images,
        status: 'PENDING',
        coordinates: formData.coordinates || undefined,
        submittedBy: (user as any).passportNumber || user.username
      };

      onReport(itemToAdd);
      setIsSuccess(true);
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
        <h2 className="text-4xl font-black text-slate-800 dark:text-white tracking-tight">{t.foundItemForm}</h2>
        <p className="text-lg text-slate-500 dark:text-slate-400 leading-relaxed">
          {t.foundItemSub}
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

        {/* City Selection - Large Buttons at the start */}
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
                <motion.div layoutId="city-active" className="absolute bottom-2 w-2 h-2 bg-emerald-600 rounded-full" />
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
                <motion.div layoutId="city-active" className="absolute bottom-2 w-2 h-2 bg-emerald-600 rounded-full" />
              )}
            </motion.button>
          </div>
        </div>

        {/* Image Upload Section */}
        <div className="space-y-6">
          <label className="block text-[10px] font-black text-slate-400 dark:text-slate-600 uppercase tracking-[0.2em]">
            {t.itemImage} ({formData.images.length}/10)
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
            
            {formData.images.length < 10 && (
              <motion.div 
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => !isAnalyzing && fileInputRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (isAnalyzing) return;
                  const files = Array.from(e.dataTransfer.files);
                  if (files.length > 0) {
                    const event = { target: { files: e.dataTransfer.files } } as any;
                    handleImageUpload(event);
                  }
                }}
                className={`aspect-square rounded-[28px] border-2 border-dashed transition-all cursor-pointer flex flex-col items-center justify-center ${
                  isAnalyzing ? 'opacity-70 cursor-wait' : 'border-white/30 dark:border-emerald-900/20 hover:border-emerald-500 bg-white/20 dark:bg-[#0f1f1a]/20 hover:bg-white/40'
                }`}
              >
                <div className="text-center p-4">
                  <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-sm">
                    <i className="fas fa-plus text-lg"></i>
                  </div>
                  <p className="text-xs font-black text-slate-500 uppercase tracking-wider">{t.uploadImage}</p>
                </div>
              </motion.div>
            )}
          </div>
          
          {isAnalyzing && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center space-x-3 rtl:space-x-reverse text-emerald-600 dark:text-emerald-400 p-4 bg-emerald-50/50 dark:bg-emerald-900/10 rounded-2xl border border-emerald-100/50 dark:border-emerald-900/20"
            >
              <div className="w-5 h-5 border-2 border-emerald-500/20 border-t-emerald-600 rounded-full animate-spin"></div>
              <p className="text-sm font-bold">{t.aiAnalyzing}</p>
            </motion.div>
          )}
          
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleImageUpload} 
            accept="image/*" 
            multiple
            className="hidden" 
            disabled={isAnalyzing}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-4">
            <label className="block text-[10px] font-black text-slate-400 dark:text-slate-600 uppercase tracking-[0.2em]">{t.itemName}</label>
            <input
              required
              type="text"
              className="w-full px-6 py-5 rounded-2xl bg-white/50 dark:bg-[#0f1f1a]/50 border border-white/20 dark:border-emerald-900/20 focus:ring-8 focus:ring-emerald-500/5 focus:border-emerald-500 outline-none transition-all text-lg font-bold text-slate-900 dark:text-white placeholder:text-slate-400"
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              placeholder={isRTL ? 'مثال: محفظة جلدية سوداء' : 'e.g. Black leather wallet'}
            />
          </div>

          <div className="space-y-4">
            <SilkyDateInput
              label={isRTL ? 'تاريخ العثور' : 'DATE FOUND'}
              required
              min={new Date(new Date().setFullYear(new Date().getFullYear() - 20)).toISOString().split('T')[0]}
              max={new Date().toISOString().split('T')[0]}
              value={formData.date}
              onChange={(val) => setFormData({ ...formData, date: val })}
              isRTL={isRTL}
            />
          </div>
        </div>

        <div className="space-y-4">
          <label className="block text-[10px] font-black text-slate-400 dark:text-slate-600 uppercase tracking-[0.2em]">{t.itemDesc}</label>
          <textarea
            required
            rows={4}
            className="w-full px-6 py-5 rounded-2xl bg-white/50 dark:bg-[#0f1f1a]/50 border border-white/20 dark:border-emerald-900/20 focus:ring-8 focus:ring-emerald-500/5 focus:border-emerald-500 outline-none transition-all resize-none text-lg font-medium text-slate-900 dark:text-white placeholder:text-slate-400"
            value={formData.description}
            onChange={(e) => setFormData({...formData, description: e.target.value})}
            placeholder={isRTL ? 'صف الشيء بالتفصيل...' : 'Describe the item in detail...'}
          />
        </div>

        <div className="space-y-6">
          <label className="block text-[10px] font-black text-slate-400 dark:text-slate-600 uppercase tracking-[0.2em]">
            {isRTL ? 'الموقع على الخريطة' : 'LOCATION ON MAP'}
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
          disabled={isSubmitting || isAnalyzing}
          className="w-full bg-emerald-700 hover:bg-emerald-600 text-white font-black py-6 rounded-2xl shadow-2xl shadow-emerald-700/20 transition-all flex items-center justify-center space-x-4 text-xl disabled:opacity-50 uppercase tracking-widest"
        >
          {isSubmitting ? (
            <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
          ) : (
            <>
              <span>{t.submitForApproval}</span>
              <i className="fas fa-paper-plane"></i>
            </>
          )}
        </motion.button>
      </form>
    </motion.div>
  </div>
);
};

export default LostItemForm;
