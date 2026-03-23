
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { City, User, View, Language, FoundItem } from '../types';
import { translations } from '../translations';
import { analyzeItemImage, translateItemFields } from '../services/geminiService';
import { SilkyDateInput } from './SilkyInputs';

interface DashboardProps {
  user: User;
  city: City;
  onCityToggle: () => void;
  onAction: (view: View) => void;
  lang: Language;
  items: FoundItem[];
}

const Dashboard: React.FC<DashboardProps> = ({ user, city, onCityToggle, onAction, lang, items }) => {
  const t = translations[lang];
  const isRTL = lang === 'ar' || lang === 'ur' || lang === 'fa';
  
  // Specific high-quality images matching the user's reference photos
  const cityImage = city === City.MECCA 
    ? "https://thesaudiboom.com/wp-content/uploads/2025/04/1-Over-3-Million-Worshippers-Gathered-at-Two-Holy-Mosques-on-27th-Night-of-Ramadan.png" // Aerial view of Kaaba at night
    : "https://wallpapers.com/images/high/al-masjid-an-nabawi-night-view-dtm1u94claimwt6h.webp"; // Landscape view of Masjid an-Nabawi

  return (
    <div className="space-y-10 flex-1 flex flex-col">
      <section className="relative overflow-hidden rounded-[48px] bg-emerald-950 min-h-[500px] flex flex-col items-center justify-center p-10 text-white shadow-2xl transition-all duration-500 flex-1">
        {/* Background Image Layer */}
        <div className="absolute inset-0 z-0 overflow-hidden">
          <AnimatePresence>
            <motion.img 
              key={cityImage}
              src={cityImage} 
              alt={city}
              initial={{ opacity: 0, scale: 1.1 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
              transition={{ duration: 1.2, ease: [0.4, 0, 0.2, 1] }}
              className="absolute inset-0 w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          </AnimatePresence>
          {/* Enhanced gradient for better text legibility */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-black/90 z-10"></div>
          <div className="absolute inset-0 bg-emerald-900/20 mix-blend-multiply z-10"></div>
        </div>

        <div className="relative z-20 w-full max-w-4xl text-center space-y-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <h2 className="text-6xl md:text-8xl font-black tracking-tight drop-shadow-2xl mb-6">
              {t.welcome}, <span className="text-emerald-400">{user?.fullName?.split(' ')[0] || user?.fullName || (isRTL ? 'ضيف' : 'Guest')}</span>
            </h2>
            <p className="text-emerald-100/90 text-2xl md:text-3xl font-medium drop-shadow-md max-w-2xl mx-auto">
              {isRTL ? 'كيف يمكننا مساعدتك اليوم؟' : 'How can we help you today?'}
            </p>
          </motion.div>
          
          <div className="flex justify-center pt-4">
             <button 
               onClick={onCityToggle}
               className="bg-white/10 hover:bg-white/20 backdrop-blur-md px-8 py-4 rounded-2xl text-sm font-bold flex items-center space-x-3 rtl:space-x-reverse transition-all border border-white/10 shadow-2xl group"
             >
               <i className="fas fa-map-marker-alt text-amber-400 group-hover:animate-bounce transition-transform duration-500 text-lg"></i>
               <AnimatePresence mode="wait">
                 <motion.span
                   key={city}
                   initial={{ opacity: 0, x: 5 }}
                   animate={{ opacity: 1, x: 0 }}
                   exit={{ opacity: 0, x: -5 }}
                   transition={{ duration: 0.3 }}
                 >
                   {city === City.MECCA ? t.mecca : t.madina}
                 </motion.span>
               </AnimatePresence>
               <span className="text-white/40 mx-2">|</span>
               <span className="text-emerald-300">{isRTL ? 'تغيير الموقع' : 'Change Location'}</span>
             </button>
          </div>
        </div>

        {/* Subtle decorative elements */}
        <div className={`absolute bottom-6 ${isRTL ? 'left-8' : 'right-8'} opacity-10 hidden md:block`}>
           <i className="fas fa-mosque text-[160px]"></i>
        </div>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
        {/* Lost Something Card */}
        <motion.div 
          whileHover={{ y: -12 }}
          className="relative group h-full"
        >
          <div className="absolute -inset-1 bg-gradient-to-b from-rose-500/20 to-transparent rounded-[48px] blur-md opacity-0 group-hover:opacity-100 transition duration-500"></div>
          <div className="relative bg-[#F8D6B3] dark:bg-[#162923]/80 backdrop-blur-lg p-10 rounded-[48px] shadow-sm border border-slate-100 dark:border-emerald-900/20 flex flex-col items-center text-center h-full transition-all duration-500 group-hover:shadow-2xl group-hover:shadow-rose-500/10">
            <div className="w-24 h-24 bg-[#F7E1BE] dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 rounded-[28px] flex items-center justify-center mb-8 transform group-hover:scale-110 group-hover:-rotate-3 transition-all duration-500 shadow-inner">
              <i className="fas fa-search-location text-4xl"></i>
            </div>
            <h3 className="font-black text-slate-800 dark:text-slate-100 text-2xl mb-4 tracking-tight">{t.lostSomething || (isRTL ? 'هل فقدت شيئاً؟' : 'Lost Something?')}</h3>
            <p className="text-base text-slate-500 dark:text-slate-400 leading-relaxed mb-8 max-w-xs">{t.lostSub || (isRTL ? 'أبلغ عن العنصر المفقود لمساعدتنا في العثور عليه.' : 'Report your lost item to help us find it.')}</p>
            <button 
              onClick={() => onAction('REPORT_LOST')}
              className="mt-auto w-full py-4 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl font-black text-base transition-all shadow-xl shadow-rose-600/20 flex items-center justify-center space-x-3 rtl:space-x-reverse uppercase tracking-widest"
            >
              <span>{t.reportLost || (isRTL ? 'إبلاغ عن مفقود' : 'Report Lost')}</span>
              <i className={`fas ${isRTL ? 'fa-arrow-left' : 'fa-arrow-right'} text-sm`}></i>
            </button>
          </div>
        </motion.div>

        {/* Found Something Card */}
        <motion.div 
          whileHover={{ y: -12 }}
          className="relative group h-full"
        >
          <div className="absolute -inset-1 bg-gradient-to-b from-emerald-500/20 to-transparent rounded-[48px] blur-md opacity-0 group-hover:opacity-100 transition duration-500"></div>
          <div className="relative bg-[#F8D6B3] dark:bg-[#162923]/80 backdrop-blur-lg p-10 rounded-[48px] shadow-sm border border-slate-100 dark:border-emerald-900/20 flex flex-col items-center text-center h-full transition-all duration-500 group-hover:shadow-2xl group-hover:shadow-emerald-500/10">
            <div className="w-24 h-24 bg-[#F7E1BE] dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-[28px] flex items-center justify-center mb-8 transform group-hover:scale-110 group-hover:rotate-3 transition-all duration-500 shadow-inner">
              <i className="fas fa-hand-holding-heart text-4xl"></i>
            </div>
            <h3 className="font-black text-slate-800 dark:text-slate-100 text-2xl mb-4 tracking-tight">{t.foundSomething}</h3>
            <p className="text-base text-slate-500 dark:text-slate-400 leading-relaxed mb-8 max-w-xs">{t.foundSub}</p>
            <button 
              onClick={() => onAction('REPORT_FOUND')}
              className="mt-auto w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black text-base transition-all shadow-xl shadow-emerald-600/20 flex items-center justify-center space-x-3 rtl:space-x-reverse uppercase tracking-widest"
            >
              <span>{t.startReporting}</span>
              <i className={`fas ${isRTL ? 'fa-arrow-left' : 'fa-arrow-right'} text-sm`}></i>
            </button>
          </div>
        </motion.div>

        {/* Profile Card */}
        <motion.div 
          whileHover={{ y: -12 }}
          onClick={() => onAction('PROFILE')}
          className="relative group cursor-pointer h-full"
        >
          <div className="absolute -inset-1 bg-gradient-to-b from-slate-500/20 to-transparent rounded-[48px] blur-md opacity-0 group-hover:opacity-100 transition duration-500"></div>
          <div className="relative bg-[#F8D6B3] dark:bg-[#162923]/80 backdrop-blur-lg p-10 rounded-[48px] shadow-sm border border-slate-100 dark:border-emerald-900/20 flex flex-col items-center text-center h-full transition-all duration-500 group-hover:shadow-2xl group-hover:shadow-slate-500/10">
            <div className="w-24 h-24 bg-[#F7E1BE] dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-[28px] flex items-center justify-center mb-8 transform group-hover:scale-110 transition-all duration-500 shadow-inner overflow-hidden">
               <div className="w-full h-full flex items-center justify-center text-3xl font-black bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-800 text-slate-500 dark:text-slate-400">
                 {user?.fullName?.charAt(0) || 'U'}
               </div>
            </div>
            <h3 className="font-black text-slate-800 dark:text-slate-100 text-2xl mb-4 tracking-tight">{t.profile}</h3>
            <p className="text-base text-slate-500 dark:text-slate-400 leading-relaxed mb-8 max-w-xs">{isRTL ? 'عرض وتعديل ملفك الشخصي وإعدادات الحساب.' : 'View and edit your profile and account settings.'}</p>
            <div className="mt-auto w-full py-4 bg-slate-800 dark:bg-slate-700 text-white rounded-2xl font-black text-base transition-all shadow-xl flex items-center justify-center space-x-3 rtl:space-x-reverse uppercase tracking-widest">
              <span>{isRTL ? 'الملف الشخصي' : 'Go to Profile'}</span>
              <i className={`fas ${isRTL ? 'fa-arrow-left' : 'fa-arrow-right'} text-xs`}></i>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Dashboard;
