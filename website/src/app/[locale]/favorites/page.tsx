import { getTranslations } from 'next-intl/server';
import type { Metadata } from 'next';
import FavoritesClient from '@/components/FavoritesClient';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
    const { locale } = await params;
    const t = await getTranslations({ locale, namespace: 'Favorites' });
    return {
        title: t('title'),
        description: t('description'),
        openGraph: { title: t('title'), description: t('description') },
    };
}

export default async function FavoritesPage({ params }: { params: Promise<{ locale: string }> }) {
    await params; // Unpack params to satisfy Next.js 15
    const t = await getTranslations('Favorites');

    return (
        <main className="min-h-screen py-6 md:py-8 px-4 md:px-6 max-w-[var(--max-width)] mx-auto">
            <FavoritesClient />
        </main>
    );
}
