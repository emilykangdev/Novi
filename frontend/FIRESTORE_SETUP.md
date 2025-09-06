# Firestore Setup Guide

## Database Structure

### Collections

#### `users` Collection
Each document represents a user with the following structure:

```typescript
{
  uid: string;           // Firebase Auth UID (document ID)
  email: string;         // User's email
  name: string;          // User's display name
  createdAt: Timestamp;  // When account was created
  updatedAt: Timestamp;  // Last profile update
  profile?: {
    avatar?: string;     // Profile picture URL
    bio?: string;        // User bio
    preferences?: {
      notifications: boolean;
      theme: 'light' | 'dark' | 'auto';
    };
  };
}
```

## Firestore Security Rules

Add these rules to your Firestore database:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can read and write their own user document
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Add other collection rules here as needed
    // Example for future collections:
    // match /chats/{chatId} {
    //   allow read, write: if request.auth != null && request.auth.uid in resource.data.participants;
    // }
  }
}
```

## Firebase Console Setup Steps

1. **Go to Firebase Console**: https://console.firebase.google.com/
2. **Create/Select Project**: Create new project or select existing one
3. **Enable Authentication**:
   - Go to Authentication > Sign-in method
   - Enable "Email/Password" provider
4. **Create Firestore Database**:
   - Go to Firestore Database
   - Click "Create database"
   - Choose "Start in test mode" (we'll add security rules later)
   - Select a location close to your users
5. **Add Security Rules**:
   - Go to Firestore Database > Rules
   - Replace the default rules with the rules above
   - Click "Publish"
6. **Get Configuration**:
   - Go to Project Settings (gear icon)
   - Scroll down to "Your apps" section
   - Click on the web app or create one
   - Copy the config object values to your `.env.local` file

## Environment Variables

Create `/frontend/.env.local` with your Firebase config:

```bash
EXPO_PUBLIC_FIREBASE_API_KEY=your_api_key_here
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
EXPO_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abcdef123456
```

## Testing the Setup

1. Start your Expo server: `npm start`
2. Try registering a new user
3. Check Firestore console to see if user document was created
4. Try signing in with the same user
5. Check browser console for any errors

## Available Functions

The `firebaseAuth.ts` service provides:

- `signUpUser(userData)` - Create account + Firestore document
- `signInUser(email, password)` - Sign in + fetch user data
- `signOutUser()` - Sign out user
- `getUserDocument(uid)` - Get user data from Firestore
- `updateUserDocument(uid, updates)` - Update user profile
- `convertFirebaseUser(firebaseUser)` - Convert Firebase Auth user to app User type

## Error Handling

The service includes user-friendly error messages for common Firebase Auth errors:
- Invalid email format
- Weak password
- User not found
- Wrong password
- Email already in use
- Network errors
