import { getTranslations } from 'next-intl/server';
import type { Metadata } from 'next';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
    const { locale } = await params;
    const t = await getTranslations({ locale, namespace: 'TrendingPage' });
    return {
        title: t('meta_title'),
        description: t('meta_description'),
        openGraph: { title: t('meta_title'), description: t('meta_description') },
    };
}

export default function TrendingLayout({ children }: { children: React.ReactNode }) {
    return children;
}
