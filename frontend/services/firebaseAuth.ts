import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  updateProfile,
  User as FirebaseUser 
} from 'firebase/auth';
import { 
  doc, 
  setDoc, 
  getDoc, 
  collection, 
  serverTimestamp,
  Timestamp 
} from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import type { User, RegisterForm } from '../types';

export interface UserDocument {
  uid: string;
  email: string;
  name: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  profile?: {
    avatar?: string;
    bio?: string;
    preferences?: {
      notifications: boolean;
      theme: 'light' | 'dark' | 'auto';
    };
  };
}

/**
 * Sign up a new user with email/password and create user document in Firestore
 */
export const signUpUser = async (userData: RegisterForm): Promise<User> => {
  console.log('🚀 Starting user registration for:', userData.email);
  
  try {
    // Check if Firebase is properly configured
    if (!auth.app.options.projectId || auth.app.options.projectId === 'demo-project') {
      console.warn('⚠️ Using demo Firebase config - registration will fail');
      throw new Error('Firebase not configured. Please set up your Firebase project and update .env.local');
    }
    
    // 1. Create Firebase Auth user
    console.log('📝 Creating Firebase Auth user...');
    const userCredential = await createUserWithEmailAndPassword(
      auth, 
      userData.email, 
      userData.password
    );
    
    const firebaseUser = userCredential.user;
    console.log('✅ Firebase Auth user created:', firebaseUser.uid);
    
    // 2. Update Firebase Auth profile
    console.log('👤 Updating user profile...');
    await updateProfile(firebaseUser, {
      displayName: userData.name,
    });
    
    // 3. Create user document in Firestore "users" collection
    console.log('💾 Creating Firestore user document...');
    const userDoc: UserDocument = {
      uid: firebaseUser.uid,
      email: userData.email,
      name: userData.name,
      createdAt: serverTimestamp() as Timestamp,
      updatedAt: serverTimestamp() as Timestamp,
      profile: {
        preferences: {
          notifications: true,
          theme: 'auto'
        }
      }
    };
    
    await setDoc(doc(db, 'users', firebaseUser.uid), userDoc);
    console.log('✅ User document created in Firestore');
    
    // 4. Return formatted user object
    const result = {
      id: firebaseUser.uid,
      email: userData.email,
      name: userData.name,
      createdAt: new Date().toISOString(),
    };
    
    console.log('🎉 Registration completed successfully');
    return result;
    
  } catch (error: any) {
    console.error('❌ Sign up error:', error);
    console.error('Error code:', error.code);
    console.error('Error message:', error.message);
    throw new Error(getFirebaseErrorMessage(error.code));
  }
};

/**
 * Sign in existing user and fetch user data from Firestore
 */
export const signInUser = async (email: string, password: string): Promise<User> => {
  try {
    // 1. Sign in with Firebase Auth
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const firebaseUser = userCredential.user;
    
    // 2. Fetch user document from Firestore
    const userDocRef = doc(db, 'users', firebaseUser.uid);
    const userDocSnap = await getDoc(userDocRef);
    
    if (!userDocSnap.exists()) {
      throw new Error('User document not found. Please contact support.');
    }
    
    const userData = userDocSnap.data() as UserDocument;
    
    // 3. Return formatted user object
    return {
      id: firebaseUser.uid,
      email: userData.email,
      name: userData.name,
      createdAt: userData.createdAt.toDate().toISOString(),
    };
    
  } catch (error: any) {
    console.error('Sign in error:', error);
    throw new Error(getFirebaseErrorMessage(error.code));
  }
};

/**
 * Sign out current user
 */
export const signOutUser = async (): Promise<void> => {
  try {
    await signOut(auth);
  } catch (error: any) {
    console.error('Sign out error:', error);
    throw new Error('Failed to sign out. Please try again.');
  }
};

/**
 * Get user document from Firestore by UID
 */
export const getUserDocument = async (uid: string): Promise<UserDocument | null> => {
  try {
    const userDocRef = doc(db, 'users', uid);
    const userDocSnap = await getDoc(userDocRef);
    
    if (userDocSnap.exists()) {
      return userDocSnap.data() as UserDocument;
    }
    
    return null;
  } catch (error: any) {
    console.error('Get user document error:', error);
    throw new Error('Failed to fetch user data.');
  }
};

/**
 * Update user document in Firestore
 */
export const updateUserDocument = async (
  uid: string, 
  updates: Partial<Omit<UserDocument, 'uid' | 'createdAt'>>
): Promise<void> => {
  try {
    const userDocRef = doc(db, 'users', uid);
    await setDoc(userDocRef, {
      ...updates,
      updatedAt: serverTimestamp()
    }, { merge: true });
  } catch (error: any) {
    console.error('Update user document error:', error);
    throw new Error('Failed to update user data.');
  }
};

/**
 * Convert Firebase Auth user to our User type
 */
export const convertFirebaseUser = async (firebaseUser: FirebaseUser): Promise<User | null> => {
  try {
    const userDoc = await getUserDocument(firebaseUser.uid);
    
    if (!userDoc) {
      return null;
    }
    
    return {
      id: firebaseUser.uid,
      email: userDoc.email,
      name: userDoc.name,
      createdAt: userDoc.createdAt.toDate().toISOString(),
    };
  } catch (error) {
    console.error('Convert Firebase user error:', error);
    return null;
  }
};

/**
 * Get user-friendly error messages for Firebase Auth errors
 */
const getFirebaseErrorMessage = (errorCode: string): string => {
  switch (errorCode) {
    case 'auth/user-not-found':
      return 'No account found with this email address.';
    case 'auth/wrong-password':
      return 'Incorrect password. Please try again.';
    case 'auth/email-already-in-use':
      return 'An account with this email already exists.';
    case 'auth/weak-password':
      return 'Password should be at least 6 characters long.';
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/too-many-requests':
      return 'Too many failed attempts. Please try again later.';
    case 'auth/network-request-failed':
      return 'Network error. Please check your connection.';
    default:
      return 'An error occurred. Please try again.';
  }
};
