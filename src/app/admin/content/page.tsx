"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { deleteCase, deletePaper } from "@/app/actions/deleteContent";
import { Loader2, Trash2, FileText, HeartPulse, ArrowLeft } from "lucide-react";
import Link from "next/link";

type ItemType = "case" | "paper";

interface ContentItem {
    id: string;
    title: string;
    createdAt: any;
    status: string;
}

export default function AdminContentPage() {
    const [activeTab, setActiveTab] = useState<ItemType>("case");
    const [items, setItems] = useState<ContentItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [processingId, setProcessingId] = useState<string | null>(null);

    useEffect(() => {
        loadData();
    }, [activeTab]);

    async function loadData() {
        setLoading(true);
        try {
            const colName = activeTab === "case" ? "cases" : "papers";
            const q = query(collection(db, colName), orderBy("createdAt", "desc"));
            const snap = await getDocs(q);
            const list = snap.docs.map(d => ({
                id: d.id,
                ...d.data()
            })) as ContentItem[];
            setItems(list);
        } catch (e) {
            console.error(e);
            alert("載入失敗");
        } finally {
            setLoading(false);
        }
    }

    const handleDelete = async (id: string, title: string) => {
        if (!confirm(`確定要刪除 "${title}" 嗎？此動作無法復原。`)) return;

        setProcessingId(id);
        try {
            if (activeTab === "case") {
                await deleteCase(id);
            } else {
                await deletePaper(id);
            }
            // Remove locally
            setItems(prev => prev.filter(item => item.id !== id));
        } catch (e) {
            console.error(e);
            alert("刪除失敗");
        } finally {
            setProcessingId(null);
        }
    };

    return (
        <div className="max-w-5xl mx-auto p-6">
            <div className="mb-6 flex items-center gap-4">
                <Link href="/admin" className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                    <ArrowLeft size={20} className="text-muted" />
                </Link>
                <div>
                    <h1 className="text-2xl font-bold text-foreground">內容管理</h1>
                    <p className="text-sm text-muted">管理與刪除 ECG 案例與文獻資料。</p>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-4 border-b border-border mb-6">
                <button
                    onClick={() => setActiveTab("case")}
                    className={`pb-3 px-4 font-semibold text-sm transition-colors border-b-2 ${activeTab === "case" ? "border-primary text-primary" : "border-transparent text-muted hover:text-foreground"
                        }`}
                >
                    ECG 案例
                </button>
                <button
                    onClick={() => setActiveTab("paper")}
                    className={`pb-3 px-4 font-semibold text-sm transition-colors border-b-2 ${activeTab === "paper" ? "border-primary text-primary" : "border-transparent text-muted hover:text-foreground"
                        }`}
                >
                    文獻庫
                </button>
            </div>

            {/* List */}
            <div className="card overflow-hidden">
                {loading ? (
                    <div className="p-12 flex justify-center"><Loader2 className="animate-spin text-primary" size={32} /></div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-50 text-muted uppercase text-xs border-b border-border">
                                <tr>
                                    <th className="px-6 py-3">標題 / ID</th>
                                    <th className="px-6 py-3 w-32 text-center">狀態</th>
                                    <th className="px-6 py-3 w-32 text-center">格式</th>
                                    <th className="px-6 py-3 w-24 text-center">操作</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {items.map(item => (
                                    <tr key={item.id} className="bg-white hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="font-semibold text-foreground line-clamp-1">{item.title}</div>
                                            <div className="text-xs text-muted font-mono">{item.id}</div>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className={`px-2 py-1 rounded text-xs font-bold ${item.status === 'published' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                                                }`}>
                                                {item.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-center text-muted">
                                            {activeTab === "case" ? <HeartPulse size={18} className="mx-auto" /> : <FileText size={18} className="mx-auto" />}
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <button
                                                onClick={() => handleDelete(item.id, item.title)}
                                                disabled={processingId === item.id}
                                                className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors disabled:opacity-50"
                                                title="刪除"
                                            >
                                                {processingId === item.id ? <Loader2 size={18} className="animate-spin" /> : <Trash2 size={18} />}
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {items.length === 0 && (
                                    <tr>
                                        <td colSpan={4} className="p-8 text-center text-muted">此分類尚無資料</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
