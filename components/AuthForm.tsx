import { API_BASE } from '../apiConfig';

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { User, Language, AuthenticatedUser } from '../types';
import { translations } from '../translations';
import { COUNTRIES } from '../constants';

import { SilkySelect, SilkyDateInput, SilkyNationalitySelect } from './SilkyInputs';

interface AuthFormProps {
  onLogin: (token: string, user: AuthenticatedUser) => void;
  lang: Language;
  isAdmin?: boolean;
}

const AuthForm: React.FC<AuthFormProps> = ({ onLogin, lang, isAdmin = false }) => {
  const t = translations[lang];
  const [mode, setMode] = useState<'LOGIN' | 'SIGNUP' | 'FORGOT_PASSWORD' | 'OTP' | 'NEW_PASSWORD'>('LOGIN');
  const [formData, setFormData] = useState({
    fullName: '',
    passportNumber: '',
    email: '',
    phoneNumber: '',
    password: '',
    identifier: '', // For login
    otp: '',
    newPassword: '',
    confirmPassword: '',
    gender: '' as any,
    nationality: '',
    dob: ''
  });
  const [error, setError] = useState<string | null>(null);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [resetMethod, setResetMethod] = useState<'email' | 'phone'>('email');
  const [selectedCountry, setSelectedCountry] = useState(COUNTRIES[0]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setError(null);
    setErrorKey(null);
    if (isAdmin) {
      setMode('LOGIN');
    }
  }, [mode, isAdmin]); // Removed lang from here to keep error visible but updateable

  // Update error message when language changes if we have an errorKey
  useEffect(() => {
    if (errorKey === 'INVALID_CREDENTIALS') {
      setError(isAdmin ? t.invalidCredentialsAdmin : t.invalidCredentialsUser);
    } else if (errorKey === 'PASSWORD_MISMATCH') {
      setError(t.passwordMismatch);
    } else if (errorKey === 'PASSWORD_REQUIREMENT') {
      setError(t.passwordRequirement);
    }
  }, [lang, errorKey, t]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
        setCountrySearch('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleDropdownKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsDropdownOpen(false);
      setCountrySearch('');
    } else if (e.key.length === 1 && /[a-zA-Z]/.test(e.key) && !isDropdownOpen) {
      setIsDropdownOpen(true);
      setCountrySearch(e.key);
    }
  };

  const validatePassword = (pass: string) => {
    const hasUpperCase = /[A-Z]/.test(pass);
    const hasLowerCase = /[a-z]/.test(pass);
    const hasNumber = /[0-9]/.test(pass);
    const hasSymbol = /[!@#$%^&*(),.?":{}|<>]/.test(pass);
    const isLongEnough = pass.length >= 8;
    return hasUpperCase && hasLowerCase && hasNumber && hasSymbol && isLongEnough;
  };

  const PasswordRequirements = ({ password }: { password: string }) => {
    const requirements = [
      { label: t.reqMinChars, met: password.length >= 8 },
      { label: t.reqUpper, met: /[A-Z]/.test(password) },
      { label: t.reqLower, met: /[a-z]/.test(password) },
      { label: t.reqNumber, met: /[0-9]/.test(password) },
      { label: t.reqSymbol, met: /[!@#$%^&*(),.?":{}|<>]/.test(password) },
    ];

    return (
      <div className="mt-3 space-y-2 bg-slate-100/50 dark:bg-emerald-950/20 p-3 rounded-xl border border-slate-200 dark:border-emerald-900/10">
        {requirements.map((req, index) => (
          <div key={index} className="flex items-center space-x-2 rtl:space-x-reverse">
            <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] transition-all ${req.met ? 'bg-emerald-500 text-white' : 'bg-slate-300 dark:bg-slate-700 text-transparent'}`}>
              <i className="fas fa-check"></i>
            </div>
            <span className={`text-xs transition-colors ${req.met ? 'text-emerald-600 dark:text-emerald-400 font-medium' : 'text-slate-500 dark:text-slate-500'}`}>
              {req.label}
            </span>
          </div>
        ))}
      </div>
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (mode === 'NEW_PASSWORD' || mode === 'SIGNUP') {
      const passwordToValidate = mode === 'NEW_PASSWORD' ? formData.newPassword : formData.password;
      if (passwordToValidate !== formData.confirmPassword) {
        setErrorKey('PASSWORD_MISMATCH');
        setError(t.passwordMismatch);
        return;
      }
      if (!validatePassword(passwordToValidate)) {
        setErrorKey('PASSWORD_REQUIREMENT');
        setError(t.passwordRequirement);
        return;
      }
    }

    setLoading(true);
    
    try {
      if (mode === 'LOGIN') {
        const response = await fetch(API_BASE + '/api/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: formData.identifier,
            password: formData.password,
            isAdmin: isAdmin
          })
        });

        if (response.ok) {
          const data = await response.json();
          onLogin(data.token, data.user);
        } else {
          const data = await response.json();
          if (data.message === 'Invalid credentials') {
            setErrorKey('INVALID_CREDENTIALS');
            setError(isAdmin ? t.invalidCredentialsAdmin : t.invalidCredentialsUser);
          } else {
            setError(data.message || (isAdmin ? t.invalidCredentialsAdmin : t.invalidCredentialsUser));
            setErrorKey(null);
          }
          setLoading(false);
        }
      } else if (mode === 'SIGNUP') {
        const fullPhoneNumber = `${selectedCountry.code}${formData.phoneNumber}`;
        const response = await fetch(API_BASE + '/api/signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: formData.fullName, // Using full name as username for now, or could use passport
            password: formData.password,
            fullName: formData.fullName,
            email: formData.email,
            passportNumber: formData.passportNumber,
            phoneNumber: fullPhoneNumber,
            gender: formData.gender,
            nationality: formData.nationality,
            dob: formData.dob
          })
        });

        if (response.ok) {
          const data = await response.json();
          onLogin(data.token, data.user);
        } else {
          const data = await response.json();
          setError(data.message || 'Signup failed. Please try again.');
        }
        setLoading(false);
        return;
      } else {
        // Handle other modes (forgot password etc) with mock for now
        setTimeout(() => {
          if (mode === 'FORGOT_PASSWORD') setMode('OTP');
          else if (mode === 'OTP') setMode('NEW_PASSWORD');
          else if (mode === 'NEW_PASSWORD') setMode('LOGIN');
          setLoading(false);
        }, 1000);
        return;
      }
    } catch (err) {
      console.error('Auth error:', err);
      setError('Connection error. Please try again.');
    } finally {
      if (mode === 'LOGIN') setLoading(false);
    }
  };

  const getTitle = () => {
    switch(mode) {
      case 'LOGIN': return t.loginTitle;
      case 'SIGNUP': return t.signupTitle;
      case 'FORGOT_PASSWORD': return t.resetTitle;
      case 'OTP': return t.otpTitle;
      case 'NEW_PASSWORD': return t.newPasswordTitle;
      default: return t.loginTitle;
    }
  };

  const getSubTitle = () => {
    switch(mode) {
      case 'FORGOT_PASSWORD': return t.resetSub;
      case 'OTP': return t.otpSub?.replace('{method}', formData.identifier || '') || '';
      case 'NEW_PASSWORD': return t.newPasswordSub;
      default: return t.verifySub;
    }
  };

  return (
    <div className="relative">
      {/* Decorative background elements */}
      <div className="absolute -top-20 -left-20 w-64 h-64 bg-emerald-500/10 rounded-full blur-[100px] pointer-events-none"></div>
      <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-emerald-700/10 rounded-full blur-[100px] pointer-events-none"></div>

      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
        className="bg-white/40 dark:bg-[#162923]/40 backdrop-blur-2xl rounded-[40px] shadow-2xl overflow-hidden border border-white/20 dark:border-emerald-900/20 transition-all duration-300 relative z-10"
      >
        <div className="p-10">
          <div className="text-center mb-12">
            <AnimatePresence mode="wait">
              <motion.div
                key={mode}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                transition={{ duration: 0.3 }}
              >
                <h2 className="text-3xl font-black text-slate-800 dark:text-white uppercase tracking-tight">
                  {getTitle()}
                </h2>
                <p className="text-slate-500 dark:text-slate-400 mt-3 font-medium">{getSubTitle()}</p>
              </motion.div>
            </AnimatePresence>
          </div>

          <form onSubmit={handleSubmit} className="space-y-8">
            <AnimatePresence mode="wait">
              <motion.div
                key={mode}
                initial={{ opacity: 0, x: mode === 'LOGIN' ? -20 : 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: mode === 'LOGIN' ? 20 : -20 }}
                transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
                className="space-y-6"
              >
                {mode === 'SIGNUP' && (
                  <>
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                      <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-2 block">{t.fullName}</label>
                      <input
                        required
                        type="text"
                        placeholder={t.fullNamePlaceholder}
                        className="w-full p-5 rounded-3xl bg-white/50 dark:bg-[#0f1f1a]/50 border border-white/20 dark:border-emerald-900/20 text-slate-800 dark:text-slate-100 focus:ring-4 focus:ring-emerald-500/20 outline-none transition-all font-semibold placeholder:text-slate-400 dark:placeholder:text-slate-600"
                        value={formData.fullName}
                        onChange={(e) => setFormData({...formData, fullName: e.target.value})}
                      />
                    </motion.div>
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
                      <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-2 block">{t.email}</label>
                      <input
                        required
                        type="email"
                        placeholder={t.emailPlaceholder}
                        className="w-full p-5 rounded-3xl bg-white/50 dark:bg-[#0f1f1a]/50 border border-white/20 dark:border-emerald-900/20 text-slate-800 dark:text-slate-100 focus:ring-4 focus:ring-emerald-500/20 outline-none transition-all font-semibold placeholder:text-slate-400 dark:placeholder:text-slate-600"
                        value={formData.email}
                        onChange={(e) => setFormData({...formData, email: e.target.value})}
                      />
                    </motion.div>
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                      <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-2 block">{t.phone}</label>
                      <div className="flex space-x-3 rtl:space-x-reverse">
                        <div className="relative" ref={dropdownRef}>
                          <button
                            type="button"
                            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                            onKeyDown={handleDropdownKeyDown}
                            className="h-full px-5 py-5 rounded-3xl border border-white/20 dark:border-emerald-900/20 bg-white/50 dark:bg-[#0f1f1a]/50 text-slate-800 dark:text-slate-100 flex items-center space-x-3 rtl:space-x-reverse min-w-[120px] justify-between focus:ring-4 focus:ring-emerald-500/20 outline-none transition-all shadow-sm"
                          >
                            <span className="flex items-center space-x-3 rtl:space-x-reverse">
                              <img 
                                src={selectedCountry.name === 'Afghanistan' ? 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5c/Flag_of_the_Taliban.svg/40px-Flag_of_the_Taliban.svg.png' : `https://flagcdn.com/w20/${selectedCountry.iso}.png`} 
                                alt={selectedCountry.name}
                                className="w-6 h-auto rounded-sm shadow-sm"
                                referrerPolicy="no-referrer"
                              />
                              <span className="text-sm font-black tracking-tight">{selectedCountry.code}</span>
                            </span>
                            <i className={`fas fa-chevron-down text-[10px] transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`}></i>
                          </button>

                          <AnimatePresence>
                            {isDropdownOpen && (
                              <motion.div 
                                initial={{ opacity: 0, y: -10, scale: 0.95 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: -10, scale: 0.95 }}
                                className="absolute top-full left-0 right-0 mt-4 bg-white/90 dark:bg-[#162923]/90 backdrop-blur-2xl border border-white/20 dark:border-emerald-900/20 rounded-[32px] shadow-2xl z-50 min-w-[280px] flex flex-col overflow-hidden"
                              >
                                <div className="p-4 sticky top-0 bg-white/50 dark:bg-[#162923]/50 border-b border-white/10 dark:border-emerald-900/10 z-10">
                                  <div className="relative">
                                    <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
                                    <input
                                      type="text"
                                      autoFocus
                                      placeholder={lang === 'ar' ? 'ابحث عن الدولة...' : 'Search country...'}
                                      className="w-full pl-10 pr-5 py-3 rounded-2xl bg-white/50 dark:bg-[#0f1f1a]/50 text-sm text-slate-800 dark:text-white outline-none focus:ring-4 focus:ring-emerald-500/20 transition-all placeholder:text-slate-400"
                                      value={countrySearch}
                                      onChange={(e) => setCountrySearch(e.target.value)}
                                    />
                                  </div>
                                </div>
                                <div className="max-h-64 overflow-y-auto custom-scrollbar p-2">
                                  {COUNTRIES.filter(c => 
                                    c.name?.toLowerCase()?.startsWith(countrySearch.toLowerCase()) || 
                                    c.code.includes(countrySearch)
                                  ).map((country) => (
                                    <button
                                      key={country.name}
                                      type="button"
                                      onClick={() => {
                                        setSelectedCountry(country);
                                        setIsDropdownOpen(false);
                                        setCountrySearch('');
                                      }}
                                      className="w-full px-4 py-4 text-left rtl:text-right hover:bg-emerald-500/10 dark:hover:bg-emerald-900/40 rounded-2xl flex items-center justify-between transition-all group"
                                    >
                                      <span className="flex items-center space-x-4 rtl:space-x-reverse">
                                        <img 
                                          src={country.name === 'Afghanistan' ? 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5c/Flag_of_the_Taliban.svg/40px-Flag_of_the_Taliban.svg.png' : `https://flagcdn.com/w40/${country.iso}.png`} 
                                          alt={country.name}
                                          className="w-8 h-auto rounded-md shadow-sm group-hover:scale-110 transition-transform"
                                          referrerPolicy="no-referrer"
                                        />
                                        <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{country.name}</span>
                                      </span>
                                      <span className="text-xs font-black text-emerald-600 dark:text-emerald-500">{country.code}</span>
                                    </button>
                                  ))}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                        
                        <input
                          required
                          type="tel"
                          placeholder="50 123 4567"
                          className="flex-grow p-5 rounded-3xl bg-white/50 dark:bg-[#0f1f1a]/50 border border-white/20 dark:border-emerald-900/20 text-slate-800 dark:text-slate-100 focus:ring-4 focus:ring-emerald-500/20 outline-none transition-all font-semibold placeholder:text-slate-400 dark:placeholder:text-slate-600 shadow-sm"
                          value={formData.phoneNumber}
                          onChange={(e) => setFormData({...formData, phoneNumber: e.target.value?.replace(/\D/g, '') || ''})}
                        />
                      </div>
                    </motion.div>
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
                      <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-2 block">{t.passport}</label>
                      <input
                        required
                        type="text"
                        placeholder={t.passportPlaceholder}
                        className="w-full p-5 rounded-3xl bg-white/50 dark:bg-[#0f1f1a]/50 border border-white/20 dark:border-emerald-900/20 text-slate-800 dark:text-slate-100 focus:ring-4 focus:ring-emerald-500/20 outline-none transition-all font-semibold placeholder:text-slate-400 dark:placeholder:text-slate-600"
                        value={formData.passportNumber}
                        onChange={(e) => setFormData({...formData, passportNumber: e.target.value})}
                      />
                    </motion.div>
                    <div className="grid grid-cols-2 gap-6">
                      <SilkySelect
                        label={lang === 'ar' ? 'الجنس' : 'Gender'}
                        value={formData.gender || ''}
                        onChange={(val) => setFormData({...formData, gender: val as any})}
                        placeholder={lang === 'ar' ? 'اختر الجنس' : 'Choose Gender'}
                        isRTL={lang === 'ar'}
                        options={[
                          { value: 'male', label: lang === 'ar' ? 'ذكر' : 'Male' },
                          { value: 'female', label: lang === 'ar' ? 'أنثى' : 'Female' },
                          { value: 'prefer-not-to-say', label: lang === 'ar' ? 'أفضل عدم الذكر' : 'Prefer not to say' }
                        ]}
                      />
                      <SilkyDateInput
                        label={lang === 'ar' ? 'تاريخ الميلاد' : 'Date of Birth'}
                        value={formData.dob || ''}
                        onChange={(val) => setFormData({...formData, dob: val})}
                        isRTL={lang === 'ar'}
                      />
                    </div>
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
                      <SilkyNationalitySelect
                        label={lang === 'ar' ? 'الجنسية' : 'Nationality'}
                        value={formData.nationality || ''}
                        onChange={(val) => setFormData({...formData, nationality: val})}
                        placeholder={lang === 'ar' ? 'اختر جنسيتك' : 'Choose your nationality'}
                        isRTL={lang === 'ar'}
                      />
                    </motion.div>
                  </>
                )}

                {mode === 'LOGIN' && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                    <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-2 block">
                      {isAdmin ? t.adminIdentifier : t.identifier}
                    </label>
                    <input
                      required
                      type="text"
                      placeholder={isAdmin ? t.adminIdentifierPlaceholder : t.identifierPlaceholder}
                      className="w-full p-5 rounded-3xl bg-white/50 dark:bg-[#0f1f1a]/50 border border-white/20 dark:border-emerald-900/20 text-slate-800 dark:text-slate-100 focus:ring-4 focus:ring-emerald-500/20 outline-none transition-all font-semibold placeholder:text-slate-400 dark:placeholder:text-slate-600 shadow-sm"
                      value={formData.identifier}
                      onChange={(e) => setFormData({...formData, identifier: e.target.value})}
                    />
                  </motion.div>
                )}

                {mode === 'FORGOT_PASSWORD' && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                    <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-2 block">
                      {isAdmin ? t.adminIdentifier : t.identifier}
                    </label>
                    <input
                      required
                      type="text"
                      placeholder={isAdmin ? t.adminIdentifierPlaceholder : t.identifierPlaceholder}
                      className="w-full p-5 rounded-3xl bg-white/50 dark:bg-[#0f1f1a]/50 border border-white/20 dark:border-emerald-900/20 text-slate-800 dark:text-slate-100 focus:ring-4 focus:ring-emerald-500/20 outline-none transition-all font-semibold placeholder:text-slate-400 dark:placeholder:text-slate-600 shadow-sm"
                      value={formData.identifier}
                      onChange={(e) => setFormData({...formData, identifier: e.target.value})}
                    />
                  </motion.div>
                )}

                {mode === 'OTP' && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                    <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-2 block text-center">{t.otpTitle}</label>
                    <input
                      required
                      type="text"
                      maxLength={6}
                      placeholder={t.otpPlaceholder}
                      className="w-full p-6 rounded-3xl bg-white/50 dark:bg-[#0f1f1a]/50 border border-white/20 dark:border-emerald-900/20 text-slate-800 dark:text-white text-center text-4xl font-black tracking-[0.5em] focus:ring-4 focus:ring-emerald-500/20 outline-none transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600 placeholder:text-sm placeholder:tracking-normal shadow-sm"
                      value={formData.otp}
                      onChange={(e) => setFormData({...formData, otp: e.target.value?.replace(/\D/g, '') || ''})}
                    />
                  </motion.div>
                )}

                {mode === 'NEW_PASSWORD' && (
                  <div className="space-y-6">
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                      <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-2 block">{t.password}</label>
                      <input
                        required
                        type="password"
                        placeholder={t.passwordPlaceholder}
                        className="w-full p-5 rounded-3xl bg-white/50 dark:bg-[#0f1f1a]/50 border border-white/20 dark:border-emerald-900/20 text-slate-800 dark:text-slate-100 focus:ring-4 focus:ring-emerald-500/20 outline-none transition-all font-semibold placeholder:text-slate-400 dark:placeholder:text-slate-600 shadow-sm"
                        value={formData.newPassword}
                        onChange={(e) => setFormData({...formData, newPassword: e.target.value})}
                      />
                      <PasswordRequirements password={formData.newPassword} />
                    </motion.div>
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
                      <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-2 block">{t.confirmPassword}</label>
                      <input
                        required
                        type="password"
                        placeholder={t.confirmPasswordPlaceholder}
                        className="w-full p-5 rounded-3xl bg-white/50 dark:bg-[#0f1f1a]/50 border border-white/20 dark:border-emerald-900/20 text-slate-800 dark:text-slate-100 focus:ring-4 focus:ring-emerald-500/20 outline-none transition-all font-semibold placeholder:text-slate-400 dark:placeholder:text-slate-600 shadow-sm"
                        value={formData.confirmPassword}
                        onChange={(e) => setFormData({...formData, confirmPassword: e.target.value})}
                      />
                      {formData.confirmPassword && (
                        <div className={`mt-2 flex items-center space-x-2 rtl:space-x-reverse transition-all duration-300 ${formData.newPassword === formData.confirmPassword ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'}`}>
                          <i className={`fas ${formData.newPassword === formData.confirmPassword ? 'fa-check-circle' : 'fa-times-circle'} text-sm`}></i>
                          <span className="text-[10px] font-black uppercase tracking-widest">
                            {formData.newPassword === formData.confirmPassword ? t.passwordsMatch : t.passwordsDoNotMatch}
                          </span>
                        </div>
                      )}
                    </motion.div>
                  </div>
                )}
                
                {(mode === 'LOGIN' || mode === 'SIGNUP') && (
                  <div className="space-y-6">
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                      <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-2 block">{t.password}</label>
                      <input
                        required
                        type="password"
                        placeholder={t.passwordPlaceholder}
                        className="w-full p-5 rounded-3xl bg-white/50 dark:bg-[#0f1f1a]/50 border border-white/20 dark:border-emerald-900/20 text-slate-800 dark:text-slate-100 focus:ring-4 focus:ring-emerald-500/20 outline-none transition-all font-semibold placeholder:text-slate-400 dark:placeholder:text-slate-600 shadow-sm"
                        value={formData.password}
                        onChange={(e) => setFormData({...formData, password: e.target.value})}
                      />
                      {mode === 'SIGNUP' && <PasswordRequirements password={formData.password} />}
                    </motion.div>
                    
                    {mode === 'SIGNUP' && (
                      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
                        <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-2 block">{t.confirmPassword}</label>
                        <input
                          required
                          type="password"
                          placeholder={t.confirmPasswordPlaceholder}
                          className="w-full p-5 rounded-3xl bg-white/50 dark:bg-[#0f1f1a]/50 border border-white/20 dark:border-emerald-900/20 text-slate-800 dark:text-slate-100 focus:ring-4 focus:ring-emerald-500/20 outline-none transition-all font-semibold placeholder:text-slate-400 dark:placeholder:text-slate-600 shadow-sm"
                          value={formData.confirmPassword}
                          onChange={(e) => setFormData({...formData, confirmPassword: e.target.value})}
                        />
                        {formData.confirmPassword && (
                          <div className={`mt-2 flex items-center space-x-2 rtl:space-x-reverse transition-all duration-300 ${formData.password === formData.confirmPassword ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'}`}>
                            <i className={`fas ${formData.password === formData.confirmPassword ? 'fa-check-circle' : 'fa-times-circle'} text-sm`}></i>
                            <span className="text-[10px] font-black uppercase tracking-widest">
                              {formData.password === formData.confirmPassword ? t.passwordsMatch : t.passwordsDoNotMatch}
                            </span>
                          </div>
                        )}
                      </motion.div>
                    )}

                    {mode === 'LOGIN' && !isAdmin && (
                      <div className="mt-2 text-right rtl:text-left">
                        <button
                          type="button"
                          onClick={() => setMode('FORGOT_PASSWORD')}
                          className="text-xs text-emerald-600 dark:text-emerald-400 font-black uppercase tracking-widest hover:underline"
                        >
                          {t.forgotPassword}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            </AnimatePresence>

            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-rose-500/10 border border-rose-500/20 p-4 rounded-2xl"
              >
                <p className="text-xs text-rose-600 dark:text-rose-400 font-bold text-center flex items-center justify-center gap-3">
                  <i className="fas fa-exclamation-circle text-lg"></i>
                  {error}
                </p>
              </motion.div>
            )}

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              disabled={loading}
              type="submit"
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-6 rounded-3xl shadow-xl shadow-emerald-500/20 transition-all flex items-center justify-center space-x-3 rtl:space-x-reverse disabled:opacity-50 uppercase tracking-widest text-sm"
            >
              {loading ? (
                <div className="w-6 h-6 border-3 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : (
                <>
                  <i className={`fas ${mode === 'LOGIN' ? 'fa-sign-in-alt' : mode === 'SIGNUP' ? 'fa-user-plus' : 'fa-check-circle'}`}></i>
                  <span>
                    {mode === 'LOGIN' ? t.loginBtn : 
                     mode === 'SIGNUP' ? t.signupBtn : 
                     mode === 'FORGOT_PASSWORD' ? t.verifyBtn :
                     mode === 'OTP' ? t.confirmBtn :
                     t.confirmBtn}
                  </span>
                </>
              )}
            </motion.button>

            {!isAdmin && (
              <div className="text-center mt-8">
                <button
                  type="button"
                  onClick={() => {
                    if (mode === 'LOGIN' || mode === 'SIGNUP') {
                      setMode(mode === 'LOGIN' ? 'SIGNUP' : 'LOGIN');
                    } else {
                      setMode('LOGIN');
                    }
                  }}
                  className="text-emerald-600 dark:text-emerald-400 text-xs font-black uppercase tracking-widest hover:underline"
                >
                  {mode === 'LOGIN' ? t.noAccount : 
                   mode === 'SIGNUP' ? t.hasAccount : 
                   t.backToLogin}
                </button>
              </div>
            )}
          </form>
        </div>
      </motion.div>
    </div>
  );
};

export default AuthForm;
