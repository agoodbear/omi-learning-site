"use client";

import { useState } from "react";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase/config";
import { employeeIdToEmail } from "@/lib/auth/utils";
import Link from "next/link";
import { UserPlus, AlertCircle, Fingerprint, Lock, ShieldCheck } from "lucide-react";

export default function SignupPage() {
    const [employeeId, setEmployeeId] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const router = useRouter();

    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        try {
            const email = employeeIdToEmail(employeeId);

            // 1. Create Auth User
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            // 2. Create Firestore Profile explicitly
            await setDoc(doc(db, "users", user.uid), {
                uid: user.uid,
                employeeId,
                createdAt: serverTimestamp(),
                lastLoginAt: serverTimestamp(),
            });

            router.push("/");
        } catch (err: any) {
            console.error(err);
            if (err.code === 'auth/email-already-in-use') {
                setError("註冊失敗: ID 已被使用");
            } else {
                setError(err.message || "系統錯誤: 初始化失敗");
            }
        }
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-[calc(100vh-80px)] p-4">
            <div className="glass-panel p-8 rounded-lg w-full max-w-md border-t-4 border-t-ecg-green relative">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-black px-4 text-ecg-green font-mono text-sm tracking-widest border border-ecg-green/50">
                    新進人員登錄
                </div>

                <div className="flex justify-center mb-6 text-ecg-green">
                    <UserPlus size={48} className="animate-pulse opacity-80" />
                </div>

                {error && (
                    <div className="bg-alert-red/10 border border-alert-red text-alert-red p-3 rounded mb-6 text-xs font-mono flex items-center gap-2">
                        <AlertCircle size={16} />
                        {error}
                    </div>
                )}

                <div className="bg-ecg-green/5 border border-ecg-green/20 p-4 mb-6 rounded text-xs font-mono text-gray-400">
                    <div className="flex items-center gap-2 text-ecg-green mb-2">
                        <ShieldCheck size={16} />
                        <span>安全協定 (SECURITY PROTOCOL)</span>
                    </div>
                    僅限授權醫療人員註冊。所有活動皆受監控。
                </div>

                <form onSubmit={handleSignup} className="space-y-6">
                    <div>
                        <label className="block text-xs font-mono text-gray-500 mb-1 uppercase tracking-wider">員工編號 (Employee ID)</label>
                        <div className="relative">
                            <input
                                type="text"
                                value={employeeId}
                                onChange={(e) => setEmployeeId(e.target.value)}
                                className="w-full bg-black/50 border border-gray-700 rounded px-3 py-2 pl-10 text-ecg-green font-mono focus:outline-none focus:border-ecg-green focus:shadow-[0_0_10px_rgba(0,255,65,0.2)] transition-all placeholder-gray-700"
                                placeholder="請輸入分配之 ID"
                                required
                            />
                            <div className="absolute left-3 top-2.5 text-gray-600">
                                <Fingerprint size={16} />
                            </div>
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-mono text-gray-500 mb-1 uppercase tracking-wider">設定密碼 (Passcode)</label>
                        <div className="relative">
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full bg-black/50 border border-gray-700 rounded px-3 py-2 pl-10 text-ecg-green font-mono focus:outline-none focus:border-ecg-green focus:shadow-[0_0_10px_rgba(0,255,65,0.2)] transition-all placeholder-gray-700"
                                placeholder="設定密碼"
                                required
                            />
                            <div className="absolute left-3 top-2.5 text-gray-600">
                                <Lock size={16} />
                            </div>
                        </div>
                    </div>
                    <button
                        type="submit"
                        className="w-full bg-white text-black py-2 rounded font-bold font-mono hover:bg-gray-200 transition-all shadow-[0_0_15px_rgba(255,255,255,0.3)] hover:shadow-[0_0_25px_rgba(255,255,255,0.6)] flex items-center justify-center gap-2"
                    >
                        <UserPlus size={18} /> 初始化帳號 (INITIALIZE)
                    </button>
                </form>

                <p className="mt-8 text-center text-xs font-mono text-gray-600">
                    已經擁有權限?{" "}
                    <Link href="/login" className="text-white hover:underline">
                        存取終端機
                    </Link>
                </p>
            </div>
        </div>
    );
}
