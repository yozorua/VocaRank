import { getTranslations } from 'next-intl/server';
import LanguageSwitcher from './LanguageSwitcher';
import FooterPageViews from './FooterPageViews';

export default async function Footer() {
    const t = await getTranslations('Footer');

    return (
        <footer className="w-full mt-auto border-t border-[var(--hairline)]">
            <div className="max-w-[var(--max-width)] mx-auto px-6 py-10 flex flex-col items-center gap-6 text-center">

                <LanguageSwitcher />

                {/* Decorative divider */}
                <div className="flex items-center gap-4 w-full max-w-xs">
                    <div className="flex-1 h-px bg-[var(--hairline)]" />
                    <span className="text-[var(--gold)]/30 text-[10px]">◈</span>
                    <div className="flex-1 h-px bg-[var(--hairline)]" />
                </div>

                {/* Dev notice */}
                <p className="text-xs text-[var(--text-secondary)] opacity-50 max-w-md md:max-w-xl">{t('footer_dev')}</p>

                {/* Source + contact */}
                <div className="flex flex-col gap-1.5 text-xs text-[var(--text-secondary)] opacity-60">
                    <p>
                        {t.rich('footer_source', {
                            vocadb: (chunks) => (
                                <a
                                    href="https://vocadb.net"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="hover:opacity-100 transition-opacity"
                                >
                                    {chunks}
                                </a>
                            ),
                        })}
                    </p>
                    <p>
                        {t('footer_contact')}:{' '}
                        <a href="mailto:vocaloid.rankings@gmail.com" className="hover:opacity-100 transition-opacity">
                            vocaloid.rankings@gmail.com
                        </a>
                    </p>
                </div>

                {/* Page views — sits just above copyright */}
                <FooterPageViews page="home" label={t('homepage_views')} />

                <p className="text-xs text-[var(--text-secondary)] opacity-40">
                    &copy; {new Date().getFullYear()} VocaRank. All rights reserved.
                </p>
            </div>
        </footer>
    );
}
