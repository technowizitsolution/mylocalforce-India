// Firebase modular SDK initialization and helper exports
// Uses Firebase v9+ (modular) for React web application
import { initializeApp } from 'firebase/app';
import { getAuth, browserLocalPersistence, setPersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';

// Firebase configuration
const firebaseConfig = {
  apiKey: 'AIzaSyBpuEH9_-erRrEdUKQ46Fkec4IgW9RqhiQ',
  authDomain: 'mylocalforce-295b8.firebaseapp.com',
  projectId: 'mylocalforce-295b8',
  storageBucket: 'mylocalforce-295b8.firebasestorage.app',
  messagingSenderId: '1081005319135',
  appId: '1:1081005319135:web:7f2e7a0a54d120ff019a6a',
  measurementId: 'G-T0QRB4GM95',
  databaseURL: 'https://mylocalforce-295b8-default-rtdb.firebaseio.com',
};

const app = initializeApp(firebaseConfig);

// Initialize Auth with browser localStorage persistence
export const auth = getAuth(app);
setPersistence(auth, browserLocalPersistence).catch(console.error);

// Initialize Firestore with custom database name 'mylocalforce'
export const firestore = getFirestore(app, 'mylocalforce');

export const storage = getStorage(app);

// Initialize Cloud Functions with correct region
export const functions = getFunctions(app, 'us-central1');

// For development/testing with emulator (uncomment if needed):
// if (import.meta.env.DEV) {
//   connectFunctionsEmulator(functions, 'localhost', 5001);
// }

export default app;
