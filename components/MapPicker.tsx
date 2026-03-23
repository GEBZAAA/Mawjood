
import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import { motion, AnimatePresence } from 'framer-motion';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { City, Language } from '../types';
import { translations } from '../translations';
import { Search, MapPin } from 'lucide-react';

// Fix for default marker icon in Leaflet with React
const icon = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png';
const iconShadow = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

const cityCoords: Record<City, [number, number]> = {
  [City.MECCA]: [21.4225, 39.8262],
  [City.MADINA]: [24.4672, 39.6108]
};

function LocationMarker({ position, setPosition, onLocationSelect }: { 
  position: [number, number] | null, 
  setPosition: (pos: [number, number]) => void,
  onLocationSelect: (lat: number, lng: number) => void
}) {
  useMapEvents({
    click(e) {
      setPosition([e.latlng.lat, e.latlng.lng]);
      onLocationSelect(e.latlng.lat, e.latlng.lng);
    },
  });

  return position === null ? null : (
    <Marker position={position}></Marker>
  );
}

// Component to update map center manually
function ChangeView({ center, trigger }: { center: [number, number], trigger: number }) {
  const map = useMap();
  const lastTriggerRef = useRef<number>(trigger);

  useEffect(() => {
      if (lastTriggerRef.current !== trigger) {
          map.setView(center, 17);
          lastTriggerRef.current = trigger;
      }
  }, [center, trigger, map]);
  return null;
}

// Component to sync map center
function SyncCenter({ onCenterChange }: { onCenterChange: (center: [number, number]) => void }) {
  const map = useMapEvents({
    moveend() {
      const center = map.getCenter();
      onCenterChange([center.lat, center.lng]);
    },
  });
  return null;
}

