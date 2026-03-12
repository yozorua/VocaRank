'use client';

import { Link, useRouter } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import AuthButton from './AuthButton';

export default function Navbar() {
    const t = useTranslations('Navbar');
    const router = useRouter();
    const [isOpen, setIsOpen] = useState(false);
    const [isStatsOpen, setIsStatsOpen] = useState(false); // Used for mobile dropdown
    const [mounted, setMounted] = useState(false);
    const [navSearch, setNavSearch] = useState('');
    const [navSearchOpen, setNavSearchOpen] = useState(false);
    const [navSearchFocused, setNavSearchFocused] = useState(false);

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

            <Link href="/ranking" className="text-xl font-medium tracking-[0.2em] text-white hover:text-[var(--vermilion)] transition-colors" onClick={() => setIsOpen(false)}>
                {t('ranking')}
            </Link>
            <Link href="/trending" className="text-xl font-medium tracking-[0.2em] text-white hover:text-[var(--vermilion)] transition-colors" onClick={() => setIsOpen(false)}>
                {t('trending')}
            </Link>
            <Link href="/playlist" className="text-xl font-medium tracking-[0.2em] text-white hover:text-[var(--vermilion)] transition-colors" onClick={() => setIsOpen(false)}>
                {t('playlist', { defaultMessage: 'Playlist' })}
            </Link>
            <Link href="/search" className="text-xl font-medium tracking-[0.2em] text-white hover:text-[var(--vermilion)] transition-colors" onClick={() => setIsOpen(false)}>
                {t('search', { defaultMessage: 'Search' })}
            </Link>
            <Link href="/about" className="text-xl font-medium tracking-[0.2em] text-white hover:text-[var(--vermilion)] transition-colors" onClick={() => setIsOpen(false)}>
                {t('about', { defaultMessage: 'About' })}
            </Link>
            <div className="flex flex-col items-center gap-10 w-full mt-2">
                <button
                    onClick={() => setIsStatsOpen(!isStatsOpen)}
                    className="text-xl font-medium tracking-[0.2em] text-white hover:text-[var(--vermilion)] transition-colors relative flex items-center justify-center"
                >
                    {t('statistics', { defaultMessage: 'Statistics' })}
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`absolute -right-8 transition-transform duration-300 ${isStatsOpen ? 'rotate-180' : ''}`}>
                        <polyline points="6 9 12 15 18 9"></polyline>
                    </svg>
                </button>

                {/* Expandable Folder */}
                <div className={`flex flex-col items-center gap-6 overflow-hidden transition-all duration-300 ${isStatsOpen ? 'max-h-40 opacity-100 mt-2 mb-2' : 'max-h-0 opacity-0'}`}>
                    <Link href="/statistic/producer-network" className="text-lg font-medium tracking-[0.2em] text-[var(--text-secondary)] hover:text-white transition-colors" onClick={() => setIsOpen(false)}>
                        {t('statistics_producer_network', { defaultMessage: 'Producers Network' })}
                    </Link>
                    <Link href="/statistic/vocalist-network" className="text-lg font-medium tracking-[0.2em] text-[var(--text-secondary)] hover:text-white transition-colors" onClick={() => setIsOpen(false)}>
                        {t('statistics_vocalist_network', { defaultMessage: 'Voicebank Network' })}
                    </Link>
                    <Link href="/statistic/vocaloid" className="text-lg font-medium tracking-[0.2em] text-[var(--text-secondary)] hover:text-white transition-colors" onClick={() => setIsOpen(false)}>
                        {t('statistics_vocaloid', { defaultMessage: 'Stats for Vocaloid' })}
                    </Link>
                </div>
            </div>
            <div onClick={() => setIsOpen(false)}>
                <AuthButton mobile={true} />
            </div>
        </div>
    ) : null;

    return (
        <>
            <nav className="fixed top-0 w-full h-[var(--header-height)] z-50 border-b border-[var(--hairline)] bg-[var(--bg-dark)]/95 backdrop-blur-md shadow-[0_2px_24px_rgba(0,0,0,0.45)] transition-colors">
                <div className="w-full h-full max-w-[var(--max-width)] mx-auto px-6 md:px-12 flex items-center justify-between relative">

                    {/* Decorative Diamond Ends on Border line */}
                    <div className="absolute bottom-[-4px] left-0 w-full flex justify-between px-2 text-[var(--hairline-strong)] text-[8px] pointer-events-none">
                        <span>◇</span>
                        <span>◇</span>
                    </div>

                    {/* Logo */}
                    <Link href="/" className="group flex items-center gap-3 z-50 transition-opacity hover:opacity-80" onClick={() => setIsOpen(false)}>
                        <span className="text-white tracking-[0.3em] font-black uppercase text-sm mt-1 [text-shadow:0_1px_4px_rgba(0,0,0,0.7)]">
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
                        <Link href="/ranking" className="relative font-bold text-[var(--text-secondary)] hover:text-white transition-colors py-2 text-sm tracking-[0.1em] group [text-shadow:0_1px_4px_rgba(0,0,0,0.7)]">
                            {t('ranking', { defaultMessage: 'Ranking' })}
                            <span className="absolute bottom-0 left-0 w-full h-[2px] bg-[var(--vermilion)] scale-x-0 origin-left transition-transform duration-300 group-hover:scale-x-100"></span>
                        </Link>
                        <Link href="/trending" className="relative font-bold text-[var(--text-secondary)] hover:text-white transition-colors py-2 text-sm tracking-[0.1em] group [text-shadow:0_1px_4px_rgba(0,0,0,0.7)]">
                            {t('trending', { defaultMessage: 'New Wave' })}
                            <span className="absolute bottom-0 left-0 w-full h-[2px] bg-[var(--vermilion)] scale-x-0 origin-left transition-transform duration-300 group-hover:scale-x-100"></span>
                        </Link>
                        <Link href="/playlist" className="relative font-bold text-[var(--text-secondary)] hover:text-white transition-colors py-2 text-sm tracking-[0.1em] group [text-shadow:0_1px_4px_rgba(0,0,0,0.7)]">
                            {t('playlist', { defaultMessage: 'Playlist' })}
                            <span className="absolute bottom-0 left-0 w-full h-[2px] bg-[var(--vermilion)] scale-x-0 origin-left transition-transform duration-300 group-hover:scale-x-100"></span>
                        </Link>
                        <div className="relative group py-2">
                            <span className="cursor-pointer font-bold text-[var(--text-secondary)] hover:text-white transition-colors text-sm tracking-[0.1em] flex items-center gap-1 group-hover:text-white [text-shadow:0_1px_4px_rgba(0,0,0,0.7)]">
                                {t('statistics', { defaultMessage: 'Statistics' })}
                                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="transition-transform group-hover:rotate-180">
                                    <polyline points="6 9 12 15 18 9"></polyline>
                                </svg>
                                <span className="absolute bottom-0 left-0 w-full h-[2px] bg-[var(--vermilion)] scale-x-0 origin-left transition-transform duration-300 group-hover:scale-x-100"></span>
                            </span>

                            {/* Dropdown Menu */}
                            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-0 w-max bg-[var(--bg-dark)] border border-[var(--hairline-strong)] shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 transform translate-y-2 group-hover:translate-y-0 z-[200] overflow-hidden">
                                {/* Vermilion accent top line — mirrors the nav link underline effect */}
                                <div className="h-px bg-[var(--vermilion)]" />
                                <div className="py-1 relative z-10 bg-[var(--bg-dark)]">
                                    <Link href="/statistic/producer-network" className="flex items-center justify-center w-full px-6 py-2.5 text-sm text-[var(--text-secondary)] hover:text-white hover:bg-white/5 transition-colors font-bold whitespace-nowrap tracking-[0.05em]">
                                        {t('statistics_producer_network', { defaultMessage: 'Producers Network' })}
                                    </Link>
                                    <Link href="/statistic/vocalist-network" className="flex items-center justify-center w-full px-6 py-2.5 text-sm text-[var(--text-secondary)] hover:text-white hover:bg-white/5 transition-colors font-bold border-t border-[var(--hairline)] whitespace-nowrap tracking-[0.05em]">
                                        {t('statistics_vocalist_network', { defaultMessage: 'Voicebank Network' })}
                                    </Link>
                                    <Link href="/statistic/vocaloid" className="flex items-center justify-center w-full px-6 py-2.5 text-sm text-[var(--text-secondary)] hover:text-white hover:bg-white/5 transition-colors font-bold border-t border-[var(--hairline)] whitespace-nowrap tracking-[0.05em]">
                                        {t('statistics_vocaloid', { defaultMessage: 'Stats for Vocaloid' })}
                                    </Link>
                                </div>
                            </div>
                        </div>

                        <Link href="/about" className="relative font-bold text-[var(--text-secondary)] hover:text-white transition-colors py-2 text-sm tracking-[0.1em] group [text-shadow:0_1px_4px_rgba(0,0,0,0.7)]">
                            {t('about', { defaultMessage: 'About' })}
                            <span className="absolute bottom-0 left-0 w-full h-[2px] bg-[var(--vermilion)] scale-x-0 origin-left transition-transform duration-300 group-hover:scale-x-100"></span>
                        </Link>

                        {/* Search Icon with animated expand on hover */}
                        <div
                            className="flex items-center"
                            onMouseEnter={() => setNavSearchOpen(true)}
                            onMouseLeave={() => { if (!navSearchFocused && !navSearch.trim()) setNavSearchOpen(false); }}
                        >
                            <form
                                onSubmit={(e) => {
                                    e.preventDefault();
                                    const q = navSearch.trim();
                                    setNavSearchOpen(false);
                                    setNavSearchFocused(false);
                                    setNavSearch('');
                                    if (q) {
                                        router.push(`/search?q=${encodeURIComponent(q)}`);
                                    } else {
                                        router.push('/search');
                                    }
                                }}
                                className="flex items-center"
                            >
                                <div className={`overflow-hidden transition-all duration-300 ${navSearchOpen ? 'w-36 opacity-100' : 'w-0 opacity-0'}`}>
                                    <input
                                        type="text"
                                        value={navSearch}
                                        onChange={e => setNavSearch(e.target.value)}
                                        placeholder={t('search', { defaultMessage: 'Search...' })}
                                        onFocus={() => setNavSearchFocused(true)}
                                        onBlur={() => { setNavSearchFocused(false); if (!navSearch.trim()) setNavSearchOpen(false); }}
                                        className="w-full bg-transparent border-b border-white/30 text-white text-sm px-2 py-1 focus:outline-none focus:border-white placeholder:text-white/40 transition-colors"
                                    />
                                </div>
                                <button
                                    type="submit"
                                    aria-label={t('search')}
                                    className="p-2 transition-colors text-[var(--text-secondary)] hover:text-white"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <circle cx="11" cy="11" r="8"></circle>
                                        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                                    </svg>
                                </button>
                            </form>
                        </div>

                        <AuthButton />
                    </div>

                </div>
            </nav>

            {/* Mobile overlay — portaled to document.body to escape nav stacking context */}
            {mounted && createPortal(overlay, document.body)}
        </>
    );
}
