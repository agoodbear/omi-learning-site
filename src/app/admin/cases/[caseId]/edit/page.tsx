"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { Case } from "@/types/firestore-schema";
import CaseForm from "@/components/admin/CaseForm";
import { ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";

export default function EditCasePage() {
    const { caseId } = useParams();
    const [caseData, setCaseData] = useState<Case | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        async function fetchCase() {
            if (!caseId || typeof caseId !== "string") {
                setError("無效的案例 ID");
                setLoading(false);
                return;
            }

            try {
                const caseRef = doc(db, "cases", caseId);
                const caseSnap = await getDoc(caseRef);

                if (!caseSnap.exists()) {
                    setError("找不到案例");
                } else {
                    setCaseData({ id: caseSnap.id, ...caseSnap.data() } as Case);
                }
            } catch (err) {
                console.error("Error fetching case:", err);
                setError("載入案例失敗");
            } finally {
                setLoading(false);
            }
        }

        fetchCase();
    }, [caseId]);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64 text-muted">
                <Loader2 size={24} className="animate-spin mr-2" />
                正在載入案例...
            </div>
        );
    }

    if (error || !caseData) {
        return (
            <div className="text-center py-12">
                <p className="text-alert-red mb-4">{error || "找不到案例"}</p>
                <Link href="/admin/cases" className="text-primary hover:underline">
                    返回案例列表
                </Link>
            </div>
        );
    }

    return (
        <div>
            <Link
                href="/admin/cases"
                className="inline-flex items-center gap-2 text-muted hover:text-primary mb-6 transition-colors"
            >
                <ArrowLeft size={16} /> 返回案例列表
            </Link>

            <div className="flex items-center gap-4 mb-8">
                <h1 className="text-2xl font-bold text-foreground">編輯案例</h1>
                <span className={`px-2 py-1 rounded-full text-xs font-medium capitalize
          ${caseData.status === "published" ? "bg-green-100 text-green-800" :
                        caseData.status === "draft" ? "bg-yellow-100 text-yellow-800" :
                            "bg-gray-100 text-gray-600"}`}
                >
                    {caseData.status}
                </span>
            </div>

            <CaseForm mode="edit" initialData={caseData} />
        </div>
    );
}
