import { getTranslations } from 'next-intl/server';
import LanguageSwitcher from './LanguageSwitcher';
import FooterPageViews from './FooterPageViews';

export default async function Footer() {
    const t = await getTranslations('Footer');

    return (
        <footer className="w-full py-8 mt-auto border-t border-[#333] bg-[var(--bg-card)] text-center text-[var(--text-secondary)]">
            <div className="max-w-[var(--max-width)] mx-auto px-6 flex flex-col items-center gap-4">
                <div className="flex items-center justify-center">
                    <LanguageSwitcher />
                </div>

                {/* Preview notice */}
                <div className="flex items-center gap-2">
                    <span className="text-[var(--gold)]/50 text-[8px]">◈</span>
                    <p className="text-sm opacity-60">{t('footer_dev')}</p>
                    <span className="text-[var(--gold)]/50 text-[8px]">◈</span>
                </div>

                <div>
                    <p className="text-sm mt-2 opacity-60">
                        {t('footer_source')}{' '}
                        {t('footer_contact')}:{' '}
                        <a href="mailto:vocaloid.rankings@gmail.com" className="hover:opacity-100 transition-opacity">
                            vocaloid.rankings@gmail.com
                        </a>
                    </p>

                    <FooterPageViews page="home" label={t('homepage_views')} />
                </div>

                <p>&copy; {new Date().getFullYear()} VocaRank. All rights reserved.</p>
            </div>
        </footer>
    );
}
