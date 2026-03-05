import { getTranslations } from 'next-intl/server';
import type { Metadata } from 'next';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
    const { locale } = await params;
    const t = await getTranslations({ locale, namespace: 'RankingPage' });
    return {
        title: t('title'),
        description: t('description'),
        openGraph: { title: t('title'), description: t('description') },
    };
}

export default function RankingLayout({ children }: { children: React.ReactNode }) {
    return children;
}
