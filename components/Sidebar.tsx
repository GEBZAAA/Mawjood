
import React from 'react';
import { View, Language } from '../types';
import { translations } from '../translations';

interface SidebarProps {
  activeView: View;
  onViewChange: (view: View) => void;
  lang: Language;
  onHelp?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activeView, onViewChange, lang, onHelp }) => {
  const t = translations[lang];
  const isRTL = lang === 'ar' || lang === 'ur' || lang === 'fa';
  const menuItems: { id: View; icon: string; label: string }[] = [
    { id: 'HOME', icon: 'fas fa-th-large', label: t.home },
    { id: 'SEARCH', icon: 'fas fa-search', label: t.search },
    { id: 'REPORT_FOUND', icon: 'fas fa-plus-square', label: t.reportFound || t.report },
    { id: 'REPORT_LOST', icon: 'fas fa-bullhorn', label: t.reportLost || t.report },
    { id: 'PROFILE', icon: 'fas fa-user-circle', label: t.profile },
  ];

  return (
    <aside className="hidden md:flex flex-col w-64 h-screen bg-[#F8D6B3] dark:bg-[#061410]/80 backdrop-blur-xl border-r border-slate-200 dark:border-emerald-900/20 sticky top-0 py-8 px-4 shadow-sm z-50 transition-colors duration-300">
      <div className="flex items-center space-x-3 rtl:space-x-reverse px-4 mb-12">
        <div className="bg-emerald-700 p-2 rounded-xl">
          <i className="fas fa-mosque text-white"></i>
        </div>
        <h1 className="text-xl font-black text-slate-800 dark:text-white tracking-tighter">{t.appName}</h1>
      </div>

      <nav className="flex-grow flex flex-col justify-between overflow-y-auto custom-scrollbar bg-[#EAC39C] dark:bg-transparent rounded-2xl p-2">
        <div className="space-y-2">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => onViewChange(item.id)}
              className={`w-full flex items-center space-x-3 rtl:space-x-reverse px-4 py-3 rounded-2xl transition-all font-semibold ${
                activeView === item.id 
                ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 shadow-sm' 
                : 'text-slate-500 dark:text-slate-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 hover:text-emerald-700 dark:hover:text-emerald-300'
              }`}
            >
              <i className={`${item.icon} text-lg w-6 text-center`}></i>
              <span>{item.label}</span>
            </button>
          ))}
        </div>

        <div className="px-4 mt-8">
          <div className="bg-[#5C4624] dark:bg-emerald-900/20 rounded-2xl p-4 text-white border border-emerald-900/30">
            <a 
              href="tel:1966"
              className="text-[10px] font-bold uppercase tracking-widest text-[#F7E1BE] dark:text-emerald-500/70 hover:text-emerald-400 transition-colors block"
            >
              1966
            </a>
            <button 
              onClick={onHelp}
              className="mt-4 w-full bg-[#83673F] text-[#F7E1BE] dark:bg-emerald-700/20 dark:text-white hover:opacity-90 py-2 rounded-lg text-xs transition-colors border border-emerald-700/30"
            >
              {t.help}
            </button>
          </div>
        </div>
      </nav>
    </aside>
  );
};

export default Sidebar;
