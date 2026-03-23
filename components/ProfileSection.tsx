import { API_BASE } from '../apiConfig';

import React, { useState, useRef } from 'react';
import { User, Language, FoundItem, City, LostItemReport } from '../types';
import { translations } from '../translations';
import { formatDate } from '../utils';
import { motion, AnimatePresence } from 'framer-motion';
import { SilkySelect, SilkyDateInput, SilkyNationalitySelect } from './SilkyInputs';
import MapPicker from './MapPicker';
import ImageViewer from './ImageViewer';

interface ProfileSectionProps {
  user: User;
  items: FoundItem[];
  lostItems: LostItemReport[];
  onUpdateItem: (item: FoundItem) => void;
  onDeleteItem: (id: string) => void;
  onDeleteLostItem: (id: string) => void;
  onLogout: () => void;
  onUpdateUser?: (updatedUser: User) => void;
  lang: Language;
  token: string;
  initialView?: 'INFO' | 'SETTINGS' | 'REPORTS';
}

interface ReportItemCardProps {
  report: FoundItem | LostItemReport;
  type: 'found' | 'lost';
  idx: number;
  isRTL: boolean;
  onViewImage: (images: string[]) => void;
  onEdit?: (report: FoundItem) => void;
  onDelete: (id: string) => void;
  formatDate: (date?: string) => string;
}

const ReportItemCard: React.FC<ReportItemCardProps> = React.memo(({ report, type, idx, isRTL, onViewImage, onEdit, onDelete, formatDate }) => {
  const isFound = type === 'found';
  const foundReport = report as FoundItem;
  const lostReport = report as LostItemReport;

  const status = report.status;
  const name = report.name;
  const description = report.description;
  const date = isFound ? foundReport.dateFound : lostReport.dateLost;
  const city = isFound ? foundReport.city : lostReport.city;
  const imageUrl = isFound ? foundReport.imageUrl : (lostReport.images?.[0]);
  const imageUrls = isFound ? (foundReport.imageUrls || (foundReport.imageUrl ? [foundReport.imageUrl] : [])) : lostReport.images;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: idx * 0.05 }}
      className="p-5 rounded-[32px] bg-white/60 dark:bg-[#0f1f1a]/60 border border-white/20 dark:border-emerald-900/20 shadow-sm hover:shadow-xl transition-shadow group will-change-transform"
    >
      <div className="flex items-center space-x-5 rtl:space-x-reverse">
        <motion.div 
          whileHover={{ scale: 1.05 }}
          className="w-20 h-20 rounded-2xl bg-slate-100 dark:bg-emerald-900/20 overflow-hidden flex-shrink-0 cursor-pointer shadow-inner"
          onClick={() => {
            if (imageUrls && imageUrls.length > 0) {
              onViewImage(imageUrls);
            }
          }}
        >
          {imageUrl ? (
            <img src={imageUrl} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-slate-300 dark:text-emerald-900/40">
              <i className={`fas ${isFound ? 'fa-box' : 'fa-search'} text-3xl`}></i>
            </div>
          )}
        </motion.div>
        <div className="flex-grow">
          <div className="flex items-center justify-between mb-1">
            <h4 className="font-black text-slate-800 dark:text-white text-lg tracking-tight">{name}</h4>
            <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest shadow-sm ${
              status === 'APPROVED' || status === 'MATCHED' || status === 'RESOLVED'
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' 
                : status === 'PENDING_DELETION'
                ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
            }`}>
              {status === 'APPROVED' 
                ? (isRTL ? 'تمت الموافقة' : 'Approved') 
                : status === 'MATCHED'
                ? (isRTL ? 'تمت المطابقة' : 'Matched')
                : status === 'RESOLVED'
                ? (isRTL ? 'تم الحل' : 'Resolved')
                : status === 'PENDING_DELETION'
                ? (isRTL ? 'طلب حذف' : 'Delete Request')
                : (isRTL ? 'قيد المراجعة' : 'Pending')}
            </span>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 font-medium line-clamp-1">{description}</p>
          <div className="flex items-center justify-between mt-3">
            <div className="flex items-center text-[10px] font-bold text-slate-400 space-x-2 rtl:space-x-reverse">
              <i className="fas fa-calendar-alt text-emerald-500/50"></i>
              <span>{formatDate(date)}</span>
              <span className="opacity-30">•</span>
              <i className="fas fa-map-marker-alt text-emerald-500/50"></i>
              <span>{city}</span>
            </div>
            <div className="flex items-center space-x-4 rtl:space-x-reverse">
              {isFound && status !== 'PENDING_DELETION' && onEdit && (
                <button 
                  onClick={() => onEdit(foundReport)}
                  className="text-[10px] font-black text-emerald-600 hover:text-emerald-500 uppercase tracking-widest flex items-center transition-colors"
                >
                  <i className="fas fa-edit mr-1.5 rtl:ml-1.5"></i>
                  {isRTL ? 'تعديل' : 'Edit'}
                </button>
              )}
              <button 
                onClick={() => onDelete(report.id!)}
                className="text-[10px] font-black text-rose-500 hover:text-rose-400 uppercase tracking-widest flex items-center transition-colors"
              >
                <i className="fas fa-trash-alt mr-1.5 rtl:ml-1.5"></i>
                {isRTL ? 'حذف' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
});

interface PasswordRequirementItemProps {
  met: boolean;
  label: string;
}

const PasswordRequirementItem: React.FC<PasswordRequirementItemProps> = React.memo(({ met, label }) => (
  <li className={`flex items-center space-x-3 rtl:space-x-reverse transition-colors ${met ? 'text-emerald-500' : 'text-slate-400'}`}>
    <i className={`fas ${met ? 'fa-check-circle' : 'fa-circle-notch'}`}></i>
    <span>{label}</span>
  </li>
));

interface PasswordChangeFormProps {
  isRTL: boolean;
  t: any;
  passwords: any;
  setPasswords: (p: any) => void;
  onCancel: () => void;
}

const PasswordChangeForm: React.FC<PasswordChangeFormProps> = React.memo(({ isRTL, t, passwords, setPasswords, onCancel }) => {
  return (
    <motion.div 
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      className="space-y-6 overflow-hidden"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 uppercase tracking-widest">{isRTL ? 'تغيير كلمة المرور' : 'Change Password'}</h3>
        <button 
          onClick={onCancel}
          className="text-xs text-rose-500 font-black uppercase tracking-widest hover:underline"
        >
          {isRTL ? 'إلغاء' : 'Cancel'}
        </button>
      </div>
      
      <div className="space-y-4">
        <input 
          type="password"
          placeholder={isRTL ? 'كلمة المرور الحالية' : 'Current Password'}
          value={passwords.current}
          onChange={(e) => setPasswords({ ...passwords, current: e.target.value })}
          className="w-full p-5 rounded-3xl bg-white/50 dark:bg-[#0f1f1a]/50 border border-white/20 dark:border-emerald-900/20 text-slate-800 dark:text-slate-100 focus:ring-4 focus:ring-emerald-500/20 outline-none transition-all font-semibold"
        />
        <input 
          type="password"
          placeholder={isRTL ? 'كلمة المرور الجديدة' : 'New Password'}
          value={passwords.new}
          onChange={(e) => setPasswords({ ...passwords, new: e.target.value })}
          className="w-full p-5 rounded-3xl bg-white/50 dark:bg-[#0f1f1a]/50 border border-white/20 dark:border-emerald-900/20 text-slate-800 dark:text-slate-100 focus:ring-4 focus:ring-emerald-500/20 outline-none transition-all font-semibold"
        />
        <input 
          type="password"
          placeholder={isRTL ? 'تأكيد كلمة المرور الجديدة' : 'Confirm New Password'}
          value={passwords.confirm}
          onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })}
          className="w-full p-5 rounded-3xl bg-white/50 dark:bg-[#0f1f1a]/50 border border-white/20 dark:border-emerald-900/20 text-slate-800 dark:text-slate-100 focus:ring-4 focus:ring-emerald-500/20 outline-none transition-all font-semibold"
        />
        {passwords.confirm && (
          <div className={`mt-2 flex items-center space-x-2 rtl:space-x-reverse transition-all duration-300 ${passwords.new === passwords.confirm ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'}`}>
            <i className={`fas ${passwords.new === passwords.confirm ? 'fa-check-circle' : 'fa-times-circle'} text-sm`}></i>
            <span className="text-[10px] font-black uppercase tracking-widest">
              {passwords.new === passwords.confirm ? t.passwordsMatch : t.passwordsDoNotMatch}
            </span>
          </div>
        )}
      </div>

      <div className="p-6 rounded-[32px] bg-white/30 dark:bg-slate-900/30 border border-white/10 dark:border-emerald-900/10">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">{isRTL ? 'متطلبات كلمة المرور' : 'Password Requirements'}</p>
        <ul className="text-[11px] space-y-2 font-bold">
          <PasswordRequirementItem met={passwords.new.length >= 8} label={t.reqMinChars} />
          <PasswordRequirementItem met={/[A-Z]/.test(passwords.new)} label={t.reqUpper} />
          <PasswordRequirementItem met={/[0-9]/.test(passwords.new)} label={t.reqNumber} />
          <PasswordRequirementItem met={/[!@#$%^&*(),.?":{}|<>]/.test(passwords.new)} label={t.reqSymbol} />
        </ul>
      </div>
    </motion.div>
  );
});

