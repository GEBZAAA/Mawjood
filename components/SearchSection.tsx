
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { City, LostItemReport, Language } from '../types';
import { translations } from '../translations';

interface SearchSectionProps {
  city: City;
  onMatch: (report: LostItemReport) => void;
  lang: Language;
}

const SearchSection: React.FC<SearchSectionProps> = ({ city, onMatch, lang }) => {
  const t = translations[lang];
  const isRTL = lang === 'ar' || lang === 'ur' || lang === 'fa';
  const [query, setQuery] = useState('');
  
  const recentSearches = isRTL 
    ? ['ساعة يد', 'محفظة جلدية', 'جواز سفر', 'نظارات شمسية']
    : ['Wristwatch', 'Leather Wallet', 'Passport', 'Sunglasses'];
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    onMatch({ 
      name: query, 
      description: query, 
      city, 
      images: [] 
    });
  };

  const isSearchDisabled = !query.trim();

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`max-w-4xl mx-auto space-y-12 ${isRTL ? 'text-right' : 'text-left'}`}
    >
      <div className="text-center space-y-4 mb-12">
        <motion.h2 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-4xl md:text-5xl font-black text-slate-800 dark:text-white tracking-tight"
        >
          {isRTL ? 'ابحث عن مفقوداتك' : 'Find Your Belongings'}
        </motion.h2>
        <motion.p 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="text-slate-500 dark:text-slate-400 text-lg max-w-2xl mx-auto leading-relaxed"
        >
          {isRTL 
            ? 'استخدم تقنياتنا المتقدمة للبحث في قاعدة بيانات المفقودات والموجودات في الحرمين الشريفين.'
            : 'Use our advanced search to look through the lost and found database of the Two Holy Mosques.'}
        </motion.p>
      </div>

      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.3 }}
        className="bg-white/40 dark:bg-[#162923]/40 backdrop-blur-2xl p-3 rounded-[40px] shadow-2xl border border-white/20 dark:border-emerald-900/20 flex items-center transition-all focus-within:ring-8 focus-within:ring-emerald-500/5 rtl:flex-row-reverse group"
      >
        <div className="px-8 text-slate-400 dark:text-slate-600 group-focus-within:text-emerald-600 transition-colors">
          <i className="fas fa-search text-2xl"></i>
        </div>
        <input 
          type="text"
          placeholder={isRTL ? 'صف ما فقدته بالتفصيل...' : 'Describe what you lost in detail...'}
          className={`flex-grow bg-transparent border-none outline-none py-8 px-4 text-xl font-medium text-slate-800 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600 ${isRTL ? 'text-right' : 'text-left'}`}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !isSearchDisabled && handleSubmit(e)}
        />
        
        <div className="flex items-center space-x-3 rtl:space-x-reverse px-3">
          <motion.button 
            whileHover={isSearchDisabled ? {} : { scale: 1.05, x: isRTL ? -5 : 5 }}
            whileTap={isSearchDisabled ? {} : { scale: 0.95 }}
            onClick={handleSubmit}
            disabled={isSearchDisabled}
            className={`w-16 h-16 rounded-[28px] flex items-center justify-center shadow-xl transition-all ${isSearchDisabled ? 'bg-slate-200 dark:bg-emerald-900/10 text-slate-400 cursor-not-allowed' : 'bg-emerald-700 hover:bg-emerald-600 text-white shadow-emerald-700/30'}`}
          >
            <i className={`fas ${isRTL ? 'fa-arrow-left' : 'fa-arrow-right'} text-xl`}></i>
          </motion.button>
        </div>
      </motion.div>

      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="flex flex-wrap gap-3 justify-center"
      >
        <span className="text-[10px] font-black text-slate-400 dark:text-slate-600 uppercase tracking-[0.2em] w-full text-center mb-4">
          {isRTL ? 'عمليات البحث الشائعة' : 'POPULAR SEARCHES'}
        </span>
        {recentSearches.map((s, i) => (
          <motion.button 
            key={s}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.5 + (i * 0.05) }}
            onClick={() => setQuery(s)}
            className="bg-white/50 dark:bg-[#162923]/40 backdrop-blur-md px-6 py-3 rounded-2xl text-sm font-bold text-slate-600 dark:text-slate-400 border border-white/20 dark:border-emerald-900/20 hover:border-emerald-500 dark:hover:border-emerald-700 hover:text-emerald-700 dark:hover:text-emerald-400 transition-all shadow-sm hover:shadow-md"
          >
            {s}
          </motion.button>
        ))}
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-16">
        <motion.div 
          initial={{ opacity: 0, x: isRTL ? 20 : -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.6 }}
          className="bg-white/40 dark:bg-[#162923]/40 backdrop-blur-2xl p-10 rounded-[40px] border border-white/20 dark:border-emerald-900/20 shadow-xl group hover:shadow-2xl transition-all"
        >
           <div className="w-16 h-16 bg-amber-100 dark:bg-amber-900/20 text-amber-500 rounded-3xl flex items-center justify-center text-3xl mb-8 group-hover:scale-110 transition-transform">
             <i className="fas fa-lightbulb"></i>
           </div>
           <h3 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">{isRTL ? 'نصيحة للبحث' : 'Search Tip'}</h3>
           <p className="text-slate-500 dark:text-slate-400 mt-4 leading-relaxed">
             {isRTL 
               ? 'صف العلامات المميزة أو ألوان الحافظة أو المحتويات المحددة داخل العنصر للحصول على دقة أفضل في النتائج.'
               : 'Describe distinct marks, case colors, or specific contents inside the item for better accuracy in results.'}
           </p>
        </motion.div>
        <motion.div 
          initial={{ opacity: 0, x: isRTL ? -20 : 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.7 }}
          className="bg-emerald-700 dark:bg-emerald-900/80 backdrop-blur-2xl p-10 rounded-[40px] text-white shadow-2xl shadow-emerald-700/20 group hover:shadow-emerald-700/40 transition-all"
        >
           <div className="w-16 h-16 bg-white/10 text-white rounded-3xl flex items-center justify-center text-3xl mb-8 group-hover:scale-110 transition-transform">
             <i className="fas fa-shield-halved"></i>
           </div>
           <h3 className="text-2xl font-black tracking-tight">{isRTL ? 'الخصوصية مضمونة' : 'Privacy Guaranteed'}</h3>
           <p className="text-emerald-100 dark:text-emerald-200 mt-4 leading-relaxed opacity-80">
             {isRTL 
               ? 'استفسارات البحث الخاصة بك خاصة وتستخدم فقط لمطابقة العناصر داخل قاعدة بياناتنا الآمنة والمشفرة.'
               : 'Your search queries are private and used only to match items within our secure and encrypted database.'}
           </p>
        </motion.div>
      </div>
    </motion.div>
  );
};

export default SearchSection;
