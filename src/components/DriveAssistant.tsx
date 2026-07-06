import { useState, useCallback } from 'react';
import { Note } from '../types';
import { Navigation, MapPin, Check } from 'lucide-react';

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
}

export default function DriveAssistant({
  onAddNote,
  currentLocation,
  setCurrentLocation,
}: DriveAssistantProps) {
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');
  const [isFinding, setIsFinding] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const findLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setGpsError('Geolocation is not supported by your browser.');
      return;
    }
    setIsFinding(true);
    setGpsError(null);
    setSaved(false);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCurrentLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        setIsFinding(false);
      },
      (error) => {
        let msg = 'Could not retrieve location.';
        if (error.code === error.PERMISSION_DENIED) msg = 'Permission denied. Enable location access in your browser settings.';
        else if (error.code === error.POSITION_UNAVAILABLE) msg = 'Position unavailable. Check your connection.';
        else if (error.code === error.TIMEOUT) msg = 'GPS request timed out.';
        setGpsError(msg);
        setIsFinding(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }, [setCurrentLocation]);

  const handleSave = useCallback(async () => {
    if (!currentLocation) return;
    setIsSaving(true);
    const address = getCachedAddress(currentLocation.latitude, currentLocation.longitude);
    onAddNote({
      latitude: currentLocation.latitude,
      longitude: currentLocation.longitude,
      category: 'Saved',
      transcription: noteText || 'Saved location',
      address,
    });
    setNoteText('');
    setIsSaving(false);
    setSaved(true);
    setCurrentLocation(null);
  }, [currentLocation, noteText, onAddNote, setCurrentLocation]);

  const address = currentLocation ? getCachedAddress(currentLocation.latitude, currentLocation.longitude) : '';

  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 max-w-lg mx-auto">
      <MapPin className="w-10 h-10 text-sky-400 mb-4" />

      <h2 className="text-lg font-semibold text-slate-100 mb-1">Location Tracker</h2>
      <p className="text-xs text-slate-500 font-mono mb-8 text-center">
        Find your current location, then save it with a note.
      </p>

      {gpsError && (
        <div className="w-full mb-4 p-3 bg-rose-500/15 border border-rose-500/20 rounded-xl text-xs text-rose-300 font-mono text-center">
          {gpsError}
        </div>
      )}

      {!currentLocation ? (
        <button
          onClick={findLocation}
          disabled={isFinding}
          className="w-full py-4 bg-sky-500 hover:bg-sky-600 disabled:bg-slate-800 text-slate-950 disabled:text-slate-500 font-semibold rounded-xl text-sm transition-all shadow-lg flex items-center justify-center gap-2"
        >
          <Navigation className="w-5 h-5" />
          {isFinding ? 'Finding location...' : 'Find Location'}
        </button>
      ) : (
        <div className="w-full space-y-4 animate-fadeIn">
          <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl">
            <p className="text-xs text-slate-500 font-mono mb-1">YOUR LOCATION</p>
            <p className="text-sm text-white font-medium break-words">{address}</p>
            <p className="text-[10px] text-slate-600 font-mono mt-2">
              {currentLocation.latitude.toFixed(6)}, {currentLocation.longitude.toFixed(6)}
            </p>
          </div>

          <textarea
            placeholder="Add a note (optional)..."
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            rows={2}
            className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-sky-500 resize-none font-mono"
          />

          <div className="flex gap-3">
            <button
              onClick={() => { setCurrentLocation(null); setSaved(false); }}
              className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm font-medium transition-all"
            >
              Back
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex-[2] py-3 bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-800 text-slate-950 disabled:text-slate-500 font-semibold rounded-xl text-sm transition-all shadow-lg flex items-center justify-center gap-2"
            >
              <Check className="w-5 h-5" />
              {isSaving ? 'Saving...' : saved ? 'Saved!' : 'Save Location'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
