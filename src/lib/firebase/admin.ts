import "server-only";
import { initializeApp, getApps, cert, getApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { getStorage } from "firebase-admin/storage";

const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY
    ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)
    : undefined;

if (!serviceAccount) {
    throw new Error("Missing FIREBASE_SERVICE_ACCOUNT_KEY in environment variables. Please add it to your .env.local or Vercel project settings.");
}

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
