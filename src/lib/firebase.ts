import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, enableIndexedDbPersistence, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

// Build Firebase options
const firebaseOptions = {
  apiKey: firebaseConfig.apiKey,
  authDomain: firebaseConfig.authDomain,
  projectId: firebaseConfig.projectId,
  storageBucket: firebaseConfig.storageBucket,
  messagingSenderId: firebaseConfig.messagingSenderId,
  appId: firebaseConfig.appId,
};

// Initialize Firebase
const app = getApps().length === 0 ? initializeApp(firebaseOptions) : getApp();

// Get Firestore instance with custom databaseId
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId || '(default)');

const auth = getAuth(app);

// Enable Firestore offline persistence
if (typeof window !== 'undefined') {
  enableIndexedDbPersistence(db).catch((err) => {
    if (err.code === 'failed-precondition') {
      console.warn('Multiple tabs open, offline persistence can only be enabled in one tab.');
    } else if (err.code === 'unimplemented') {
      console.warn('The current browser does not support offline persistence.');
    }
  });
}

// Validate Connection as required by Firestore SKILL
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log('Firebase connection verified.');
  } catch (error) {
    // Expected to catch missing document, but tests network route
    console.log('Firebase network check complete:', error);
  }
}

testConnection();

export { app, db, auth };
