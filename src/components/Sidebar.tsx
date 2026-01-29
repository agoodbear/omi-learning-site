"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth/AuthContext";
import { db } from "@/lib/firebase";
import { doc, onSnapshot, collection, query, where, getCountFromServer, orderBy, limit } from "firebase/firestore";
import { PointsStats, UserContentStatus } from "@/types/firestore-schema";
import { Trophy, BookOpen, Brain, Activity, Star, LayoutDashboard, FileText, Trash2 } from "lucide-react";

export default function Sidebar() {
    const { user, userProfile, isAdminUser } = useAuth();

    // Stats State
    const [points, setPoints] = useState<number>(0);
    const [rank, setRank] = useState<number | null>(null);
    const [unreadCases, setUnreadCases] = useState<number>(0);
    const [unreadPapers, setUnreadPapers] = useState<number>(0);

    // Listeners
    useEffect(() => {
        if (!user) return;

        // 1. Points Listener
        const pointsRef = doc(db, "pointsStats", user.uid);
        const unsubPoints = onSnapshot(pointsRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data() as PointsStats;
                setPoints(data.totalPoints);
                // Trigger rank update when points change
                fetchRank(data.totalPoints);
            } else {
                setPoints(0);
                setRank(null);
            }
        });

        // 2. Unread Counts (Requires comparing total docs vs read docs)
        // This is expensive to do real-time if we query all cases. 
        // Strategy: 
        // - Listen to `userContentStatus` to get `casesRead.length`
        // - Get total count of published cases (cached or one-time fetch)
        // - Unread = Total - Read.

        const contentStatusRef = doc(db, "userContentStatus", user.uid);
        const unsubContent = onSnapshot(contentStatusRef, async (docSnap) => {
            const data = docSnap.data() as UserContentStatus | undefined;
            const readCasesCount = data?.casesRead?.length || 0;
            const readPapersCount = data?.papersRead?.length || 0;

            // Fetch totals (One-off or infrequent)
            // Ideally we cache this "totalPublished" in a stats doc, but simple count works for now.
            try {
                const casesColl = collection(db, "cases");
                const casesQ = query(casesColl, where("status", "==", "published"));
                const casesSnap = await getCountFromServer(casesQ);
                const totalCases = casesSnap.data().count;

                const papersColl = collection(db, "papers");
                const papersQ = query(papersColl, where("status", "==", "published"));
                const papersSnap = await getCountFromServer(papersQ);
                const totalPapers = papersSnap.data().count;

                setUnreadCases(Math.max(0, totalCases - readCasesCount));
                setUnreadPapers(Math.max(0, totalPapers - readPapersCount));

            } catch (e) {
                console.error("Error fetching counts", e);
            }
        });

        async function fetchRank(myPoints: number) {
            try {
                const coll = collection(db, "pointsStats");
                const q = query(coll, where("totalPoints", ">", myPoints));
                const snap = await getCountFromServer(q);
                setRank(snap.data().count + 1);
            } catch (e) {
                console.error("Error fetching rank", e);
            }
        }

        return () => {
            unsubPoints();
            unsubContent();
        };
    }, [user]);

    if (!user) return null;

    return (
        <aside className="hidden lg:flex flex-col w-64 bg-white border-r border-border h-[calc(100vh-65px)] sticky top-[65px] overflow-y-auto">
            <div className="p-6 space-y-6">

                {/* User Info */}
                <div className="text-center pb-6 border-b border-border">
                    <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-3">
                        <Activity size={32} className="text-primary" />
                    </div>
                    <h3 className="font-bold text-foreground truncate">{userProfile?.employeeId || "User"}</h3>
                    <p className="text-xs text-muted">Cardiology Fellow</p>
                </div>

                {/* Score Card */}
                <div className="bg-gradient-to-br from-primary/5 to-primary/10 rounded-xl p-4 border border-primary/20">
                    <div className="flex items-center gap-2 mb-2">
                        <Trophy className="text-amber-500" size={20} />
                        <span className="font-semibold text-primary">Your Progress</span>
                    </div>

                    <div className="flex justify-between items-end mb-1">
                        <span className="text-3xl font-bold text-foreground">{points}</span>
                        <span className="text-xs text-muted mb-1">pts</span>
                    </div>

                    <div className="text-xs text-muted font-medium flex items-center gap-1">
                        Rank: <span className="text-foreground font-bold">#{rank ?? "-"}</span>
                    </div>
                </div>

                {/* Admin Console (Visible only to Admins) */}
                {isAdminUser && (
                    <div className="space-y-3">
                        <h4 className="text-xs font-semibold text-muted uppercase tracking-wider">OMI 管理後台</h4>

                        <Link href="/admin" className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 border border-transparent hover:border-gray-200 transition-all group">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-gray-100 text-gray-600 rounded-md group-hover:bg-gray-200 transition-colors">
                                    <LayoutDashboard size={18} />
                                </div>
                                <span className="text-sm font-medium text-gray-700">儀表板</span>
                            </div>
                        </Link>

                        <Link href="/admin/cases" className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 border border-transparent hover:border-gray-200 transition-all group">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-blue-50 text-blue-600 rounded-md group-hover:bg-blue-100 transition-colors">
                                    <FileText size={18} />
                                </div>
                                <span className="text-sm font-medium text-gray-700">案例管理</span>
                            </div>
                        </Link>

                        <Link href="/admin/literature" className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 border border-transparent hover:border-gray-200 transition-all group">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-purple-50 text-purple-600 rounded-md group-hover:bg-purple-100 transition-colors">
                                    <BookOpen size={18} />
                                </div>
                                <span className="text-sm font-medium text-gray-700">文獻管理</span>
                            </div>
                        </Link>

                        <Link href="/admin/content" className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 border border-transparent hover:border-gray-200 transition-all group">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-red-50 text-red-600 rounded-md group-hover:bg-red-100 transition-colors">
                                    <Trash2 size={18} />
                                </div>
                                <span className="text-sm font-medium text-gray-700">內容刪除</span>
                            </div>
                        </Link>
                    </div>
                )}

                {/* Stats List */}
                <div className="space-y-3">
                    <h4 className="text-xs font-semibold text-muted uppercase tracking-wider">To Do</h4>

                    <Link href="/cases" className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 border border-transparent hover:border-gray-200 transition-all group">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-50 text-blue-600 rounded-md group-hover:bg-blue-100 transition-colors">
                                <Activity size={18} />
                            </div>
                            <span className="text-sm font-medium text-gray-700">Cases</span>
                        </div>
                        {unreadCases > 0 ? (
                            <span className="bg-alert-red text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                                {unreadCases}
                            </span>
                        ) : (
                            <div className="text-success"><Star size={14} fill="currentColor" /></div>
                        )}
                    </Link>

                    <Link href="/literature" className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 border border-transparent hover:border-gray-200 transition-all group">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-purple-50 text-purple-600 rounded-md group-hover:bg-purple-100 transition-colors">
                                <BookOpen size={18} />
                            </div>
                            <span className="text-sm font-medium text-gray-700">Papers</span>
                        </div>
                        {unreadPapers > 0 ? (
                            <span className="bg-alert-red text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                                {unreadPapers}
                            </span>
                        ) : (
                            <div className="text-success"><Star size={14} fill="currentColor" /></div>
                        )}
                    </Link>
                </div>

                {/* Motivation */}
                <div className="mt-auto pt-6 border-t border-border">
                    <p className="text-xs text-center text-muted italic">
                        &quot;The eye cannot see what the mind does not know.&quot;
                    </p>
                </div>

            </div>
        </aside>
    );
}
