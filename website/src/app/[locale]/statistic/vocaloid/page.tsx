import { getTranslations } from 'next-intl/server';
import type { Metadata } from 'next';
import VocaloidStatsClient from './VocaloidStatsClient';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
    const { locale } = await params;
    const t = await getTranslations({ locale, namespace: 'StatisticVocaloid' });
    return {
        title: t('title'),
        description: t('description'),
        openGraph: { title: t('title'), description: t('description') },
    };
}

export default async function VocaloidStatisticPage() {
    const t = await getTranslations('StatisticVocaloid');

    return (
        <main className="min-h-screen py-6 md:py-8 px-4 md:px-6 w-full max-w-5xl mx-auto flex flex-col gap-8">
            <div className="pt-2">
                <h1 className="text-2xl md:text-3xl font-bold mb-2">{t('title')}</h1>
                <p className="text-[var(--text-secondary)] text-sm md:text-base">
                    {t('description')}
                </p>
            </div>

            <VocaloidStatsClient />

            <footer className="border-t border-[var(--hairline)] pt-4 pb-2">
                <p className="text-xs text-[var(--text-secondary)] opacity-60 text-center leading-relaxed">
                    {t('caption')}
                </p>
            </footer>
        </main>
    );
}
