'use client';

import { useSession, signIn } from 'next-auth/react';
import { useTranslations } from 'next-intl';

export default function SignupCta() {
    const { data: session } = useSession();
    const t = useTranslations('Home');

    if (session) return null;

    return (
        <div className="flex items-center gap-3 animate-fade-in-up px-6 pb-8" style={{ animationDelay: '200ms' }}>
            <div className="w-8 h-px bg-[var(--hairline)]" />
            <button
                onClick={() => signIn('google')}
                className="group flex items-center gap-2 text-[11px] tracking-[0.2em] uppercase text-[var(--text-secondary)] hover:text-white transition-colors duration-200 cursor-pointer bg-transparent border-none"
            >
                <span className="text-[var(--vermilion)] group-hover:scale-110 transition-transform duration-200 inline-block">✦</span>
                {t('cta_signup')}
            </button>
            <div className="w-8 h-px bg-[var(--hairline)]" />
        </div>
    );
}
