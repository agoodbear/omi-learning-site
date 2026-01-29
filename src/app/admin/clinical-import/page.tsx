"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Upload, FileUp, AlertCircle, CheckCircle } from "lucide-react";
import Papa from "papaparse";
import { useAuth } from "@/lib/auth/AuthContext";
import { importClinicalData } from "@/app/actions/importClinicalData";

export default function ClinicalImportPage() {
    const { user } = useAuth();
    const [file, setFile] = useState<File | null>(null);
    const [previewData, setPreviewData] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);
    const [logs, setLogs] = useState<string[]>([]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
            setStatus(null);
            setLogs([]);
            parseFile(e.target.files[0]);
        }
    };

    const parseFile = (file: File) => {
        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                if (results.errors.length > 0) {
                    setStatus({ type: 'error', message: `解析錯誤: ${results.errors[0].message}` });
                } else {
                    setPreviewData(results.data.slice(0, 5)); // Preview top 5
                }
            }
        });
    };

    const handleImport = async () => {
        if (!file || !user) return;
        setLoading(true);
        setStatus(null);

        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: async (results) => {
                const data = results.data;
                try {
                    const result = await importClinicalData(user.uid, data);

                    if (result.success) {
                        setStatus({ type: 'success', message: `成功匯入 ${result.count} 筆紀錄。` });
                        if (result.errors && result.errors.length > 0) {
                            setLogs(result.errors);
                        }
                    } else {
                        setStatus({ type: 'error', message: "匯入失敗。" });
                    }
                } catch (err: any) {
                    setStatus({ type: 'error', message: err.message });
                } finally {
                    setLoading(false);
                }
            }
        });
    };

    return (
        <div className="max-w-5xl mx-auto p-6">
            <div className="mb-6 flex items-center gap-4">
                <Link href="/admin" className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                    <ArrowLeft size={20} className="text-muted" />
                </Link>
                <div>
                    <h1 className="text-2xl font-bold text-foreground">臨床結果匯入</h1>
                    <p className="text-sm text-muted">上傳包含患者結果與時間指標的 CSV 檔案。</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Upload Area */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="card p-6">
                        <label className="block text-sm font-medium text-foreground mb-4">選擇 CSV 檔案</label>
                        <div className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:bg-gray-50 transition-colors relative">
                            <input
                                type="file"
                                accept=".csv"
                                onChange={handleFileChange}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            />
                            <Upload className="mx-auto text-muted mb-2" size={32} />
                            <p className="text-sm text-muted">
                                {file ? file.name : "點擊或拖曳 CSV 至此"}
                            </p>
                        </div>

                        <div className="mt-4 text-xs text-muted space-y-1">
                            <p className="font-semibold">必須包含以下標題:</p>
                            <code className="block bg-gray-100 p-1 rounded">patientEncounterId</code>
                            <code className="block bg-gray-100 p-1 rounded">attendingEmployeeId</code>
                            <code className="block bg-gray-100 p-1 rounded">shiftDateTime</code>
                        </div>

                        <button
                            onClick={handleImport}
                            disabled={!file || loading}
                            className={`w-full mt-6 py-2 rounded-lg font-semibold flex items-center justify-center gap-2 transition-all
                            ${!file || loading ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'btn-primary'}`}
                        >
                            {loading ? "匯入中..." : <><FileUp size={18} /> 開始匯入</>}
                        </button>
                    </div>

                    {status && (
                        <div className={`p-4 rounded-lg flex items-start gap-3 ${status.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
                            {status.type === 'success' ? <CheckCircle size={20} className="shrink-0 mt-0.5" /> : <AlertCircle size={20} className="shrink-0 mt-0.5" />}
                            <div>
                                <p className="font-medium">{status.message}</p>
                                {status.type === 'success' && logs.length > 0 && (
                                    <p className="text-xs mt-1">其中 {logs.length} 筆資料跳過 (詳見日誌)。</p>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Preview Area */}
                <div className="lg:col-span-2">
                    <div className="card h-full flex flex-col">
                        <div className="p-4 border-b border-border bg-gray-50 rounded-t-lg">
                            <h2 className="font-semibold text-foreground flex items-center gap-2">
                                資料預覽 <span className="text-xs font-normal text-muted">(前 5 筆)</span>
                            </h2>
                        </div>

                        <div className="flex-1 overflow-auto p-0">
                            {previewData.length > 0 ? (
                                <table className="w-full text-sm text-left">
                                    <thead className="text-xs text-muted uppercase bg-gray-50 sticky top-0">
                                        <tr>
                                            {Object.keys(previewData[0]).map((header) => (
                                                <th key={header} className="px-4 py-3 font-medium border-b border-border">{header}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {previewData.map((row, i) => (
                                            <tr key={i} className="border-b border-border hover:bg-gray-50">
                                                {Object.values(row).map((val: any, j) => (
                                                    <td key={j} className="px-4 py-3 text-foreground truncate max-w-[150px]" title={String(val)}>
                                                        {val}
                                                    </td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            ) : (
                                <div className="h-64 flex items-center justify-center text-muted">
                                    尚未載入資料
                                </div>
                            )}
                        </div>

                        {/* Logs Console */}
                        {logs.length > 0 && (
                            <div className="border-t border-border p-4 bg-gray-900 text-gray-300 font-mono text-xs max-h-48 overflow-y-auto">
                                <p className="mb-2 text-gray-400 uppercase tracking-wider">匯入日誌 / 錯誤:</p>
                                {logs.map((log, i) => (
                                    <div key={i} className="mb-1 border-b border-gray-800 pb-1 last:border-0">
                                        {log}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
