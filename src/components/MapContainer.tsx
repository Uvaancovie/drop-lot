import React, { useState, useEffect, useRef } from 'react';
import { Note, PresetLocation } from '../types';
import { MapPin, Navigation, Plus, Info, RefreshCw } from 'lucide-react';

interface MapContainerProps {
  notes: Note[];
  currentLocation: { latitude: number; longitude: number } | null;
  onMapClick?: (lat: number, lng: number) => void;
  onSelectNote?: (note: Note) => void;
  selectedNote: Note | null;
}

export default function MapContainer({
  notes,
  currentLocation,
  onMapClick,
  onSelectNote,
  selectedNote
}: MapContainerProps) {
  const [apiKey, setApiKey] = useState<string>(() => {
    return (import.meta as any).env.VITE_GOOGLE_MAPS_PLATFORM_KEY || localStorage.getItem('GOOGLE_MAPS_KEY') || '';
  });
  const [isGmapsLoaded, setIsGmapsLoaded] = useState(false);
  const [useMockMap, setUseMockMap] = useState(true);
  const mapRef = useRef<HTMLDivElement>(null);
  const googleMapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);

  // Boundaries for San Francisco Map simulation
  // 37.77 to 37.81 Lat
  // -122.43 to -122.39 Lng
  const minLat = 37.7700;
  const maxLat = 37.8150;
  const minLng = -122.4300;
  const maxLng = -122.3900;

  // Convert GPS coordinates to percentage positions for the vector map
  const getXY = (lat: number, lng: number) => {
    const x = ((lng - minLng) / (maxLng - minLng)) * 100;
    // Invert Y as higher latitude means further North (top)
    const y = (1 - (lat - minLat) / (maxLat - minLat)) * 100;
    return { 
      x: Math.max(5, Math.min(95, x)), 
      y: Math.max(5, Math.min(95, y)) 
    };
  };

  // Google Maps Dynamic Loader
  useEffect(() => {
    if (!apiKey || useMockMap) {
      setIsGmapsLoaded(false);
      return;
    }

    // Check if script already exists
    const existingScript = document.getElementById('google-maps-script');
    if (existingScript) {
      if (window.google?.maps) {
        setIsGmapsLoaded(true);
      }
      return;
    }

    const script = document.createElement('script');
    script.id = 'google-maps-script';
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&callback=initMap`;
    script.async = true;
    script.defer = true;

    (window as any).initMap = () => {
      setIsGmapsLoaded(true);
    };

    document.head.appendChild(script);

    return () => {
      // Clean up callback but keep script to avoid reloading
      delete (window as any).initMap;
    };
  }, [apiKey, useMockMap]);

  // Handle Google Maps Initialization & Markers
  useEffect(() => {
    if (!isGmapsLoaded || !mapRef.current || useMockMap) return;

    try {
      const center = currentLocation ? { lat: currentLocation.latitude, lng: currentLocation.longitude } : { lat: 37.7749, lng: -122.4194 };
      
      // Initialize Map
      const map = new window.google.maps.Map(mapRef.current, {
        center: center,
        zoom: 14,
        styles: [
          { elementType: 'geometry', stylers: [{ color: '#242f3e' }] },
          { elementType: 'labels.text.stroke', stylers: [{ color: '#242f3e' }] },
          { elementType: 'labels.text.fill', stylers: [{ color: '#746855' }] },
          {
            featureType: 'administrative.locality',
            elementType: 'labels.text.fill',
            stylers: [{ color: '#d59563' }]
          },
          {
            featureType: 'poi',
            elementType: 'labels.text.fill',
            stylers: [{ color: '#d59563' }]
          },
          {
            featureType: 'road',
            elementType: 'geometry',
            stylers: [{ color: '#38414e' }]
          },
          {
            featureType: 'road',
            elementType: 'geometry.stroke',
            stylers: [{ color: '#212a37' }]
          },
          {
            featureType: 'road',
            elementType: 'labels.text.fill',
            stylers: [{ color: '#9ca5b3' }]
          },
          {
            featureType: 'water',
            elementType: 'geometry',
            stylers: [{ color: '#17263c' }]
          }
        ]
      });

      googleMapInstanceRef.current = map;

      // Add listener to click map and add note
      map.addListener('click', (e: any) => {
        if (onMapClick && e.latLng) {
          onMapClick(e.latLng.lat(), e.latLng.lng());
        }
      });

      // Render driver marker
      const driverPos = currentLocation ? { lat: currentLocation.latitude, lng: currentLocation.longitude } : center;
      const driverMarker = new window.google.maps.Marker({
        position: driverPos,
        map: map,
        title: 'Your Location',
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 8,
          fillColor: '#3b82f6',
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 2,
        }
      });
      markersRef.current.push(driverMarker);

      // Render notes markers
      notes.forEach((note) => {
        const markerColor = getCategoryColorHex(note.category);
        const marker = new window.google.maps.Marker({
          position: { lat: note.latitude, lng: note.longitude },
          map: map,
          title: `${note.category}: ${note.transcription.slice(0, 30)}`,
          icon: {
            path: 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z',
            fillColor: markerColor,
            fillOpacity: 0.9,
            strokeColor: '#ffffff',
            strokeWeight: 1,
            scale: 1.2,
            anchor: new window.google.maps.Point(12, 21)
          }
        });

        marker.addListener('click', () => {
          if (onSelectNote) onSelectNote(note);
        });

        markersRef.current.push(marker);
      });

    } catch (error) {
      console.error('Error rendering Google Map:', error);
    }

    return () => {
      // Clear existing markers
      markersRef.current.forEach(m => m.setMap(null));
      markersRef.current = [];
    };
  }, [isGmapsLoaded, notes, currentLocation, useMockMap]);

  // Helper to get tailwind style for categories
  const getCategoryColorClass = (cat: string) => {
    switch (cat?.toLowerCase()) {
      case 'commercial': return 'bg-emerald-500 border-emerald-400 text-emerald-100';
      case 'enterprise': return 'bg-amber-500 border-amber-400 text-amber-100';
      case 'tourism': return 'bg-indigo-500 border-indigo-400 text-indigo-100';
      case 'safety': return 'bg-rose-500 border-rose-400 text-rose-100';
      default: return 'bg-sky-500 border-sky-400 text-sky-100';
    }
  };

  const getCategoryColorHex = (cat: string) => {
    switch (cat?.toLowerCase()) {
      case 'commercial': return '#10b981';
      case 'enterprise': return '#f59e0b';
      case 'tourism': return '#6366f1';
      case 'safety': return '#f43f5e';
      default: return '#0ea5e9';
    }
  };

  // Convert active driver coordinates to percentages for placement on simulated radar grid
  const driverXY = currentLocation ? getXY(currentLocation.latitude, currentLocation.longitude) : null;

  const handleMockClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!onMapClick || !mapRef.current) return;
    const rect = mapRef.current.getBoundingClientRect();
    const clickX = ((e.clientX - rect.left) / rect.width) * 100;
    const clickY = ((e.clientY - rect.top) / rect.height) * 100;

    // Convert percentage back to coordinates
    const clickedLng = minLng + (clickX / 100) * (maxLng - minLng);
    const clickedLat = minLat + (1 - clickY / 100) * (maxLat - minLat);

    onMapClick(clickedLat, clickedLng);
  };

  const saveCustomKey = (key: string) => {
    setApiKey(key);
    localStorage.setItem('GOOGLE_MAPS_KEY', key);
    setUseMockMap(false);
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden relative shadow-inner">
      {/* Map Control Bar */}
      <div className="bg-slate-950/80 backdrop-blur-md px-4 py-2 flex items-center justify-between border-b border-slate-800 z-10">
        <div className="flex items-center gap-2">
          <Navigation className="w-4 h-4 text-sky-400 animate-pulse" />
          <span className="text-xs font-mono font-medium text-slate-300">
            RADIR Driving HUD - {currentLocation ? `${currentLocation.latitude.toFixed(4)}°, ${currentLocation.longitude.toFixed(4)}°` : 'Awaiting GPS...'}
          </span>
        </div>
        
        <div className="flex gap-2">
          <button
            onClick={() => setUseMockMap(p => !p)}
            className={`px-3 py-1 rounded-md text-[10px] font-mono font-semibold transition-all flex items-center gap-1 ${
              useMockMap 
                ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20 hover:bg-sky-500/20' 
                : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
            }`}
          >
            <RefreshCw className="w-3 h-3" />
            {useMockMap ? 'Switch to Google Maps' : 'Viewing Google Maps'}
          </button>
        </div>
      </div>

      {/* Map Stage */}
      <div 
        ref={mapRef}
        onClick={useMockMap ? handleMockClick : undefined}
        className="flex-1 w-full relative overflow-hidden select-none cursor-crosshair bg-slate-950"
      >
        {useMockMap ? (
          /* Simulated Vector Radar Map */
          <div className="absolute inset-0 flex flex-col justify-between p-4">
            {/* Background grids */}
            <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:16px_16px] opacity-40"></div>
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-[80%] h-[80%] border border-slate-800/40 rounded-full flex items-center justify-center">
                <div className="w-[60%] h-[60%] border border-slate-800/30 rounded-full flex items-center justify-center">
                  <div className="w-[30%] h-[30%] border border-slate-800/20 rounded-full"></div>
                </div>
              </div>
            </div>

            {/* Simulated streets / shorelines visual accents */}
            <svg className="absolute inset-0 w-full h-full text-slate-800/20 pointer-events-none" xmlns="http://www.w3.org/2000/svg">
              <path d="M 0 50 Q 250 80 500 50" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="5,5" />
              <path d="M 100 0 Q 150 250 100 500" fill="none" stroke="currentColor" strokeWidth="2" />
              <path d="M 0 450 L 500 450" fill="none" stroke="currentColor" strokeWidth="1" />
              {/* Landmark text outlines */}
              <text x="20" y="30" fill="currentColor" fontSize="10" className="font-mono">PACIFIC OCEAN</text>
              <text x="350" y="470" fill="currentColor" fontSize="10" className="font-mono">SAN FRANCISCO BAY</text>
            </svg>

            {/* Instructions Overlay */}
            <div className="absolute top-2 left-2 pointer-events-none bg-slate-950/90 border border-slate-800 rounded px-2 py-1 flex items-center gap-1.5 text-[10px] text-slate-400 max-w-[200px]">
              <Info className="w-3.5 h-3.5 text-sky-400 shrink-0" />
              <span>Simulated Bay Area Grid. Tap map to drop custom locations.</span>
            </div>

            {/* Display notes as pulsing markers on Grid */}
            {notes.map((note) => {
              const xy = getXY(note.latitude, note.longitude);
              const isSelected = selectedNote?.id === note.id;
              return (
                <button
                  key={note.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onSelectNote) onSelectNote(note);
                  }}
                  style={{ left: `${xy.x}%`, top: `${xy.y}%` }}
                  className={`absolute -translate-x-1/2 -translate-y-1/2 z-20 group transition-transform hover:scale-125 focus:outline-none`}
                >
                  <div className={`relative p-2 rounded-full border shadow-lg flex items-center justify-center transition-all ${getCategoryColorClass(note.category)} ${isSelected ? 'scale-125 ring-4 ring-sky-500/40' : ''}`}>
                    <MapPin className="w-4 h-4" />
                    
                    {/* Hover Card */}
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 scale-0 group-hover:scale-100 transition-all bg-slate-950 text-white text-[10px] p-2 rounded border border-slate-800 w-44 pointer-events-none z-30 shadow-2xl">
                      <div className="font-semibold text-sky-400 mb-0.5 truncate">{note.category} Tag</div>
                      <div className="text-slate-300 line-clamp-2 mb-1">{note.transcription}</div>
                      <div className="text-[8px] text-slate-500">{new Date(note.createdAt).toLocaleTimeString()}</div>
                    </div>
                  </div>
                  {/* Radar pulse */}
                  <span className={`absolute -inset-1 rounded-full animate-ping opacity-30 ${getCategoryColorClass(note.category).split(' ')[0]}`} />
                </button>
              );
            })}

            {/* Live active driver coordinates marker */}
            {driverXY && (
            <div
              style={{ left: `${driverXY.x}%`, top: `${driverXY.y}%` }}
              className="absolute -translate-x-1/2 -translate-y-1/2 z-30 pointer-events-none"
            >
              <div className="relative flex items-center justify-center">
                <div className="w-6 h-6 rounded-full bg-sky-500/20 border border-sky-400 flex items-center justify-center animate-pulse">
                  <div className="w-2.5 h-2.5 bg-sky-400 rounded-full border border-white shadow-md"></div>
                </div>
                <div className="absolute -bottom-6 bg-sky-950 border border-sky-800 text-[8px] font-mono px-1 rounded text-sky-400 uppercase tracking-widest whitespace-nowrap">
                  DRIVING VEHICLE
                </div>
              </div>
            </div>
            )}
          </div>
        ) : (
          /* Google Maps Live State */
          !apiKey && (
            <div className="absolute inset-0 bg-slate-950 flex flex-col items-center justify-center p-6 text-center">
              <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl max-w-md shadow-xl flex flex-col items-center">
                <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mb-4">
                  <Navigation className="w-6 h-6 animate-bounce" />
                </div>
                <h4 className="text-slate-200 text-sm font-semibold mb-2">Google Maps Key Required</h4>
                <p className="text-xs text-slate-400 mb-4 leading-relaxed">
                  To view live interactive maps, configure your Google Maps API key. The app remains fully functional using the custom offline radar simulation grid.
                </p>
                <div className="flex flex-col gap-2 w-full">
                  <input
                    type="password"
                    placeholder="Enter GOOGLE_MAPS_PLATFORM_KEY"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-sky-500"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        saveCustomKey((e.target as HTMLInputElement).value);
                      }
                    }}
                  />
                  <div className="text-[10px] text-slate-500">
                    Press <kbd className="bg-slate-800 px-1 rounded">Enter</kbd> to save key locally.
                  </div>
                </div>
                <button
                  onClick={() => setUseMockMap(true)}
                  className="mt-4 text-xs font-medium text-sky-400 hover:underline"
                >
                  Return to radar simulation map
                </button>
              </div>
            </div>
          )
        )}
      </div>

      {/* Map Footer showing Selected Note details */}
      {selectedNote && (
        <div className="bg-slate-950 border-t border-slate-800 p-4 transition-all animate-fadeIn">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1.5">
                <span className={`text-[10px] px-2 py-0.5 rounded font-medium border uppercase ${getCategoryColorClass(selectedNote.category)}`}>
                  {selectedNote.category}
                </span>
                <span className="text-[10px] text-slate-500 font-mono">
                  {new Date(selectedNote.createdAt).toLocaleString()}
                </span>
              </div>
              <p className="text-xs font-medium text-slate-200 mb-1 italic">
                "{selectedNote.transcription}"
              </p>
              {selectedNote.address && (
                <p className="text-[10px] text-slate-400 flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-slate-500" />
                  {selectedNote.address}
                </p>
              )}
            </div>
            <button
              onClick={() => {
                if (onSelectNote) onSelectNote(null as any);
              }}
              className="text-[10px] text-slate-400 hover:text-white font-mono border border-slate-800 hover:border-slate-700 px-2 py-1 rounded"
            >
              Clear
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Global declaration for google namespace
declare global {
  interface Window {
    google: any;
  }
}
