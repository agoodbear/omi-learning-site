"use client";

import { useAuth } from "@/lib/auth/AuthContext";
import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, getCountFromServer } from "firebase/firestore";
import Link from "next/link";
import { FileText, Users, BarChart3, Plus, ChevronRight, BookOpen, ShieldAlert, Trash2, Download } from "lucide-react";

export default function AdminDashboard() {
    const { userProfile } = useAuth();

    // Stats State
    const [stats, setStats] = useState({
        totalCases: 0,
        publishedCases: 0,
        draftCases: 0,
        archivedCases: 0,
    });
    const [userCount, setUserCount] = useState(0);
    const [attemptCount, setAttemptCount] = useState(0);
    const [troubleSpots, setTroubleSpots] = useState<any[]>([]);

    useEffect(() => {
        async function fetchStats() {
            try {
                // 1. Case Stats & Counts
                const casesRef = collection(db, "cases");
                const snapshot = await getDocs(casesRef);

                let published = 0, draft = 0, archived = 0;
                // Map for trouble spot lookup
                const caseTitles: Record<string, string> = {};

                snapshot.docs.forEach(doc => {
                    const data = doc.data();
                    const status = data.status;
                    caseTitles[doc.id] = data.title;
                    if (status === "published") published++;
                    else if (status === "draft") draft++;
                    else if (status === "archived") archived++;
                });

                setStats({
                    totalCases: snapshot.docs.length,
                    publishedCases: published,
                    draftCases: draft,
                    archivedCases: archived,
                });

                // 2. User & Attempt Count
                try {
                    const usersSnap = await getCountFromServer(collection(db, "users"));
                    setUserCount(usersSnap.data().count);

                    const attemptsSnap = await getCountFromServer(collection(db, "attempts"));
                    setAttemptCount(attemptsSnap.data().count);
                } catch (e) {
                    console.error("Count aggregation failed", e);
                }

                // 3. Trouble Spots (Worst Accuracy)
                try {
                    const statsRef = collection(db, "caseStats");
                    const statsSnap = await getDocs(statsRef);
                    const computedStats = statsSnap.docs.map(doc => {
                        const d = doc.data();
                        // Avoid div by zero
                        const accuracy = d.totalAnswered > 0 ? (d.totalCorrect / d.totalAnswered) : 1;
                        return {
                            id: d.caseId,
                            title: caseTitles[d.caseId] || d.caseId,
                            accuracy,
                            totalAnswered: d.totalAnswered
                        };
                    }).filter(s => s.totalAnswered > 0) // Only show attempted cases
                        .sort((a, b) => a.accuracy - b.accuracy) // Ascending accuracy (worst first)
                        .slice(0, 5);

                    setTroubleSpots(computedStats);
                } catch (e) {
                    console.error("Trouble spots fetch failed", e);
                }

            } catch (err) {
                console.error("Error fetching admin stats:", err);
            }
        }

        fetchStats();
    }, []);

    return (
        <div>
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-foreground mb-2">管理員控制台</h1>
                <p className="text-muted">歡迎回來, {userProfile?.employeeId || "Admin"}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                <div className="card p-6 border-l-4 border-l-primary">
                    <div className="text-muted text-sm mb-1 flex items-center gap-2"><Users size={16} /> 總使用者</div>
                    <div className="text-3xl font-bold text-foreground">{userCount}</div>
                </div>
                <div className="card p-6 border-l-4 border-l-green-500">
                    <div className="text-muted text-sm mb-1 flex items-center gap-2"><FileText size={16} /> 已發布案例</div>
                    <div className="text-3xl font-bold text-foreground">{stats.publishedCases}</div>
                </div>
                <div className="card p-6 border-l-4 border-l-orange-500">
                    <div className="text-muted text-sm mb-1 flex items-center gap-2"><BarChart3 size={16} /> 測驗次數</div>
                    <div className="text-3xl font-bold text-foreground">{attemptCount}</div>
                </div>
                <div className="card p-6 border-l-4 border-l-purple-500">
                    <div className="text-muted text-sm mb-1 flex items-center gap-2"><BookOpen size={16} /> 草稿案例</div>
                    <div className="text-3xl font-bold text-foreground">{stats.draftCases}</div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Column: Management Tools */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Content Management */}
                    <div className="card p-6">
                        <h2 className="text-lg font-semibold text-foreground mb-4">內容管理</h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <Link href="/admin/cases" className="flex items-center gap-3 p-4 rounded-lg border border-border hover:border-primary hover:bg-gray-50 transition-all">
                                <div className="p-3 bg-blue-50 text-blue-600 rounded-md"><FileText size={20} /></div>
                                <div>
                                    <div className="font-medium text-foreground">心電圖案例庫</div>
                                    <div className="text-xs text-muted">管理案例內容</div>
                                </div>
                            </Link>
                            <Link href="/admin/literature" className="flex items-center gap-3 p-4 rounded-lg border border-border hover:border-primary hover:bg-gray-50 transition-all">
                                <div className="p-3 bg-purple-50 text-purple-600 rounded-md"><BookOpen size={20} /></div>
                                <div>
                                    <div className="font-medium text-foreground">文獻庫</div>
                                    <div className="text-xs text-muted">管理文獻內容</div>
                                </div>
                            </Link>
                        </div>
                    </div>

                    {/* Research & Data */}
                    <div className="card p-6">
                        <h2 className="text-lg font-semibold text-foreground mb-4">研究與數據</h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <Link href="/admin/users" className="flex items-center gap-3 p-4 rounded-lg border border-border hover:border-primary hover:bg-gray-50 transition-all">
                                <div className="p-3 bg-indigo-50 text-indigo-600 rounded-md"><Users size={20} /></div>
                                <div>
                                    <div className="font-medium text-foreground">醫師表現總覽</div>
                                    <div className="text-xs text-muted">檢視登入、答題與積分排行</div>
                                </div>
                            </Link>
                            <Link href="/admin/clinical-import" className="flex items-center gap-3 p-4 rounded-lg border border-border hover:border-primary hover:bg-gray-50 transition-all">
                                <div className="p-3 bg-teal-50 text-teal-600 rounded-md"><Plus size={20} /></div>
                                <div>
                                    <div className="font-medium text-foreground">臨床結果匯入</div>
                                    <div className="text-xs text-muted">匯入患者結果資料 (CSV)</div>
                                </div>
                            </Link>
                            <Link href="/admin/research-export" className="flex items-center gap-3 p-4 rounded-lg border border-border hover:border-primary hover:bg-gray-50 transition-all">
                                <div className="p-3 bg-amber-50 text-amber-600 rounded-md"><BarChart3 size={20} /></div>
                                <div>
                                    <div className="font-medium text-foreground">數據匯出</div>
                                    <div className="text-xs text-muted">下載研究用數據集</div>
                                </div>
                            </Link>
                        </div>
                    </div>

                    {/* Content Management */}
                    <div className="card p-6">
                        <h2 className="text-lg font-semibold text-foreground mb-4">內容管理</h2>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <Link href="/admin/content" className="flex items-center gap-3 p-4 rounded-lg border border-border hover:border-primary hover:bg-gray-50 transition-all">
                                <div className="p-3 bg-red-50 text-red-600 rounded-md"><Trash2 size={20} /></div>
                                <div>
                                    <div className="font-medium text-foreground">刪除內容</div>
                                    <div className="text-xs text-muted">刪除案例與文獻</div>
                                </div>
                            </Link>
                            {/* Placeholder for Edit/Create in future */}
                        </div>
                    </div>
                </div>

                {/* Right Column: Insights */}
                <div className="space-y-6">
                    {/* Trouble Spots */}
                    <div className="card p-6">
                        <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                            <ShieldAlert size={18} className="text-alert-red" /> 難題熱點
                        </h2>
                        <p className="text-xs text-muted mb-4">答錯率最高案例 (Top 5)</p>

                        <div className="space-y-3">
                            {troubleSpots.length > 0 ? troubleSpots.map((spot, i) => (
                                <div key={i} className="flex justify-between items-center p-2 rounded hover:bg-gray-50 border-b border-gray-100 last:border-0">
                                    <div className="flex-1 truncate pr-2">
                                        <div className="text-sm font-medium text-foreground truncate" title={spot.title}>{spot.title}</div>
                                        <div className="text-xs text-muted">ID: {spot.id}</div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-sm font-bold text-alert-red">{Math.round(spot.accuracy * 100)}%</div>
                                        <div className="text-[10px] text-muted">{spot.totalAnswered} 次作答</div>
                                    </div>
                                </div>
                            )) : (
                                <div className="text-sm text-muted text-center py-4">尚無數據</div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
