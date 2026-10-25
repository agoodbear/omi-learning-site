"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth/AuthContext";
import { db } from "@/lib/firebase";
import {
    collection,
    query,
    where,
    orderBy,
    onSnapshot,
    addDoc,
    updateDoc,
    doc,
    Timestamp,
    serverTimestamp,
    getDoc
} from "firebase/firestore";
import { Comment } from "@/types/firestore-schema";
import { Send, MessageSquare, ThumbsUp, Heart, Flame, Smile } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface CommentsSectionProps {
    resourceId: string;
}

const EMOJI_OPTIONS = ["👍", "❤️", "🔥", "😮"];

export default function CommentsSection({ resourceId }: CommentsSectionProps) {
    const { user, userProfile } = useAuth();
    const [comments, setComments] = useState<Comment[]>([]);
    const [newComment, setNewComment] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (!resourceId) return;

        const q = query(
            collection(db, "comments"),
            where("caseId", "==", resourceId),
            orderBy("createdAt", "desc")
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetchedComments = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as Comment));
            setComments(fetchedComments);
        });

        return () => unsubscribe();
    }, [resourceId]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newComment.trim() || !user || !userProfile) return;

        setIsSubmitting(true);
        try {
            await addDoc(collection(db, "comments"), {
                caseId: resourceId,
                userId: user.uid,
                userEmail: userProfile.employeeId, // Using employee ID as display name
                content: newComment.trim(),
                createdAt: serverTimestamp(),
                reactions: {}
            });
            setNewComment("");
        } catch (error) {
            console.error("Error adding comment:", error);
            alert("發布評論失敗，請稍後再試。");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleReaction = async (commentId: string, emoji: string) => {
        if (!user || !commentId) return;

        const commentRef = doc(db, "comments", commentId);
        const comment = comments.find(c => c.id === commentId);

        if (!comment) return;

        const currentReactions = comment.reactions || {};
        const userList = currentReactions[emoji] || [];
        const isReacted = userList.includes(user.uid);

        let newUserList;
        if (isReacted) {
            newUserList = userList.filter(id => id !== user.uid);
        } else {
            newUserList = [...userList, user.uid];
        }

        // Clean up empty arrays to keep DB clean
        const updatedReactions = { ...currentReactions };
        if (newUserList.length > 0) {
            updatedReactions[emoji] = newUserList;
        } else {
            delete updatedReactions[emoji];
        }

        try {
            await updateDoc(commentRef, {
                reactions: updatedReactions
            });
        } catch (error) {
            console.error("Error updating reaction:", error);
        }
    };

    return (
        <section className="bg-white rounded-xl border border-border overflow-hidden">
            <div className="p-6 border-b border-border bg-gray-50 flex items-center gap-2">
                <MessageSquare className="text-primary" size={20} />
                <h3 className="font-semibold text-lg text-foreground">討論區 ({comments.length})</h3>
            </div>

            <div className="p-6">
                {/* Comment Input */}
                {user ? (
                    <form onSubmit={handleSubmit} className="mb-8 flex gap-4">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold shrink-0">
                            {userProfile?.employeeId?.slice(0, 2) || "U"}
                        </div>
                        <div className="flex-1">
                            <textarea
                                value={newComment}
                                onChange={(e) => setNewComment(e.target.value)}
                                placeholder="分享您的想法或是提問..."
                                className="w-full p-3 border border-border rounded-lg focus:outline-none focus:border-primary min-h-[100px] resize-y mb-2 bg-white"
                            />
                            <div className="flex justify-end">
                                <button
                                    type="submit"
                                    disabled={!newComment.trim() || isSubmitting}
                                    className="btn-primary flex items-center gap-2 px-6"
                                >
                                    {isSubmitting ? "發布中..." : <>發布 <Send size={16} /></>}
                                </button>
                            </div>
                        </div>
                    </form>
                ) : (
                    <div className="mb-8 p-4 bg-gray-50 rounded-lg text-center text-muted border border-dashed border-border">
                        請先登入以參與討論。
                    </div>
                )}

                {/* Comment List */}
                <div className="space-y-6">
                    {comments.length === 0 ? (
                        <p className="text-center text-muted py-8 italic">目前還沒有評論，成為第一個發言的人吧！</p>
                    ) : (
                        comments.map((comment) => (
                            <div key={comment.id} className="flex gap-4">
                                <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 font-bold shrink-0">
                                    {comment.userEmail?.slice(0, 2) || "?"}
                                </div>
                                <div className="flex-1">
                                    <div className="bg-gray-50 p-4 rounded-lg rounded-tl-none relative group">
                                        <div className="flex justify-between items-start mb-2">
                                            <span className="font-semibold text-foreground text-sm">
                                                員編: {comment.userEmail || "Unknown"}
                                            </span>
                                            <span className="text-xs text-muted">
                                                {comment.createdAt ? formatDistanceToNow(comment.createdAt.toDate(), { addSuffix: true }) : "just now"}
                                            </span>
                                        </div>
                                        <p className="text-foreground whitespace-pre-wrap">{comment.content}</p>
                                    </div>

                                    {/* Reactions */}
                                    <div className="flex items-center gap-2 mt-2">
                                        {/* Reaction Buttons */}
                                        {user && EMOJI_OPTIONS.map(emoji => {
                                            const count = comment.reactions?.[emoji]?.length || 0;
                                            const isReacted = comment.reactions?.[emoji]?.includes(user.uid);

                                            return (
                                                <button
                                                    key={emoji}
                                                    onClick={() => handleReaction(comment.id!, emoji)}
                                                    className={`text-sm px-2 py-1 rounded-full border flex items-center gap-1 transition-all
                                                    ${isReacted
                                                            ? "bg-primary/10 border-primary text-primary font-medium"
                                                            : "bg-white border-transparent hover:bg-gray-100 text-muted"}`}
                                                >
                                                    <span>{emoji}</span>
                                                    {count > 0 && <span>{count}</span>}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </section>
    );
}
