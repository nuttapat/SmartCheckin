import React, { useState } from 'react';
import { MapPin, Search, Navigation, Check, X, RefreshCw, Globe } from 'lucide-react';

interface MapPickerProps {
  initialLat?: number;
  initialLng?: number;
  onSelectLocation: (lat: number, lng: number, addressName?: string) => void;
  onClose?: () => void;
  isDarkMode?: boolean;
}

export const MapPicker: React.FC<MapPickerProps> = ({
  initialLat = 13.7988363,
  initialLng = 100.322944,
  onSelectLocation,
  onClose,
  isDarkMode = true,
}) => {
  const [lat, setLat] = useState<number>(initialLat);
  const [lng, setLng] = useState<number>(initialLng);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searching, setSearching] = useState<boolean>(false);
  const [selectedPlaceName, setSelectedPlaceName] = useState<string>('');
  const [searchResults, setSearchResults] = useState<Array<{ display_name: string; lat: string; lon: string }>>([]);

  // Popular presets in Thailand
  const presets = [
    { name: '📍 คณะเทคนิคการแพทย์ มหาวิทยาลัยมหิดล (ศาลายา)', lat: 13.7988363, lng: 100.322944 },
    { name: '📍 คณะเทคนิคการแพทย์ มหาวิทยาลัยมหิดล (ศิริราช)', lat: 13.7578523, lng: 100.4861744 },
    { name: '📍 จุฬาลงกรณ์มหาวิทยาลัย', lat: 13.7367, lng: 100.5331 },
    { name: '📍 มหาวิทยาลัยธรรมศาสตร์ (รังสิต)', lat: 14.0722, lng: 100.6025 },
    { name: '📍 มหาวิทยาลัยเกษตรศาสตร์ (บางเขน)', lat: 13.8476, lng: 100.5696 },
    { name: '📍 มหาวิทยาลัยเชียงใหม่', lat: 18.8044, lng: 98.9547 },
    { name: '📍 มหาวิทยาลัยขอนแก่น', lat: 16.4744, lng: 102.8228 },
    { name: '📍 มหาวิทยาลัยสงขลานครินทร์', lat: 7.0086, lng: 100.4982 },
  ];

  const handleGetCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLat(pos.coords.latitude);
          setLng(pos.coords.longitude);
          setSelectedPlaceName('ตำแหน่งปัจจุบันจากอุปกรณ์ (Device GPS)');
        },
        (err) => {
          alert(`ไม่สามารถดึงตำแหน่งปัจจุบันได้ (${err.message})`);
        },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
      );
    } else {
      alert('เบราว์เซอร์ไม่รองรับ Geolocation');
    }
  };

  const handleSearchLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setSearching(true);
    setSearchResults([]);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}`);
      const data = await res.json();
      if (data && data.length > 0) {
        setSearchResults(data.slice(0, 5));
        const first = data[0];
        const newLat = parseFloat(first.lat);
        const newLng = parseFloat(first.lon);
        setLat(newLat);
        setLng(newLng);
        setSelectedPlaceName(first.display_name);
      } else {
        alert('ไม่พบสถานที่ที่ค้นหา กรุณาลองค้นหาคำอื่น');
      }
    } catch (err) {
      console.error(err);
      alert('เกิดข้อผิดพลาดในการค้นหาแผนที่');
    } finally {
      setSearching(false);
    }
  };

  const handleSelectSearchResult = (result: { display_name: string; lat: string; lon: string }) => {
    const newLat = parseFloat(result.lat);
    const newLng = parseFloat(result.lon);
    setLat(newLat);
    setLng(newLng);
    setSelectedPlaceName(result.display_name);
    setSearchResults([]);
  };

  const handleConfirm = () => {
    onSelectLocation(lat, lng, selectedPlaceName);
    if (onClose) onClose();
  };

  // Construct iframe embed URL for OpenStreetMap interactive preview
  const mapIframeUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${lng - 0.005}%2C${lat - 0.003}%2C${lng + 0.005}%2C${lat + 0.003}&layer=mapnik&marker=${lat}%2C${lng}`;

  return (
    <div className="space-y-4">
      {/* Header & Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 rounded-xl bg-teal-500/10 text-teal-500 flex items-center justify-center font-bold">
            <Globe className="w-4 h-4" />
          </div>
          <div>
            <h4 className={`text-sm font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
              ระบุพิกัด GPS ประจำอาคารเรียน / รายวิชา
            </h4>
            <p className={`text-[11px] ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              ค้นหาชื่อสถานที่ หรือป้อนพิกัด ละติจูด / ลองจิจูด โดยตรง
            </p>
          </div>
        </div>

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className={`p-1.5 rounded-lg transition ${
              isDarkMode ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Search Bar */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            type="text"
            placeholder="ค้นหาชื่ออาคาร, มหาวิทยาลัย หรือสถานที่..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleSearchLocation(e as any);
              }
            }}
            className={`w-full border rounded-xl pl-9 pr-3 py-2 text-xs focus:outline-none focus:border-teal-500 ${
              isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900 shadow-sm'
            }`}
          />
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
        </div>
        <button
          type="button"
          onClick={(e) => handleSearchLocation(e as any)}
          disabled={searching}
          className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-xs font-bold transition flex items-center space-x-1 shrink-0"
        >
          {searching ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
          <span>ค้นหา</span>
        </button>
      </div>

      {/* Search Results Dropdown */}
      {searchResults.length > 0 && (
        <div className={`p-2 border rounded-xl space-y-1 max-h-40 overflow-y-auto ${
          isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 shadow-md text-slate-800'
        }`}>
          <div className="text-[10px] font-bold text-teal-400 px-2 py-1">ผลการค้นหา:</div>
          {searchResults.map((res, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleSelectSearchResult(res)}
              className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs truncate transition ${
                isDarkMode ? 'hover:bg-slate-700 text-slate-200' : 'hover:bg-slate-100 text-slate-800'
              }`}
            >
              📍 {res.display_name}
            </button>
          ))}
        </div>
      )}

      {/* Presets Row */}
      <div className="space-y-1">
        <label className={`text-[11px] font-semibold ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
          ตำแหน่งยอดนิยม (Quick Presets):
        </label>
        <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-1">
          {presets.map((p, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => {
                setLat(p.lat);
                setLng(p.lng);
                setSelectedPlaceName(p.name);
              }}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border transition ${
                lat === p.lat && lng === p.lng
                  ? 'bg-teal-500/20 border-teal-500 text-teal-400 font-bold'
                  : isDarkMode
                  ? 'bg-slate-800/80 border-slate-700 text-slate-300 hover:border-slate-500'
                  : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {p.name}
            </button>
          ))}
        </div>
      </div>

      {/* Map Interactive Viewport & Controls */}
      <div className="relative rounded-2xl overflow-hidden border border-slate-700/80 shadow-md min-h-[220px] bg-slate-950">
        <iframe
          title="OpenStreetMap Picker"
          width="100%"
          height="220"
          frameBorder="0"
          scrolling="no"
          src={mapIframeUrl}
          className="w-full h-[220px] rounded-2xl"
        ></iframe>

        <div className="absolute top-2 right-2 flex flex-col gap-1 z-10">
          <button
            type="button"
            onClick={handleGetCurrentLocation}
            className="p-2 bg-slate-900/90 text-teal-400 border border-teal-500/30 rounded-xl hover:bg-teal-600 hover:text-white shadow-lg text-xs font-bold flex items-center space-x-1.5 transition"
            title="ดึงพิกัดจากเครื่องปัจจุบัน"
          >
            <Navigation className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">GPS เครื่องนี้</span>
          </button>
        </div>

        {selectedPlaceName && (
          <div className="absolute bottom-2 left-2 right-2 p-2 bg-slate-900/90 border border-slate-700/80 rounded-xl text-[11px] text-slate-200 truncate flex items-center space-x-1.5">
            <MapPin className="w-3.5 h-3.5 text-teal-400 shrink-0" />
            <span className="truncate">{selectedPlaceName}</span>
          </div>
        )}
      </div>

      {/* Manual Coordinates Input */}
      <div className="grid grid-cols-2 gap-3 p-3 rounded-2xl bg-slate-900/60 border border-slate-800">
        <div>
          <label className="block text-[11px] font-bold text-teal-400 mb-1">
            ละติจูด (Latitude)
          </label>
          <input
            type="number"
            step="0.000001"
            value={lat}
            onChange={(e) => setLat(parseFloat(e.target.value) || 0)}
            className="w-full border rounded-xl px-3 py-1.5 text-xs font-mono font-bold bg-slate-800 border-slate-700 text-white focus:outline-none focus:border-teal-500"
          />
        </div>
        <div>
          <label className="block text-[11px] font-bold text-teal-400 mb-1">
            ลองจิจูด (Longitude)
          </label>
          <input
            type="number"
            step="0.000001"
            value={lng}
            onChange={(e) => setLng(parseFloat(e.target.value) || 0)}
            className="w-full border rounded-xl px-3 py-1.5 text-xs font-mono font-bold bg-slate-800 border-slate-700 text-white focus:outline-none focus:border-teal-500"
          />
        </div>
      </div>

      {/* Confirm Selection Button */}
      <div className="flex justify-end pt-1">
        <button
          type="button"
          onClick={handleConfirm}
          className="w-full py-2.5 px-4 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs flex items-center justify-center space-x-2 transition shadow-lg shadow-teal-500/20 active:scale-95"
        >
          <Check className="w-4 h-4" />
          <span>บันทึกและเลือกพิกัดนี้ ({lat.toFixed(5)}, {lng.toFixed(5)})</span>
        </button>
      </div>
    </div>
  );
};
