import { getTranslations } from 'next-intl/server';

interface PageProps {
    params: Promise<{ locale: string }>;
}

export default async function ProfilePage({ params }: PageProps) {
    const { locale } = await params;
    const t = await getTranslations({ locale, namespace: 'ProfilePage' });

    return (
        <div className="max-w-[var(--max-width)] mx-auto px-6 py-12">
            <h1 className="text-3xl font-bold mb-8">{t('title')}</h1>
            <div className="bg-[var(--bg-card)] p-8 rounded-xl border border-gray-800">
                <p className="text-[var(--text-secondary)]">{t('loading')}</p>
            </div>
        </div>
    );
}
