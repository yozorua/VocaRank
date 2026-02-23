'use client';

import { signIn, signOut, useSession } from "next-auth/react";
import Image from "next/image";
import Link from "next/link";
import { useTranslations } from "next-intl";

export default function AuthButton() {
    const { data: session, status } = useSession();
    const t = useTranslations('Navbar');

    if (status === "loading") {
        return <div className="animate-pulse w-8 h-8 rounded-full bg-[var(--hairline-strong)]"></div>;
    }

    if (session && session.user) {
        return (
            <div className="flex items-center gap-4">
                {session.user.image && (
                    <Link href="/profile">
                        <Image
                            src={session.user.image}
                            alt="Profile Picture"
                            width={32}
                            height={32}
                            className="rounded-full border border-[var(--hairline)] hover:border-white transition-colors cursor-pointer"
                        />
                    </Link>
                )}
                <button
                    onClick={() => signOut({ callbackUrl: '/' })}
                    className="px-4 py-2 text-xs tracking-[0.2em] uppercase text-[var(--text-secondary)] hover:text-white transition-colors"
                >
                    {t('logout', { defaultMessage: 'Sign Out' })}
                </button>
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
