'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { API_BASE_URL } from '@/lib/api';

const MOODS = ['joyful', 'depressed', 'love', 'chaos', 'chill', 'emotional'];

export default function MoodVoting({ songId, initialVotes }: { songId: number, initialVotes?: Record<string, number> }) {
    const t = useTranslations('Moods');
    const [votes, setVotes] = useState<Record<string, number>>(initialVotes || {});
    const [isLoading, setIsLoading] = useState(false);

    const [activeVote, setActiveVote] = useState<string | null>(null);

    // Fetch user's active vote on mount
    useEffect(() => {
        const checkVote = async () => {
            try {
                const res = await fetch(`${API_BASE_URL}/votes/song/${songId}/check`);
                if (res.ok) {
                    const data = await res.json();
                    if (data.has_voted) {
                        setActiveVote(data.vote_type);
                    }
                }
            } catch (e) { }
        };
        checkVote();
    }, [songId]);

    const handleVote = async (mood: string) => {
        // Optimistic UI Pattern
        const previousActive = activeVote;
        const previousVotes = { ...votes };

        let newVotes = { ...votes };

        if (activeVote === mood) {
            // Optimistic Cancel
            if (newVotes[mood] > 0) newVotes[mood]--;
            setVotes(newVotes);
            setActiveVote(null);
        } else {
            // Optimistic Switch/Submit
            if (activeVote && newVotes[activeVote] > 0) {
                newVotes[activeVote]--; // Decrement previous vote
            }
            newVotes[mood] = (newVotes[mood] || 0) + 1;
            setVotes(newVotes);
            setActiveVote(mood);
        }

        setIsLoading(true);
        try {
            if (previousActive === mood) {
                // Cancel vote
                const url = `${API_BASE_URL}/votes/song/${songId}`;
                const res = await fetch(url, { method: 'DELETE' });
                if (res.ok) {
                    const data = await res.json();
                    setVotes(data.mood_votes);
                } else {
                    // Revert
                    setVotes(previousVotes);
                    setActiveVote(previousActive);
                }
            } else {
                // Submit vote. The backend will seamlessly replace if a different mood was selected previously.
                const url = `${API_BASE_URL}/votes/song/${songId}`;
                const res = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ vote_type: mood })
                });

                if (res.ok) {
                    const data = await res.json();
                    setVotes(data.mood_votes);
                } else {
                    // Revert
                    setVotes(previousVotes);
                    setActiveVote(previousActive);
                }
            }
        } catch (e) {
            console.error(e);
            // Revert
            setVotes(previousVotes);
            setActiveVote(previousActive);
        } finally {
            setIsLoading(false);
        }
    };

    const totalVotes = Object.values(votes).reduce((a, b) => a + b, 0);
    const hasVoted = activeVote !== null;

    return (
        <div className="border border-[var(--hairline-strong)] p-4 md:p-5 rounded-xl bg-transparent w-full h-full">
            <div className="flex items-center justify-between mb-5">
                <h3 className="font-bold tracking-[0.2em] uppercase text-[11px] text-[var(--text-secondary)] flex items-center gap-3">
                    {t('title', { defaultMessage: 'Community Vibe' })}
                    {!hasVoted && (
                        <span className="text-[9px] text-[var(--miku-teal)] tracking-wider normal-case opacity-80 border border-[var(--miku-teal)]/30 px-2 py-0.5 rounded-full animate-pulse">
                            {t('vote_to_reveal', { defaultMessage: 'Vote to see results!' })}
                        </span>
                    )}
                </h3>
                <div className="text-right text-[10px] text-[var(--text-secondary)] tracking-widest uppercase font-mono">
                    {totalVotes} {t('votes_total', { defaultMessage: 'Votes' })}
                </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                {MOODS.map(mood => {
                    const count = votes[mood] || 0;
                    const percent = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
                    const isSelected = activeVote === mood;
                    const isHighest = hasVoted && totalVotes > 0 && count === Math.max(...Object.values(votes));

                    return (
                        <button
                            key={mood}
                            disabled={isLoading}
                            onClick={() => handleVote(mood)}
                            className={`
                                relative overflow-hidden group border rounded text-left transition-all duration-300
                                bg-transparent
                                ${isSelected
                                    ? 'border-[var(--miku-teal)] drop-shadow-[0_0_8px_rgba(57,197,187,0.3)]'
                                    : isHighest
                                        ? 'border-white/50 drop-shadow-[0_0_8px_rgba(255,255,255,0.2)]'
                                        : 'border-[var(--hairline-strong)] hover:border-white/30'}
                            `}
                        >
                            {/* Inner Progress Bar */}
                            {hasVoted && (
                                <div
                                    className="absolute inset-y-0 left-0 transition-all duration-1000 ease-out z-0"
                                    style={{
                                        width: `${percent}%`,
                                        opacity: isSelected ? 0.2 : isHighest ? 0.15 : 0.05,
                                        backgroundColor: isSelected ? 'var(--cyan-subtle)' : 'white'
                                    }}
                                />
                            )}

                            {/* Text Content */}
                            <div className="relative p-3 flex justify-between items-center z-10 gap-2">
                                <span className={`font-bold text-[10px] md:text-xs uppercase tracking-widest transition-colors ${isSelected ? 'text-[var(--miku-teal)]' : isHighest ? 'text-white' : 'text-[var(--text-secondary)] group-hover:text-white'}`}>
                                    {t(mood) || mood}
                                </span>
                                {hasVoted && (
                                    <span className={`text-[10px] font-mono tracking-wider ${isSelected ? 'text-[var(--miku-teal)]' : isHighest ? 'text-white' : 'text-gray-500'}`}>
                                        {percent}%
                                    </span>
                                )}
                            </div>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
