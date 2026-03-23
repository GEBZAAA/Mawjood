
import React from 'react';
import { motion } from 'framer-motion';
import { Settings, Bell, Globe, Shield, Moon, Trash2 } from 'lucide-react';
import { AuthenticatedUser, Language } from '../types';
import { translations } from '../translations';

interface SettingsSectionProps {
  user: AuthenticatedUser;
  lang: Language;
  onBack: () => void;
}

const SettingsSection: React.FC<SettingsSectionProps> = ({ user, lang, onBack }) => {
  const t = translations[lang];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6 pb-20"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-800 dark:text-white">{t.settings}</h2>
        <button 
          onClick={onBack}
          className="text-emerald-600 font-medium hover:underline"
        >
          {t.backToLogin.includes('Login') ? 'Back' : 'رجوع'}
        </button>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-slate-700">
          <h3 className="font-semibold text-slate-800 dark:text-white flex items-center gap-2">
            <Globe className="w-5 h-5 text-emerald-600" />
            {lang === 'ar' ? 'اللغة والتفضيلات' : 'Language & Preferences'}
          </h3>
        </div>
        <div className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-slate-600 dark:text-slate-400">
              {lang === 'ar' ? 'لغة التطبيق' : 'App Language'}
            </span>
            <span className="font-medium text-emerald-600 uppercase">{lang}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-600 dark:text-slate-400">
              {lang === 'ar' ? 'الوضع الليلي' : 'Dark Mode'}
            </span>
            <div className="w-12 h-6 bg-slate-200 dark:bg-emerald-600 rounded-full relative transition-colors">
              <div className="absolute top-1 left-1 dark:left-7 w-4 h-4 bg-white rounded-full transition-all shadow-sm" />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-slate-700">
          <h3 className="font-semibold text-slate-800 dark:text-white flex items-center gap-2">
            <Bell className="w-5 h-5 text-emerald-600" />
            {lang === 'ar' ? 'التنبيهات' : 'Notifications'}
          </h3>
        </div>
        <div className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-slate-600 dark:text-slate-400">
              {lang === 'ar' ? 'تنبيهات المطابقة' : 'Match Notifications'}
            </span>
            <div className="w-12 h-6 bg-emerald-600 rounded-full relative">
              <div className="absolute top-1 left-7 w-4 h-4 bg-white rounded-full shadow-sm" />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-slate-700">
          <h3 className="font-semibold text-slate-800 dark:text-white flex items-center gap-2">
            <Shield className="w-5 h-5 text-emerald-600" />
            {lang === 'ar' ? 'الأمان' : 'Security'}
          </h3>
        </div>
        <div className="p-4">
          <button className="w-full text-left py-2 text-slate-600 dark:text-slate-400 hover:text-emerald-600 transition-colors">
            {lang === 'ar' ? 'تغيير كلمة المرور' : 'Change Password'}
          </button>
        </div>
      </div>
    </motion.div>
  );
};

export default SettingsSection;