interface VerificationBoxProps {
  isRTL: boolean;
  label: string;
  otp: string;
  setOtp: (val: string) => void;
  onConfirm: () => void;
}

const VerificationBox: React.FC<VerificationBoxProps> = React.memo(({ isRTL, label, otp, setOtp, onConfirm }) => (
  <motion.div 
    initial={{ opacity: 0, y: -10 }}
    animate={{ opacity: 1, y: 0 }}
    className="mt-4 p-6 rounded-[32px] bg-emerald-500/10 border border-emerald-500/20 backdrop-blur-md"
  >
    <p className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest mb-3">
      {label}
    </p>
    <div className="flex space-x-3 rtl:space-x-reverse">
      <input 
        type="text"
        maxLength={4}
        value={otp}
        onChange={(e) => setOtp(e.target.value)}
        placeholder="0000"
        className="w-32 p-4 rounded-2xl bg-white dark:bg-[#061410] border border-emerald-500/30 text-center font-black text-xl tracking-[0.5em] focus:ring-4 focus:ring-emerald-500/20 outline-none"
      />
      <button 
        onClick={onConfirm}
        className="flex-grow bg-emerald-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-lg"
      >
        {isRTL ? 'تأكيد' : 'Confirm'}
      </button>
    </div>
  </motion.div>
));

interface ProfileHeaderProps {
  user: any;
  isRTL: boolean;
}

const ProfileHeader: React.FC<ProfileHeaderProps> = React.memo(({ user, isRTL }) => (
  <div className="flex items-center space-x-6 rtl:space-x-reverse mb-10">
    <div className="relative group">
      <motion.div 
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className="w-24 h-24 rounded-[32px] bg-gradient-to-br from-emerald-500 to-teal-600 p-1 shadow-xl cursor-pointer overflow-hidden"
      >
        <div className="w-full h-full rounded-[28px] bg-white dark:bg-[#061410] flex items-center justify-center overflow-hidden">
          {user.photoURL ? (
            <img src={user.photoURL} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
          ) : (
            <i className="fas fa-user text-4xl text-emerald-500/30"></i>
          )}
        </div>
      </motion.div>
      <button className="absolute -bottom-2 -right-2 w-10 h-10 rounded-2xl bg-white dark:bg-emerald-900 border border-slate-100 dark:border-emerald-800 shadow-lg flex items-center justify-center text-emerald-600 hover:scale-110 transition-transform">
        <i className="fas fa-camera text-sm"></i>
      </button>
    </div>
    <div>
      <h2 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight leading-tight">{user.displayName}</h2>
      <p className="text-slate-500 dark:text-slate-400 font-bold text-sm mt-1">{user.email}</p>
      <div className="flex items-center space-x-2 rtl:space-x-reverse mt-2">
        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
        <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">
          {isRTL ? 'نشط الآن' : 'Active Now'}
        </span>
      </div>
    </div>
  </div>
));

interface ProfileInfoCardProps {
  user: any;
  isRTL: boolean;
  t: any;
}

