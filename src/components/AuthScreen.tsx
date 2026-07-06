import React, { useState } from 'react';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut 
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { UserProfile, UserRole } from '../types';
import { Shield, Mail, Lock, User, Sparkles, Navigation, AlertCircle } from 'lucide-react';

interface AuthScreenProps {
  onAuthSuccess: (profile: UserProfile) => void;
}

export default function AuthScreen({ onAuthSuccess }: AuthScreenProps) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [role, setRole] = useState<UserRole>('driver');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage('');

    try {
      if (isSignUp) {
        // 1. Create account in Firebase Auth
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // 2. Prepare profile payload
        const profile: UserProfile = {
          uid: user.uid,
          email: user.email || email,
          displayName: displayName || email.split('@')[0],
          role: role,
          createdAt: new Date().toISOString()
        };

        // 3. Save profile to Firestore
        await setDoc(doc(db, 'users', user.uid), profile);

        onAuthSuccess(profile);
      } else {
        // 1. Sign In via Firebase Auth
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // 2. Fetch user profile from Firestore
        const docRef = doc(db, 'users', user.uid);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          onAuthSuccess(docSnap.data() as UserProfile);
        } else {
          // Fallback if document does not exist yet (create default)
          const fallbackProfile: UserProfile = {
            uid: user.uid,
            email: user.email || email,
            role: 'driver',
            createdAt: new Date().toISOString()
          };
          await setDoc(docRef, fallbackProfile);
          onAuthSuccess(fallbackProfile);
        }
      }
    } catch (err: any) {
      console.error('Authentication Error:', err);
      // Human-friendly translations
      if (err.code === 'auth/weak-password') {
        setErrorMessage('Password is too weak. Must be at least 6 characters.');
      } else if (err.code === 'auth/email-already-in-use') {
        setErrorMessage('This email is already associated with an account.');
      } else if (err.code === 'auth/invalid-credential') {
        setErrorMessage('Incorrect email or password combination.');
      } else if (err.code === 'auth/operation-not-allowed') {
        setErrorMessage('Email/Password authentication is not enabled. Please enable it in the Firebase Console under Authentication → Sign-in method.');
      } else {
        setErrorMessage(err.message || 'An unexpected error occurred during auth.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Quick sandbox login for quick reviews
  const handleQuickSandboxLogin = (selectedRole: UserRole) => {
    const sandboxProfile: UserProfile = {
      uid: `sandbox_user_${selectedRole}_${Math.floor(Math.random() * 1000)}`,
      email: `${selectedRole}@radir-sandbox.io`,
      displayName: selectedRole === 'admin' ? 'Lead Admin Controller' : 'Professional Driver',
      role: selectedRole,
      createdAt: new Date().toISOString()
    };
    onAuthSuccess(sandboxProfile);

    // Dispatch visual push alert
    const event = new CustomEvent('push-notification', {
      detail: {
        title: 'Sandbox Session Active',
        message: `Logged in as a sandbox ${selectedRole}. Cloud saving runs in local buffer mode.`,
        type: 'sync'
      }
    });
    window.dispatchEvent(event);
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Visual background decor */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Main card */}
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl relative z-10">
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-12 h-12 bg-sky-500/10 border border-sky-400/20 rounded-2xl flex items-center justify-center mb-4 shadow-inner">
            <Navigation className="w-6 h-6 text-sky-400 animate-pulse" />
          </div>
          <h2 className="text-2xl font-display font-bold text-slate-100 tracking-tight uppercase">RADIR DRIVING SYSTEM</h2>
          <p className="text-[10px] text-slate-500 font-mono tracking-widest mt-1">HANDS-FREE LOCATION RECORDER</p>
        </div>

        {/* Auth error alerts */}
        {errorMessage && (
          <div className="mb-5 p-3 bg-rose-500/15 border border-rose-500/20 rounded-xl flex items-start gap-2 animate-fadeIn">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span className="text-xs text-rose-300 font-mono leading-relaxed">{errorMessage}</span>
          </div>
        )}

        {/* Email form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {isSignUp && (
            <div className="space-y-1">
              <label className="text-[10px] font-mono text-slate-500 uppercase tracking-wider block">Full Name</label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-600 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  placeholder="Enter your name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-sky-500 font-mono"
                />
              </div>
            </div>
          )}

          <div className="space-y-1">
            <label className="text-[10px] font-mono text-slate-500 uppercase tracking-wider block">Email Address</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-600 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                placeholder="driver@radir.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-sky-500 font-mono"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-mono text-slate-500 uppercase tracking-wider block">Password</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-600 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-sky-500 font-mono"
              />
            </div>
          </div>

          {isSignUp && (
            <div className="space-y-1">
              <label className="text-[10px] font-mono text-slate-500 uppercase tracking-wider block">Workspace Access Role</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setRole('driver')}
                  className={`py-2 px-3 rounded-xl border text-xs font-mono font-semibold transition-all flex items-center justify-center gap-1.5 ${
                    role === 'driver'
                      ? 'bg-sky-500/10 border-sky-500 text-sky-400 shadow-inner'
                      : 'bg-slate-950 border-slate-800 text-slate-500 hover:border-slate-700'
                  }`}
                >
                  <Navigation className="w-3.5 h-3.5" />
                  Driver
                </button>
                <button
                  type="button"
                  onClick={() => setRole('admin')}
                  className={`py-2 px-3 rounded-xl border text-xs font-mono font-semibold transition-all flex items-center justify-center gap-1.5 ${
                    role === 'admin'
                      ? 'bg-indigo-500/10 border-indigo-500 text-indigo-400 shadow-inner'
                      : 'bg-slate-950 border-slate-800 text-slate-500 hover:border-slate-700'
                  }`}
                >
                  <Shield className="w-3.5 h-3.5" />
                  Admin
                </button>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-sky-500 hover:bg-sky-600 disabled:bg-slate-800 text-slate-950 font-semibold py-3 rounded-xl transition-all shadow-lg text-xs font-mono uppercase tracking-widest mt-2"
          >
            {isLoading ? 'Processing Access Securely...' : isSignUp ? 'Generate Profile' : 'Authenticate Console'}
          </button>
        </form>

        {/* Toggle signup/signin */}
        <div className="mt-5 text-center">
          <button
            onClick={() => {
              setIsSignUp(!isSignUp);
              setErrorMessage('');
            }}
            className="text-xs font-mono text-slate-400 hover:text-sky-400 transition-colors"
          >
            {isSignUp ? 'Already have a profile? Access here' : 'New operator? Construct secure profile'}
          </button>
        </div>

        {/* Sandbox Simulation Options */}
        <div className="border-t border-slate-800/80 mt-6 pt-5">
          <div className="flex items-center gap-1.5 mb-2.5">
            <Sparkles className="w-3.5 h-3.5 text-sky-400 animate-pulse" />
            <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest font-semibold">
              Sandbox Quick Access
            </span>
          </div>
          <p className="text-[10px] text-slate-500 font-mono leading-normal mb-3">
            Testing immediately? Bypass the Firebase registration form with a single-click mock session:
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => handleQuickSandboxLogin('driver')}
              className="py-1.5 px-3 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-lg text-[10px] font-mono text-slate-300 hover:border-slate-700"
            >
              🚀 Driver Bypass
            </button>
            <button
              onClick={() => handleQuickSandboxLogin('admin')}
              className="py-1.5 px-3 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-lg text-[10px] font-mono text-slate-300 hover:border-slate-700"
            >
              👑 Admin Bypass
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
