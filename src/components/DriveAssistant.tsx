import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Note } from '../types';
import VoiceCommandEngine from './VoiceCommandEngine';
import { 
  Navigation, MapPin, Check, Volume2, VolumeX, ShieldAlert, 
  AlertTriangle, Fuel, Compass, Sparkles, Send, Trash2, Filter, 
  Search, ChevronDown, ChevronUp, Play, ExternalLink, Radio
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

function formatRelativeTime(dateString: string): string {
  try {
    const diffMs = Date.now() - new Date(dateString).getTime();
    const diffSec = Math.floor(diffMs / 1000);
    if (diffSec < 60) return 'Just now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${Math.floor(diffHours / 24)}d ago`;
  } catch {
    return 'Recently';
  }
}

interface DriveAssistantProps {
  onAddNote: (note: Omit<Note, 'id' | 'createdAt' | 'userId'>) => void;
  currentLocation: { latitude: number; longitude: number } | null;
  setCurrentLocation: (loc: { latitude: number; longitude: number } | null) => void;
  isOffline?: boolean;
  notes?: Note[];
  onSelectNote?: (note: Note) => void;
  onDeleteNote?: (id: string) => void;
  selectedNote?: Note | null;
}

export default function DriveAssistant({
  onAddNote,
  currentLocation,
  setCurrentLocation,
  isOffline = false,
  notes = [],
  onSelectNote,
  onDeleteNote,
  selectedNote
}: DriveAssistantProps) {
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [isGpsActive, setIsGpsActive] = useState(true);
  const [audioFeedbackEnabled, setAudioFeedbackEnabled] = useState(true);
  const [quickNoteText, setQuickNoteText] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [selectedFilter, setSelectedFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [isTrayExpanded, setIsTrayExpanded] = useState<boolean>(true);
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

  // Filtered Notes for the Mobile Quick Pins Feed
  const filteredNotes = notes.filter(note => {
    const matchesCategory = selectedFilter === 'all' || 
      note.category.toLowerCase().includes(selectedFilter.toLowerCase());
    const matchesSearch = !searchTerm || 
      note.transcription.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (note.address && note.address.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  const getCategoryBadgeClass = (category: string) => {
    const cat = category.toLowerCase();
    if (cat.includes('safety') || cat.includes('hazard')) {
      return 'bg-rose-500/20 text-rose-300 border-rose-500/30';
    }
    if (cat.includes('traffic')) {
      return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
    }
    if (cat.includes('rest')) {
      return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
    }
    if (cat.includes('saved') || cat.includes('pin')) {
      return 'bg-sky-500/20 text-sky-300 border-sky-500/30';
    }
    return 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30';
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

      {/* 1-TAP PROMINENT QUICK PIN FEATURE */}
      <div>
        <div className="flex items-center justify-between mb-3 px-1">
          <span className="text-xs font-display font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-sky-400" />
            Instant Quick Pin (Hands-Free / Single Touch)
          </span>
          <span className="text-[10px] font-mono text-slate-500">1-TAP ZERO FRICTION</span>
        </div>

        {/* Giant Single Quick Pin Action Button */}
        <button
          onClick={() => handleOneTapPreset('Quick Pin', 'Pinned driving location', 'Location pinned at current position')}
          className="w-full p-6 bg-gradient-to-r from-sky-500/20 via-indigo-500/20 to-sky-500/20 hover:from-sky-500/30 hover:to-indigo-500/30 border border-sky-500/40 hover:border-sky-400 rounded-3xl flex items-center justify-center gap-4 transition-all active:scale-[0.98] shadow-2xl group"
        >
          <div className="w-14 h-14 rounded-2xl bg-sky-500/30 border border-sky-400/40 flex items-center justify-center text-sky-300 group-hover:scale-110 transition-transform shadow-[0_0_20px_rgba(56,189,248,0.3)]">
            <MapPin className="w-7 h-7" />
          </div>
          <div className="text-left">
            <span className="text-base font-display font-bold text-white block">📍 QUICK PIN LOCATION</span>
            <span className="text-xs font-mono text-sky-300/90 block mt-0.5">
              Instantly log your live GPS coordinates with 1 touch or voice
            </span>
          </div>
        </button>
      </div>

      {/* MOBILE-RESPONSIVE QUICK PINS TRAY & SHEET */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-2xl backdrop-blur-md">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
              <MapPin className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-display font-bold text-slate-100 uppercase tracking-wider flex items-center gap-2">
                <span>My Quick Pins</span>
                <span className="px-2 py-0.5 bg-slate-800 text-sky-400 border border-slate-700 rounded-full font-mono text-[10px]">
                  {filteredNotes.length}
                </span>
              </h3>
              <p className="text-[10px] text-slate-500 font-mono">
                Mobile-responsive interactive location feed
              </p>
            </div>
          </div>

          <button
            onClick={() => setIsTrayExpanded(!isTrayExpanded)}
            className="p-1.5 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-xs font-mono transition-all flex items-center gap-1"
          >
            {isTrayExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            <span className="hidden sm:inline">{isTrayExpanded ? 'Minimize' : 'Expand Pins'}</span>
          </button>
        </div>

        {isTrayExpanded && (
          <div className="space-y-4 animate-fadeIn">
            {/* Filter Pills & Search Bar */}
            <div className="flex flex-col sm:flex-row gap-2 justify-between items-stretch sm:items-center">
              {/* Category Pills */}
              <div className="flex gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
                {[
                  { id: 'all', label: 'All' },
                  { id: 'Traffic', label: '🛑 Traffic' },
                  { id: 'Safety', label: '🚧 Safety' },
                  { id: 'Rest Stop', label: '⛽ Rest' },
                  { id: 'Saved', label: '📍 Pins' },
                  { id: 'Voice', label: '🎙️ Voice' }
                ].map(filter => (
                  <button
                    key={filter.id}
                    onClick={() => setSelectedFilter(filter.id)}
                    className={`px-2.5 py-1 rounded-xl text-[10px] font-mono font-medium transition-all shrink-0 border ${
                      selectedFilter === filter.id
                        ? 'bg-sky-500/20 border-sky-500 text-sky-300 shadow-[0_0_10px_rgba(56,189,248,0.2)]'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>

              {/* Quick Search */}
              <div className="relative min-w-[160px]">
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  placeholder="Filter pins..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-[10px] text-slate-200 placeholder-slate-600 focus:outline-none focus:border-sky-500 font-mono"
                />
              </div>
            </div>

            {/* Quick Pins List: Horizontal Touch Carousel on Mobile, Responsive Grid on Desktop */}
            {filteredNotes.length === 0 ? (
              <div className="p-8 text-center bg-slate-950/60 border border-slate-800/80 rounded-xl">
                <Radio className="w-6 h-6 text-slate-600 mx-auto mb-2 animate-pulse" />
                <p className="text-xs text-slate-400 font-mono">No driving quick pins matching filter.</p>
                <p className="text-[10px] text-slate-600 font-mono mt-1">
                  Use the 1-Tap buttons or Voice Assistant above to record your first pin!
                </p>
              </div>
            ) : (
              <div className="flex gap-3 overflow-x-auto pb-3 snap-x sm:grid sm:grid-cols-2 md:grid-cols-3 sm:overflow-visible scrollbar-thin">
                {filteredNotes.map(note => {
                  const isSelected = selectedNote?.id === note.id;
                  return (
                    <div
                      key={note.id}
                      className={`min-w-[260px] sm:min-w-0 snap-start bg-slate-950 border rounded-xl p-3.5 flex flex-col justify-between transition-all hover:border-slate-700 shadow-md ${
                        isSelected ? 'border-sky-500 ring-1 ring-sky-500/50 bg-slate-900/90' : 'border-slate-800/90'
                      }`}
                    >
                      <div>
                        {/* Header: Category Badge & Time */}
                        <div className="flex items-center justify-between mb-2">
                          <span className={`px-2 py-0.5 rounded border text-[9px] font-mono uppercase tracking-wider font-semibold ${getCategoryBadgeClass(note.category)}`}>
                            {note.category}
                          </span>
                          <span className="text-[9px] font-mono text-slate-500">
                            {formatRelativeTime(note.createdAt)}
                          </span>
                        </div>

                        {/* Note Transcription */}
                        <p className="text-xs text-slate-200 font-mono line-clamp-2 leading-relaxed mb-2 font-medium">
                          "{note.transcription}"
                        </p>

                        {/* Location Address */}
                        <p className="text-[10px] text-slate-500 font-mono truncate mb-3 flex items-center gap-1">
                          <Compass className="w-3 h-3 text-slate-600 shrink-0" />
                          <span>{note.address || `${note.latitude.toFixed(4)}°, ${note.longitude.toFixed(4)}°`}</span>
                        </p>
                      </div>

                      {/* Touch Actions Bar */}
                      <div className="flex items-center justify-between pt-2 border-t border-slate-900 text-[10px] font-mono gap-1">
                        {/* Center on Map */}
                        <button
                          onClick={() => {
                            setCurrentLocation({ latitude: note.latitude, longitude: note.longitude });
                            if (onSelectNote) onSelectNote(note);
                            speakConfirmation(`Snapped map to ${note.category}`);
                          }}
                          className="px-2.5 py-1 bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-sky-500/30 rounded-lg flex items-center gap-1 transition-colors"
                          title="Snap map to this pin location"
                        >
                          <Navigation className="w-3 h-3" />
                          <span>Center Map</span>
                        </button>

                        <div className="flex items-center gap-1">
                          {/* Speak Note */}
                          <button
                            onClick={() => speakConfirmation(note.transcription)}
                            className="p-1.5 text-slate-400 hover:text-sky-300 bg-slate-900 hover:bg-slate-800 rounded-lg border border-slate-800 transition-colors"
                            title="Speak note transcription"
                          >
                            <Volume2 className="w-3.5 h-3.5" />
                          </button>

                          {/* Delete Pin */}
                          {onDeleteNote && (
                            <button
                              onClick={() => onDeleteNote(note.id)}
                              className="p-1.5 text-slate-500 hover:text-rose-400 bg-slate-900 hover:bg-slate-800 rounded-lg border border-slate-800 transition-colors"
                              title="Delete pin record"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
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


