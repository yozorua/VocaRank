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
    <div className="relative min-h-[calc(100vh-var(--header-height))] flex flex-col items-center justify-center overflow-hidden bg-transparent">

      {/* Decorative Traditional Japanese Vertical Text (Left & Right) */}
      <div className="absolute left-6 md:left-12 top-1/4 hidden lg:block vertical-text text-[var(--vermilion)] text-xs md:text-sm tracking-[0.4em] opacity-80 z-0 select-none">
        ボカロ楽曲ランキングプラットフォーム
      </div>
      <div className="absolute right-6 md:right-12 bottom-1/3 hidden lg:block vertical-text text-[var(--text-secondary)] text-xs md:text-sm tracking-[0.4em] opacity-40 z-0 select-none">
        美しき音の調べ、此処に集う
      </div>

      <div className="relative z-10 text-center px-6 max-w-5xl mx-auto space-y-16">

        {/* Badge - Minimalist Hairline with Vermilion */}
        <div className="inline-flex items-center gap-6 animate-fade-in-up" style={{ animationDelay: '0ms' }}>
          <div className="w-12 md:w-20 h-px bg-[var(--vermilion)] opacity-70"></div>
          <span className="text-[var(--vermilion)] text-xs md:text-sm font-bold tracking-[0.3em] uppercase">
            {t('badge')}
          </span>
          <div className="w-12 md:w-20 h-px bg-[var(--vermilion)] opacity-70"></div>
        </div>

        {/* Main Heading - Stark Serif/Sans Mix with insane letter spacing */}
        <h1 className="text-6xl md:text-8xl lg:text-9xl font-black tracking-[0.15em] text-white animate-fade-in-up" style={{ animationDelay: '100ms' }}>
          VocaRank
        </h1>

        {/* Subtitle - Elegant Japanese Font Spacing inside traditional brackets */}
        <p className="text-lg md:text-2xl text-[var(--text-secondary)] max-w-2xl mx-auto leading-loose font-light tracking-[0.05em] animate-fade-in-up" style={{ animationDelay: '200ms' }}>
          <span className="font-serif text-[var(--hairline-strong)] mr-2">『</span>
          {t('subtitle')}
          <span className="font-serif text-[var(--hairline-strong)] ml-2">』</span>
        </p>

        {/* CTA Buttons - Neo Traditional minimalist brackets/boxes */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-10 pt-16 animate-fade-in-up" style={{ animationDelay: '300ms' }}>

          {/* Primary CTA: Stark Box with corner brackets and diamond */}
          <Link
            href="/ranking"
            className="group relative px-12 py-5 text-white font-medium text-sm md:text-base tracking-[0.3em] uppercase transition-all hover:text-[var(--vermilion)]"
          >
            <div className="absolute inset-0 border border-[var(--hairline-strong)] group-hover:border-[var(--vermilion)] transition-colors duration-500"></div>
            {/* Corner accents */}
            <div className="absolute -top-[1px] -left-[1px] w-3 h-3 border-t border-l border-white group-hover:border-[var(--vermilion)] transition-colors duration-500"></div>
            <div className="absolute -bottom-[1px] -right-[1px] w-3 h-3 border-b border-r border-white group-hover:border-[var(--vermilion)] transition-colors duration-500"></div>

            <span className="relative z-10 font-serif mr-3 text-[10px]">◇</span>
            <span className="relative z-10">{t('cta_ranking')}</span>
          </Link>

          {/* Secondary CTA: Traditional Chevron Brackets */}
          <Link
            href="/search"
            className="group relative px-6 py-4 text-[var(--text-secondary)] font-light text-sm md:text-base tracking-[0.3em] uppercase transition-all hover:text-white"
          >
            <span className="relative z-10 opacity-50 group-hover:opacity-100 group-hover:text-[var(--vermilion)] transition-colors mr-3 font-serif">〈</span>
            <span className="relative z-10">{t('cta_search')}</span>
            <span className="relative z-10 opacity-50 group-hover:opacity-100 group-hover:text-[var(--vermilion)] transition-colors ml-3 font-serif">〉</span>
          </Link>

        </div>
      </div>
    </div>
  );
}
