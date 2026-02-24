import { getTranslations } from 'next-intl/server';
import ArtistGraphClient from '@/components/ArtistGraphClient';

export default async function GraphPage() {
    const t = await getTranslations('Graph');

    return (
        <main className="min-h-screen py-6 md:py-8 px-4 md:px-6 w-full max-w-5xl mx-auto flex flex-col">
            <div className="mb-6 md:mb-8 pt-2">
                <h1 className="text-2xl md:text-3xl font-bold mb-2">{t('title') || 'Producer Constellation'}</h1>
                <p className="text-[var(--text-secondary)] text-sm md:text-base">
                    {t('description') || 'Explore the network of Vocaloid producers based on their collaborations.'}
                </p>
            </div>

            <div className="flex-1 w-full relative border border-[var(--hairline-strong)] bg-black/50 overflow-hidden min-h-[600px] md:min-h-[800px]">
                <ArtistGraphClient />
            </div>
        </main>
    );
}
