import { getTranslations } from 'next-intl/server';
import type { Metadata } from 'next';
import ArtistGraphClient from '@/components/ArtistGraphClient';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
    const { locale } = await params;
    const t = await getTranslations({ locale, namespace: 'GraphVocalist' });
    return {
        title: t('title'),
        description: t('description'),
        openGraph: { title: t('title'), description: t('description') },
    };
}

export default async function VocalistGraphPage() {
    const t = await getTranslations('GraphVocalist');

    return (
        <main className="min-h-screen py-6 md:py-8 px-4 md:px-6 w-full max-w-5xl mx-auto flex flex-col">
            <div className="pb-6 mb-6 border-b border-[var(--hairline-strong)]">
                <p className="text-[10px] font-bold tracking-[0.35em] text-[var(--vermilion)] uppercase mb-2">Statistics</p>
                <h1 className="text-2xl md:text-3xl font-black tracking-tight mb-2">{t('title') || 'Network of Vocaloid Voicebanks'}</h1>
                <p className="text-[var(--text-secondary)] text-sm">
                    {t('description') || 'Explore the network of Vocaloid voicebanks based on their collaborations.'}
                </p>
            </div>

            <div className="flex-1 w-full relative border border-[var(--hairline-strong)] bg-black/50 overflow-hidden min-h-[600px] md:min-h-[800px]">
                <ArtistGraphClient apiEndpoint="/artists/graph/vocalists" defaultShowLines={false} />
            </div>

            <footer className="border-t border-[var(--hairline)] pt-4 pb-2 mt-4">
                <p className="text-xs text-[var(--text-secondary)] opacity-60 text-center leading-relaxed">
                    {t('caption')}
                </p>
            </footer>
        </main>
    );
}
