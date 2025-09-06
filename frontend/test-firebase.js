// Quick Firebase connection test
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyACT1BS6myM-AO2vI876e99ehdoydAGjKA",
  authDomain: "novi-d5778.firebaseapp.com",
  projectId: "novi-d5778",
  storageBucket: "novi-d5778.firebasestorage.app",
  messagingSenderId: "619955673035",
  appId: "1:619955673035:web:ff23ab9c613b9ba1c7884e"
};

console.log('🔥 Testing Firebase connection...');

try {
  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = getFirestore(app);
  
  console.log('✅ Firebase initialized successfully');
  console.log('Project ID:', app.options.projectId);
  console.log('Auth Domain:', app.options.authDomain);
  
} catch (error) {
  console.error('❌ Firebase initialization failed:', error);
}
