'use client';

import { Link } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import AuthButton from './AuthButton';

export default function Navbar() {
    const t = useTranslations('Navbar');
    const [isOpen, setIsOpen] = useState(false);
    const [mounted, setMounted] = useState(false);

    // Required for createPortal to work in SSR (Next.js)
    useEffect(() => { setMounted(true); }, []);

    // Prevent body scroll when menu is open
    useEffect(() => {
        document.body.style.overflow = isOpen ? 'hidden' : '';
        return () => { document.body.style.overflow = ''; };
    }, [isOpen]);

    const overlay = isOpen ? (
        <div
            className="fixed inset-0 bg-[var(--bg-dark)] backdrop-blur-xl z-[200] flex flex-col items-center justify-center gap-10 md:hidden"
            style={{ animation: 'fadeIn 0.15s ease' }}
        >
            <style>{`@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }`}</style>

            {/* Close button — top right */}
            <button
                className="absolute top-5 right-5 z-[220] w-10 h-10 flex items-center justify-center text-[var(--text-secondary)] hover:text-white transition-colors"
                onClick={() => setIsOpen(false)}
                aria-label="Close menu"
            >
                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
            </button>

            <Link href="/ranking" className="text-xl font-medium tracking-[0.4em] text-white hover:text-[var(--vermilion)] transition-colors uppercase" onClick={() => setIsOpen(false)}>
                {t('ranking')}
            </Link>
            <Link href="/search" className="text-xl font-medium tracking-[0.4em] text-white hover:text-[var(--vermilion)] transition-colors uppercase" onClick={() => setIsOpen(false)}>
                {t('search', { defaultMessage: 'Search' })}
            </Link>
            <div className="flex flex-col items-center gap-4 w-full">
                <span className="text-lg font-medium tracking-[0.4em] text-[var(--text-secondary)] uppercase">
                    {t('statistics', { defaultMessage: 'Statistics' })}
                </span>
                <Link href="/statistic/producer-network" className="text-md font-medium tracking-[0.2em] text-white hover:text-[var(--vermilion)] transition-colors uppercase pl-4 border-l-2 border-[var(--border-color)]" onClick={() => setIsOpen(false)}>
                    {t('statistics_producer_network', { defaultMessage: 'Producers Network' })}
                </Link>
            </div>
            <div onClick={() => setIsOpen(false)}>
                <AuthButton mobile={true} />
            </div>
        </div>
    ) : null;

    return (
        <>
            <nav className="fixed top-0 w-full h-[var(--header-height)] z-50 border-b border-[var(--hairline)] bg-[var(--bg-dark)]/95 backdrop-blur-sm transition-colors">
                <div className="w-full h-full max-w-[var(--max-width)] mx-auto px-6 md:px-12 flex items-center justify-between relative">

                    {/* Decorative Diamond Ends on Border line */}
                    <div className="absolute bottom-[-4px] left-0 w-full flex justify-between px-2 text-[var(--hairline-strong)] text-[8px] pointer-events-none">
                        <span>◇</span>
                        <span>◇</span>
                    </div>

                    {/* Logo */}
                    <Link href="/" className="group flex items-center gap-3 z-50 transition-opacity hover:opacity-80" onClick={() => setIsOpen(false)}>
                        <div className="w-8 h-8 flex items-center justify-center bg-[var(--vermilion)] text-white font-serif text-lg leading-none pt-1">
                            V
                        </div>
                        <span className="text-white tracking-[0.3em] font-black uppercase text-sm mt-1">
                            VocaRank
                        </span>
                    </Link>

                    {/* Mobile Menu Button — z-[210] so it stays above the overlay */}
                    <button
                        className="md:hidden z-[210] text-white p-2 relative w-10 h-10 flex flex-col items-center justify-center gap-[6px]"
                        onClick={() => setIsOpen(!isOpen)}
                        aria-label="Toggle menu"
                    >
                        <span className={`block w-6 h-[2px] bg-white rounded-full transition-all duration-300 ease-in-out ${isOpen ? 'rotate-45 translate-y-[8px]' : ''}`}></span>
                        <span className={`block w-6 h-[2px] bg-white rounded-full transition-all duration-300 ease-in-out ${isOpen ? 'opacity-0 translate-x-3' : ''}`}></span>
                        <span className={`block w-6 h-[2px] bg-white rounded-full transition-all duration-300 ease-in-out ${isOpen ? '-rotate-45 -translate-y-[8px]' : ''}`}></span>
                    </button>

                    {/* Desktop Links */}
                    <div className="hidden md:flex items-center gap-10">
                        <Link href="/ranking" className="relative font-bold text-[var(--text-secondary)] hover:text-white transition-colors py-2 text-xs tracking-[0.3em] uppercase group">
                            {t('ranking', { defaultMessage: 'Ranking' })}
                            <span className="absolute bottom-0 left-0 w-full h-[2px] bg-[var(--vermilion)] scale-x-0 origin-left transition-transform duration-300 group-hover:scale-x-100"></span>
                        </Link>
                        <div className="relative group py-2">
                            <span className="cursor-pointer font-bold text-[var(--text-secondary)] hover:text-white transition-colors text-xs tracking-[0.3em] uppercase flex items-center gap-1 group-hover:text-white">
                                {t('statistics', { defaultMessage: 'Statistics' })}
                                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="transition-transform group-hover:rotate-180">
                                    <polyline points="6 9 12 15 18 9"></polyline>
                                </svg>
                                <span className="absolute bottom-0 left-0 w-full h-[2px] bg-[var(--vermilion)] scale-x-0 origin-left transition-transform duration-300 group-hover:scale-x-100"></span>
                            </span>

                            {/* Dropdown Menu */}
                            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-0 w-48 bg-[var(--bg-dark)] border border-[var(--hairline-strong)] shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 transform translate-y-2 group-hover:translate-y-0 z-[200]">
                                <div className="p-2 relative z-10 bg-[var(--bg-dark)]">
                                    <Link href="/statistic/producer-network" className="block w-full px-4 py-3 text-sm text-[var(--text-secondary)] hover:text-white hover:bg-white/5 transition-colors text-center font-bold">
                                        {t('statistics_producer_network', { defaultMessage: 'Producers Network' })}
                                    </Link>
                                </div>
                            </div>
                        </div>

                        {/* Search Icon */}
                        <Link href="/search" className="p-2 transition-all text-[var(--text-secondary)] hover:text-[var(--vermilion)] group" aria-label={t('search')}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="11" cy="11" r="8"></circle>
                                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                            </svg>
                        </Link>

                        <AuthButton />
                    </div>

                </div>
            </nav>

            {/* Mobile overlay — portaled to document.body to escape nav stacking context */}
            {mounted && createPortal(overlay, document.body)}
        </>
    );
}