const ProfileInfoCard: React.FC<ProfileInfoCardProps> = React.memo(({ user, isRTL, t }) => (
  <div className="bg-slate-900/90 dark:bg-[#061410]/90 p-12 text-center text-white relative overflow-hidden">
     {/* Decorative background elements */}
     <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none opacity-20">
       <div className="absolute -top-24 -left-24 w-64 h-64 bg-emerald-500 rounded-full blur-[100px]"></div>
       <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-emerald-700 rounded-full blur-[100px]"></div>
     </div>

     <div className={`absolute top-0 ${isRTL ? 'left-0' : 'right-0'} p-8`}>
        <motion.div 
          initial={{ opacity: 0, x: isRTL ? -20 : 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-emerald-500/20 backdrop-blur-md border border-emerald-500/30 text-emerald-400 text-[10px] font-bold px-4 py-1.5 rounded-full uppercase tracking-widest flex items-center"
        >
          <i className={`fas fa-check-circle ${isRTL ? 'ml-2' : 'mr-2'}`}></i> {t.verified}
        </motion.div>
     </div>
     
     <motion.div 
       initial={{ scale: 0, rotate: -10 }}
       animate={{ scale: 1, rotate: 3 }}
       transition={{ type: 'spring', stiffness: 260, damping: 20, delay: 0.1 }}
       className="w-32 h-32 bg-gradient-to-br from-emerald-500 via-emerald-600 to-emerald-800 rounded-[40px] mx-auto mb-8 flex items-center justify-center text-5xl font-black shadow-[0_20px_50px_rgba(16,185,129,0.4)] relative z-10 border-4 border-white/10"
     >
       {user?.fullName?.charAt(0) || 'U'}
       <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-white dark:bg-[#061410] rounded-2xl flex items-center justify-center text-emerald-600 shadow-xl border border-emerald-100 dark:border-emerald-900/20">
          <i className="fas fa-shield-alt text-lg"></i>
       </div>
     </motion.div>
     
     <motion.h2 
       initial={{ opacity: 0, y: 10 }}
       animate={{ opacity: 1, y: 0 }}
       transition={{ delay: 0.2 }}
       className="text-4xl font-black tracking-tight relative z-10 drop-shadow-lg"
     >
       {user.fullName}
     </motion.h2>
     
     <motion.p 
       initial={{ opacity: 0 }}
       animate={{ opacity: 1 }}
       transition={{ delay: 0.3 }}
       className="text-emerald-100/60 mt-3 font-semibold tracking-wide relative z-10"
     >
       {user.email}
     </motion.p>
  </div>
));

interface InfoGridProps {
  user: any;
  isRTL: boolean;
  t: any;
  formatDate: (d: any) => string;
}

const InfoGrid: React.FC<InfoGridProps> = React.memo(({ user, isRTL, t, formatDate }) => {
  const items = [
    { label: t.passport, value: user.passportNumber?.replace(/./g, '*') || '****' },
    { label: isRTL ? 'رقم الهاتف' : 'Phone Number', value: user.phoneNumber || (isRTL ? 'غير متوفر' : 'Not provided') },
    { label: isRTL ? 'الجنس' : 'Gender', value: user.gender === 'male' ? (isRTL ? 'ذكر' : 'Male') : (user.gender === 'female' ? (isRTL ? 'أنثى' : 'Female') : (user.gender === 'prefer-not-to-say' ? (isRTL ? 'أفضل عدم الذكر' : 'Prefer not to say') : (isRTL ? 'غير محدد' : 'Not specified'))) },
    { label: isRTL ? 'تاريخ الميلاد' : 'Date of Birth', value: formatDate(user.dob) || (isRTL ? 'غير محدد' : 'Not specified') },
    { label: isRTL ? 'الجنسية' : 'Nationality', value: user.nationality || (isRTL ? 'غير محدد' : 'Not specified') },
    { label: isRTL ? 'البريد الإلكتروني' : 'Email Address', value: user.email }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {items.map((item, idx) => (
        <motion.div 
          key={idx}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 + (idx * 0.05) }}
          className="p-5 rounded-3xl bg-white/50 dark:bg-[#0f1f1a]/50 border border-white/20 dark:border-emerald-900/20 shadow-sm hover:shadow-md transition-all group"
        >
           <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-1 group-hover:text-emerald-500 transition-colors">{item.label}</p>
           <p className="font-bold text-slate-800 dark:text-slate-100 text-lg">{item.value}</p>
        </motion.div>
      ))}
    </div>
  );
});

const ProfileSection: React.FC<ProfileSectionProps> = ({ user, items, lostItems, onUpdateItem, onDeleteItem, onDeleteLostItem, onLogout, onUpdateUser, lang, token, initialView }) => {
  const t = translations[lang];
  const isRTL = lang === 'ar' || lang === 'ur' || lang === 'fa';
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [view, setView] = useState<'INFO' | 'SETTINGS' | 'REPORTS'>(initialView || 'INFO');
  const [editingReport, setEditingReport] = useState<FoundItem | null>(null);
  const [viewerImages, setViewerImages] = useState<string[] | null>(null);
  const [viewerIndex, setViewerIndex] = useState(0);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!editingReport) return;
    const files = Array.from(e.target.files || []);
    const currentImages = editingReport.imageUrls || (editingReport.imageUrl ? [editingReport.imageUrl] : []);
    const remainingSlots = 10 - currentImages.length;
    const filesToProcess = files.slice(0, remainingSlots);

    for (const fileObj of filesToProcess) {
      const file = fileObj as File;
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        setEditingReport(prev => {
          if (!prev) return null;
          const imgs = prev.imageUrls || (prev.imageUrl ? [prev.imageUrl] : []);
          const newImgs = [...imgs, base64];
          return {
            ...prev,
            imageUrl: newImgs[0],
            imageUrls: newImgs
          };
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = (index: number) => {
    setEditingReport(prev => {
      if (!prev) return null;
      const imgs = prev.imageUrls || (prev.imageUrl ? [prev.imageUrl] : []);
      const newImgs = imgs.filter((_, i) => i !== index);
      return {
        ...prev,
        imageUrl: newImgs[0] || '',
        imageUrls: newImgs
      };
    });
  };
  const [editData, setEditData] = useState({
    fullName: user.fullName,
    email: user.email,
    phoneNumber: user.phoneNumber || '',
    gender: user.gender || '' as any,
    nationality: user.nationality || '',
    dob: user.dob || ''
  });
  const [isSaving, setIsSaving] = useState(false);
  
  // Password Change states
  const [isPasswordChanging, setIsPasswordChanging] = useState(false);
  const [passwords, setPasswords] = useState({
    current: '',
    new: '',
    confirm: ''
  });

  // Phone Verification states
  const [isVerifying, setIsVerifying] = useState(false);
  const [otp, setOtp] = useState('');
  const [isOtpSent, setIsOtpSent] = useState(false);
  const [tempPhone, setTempPhone] = useState(user.phoneNumber || '');
  const [phoneVerified, setPhoneVerified] = useState(true);
  const [isPhoneEditing, setIsPhoneEditing] = useState(false);

  // Email Verification states
  const [isEmailVerifying, setIsEmailVerifying] = useState(false);
  const [emailOtp, setEmailOtp] = useState('');
  const [isEmailOtpSent, setIsEmailOtpSent] = useState(false);
  const [tempEmail, setTempEmail] = useState(user.email);
  const [emailVerified, setEmailVerified] = useState(true);
  const [isEmailEditing, setIsEmailEditing] = useState(false);
  const [alertMessage, setAlertMessage] = useState<{ type: 'success' | 'error' | 'info', text: string } | null>(null);
  const [confirmModal, setConfirmModal] = useState<{ text: string, onConfirm: () => void } | null>(null);

  const validatePassword = (pass: string) => {
    const hasUpper = /[A-Z]/.test(pass);
    const hasNumber = /[0-9]/.test(pass);
    const hasSymbol = /[!@#$%^&*(),.?":{}|<>]/.test(pass);
    const isLongEnough = pass.length >= 8;
    return hasUpper && hasNumber && hasSymbol && isLongEnough;
  };

  const handleSave = () => {
    if (isPhoneEditing && !phoneVerified) {
      setAlertMessage({ type: 'error', text: isRTL ? 'يرجى التحقق من رقم الهاتف الجديد أولاً' : 'Please verify your new phone number first' });
      return;
    }
    if (isEmailEditing && !emailVerified) {
      setAlertMessage({ type: 'error', text: isRTL ? 'يرجى التحقق من البريد الإلكتروني الجديد أولاً' : 'Please verify your new email address first' });
      return;
    }
    if (isPasswordChanging) {
      if (!passwords.current) {
        setAlertMessage({ type: 'error', text: isRTL ? 'يرجى إدخال كلمة المرور الحالية' : 'Please enter current password' });
        return;
      }
      if (!validatePassword(passwords.new)) {
        setAlertMessage({ type: 'error', text: t.passwordRequirement });
        return;
      }
      if (passwords.new !== passwords.confirm) {
        setAlertMessage({ type: 'error', text: t.passwordMismatch });
        return;
      }
    }

    setIsSaving(true);
    
    const updateData: any = {
      ...editData,
      email: tempEmail,
      phoneNumber: tempPhone
    };

    if (isPasswordChanging) {
      updateData.currentPassword = passwords.current;
      updateData.newPassword = passwords.new;
    }

    fetch(API_BASE + '/api/user/profile', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(updateData)
    })
    .then(async (res) => {
      const data = await res.json();
      if (res.ok) {
        if (onUpdateUser) {
          onUpdateUser(data.user);
          // Update local storage too
          localStorage.setItem('user_data', JSON.stringify(data.user));
        }
        setIsSaving(false);
        setView('INFO');
        setIsPasswordChanging(false);
        setIsEmailEditing(false);
        setIsPhoneEditing(false);
        setPasswords({ current: '', new: '', confirm: '' });
        setAlertMessage({ type: 'success', text: isRTL ? 'تم حفظ التغييرات بنجاح' : 'Changes saved successfully' });
      } else {
        setIsSaving(false);
        let errorText = data.message || (isRTL ? 'حدث خطأ ما' : 'Something went wrong');
        if (data.message === 'Incorrect current password') {
          errorText = t.incorrectPassword;
        }
        setAlertMessage({ type: 'error', text: errorText });
      }
    })
    .catch((err) => {
      console.error('Failed to save profile:', err);
      setIsSaving(false);
      setAlertMessage({ type: 'error', text: isRTL ? 'خطأ في الاتصال بالخادم' : 'Server connection error' });
    });
  };

  const sendOtp = () => {
    if (!tempPhone) return;
    setIsVerifying(true);
    setTimeout(() => {
      setIsOtpSent(true);
      setIsVerifying(false);
    }, 1000);
  };

  const verifyOtp = () => {
    if (otp === '1234') { // Simulated correct OTP
      setPhoneVerified(true);
      setIsOtpSent(false);
      setEditData(prev => ({ ...prev, phoneNumber: tempPhone }));
      setAlertMessage({ type: 'success', text: isRTL ? 'تم التحقق من رقم الهاتف' : 'Phone number verified' });
    } else {
      setAlertMessage({ type: 'error', text: isRTL ? 'رمز التحقق غير صحيح' : 'Invalid verification code' });
    }
  };

  const sendEmailOtp = () => {
    if (!tempEmail) return;
    setIsEmailVerifying(true);
    setTimeout(() => {
      setIsEmailOtpSent(true);
      setIsEmailVerifying(false);
    }, 1000);
  };

  const verifyEmailOtp = () => {
    if (emailOtp === '1234') { // Simulated correct OTP
      setEmailVerified(true);
      setIsEmailOtpSent(false);
      setEditData(prev => ({ ...prev, email: tempEmail }));
      setAlertMessage({ type: 'success', text: isRTL ? 'تم التحقق من البريد الإلكتروني' : 'Email address verified' });
    } else {
      setAlertMessage({ type: 'error', text: isRTL ? 'رمز التحقق غير صحيح' : 'Invalid verification code' });
    }
  };

  const myReports = React.useMemo(() => {
    return items.filter(item => 
      item.submittedBy === (user as any).passportNumber || 
      item.submittedBy === (user as any).username
    ).sort((a, b) => 
      new Date(b.createdAt || b.dateFound).getTime() - 
      new Date(a.createdAt || a.dateFound).getTime()
    );
  }, [items, user]);

  const myLostReports = React.useMemo(() => {
    return lostItems.filter(item => 
      item.userId === (user as any).passportNumber || 
      item.userId === user.email
    ).sort((a, b) => 
      new Date(b.createdAt || b.dateLost || '').getTime() - 
      new Date(a.createdAt || a.dateLost || '').getTime()
    );
  }, [lostItems, user]);

  const handleUpdateReport = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingReport) {
      onUpdateItem(editingReport);
      setEditingReport(null);
    }
  };

  const handleDeleteReport = (id: string) => {
    setConfirmModal({
      text: isRTL ? 'هل أنت متأكد من طلب حذف هذا البلاغ؟ سيتم إرسال الطلب للمشرف للموافقة.' : 'Are you sure you want to request deletion of this report? The request will be sent to the admin for approval.',
      onConfirm: () => {
        onDeleteItem(id);
        setConfirmModal(null);
      }
    });
  };

  return (
    <div className={`min-h-screen py-12 px-4 relative overflow-hidden ${isRTL ? 'text-right' : 'text-left'}`}>
      {/* Silky Background Elements */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-500/5 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-emerald-700/5 rounded-full blur-[120px]"></div>
        <div className="absolute top-[30%] right-[10%] w-[30%] h-[30%] bg-amber-500/5 rounded-full blur-[100px]"></div>
      </div>

      <div className="max-w-2xl mx-auto relative z-10">
      {/* Image Viewer */}
      {viewerImages && (
        <ImageViewer
          images={viewerImages}
          initialIndex={viewerIndex}
          onClose={() => setViewerImages(null)}
          isRTL={isRTL}
        />
      )}
      {/* Custom Alert Toast */}
      <AnimatePresence>
        {alertMessage && (
          <motion.div 
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.9 }}
            className={`fixed bottom-8 left-1/2 -translate-x-1/2 z-[200] px-6 py-4 rounded-2xl shadow-2xl flex items-center space-x-3 rtl:space-x-reverse border backdrop-blur-xl ${
              alertMessage.type === 'success' ? 'bg-emerald-500/90 border-emerald-400 text-white' : 
              alertMessage.type === 'error' ? 'bg-rose-500/90 border-rose-400 text-white' : 
              'bg-slate-800/90 border-slate-700 text-white'
            }`}
          >
            <i className={`fas ${
              alertMessage.type === 'success' ? 'fa-check-circle' : 
              alertMessage.type === 'error' ? 'fa-exclamation-circle' : 
              'fa-info-circle'
            }`}></i>
            <span className="font-bold text-sm">{alertMessage.text}</span>
            <button onClick={() => setAlertMessage(null)} className="ml-4 p-1 hover:bg-white/20 rounded-lg transition-colors">
              <i className="fas fa-times text-xs"></i>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Custom Confirm Modal */}
      <AnimatePresence>
        {confirmModal && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white dark:bg-[#061410] w-full max-w-sm rounded-[32px] shadow-2xl overflow-hidden border border-slate-200 dark:border-emerald-900/20 p-8 text-center"
            >
              <div className="w-16 h-16 bg-rose-500/10 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <i className="fas fa-exclamation-triangle text-2xl"></i>
              </div>
              <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-4">{isRTL ? 'تأكيد الإجراء' : 'Confirm Action'}</h3>
              <p className="text-slate-500 dark:text-slate-400 text-sm mb-8 leading-relaxed">{confirmModal.text}</p>
              <div className="flex space-x-3 rtl:space-x-reverse">
                <button 
                  onClick={() => setConfirmModal(null)}
                  className="flex-1 py-4 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-200 transition-all"
                >
                  {t.cancel}
                </button>
                <button 
                  onClick={confirmModal.onConfirm}
                  className="flex-1 py-4 rounded-2xl bg-rose-500 text-white font-bold hover:bg-rose-600 transition-all shadow-lg shadow-rose-500/20"
                >
                  {isRTL ? 'تأكيد' : 'Confirm'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {view === 'SETTINGS' && (
          <motion.div
            key="settings"
            initial={{ opacity: 0, x: isRTL ? -20 : 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: isRTL ? -20 : 20 }}
            transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
            className="bg-white/60 dark:bg-[#162923]/60 backdrop-blur-lg rounded-[40px] shadow-2xl overflow-hidden border border-white/20 dark:border-emerald-900/20 transition-shadow duration-300"
          >
            <div className="bg-slate-900 dark:bg-[#061410] p-8 text-white flex items-center justify-between">
              <button 
                onClick={() => setView('INFO')}
                className="w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
              >
                <i className={`fas ${isRTL ? 'fa-chevron-right' : 'fa-chevron-left'}`}></i>
              </button>
              <h2 className="text-xl font-bold">{isRTL ? 'إعدادات الحساب' : 'Account Settings'}</h2>
              <div className="w-10"></div>
            </div>

            <div className="p-8 space-y-6">
              <div className="space-y-6">
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                >
                  <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-2 block">
                    {t.passport} ({isRTL ? 'للقراءة فقط' : 'Read Only'})
                  </label>
                  <div className="p-5 rounded-3xl bg-white/30 dark:bg-[#0f1f1a]/30 border border-white/20 dark:border-emerald-900/10 text-slate-500 font-medium">
                    {user.passportNumber}
                  </div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 }}
                >
                  <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-2 block">
                    {isRTL ? 'الاسم الكامل' : 'Full Name'}
                  </label>
                  <input 
                    type="text"
                    value={editData.fullName}
                    onChange={(e) => setEditData({ ...editData, fullName: e.target.value })}
                    className="w-full p-5 rounded-3xl bg-white/50 dark:bg-[#0f1f1a]/50 border border-white/20 dark:border-emerald-900/20 text-slate-800 dark:text-slate-100 focus:ring-4 focus:ring-emerald-500/20 outline-none transition-all font-semibold"
                  />
                </motion.div>

                <div className="grid grid-cols-2 gap-6">
                  <SilkySelect
                    label={isRTL ? 'الجنس' : 'Gender'}
                    value={editData.gender || ''}
                    onChange={(val) => setEditData({ ...editData, gender: val as any })}
                    placeholder={isRTL ? 'اختر الجنس' : 'Choose Gender'}
                    isRTL={isRTL}
                    options={[
                      { value: 'male', label: isRTL ? 'ذكر' : 'Male' },
                      { value: 'female', label: isRTL ? 'أنثى' : 'Female' },
                      { value: 'prefer-not-to-say', label: isRTL ? 'أفضل عدم الذكر' : 'Prefer not to say' }
                    ]}
                  />
                  <SilkyDateInput
                    label={isRTL ? 'تاريخ الميلاد' : 'Date of Birth'}
                    value={editData.dob || ''}
                    onChange={(val) => setEditData({ ...editData, dob: val })}
                    isRTL={isRTL}
                  />
                </div>

                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                >
                  <SilkyNationalitySelect
                    label={isRTL ? 'الجنسية' : 'Nationality'}
                    value={editData.nationality || ''}
                    onChange={(val) => setEditData({ ...editData, nationality: val })}
                    placeholder={isRTL ? 'اختر جنسيتك' : 'Choose your nationality'}
                    isRTL={isRTL}
                  />
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.35 }}
                >
                  <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-2 block">
                    {isRTL ? 'البريد الإلكتروني' : 'Email Address'}
                  </label>
                  <div className="flex space-x-3 rtl:space-x-reverse">
                    <div className="flex-grow p-5 rounded-3xl bg-white/30 dark:bg-[#0f1f1a]/30 border border-white/20 dark:border-emerald-900/10 text-slate-500 font-semibold">
                      {isEmailEditing ? (
                        <input 
                          type="email"
                          value={tempEmail}
                          autoFocus
                          onChange={(e) => {
                            setTempEmail(e.target.value);
                            setEmailVerified(e.target.value === user.email);
                          }}
                          className="w-full bg-transparent border-none outline-none text-slate-800 dark:text-slate-100"
                          placeholder={t.emailPlaceholder}
                        />
                      ) : (
                        user.email
                      )}
                    </div>
                    {!isEmailEditing ? (
                      <button 
                        onClick={() => setIsEmailEditing(true)}
                        className="px-8 bg-slate-900 dark:bg-emerald-900/40 text-white rounded-3xl font-black text-xs uppercase tracking-widest hover:bg-slate-800 transition-all shadow-lg"
                      >
                        {isRTL ? 'تغيير' : 'Change'}
                      </button>
                    ) : (
                      !emailVerified && (
                        <button 
                          onClick={sendEmailOtp}
                          disabled={isEmailVerifying || !tempEmail}
                          className="px-8 bg-emerald-600 text-white rounded-3xl font-black text-xs uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-lg disabled:opacity-50"
                        >
                          {isEmailVerifying ? <i className="fas fa-spinner fa-spin"></i> : (isRTL ? 'تحقق' : 'Verify')}
                        </button>
                      )
                    )}
                    {emailVerified && isEmailEditing && tempEmail !== user.email && (
                      <div className="px-4 flex items-center text-emerald-500">
                        <i className="fas fa-check-circle text-2xl"></i>
                      </div>
                    )}
                  </div>
                  
                  {isEmailOtpSent && isEmailEditing && (
                    <VerificationBox 
                      isRTL={isRTL}
                      label={isRTL ? 'أدخل الرمز المرسل لبريدك (استخدم 1234)' : 'Enter code sent to your email (use 1234)'}
                      otp={emailOtp}
                      setOtp={setEmailOtp}
                      onConfirm={verifyEmailOtp}
                    />
                  )}
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                >
                  <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-2 block">
                    {isRTL ? 'رقم الهاتف' : 'Phone Number'}
                  </label>
                  <div className="flex space-x-3 rtl:space-x-reverse">
                    <div className="flex-grow p-5 rounded-3xl bg-white/30 dark:bg-[#0f1f1a]/30 border border-white/20 dark:border-emerald-900/10 text-slate-500 font-semibold">
                      {isPhoneEditing ? (
                        <input 
                          type="tel"
                          value={tempPhone}
                          autoFocus
                          onChange={(e) => {
                            setTempPhone(e.target.value);
                            setPhoneVerified(e.target.value === user.phoneNumber);
                          }}
                          className="w-full bg-transparent border-none outline-none text-slate-800 dark:text-slate-100"
                          placeholder={isRTL ? 'أدخل رقم الهاتف' : 'Enter phone number'}
                        />
                      ) : (
                        user.phoneNumber || (isRTL ? 'غير متوفر' : 'Not provided')
                      )}
                    </div>
                    {!isPhoneEditing ? (
                      <button 
                        onClick={() => setIsPhoneEditing(true)}
                        className="px-8 bg-slate-900 dark:bg-emerald-900/40 text-white rounded-3xl font-black text-xs uppercase tracking-widest hover:bg-slate-800 transition-all shadow-lg"
                      >
                        {isRTL ? 'تغيير' : 'Change'}
                      </button>
                    ) : (
                      !phoneVerified && (
                        <button 
                          onClick={sendOtp}
                          disabled={isVerifying || !tempPhone}
                          className="px-8 bg-emerald-600 text-white rounded-3xl font-black text-xs uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-lg disabled:opacity-50"
                        >
                          {isVerifying ? <i className="fas fa-spinner fa-spin"></i> : (isRTL ? 'تحقق' : 'Verify')}
                        </button>
                      )
                    )}
                    {phoneVerified && isPhoneEditing && tempPhone !== user.phoneNumber && (
                      <div className="px-4 flex items-center text-emerald-500">
                        <i className="fas fa-check-circle text-2xl"></i>
                      </div>
                    )}
                  </div>
                  
                  {isOtpSent && isPhoneEditing && (
                    <VerificationBox 
                      isRTL={isRTL}
                      label={isRTL ? 'أدخل الرمز المرسل (استخدم 1234)' : 'Enter code sent (use 1234)'}
                      otp={otp}
                      setOtp={setOtp}
                      onConfirm={verifyOtp}
                    />
                  )}
                </motion.div>

                <div className="pt-6 border-t border-white/10">
                  {!isPasswordChanging ? (
                    <motion.button 
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setIsPasswordChanging(true)}
                      className="w-full p-5 rounded-3xl bg-white/30 dark:bg-emerald-900/10 border border-white/20 dark:border-emerald-900/20 text-slate-700 dark:text-slate-300 font-black text-xs uppercase tracking-widest hover:bg-white/40 dark:hover:bg-emerald-900/20 transition-all flex items-center justify-center space-x-3 rtl:space-x-reverse shadow-sm"
                    >
                      <i className="fas fa-lock text-emerald-500"></i>
                      <span>{isRTL ? 'تغيير كلمة المرور' : 'Change Password'}</span>
                    </motion.button>
                  ) : (
                      <PasswordChangeForm 
                        isRTL={isRTL}
                        t={t}
                        passwords={passwords}
                        setPasswords={setPasswords}
                        onCancel={() => setIsPasswordChanging(false)}
                      />
                  )}
                </div>
              </div>

              <motion.button 
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleSave}
                disabled={isSaving || (isPhoneEditing && !phoneVerified) || (isEmailEditing && !emailVerified)}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-6 rounded-3xl transition-all flex items-center justify-center space-x-3 rtl:space-x-reverse disabled:opacity-50 shadow-xl shadow-emerald-500/20 uppercase tracking-widest text-sm"
              >
                {isSaving ? (
                  <div className="w-6 h-6 border-3 border-white/30 border-t-white rounded-full animate-spin"></div>
                ) : (
                  <>
                    <i className="fas fa-save"></i>
                    <span>{isRTL ? 'حفظ التغييرات' : 'Save Changes'}</span>
                  </>
                )}
              </motion.button>
            </div>
          </motion.div>
        )}

        {view === 'REPORTS' && (
          <motion.div
            key="reports"
            initial={{ opacity: 0, x: isRTL ? -20 : 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: isRTL ? -20 : 20 }}
            transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
            className="bg-white/60 dark:bg-[#162923]/60 backdrop-blur-lg rounded-[40px] shadow-2xl overflow-hidden border border-white/20 dark:border-emerald-900/20 transition-shadow duration-300"
          >
            <div className="bg-slate-900 dark:bg-[#061410] p-8 text-white flex items-center justify-between">
              <button 
                onClick={() => setView('INFO')}
                className="w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
              >
                <i className={`fas ${isRTL ? 'fa-chevron-right' : 'fa-chevron-left'}`}></i>
              </button>
              <h2 className="text-xl font-bold">{isRTL ? 'بلاغاتي' : 'My Reports'}</h2>
              <div className="w-10"></div>
            </div>
            <div className="p-8 space-y-6">
              {myReports.length === 0 && myLostReports.length === 0 ? (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="p-12 text-center space-y-8"
                >
                  <div className="w-24 h-24 bg-slate-100/50 dark:bg-emerald-900/10 rounded-[32px] mx-auto flex items-center justify-center text-slate-300 dark:text-emerald-800/30">
                    <i className="fas fa-file-invoice text-4xl"></i>
                  </div>
                  <div className="space-y-3">
                    <h3 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tight">
                      {isRTL ? 'لا توجد بلاغات نشطة' : 'No Active Reports'}
                    </h3>
                    <p className="text-slate-500 dark:text-slate-400 font-medium">
                      {isRTL 
                        ? 'لم تقم بتقديم أي بلاغات حتى الآن.' 
                        : 'You haven\'t submitted any reports yet.'}
                    </p>
                  </div>
                  <motion.button 
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setView('INFO')}
                    className="px-10 py-4 bg-emerald-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-500/20"
                  >
                    {isRTL ? 'العودة للملف الشخصي' : 'Back to Profile'}
                  </motion.button>
                </motion.div>
              ) : (
                <div className="space-y-10">
                  {myReports.length > 0 && (
                    <div className="space-y-6">
                      <h3 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.3em] border-b border-white/10 pb-3">
                        {isRTL ? 'المعثورات' : 'Found Items'}
                      </h3>
                      <div className="space-y-4">
                        {myReports.map((report, idx) => (
                          <ReportItemCard 
                            key={report.id}
                            report={report}
                            type="found"
                            idx={idx}
                            isRTL={isRTL}
                            onViewImage={(imgs) => {
                              setViewerImages(imgs);
                              setViewerIndex(0);
                            }}
                            onEdit={setEditingReport}
                            onDelete={handleDeleteReport}
                            formatDate={formatDate}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {myLostReports.length > 0 && (
                    <div className="space-y-6">
                      <h3 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.3em] border-b border-white/10 pb-3">
                        {isRTL ? 'المفقودات' : 'Lost Items'}
                      </h3>
                      <div className="space-y-4">
                        {myLostReports.map((report, idx) => (
                          <ReportItemCard 
                            key={report.id}
                            report={report}
                            type="lost"
                            idx={myReports.length + idx}
                            isRTL={isRTL}
                            onViewImage={(imgs) => {
                              setViewerImages(imgs);
                              setViewerIndex(0);
                            }}
                            onDelete={(id) => setConfirmModal({
                              text: isRTL ? 'هل أنت متأكد من حذف هذا البلاغ؟' : 'Are you sure you want to delete this report?',
                              onConfirm: () => {
                                onDeleteLostItem(id);
                                setConfirmModal(null);
                              }
                            })}
                            formatDate={formatDate}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}

        {view === 'INFO' && (
          <motion.div
            key="info"
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
            className="bg-white/60 dark:bg-[#162923]/60 backdrop-blur-lg rounded-[40px] shadow-2xl overflow-hidden border border-white/20 dark:border-emerald-900/20 transition-shadow duration-300"
          >
            <ProfileInfoCard user={user} isRTL={isRTL} t={t} />

            <div className="p-10 space-y-8">
               <InfoGrid user={user} isRTL={isRTL} t={t} formatDate={formatDate} />

               <div className="space-y-4">
                  <motion.button 
                    initial={{ opacity: 0, x: isRTL ? 20 : -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.7 }}
                    onClick={() => setView('REPORTS')}
                    className="w-full flex items-center justify-between p-6 rounded-3xl bg-white/30 dark:bg-emerald-900/10 border border-white/20 dark:border-emerald-900/10 hover:bg-emerald-500/10 transition-all group rtl:flex-row-reverse"
                  >
                     <div className="flex items-center space-x-5 rtl:space-x-reverse">
                        <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform">
                          <i className="fas fa-file-invoice text-xl"></i>
                        </div>
                        <span className="font-bold text-slate-700 dark:text-slate-200 text-lg">{isRTL ? 'بلاغاتي' : 'My Reports'}</span>
                     </div>
                     <i className={`fas ${isRTL ? 'fa-chevron-left group-hover:-translate-x-2' : 'fa-chevron-right group-hover:translate-x-2'} text-slate-300 dark:text-slate-600 transition-all`}></i>
                  </motion.button>

                  <motion.button 
                    initial={{ opacity: 0, x: isRTL ? 20 : -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.8 }}
                    onClick={() => setView('SETTINGS')}
                    className="w-full flex items-center justify-between p-6 rounded-3xl bg-white/30 dark:bg-emerald-900/10 border border-white/20 dark:border-emerald-900/10 hover:bg-emerald-500/10 transition-all group rtl:flex-row-reverse"
                  >
                     <div className="flex items-center space-x-5 rtl:space-x-reverse">
                        <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800/50 flex items-center justify-center text-slate-400 dark:text-slate-500 group-hover:scale-110 transition-transform">
                          <i className="fas fa-cog text-xl"></i>
                        </div>
                        <span className="font-bold text-slate-700 dark:text-slate-200 text-lg">{isRTL ? 'إعدادات الحساب' : 'Account Settings'}</span>
                     </div>
                     <i className={`fas ${isRTL ? 'fa-chevron-left group-hover:-translate-x-2' : 'fa-chevron-right group-hover:translate-x-2'} text-slate-300 dark:text-slate-600 transition-all`}></i>
                  </motion.button>
               </div>

               <motion.button 
                 initial={{ opacity: 0, y: 20 }}
                 animate={{ opacity: 1, y: 0 }}
                 transition={{ delay: 0.9 }}
                 onClick={onLogout}
                 className="w-full bg-rose-500/10 hover:bg-rose-500 text-rose-600 hover:text-white font-black py-6 rounded-3xl transition-all flex items-center justify-center space-x-3 rtl:space-x-reverse border border-rose-500/20 group shadow-lg shadow-rose-500/5"
               >
                  <i className="fas fa-sign-out-alt group-hover:rotate-12 transition-transform"></i>
                  <span>{t.logout}</span>
               </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {editingReport && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white dark:bg-[#061410] w-full max-w-lg rounded-[32px] shadow-2xl overflow-hidden border border-slate-200 dark:border-emerald-900/20"
            >
              <div className="p-6 border-b border-slate-100 dark:border-emerald-900/10 flex items-center justify-between bg-slate-50/50 dark:bg-emerald-950/10">
                <div className="flex items-center space-x-3 rtl:space-x-reverse">
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600">
                    <i className="fas fa-edit text-xl"></i>
                  </div>
                  <h3 className="text-xl font-bold text-slate-800 dark:text-white">{isRTL ? 'تعديل البلاغ' : 'Edit Report'}</h3>
                </div>
                <button onClick={() => setEditingReport(null)} className="p-2 text-slate-400 hover:text-slate-800 dark:hover:text-white transition-colors">
                  <i className="fas fa-times text-xl"></i>
                </button>
              </div>

              <form onSubmit={handleUpdateReport} className="p-8 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
                <div className="space-y-4">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                    {t.itemImage} ({(editingReport.imageUrls || (editingReport.imageUrl ? [editingReport.imageUrl] : [])).length}/10)
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(editingReport.imageUrls || (editingReport.imageUrl ? [editingReport.imageUrl] : [])).map((img, idx) => (
                      <div key={idx} className="relative aspect-square rounded-xl overflow-hidden group border border-slate-200 dark:border-emerald-900/20">
                        <img src={img} alt="" className="w-full h-full object-cover" />
                        <button 
                          type="button"
                          onClick={() => removeImage(idx)}
                          className="absolute top-1 right-1 w-5 h-5 bg-rose-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <i className="fas fa-times text-[8px]"></i>
                        </button>
                      </div>
                    ))}
                    {(editingReport.imageUrls || (editingReport.imageUrl ? [editingReport.imageUrl] : [])).length < 10 && (
                      <button 
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="aspect-square rounded-xl border-2 border-dashed border-slate-200 dark:border-emerald-900/20 flex flex-col items-center justify-center hover:border-emerald-500 transition-colors"
                      >
                        <i className="fas fa-plus text-slate-400"></i>
                      </button>
                    )}
                  </div>
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleImageUpload} 
                    accept="image/*" 
                    multiple 
                    className="hidden" 
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">{t.itemName}</label>
                  <input 
                    type="text"
                    required
                    value={editingReport.name}
                    onChange={(e) => setEditingReport({...editingReport, name: e.target.value})}
                    className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-emerald-950/20 border border-slate-200 dark:border-emerald-900/20 focus:ring-2 focus:ring-emerald-500 outline-none transition-all text-sm"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">{t.itemDesc}</label>
                  <textarea 
                    required
                    rows={4}
                    value={editingReport.description}
                    onChange={(e) => setEditingReport({...editingReport, description: e.target.value})}
                    className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-emerald-950/20 border border-slate-200 dark:border-emerald-900/20 focus:ring-2 focus:ring-emerald-500 outline-none transition-all text-sm resize-none"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">{isRTL ? 'الموقع على الخريطة' : 'Location on Map'}</label>
                  <MapPicker 
                    city={editingReport.city} 
                    lang={lang}
                    onCityChange={(newCity) => setEditingReport({...editingReport, city: newCity})}
                    onLocationSelect={(lat, lng) => setEditingReport({...editingReport, coordinates: lat ? { lat, lng } : undefined})}
                  />
                </div>

                <div className="pt-4 flex space-x-4 rtl:space-x-reverse">
                  <button
                    type="button"
                    onClick={() => setEditingReport(null)}
                    className="flex-1 px-6 py-4 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold rounded-2xl hover:bg-slate-200 transition-all"
                  >
                    {t.cancel}
                  </button>
                  <button
                    type="submit"
                    className="flex-[2] px-6 py-4 bg-emerald-700 text-white font-bold rounded-2xl shadow-xl shadow-emerald-900/20 hover:bg-emerald-800 transition-all flex items-center justify-center space-x-2 rtl:space-x-reverse"
                  >
                    <i className="fas fa-save"></i>
                    <span>{isRTL ? 'حفظ التعديلات' : 'Save Changes'}</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <p className="text-center text-xs text-slate-400 mt-8 leading-relaxed px-8">
        {isRTL 
          ? 'سيؤدي تسجيل الخروج إلى مسح جلستك. يتم تشفير بياناتك وحفظها ضمن أنظمة وزارة الحج والعمرة.'
          : 'Logging out will clear your session. Your data is encrypted and saved under the Ministry of Hajj & Umrah systems.'}
      </p>
    </div>
  </div>
);
};

export default ProfileSection;
