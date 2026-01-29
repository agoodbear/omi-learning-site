"use client";

import { useAuth } from "@/lib/auth/AuthContext";
import { useRouter, usePathname } from "next/navigation";
import { useEffect } from "react";
import Link from "next/link";
import { LayoutDashboard, FileText, Home, ChevronLeft, BookOpen } from "lucide-react";

export default function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const { user, isAdminUser, loading } = useAuth();
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
        if (!loading) {
            if (!user) {
                router.push("/login?redirect=/admin");
            }
        }
    }, [user, loading, router]);

    if (loading) return (
        <div className="flex items-center justify-center min-h-screen bg-background text-muted">
            正在載入管理後台...
        </div>
    );

    if (!user) return null;

    if (!isAdminUser) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-background">
                <h1 className="text-4xl font-bold text-alert-red mb-4">403 禁止訪問</h1>
                <p className="text-muted mb-6">您沒有權限訪問此區域。</p>
                <button
                    onClick={() => router.push('/')}
                    className="btn-primary cursor-pointer"
                >
                    返回首頁
                </button>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 p-8">
            <div className="max-w-7xl mx-auto">
                {children}
            </div>
        </div>
    );
}
