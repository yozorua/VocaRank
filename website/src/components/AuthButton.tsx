'use client';

import { signIn, signOut, useSession } from "next-auth/react";
import Image from "next/image";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState, useRef, useEffect } from "react";

export default function AuthButton({ mobile }: { mobile?: boolean }) {
    const { data: session, status } = useSession();
    const t = useTranslations('Navbar');
    const tFav = useTranslations('Favorites');
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    if (status === "loading") {
        return <div className="animate-pulse w-8 h-8 rounded-full bg-[var(--hairline-strong)]"></div>;
    }

    if (session && session.user) {
        if (mobile) {
            return (
                <div className="flex flex-col items-center gap-6 w-full">
                    <button
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setIsOpen(!isOpen);
                        }}
                        className="text-xl font-medium tracking-[0.2em] text-white hover:text-[var(--vermilion)] transition-colors relative flex items-center justify-center"
                    >
                        {t('profile', { defaultMessage: 'Profile' })}
                        <div className="absolute -right-8 flex items-center justify-center">
                            <svg className={`w-5 h-5 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                        </div>
                    </button>

                    {isOpen && (
                        <div className="flex flex-col items-center gap-6 mt-2 mb-2 animate-fade-in w-full">
                            <Link
                                href="/profile"
                                className="text-lg font-medium tracking-[0.2em] text-[var(--text-secondary)] hover:text-white transition-colors"
                            >
                                {t('profile_settings', { defaultMessage: 'My Profile' })}
                            </Link>
                            <Link
                                href="/favorites"
                                className="text-lg font-medium tracking-[0.2em] text-[var(--text-secondary)] hover:text-white transition-colors"
                            >
                                {tFav('title', { defaultMessage: 'My Favorites' })}
                            </Link>
                            <button
                                onClick={() => signOut({ callbackUrl: '/' })}
                                className="text-lg font-medium tracking-[0.2em] text-red-500 hover:text-red-400 transition-colors"
                            >
                                {t('logout', { defaultMessage: 'Sign Out' })}
                            </button>
                        </div>
                    )}
                </div>
            );
        }

        return (
            <div className="relative" ref={dropdownRef}>
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className="flex items-center gap-2 focus:outline-none"
                >
                    {session.user.image ? (
                        <Image
                            src={session.user.image}
                            alt="Profile Picture"
                            width={32}
                            height={32}
                            unoptimized
                            className={`rounded-full border transition-colors ${isOpen ? 'border-white' : 'border-[var(--hairline)] hover:border-white'} object-cover w-8 h-8`}
                        />
                    ) : (
                        <div className={`w-8 h-8 rounded-full bg-[var(--hairline-strong)] border transition-colors ${isOpen ? 'border-white' : 'border-transparent'}`}></div>
                    )}
                </button>

                {/* Dropdown Menu */}
                {isOpen && (
                    <div className="absolute right-0 top-full mt-2 w-64 bg-[#0a0a0a]/95 backdrop-blur-3xl border border-[var(--hairline-strong)] shadow-[0_16px_48px_rgba(0,0,0,0.8)] z-50 animate-fade-in flex flex-col">
                        {/* Decorative Corner Bracket Top-Left */}
                        <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-[var(--text-secondary)] pointer-events-none z-20"></div>
                        {/* Decorative Corner Bracket Top-Right */}
                        <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-[var(--text-secondary)] pointer-events-none z-20"></div>
                        {/* Decorative Corner Bracket Bottom-Left */}
                        <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-[var(--text-secondary)] pointer-events-none z-20"></div>
                        {/* Decorative Corner Bracket Bottom-Right */}
                        <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-[var(--text-secondary)] pointer-events-none z-20"></div>

                        <div className="p-5 border-b border-[var(--hairline-strong)] bg-gradient-to-b from-white/10 to-transparent relative overflow-hidden">
                            <div className="absolute -top-12 -right-12 w-24 h-24 bg-[var(--vermilion)]/20 blur-2xl pointer-events-none"></div>
                            <div className="relative z-10 flex items-center gap-3">
                                {session.user.image ? (
                                    <Image src={session.user.image} alt="Profile" width={40} height={40} unoptimized className="rounded-full border border-white/20 object-cover w-10 h-10 shrink-0 shadow-lg" />
                                ) : (
                                    <div className="w-10 h-10 rounded-full bg-[var(--hairline-strong)] border border-transparent shrink-0"></div>
                                )}
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm font-bold text-white truncate leading-tight">{session.user.name}</p>
                                    <p className="text-xs text-[var(--text-secondary)] truncate mt-0.5">{session.user.email}</p>
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-col p-2 gap-1 relative z-10">
                            <Link
                                href="/profile"
                                onClick={() => setIsOpen(false)}
                                className="group flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-[var(--text-secondary)] hover:text-white hover:bg-white/10 transition-all text-left"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-70 group-hover:opacity-100 transition-opacity"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                                {t('profile', { defaultMessage: 'Profile Settings' })}
                            </Link>
                            <Link
                                href="/favorites"
                                onClick={() => setIsOpen(false)}
                                className="group flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-[var(--text-secondary)] hover:text-white hover:bg-white/10 transition-all text-left"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-70 group-hover:opacity-100 group-hover:text-[var(--vermilion)] transition-colors"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
                                {tFav('title', { defaultMessage: 'My Favorites' })}
                            </Link>
                            <div className="h-px bg-[var(--hairline-strong)] my-1 mx-1"></div>
                            <button
                                onClick={() => signOut({ callbackUrl: '/' })}
                                className="group flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-red-400 hover:text-red-300 hover:bg-white/10 transition-all text-left"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-70 group-hover:opacity-100 transition-opacity"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
                                {t('logout', { defaultMessage: 'Sign Out' })}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    return (
        <button
            onClick={() => signIn("google")}
            className="px-6 py-2 border border-[var(--hairline-strong)] text-white hover:border-[var(--vermilion)] hover:text-[var(--vermilion)] transition-all font-bold text-xs tracking-[0.3em] uppercase bg-transparent"
        >
            {t('login')}
        </button>
    );
}
