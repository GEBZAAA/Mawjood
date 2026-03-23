
import React from 'react';
import { View, Language } from '../types';
import { translations } from '../translations';

interface BottomNavProps {
  activeView: View;
  onViewChange: (view: View) => void;
  lang: Language;
}

const BottomNav: React.FC<BottomNavProps> = ({ activeView, onViewChange, lang }) => {
  const t = translations[lang];
  const tabs: { id: View; icon: string; label: string }[] = [
    { id: 'HOME', icon: 'fas fa-home', label: t.home },
    { id: 'SEARCH', icon: 'fas fa-search', label: t.search },
    { id: 'REPORT_FOUND', icon: 'fas fa-plus-circle', label: t.reportFound || t.report },
    { id: 'REPORT_LOST', icon: 'fas fa-bullhorn', label: t.reportLost || t.report },
    { id: 'PROFILE', icon: 'fas fa-user', label: t.profile },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/80 dark:bg-[#061410]/90 backdrop-blur-lg border-t border-slate-200/50 dark:border-emerald-900/20 h-20 px-4 flex items-center justify-between shadow-[0_-10px_30px_rgba(0,0,0,0.05)] rounded-t-[32px] transition-colors duration-300">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onViewChange(tab.id)}
          className={`flex flex-col items-center justify-center flex-grow transition-all duration-300 relative ${
            activeView === tab.id ? 'text-emerald-700 dark:text-emerald-500' : 'text-slate-400 dark:text-slate-600'
          }`}
        >
          {activeView === tab.id && (
            <span className="absolute -top-2 w-1 h-1 bg-emerald-700 dark:bg-emerald-500 rounded-full animate-bounce"></span>
          )}
          <div className={`text-xl mb-1 ${activeView === tab.id ? 'scale-110' : 'scale-100'}`}>
            <i className={tab.icon}></i>
          </div>
          <span className="text-[10px] font-bold uppercase tracking-widest">{tab.label}</span>
        </button>
      ))}
    </nav>
  );
};

export default BottomNav;