// Component to fix Leaflet size issues in animated containers
function MapResizer({ position, center, currentViewCenter }: { position: [number, number] | null, center: [number, number], currentViewCenter: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    // Small delay to ensure animation has progressed/container is sized
    const timer = setTimeout(() => {
      map.invalidateSize();
      if (currentViewCenter) {
        map.setView(currentViewCenter, 17);
      } else if (position) {
        map.setView(position, 17);
      } else {
        map.setView(center, 17);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [map, position, center, currentViewCenter]);
  return null;
}

interface MapPickerProps {
  city: City;
  onLocationSelect: (lat: number, lng: number) => void;
  onCityChange?: (city: City) => void;
  initialLocation?: { lat: number, lng: number };
  lang: Language;
  hideCityButtons?: boolean;
  centerOnSelect?: boolean;
}

const MapPicker: React.FC<MapPickerProps> = ({ 
  city, 
  onLocationSelect, 
  onCityChange, 
  initialLocation, 
  lang, 
  hideCityButtons = false,
  centerOnSelect = false
}) => {
  const t = translations[lang];
  const isRTL = lang === 'ar' || lang === 'ur' || lang === 'fa';
  const [position, setPosition] = useState<[number, number] | null>(
    initialLocation && typeof initialLocation.lat === 'number' && initialLocation.lat !== 0 ? [initialLocation.lat, initialLocation.lng] : null
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [recenterTrigger, setRecenterTrigger] = useState(0);
  const [searchResultCenter, setSearchResultCenter] = useState<[number, number] | null>(null);
  const [currentViewCenter, setCurrentViewCenter] = useState<[number, number] | null>(null);
  const [isMaximized, setIsMaximized] = useState(false);
  const isInternalUpdateRef = useRef(false);

  // Update position if initialLocation changes (e.g. when switching items in admin)
  // Also trigger a re-center to the new initial location
  useEffect(() => {
    if (initialLocation) {
      // If this was triggered by our own click, don't re-center
      if (isInternalUpdateRef.current) {
        isInternalUpdateRef.current = false;
        return;
      }

      if (typeof initialLocation.lat === 'number' && initialLocation.lat !== 0) {
        const newPos: [number, number] = [initialLocation.lat, initialLocation.lng];
        setPosition(newPos);
        setSearchResultCenter(newPos);
        setRecenterTrigger(prev => prev + 1);
      } else {
        setPosition(null);
      }
    } else {
      setPosition(null);
    }
  }, [initialLocation]);

  // Automatically re-center when city changes
  useEffect(() => {
    setSearchResultCenter(null);
    setRecenterTrigger(prev => prev + 1);
  }, [city]);

  const center = cityCoords[city];

  const handleSearch = async (e?: React.FormEvent | React.MouseEvent | React.KeyboardEvent) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    try {
      // Use Nominatim for search
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery + ' ' + (city === City.MECCA ? 'Makkah' : 'Madina'))}&limit=1`);
      const data = await response.json();
      
      if (data && data.length > 0) {
        const { lat, lon } = data[0];
        const newPos: [number, number] = [parseFloat(lat), parseFloat(lon)];
        setSearchResultCenter(newPos);
        setRecenterTrigger(prev => prev + 1);
      }
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const handleRecenter = (targetCity?: City) => {
    if (targetCity && onCityChange && targetCity !== city) {
      onCityChange(targetCity);
    }
    setSearchResultCenter(null);
    setRecenterTrigger(prev => prev + 1);
  };

  const handleLocationClick = (lat: number, lng: number) => {
    isInternalUpdateRef.current = true;
    const newPos: [number, number] = [lat, lng];
    setPosition(newPos);
    onLocationSelect(lat, lng);
    
    // Center on the new pin only if centerOnSelect is true
    if (centerOnSelect) {
      setSearchResultCenter(newPos);
      setRecenterTrigger(prev => prev + 1);
    }
  };

  return (
    <div className="space-y-4">
      {!hideCityButtons && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">
            {t.locateOnMap}
          </label>
          <div className="flex items-center gap-2">
            <button 
              type="button"
              onClick={() => handleRecenter(City.MECCA)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all ${
                city === City.MECCA 
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20' 
                  : 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100'
              }`}
            >
              <MapPin size={12} />
              {t.goToMecca}
            </button>
            
            <button 
              type="button"
              onClick={() => handleRecenter(City.MADINA)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all ${
                city === City.MADINA 
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20' 
                  : 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100'
              }`}
            >
              <MapPin size={12} />
              {t.goToMadina}
            </button>
            
            {position && (
              <button 
                type="button"
                onClick={() => {
                  setPosition(null);
                  // @ts-ignore
                  onLocationSelect(null, null);
                }}
                className="text-[10px] text-red-500 hover:text-red-600 font-bold uppercase tracking-wider px-2"
              >
                {t.removeLocation}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Search Bar - Using div instead of form to avoid nested form errors */}
      <div className="flex gap-2">
        <div className="relative flex-grow group">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleSearch(e);
              }
            }}
            placeholder={t.searchLocation || (lang === 'ar' ? "ابحث عن موقع..." : "Search for a location...")}
            className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 rounded-2xl text-sm focus:border-emerald-500 outline-none transition-all shadow-sm"
          />
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-500 transition-colors" size={18} />
        </div>
        <button 
          type="button"
          onClick={() => handleSearch()}
          disabled={isSearching}
          className="px-6 py-2.5 bg-emerald-500 text-white text-sm font-bold rounded-2xl hover:bg-emerald-600 transition-all disabled:opacity-50 shadow-md shadow-emerald-500/20 flex-shrink-0"
        >
          {isSearching ? '...' : (t.mapSearchBtn || (lang === 'ar' ? 'بحث' : 'Search'))}
        </button>
      </div>
      
      <div className="h-64 rounded-3xl overflow-hidden border-2 border-slate-200 dark:border-emerald-900/20 shadow-inner relative z-10 group/map">
        <MapContainer 
          center={position || center} 
          zoom={17} 
          scrollWheelZoom={false}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <LocationMarker position={position} setPosition={setPosition} onLocationSelect={handleLocationClick} />
          <ChangeView center={searchResultCenter || center} trigger={recenterTrigger} />
          <SyncCenter onCenterChange={setCurrentViewCenter} />
        </MapContainer>
        
        {position && (
          <button
            type="button"
            onClick={() => {
              setPosition(null);
              // @ts-ignore
              onLocationSelect(null, null);
            }}
            className="absolute top-4 right-16 z-[1000] w-10 h-10 bg-white/90 dark:bg-[#061410]/90 backdrop-blur-md rounded-xl shadow-lg border border-slate-200 dark:border-emerald-900/20 flex items-center justify-center text-red-500 hover:text-red-600 transition-all"
            title={t.removeLocation}
          >
            <i className="fas fa-trash-alt"></i>
          </button>
        )}
        
        <button
          type="button"
          onClick={() => setIsMaximized(true)}
          className="absolute top-4 right-4 z-[1000] w-10 h-10 bg-white/90 dark:bg-[#061410]/90 backdrop-blur-md rounded-xl shadow-lg border border-slate-200 dark:border-emerald-900/20 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 transition-all opacity-0 group-hover/map:opacity-100"
          title={isRTL ? 'تكبير الخريطة' : 'Maximize Map'}
        >
          <i className="fas fa-expand-alt"></i>
        </button>

        {!position && (
          <div className="absolute inset-0 bg-black/5 pointer-events-none flex items-center justify-center z-[1000]">
            <div className="bg-white/90 dark:bg-[#061410]/90 backdrop-blur-md px-4 py-2 rounded-full shadow-lg border border-emerald-500/20">
              <p className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-widest">
                {t.clickToPin}
              </p>
            </div>
          </div>
        )}
      </div>
      
      <p className="text-[10px] text-slate-400 dark:text-slate-500 italic">
        * {t.pinLocationHelp}
      </p>

      <AnimatePresence>
        {isMaximized && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] flex items-end justify-center p-4 md:p-12 bg-slate-900/60 backdrop-blur-md pb-12 md:pb-20"
            onClick={() => setIsMaximized(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 40 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 40 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="bg-white dark:bg-[#061410] w-full max-w-3xl h-[75vh] rounded-[32px] shadow-2xl overflow-hidden border border-slate-200 dark:border-emerald-900/20 flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Exit Bar / Header */}
              <div className="p-4 border-b border-slate-100 dark:border-emerald-900/10 flex items-center justify-between bg-slate-50/50 dark:bg-emerald-950/10">
                <div className="flex items-center space-x-3 rtl:space-x-reverse">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600">
                    <i className="fas fa-map-marked-alt text-lg"></i>
                  </div>
                  <h3 className="text-lg font-bold text-slate-800 dark:text-white">{t.locateOnMap}</h3>
                </div>
                <button 
                  type="button"
                  onClick={() => setIsMaximized(false)} 
                  className="w-8 h-8 rounded-full bg-slate-100 dark:bg-emerald-900/20 flex items-center justify-center text-slate-400 hover:text-slate-800 dark:hover:text-white transition-colors"
                >
                  <i className="fas fa-times text-lg"></i>
                </button>
              </div>

              {/* Search Bar inside Modal */}
              <div className="p-4 bg-white dark:bg-[#061410] border-b border-slate-100 dark:border-emerald-900/10">
                <div className="flex gap-2">
                  <div className="relative flex-grow group">
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleSearch(e);
                        }
                      }}
                      placeholder={t.searchLocation || (lang === 'ar' ? "ابحث عن موقع..." : "Search for a location...")}
                      className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-emerald-900/10 rounded-xl text-sm focus:border-emerald-500 outline-none transition-all"
                    />
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-500 transition-colors" size={16} />
                  </div>
                  <button 
                    type="button"
                    onClick={() => handleSearch()}
                    disabled={isSearching}
                    className="px-4 py-2 bg-emerald-600 text-white text-xs font-bold rounded-xl hover:bg-emerald-700 transition-all disabled:opacity-50"
                  >
                    {isSearching ? '...' : (t.mapSearchBtn || (lang === 'ar' ? 'بحث' : 'Search'))}
                  </button>
                </div>
              </div>

              <div className="flex-grow relative">
                <MapContainer 
                  center={currentViewCenter || position || center} 
                  zoom={17} 
                  scrollWheelZoom={true}
                  style={{ height: '100%', width: '100%' }}
                >
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  <LocationMarker position={position} setPosition={setPosition} onLocationSelect={handleLocationClick} />
                  <ChangeView center={searchResultCenter || center} trigger={recenterTrigger} />
                  <MapResizer position={position} center={center} currentViewCenter={currentViewCenter} />
                </MapContainer>
                
                {position && (
                  <button
                    type="button"
                    onClick={() => {
                      setPosition(null);
                      // @ts-ignore
                      onLocationSelect(null, null);
                    }}
                    className="absolute top-4 right-4 z-[1000] w-10 h-10 bg-white/90 dark:bg-[#061410]/90 backdrop-blur-md rounded-xl shadow-lg border border-slate-200 dark:border-emerald-900/20 flex items-center justify-center text-red-500 hover:text-red-600 transition-all"
                    title={t.removeLocation}
                  >
                    <i className="fas fa-trash-alt"></i>
                  </button>
                )}
                
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[1000] flex items-center gap-2 bg-white/90 dark:bg-[#061410]/90 backdrop-blur-md p-1.5 rounded-xl shadow-xl border border-slate-200 dark:border-emerald-900/20">
                  <button 
                    type="button"
                    onClick={() => handleRecenter(City.MECCA)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${
                      city === City.MECCA 
                        ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20' 
                        : 'text-slate-600 dark:text-slate-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20'
                    }`}
                  >
                    <i className="fas fa-kaaba"></i>
                    {t.mecca}
                  </button>
                  <button 
                    type="button"
                    onClick={() => handleRecenter(City.MADINA)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${
                      city === City.MADINA 
                        ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20' 
                        : 'text-slate-600 dark:text-slate-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20'
                    }`}
                  >
                    <i className="fas fa-mosque"></i>
                    {t.madina}
                  </button>
                </div>
              </div>

              <div className="p-4 bg-slate-50 dark:bg-emerald-950/10 border-t border-slate-100 dark:border-emerald-900/10 flex justify-center">
                <button
                  type="button"
                  onClick={() => setIsMaximized(false)}
                  className="px-10 py-3 bg-emerald-700 text-white rounded-xl font-black uppercase tracking-widest hover:bg-emerald-600 transition-all shadow-lg"
                >
                  {t.confirmBtn}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default MapPicker;
