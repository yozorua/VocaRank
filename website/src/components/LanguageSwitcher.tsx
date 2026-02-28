'use client';

import { useLocale } from 'next-intl';
import { usePathname, useRouter } from '@/i18n/navigation';
import { useTransition, useState, useEffect, useRef } from 'react';

const languages = [
    { code: 'en', label: 'EN', full: 'English' },
    { code: 'zh-TW', label: '繁中', full: '繁體中文' },
    { code: 'ja', label: '日本語', full: '日本語' },
];

export default function LanguageSwitcher() {
    const locale = useLocale();
    const router = useRouter();
    const pathname = usePathname();
    const [isPending, startTransition] = useTransition();
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const currentLang = languages.find(l => l.code === locale) || languages[0];

    const onSelect = (nextLocale: string) => {
        setIsOpen(false);
        startTransition(() => {
            router.replace(pathname, { locale: nextLocale });
        });
    };

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className="relative" ref={dropdownRef}>
            {/* Trigger — clean border, no corner brackets */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                disabled={isPending}
                className={`
          flex items-center gap-2 px-5 py-2.5
          border transition-all duration-300
          ${isOpen
                        ? 'border-[var(--vermilion)]/60 text-[var(--vermilion)]'
                        : 'border-[var(--hairline)] text-[var(--text-secondary)] hover:border-[var(--hairline-strong)] hover:text-white'
                    }
          ${isPending ? 'opacity-40' : ''}
        `}
            >
                {/* Globe icon */}
                <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 opacity-70">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="2" y1="12" x2="22" y2="12" />
                    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                </svg>
                <span className="text-xs font-bold tracking-[0.25em] uppercase">{currentLang.label}</span>
                <svg
                    className={`w-4 h-4 transition-transform duration-300 opacity-60 ${isOpen ? 'rotate-180' : ''}`}
                    fill="none" stroke="currentColor" viewBox="0 0 24 24"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {/* Dropdown */}
            <div
                className={`
          absolute top-full right-0 mt-2 w-36
          bg-[var(--bg-dark)] border border-[var(--hairline-strong)]
          shadow-2xl z-50
          transition-all duration-200 origin-top-right
          ${isOpen ? 'opacity-100 scale-100 translate-y-0 pointer-events-auto' : 'opacity-0 scale-95 -translate-y-1 pointer-events-none'}
        `}
            >
                <div className="w-full h-0.5 bg-[var(--vermilion)] opacity-60" />
                <div className="flex flex-col py-1">
                    {languages.map(lang => (
                        <button
                            key={lang.code}
                            onClick={() => onSelect(lang.code)}
                            className={`
                flex items-center justify-between px-4 py-2.5 text-left transition-colors
                ${locale === lang.code
                                    ? 'text-[var(--vermilion)] bg-[var(--vermilion)]/5'
                                    : 'text-[var(--text-secondary)] hover:text-white hover:bg-white/[0.03]'
                                }
              `}
                        >
                            <span className="text-[11px] tracking-[0.2em] uppercase font-medium">{lang.full}</span>
                            {locale === lang.code && (
                                <span className="text-[8px] text-[var(--vermilion)]">◆</span>
                            )}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}
