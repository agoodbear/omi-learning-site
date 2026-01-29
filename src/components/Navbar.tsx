"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth/AuthContext";
import { Link as LinkIcon, FileText, Activity, LogOut, ShieldAlert, User, LogIn, UserPlus, BookOpen, Brain } from "lucide-react";

export default function Navbar() {
    const { user, isAdminUser, signOut, loading } = useAuth();

    if (loading) return (
        <nav className="bg-white border-b border-border p-4 flex justify-between items-center sticky top-0 z-50">
            <div className="flex items-center gap-2 text-primary animate-pulse">
                <Activity size={24} />
                <span className="text-xl font-bold">OMI Learning</span>
            </div>
            <span className="text-muted text-sm">Loading...</span>
        </nav>
    );

    return (
        <nav className="bg-white border-b border-border p-4 flex justify-between items-center sticky top-0 z-50 shadow-sm">
            <div className="flex items-center gap-8">
                <Link href="/" className="flex items-center gap-2 group">
                    <Activity size={24} className="text-primary" />
                    <span className="text-xl font-bold text-foreground">
                        OMI <span className="text-primary">Learning</span>
                    </span>
                </Link>

                {user && (
                    <div className="hidden md:flex items-center gap-6">
                        <Link href="/cases" className="flex items-center gap-2 text-muted hover:text-primary transition-colors text-sm font-medium">
                            <BookOpen size={16} />
                            Cases
                        </Link>
                        <Link href="/literature" className="flex items-center gap-2 text-muted hover:text-primary transition-colors text-sm font-medium">
                            <BookOpen size={16} />
                            Literature
                        </Link>
                        <Link href="/quiz" className="flex items-center gap-2 text-muted hover:text-primary transition-colors text-sm font-medium">
                            <Brain size={16} />
                            Quiz
                        </Link>
                    </div>
                )}
            </div>

            <div className="flex items-center gap-4">
                {user ? (
                    <>
                        <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-100">
                            <User size={14} className="text-muted" />
                            <span className="text-foreground text-sm font-medium">
                                {user.email?.split("@")[0]}
                            </span>
                        </div>

                        {isAdminUser && (
                            <Link
                                href="/admin"
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-alert-red/30 text-alert-red hover:bg-alert-red hover:text-white transition-all text-sm font-medium"
                            >
                                <ShieldAlert size={16} />
                                <span className="hidden sm:inline">Admin</span>
                            </Link>
                        )}

                        <button
                            onClick={() => signOut()}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-muted hover:text-foreground hover:bg-gray-100 transition-all cursor-pointer"
                            title="Sign Out"
                        >
                            <LogOut size={18} />
                        </button>
                    </>
                ) : (
                    <div className="flex gap-3">
                        <Link
                            href="/login"
                            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-primary border border-primary hover:bg-primary hover:text-white transition-all text-sm font-medium"
                        >
                            <LogIn size={16} />
                            <span>Log In</span>
                        </Link>
                        <Link
                            href="/signup"
                            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-white hover:bg-primary/90 transition-all text-sm font-medium"
                        >
                            <UserPlus size={16} />
                            <span>Sign Up</span>
                        </Link>
                    </div>
                )}
            </div>
        </nav>
    );
}
