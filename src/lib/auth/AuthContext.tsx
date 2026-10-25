"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { User, onAuthStateChanged, signOut as firebaseSignOut } from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase/config";
import { emailToEmployeeId, isAdmin } from "./utils";
import { UserProfile } from "@/types/user";
import { logEvent } from "@/lib/events";
import { awardLoginPoints } from "@/app/actions/gamification";

interface AuthContextType {
    user: User | null;
    userProfile: UserProfile | null;
    loading: boolean;
    isAdminUser: boolean;
    isApproved: boolean;
    signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    userProfile: null,
    loading: true,
    isAdminUser: false,
    isApproved: false,
    signOut: async () => { },
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            setUser(firebaseUser);

            if (firebaseUser) {
                const employeeId = emailToEmployeeId(firebaseUser.email);
                if (employeeId) {
                    // Fetch or Create Profile
                    const userRef = doc(db, "users", firebaseUser.uid);
                    try {
                        const docSnap = await getDoc(userRef);

                        if (docSnap.exists()) {
                            // Update last login
                            await setDoc(userRef, { lastLoginAt: serverTimestamp() }, { merge: true });
                            setUserProfile(docSnap.data() as UserProfile);

                            // Award Login Points & Log Event (Once per session, fire-and-forget)
                            if (typeof window !== "undefined" && !sessionStorage.getItem("session_logged")) {
                                sessionStorage.setItem("session_logged", "true");
                                // Fire-and-forget: don't await these to avoid blocking
                                logEvent(firebaseUser.uid, "login", null, null, { employeeId }).catch(console.error);
                                firebaseUser.getIdToken().then(awardLoginPoints).catch(console.error);
                            }

                        } else {
                            // Create new profile if it doesn't exist (should be handled in signup, but fallback here)
                            const newProfile = {
                                uid: firebaseUser.uid,
                                employeeId,
                                createdAt: serverTimestamp(),
                                lastLoginAt: serverTimestamp(),
                            };
                            await setDoc(userRef, newProfile);
                            setUserProfile(newProfile as unknown as UserProfile);

                            // Award Login Points & Log Event for new user (fire-and-forget)
                            if (typeof window !== "undefined" && !sessionStorage.getItem("session_logged")) {
                                sessionStorage.setItem("session_logged", "true");
                                logEvent(firebaseUser.uid, "login", null, null, { employeeId }).catch(console.error);
                                firebaseUser.getIdToken().then(awardLoginPoints).catch(console.error);
                            }
                        }
                    } catch (error) {
                        console.error("Error fetching user profile:", error);
                    }
                }
            } else {
                setUserProfile(null);
                // Clear session flag on logout so next login counts
                if (typeof window !== "undefined") {
                    sessionStorage.removeItem("session_logged");
                }
            }

            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const isAdminUser = userProfile ? isAdmin(userProfile.employeeId) : false;
    const isApproved = isAdminUser || userProfile?.approved === true;

    const signOut = async () => {
        await firebaseSignOut(auth);
    };

    return (
        <AuthContext.Provider value={{ user, userProfile, loading, isAdminUser, isApproved, signOut }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => useContext(AuthContext);
