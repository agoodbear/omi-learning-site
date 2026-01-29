"use client";

import { useAuth } from "@/lib/auth/AuthContext";
import { Activity, ChevronRight, BookOpen, Brain, AlertCircle } from "lucide-react";
import Link from "next/link";
import DynamicECG from "@/components/DynamicECG";

export default function Home() {
  const { user, userProfile, loading } = useAuth();

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-80px)] p-4 text-center relative overflow-hidden bg-background w-full">
      <div className="container mx-auto max-w-5xl flex flex-col items-center">
        <DynamicECG />

        <div className="z-10 max-w-2xl w-full">
          {/* ... content ... */}
          <div className="mb-6">
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-foreground mb-4">
              OMI Learning
            </h1>
            <p className="text-lg text-muted max-w-md mx-auto">
              Master ECG interpretation through interactive cases and quizzes.
            </p>
          </div>

          {loading ? (
            <div className="card p-8 inline-block">
              <div className="flex flex-col items-center gap-4">
                <Activity className="animate-spin text-primary" size={32} />
                <span className="text-muted">Loading...</span>
              </div>
            </div>
          ) : user ? (
            <div className="card p-8 max-w-md mx-auto text-left">
              <div className="flex items-center gap-4 mb-6 pb-6 border-b border-border">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-primary font-bold text-lg">
                    {userProfile?.employeeId?.slice(0, 2) || "??"}
                  </span>
                </div>
                <div>
                  <p className="text-sm text-muted">Welcome back</p>
                  <p className="text-xl font-semibold text-foreground">
                    ID: {userProfile?.employeeId || "Unknown"}
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <Link
                  href="/cases"
                  className="flex items-center justify-between p-4 rounded-lg border border-border hover:border-primary hover:bg-primary/5 transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <BookOpen className="text-primary" size={20} />
                    <span className="font-medium text-foreground">Browse Case Library</span>
                  </div>
                  <ChevronRight size={18} className="text-muted group-hover:text-primary group-hover:translate-x-1 transition-all" />
                </Link>

                <Link
                  href="/quiz"
                  className="flex items-center justify-between p-4 rounded-lg border border-border hover:border-primary hover:bg-primary/5 transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <Brain className="text-primary" size={20} />
                    <span className="font-medium text-foreground">Start a Quiz</span>
                  </div>
                  <ChevronRight size={18} className="text-muted group-hover:text-primary group-hover:translate-x-1 transition-all" />
                </Link>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="card p-6 max-w-sm mx-auto flex items-start gap-4 text-left">
                <AlertCircle className="text-primary shrink-0 mt-0.5" size={22} />
                <div>
                  <h3 className="font-semibold text-foreground mb-1">Sign in to get started</h3>
                  <p className="text-muted text-sm">
                    Access the full case library and track your learning progress.
                  </p>
                </div>
              </div>

              <div className="flex gap-4 justify-center">
                <Link href="/login" className="btn-primary">
                  Log In
                </Link>
                <Link href="/signup" className="px-6 py-3 rounded-lg border border-border text-foreground font-semibold hover:border-primary hover:text-primary transition-all">
                  Sign Up
                </Link>
              </div>
            </div>
          )}
        </div>

        <div className="absolute bottom-4 text-xs text-muted">
          OMI Learning Platform v2.0
        </div>
      </div>
    </div>
  );
}
