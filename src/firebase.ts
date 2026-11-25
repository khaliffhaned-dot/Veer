import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
    getAuth, 
    signInWithPopup, 
    GoogleAuthProvider, 
    onAuthStateChanged, 
    signOut,
    User 
} from 'firebase/auth';
import { 
    getFirestore, 
    doc, 
    getDoc, 
    setDoc, 
    collection, 
    getDocs, 
    deleteDoc 
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

// Google Drive scopes for Workspace integration
export const DRIVE_SCOPES = [
    'https://www.googleapis.com/auth/drive',
    'https://www.googleapis.com/auth/drive.file',
    'https://www.googleapis.com/auth/drive.readonly',
    'https://www.googleapis.com/auth/drive.metadata.readonly'
];

const provider = new GoogleAuthProvider();
DRIVE_SCOPES.forEach(scope => provider.addScope(scope));
provider.setCustomParameters({
    prompt: 'select_account'
});

let isSigningIn = false;
let cachedAccessToken: string | null = null;
let cachedUser: User | null = null;

export const initAuth = (
    onAuthSuccess?: (user: User, token: string | null) => void,
    onAuthFailure?: () => void
) => {
    return onAuthStateChanged(auth, async (user: User | null) => {
        cachedUser = user;
        if (user) {
            if (cachedAccessToken) {
                if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
            } else if (!isSigningIn) {
                if (onAuthSuccess) onAuthSuccess(user, null);
            }
        } else {
            cachedAccessToken = null;
            if (onAuthFailure) onAuthFailure();
        }
    });
};

export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
    try {
        isSigningIn = true;
        const result = await signInWithPopup(auth, provider);
        const credential = GoogleAuthProvider.credentialFromResult(result);
        if (!credential?.accessToken) {
            throw new Error('Failed to get access token from Google sign in');
        }

        cachedAccessToken = credential.accessToken;
        cachedUser = result.user;
        return { user: result.user, accessToken: cachedAccessToken };
    } catch (error: any) {
        console.error('Sign in error:', error);
        throw error;
    } finally {
        isSigningIn = false;
    }
};

export const getAccessToken = async (): Promise<string | null> => {
    return cachedAccessToken;
};

export const getCurrentUser = (): User | null => {
    return cachedUser || auth.currentUser;
};

export const logout = async () => {
    await signOut(auth);
    cachedAccessToken = null;
    cachedUser = null;
};

export { doc, getDoc, setDoc, collection, getDocs, deleteDoc };
