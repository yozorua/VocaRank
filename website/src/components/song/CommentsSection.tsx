'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { API_BASE_URL } from '@/lib/api';
import Image from 'next/image';

interface CommentUser {
    id: number;
    name: string | null;
    picture_url: string | null;
}

interface SongComment {
    id: number;
    song_id: number;
    user_id: number;
    content: string;
    created_at: string;
    updated_at: string | null;
    user: CommentUser;
}

export default function CommentsSection({ songId }: { songId: number }) {
    const { data: session } = useSession();
    const t = useTranslations('Song');
    const [comments, setComments] = useState<SongComment[]>([]);
    const [newComment, setNewComment] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        fetchComments();
    }, [songId]);

    const fetchComments = async () => {
        setIsLoading(true);
        try {
            const res = await fetch(`${API_BASE_URL}/songs/${songId}/comments`);
            if (res.ok) {
                const data = await res.json();
                setComments(data);
            }
        } catch (error) {
            console.error("Failed to fetch comments", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handlePostComment = async () => {
        if (!newComment.trim() || !session) return;
        setIsSubmitting(true);
        try {
            const apiToken = (session as any).apiToken;

            const res = await fetch(`${API_BASE_URL}/songs/${songId}/comments`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiToken}`
                },
                body: JSON.stringify({ content: newComment.trim() })
            });

            if (res.ok) {
                const postedComment = await res.json();
                setComments([postedComment, ...comments]);
                setNewComment('');
            }
        } catch (error) {
            console.error("Failed to post comment", error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (commentId: number) => {
        if (!confirm(t('confirm_delete_comment', { defaultMessage: 'Are you sure you want to delete this comment?' }))) return;

        try {
            const apiToken = (session as any).apiToken;

            const res = await fetch(`${API_BASE_URL}/songs/${songId}/comments/${commentId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${apiToken}`
                }
            });

            if (res.ok) {
                setComments(comments.filter(c => c.id !== commentId));
            }
        } catch (error) {
            console.error("Failed to delete comment", error);
        }
    };

    const formatDate = (isoString: string) => {
        const date = new Date(isoString);
        return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    };

    return (
        <div className="w-full flex flex-col gap-6 mt-8">
            <div className="flex items-center gap-3">
                <h2 className="text-xl md:text-2xl font-black tracking-wider text-white">
                    {t('comments', { defaultMessage: 'Comments' })}
                </h2>
            </div>

            {/* Comments List */}
            <div className="flex flex-col gap-4">
                {isLoading ? (
                    <div className="text-center text-[var(--text-secondary)] text-sm py-10">{t('loading_comments', { defaultMessage: 'Loading comments...' })}</div>
                ) : comments.length > 0 ? (
                    comments.map(comment => {
                        const isOwner = session?.user?.email && (session as any).user?.id === comment.user_id; // Check ownership using API token or ID if available

                        // Fallback simple ownership check since NextAuth doesn't expose ID directly by default without callbacks
                        // Assuming your API gives back the user_id for the comment. We might need a better way to check if current user matches comment user.
                        // For now we'll show delete button if we have an API token (logged in) but ideally we check IDs.
                        // I'll show the delete button purely based on the user object we get from the comment vs NextAuth display name.

                        const canDelete = session && session.user?.name === comment.user.name && session.user?.image === comment.user.picture_url;

                        return (
                            <div key={comment.id} className="group flex gap-4 p-4 rounded-xl border border-transparent hover:border-[var(--hairline)] hover:bg-black/10 transition-all">
                                <div className="shrink-0 mt-1">
                                    {comment.user.picture_url ? (
                                        <img src={comment.user.picture_url} alt="Profile" className="w-10 h-10 object-cover rounded-full shadow-sm" />
                                    ) : (
                                        <div className="w-10 h-10 rounded-full bg-[var(--hairline-strong)] flex items-center justify-center text-xs font-bold text-white uppercase">
                                            {comment.user.name ? comment.user.name.charAt(0) : '?'}
                                        </div>
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="font-bold text-sm text-white">{comment.user.name || 'Anonymous'}</span>
                                        <span className="text-xs text-[var(--text-secondary)]">{formatDate(comment.created_at)}</span>
                                    </div>
                                    <p className="text-sm text-[#d4d4d4] whitespace-pre-wrap leading-relaxed">
                                        {comment.content}
                                    </p>
                                </div>
                                {canDelete && (
                                    <button
                                        onClick={() => handleDelete(comment.id)}
                                        className="shrink-0 text-[var(--text-secondary)] hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all self-center p-2"
                                        title={t('delete', { defaultMessage: 'Delete comment' })}
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                                    </button>
                                )}
                            </div>
                        );
                    })
                ) : (
                    <div className="text-center text-[var(--text-secondary)] text-sm py-16 border border-dashed border-[var(--hairline-strong)] rounded-xl">
                        {t('no_comments', { defaultMessage: 'No comments yet. Be the first to share your thoughts!' })}
                    </div>
                )}
            </div>

            {/* Comment Input Area */}
            {session ? (
                <div className="flex gap-4 p-4 md:p-6 bg-black/10 rounded-xl border border-[var(--hairline)] focus-within:border-[var(--hairline-strong)] transition-colors mt-4">
                    <div className="shrink-0 mt-1">
                        {session.user?.image ? (
                            <img src={session.user.image} alt="Profile" className="w-10 h-10 object-cover rounded-full border border-white/10" />
                        ) : (
                            <div className="w-10 h-10 rounded-full bg-[var(--hairline-strong)]"></div>
                        )}
                    </div>
                    <div className="flex-1 flex flex-col gap-3">
                        <textarea
                            value={newComment}
                            onChange={(e) => setNewComment(e.target.value)}
                            maxLength={3000}
                            placeholder={t('write_comment', { defaultMessage: 'Add a comment...' })}
                            className="w-full bg-transparent text-white text-sm placeholder-[var(--text-secondary)] resize-none outline-none min-h-[80px]"
                        />
                        <div className="flex justify-between items-center border-t border-[var(--hairline)] pt-3">
                            <div className="flex items-center gap-4">
                                <span className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-widest">{t('markdown_supported', { defaultMessage: 'Be respectful' })}</span>
                                <span className={`text-[10px] font-mono ${newComment.length > 2900 ? 'text-red-400' : 'text-[var(--text-tertiary)]'}`}>{newComment.length}/3000</span>
                            </div>
                            <button
                                onClick={handlePostComment}
                                disabled={!newComment.trim() || isSubmitting}
                                className="px-5 py-2 bg-[var(--vermilion)] hover:bg-[#ff5544] disabled:bg-[var(--hairline-strong)] disabled:text-[var(--text-secondary)] text-white text-xs font-bold tracking-widest uppercase rounded transition-colors"
                            >
                                {isSubmitting ? t('posting', { defaultMessage: 'Posting...' }) : t('post_comment', { defaultMessage: 'Post' })}
                            </button>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="mt-4 p-6 bg-black/10 rounded-xl border border-[var(--hairline)] flex justify-center items-center py-10">
                    <p className="text-[var(--text-secondary)] text-sm tracking-wide">
                        {t('login_to_comment', { defaultMessage: 'Please log in to leave a comment.' })}
                    </p>
                </div>
            )}
        </div>
    );
}
