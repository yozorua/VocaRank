'use client';

import { useLocale } from 'next-intl';
import { usePathname, useRouter } from '@/i18n/navigation';
import { useTransition, useState, useEffect, useRef } from 'react';

export default function LanguageSwitcher() {
    const locale = useLocale();
    const router = useRouter();
    const pathname = usePathname();
    const [isPending, startTransition] = useTransition();
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const languages = [
        { code: 'en', label: 'English', flag: '🇺🇸' },
        { code: 'zh-TW', label: '繁體中文', flag: '🇹🇼' },
        { code: 'ja', label: '日本語', flag: '🇯🇵' }
    ];

    const currentLang = languages.find(l => l.code === locale) || languages[0];

    const onSelectChange = (nextLocale: string) => {
        setIsOpen(false);
        startTransition(() => {
            router.replace(pathname, { locale: nextLocale });
        });
    };

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                disabled={isPending}
                className={`
                    flex items-center gap-2 px-4 py-2 rounded-full border transition-all duration-300
                    ${isOpen
                        ? 'bg-[var(--miku-teal)]/10 border-[var(--miku-teal)] text-[var(--miku-teal)] shadow-[0_0_15px_rgba(57,197,187,0.3)]'
                        : 'border-white/20 text-gray-300 hover:border-white/50 hover:text-white'
                    }
                `}
            >
                <span className="text-lg">{currentLang.flag}</span>
                <span className="text-sm font-medium">{currentLang.label}</span>
                <svg
                    className={`w-4 h-4 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {/* Dropdown Menu */}
            <div
                className={`
                    absolute top-full right-0 mt-2 w-48 bg-[#1a1a1a] border border-gray-800 rounded-xl shadow-2xl overflow-hidden z-50
                    transition-all duration-200 origin-top-right
                    ${isOpen ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 -translate-y-2 pointer-events-none'}
                `}
            >
                <div className="p-1">
                    {languages.map((lang) => (
                        <button
                            key={lang.code}
                            onClick={() => onSelectChange(lang.code)}
                            className={`
                                w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors
                                ${locale === lang.code
                                    ? 'bg-[var(--miku-teal)]/10 text-[var(--miku-teal)] font-bold'
                                    : 'text-gray-300 hover:bg-white/5 hover:text-white'
                                }
                            `}
                        >
                            <span className="text-lg">{lang.flag}</span>
                            {lang.label}
                            {locale === lang.code && (
                                <span className="ml-auto text-[var(--miku-teal)]">✓</span>
                            )}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}
