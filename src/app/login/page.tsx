"use client";

import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase/config";
import { employeeIdToEmail } from "@/lib/auth/utils";
import Link from "next/link";
import { LogIn, AlertCircle, Fingerprint, Lock } from "lucide-react";

export default function LoginPage() {
    const [employeeId, setEmployeeId] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const router = useRouter();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        try {
            const email = employeeIdToEmail(employeeId);
            await signInWithEmailAndPassword(auth, email, password);
            router.push("/");
        } catch (err: any) {
            console.error(err);
            if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
                setError("存取被拒 (ACCESS DENIED): 帳號或密碼錯誤");
            } else {
                setError(err.message || "登入失敗 (LOGIN FAILED): 未知錯誤");
            }
        }
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-[calc(100vh-80px)] p-4">
            <div className="glass-panel p-8 rounded-lg w-full max-w-md border-t-4 border-t-ecg-green relative">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-black px-4 text-ecg-green font-mono text-sm tracking-widest border border-ecg-green/50">
                    安全登入終端
                </div>

                <div className="flex justify-center mb-6 text-ecg-green">
                    <Fingerprint size={48} className="animate-pulse opacity-80" />
                </div>

                {error && (
                    <div className="bg-alert-red/10 border border-alert-red text-alert-red p-3 rounded mb-6 text-xs font-mono flex items-center gap-2">
                        <AlertCircle size={16} />
                        {error}
                    </div>
                )}

                <form onSubmit={handleLogin} className="space-y-6">
                    <div>
                        <label className="block text-xs font-mono text-gray-500 mb-1 uppercase tracking-wider">員工編號 (Employee ID)</label>
                        <div className="relative">
                            <input
                                type="text"
                                value={employeeId}
                                onChange={(e) => setEmployeeId(e.target.value)}
                                className="w-full bg-black/50 border border-gray-700 rounded px-3 py-2 pl-10 text-ecg-green font-mono focus:outline-none focus:border-ecg-green focus:shadow-[0_0_10px_rgba(0,255,65,0.2)] transition-all placeholder-gray-700"
                                placeholder="請輸入 ID"
                                required
                            />
                            <div className="absolute left-3 top-2.5 text-gray-600">
                                <Fingerprint size={16} />
                            </div>
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-mono text-gray-500 mb-1 uppercase tracking-wider">通行密碼 (Passcode)</label>
                        <div className="relative">
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full bg-black/50 border border-gray-700 rounded px-3 py-2 pl-10 text-ecg-green font-mono focus:outline-none focus:border-ecg-green focus:shadow-[0_0_10px_rgba(0,255,65,0.2)] transition-all placeholder-gray-700"
                                placeholder="••••••••"
                                required
                            />
                            <div className="absolute left-3 top-2.5 text-gray-600">
                                <Lock size={16} />
                            </div>
                        </div>
                    </div>
                    <button
                        type="submit"
                        className="w-full bg-ecg-green/90 text-black py-2 rounded font-bold font-mono hover:bg-ecg-green transition-all shadow-[0_0_15px_rgba(0,255,65,0.3)] hover:shadow-[0_0_25px_rgba(0,255,65,0.6)] flex items-center justify-center gap-2"
                    >
                        <LogIn size={18} /> 驗證身分 (AUTHENTICATE)
                    </button>
                </form>

                <p className="mt-8 text-center text-xs font-mono text-gray-600">
                    還沒有憑證?{" "}
                    <Link href="/signup" className="text-ecg-green hover:underline">
                        註冊新 ID
                    </Link>
                </p>
            </div>
        </div>
    );
}
