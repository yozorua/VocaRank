'use client';

import { Link } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

export default function Navbar() {
    const t = useTranslations('Navbar');
    const [isOpen, setIsOpen] = useState(false);

    return (
        <nav className="fixed top-0 w-full h-[var(--header-height)] glass-panel z-50 border-b-0 neon-border-bottom">
            <div className="w-full h-full max-w-[var(--max-width)] mx-auto px-6 flex items-center justify-between">
                {/* Logo */}
                <Link href="/" className="text-3xl font-bold tracking-tighter group flex items-center gap-2 z-50 relative" onClick={() => setIsOpen(false)}>
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[var(--miku-teal)] to-[var(--miku-pink)] flex items-center justify-center text-black font-black text-sm">V</div>
                    <span className="text-white group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-[var(--miku-teal)] group-hover:to-[var(--miku-pink)] transition-all duration-300">
                        VocaRank
                    </span>
                </Link>

                {/* Mobile Menu Button */}
                <button
                    className="md:hidden z-50 text-white p-2"
                    onClick={() => setIsOpen(!isOpen)}
                    aria-label="Toggle menu"
                >
                    {isOpen ? (
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                    ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="18" x2="21" y2="18" /></svg>
                    )}
                </button>

                {/* Desktop Links */}
                <div className="hidden md:flex items-center gap-8">
                    <Link href="/ranking" className="relative font-medium text-gray-300 hover:text-white transition-colors py-2 group">
                        {t('ranking')}
                        <span className="absolute bottom-0 left-0 w-0 h-[2px] bg-[var(--miku-teal)] transition-all duration-300 group-hover:w-full"></span>
                    </Link>

                    {/* Search Icon */}
                    <Link href="/search" className="p-2 rounded-full hover:bg-white/10 transition-all text-gray-300 hover:text-white group" aria-label={t('search')}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="11" cy="11" r="8"></circle>
                            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                        </svg>
                    </Link>

                    <Link href="/login" className="px-5 py-2 rounded-full border border-[var(--miku-pink)] text-[var(--miku-pink)] hover:bg-[var(--miku-pink)] hover:text-white transition-all font-medium text-sm">
                        {t('login')}
                    </Link>
                </div>

                {/* Mobile Menu Overlay */}
                {isOpen && (
                    <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-40 flex flex-col items-center justify-center gap-8 md:hidden animate-in fade-in zoom-in duration-200">
                        <Link href="/ranking" className="text-2xl font-bold text-white hover:text-[var(--miku-teal)]" onClick={() => setIsOpen(false)}>
                            {t('ranking')}
                        </Link>
                        <Link href="/search" className="text-2xl font-bold text-white hover:text-[var(--miku-teal)]" onClick={() => setIsOpen(false)}>
                            {t('search')}
                        </Link>
                        <Link href="/login" className="text-2xl font-bold text-[var(--miku-pink)] hover:text-white" onClick={() => setIsOpen(false)}>
                            {t('login')}
                        </Link>
                    </div>
                )}
            </div>
        </nav>
    );
}
