"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth/AuthContext";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { UserProfile } from "@/types/user";
import { deleteUserAction, resetPasswordAction, setUserApprovedAction } from "@/app/actions/userManagement";
import { Trash2, KeyRound, Search, AlertTriangle, CheckCircle2 } from "lucide-react";

export default function UserManagementPage() {
    const { user, isAdminUser } = useAuth();
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

    // Password Reset Modal State
    const [resetModal, setResetModal] = useState<{ uid: string; employeeId: string } | null>(null);
    const [newPassword, setNewPassword] = useState("");

    useEffect(() => {
        if (!isAdminUser) return;
        fetchUsers();
    }, [isAdminUser]);

    const fetchUsers = async () => {
        try {
            const usersRef = collection(db, "users");
            const q = query(usersRef, orderBy("createdAt", "desc"));
            const snap = await getDocs(q);
            const data = snap.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile));
            setUsers(data);
        } catch (e) {
            console.error("Fetch users failed:", e);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (targetUid: string, employeeId: string) => {
        if (!user) return;
        if (!confirm(`確定要刪除「${employeeId}」的帳號嗎？此操作無法復原。`)) return;

        setActionLoading(targetUid);
        setFeedback(null);
        const result = await deleteUserAction(await user.getIdToken(), targetUid);
        setActionLoading(null);

        if (result.success) {
            setFeedback({ type: "success", message: `已成功刪除 ${employeeId}` });
            setUsers(prev => prev.filter(u => u.uid !== targetUid));
        } else {
            setFeedback({ type: "error", message: result.error || "刪除失敗" });
        }
    };

    const handleApproval = async (targetUid: string, employeeId: string, approved: boolean) => {
        if (!user) return;

        setActionLoading(targetUid);
        setFeedback(null);
        const result = await setUserApprovedAction(await user.getIdToken(), targetUid, approved);
        setActionLoading(null);

        if (result.success) {
            setFeedback({ type: "success", message: `${employeeId} 已${approved ? "核准" : "取消核准"}` });
            setUsers(prev => prev.map(u => u.uid === targetUid ? { ...u, approved } : u));
        } else {
            setFeedback({ type: "error", message: result.error || "更新失敗" });
        }
    };

    const handlePasswordReset = async () => {
        if (!user || !resetModal) return;

        setActionLoading(resetModal.uid);
        setFeedback(null);
        const result = await resetPasswordAction(await user.getIdToken(), resetModal.uid, newPassword);
        setActionLoading(null);

        if (result.success) {
            setFeedback({ type: "success", message: `已成功重設 ${resetModal.employeeId} 的密碼` });
            setResetModal(null);
            setNewPassword("");
        } else {
            setFeedback({ type: "error", message: result.error || "重設失敗" });
        }
    };

    const filteredUsers = users.filter(u =>
        (u.employeeId || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (u.displayName || "").toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (!isAdminUser) {
        return <div className="p-8 text-center text-red-500">您沒有權限訪問此頁面</div>;
    }

    return (
        <div className="p-6 max-w-4xl mx-auto">
            <h1 className="text-2xl font-bold mb-2">人員管理</h1>
            <p className="text-muted mb-6">管理員可在此核准新註冊的帳號、刪除使用者或重設密碼。</p>

            {/* Feedback */}
            {feedback && (
                <div className={`p-4 rounded-lg mb-4 flex items-center gap-2 ${feedback.type === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
                    {feedback.type === "success" ? <CheckCircle2 size={20} /> : <AlertTriangle size={20} />}
                    {feedback.message}
                </div>
            )}

            {/* Search */}
            <div className="relative mb-6">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input
                    type="text"
                    placeholder="搜尋員工編號或姓名..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary/50 focus:border-primary"
                />
            </div>

            {/* User List */}
            {loading ? (
                <div className="text-center py-12 text-muted">載入中...</div>
            ) : filteredUsers.length === 0 ? (
                <div className="text-center py-12 text-muted">找不到符合條件的使用者</div>
            ) : (
                <div className="bg-white border rounded-xl overflow-hidden">
                    <table className="w-full">
                        <thead className="bg-gray-50 border-b">
                            <tr>
                                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">員工編號</th>
                                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">姓名</th>
                                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">狀態</th>
                                <th className="text-right px-4 py-3 text-sm font-semibold text-gray-600">操作</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredUsers.map((u) => (
                                <tr key={u.uid} className="border-b last:border-b-0 hover:bg-gray-50">
                                    <td className="px-4 py-3 font-medium">{u.employeeId}</td>
                                    <td className="px-4 py-3 text-gray-600">{u.displayName || "-"}</td>
                                    <td className="px-4 py-3 text-sm">
                                        {u.approved ? <span className="text-green-700">已核准</span> : <span className="text-amber-700">待核准</span>}
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <button
                                                onClick={() => handleApproval(u.uid, u.employeeId, !u.approved)}
                                                disabled={actionLoading === u.uid}
                                                className="px-3 py-1.5 text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 rounded-lg transition-colors disabled:opacity-50"
                                            >
                                                <CheckCircle2 size={14} className="inline mr-1" />
                                                {u.approved ? "取消核准" : "核准"}
                                            </button>
                                            <button
                                                onClick={() => setResetModal({ uid: u.uid, employeeId: u.employeeId })}
                                                disabled={actionLoading === u.uid}
                                                className="px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors disabled:opacity-50"
                                            >
                                                <KeyRound size={14} className="inline mr-1" />
                                                重設密碼
                                            </button>
                                            <button
                                                onClick={() => handleDelete(u.uid, u.employeeId)}
                                                disabled={actionLoading === u.uid}
                                                className="px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors disabled:opacity-50"
                                            >
                                                <Trash2 size={14} className="inline mr-1" />
                                                刪除
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Password Reset Modal */}
            {resetModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl">
                        <h2 className="text-lg font-bold mb-4">重設密碼</h2>
                        <p className="text-sm text-muted mb-4">為「{resetModal.employeeId}」設定新密碼：</p>
                        <input
                            type="password"
                            placeholder="輸入新密碼 (至少 6 個字元)"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            className="w-full px-4 py-2 border rounded-lg mb-4 focus:ring-2 focus:ring-primary/50 focus:border-primary"
                        />
                        <div className="flex justify-end gap-2">
                            <button
                                onClick={() => { setResetModal(null); setNewPassword(""); }}
                                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                取消
                            </button>
                            <button
                                onClick={handlePasswordReset}
                                disabled={!newPassword || newPassword.length < 6 || actionLoading !== null}
                                className="px-4 py-2 text-sm text-white bg-primary hover:bg-primary/90 rounded-lg transition-colors disabled:opacity-50"
                            >
                                確認重設
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
