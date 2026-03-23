
import React from 'react';
import { motion } from 'framer-motion';
import { Bell, CheckCircle, Info, Search, Trash2 } from 'lucide-react';
import { Notification, Language } from '../types';
import { formatDateTime } from '../utils';

interface NotificationSectionProps {
  notifications: Notification[];
  lang: Language;
  onMarkRead: (id: string) => void;
  onBack: () => void;
}

const NotificationSection: React.FC<NotificationSectionProps> = ({ notifications, lang, onMarkRead, onBack }) => {
  const isRTL = lang === 'ar' || lang === 'ur' || lang === 'fa';

  const getIcon = (type: string) => {
    switch (type) {
      case 'CLAIM_APPROVED':
      case 'REPORT_APPROVED':
        return <CheckCircle className="w-5 h-5 text-emerald-600" />;
      case 'MATCH_FOUND':
        return <Search className="w-5 h-5 text-amber-600" />;
      case 'REPORT_THANK_YOU':
        return <Info className="w-5 h-5 text-blue-600" />;
      default:
        return <Bell className="w-5 h-5 text-slate-600" />;
    }
  };

  const getBgColor = (type: string) => {
    switch (type) {
      case 'CLAIM_APPROVED':
      case 'REPORT_APPROVED':
        return 'bg-emerald-100 dark:bg-emerald-900/30';
      case 'MATCH_FOUND':
        return 'bg-amber-100 dark:bg-amber-900/30';
      case 'REPORT_THANK_YOU':
        return 'bg-blue-100 dark:bg-blue-900/30';
      default:
        return 'bg-slate-100 dark:bg-slate-900/30';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6 pb-20"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-800 dark:text-white">
          {isRTL ? 'الإشعارات' : 'Notifications'}
        </h2>
        <button 
          onClick={onBack}
          className="text-emerald-600 font-medium hover:underline"
        >
          {isRTL ? 'رجوع' : 'Back'}
        </button>
      </div>

      <div className="space-y-3">
        {notifications.length === 0 ? (
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-12 text-center border border-slate-100 dark:border-slate-700">
            <Bell className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
            <p className="text-slate-500 dark:text-slate-400">
              {isRTL ? 'لا توجد إشعارات حتى الآن' : 'No notifications yet'}
            </p>
          </div>
        ) : (
          notifications.map((notification) => (
            <div
              key={notification.id}
              onClick={() => !notification.read && onMarkRead(notification.id)}
              className={`bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border transition-all cursor-pointer ${
                !notification.read 
                  ? 'border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/30 dark:bg-emerald-900/5' 
                  : 'border-slate-100 dark:border-slate-700'
              }`}
            >
              <div className="flex items-start gap-4">
                <div className={`p-2 rounded-xl shrink-0 ${getBgColor(notification.type)}`}>
                  {getIcon(notification.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start gap-2">
                    <h4 className={`font-bold text-sm ${!notification.read ? 'text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-400'}`}>
                      {isRTL ? notification.titleAr || notification.title : notification.title}
                    </h4>
                    <span className="text-[10px] text-slate-400 whitespace-nowrap">
                      {formatDateTime(notification.createdAt)}
                    </span>
                  </div>
                  <p className={`text-xs mt-1 leading-relaxed ${!notification.read ? 'text-slate-700 dark:text-slate-200' : 'text-slate-500 dark:text-slate-400'}`}>
                    {isRTL ? notification.messageAr || notification.message : notification.message}
                  </p>
                  {!notification.read && (
                    <div className="mt-2 flex justify-end">
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold uppercase tracking-widest">
                        {isRTL ? 'جديد' : 'New'}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </motion.div>
  );
};

export default NotificationSection;
