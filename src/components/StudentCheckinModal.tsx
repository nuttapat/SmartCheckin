import React, { useState, useEffect, useRef } from 'react';
import { User, Session, Course } from '../types';
import { submitCheckin } from '../services/api';
import { decodeQRCodeFromImage } from '../utils/qrDecoder';
import { getDeviceInfo } from '../utils/deviceHelper';
import { Html5Qrcode } from 'html5-qrcode';
import {
  Sparkles,
  X,
  ShieldCheck,
  Navigation,
  KeyRound,
  Camera,
  Image,
  RefreshCw,
  CheckCircle2,
  ShieldX,
} from 'lucide-react';

interface StudentCheckinModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: User;
  activeSessionsList: Array<{ session: Session; course?: Course }>;
  isDarkMode?: boolean;
  onCheckinSuccess?: () => void;
}

export const StudentCheckinModal: React.FC<StudentCheckinModalProps> = ({
  isOpen,
  onClose,
  student,
  activeSessionsList,
  isDarkMode = false,
  onCheckinSuccess,
}) => {
  const [checkinMode, setCheckinMode] = useState<'HYBRID' | 'GPS_ONLY' | 'TOKEN'>('HYBRID');
  const [scannedResult, setScannedResult] = useState<string>('');
  const [manualInput, setManualInput] = useState<string>('');
  const [selectedSessionId, setSelectedSessionId] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [isImageProcessing, setIsImageProcessing] = useState<boolean>(false);
  const [currentCoords, setCurrentCoords] = useState<{ lat: number; lng: number } | null>(null);

  const [checkinStatus, setCheckinStatus] = useState<{
    success: boolean;
    message?: string;
    distance?: number;
    error?: string;
  } | null>(null);

  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync selected session when modal opens or active sessions update
  useEffect(() => {
    if (activeSessionsList.length > 0 && !selectedSessionId) {
      setSelectedSessionId(activeSessionsList[0].session.id);
    }
  }, [activeSessionsList, selectedSessionId]);

  // Update GPS location
  const updateLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setCurrentCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => {},
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
      );
    }
  };

  useEffect(() => {
    if (isOpen) {
      setCheckinStatus(null);
      setScannedResult('');
      setManualInput('');
      updateLocation();
    } else {
      stopLiveCameraStream();
    }
  }, [isOpen]);

  // Stop camera stream
  const stopLiveCameraStream = async () => {
    if (html5QrCodeRef.current) {
      try {
        await html5QrCodeRef.current.stop();
      } catch (err) {}
      html5QrCodeRef.current = null;
    }
  };

  // Start live camera stream for QR scanning
  const startLiveCameraStream = async () => {
    await stopLiveCameraStream();
    const qrRegion = document.getElementById('student-qr-reader');
    if (!qrRegion) return;

    try {
      const html5Qr = new Html5Qrcode('student-qr-reader');
      html5QrCodeRef.current = html5Qr;

      await html5Qr.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          setScannedResult(decodedText);
          stopLiveCameraStream();
          handleProcessCheckin(decodedText, 'HYBRID');
        },
        () => {}
      );
    } catch (err) {
      console.warn('Camera stream launch failed:', err);
    }
  };

  // Auto start camera if mode is HYBRID and modal is open
  useEffect(() => {
    if (isOpen && checkinMode === 'HYBRID') {
      const timer = setTimeout(() => {
        startLiveCameraStream();
      }, 300);
      return () => {
        clearTimeout(timer);
        stopLiveCameraStream();
      };
    } else {
      stopLiveCameraStream();
    }
  }, [isOpen, checkinMode]);

  const handleSwitchTab = (newMode: 'HYBRID' | 'GPS_ONLY' | 'TOKEN') => {
    setCheckinStatus(null);
    if (checkinMode === 'HYBRID' && newMode !== 'HYBRID') {
      stopLiveCameraStream();
    }
    setCheckinMode(newMode);
  };

  // File Upload QR Code Decoder
  const handleFileUploadScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImageProcessing(true);
    setCheckinStatus(null);

    try {
      const decodedText = await decodeQRCodeFromImage(file);
      setScannedResult(decodedText);
      handleProcessCheckin(decodedText, checkinMode);
    } catch (err: any) {
      setCheckinStatus({
        success: false,
        error: err?.message || 'ไม่สามารถอ่านรหัส QR จากรูปภาพนี้ได้ กรุณาลองใช้รูปที่มีความคมชัดสูงขึ้น',
      });
    } finally {
      setIsImageProcessing(false);
      if (e.target) e.target.value = '';
    }
  };

  // Main Check-in handler
  const handleProcessCheckin = async (
    qrPayloadText?: string,
    modeOverride?: 'HYBRID' | 'GPS_ONLY' | 'TOKEN'
  ) => {
    setCheckinStatus(null);
    setSubmitting(true);

    const mode = modeOverride || checkinMode;

    try {
      let currentLat = currentCoords?.lat || 13.7563;
      let currentLng = currentCoords?.lng || 100.5018;

      if (navigator.geolocation) {
        try {
          const position = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: true,
              timeout: 5000,
              maximumAge: 0,
            });
          });
          currentLat = position.coords.latitude;
          currentLng = position.coords.longitude;
          setCurrentCoords({ lat: currentLat, lng: currentLng });
        } catch (err) {
          console.warn('Geolocation lookup failed/denied:', err);
        }
      }

      const devInfo = getDeviceInfo();

      const res = await submitCheckin({
        studentId: student.id,
        qrToken: qrPayloadText || scannedResult || manualInput.trim(),
        sessionId: selectedSessionId || undefined,
        scannedLat: currentLat,
        scannedLng: currentLng,
        deviceId: devInfo.deviceId,
        deviceName: devInfo.deviceName,
        deviceType: devInfo.deviceType,
        browser: devInfo.browser,
        os: devInfo.os,
        checkinMode: mode,
      });

      setCheckinStatus({
        success: true,
        message: res.message || 'บันทึกการเช็คชื่อเข้าเรียนสำเร็จ!',
        distance: res.distanceMeters,
      });

      if (onCheckinSuccess) {
        onCheckinSuccess();
      }
    } catch (err: any) {
      setCheckinStatus({
        success: false,
        error: err?.message || 'เกิดข้อผิดพลาด ไม่สามารถเช็คชื่อได้',
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center backdrop-blur-md p-3 sm:p-4 overflow-y-auto ${
        isDarkMode ? 'bg-slate-950/80' : 'bg-slate-900/40'
      }`}
    >
      <div
        className={`border rounded-3xl w-full max-w-lg shadow-2xl p-4 sm:p-6 space-y-4 sm:space-y-5 my-auto max-h-[88vh] overflow-y-auto ${
          isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
        }`}
      >
        {/* Header & Close */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Sparkles className="w-5 h-5 text-sky-600 dark:text-sky-400" />
            <h3 className={`text-base font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
              ระบบเช็คชื่อเข้าเรียน (Student Check-in)
            </h3>
          </div>
          <button
            onClick={onClose}
            className={`p-1.5 rounded-lg transition cursor-pointer ${
              isDarkMode ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Check-in Mode Selector Tabs */}
        <div
          className={`grid grid-cols-3 gap-1.5 p-1.5 rounded-2xl border ${
            isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-100 border-slate-200'
          }`}
        >
          <button
            type="button"
            onClick={() => handleSwitchTab('HYBRID')}
            className={`py-2 px-1 text-center rounded-xl text-xs font-bold transition flex flex-col sm:flex-row items-center justify-center space-x-1 cursor-pointer ${
              checkinMode === 'HYBRID'
                ? 'bg-sky-600 text-white shadow-sm'
                : isDarkMode
                ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                : 'text-slate-700 hover:text-slate-900 hover:bg-slate-200'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>QR + GPS</span>
          </button>

          <button
            type="button"
            onClick={() => handleSwitchTab('GPS_ONLY')}
            className={`py-2 px-1 text-center rounded-xl text-xs font-bold transition flex flex-col sm:flex-row items-center justify-center space-x-1 cursor-pointer ${
              checkinMode === 'GPS_ONLY'
                ? 'bg-blue-600 text-white shadow-sm'
                : isDarkMode
                ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                : 'text-slate-700 hover:text-slate-900 hover:bg-slate-200'
            }`}
          >
            <Navigation className="w-3.5 h-3.5" />
            <span>GPS อย่างเดียว</span>
          </button>

          <button
            type="button"
            onClick={() => handleSwitchTab('TOKEN')}
            className={`py-2 px-1 text-center rounded-xl text-xs font-bold transition flex flex-col sm:flex-row items-center justify-center space-x-1 cursor-pointer ${
              checkinMode === 'TOKEN'
                ? 'bg-indigo-600 text-white shadow-sm'
                : isDarkMode
                ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                : 'text-slate-700 hover:text-slate-900 hover:bg-slate-200'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>รหัสเข้าชั้นเรียน</span>
          </button>
        </div>

        {/* MODE 1: QR + GPS SCANNER */}
        <div className={checkinMode === 'HYBRID' ? 'space-y-4' : 'hidden'}>
          <div
            className={`relative rounded-2xl overflow-hidden border min-h-[200px] ${
              isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-900 border-slate-300'
            }`}
          >
            <div id="student-qr-reader" className="w-full"></div>
          </div>

          <input
            type="file"
            ref={fileInputRef}
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleFileUploadScan}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isImageProcessing}
              className="w-full py-2.5 px-3 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-bold flex items-center justify-center space-x-2 shadow-sm transition cursor-pointer"
            >
              <Image className="w-4 h-4" />
              <span>{isImageProcessing ? 'กำลังประมวลผลรูป...' : '📷 ถ่ายรูป / อัปโหลด QR Code'}</span>
            </button>

            <button
              type="button"
              onClick={() => startLiveCameraStream()}
              className={`w-full py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center space-x-2 border transition cursor-pointer ${
                isDarkMode
                  ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300'
              }`}
            >
              <Camera className="w-4 h-4 text-sky-600" />
              <span>ขอเปิดกล้องไลฟ์สดอีกครั้ง</span>
            </button>
          </div>

          <div
            className={`p-2.5 rounded-xl border text-[11px] space-y-1 ${
              isDarkMode ? 'bg-slate-950 border-slate-800 text-slate-400' : 'bg-sky-50/70 border-sky-200 text-slate-700'
            }`}
          >
            <p className={`font-bold ${isDarkMode ? 'text-slate-300' : 'text-slate-800'}`}>
              💡 คำแนะนำสำหรับการเช็คชื่อด้วย QR Code:
            </p>
            <ul className="list-disc list-inside space-y-0.5 text-[10px]">
              <li>สแกน QR Code จากหน้าจออาจารย์ หรืออัปโหลดรูปภาพ QR Code</li>
              <li>ระบบจะทำการตรวจสอบพิกัด GPS และรหัสอุปกรณ์ป้องกันการแทนกันโดยอัตโนมัติ</li>
            </ul>
          </div>
        </div>

        {/* MODE 2: GPS ONLY CHECK-IN */}
        {checkinMode === 'GPS_ONLY' && (
          <div
            className={`p-4 rounded-2xl border space-y-4 ${
              isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-sky-600 dark:text-sky-400 font-bold text-xs">
                <Navigation className="w-4 h-4" />
                <span>เช็คชื่อด้วยพิกัดตำแหน่ง GPS ชั้นเรียน</span>
              </div>
              <button
                type="button"
                onClick={updateLocation}
                className="text-[11px] text-sky-600 dark:text-sky-400 hover:underline flex items-center space-x-1 font-semibold cursor-pointer"
              >
                <RefreshCw className="w-3 h-3" />
                <span>รีเฟรช GPS</span>
              </button>
            </div>

            <div>
              <label className={`block text-xs font-semibold mb-1 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                เลือกคาบเรียนที่กำลังเปิดอยู่ (Active Session):
              </label>
              {activeSessionsList.length === 0 ? (
                <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-700 dark:text-amber-300 text-xs font-medium">
                  ยังไม่มีคาบเรียนเปิดเช็คชื่อในขณะนี้ (อาจารย์ต้องเปิดเช็คชื่อในระบบก่อน)
                </div>
              ) : (
                <select
                  value={selectedSessionId}
                  onChange={(e) => setSelectedSessionId(e.target.value)}
                  className={`w-full border rounded-xl px-3 py-2 text-xs focus:outline-none ${
                    isDarkMode
                      ? 'bg-slate-800 border-slate-700 text-white focus:border-sky-500'
                      : 'bg-white border-slate-300 text-slate-900 focus:border-sky-500 shadow-sm'
                  }`}
                >
                  {activeSessionsList.map(({ session: s, course: c }) => (
                    <option key={s.id} value={s.id}>
                      {c ? `[${c.courseCode}] ${c.courseName}` : 'Ad-hoc Class'} - สัปดาห์ที่ {s.weekNumber}: {s.topic}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div
              className={`p-3 rounded-xl border flex items-center justify-between text-xs ${
                isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
              }`}
            >
              <div className="space-y-0.5">
                <div className={`text-[10px] ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>พิกัด GPS ปัจจุบันของคุณ:</div>
                <div className={`font-mono font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                  {currentCoords ? `${currentCoords.lat.toFixed(5)}, ${currentCoords.lng.toFixed(5)}` : 'กำลังดึงพิกัด GPS...'}
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-emerald-700/10 text-emerald-800 dark:text-emerald-300 text-[10px] font-bold border border-emerald-600/30">
                🟢 Geofence Active
              </span>
            </div>

            <button
              type="button"
              onClick={() => handleProcessCheckin(undefined, 'GPS_ONLY')}
              disabled={submitting || activeSessionsList.length === 0}
              className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center justify-center space-x-2 transition shadow-sm disabled:opacity-50 cursor-pointer"
            >
              <Navigation className="w-4 h-4" />
              <span>{submitting ? 'กำลังตรวจพิกัดและบันทึก...' : 'กดเช็คชื่อด้วย GPS ทันที'}</span>
            </button>
          </div>
        )}

        {/* MODE 3: TOKEN / CLASS PASSCODE */}
        {checkinMode === 'TOKEN' && (
          <div
            className={`p-4 rounded-2xl border space-y-4 ${
              isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'
            }`}
          >
            <div className="flex items-center space-x-2 text-sky-600 dark:text-sky-400 font-bold text-xs">
              <KeyRound className="w-4 h-4" />
              <span>เช็คชื่อด้วยรหัสผ่านเข้าชั้นเรียน (Token Code)</span>
            </div>

            <div>
              <label className={`block text-xs font-semibold mb-1 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                เลือกคาบเรียนที่กำลังเปิดอยู่ (Active Session):
              </label>
              {activeSessionsList.length === 0 ? (
                <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-700 dark:text-amber-300 text-xs font-medium">
                  ยังไม่มีคาบเรียนเปิดเช็คชื่อในขณะนี้ (อาจารย์ต้องเปิดเช็คชื่อในระบบก่อน)
                </div>
              ) : (
                <select
                  value={selectedSessionId}
                  onChange={(e) => setSelectedSessionId(e.target.value)}
                  className={`w-full border rounded-xl px-3 py-2 text-xs focus:outline-none ${
                    isDarkMode
                      ? 'bg-slate-800 border-slate-700 text-white focus:border-sky-500'
                      : 'bg-white border-slate-300 text-slate-900 focus:border-sky-500 shadow-sm'
                  }`}
                >
                  {activeSessionsList.map(({ session: s, course: c }) => (
                    <option key={s.id} value={s.id}>
                      {c ? `[${c.courseCode}] ${c.courseName}` : 'Ad-hoc Class'} - สัปดาห์ที่ {s.weekNumber}: {s.topic}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="space-y-2">
              <label className={`block text-xs font-semibold ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                ป้อนรหัส Token หรือตัวเลข 6 หลักจากหน้าจออาจารย์:
              </label>
              <input
                type="text"
                placeholder="ป้อนรหัส Token เช่น 842910 หรือ Token string"
                value={manualInput}
                onChange={(e) => setManualInput(e.target.value)}
                className={`w-full border rounded-xl px-3.5 py-2.5 text-sm font-mono tracking-wider focus:outline-none ${
                  isDarkMode
                    ? 'bg-slate-800 border-slate-700 text-slate-200 focus:border-sky-500 placeholder-slate-500'
                    : 'bg-white border-slate-300 text-slate-900 focus:border-sky-500 shadow-sm placeholder-slate-400'
                }`}
              />
            </div>

            <button
              type="button"
              onClick={() => {
                if (!manualInput.trim()) {
                  alert('กรุณาป้อนรหัส Token หรือตัวเลข 6 หลักจากหน้าจออาจารย์ก่อนกดส่ง');
                  return;
                }
                handleProcessCheckin(manualInput.trim(), 'TOKEN');
              }}
              disabled={submitting || activeSessionsList.length === 0}
              className="w-full py-3 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs flex items-center justify-center space-x-2 transition shadow-sm disabled:opacity-50 cursor-pointer"
            >
              <KeyRound className="w-4 h-4" />
              <span>{submitting ? 'กำลังตรวจสอบรหัส...' : 'ส่งเช็คชื่อด้วยรหัส Token'}</span>
            </button>
          </div>
        )}

        {/* Status & Feedback Toast */}
        {checkinStatus && (
          <div
            className={`p-4 rounded-2xl border text-xs space-y-1 ${
              checkinStatus.success
                ? isDarkMode
                  ? 'bg-stone-800/90 border-stone-700 text-stone-200'
                  : 'bg-[#efebe2] border-[#ded7c8] text-[#3b3028]'
                : isDarkMode
                ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                : 'bg-rose-50 border-rose-200 text-rose-800'
            }`}
          >
            <div className="flex items-center space-x-2 font-bold text-sm">
              {checkinStatus.success ? (
                <>
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>{checkinStatus.message}</span>
                </>
              ) : (
                <>
                  <ShieldX className="w-5 h-5 text-rose-500 shrink-0" />
                  <span>ตรวจสอบไม่ผ่าน (Check-in Failed)</span>
                </>
              )}
            </div>

            {checkinStatus.success ? (
              <p className={`text-[11px] font-mono ${isDarkMode ? 'text-stone-300' : 'text-stone-600'}`}>
                ระยะห่างจากห้องเรียน: {checkinStatus.distance} เมตร | วิธีที่ใช้: {checkinMode}
              </p>
            ) : (
              <p className={`text-xs leading-relaxed ${isDarkMode ? 'text-rose-200' : 'text-rose-700'}`}>{checkinStatus.error}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
