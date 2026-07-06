import { useState, useEffect } from 'react';
import { Note, PresetLocation, PushNotification } from '../types';
import { presetLocations } from '../data/presets';
import VoiceCommandEngine from './VoiceCommandEngine';
import { 
  Navigation, ToggleLeft, ToggleRight, Radio, Shield, MapPin, 
  Car, Wifi, WifiOff, Bell, ArrowRight, Zap, RefreshCw, Layers, Volume2
} from 'lucide-react';

function getGeocodedAddress(lat: number, lng: number): { address: string; regionBreadcrumb: string } {
  // If close to Durban
  if (Math.abs(lat - (-29.715799)) < 0.005 && Math.abs(lng - 30.991301) < 0.005) {
    return {
      address: '189 Aberdare Drive, Phoenix Industrial, Durban, 4068, South Africa',
      regionBreadcrumb: 'South Africa, KwaZulu-Natal · eThekwini · Durban'
    };
  }

  // Find closest preset from presetLocations
  let closest = presetLocations[0];
  let minDist = Infinity;
  for (const preset of presetLocations) {
    const d = Math.pow(preset.latitude - lat, 2) + Math.pow(preset.longitude - lng, 2);
    if (d < minDist) {
      minDist = d;
      closest = preset;
    }
  }

  return {
    address: closest.address,
    regionBreadcrumb: closest.regionBreadcrumb || 'USA, California · San Francisco County · San Francisco'
  };
}

interface DriveAssistantProps {
  notes: Note[];
  onAddNote: (note: Omit<Note, 'id' | 'createdAt' | 'userId'>) => void;
  currentLocation: { latitude: number; longitude: number };
  setCurrentLocation: (loc: { latitude: number; longitude: number }) => void;
  isOffline: boolean;
  setIsOffline: (offline: boolean) => void;
  pushNotifications: PushNotification[];
  onAddNotification: (notification: Omit<PushNotification, 'id' | 'timestamp'>) => void;
}

