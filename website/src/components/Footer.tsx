import LanguageSwitcher from './LanguageSwitcher';

export default function Footer() {
    return (
        <footer className="w-full py-8 mt-auto border-t border-[#333] bg-[var(--bg-card)] text-center text-[var(--text-secondary)]">
            <div className="max-w-[var(--max-width)] mx-auto px-6 flex flex-col items-center gap-4">
                <div className="flex items-center justify-center">
                    <LanguageSwitcher />
                </div>
                <div>
                    <p>&copy; {new Date().getFullYear()} VocaRank. All rights reserved.</p>
                    <p className="text-sm mt-2 opacity-60">
                        Data provided by YouTube & Niconico. Not affiliated with Crypton Future Media.
                    </p>
                </div>
            </div>
        </footer>
    );
}
