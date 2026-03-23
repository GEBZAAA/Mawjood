
import React from 'react';
import { City } from '../types';

interface LocationSelectorProps {
  onSelect: (city: City) => void;
}

const LocationSelector: React.FC<LocationSelectorProps> = ({ onSelect }) => {
  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="text-center">
        <h2 className="text-3xl font-bold text-slate-800">Where was it lost?</h2>
        <p className="text-slate-500 mt-2">Select the city where you lost your item to begin the search.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <button
          onClick={() => onSelect(City.MECCA)}
          className="group relative overflow-hidden bg-white rounded-3xl shadow-xl hover:shadow-2xl transition-all border-2 border-transparent hover:border-emerald-500"
        >
          <div className="h-48 overflow-hidden">
            <img 
              src="https://picsum.photos/seed/makkah/800/600" 
              alt="Makkah" 
              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-emerald-900/80 to-transparent"></div>
          </div>
          <div className="p-8 text-left relative">
            <h3 className="text-2xl font-bold text-slate-800">Makkah</h3>
            <p className="text-slate-500 mt-2">Search records from Masjid al-Haram and surrounding areas.</p>
            <div className="mt-4 flex items-center text-emerald-700 font-semibold text-sm">
              Explore Makkah Database <i className="fas fa-chevron-right ml-2 text-xs group-hover:translate-x-1 transition-transform"></i>
            </div>
          </div>
        </button>

        <button
          onClick={() => onSelect(City.MADINA)}
          className="group relative overflow-hidden bg-white rounded-3xl shadow-xl hover:shadow-2xl transition-all border-2 border-transparent hover:border-amber-500"
        >
          <div className="h-48 overflow-hidden">
            <img 
              src="https://picsum.photos/seed/madina/800/600" 
              alt="Madina" 
              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-amber-900/80 to-transparent"></div>
          </div>
          <div className="p-8 text-left relative">
            <h3 className="text-2xl font-bold text-slate-800">Madina</h3>
            <p className="text-slate-500 mt-2">Search records from Masjid an-Nabawi and surrounding areas.</p>
            <div className="mt-4 flex items-center text-amber-700 font-semibold text-sm">
              Explore Madina Database <i className="fas fa-chevron-right ml-2 text-xs group-hover:translate-x-1 transition-transform"></i>
            </div>
          </div>
        </button>
      </div>
    </div>
  );
};

export default LocationSelector;
