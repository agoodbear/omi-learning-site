"use client";

import CaseForm from "@/components/admin/CaseForm";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function NewCasePage() {
    return (
        <div>
            <Link
                href="/admin/cases"
                className="inline-flex items-center gap-2 text-muted hover:text-primary mb-6 transition-colors"
            >
                <ArrowLeft size={16} /> 返回案例列表
            </Link>

            <h1 className="text-2xl font-bold text-foreground mb-8">建立新案例</h1>

            <CaseForm mode="create" />
        </div>
    );
}
