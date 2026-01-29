"use client";

import UserLeaderboard from "@/components/admin/UserLeaderboard";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function AdminUsersPage() {
    return (
        <div className="max-w-6xl mx-auto p-6">
            <div className="mb-6 flex items-center gap-4">
                <Link href="/admin" className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                    <ArrowLeft size={20} className="text-muted" />
                </Link>
                <div>
                    <h1 className="text-2xl font-bold text-foreground">使用者表現總覽</h1>
                    <p className="text-sm text-muted">檢視每位主治醫師的登入頻率、測驗答題與積分排行。</p>
                </div>
            </div>

            <UserLeaderboard />
        </div>
    );
}
