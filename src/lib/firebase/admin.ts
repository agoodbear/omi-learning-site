import "server-only";
import { initializeApp, getApps, cert, getApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { getStorage } from "firebase-admin/storage";

const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY
    ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    : require("@/../service-account-key.json"); // Fallback for local dev if env not set

export function initAdmin() {
    if (getApps().length === 0) {
        initializeApp({
            credential: cert(serviceAccount),
            // databaseURL: "...", // Optional for Firestore
            // storageBucket: "..." // Optional
        });
    }
    return getApp();
}

// Ensure init
initAdmin();

export const adminDb = getFirestore();
export const adminAuth = getAuth();
export const adminStorage = getStorage();
