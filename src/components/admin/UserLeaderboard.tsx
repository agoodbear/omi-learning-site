"use client";

import { useEffect, useState } from "react";
import { getAdminUserStats, AdminUserStatRow } from "@/app/actions/getAdminUserStats";
import { useAuth } from "@/lib/auth/AuthContext";
import { Loader2, Search, ArrowUpDown, Trophy } from "lucide-react";

export default function UserLeaderboard() {
    const { user } = useAuth();
    const [data, setData] = useState<AdminUserStatRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [sortConfig, setSortConfig] = useState<{ key: keyof AdminUserStatRow, direction: 'asc' | 'desc' }>({ key: 'totalPoints', direction: 'desc' });

    useEffect(() => {
        if (!user) return;
        async function load() {
            try {
                const res = await getAdminUserStats(user!.uid);
                if (res.success && res.data) {
                    setData(res.data);
                }
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        }
        load();
    }, [user]);

    // Derived Data
    const filteredData = data.filter(row =>
        row.employeeId.toLowerCase().includes(search.toLowerCase()) ||
        row.email.toLowerCase().includes(search.toLowerCase())
    );

    const sortedData = [...filteredData].sort((a, b) => {
        const aVal = a[sortConfig.key];
        const bVal = b[sortConfig.key];

        if (aVal === null) return 1;
        if (bVal === null) return -1;

        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
    });

    const handleSort = (key: keyof AdminUserStatRow) => {
        setSortConfig(current => ({
            key,
            direction: current.key === key && current.direction === 'desc' ? 'asc' : 'desc'
        }));
    };

    if (loading) return <div className="p-12 flex justify-center"><Loader2 className="animate-spin text-primary" size={32} /></div>;

    return (
        <div className="card overflow-hidden">
            <div className="p-4 border-b border-border bg-gray-50 flex flex-col md:flex-row justify-between items-center gap-4">
                <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                    <Trophy className="text-amber-500" /> 醫師學習表現看板
                </h2>
                <div className="relative w-full md:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={16} />
                    <input
                        type="text"
                        placeholder="搜尋姓名或 ID..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead className="text-xs text-muted uppercase bg-gray-50 border-b border-border">
                        <tr>
                            <th className="px-6 py-3 font-medium">Rank</th>
                            <th className="px-6 py-3 font-medium cursor-pointer hover:bg-gray-100" onClick={() => handleSort('employeeId')}>
                                <div className="flex items-center gap-1">醫師 ID <ArrowUpDown size={12} /></div>
                            </th>
                            <th className="px-6 py-3 font-medium cursor-pointer hover:bg-gray-100 text-center" onClick={() => handleSort('loginCount')}>
                                <div className="flex items-center justify-center gap-1">登入次數 <ArrowUpDown size={12} /></div>
                            </th>
                            <th className="px-6 py-3 font-medium cursor-pointer hover:bg-gray-100 text-center" onClick={() => handleSort('totalAttempts')}>
                                <div className="flex items-center justify-center gap-1">測驗次數 <ArrowUpDown size={12} /></div>
                            </th>
                            <th className="px-6 py-3 font-medium cursor-pointer hover:bg-gray-100 text-center" onClick={() => handleSort('accuracy')}>
                                <div className="flex items-center justify-center gap-1">正確率 <ArrowUpDown size={12} /></div>
                            </th>
                            <th className="px-6 py-3 font-medium cursor-pointer hover:bg-gray-100 text-right" onClick={() => handleSort('totalPoints')}>
                                <div className="flex items-center justify-end gap-1">總積分 <ArrowUpDown size={12} /></div>
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {sortedData.map((row, idx) => (
                            <tr key={row.uid} className="bg-white hover:bg-gray-50 transition-colors">
                                <td className="px-6 py-4 font-medium text-muted w-16">
                                    {idx + 1 <= 3 ? (
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold
                                            ${idx === 0 ? 'bg-amber-400' : idx === 1 ? 'bg-slate-400' : 'bg-orange-400'}`}>
                                            {idx + 1}
                                        </div>
                                    ) : (
                                        <span className="pl-3">#{idx + 1}</span>
                                    )}
                                </td>
                                <td className="px-6 py-4">
                                    <div className="font-semibold text-foreground">{row.employeeId}</div>
                                    <div className="text-xs text-muted">{row.email}</div>
                                </td>
                                <td className="px-6 py-4 text-center text-foreground">{row.loginCount}</td>
                                <td className="px-6 py-4 text-center text-foreground">{row.totalAttempts}</td>
                                <td className="px-6 py-4 text-center">
                                    <span className={`px-2 py-1 rounded text-xs font-bold 
                                        ${row.accuracy >= 80 ? 'bg-green-100 text-green-700' :
                                            row.accuracy >= 60 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                                        {row.accuracy}%
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-right font-bold text-primary text-lg">
                                    {row.totalPoints.toLocaleString()}
                                </td>
                            </tr>
                        ))}
                        {sortedData.length === 0 && (
                            <tr>
                                <td colSpan={6} className="px-6 py-8 text-center text-muted">
                                    查無資料
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
