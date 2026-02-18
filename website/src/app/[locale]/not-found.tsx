import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';

export default function NotFound() {
    const t = useTranslations('NotFound');

    return (
        <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4">
            <h1 className="text-9xl font-black text-transparent bg-clip-text bg-gradient-to-r from-[var(--miku-teal)] to-[var(--miku-pink)] animate-pulse mb-8">
                404
            </h1>
            <h2 className="text-2xl md:text-3xl font-bold mb-6 text-white">
                {t('title')}
            </h2>
            <p className="text-[var(--text-secondary)] max-w-md mb-8">
                {t('description')}
            </p>
            <Link
                href="/"
                className="px-8 py-3 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 transition-all text-white font-medium"
            >
                {t('back_home')}
            </Link>
        </div>
    );
}
