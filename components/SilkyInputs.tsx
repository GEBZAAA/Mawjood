
import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Calendar, Search } from 'lucide-react';
import { COUNTRIES } from '../constants';
import { formatDate } from '../utils';

interface SilkySelectProps {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string; icon?: string }[];
  placeholder: string;
  label: string;
  isRTL?: boolean;
}

export const SilkySelect: React.FC<SilkySelectProps> = React.memo(({ value, onChange, options, placeholder, label, isRTL }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = options.find(opt => opt.value === value);

  return (
    <div className="relative" ref={containerRef}>
      <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-2 block">
        {label}
      </label>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-5 rounded-3xl bg-white/50 dark:bg-[#0f1f1a]/50 border border-white/20 dark:border-emerald-900/20 text-slate-800 dark:text-slate-100 focus:ring-4 focus:ring-emerald-500/20 outline-none transition-all font-semibold flex items-center justify-between hover:bg-white/70 dark:hover:bg-[#0f1f1a]/70 shadow-sm"
      >
        <span className={`flex items-center space-x-3 rtl:space-x-reverse ${!value ? 'text-slate-400 dark:text-slate-600' : ''}`}>
          {selectedOption?.icon && <span className="text-lg leading-none">{selectedOption.icon}</span>}
          <span>{selectedOption ? selectedOption.label : placeholder}</span>
        </span>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
        >
          <ChevronDown className="w-4 h-4 text-emerald-500" />
        </motion.div>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 5, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="absolute z-50 w-full bg-white/90 dark:bg-[#061410]/95 backdrop-blur-lg border border-white/20 dark:border-emerald-900/20 rounded-3xl shadow-2xl overflow-hidden"
          >
            <div className="p-2 max-h-64 overflow-y-auto custom-scrollbar">
              {options.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    onChange(option.value);
                    setIsOpen(false);
                  }}
                  className={`w-full p-4 text-left ${isRTL ? 'text-right' : 'text-left'} rounded-2xl transition-all font-semibold flex items-center space-x-3 rtl:space-x-reverse ${
                    value === option.value
                      ? 'bg-emerald-500 text-white'
                      : 'text-slate-700 dark:text-slate-200 hover:bg-emerald-500/10'
                  }`}
                >
                  {option.icon && <span className="text-lg leading-none">{option.icon}</span>}
                  <span>{option.label}</span>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

interface SilkyNationalitySelectProps {
  value: string;
  onChange: (value: string) => void;
  label: string;
  placeholder: string;
  isRTL?: boolean;
}

export const SilkyNationalitySelect: React.FC<SilkyNationalitySelectProps> = React.memo(({ value, onChange, label, placeholder, isRTL }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedCountry = COUNTRIES.find(c => c.name === value);
  const filteredCountries = COUNTRIES.filter(c => 
    c.name?.toLowerCase()?.includes(search.toLowerCase())
  );

  return (
    <div className="relative" ref={containerRef}>
      <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-2 block">
        {label}
      </label>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-5 rounded-3xl bg-white/50 dark:bg-[#0f1f1a]/50 border border-white/20 dark:border-emerald-900/20 text-slate-800 dark:text-slate-100 focus:ring-4 focus:ring-emerald-500/20 outline-none transition-all font-semibold flex items-center justify-between hover:bg-white/70 dark:hover:bg-[#0f1f1a]/70 shadow-sm"
      >
        <span className={`flex items-center space-x-3 rtl:space-x-reverse ${!value ? 'text-slate-400 dark:text-slate-600' : ''}`}>
          {selectedCountry && (
            <img 
              src={selectedCountry.name === 'Afghanistan' ? 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5c/Flag_of_the_Taliban.svg/40px-Flag_of_the_Taliban.svg.png' : `https://flagcdn.com/w20/${selectedCountry.iso}.png`} 
              alt=""
              className="w-5 h-auto rounded-sm shadow-sm"
              referrerPolicy="no-referrer"
            />
          )}
          <span>{selectedCountry ? selectedCountry.name : placeholder}</span>
        </span>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
        >
          <ChevronDown className="w-4 h-4 text-emerald-500" />
        </motion.div>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 5, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="absolute z-50 w-full bg-white/90 dark:bg-[#061410]/95 backdrop-blur-lg border border-white/20 dark:border-emerald-900/20 rounded-[32px] shadow-2xl overflow-hidden flex flex-col"
          >
            <div className="p-4 border-b border-white/10 dark:border-emerald-900/10">
              <div className="relative">
                <Search className={`absolute ${isRTL ? 'right-4' : 'left-4'} top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400`} />
                <input
                  type="text"
                  autoFocus
                  placeholder={isRTL ? 'ابحث عن الدولة...' : 'Search country...'}
                  className={`w-full ${isRTL ? 'pr-10 pl-4' : 'pl-10 pr-4'} py-3 rounded-2xl bg-white/50 dark:bg-[#0f1f1a]/50 text-sm text-slate-800 dark:text-white outline-none focus:ring-4 focus:ring-emerald-500/20 transition-all placeholder:text-slate-400`}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
            <div className="max-h-64 overflow-y-auto custom-scrollbar p-2">
              {filteredCountries.map((country) => (
                <button
                  key={country.name}
                  type="button"
                  onClick={() => {
                    onChange(country.name);
                    setIsOpen(false);
                    setSearch('');
                  }}
                  className={`w-full p-4 text-left ${isRTL ? 'text-right' : 'text-left'} rounded-2xl transition-all font-semibold flex items-center justify-between group ${
                    value === country.name
                      ? 'bg-emerald-500 text-white'
                      : 'text-slate-700 dark:text-slate-200 hover:bg-emerald-500/10'
                  }`}
                >
                  <span className="flex items-center space-x-4 rtl:space-x-reverse">
                    <img 
                      src={country.name === 'Afghanistan' ? 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5c/Flag_of_the_Taliban.svg/40px-Flag_of_the_Taliban.svg.png' : `https://flagcdn.com/w20/${country.iso}.png`} 
                      alt=""
                      className="w-6 h-auto rounded-sm shadow-sm"
                      referrerPolicy="no-referrer"
                    />
                    <span className="text-sm font-bold">{country.name}</span>
                  </span>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

interface SilkyDateInputProps {
  value: string;
  onChange: (value: string) => void;
  label: string;
  isRTL?: boolean;
  min?: string;
  max?: string;
  required?: boolean;
}

export const SilkyDateInput: React.FC<SilkyDateInputProps> = React.memo(({ value, onChange, label, isRTL, min, max, required }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isFocused, setIsFocused] = useState(false);

  return (
    <div className="relative">
      <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-2 block">
        {label}
      </label>
      <div className="relative group">
        <input
          ref={inputRef}
          type="date"
          required={required}
          min={min}
          max={max}
          value={value}
          onChange={(e) => {
            let val = e.target.value;
            if (val && val.split('-')[0].length > 4) {
              const parts = val.split('-');
              parts[0] = parts[0].substring(0, 4);
              val = parts.join('-');
            }
            onChange(val);
          }}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          className={`w-full p-5 rounded-3xl bg-white/50 dark:bg-[#0f1f1a]/50 border border-white/20 dark:border-emerald-900/20 text-slate-800 dark:text-slate-100 focus:ring-4 focus:ring-emerald-500/20 outline-none transition-all font-semibold appearance-none relative z-10 ${!isFocused ? 'text-transparent hide-native-date' : ''}`}
          style={{ colorScheme: 'dark' }}
        />
        {!isFocused && (
          <div className={`absolute inset-0 p-5 flex items-center pointer-events-none z-[11] rounded-3xl font-semibold ${!value ? 'text-slate-400 dark:text-slate-600' : 'text-slate-800 dark:text-slate-100'} ${isRTL ? 'justify-end pr-12' : 'justify-start pl-5'}`}>
            {formatDate(value)}
          </div>
        )}
        <div className={`absolute inset-y-0 ${isRTL ? 'left-5' : 'right-5'} flex items-center pointer-events-none z-20`}>
          <Calendar className="w-4 h-4 text-emerald-500 group-hover:scale-110 transition-transform" />
        </div>
      </div>
      <style>{`
        input[type="date"]::-webkit-calendar-picker-indicator {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          width: 100%;
          height: 100%;
          opacity: 0;
          cursor: pointer;
        }
        .hide-native-date::-webkit-datetime-edit {
          opacity: 0 !important;
        }
        input[type="date"]::-webkit-inner-spin-button,
        input[type="date"]::-webkit-clear-button {
          display: none;
          -webkit-appearance: none;
        }
      `}</style>
    </div>
  );
});
