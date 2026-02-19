import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { getTranslations } from 'next-intl/server';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Metadata' });
  return {
    title: t('title'),
    description: t('description')
  };
}

export default function Home() {
  const t = useTranslations('Home');

  return (
    <div className="relative min-h-[calc(100vh-var(--header-height))] flex flex-col items-center justify-center overflow-hidden">
      {/* Background Effects */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-[radial-gradient(circle,rgba(57,197,187,0.15)_0%,transparent_70%)] blur-[100px] pointer-events-none animate-pulse"></div>

      {/* Grid Pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none"></div>

      <div className="relative z-10 text-center px-6 max-w-5xl mx-auto space-y-12">
        {/* Badge */}
        <div className="inline-block animate-fade-in-up" style={{ animationDelay: '0ms' }}>
          <span className="px-4 py-1.5 rounded-full border border-[var(--miku-teal)] bg-[var(--miku-teal)]/10 text-[var(--miku-teal)] text-sm font-bold tracking-widest uppercase shadow-[0_0_15px_rgba(57,197,187,0.3)]">
            {t('badge')}
          </span>
        </div>

        {/* Main Heading */}
        <h1 className="text-7xl md:text-9xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-white via-gray-200 to-gray-600 animate-fade-in-up" style={{ animationDelay: '100ms' }}>
          VocaRank
        </h1>

        {/* Subtitle */}
        <p className="text-xl md:text-3xl text-[var(--text-secondary)] max-w-3xl mx-auto leading-relaxed font-light animate-fade-in-up" style={{ animationDelay: '200ms' }}>
          {t('subtitle')}
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-6 pt-8 animate-fade-in-up" style={{ animationDelay: '300ms' }}>
          <Link
            href="/ranking"
            className="group relative px-8 py-4 rounded-full bg-[var(--miku-teal)] text-black font-bold text-lg overflow-hidden transition-all hover:scale-105 hover:shadow-[0_0_30px_rgba(57,197,187,0.6)]"
          >
            <span className="relative z-10">{t('cta_ranking')}</span>
            <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
          </Link>
          <Link
            href="/search"
            className="group relative px-8 py-4 rounded-full border border-gray-700 bg-white/5 text-white font-bold text-lg overflow-hidden transition-all hover:scale-105 hover:border-white hover:bg-white/10"
          >
            <span className="relative z-10">{t('cta_search')}</span>
          </Link>
        </div>
      </div>

      {/* Footer decoration */}
      <div className="absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-[var(--miku-pink)] to-transparent opacity-50"></div>
    </div>
  );
}
