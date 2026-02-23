'use client';

import { signIn, signOut, useSession } from "next-auth/react";
import Image from "next/image";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState, useRef, useEffect } from "react";

export default function AuthButton() {
    const { data: session, status } = useSession();
    const t = useTranslations('Navbar');
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
                    <div className="absolute right-0 mt-3 w-56 bg-black/95 backdrop-blur-xl border border-[var(--hairline-strong)] shadow-2xl z-50 animate-fade-in flex flex-col">
                        <div className="p-4 border-b border-[var(--hairline-strong)] bg-black/40">
                            <p className="text-sm font-bold text-white truncate">{session.user.name}</p>
                            <p className="text-xs text-[var(--text-secondary)] truncate">{session.user.email}</p>
                        </div>

                        <div className="flex flex-col py-2">
                            <Link
                                href="/profile"
                                onClick={() => setIsOpen(false)}
                                className="px-4 py-2 text-sm text-[var(--text-secondary)] hover:text-white hover:bg-[var(--surface)] transition-colors text-left"
                            >
                                {t('profile', { defaultMessage: 'Profile Settings' })}
                            </Link>
                            <button
                                onClick={() => signOut({ callbackUrl: '/' })}
                                className="px-4 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-[var(--surface)] transition-colors text-left border-t border-[var(--hairline-strong)] mt-2 pt-2"
                            >
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
