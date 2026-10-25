"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Download, FileJson, FileType, CheckCircle, AlertCircle } from "lucide-react";
import Papa from "papaparse";
import { useAuth } from "@/lib/auth/AuthContext";
import { exportCollection } from "@/app/actions/exportData";
import { generateLinkedExport as genLinked } from "@/app/actions/researchExport";

const DATASETS = [
    { id: "clinicalEvents", name: "臨床結果", desc: "患者就醫紀錄與結果" },
    { id: "attempts", name: "測驗紀錄", desc: "詳細答題日誌" },
    { id: "events", name: "系統事件", desc: "原始互動日誌 (瀏覽、登入...)" },
    { id: "userStats", name: "使用者統計", desc: "累計表現數據" },
    { id: "pointsStats", name: "遊戲化積分", desc: "積分細項" },
    { id: "users", name: "使用者", desc: "使用者檔案 (員工ID)" },
    { id: "cases", name: "案例元數據", desc: "案例標題與分類" },
];

export default function ResearchExportPage() {
    const { user } = useAuth();
    const [loading, setLoading] = useState<string | null>(null);
    const [status, setStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);

    const handleDownload = async (collectionId: string, format: 'json' | 'csv') => {
        if (!user) return;
        setLoading(collectionId);
        setStatus(null);

        try {
            const result = await exportCollection(await user.getIdToken(), collectionId);

            if (!result.success || !result.data) {
                throw new Error(result.error || "匯入失敗");
            }

            const data = result.data;
            let content = "";
            let mimeType = "";
            let extension = "";

            if (format === 'json') {
                content = JSON.stringify(data, null, 2);
                mimeType = "application/json";
                extension = "json";
            } else {
                content = Papa.unparse(data);
                mimeType = "text/csv;charset=utf-8;";
                extension = "csv";
            }

            const blob = new Blob([content], { type: mimeType });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.setAttribute("download", `omi_${collectionId}_${new Date().toISOString().slice(0, 10)}.${extension}`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            setStatus({ type: 'success', message: `已下載 ${data.length} 筆紀錄。` });

        } catch (err: any) {
            setStatus({ type: 'error', message: err.message });
        } finally {
            setLoading(null);
        }
    };

    const handleLinkedExport = async () => {
        if (!user) return;
        setLoading("linked");
        setStatus(null);
        try {
            // Call the specialized server action
            const result = await genLinked(await user.getIdToken());

            if (!result.success || !result.csv) {
                throw new Error("關聯資料匯出無數據。");
            }

            const blob = new Blob([result.csv], { type: "text/csv;charset=utf-8;" });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.setAttribute("download", `omi_LINKED_research_${new Date().toISOString().slice(0, 10)}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            setStatus({ type: 'success', message: "研究關聯資料已下載。" });
        } catch (err: any) {
            console.error(err);
            setStatus({ type: 'error', message: err.message || "關聯資料匯出失敗" });
        } finally {
            setLoading(null);
        }
    };

    return (
        <div className="max-w-5xl mx-auto p-6">
            <div className="mb-6 flex items-center gap-4">
                <Link href="/admin" className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                    <ArrowLeft size={20} className="text-muted" />
                </Link>
                <div>
                    <h1 className="text-2xl font-bold text-foreground">研究數據匯出</h1>
                    <p className="text-sm text-muted">下載分析用數據集（包含敏感資料）。</p>
                </div>
            </div>

            {status && (
                <div className={`mb-6 p-4 rounded-lg flex items-center gap-3 ${status.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
                    {status.type === 'success' ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
                    <span className="font-medium">{status.message}</span>
                </div>
            )}

            {/* Linked Export Section (Highlight) */}
            <div className="mb-8 p-6 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-xl shadow-sm">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h3 className="text-lg font-bold text-blue-900 mb-2 flex items-center gap-2">
                            🔬 研究關聯匯出 (關鍵功能)
                        </h3>
                        <p className="text-sm text-blue-700 max-w-2xl">
                            產生結合「<strong>臨床結果</strong>」與主治醫師「<strong>7/14/30天網站使用量</strong>」的數據集。
                            使用嚴格的伺服器時間戳記與員工ID進行對齊。
                        </p>
                    </div>
                    <button
                        onClick={handleLinkedExport}
                        disabled={!!loading}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-6 rounded-lg shadow transition-colors flex items-center gap-2 whitespace-nowrap"
                    >
                        {loading === "linked" ? "計算時間窗口中..." : <><Download size={18} /> 下載關聯分析 CSV</>}
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {DATASETS.map((ds) => (
                    <div key={ds.id} className="card p-6 flex flex-col justify-between">
                        <div>
                            <div className="flex items-center gap-2 mb-2">
                                <span className="p-2 bg-gray-100 text-gray-600 rounded">
                                    <Download size={18} />
                                </span>
                                <h3 className="font-semibold text-lg text-foreground">{ds.name}</h3>
                            </div>
                            <p className="text-sm text-muted mb-6">{ds.desc}</p>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <button
                                onClick={() => handleDownload(ds.id, 'json')}
                                disabled={!!loading}
                                className="flex items-center justify-center gap-2 py-2 px-3 rounded border border-border bg-white hover:bg-gray-50 text-sm font-medium transition-colors"
                            >
                                <FileJson size={16} className="text-orange-500" /> JSON
                            </button>
                            <button
                                onClick={() => handleDownload(ds.id, 'csv')}
                                disabled={!!loading}
                                className="flex items-center justify-center gap-2 py-2 px-3 rounded border border-border bg-white hover:bg-gray-50 text-sm font-medium transition-colors"
                            >
                                <FileType size={16} className="text-green-500" /> CSV
                            </button>
                        </div>
                        {loading === ds.id && (
                            <div className="mt-2 text-xs text-center text-primary animate-pulse">處理中...</div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
