'use client';

import { useSession } from 'next-auth/react';
import { Link } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';

export default function SignupCta() {
    const { data: session } = useSession();
    const t = useTranslations('Home');

    if (session) return null;

    return (
        <div className="flex items-center gap-3 animate-fade-in-up px-6 pb-8" style={{ animationDelay: '200ms' }}>
            <div className="w-8 h-px bg-[var(--hairline)]" />
            <Link
                href="/api/auth/signin/google"
                className="group flex items-center gap-2 text-[10px] tracking-[0.2em] uppercase text-[var(--text-secondary)] hover:text-white transition-colors duration-200"
            >
                <span className="text-[var(--vermilion)] group-hover:scale-110 transition-transform duration-200 inline-block">✦</span>
                {t('cta_signup')}
            </Link>
            <div className="w-8 h-px bg-[var(--hairline)]" />
        </div>
    );
}
