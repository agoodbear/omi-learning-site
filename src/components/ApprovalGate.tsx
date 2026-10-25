"use client";

import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthContext";

const OPEN_PATHS = ["/login", "/signup"];

/**
 * 已登入但尚未被管理員核准的帳號，只看得到等待畫面。
 * 真正的擋在 Firestore rules 與 server actions，這裡只是給人看的說明。
 */
export default function ApprovalGate({ children }: { children: React.ReactNode }) {
    const { user, userProfile, loading, isApproved, signOut } = useAuth();
    const pathname = usePathname();

    if (loading || !user || !userProfile || isApproved || OPEN_PATHS.includes(pathname)) {
        return <>{children}</>;
    }

    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center gap-4">
            <h2 className="text-xl font-bold">帳號等待管理員核准</h2>
            <p className="text-muted max-w-md">
                員工編號 {userProfile.employeeId} 已註冊成功。管理員核准後即可開始使用；核准後重新整理此頁即可。
            </p>
            <button onClick={signOut} className="px-4 py-2 rounded border text-sm">登出</button>
        </div>
    );
}
