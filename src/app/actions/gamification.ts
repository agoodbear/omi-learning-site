"use server";

import { adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";

// Badge definitions (internal use only, not exported due to "use server" constraint)
const BADGE_DEFINITIONS = {
    first_case: { name: "探索者", description: "首次瀏覽 Case" },
    first_quiz: { name: "初試身手", description: "首次完成 Quiz" },
    streak_7: { name: "週週精進", description: "連續登入 7 天" },
    streak_30: { name: "學習達人", description: "連續登入 30 天" },
    quiz_10: { name: "勤學不倦", description: "累計完成 10 次 Quiz" },
    quiz_50: { name: "Quiz 大師", description: "累計完成 50 次 Quiz" },
    perfect_quiz: { name: "滿分王", description: "Quiz 獲得滿分" },
} as const;

type BadgeId = keyof typeof BADGE_DEFINITIONS;


/**
 * Awards daily login points and tracks streak.
 * Should be called once on successful login.
 */
export async function awardLoginPoints(uid: string, employeeId?: string) {
    if (!uid) return { success: false, error: "No UID" };

    const pointsRef = adminDb.collection("pointsStats").doc(uid);
    const timestamp = FieldValue.serverTimestamp();
    const today = new Date().toISOString().split("T")[0]; // "YYYY-MM-DD"

    // Fetch current stats
    const doc = await pointsRef.get();
    const data = doc.data() || {};
    const lastLoginDate = data.lastLoginDate || null;
    const currentStreak = data.currentStreak || 0;
    const longestStreak = data.longestStreak || 0;
    const badges: string[] = data.badges || [];

    // Check if already logged in today
    if (lastLoginDate === today) {
        return { success: true, alreadyAwarded: true, pointsAwarded: 0 };
    }

    // Calculate new streak
    let newStreak = 1;
    if (lastLoginDate) {
        const lastDate = new Date(lastLoginDate);
        const todayDate = new Date(today);
        const diffDays = Math.floor((todayDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));

        if (diffDays === 1) {
            // Consecutive day
            newStreak = currentStreak + 1;
        } else {
            // Streak broken
            newStreak = 1;
        }
    }

    const newLongestStreak = Math.max(longestStreak, newStreak);

    // Calculate bonus points and badges
    let bonusPoints = 0;
    const newBadges: string[] = [];

    // 7-day streak milestone
    if (newStreak === 7 && !badges.includes("streak_7")) {
        bonusPoints += 20;
        newBadges.push("streak_7");
    }

    // 30-day streak milestone
    if (newStreak === 30 && !badges.includes("streak_30")) {
        bonusPoints += 50;
        newBadges.push("streak_30");
    }

    // Update Firestore
    const totalPointsToAdd = 1 + bonusPoints; // 1 for daily login + any bonus

    const updateData: any = {
        uid,
        totalPoints: FieldValue.increment(totalPointsToAdd),
        "pointsBreakdown.loginPoints": FieldValue.increment(1),
        currentStreak: newStreak,
        longestStreak: newLongestStreak,
        lastLoginDate: today,
        updatedAt: timestamp,
    };

    if (employeeId) {
        updateData.employeeId = employeeId;
    }

    if (bonusPoints > 0) {
        updateData["pointsBreakdown.bonusPoints"] = FieldValue.increment(bonusPoints);
    }

    if (newBadges.length > 0) {
        updateData.badges = FieldValue.arrayUnion(...newBadges);
    }

    await pointsRef.set(updateData, { merge: true });

    // Log event
    const eventRef = adminDb.collection("events").doc();
    await eventRef.set({
        uid,
        employeeId: employeeId || "UNKNOWN",
        action: "login",
        targetType: null,
        targetId: null,
        createdAt: timestamp,
        meta: {
            streak: newStreak,
            bonusPoints,
            newBadges,
        }
    });

    return {
        success: true,
        alreadyAwarded: false,
        pointsAwarded: totalPointsToAdd,
        newStreak,
        newBadges,
    };
}

/**
 * Award a specific badge to a user.
 */
export async function awardBadge(uid: string, badgeId: BadgeId) {
    const pointsRef = adminDb.collection("pointsStats").doc(uid);

    await pointsRef.set({
        badges: FieldValue.arrayUnion(badgeId),
        updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    return { success: true, badge: badgeId };
}
