import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Note } from '../types';
import VoiceCommandEngine from './VoiceCommandEngine';
import { 
  Navigation, MapPin, Check, Volume2, VolumeX, ShieldAlert, 
  AlertTriangle, Fuel, Compass, Sparkles, Send
} from 'lucide-react';

async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`,
      { headers: { 'User-Agent': 'RADIR-Drive/1.0' } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data?.display_name || null;
  } catch {
    return null;
  }
}

let geocodeCache = new Map<string, string>();

function getCachedAddress(lat: number, lng: number): string {
  const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;
  const cached = geocodeCache.get(key);
  if (cached) return cached;

  reverseGeocode(lat, lng).then((result) => {
    if (result) geocodeCache.set(key, result);
  });

  return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
}

interface DriveAssistantProps {
  onAddNote: (note: Omit<Note, 'id' | 'createdAt' | 'userId'>) => void;
  currentLocation: { latitude: number; longitude: number } | null;
  setCurrentLocation: (loc: { latitude: number; longitude: number } | null) => void;
  isOffline?: boolean;
}

export default function DriveAssistant({
  onAddNote,
  currentLocation,
  setCurrentLocation,
  isOffline = false
}: DriveAssistantProps) {
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [isGpsActive, setIsGpsActive] = useState(true);
  const [audioFeedbackEnabled, setAudioFeedbackEnabled] = useState(true);
  const [quickNoteText, setQuickNoteText] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Default fallback SF coordinates if GPS lock is pending or denied
  const activeLat = currentLocation?.latitude ?? 37.7749;
  const activeLng = currentLocation?.longitude ?? -122.4194;
  const activeAddress = getCachedAddress(activeLat, activeLng);

  // Continuous Real-time GPS Tracking via watchPosition
  useEffect(() => {
    if (!isGpsActive || !navigator.geolocation) {
      if (!navigator.geolocation) {
        setGpsError('Geolocation API not supported by browser environment.');
      }
      return;
    }

    setGpsError(null);
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setCurrentLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        setGpsError(null);
      },
      (error) => {
        console.warn('GPS Watch position error:', error.message);
        let msg = 'Using simulator GPS coordinates.';
        if (error.code === error.PERMISSION_DENIED) msg = 'Location access blocked. Using live map simulator coordinates.';
        else if (error.code === error.POSITION_UNAVAILABLE) msg = 'GPS signal searching...';
        else if (error.code === error.TIMEOUT) msg = 'GPS lock timeout.';
        setGpsError(msg);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 3000 }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [isGpsActive, setCurrentLocation]);

  // Audio Confirmation Helper (Speech Synthesis)
  const speakConfirmation = useCallback((text: string) => {
    if (audioFeedbackEnabled && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1.0;
        utterance.pitch = 1.0;
        utterance.volume = 1.0;
        window.speechSynthesis.speak(utterance);
      } catch (e) {
        console.warn('Speech synthesis error:', e);
      }
    }
  }, [audioFeedbackEnabled]);

  // Show visual feedback toast
  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  }, []);

  // Universal Instant Note Dispatcher (0-Step & 1-Tap)
  const dispatchDrivingNote = useCallback((
    transcription: string, 
    category: string, 
    voiceCommand?: string
  ) => {
    const address = getCachedAddress(activeLat, activeLng);
    onAddNote({
      latitude: activeLat,
      longitude: activeLng,
      category,
      transcription,
      address,
      voiceCommand
    });

    const statusMsg = `Saved: "${transcription.slice(0, 32)}${transcription.length > 32 ? '...' : ''}" [${category}]`;
    showToast(statusMsg);
  }, [activeLat, activeLng, onAddNote, showToast]);

  // Handle Voice Assistant Spoken Notes
  const handleVoiceRecord = useCallback((text: string, category: string, voiceCommandUsed?: string) => {
    dispatchDrivingNote(text, category, voiceCommandUsed);
  }, [dispatchDrivingNote]);

  // 1-Tap Action Handlers
  const handleOneTapPreset = (category: string, defaultText: string, ttsConfirmation: string) => {
    dispatchDrivingNote(defaultText, category);
    speakConfirmation(ttsConfirmation);
  };

  const handleQuickTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickNoteText.trim()) return;
    dispatchDrivingNote(quickNoteText.trim(), 'Quick Note');
    speakConfirmation('Quick note saved');
    setQuickNoteText('');
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      
      {/* Toast Banner for Immediate Hands-Free Confirmation */}
      {toastMessage && (
        <div className="bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 p-3.5 rounded-2xl flex items-center justify-between shadow-xl animate-fadeIn backdrop-blur-md">
          <div className="flex items-center gap-2.5">
            <Check className="w-5 h-5 text-emerald-400 shrink-0" />
            <span className="text-xs font-mono font-medium leading-tight">{toastMessage}</span>
          </div>
          <span className="text-[9px] font-mono uppercase bg-emerald-500/30 text-emerald-200 px-2 py-0.5 rounded border border-emerald-400/30">
            AUTO-LOGGED
          </span>
        </div>
      )}

      {/* Driver Controls Header & GPS Status */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl backdrop-blur-md">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400 shrink-0">
              <Navigation className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-display font-bold text-slate-100 uppercase tracking-wider">
                  Hands-Free Driving Console HUD
                </h2>
                <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[9px] font-mono rounded uppercase">
                  Zero-Friction
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono mt-0.5 truncate max-w-md">
                📍 {activeAddress}
              </p>
            </div>
          </div>

          {/* Controls: Audio TTS Toggle & GPS Lock indicator */}
          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              onClick={() => {
                const nextState = !audioFeedbackEnabled;
                setAudioFeedbackEnabled(nextState);
                if (nextState) speakConfirmation('Audio feedback enabled');
              }}
              className={`px-3 py-1.5 rounded-xl border text-xs font-mono flex items-center gap-1.5 transition-all ${
                audioFeedbackEnabled
                  ? 'bg-sky-500/15 border-sky-500/40 text-sky-300'
                  : 'bg-slate-800 border-slate-700 text-slate-500'
              }`}
              title="Toggle Text-to-Speech audio confirmations"
            >
              {audioFeedbackEnabled ? <Volume2 className="w-3.5 h-3.5 text-sky-400" /> : <VolumeX className="w-3.5 h-3.5" />}
              <span>{audioFeedbackEnabled ? 'AUDIO ON' : 'MUTED'}</span>
            </button>

            <div className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-[10px] font-mono text-slate-400 flex items-center gap-1.5">
              <div className={`w-2 h-2 rounded-full ${currentLocation ? 'bg-emerald-400 animate-ping' : 'bg-amber-400'}`} />
              <span>{currentLocation ? 'LIVE GPS WATCH' : 'SIMULATOR GPS'}</span>
            </div>
          </div>
        </div>

        {gpsError && (
          <div className="mt-3 p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-[11px] text-amber-300 font-mono">
            ⚠️ {gpsError}
          </div>
        )}
      </div>

      {/* 1-TAP HIGH-CONTRAST DRIVING SHORTCUTS GRID */}
      <div>
        <div className="flex items-center justify-between mb-3 px-1">
          <span className="text-xs font-display font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-sky-400" />
            1-Tap Instant Driving Shortcuts (Single Touch)
          </span>
          <span className="text-[10px] font-mono text-slate-500">NO EXTRA TAPS NEEDED</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {/* 🛑 Traffic Alert */}
          <button
            onClick={() => handleOneTapPreset('Traffic', 'Heavy traffic congestion', 'Traffic alert logged')}
            className="p-4 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 hover:border-amber-400/60 rounded-2xl flex flex-col items-center justify-center text-center gap-2 transition-all active:scale-95 group shadow-lg"
          >
            <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-400 group-hover:scale-110 transition-transform">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-display font-bold text-amber-300 block">🛑 Traffic Alert</span>
              <span className="text-[9px] font-mono text-amber-400/80 block mt-0.5">1-Tap Log Traffic</span>
            </div>
          </button>

          {/* 🚧 Road Hazard */}
          <button
            onClick={() => handleOneTapPreset('Safety', 'Road hazard / pothole detected', 'Safety hazard logged')}
            className="p-4 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 hover:border-rose-400/60 rounded-2xl flex flex-col items-center justify-center text-center gap-2 transition-all active:scale-95 group shadow-lg"
          >
            <div className="w-10 h-10 rounded-full bg-rose-500/20 flex items-center justify-center text-rose-400 group-hover:scale-110 transition-transform">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-display font-bold text-rose-300 block">🚧 Road Hazard</span>
              <span className="text-[9px] font-mono text-rose-400/80 block mt-0.5">1-Tap Log Safety</span>
            </div>
          </button>

          {/* ⛽ Fuel / Rest Stop */}
          <button
            onClick={() => handleOneTapPreset('Rest Stop', 'Fuel station / rest area', 'Fuel stop logged')}
            className="p-4 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 hover:border-emerald-400/60 rounded-2xl flex flex-col items-center justify-center text-center gap-2 transition-all active:scale-95 group shadow-lg"
          >
            <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 group-hover:scale-110 transition-transform">
              <Fuel className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-display font-bold text-emerald-300 block">⛽ Fuel / Rest</span>
              <span className="text-[9px] font-mono text-emerald-400/80 block mt-0.5">1-Tap Log Rest</span>
            </div>
          </button>

          {/* 📍 Quick Pin */}
          <button
            onClick={() => handleOneTapPreset('Saved Location', 'Pinned driving location', 'Location pinned')}
            className="p-4 bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/30 hover:border-sky-400/60 rounded-2xl flex flex-col items-center justify-center text-center gap-2 transition-all active:scale-95 group shadow-lg"
          >
            <div className="w-10 h-10 rounded-full bg-sky-500/20 flex items-center justify-center text-sky-400 group-hover:scale-110 transition-transform">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-display font-bold text-sky-300 block">📍 Quick Pin</span>
              <span className="text-[9px] font-mono text-sky-400/80 block mt-0.5">1-Tap Pin Location</span>
            </div>
          </button>
        </div>
      </div>

      {/* INTEGRATED HANDS-FREE VOICE COMMAND ENGINE */}
      <VoiceCommandEngine
        onRecordVoiceNote={handleVoiceRecord}
        isDriving={true}
        isOffline={isOffline}
        audioFeedbackEnabled={audioFeedbackEnabled}
      />

      {/* QUICK SINGLE-LINE DRIVER TEXT FORM (OPTIONAL OVERRIDE) */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4">
        <form onSubmit={handleQuickTextSubmit} className="flex gap-2">
          <input
            type="text"
            placeholder="Type quick driver note if stopped (optional)..."
            value={quickNoteText}
            onChange={(e) => setQuickNoteText(e.target.value)}
            className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-sky-500 font-mono"
          />
          <button
            type="submit"
            disabled={!quickNoteText.trim()}
            className="bg-sky-500 hover:bg-sky-600 disabled:bg-slate-800 text-slate-950 disabled:text-slate-600 font-semibold px-4 py-2.5 rounded-xl text-xs transition-colors flex items-center gap-1.5 shrink-0 font-mono"
          >
            <Send className="w-3.5 h-3.5" />
            <span>SAVE</span>
          </button>
        </form>
      </div>

    </div>
  );
}

