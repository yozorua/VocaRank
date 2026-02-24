import { getTranslations } from 'next-intl/server';
import FavoritesClient from '@/components/FavoritesClient';

export default async function FavoritesPage({ params }: { params: Promise<{ locale: string }> }) {
    await params; // Unpack params to satisfy Next.js 15
    const t = await getTranslations('Favorites');

    return (
        <main className="min-h-screen py-6 md:py-8 px-4 md:px-6 max-w-[var(--max-width)] mx-auto">
            <FavoritesClient />
        </main>
    );
}
