"use client";

import CaseForm from "@/components/admin/CaseForm";
import { useAuth } from "@/lib/auth/AuthContext";
import { ArrowLeft, Upload } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

export default function SubmitCasePage() {
    const { user, userProfile, loading } = useAuth();

    // Redirect to login if not authenticated
    if (!loading && !user) {
        redirect("/login");
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        );
    }

    const submitter = user && userProfile ? {
        uid: user.uid,
        employeeId: userProfile.employeeId
    } : undefined;

    return (
        <div className="max-w-4xl mx-auto">
            <Link
                href="/cases"
                className="inline-flex items-center gap-2 text-muted hover:text-primary mb-6 transition-colors"
            >
                <ArrowLeft size={16} /> 返回案例列表
            </Link>

            <div className="flex items-center gap-3 mb-8">
                <div className="p-3 bg-primary/10 text-primary rounded-lg">
                    <Upload size={24} />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-foreground">提交新案例</h1>
                    <p className="text-sm text-muted">您的案例將在管理員審核後發布</p>
                </div>
            </div>

            <CaseForm mode="submit" submitter={submitter} />
        </div>
    );
}