export default function DriveAssistant({
  notes,
  onAddNote,
  currentLocation,
  setCurrentLocation,
  isOffline,
  setIsOffline,
  pushNotifications,
  onAddNotification
}: DriveAssistantProps) {
  const [activeLocationIndex, setActiveLocationIndex] = useState(0);
  const [speed, setSpeed] = useState(45);
  const [isDrivingSimulated, setIsDrivingSimulated] = useState(false);
  const [simulatedHeading, setSimulatedHeading] = useState('North-East');

  const activePreset = presetLocations[activeLocationIndex];

  const [isWatchingGps, setIsWatchingGps] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);

  // Synchronize device GPS coordinates
  const triggerGpsCapture = () => {
    if (!navigator.geolocation) {
      setGpsError('Geolocation is not supported by your browser.');
      return;
    }

    setGpsError(null);
    onAddNotification({
      title: 'Requesting GPS...',
      message: 'Contacting device location hardware sensors.',
      type: 'sync'
    });

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setCurrentLocation({ latitude, longitude });
        onAddNotification({
          title: 'Device GPS Synced',
          message: `Physical coordinates captured: ${latitude.toFixed(5)}°, ${longitude.toFixed(5)}°.`,
          type: 'sync'
        });
      },
      (error) => {
        let msg = 'Could not retrieve device location.';
        if (error.code === error.PERMISSION_DENIED) {
          msg = 'Permission denied. Please enable location access in browser settings.';
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          msg = 'Position unavailable. Check your cellular/Wi-Fi connection.';
        } else if (error.code === error.TIMEOUT) {
          msg = 'Sensor request timed out.';
        }
        setGpsError(msg);
        onAddNotification({
          title: 'GPS Connection Failed',
          message: msg,
          type: 'alert'
        });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  // Watch real-time physical GPS updates
  useEffect(() => {
    if (!isWatchingGps) return;

    if (!navigator.geolocation) {
      setGpsError('Geolocation is not supported by your browser.');
      setIsWatchingGps(false);
      return;
    }

    setGpsError(null);
    onAddNotification({
      title: 'Live Tracking Active',
      message: 'Actively tracking physical vehicle location.',
      type: 'sync'
    });

    // Pause auto simulation if hardware GPS is active to prevent fighting over state
    if (isDrivingSimulated) {
      setIsDrivingSimulated(false);
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setCurrentLocation({ latitude, longitude });
      },
      (error) => {
        let msg = 'Live tracking interrupted.';
        if (error.code === error.PERMISSION_DENIED) {
          msg = 'Access denied. Enable location services.';
        }
        setGpsError(msg);
        onAddNotification({
          title: 'Live GPS Error',
          message: msg,
          type: 'alert'
        });
        setIsWatchingGps(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [isWatchingGps, setCurrentLocation, onAddNotification]);

  // Drive simulation tick
  useEffect(() => {
    if (!isDrivingSimulated) return;

    const interval = setInterval(() => {
      // Advance landmark
      setActiveLocationIndex((prev) => {
        const next = (prev + 1) % presetLocations.length;
        const nextLoc = presetLocations[next];
        
        // Update GPS coordinates
        setCurrentLocation({
          latitude: nextLoc.latitude,
          longitude: nextLoc.longitude
        });

        // Trigger push notification for location passby
        onAddNotification({
          title: `Driving Near ${nextLoc.name}`,
          message: `Identified ${nextLoc.category} landmark premises. Hands-free tagging active.`,
          type: 'tag'
        });

        // Randomize speed and heading slightly
        setSpeed(Math.floor(Math.random() * 20) + 35);
        const headings = ['North-East', 'South-East', 'West-North', 'East', 'South'];
        setSimulatedHeading(headings[Math.floor(Math.random() * headings.length)]);

        return next;
      });
    }, 10000); // Shift locations every 10 seconds during simulation

    return () => clearInterval(interval);
  }, [isDrivingSimulated, setCurrentLocation, onAddNotification]);

  const handleManualTag = (category: string, label?: string) => {
    const geo = getGeocodedAddress(currentLocation.latitude, currentLocation.longitude);
    onAddNote({
      latitude: currentLocation.latitude,
      longitude: currentLocation.longitude,
      category: category,
      transcription: label || `Manual premium tagging for ${activePreset.name} premises`,
      address: geo.address,
      voiceCommand: 'Manual HUD Tagging',
      audioDuration: 2.5
    });

    onAddNotification({
      title: `${category} Tag Registered`,
      message: `Point drop at ${currentLocation.latitude.toFixed(4)}, ${currentLocation.longitude.toFixed(4)}.`,
      type: 'tag'
    });
  };

  const handleVoiceCommandRegistered = (text: string, category: string, voiceCommandUsed?: string) => {
    const geo = getGeocodedAddress(currentLocation.latitude, currentLocation.longitude);
    onAddNote({
      latitude: currentLocation.latitude,
      longitude: currentLocation.longitude,
      category: category,
      transcription: text,
      address: geo.address,
      voiceCommand: voiceCommandUsed,
      audioDuration: 4.2
    });

    onAddNotification({
      title: 'Voice Note Registered',
      message: `Speech transcription saved: "${text.slice(0, 30)}..."`,
      type: 'recording'
    });
  };

  // Helper for quick category selections
  const categories = [
    { name: 'Commercial', color: 'bg-emerald-500 hover:bg-emerald-600 text-slate-950 border-emerald-400' },
    { name: 'Enterprise', color: 'bg-amber-500 hover:bg-amber-600 text-slate-950 border-amber-400' },
    { name: 'Tourism', color: 'bg-indigo-500 hover:bg-indigo-600 text-slate-100 border-indigo-400' },
    { name: 'Safety', color: 'bg-rose-500 hover:bg-rose-600 text-slate-100 border-rose-400' },
  ];

  const handleMoveToNextLocation = () => {
    const next = (activeLocationIndex + 1) % presetLocations.length;
    const nextLoc = presetLocations[next];
    setActiveLocationIndex(next);
    setIsWatchingGps(false);
    setCurrentLocation({
      latitude: nextLoc.latitude,
      longitude: nextLoc.longitude
    });

    onAddNotification({
      title: `Moved to ${nextLoc.name}`,
      message: `GPS coordinates synchronized for simulated drive.`,
      type: 'tag'
    });
  };

  const geoInfo = getGeocodedAddress(currentLocation.latitude, currentLocation.longitude);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      
      {/* Col 1: Telemetry & Drive Simulator Controllers */}
      <div className="space-y-4">
        {/* Connection status card */}
        <div className={`border rounded-2xl p-4 transition-all shadow-lg relative overflow-hidden ${
          isOffline 
            ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' 
            : 'bg-slate-950 border-slate-800 text-slate-300'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {isOffline ? <WifiOff className="w-5 h-5 text-amber-400 animate-pulse" /> : <Wifi className="w-5 h-5 text-sky-400" />}
              <div>
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider block">Network Condition</span>
                <span className="text-xs font-mono font-semibold">
                  {isOffline ? 'OFFLINE BUFFER MODE' : 'CLOUD PERSISTENCE ON'}
                </span>
              </div>
            </div>

            <button
              onClick={() => {
                setIsOffline(!isOffline);
                onAddNotification({
                  title: isOffline ? 'Connected to Cloud' : 'Offline Mode Activated',
                  message: isOffline 
                    ? 'Wired back online. Safe to sync all offline buffers.' 
                    : 'Network connection dropped. Notes will queue locally.',
                  type: 'sync'
                });
              }}
              className="flex items-center"
            >
              {isOffline ? (
                <ToggleLeft className="w-9 h-9 text-amber-500 cursor-pointer" />
              ) : (
                <ToggleRight className="w-9 h-9 text-sky-500 cursor-pointer" />
              )}
            </button>
          </div>
          {isOffline && (
            <p className="text-[10px] text-amber-500 mt-2 font-mono leading-normal">
              ⚠️ Simulated tunnel/cellular blackout. Recorded voice entries are securely buffered in device localStorage until connectivity is resumed.
            </p>
          )}
        </div>

        {/* Live Telemetry Hud */}
        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 shadow-2xl relative overflow-hidden">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-1.5">
              <Car className="w-4 h-4 text-sky-400" />
              <span className="text-xs font-display font-semibold text-slate-200 uppercase tracking-wider">Vehicle Telemetry</span>
            </div>
            <span className={`w-2 h-2 rounded-full ${isDrivingSimulated ? 'bg-emerald-500 animate-ping' : 'bg-slate-700'}`} />
          </div>

          <div className="space-y-4">
            {/* Real-time Physical Area Location Card */}
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl relative overflow-hidden">
              <div className="flex items-center justify-between mb-2 pb-2 border-b border-slate-800/50">
                <span className="text-[9px] font-mono font-bold text-sky-400 uppercase tracking-widest flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-sky-400 animate-pulse" />
                  PHYSICAL AREA HUD LOCATION
                </span>
                <span className="text-[8px] font-mono text-slate-500 bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800 uppercase tracking-tighter">
                  {activePreset.name}
                </span>
              </div>

              {/* Exact user requested layout and format */}
              <div className="space-y-2 text-slate-200 leading-normal">
                {/* 1. Address Line */}
                <p className="text-xs font-semibold text-white tracking-tight leading-relaxed">
                  {geoInfo.address}
                </p>

                {/* 2. Directions action link */}
                <div className="flex items-center">
                  <a 
                    href={`https://www.google.com/maps/dir/?api=1&destination=${currentLocation.latitude},${currentLocation.longitude}`}
                    target="_blank"
                    referrerPolicy="no-referrer"
                    rel="noreferrer"
                    className="text-[10px] font-mono font-bold text-sky-400 hover:text-sky-300 hover:underline transition-all flex items-center gap-1 uppercase tracking-wider"
                    title="Open live Google Maps turn-by-turn route directions"
                  >
                    Directions
                    <Navigation className="w-2.5 h-2.5 rotate-45 text-sky-400" />
                  </a>
                </div>

                {/* 3. Regional Breadcrumbs Line */}
                <p className="text-[10px] text-slate-400 font-medium font-mono">
                  {geoInfo.regionBreadcrumb}
                </p>

                {/* 4. Precise Decimal GPS Coordinates */}
                <p className="text-[10.5px] text-slate-500 font-mono tracking-wider bg-slate-950 px-2 py-1 rounded border border-slate-800/80 inline-block font-bold">
                  {currentLocation.latitude.toFixed(6)}, {currentLocation.longitude.toFixed(6)}
                </p>
              </div>
            </div>

            {/* Grid display telemetry specs */}
            <div className="grid grid-cols-3 gap-2 font-mono text-[9px]">
              <div className="p-2 bg-slate-900 border border-slate-800/80 rounded-xl text-center">
                <span className="text-slate-500 block">SPEED</span>
                <span className="text-slate-200 font-bold block mt-0.5">
                  {isDrivingSimulated ? `${speed} MPH` : '0 MPH'}
                </span>
              </div>
              <div className="p-2 bg-slate-900 border border-slate-800/80 rounded-xl text-center">
                <span className="text-slate-500 block">HEADING</span>
                <span className="text-slate-200 font-bold block mt-0.5 truncate">
                  {isDrivingSimulated ? simulatedHeading : 'IDLE'}
                </span>
              </div>
              <div className="p-2 bg-slate-900 border border-slate-800/80 rounded-xl text-center">
                <span className="text-slate-500 block">BUFFERS</span>
                <span className="text-amber-400 font-bold block mt-0.5">
                  {notes.filter(n => !n.synced).length} pend
                </span>
              </div>
            </div>

            {/* Physical Device GPS Control Section */}
            <div className="p-3.5 bg-slate-900 border border-slate-800/80 rounded-xl">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[9px] font-mono font-bold text-slate-500 uppercase tracking-wider block">Physical Device GPS</span>
                {isWatchingGps && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />}
              </div>
              
              <div className="flex gap-2">
                <button
                  onClick={triggerGpsCapture}
                  className="flex-1 py-1.5 px-2.5 bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-sky-500/20 rounded-lg text-[10px] font-mono font-bold transition-all flex items-center justify-center gap-1"
                  title="Capture your active location coordinates once via browser GPS"
                >
                  <Navigation className="w-3 h-3 rotate-45" />
                  SNAP LIVE GPS
                </button>
                
                <button
                  onClick={() => setIsWatchingGps(!isWatchingGps)}
                  className={`flex-1 py-1.5 px-2.5 border rounded-lg text-[10px] font-mono font-bold transition-all flex items-center justify-center gap-1 ${
                    isWatchingGps
                      ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-300'
                  }`}
                  title="Continuously synchronize the system's position with your physical device as you move"
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${isWatchingGps ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
                  {isWatchingGps ? 'LIVE TRACKING ON' : 'ENABLE LIVE GPS'}
                </button>
              </div>

              {gpsError && (
                <p className="text-[9px] text-rose-400 mt-1.5 font-mono leading-tight">{gpsError}</p>
              )}
            </div>

            {/* Simulated Driving Control Buttons */}
            <div className="space-y-2 pt-2 border-t border-slate-800/80">
              <button
                onClick={() => {
                  const nextSim = !isDrivingSimulated;
                  setIsDrivingSimulated(nextSim);
                  if (nextSim) {
                    setIsWatchingGps(false);
                  }
                }}
                className={`w-full py-2.5 px-3 rounded-xl text-xs font-mono font-bold transition-all flex items-center justify-center gap-1.5 ${
                  isDrivingSimulated 
                    ? 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20' 
                    : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20'
                }`}
              >
                <Radio className={`w-3.5 h-3.5 ${isDrivingSimulated ? 'animate-spin' : ''}`} />
                {isDrivingSimulated ? 'PAUSE AUTO DRIVE SIMULATOR' : 'START AUTO DRIVE SIMULATOR'}
              </button>

              <button
                onClick={handleMoveToNextLocation}
                className="w-full py-2.5 px-3 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl text-xs font-mono font-bold text-slate-300 transition-all flex items-center justify-center gap-1.5"
              >
                <span>DRIVE TO NEXT PREMISES</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Col 2: Voice Command cognition engine */}
      <div>
        <VoiceCommandEngine
          onRecordVoiceNote={handleVoiceCommandRegistered}
          isDriving={isDrivingSimulated}
          isOffline={isOffline}
        />
      </div>

      {/* Col 3: Quick manual tagging & real-time notifications */}
      <div className="space-y-4">
        {/* Quick Tagging Buttons */}
        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 shadow-2xl">
          <div className="flex items-center gap-1.5 mb-3.5">
            <Zap className="w-4 h-4 text-amber-400 animate-pulse" />
            <h3 className="text-xs font-display font-semibold text-slate-200 uppercase tracking-wider">Instant HUD Category Tag</h3>
          </div>
          <p className="text-[10px] text-slate-500 font-mono leading-normal mb-4">
            Driving past a business or site? Tap to drop an instant category point at your active GPS coordinates hands-free.
          </p>

          <div className="grid grid-cols-2 gap-2">
            {categories.map((cat) => (
              <button
                key={cat.name}
                onClick={() => handleManualTag(cat.name)}
                className={`py-3 px-2 border rounded-xl text-xs font-mono font-bold transition-all flex flex-col items-center justify-center gap-1 hover:scale-[1.02] active:scale-[0.98] ${cat.color}`}
              >
                <Layers className="w-4 h-4 mb-0.5 opacity-80" />
                <span>{cat.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Push notifications stack */}
        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 shadow-2xl h-64 flex flex-col">
          <div className="flex items-center justify-between mb-3 shrink-0">
            <div className="flex items-center gap-1.5">
              <Bell className="w-4 h-4 text-sky-400 animate-bounce" />
              <h3 className="text-xs font-display font-semibold text-slate-200 uppercase tracking-wider">Real-Time Alerts</h3>
            </div>
            <span className="text-[8px] font-mono text-slate-500">LIVE HUD PUSH STACK</span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
            {pushNotifications.length === 0 ? (
              <div className="h-full flex items-center justify-center text-center">
                <p className="text-[10px] text-slate-600 font-mono">No driving alert signals in stack.</p>
              </div>
            ) : (
              pushNotifications.map((noti) => (
                <div 
                  key={noti.id} 
                  className={`p-2 rounded-lg border text-[10px] font-mono leading-relaxed animate-fadeIn ${
                    noti.type === 'sync' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300' :
                    noti.type === 'alert' ? 'bg-rose-500/10 border-rose-500/20 text-rose-300' :
                    noti.type === 'recording' ? 'bg-sky-500/10 border-sky-500/20 text-sky-300' :
                    'bg-slate-900 border-slate-800 text-slate-300'
                  }`}
                >
                  <div className="flex justify-between items-center mb-0.5">
                    <span className="font-bold uppercase tracking-wider text-[8px]">
                      {noti.type === 'sync' ? '☁️ SYNC CONSOLE' : 
                       noti.type === 'alert' ? '🚨 EMERGENCY' : 
                       noti.type === 'recording' ? '🎙️ VOICE ENGINE' : '🏷️ SYSTEM TAG'}
                    </span>
                    <span className="text-[8px] text-slate-500">
                      {new Date(noti.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                  </div>
                  <div className="font-semibold text-[9.5px]">{noti.title}</div>
                  <div className="text-[9px] text-slate-400 mt-0.5">{noti.message}</div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

    </div>
  );
}
