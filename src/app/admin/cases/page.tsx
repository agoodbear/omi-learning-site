"use client";

import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, query, getDocs, doc, updateDoc, Timestamp, orderBy } from "firebase/firestore";
import { Case, CaseCategory } from "@/types/firestore-schema";
import Link from "next/link";
import { Plus, Edit, Eye, EyeOff, Archive, Trash2, Filter } from "lucide-react";
import { deleteCase } from "@/app/actions/deleteContent";

type CaseStatus = "draft" | "published" | "archived";

export default function AdminCasesPage() {
    const [cases, setCases] = useState<Case[]>([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState<CaseStatus | "all">("all");
    const [categoryFilter, setCategoryFilter] = useState<CaseCategory | "all">("all");

    const fetchCases = async () => {
        try {
            const casesRef = collection(db, "cases");
            const q = query(casesRef, orderBy("updatedAt", "desc"));
            const snapshot = await getDocs(q);

            const fetchedCases = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as Case));

            setCases(fetchedCases);
        } catch (err) {
            console.error("Error fetching cases:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchCases();
    }, []);

    const handleStatusChange = async (caseId: string, newStatus: CaseStatus) => {
        try {
            const caseRef = doc(db, "cases", caseId);
            await updateDoc(caseRef, {
                status: newStatus,
                updatedAt: Timestamp.now()
            });

            // Refresh list
            await fetchCases();
        } catch (err) {
            console.error("Error updating status:", err);
            alert("Failed to update status");
        }
    };

    const handleDelete = async (caseId: string, title: string) => {
        if (!confirm(`確定要刪除案例 "${title}" 嗎？此動作無法復原。`)) return;

        try {
            const res = await deleteCase(caseId);
            if (res.success) {
                setCases(prev => prev.filter(c => c.id !== caseId));
            } else {
                alert("刪除失敗: " + res.error);
            }
        } catch (err) {
            console.error("Delete error:", err);
            alert("系統錯誤");
        }
    };

    const filteredCases = cases.filter(c => {
        if (statusFilter !== "all" && c.status !== statusFilter) return false;
        if (categoryFilter !== "all" && c.category !== categoryFilter) return false;
        return true;
    });

    const getStatusBadge = (status: string) => {
        switch (status) {
            case "published": return "bg-green-100 text-green-800";
            case "draft": return "bg-yellow-100 text-yellow-800";
            case "archived": return "bg-gray-100 text-gray-600";
            default: return "bg-gray-100 text-gray-600";
        }
    };

    const getCategoryBadge = (category: string) => {
        switch (category) {
            case "OMI": return "bg-amber-100 text-amber-800";
            case "STEMI_mimics": return "bg-red-100 text-red-800";
            case "Electrolyte": return "bg-blue-100 text-blue-800";
            default: return "bg-gray-100 text-gray-600";
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64 text-muted">
                正在載入案例...
            </div>
        );
    }

    return (
        <div>
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-foreground">案例管理</h1>
                    <p className="text-muted text-sm mt-1">建立、編輯和管理心電圖案例</p>
                </div>
                <Link
                    href="/admin/cases/new"
                    className="btn-primary flex items-center gap-2"
                >
                    <Plus size={18} /> 新增案例
                </Link>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-4 mb-6 p-4 bg-gray-50 rounded-lg border border-border">
                <div className="flex items-center gap-2">
                    <Filter size={16} className="text-muted" />
                    <span className="text-sm font-medium text-foreground">篩選：</span>
                </div>

                <div className="flex items-center gap-2">
                    <label className="text-sm text-muted">狀態：</label>
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value as CaseStatus | "all")}
                        className="border border-border rounded px-3 py-1.5 text-sm bg-white focus:outline-none focus:border-primary"
                    >
                        <option value="all">全部</option>
                        <option value="draft">草稿</option>
                        <option value="published">已發布</option>
                        <option value="archived">已封存</option>
                    </select>
                </div>

                <div className="flex items-center gap-2">
                    <label className="text-sm text-muted">分類：</label>
                    <select
                        value={categoryFilter}
                        onChange={(e) => setCategoryFilter(e.target.value as CaseCategory | "all")}
                        className="border border-border rounded px-3 py-1.5 text-sm bg-white focus:outline-none focus:border-primary"
                    >
                        <option value="all">全部</option>
                        <option value="OMI">OMI</option>
                        <option value="STEMI_mimics">STEMI Mimics</option>
                        <option value="Electrolyte">Electrolyte</option>
                    </select>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-lg border border-border overflow-hidden">
                <table className="w-full">
                    <thead className="bg-gray-50 border-b border-border">
                        <tr>
                            <th className="text-left px-4 py-3 text-sm font-semibold text-foreground">標題</th>
                            <th className="text-left px-4 py-3 text-sm font-semibold text-foreground">分類</th>
                            <th className="text-left px-4 py-3 text-sm font-semibold text-foreground">狀態</th>
                            <th className="text-left px-4 py-3 text-sm font-semibold text-foreground">更新時間</th>
                            <th className="text-right px-4 py-3 text-sm font-semibold text-foreground">操作</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {filteredCases.map((c) => (
                            <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                                <td className="px-4 py-4">
                                    <div className="font-medium text-foreground line-clamp-1">{c.title}</div>
                                    <div className="text-xs text-muted mt-1">ID: {c.id?.slice(0, 8)}...</div>
                                </td>
                                <td className="px-4 py-4">
                                    <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${getCategoryBadge(c.category)}`}>
                                        {c.category === "STEMI_mimics" ? "Mimic" : c.category}
                                    </span>
                                </td>
                                <td className="px-4 py-4">
                                    <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium capitalize ${getStatusBadge(c.status)}`}>
                                        {c.status}
                                    </span>
                                </td>
                                <td className="px-4 py-4 text-sm text-muted">
                                    {c.updatedAt?.toDate ? c.updatedAt.toDate().toLocaleDateString() : "N/A"}
                                </td>
                                <td className="px-4 py-4">
                                    <div className="flex justify-end gap-2">
                                        <Link
                                            href={`/admin/cases/${c.id}/edit`}
                                            className="p-2 text-muted hover:text-primary hover:bg-primary/5 rounded transition-colors"
                                            title="Edit"
                                        >
                                            <Edit size={16} />
                                        </Link>

                                        {c.status === "draft" && (
                                            <button
                                                onClick={() => handleStatusChange(c.id!, "published")}
                                                className="p-2 text-muted hover:text-green-600 hover:bg-green-50 rounded transition-colors cursor-pointer"
                                                title="Publish"
                                            >
                                                <Eye size={16} />
                                            </button>
                                        )}

                                        {c.status === "published" && (
                                            <button
                                                onClick={() => handleStatusChange(c.id!, "draft")}
                                                className="p-2 text-muted hover:text-yellow-600 hover:bg-yellow-50 rounded transition-colors cursor-pointer"
                                                title="Unpublish (back to draft)"
                                            >
                                                <EyeOff size={16} />
                                            </button>
                                        )}

                                        {c.status !== "archived" && (
                                            <button
                                                onClick={() => handleStatusChange(c.id!, "archived")}
                                                className="p-2 text-muted hover:text-gray-600 hover:bg-gray-100 rounded transition-colors cursor-pointer"
                                                title="Archive"
                                            >
                                                <Archive size={16} />
                                            </button>
                                        )}

                                        {c.status === "archived" && (
                                            <button
                                                onClick={() => handleStatusChange(c.id!, "draft")}
                                                className="p-2 text-muted hover:text-yellow-600 hover:bg-yellow-50 rounded transition-colors cursor-pointer"
                                                title="Restore to Draft"
                                            >
                                                <EyeOff size={16} />
                                            </button>
                                        )}

                                        <button
                                            onClick={() => handleDelete(c.id!, c.title)}
                                            className="p-2 text-muted hover:text-red-600 hover:bg-red-50 rounded transition-colors cursor-pointer"
                                            title="Delete"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                {filteredCases.length === 0 && (
                    <div className="text-center py-12 text-muted">
                        找不到案例。 {statusFilter !== "all" || categoryFilter !== "all" ? "請嘗試調整篩選條件。" : ""}
                    </div>
                )}
            </div>

            <div className="mt-4 text-sm text-muted">
                顯示 {filteredCases.length} / {cases.length} 筆案例
            </div>
        </div>
    );
}
