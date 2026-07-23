import { useState, useEffect, useCallback } from 'react';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  setDoc, 
  doc, 
  deleteDoc 
} from 'firebase/firestore';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { db, auth } from './lib/firebase';
import { Note, UserProfile, PushNotification } from './types';
import AuthScreen from './components/AuthScreen';
import DriveAssistant from './components/DriveAssistant';
import Dashboard from './components/Dashboard';
import MapContainer from './components/MapContainer';
import { 
  Car, Layers, User, LogOut, Sun, Moon, Wifi, WifiOff, ShieldAlert,
  BellRing, Sparkles, Navigation
} from 'lucide-react';

export default function App() {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [notes, setNotes] = useState<Note[]>([]);
  const [currentLocation, setCurrentLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [isOffline, setIsOffline] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [pushNotifications, setPushNotifications] = useState<PushNotification[]>([]);
  const [activeTab, setActiveTab] = useState<'drive' | 'dashboard'>('drive');
  const [darkMode, setDarkMode] = useState(true);

  // Load theme preference on boot
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme_mode');
    if (savedTheme === 'light') {
      setDarkMode(false);
    }
  }, []);

  // Listen to visual custom events dispatched by child controllers
  useEffect(() => {
    const handlePushAlert = (event: Event) => {
      const customEvent = event as CustomEvent;
      if (customEvent.detail) {
        addNotification({
          title: customEvent.detail.title,
          message: customEvent.detail.message,
          type: customEvent.detail.type || 'sync'
        });
      }
    };

    window.addEventListener('push-notification', handlePushAlert);
    return () => window.removeEventListener('push-notification', handlePushAlert);
  }, []);

  // Sync state between devices using Firestore real-time snapshots
  useEffect(() => {
    if (!userProfile) return;

    // Each user only sees their own notes
    const q = query(collection(db, 'notes'), where('userId', '==', userProfile.uid));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const remoteNotes: Note[] = [];
      snapshot.forEach((doc) => {
        remoteNotes.push(doc.data() as Note);
      });

      // Merge remote notes with local offline notes to prevent overwriting unsynced cache
      setNotes((prevNotes) => {
        const offlineNotes = prevNotes.filter(n => !n.synced);
        
        // Remove duplicates where a note was just synced (matching by ID)
        const filteredOffline = offlineNotes.filter(
          on => !remoteNotes.some(rn => rn.id === on.id)
        );

        const merged = [...remoteNotes, ...filteredOffline];
        // Sort newest first
        return merged.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      });

      // Show real-time sync notification
      if (snapshot.docChanges().length > 0 && !isOffline) {
        const addedChanges = snapshot.docChanges().filter(change => change.type === 'added');
        if (addedChanges.length > 0) {
          addNotification({
            title: 'Real-time Database Synced',
            message: `${addedChanges.length} remote driving records loaded seamlessly.`,
            type: 'sync'
          });
        }
      }
    }, (error) => {
      console.warn('Firestore snapshot listener failed (expected if offline or unauthorized):', error);
      // Fail gracefully: load from localStorage backup if firestore is blocked or offline
      const localBackup = localStorage.getItem(`notes_${userProfile.uid}`);
      if (localBackup) {
        setNotes(JSON.parse(localBackup));
      }
    });

    return () => unsubscribe();
  }, [userProfile, isOffline]);

  // Monitor Firebase Authentication state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setIsAuthChecking(true);
      if (user) {
        // Hydrate from localStorage profile if available, or fallback
        const savedProfile = localStorage.getItem(`profile_${user.uid}`);
        if (savedProfile) {
          setUserProfile(JSON.parse(savedProfile));
        } else {
          setUserProfile({
            uid: user.uid,
            email: user.email || '',
            displayName: user.displayName || user.email?.split('@')[0] || 'Operator',
            role: 'driver', // default to driver
            createdAt: new Date().toISOString()
          });
        }
      } else {
        setUserProfile(null);
      }
      setIsAuthChecking(false);
    });

    return () => unsubscribe();
  }, []);

  // Write local backup to localStorage on changes
  useEffect(() => {
    if (userProfile && notes.length > 0) {
      localStorage.setItem(`notes_${userProfile.uid}`, JSON.stringify(notes));
    }
  }, [notes, userProfile]);

  // Handle push notification stack addition
  const addNotification = useCallback((noti: Omit<PushNotification, 'id' | 'timestamp'>) => {
    const newNoti: PushNotification = {
      ...noti,
      id: `noti_${Math.floor(Math.random() * 1000000)}`,
      timestamp: new Date().toISOString()
    };
    setPushNotifications(prev => [newNoti, ...prev].slice(0, 20)); // cap at 20 logs
  }, []);

  // Add notes engine (handles local queues vs direct cloud writes)
  const handleAddNote = async (newNoteData: Omit<Note, 'id' | 'createdAt' | 'userId'>) => {
    if (!userProfile) return;

    const noteId = `note_${Math.floor(Math.random() * 1000000)}`;
    const fullNote: Note = {
      ...newNoteData,
      id: noteId,
      userId: userProfile.uid,
      createdAt: new Date().toISOString(),
      synced: !isOffline
    };

    // Update local state first
    setNotes(prev => [fullNote, ...prev]);

    if (!isOffline) {
      try {
        await setDoc(doc(db, 'notes', noteId), fullNote);
      } catch (err) {
        console.error('Failed to sync note directly to cloud. Saving to local queue:', err);
        // Force offline flag if direct write fails
        setNotes(prev => prev.map(n => n.id === noteId ? { ...n, synced: false } : n));
        addNotification({
          title: 'Direct Sync Interrupted',
          message: 'Saved to offline buffer due to database permission restrictions.',
          type: 'alert'
        });
      }
    } else {
      addNotification({
        title: 'Cached Locally (Offline)',
        message: 'No cellular service. Entry stored securely in browser cache.',
        type: 'sync'
      });
    }
  };

  // Synchronize all buffered/offline notes manually or on reconnection
  const handleSyncAll = async () => {
    if (!userProfile || isOffline) return;

    const unsyncedNotes = notes.filter(n => !n.synced);
    if (unsyncedNotes.length === 0) return;

    setIsSyncing(true);
    let successCount = 0;

    for (const note of unsyncedNotes) {
      try {
        const syncedNote = { ...note, synced: true };
        await setDoc(doc(db, 'notes', note.id), syncedNote);
        successCount++;
        
        // Update state progressively
        setNotes(prev => prev.map(n => n.id === note.id ? syncedNote : n));
      } catch (err) {
        console.error(`Failed to sync note ${note.id}:`, err);
      }
    }

    setIsSyncing(false);

    if (successCount > 0) {
      addNotification({
        title: 'Device Sync Successful',
        message: `Cloud synchronized ${successCount} buffered driving entries successfully.`,
        type: 'sync'
      });
    }
  };

  // Delete note engine
  const handleDeleteNote = async (id: string) => {
    setNotes(prev => prev.filter(n => n.id !== id));
    if (selectedNote?.id === id) {
      setSelectedNote(null);
    }

    try {
      await deleteDoc(doc(db, 'notes', id));
      addNotification({
        title: 'Driving Record Deleted',
        message: 'Note removed from cloud database and local cache.',
        type: 'sync'
      });
    } catch (err) {
      console.warn('Failed to delete remote document (already deleted or permissions denied):', err);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error('Signout failed:', err);
    }
    // Clear all user-specific localStorage to prevent stale data leaks between sessions
    if (userProfile) {
      localStorage.removeItem(`notes_${userProfile.uid}`);
      localStorage.removeItem(`profile_${userProfile.uid}`);
    }
    setUserProfile(null);
    setNotes([]);
    setSelectedNote(null);
  };

  const handleAuthSuccess = (profile: UserProfile) => {
    setUserProfile(profile);
    localStorage.setItem(`profile_${profile.uid}`, JSON.stringify(profile));
  };

  const toggleTheme = () => {
    const nextMode = !darkMode;
    setDarkMode(nextMode);
    localStorage.setItem('theme_mode', nextMode ? 'dark' : 'light');
  };

  if (isAuthChecking) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
        <Navigation className="w-8 h-8 text-sky-400 animate-spin" />
        <span className="text-xs font-mono text-slate-500 mt-2">SECURE CONSOLE INJECTING...</span>
      </div>
    );
  }

  // Not logged in -> Show login/create account screens
  if (!userProfile) {
    return <AuthScreen onAuthSuccess={handleAuthSuccess} />;
  }

  return (
    <div className={`min-h-screen transition-colors duration-200 ${
      darkMode ? 'bg-slate-950 text-slate-100 font-sans' : 'bg-slate-50 text-slate-900 font-sans'
    }`}>
      {/* Top Navigation Bar */}
      <header className={`border-b h-16 flex items-center justify-between px-6 sm:px-8 sticky top-0 z-30 backdrop-blur-md ${
        darkMode ? 'bg-slate-900/50 border-slate-800 text-slate-50' : 'bg-white/70 border-slate-200 text-slate-900'
      }`}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-sky-500 rounded-lg flex items-center justify-center shadow-[0_0_15px_rgba(14,165,233,0.3)]">
            <Car className="w-5 h-5 text-white" />
          </div>
          <span className="text-lg font-display font-bold tracking-tight">
            RADIR Drive <span className="text-sky-400 text-[10px] font-mono ml-1 px-1.5 py-0.5 border border-sky-400/30 rounded uppercase">v4.0</span>
          </span>
        </div>

        {/* Global stats indicators & Controls */}
        <div className="flex items-center gap-3 sm:gap-6">
          {/* Connection status light */}
          <div className={`flex items-center gap-2 ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
            <div className={`w-2 h-2 rounded-full ${
              isOffline 
                ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)] animate-pulse' 
                : 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]'
            }`} />
            <span className="text-[10px] font-mono font-medium uppercase tracking-widest hidden sm:inline">
              {isOffline ? 'OFFLINE ACTIVE' : 'CLOUD SYNCED'}
            </span>
          </div>

          <div className="flex items-center gap-3 border-l pl-4 sm:pl-6 border-slate-800">
            {/* Theme switcher */}
            <button
              onClick={toggleTheme}
              className={`p-1.5 rounded-lg border transition-all ${
                darkMode ? 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white' : 'bg-slate-100 border-slate-200 text-slate-600 hover:text-slate-900'
              }`}
              title={darkMode ? 'Switch to High-Contrast Light Mode' : 'Switch to Dark Driving Mode'}
            >
              {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            {/* Operator info with Initials circle */}
            <div className="flex items-center gap-3">
              <div className="text-right hidden md:block">
                <p className="text-xs font-medium truncate max-w-[120px]">
                  {userProfile.displayName || userProfile.email.split('@')[0]}
                </p>
                <p className="text-[9px] text-slate-500 uppercase tracking-tighter">
                  {userProfile.role} Operator
                </p>
              </div>
              <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-sky-400 font-bold font-mono text-xs">
                {(userProfile.displayName || userProfile.email).slice(0, 2).toUpperCase()}
              </div>
            </div>

            {/* Sign Out */}
            <button
              onClick={handleLogout}
              className="p-1.5 bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20 text-rose-400 rounded-lg text-xs font-mono font-bold transition-all"
              title="Disconnect driver profile"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Grid View Layout */}
      <main className="max-w-7xl mx-auto p-4 md:p-8 space-y-6">
        
        {/* Dual Mode View Panels Toggle */}
        <div className={`flex border-b pb-4 justify-between items-center ${
          darkMode ? 'border-slate-800/80' : 'border-slate-200'
        }`}>
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('drive')}
              className={`px-4 py-2 rounded-xl text-xs font-display font-bold transition-all flex items-center gap-1.5 border ${
                activeTab === 'drive'
                  ? 'bg-sky-500/10 border-sky-500 text-sky-400 shadow-[0_0_15px_rgba(56,189,248,0.05)]'
                  : 'bg-transparent border-transparent text-slate-500 hover:text-slate-300'
              }`}
            >
              <Car className="w-4 h-4" />
              1. Driving Console HUD
            </button>
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`px-4 py-2 rounded-xl text-xs font-display font-bold transition-all flex items-center gap-1.5 border ${
                activeTab === 'dashboard'
                  ? 'bg-indigo-500/10 border-indigo-500 text-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.05)]'
                  : 'bg-transparent border-transparent text-slate-500 hover:text-slate-300'
              }`}
            >
              <Layers className="w-4 h-4" />
              2. Synchronized Analytics Dashboard
            </button>
          </div>

          <span className="text-[9px] font-mono text-slate-500 hidden sm:inline uppercase tracking-widest">
            RADIR DRIVER CORE STAGE • SYSTEM READY
          </span>
        </div>

        {/* View Layout Router */}
        {activeTab === 'drive' ? (
          <div className="space-y-6">
            {/* Upper Map Stage */}
            <div className="h-96 md:h-[450px]">
              <MapContainer
                notes={notes}
                currentLocation={currentLocation}
                onSelectNote={setSelectedNote}
                selectedNote={selectedNote}
                onMapClick={(lat, lng) => {
                  setCurrentLocation({ latitude: lat, longitude: lng });
                  addNotification({
                    title: 'Simulator Coordinates Shifted',
                    message: `Vehicle snapped to coordinates: ${lat.toFixed(4)}°, ${lng.toFixed(4)}°.`,
                    type: 'tag'
                  });
                }}
              />
            </div>

            {/* Lower Voice Console HUD controls */}
            <DriveAssistant
              onAddNote={handleAddNote}
              currentLocation={currentLocation}
              setCurrentLocation={setCurrentLocation}
              isOffline={isOffline}
            />
          </div>
        ) : (
          /* Analytics & Reporting Dashboard Section */
          <Dashboard
            notes={notes}
            userProfile={userProfile}
            onDeleteNote={handleDeleteNote}
            onSyncAll={handleSyncAll}
            isSyncing={isSyncing}
            onSelectNote={setSelectedNote}
          />
        )}
      </main>

      {/* Footer information block */}
      <footer className={`border-t py-6 text-center text-[10px] font-mono text-slate-500 tracking-wider mt-10 ${
        darkMode ? 'bg-slate-950 border-slate-900' : 'bg-white border-slate-200'
      }`}>
        <p>© {new Date().getFullYear()} RADIR COGNITION INC • CLOUD DEVICE SYNCHRONIZED</p>
        <p className="text-[8px] text-slate-600 mt-1 uppercase tracking-widest">
          Authored securely for high-contrast low-light safe driving environments
        </p>
      </footer>
    </div>
  );
}
