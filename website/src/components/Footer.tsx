import LanguageSwitcher from './LanguageSwitcher';

export default function Footer() {
    return (
        <footer className="w-full py-8 mt-auto border-t border-[#333] bg-[var(--bg-card)] text-center text-[var(--text-secondary)]">
            <div className="max-w-[var(--max-width)] mx-auto px-6 flex flex-col items-center gap-4">
                <div className="flex items-center justify-center">
                    <LanguageSwitcher />
                </div>

                {/* Preview notice */}
                <div className="flex items-center gap-2">
                    <span className="text-[var(--gold)]/50 text-[8px]">◈</span>
                    <p className="text-sm opacity-60">
                        This site is currently under active development — some features may be incomplete
                    </p>
                    <span className="text-[var(--gold)]/50 text-[8px]">◈</span>
                </div>

                <div>
                    <p className="text-sm mt-2 opacity-60">
                        Song data sourced from <a href="https://vocadb.net" target="_blank" rel="noopener noreferrer" className="hover:opacity-100 transition-opacity">VocaDB</a>. View counts from YouTube &amp; Niconico. Contact: <a href="mailto:vocaloid.rankings@gmail.com" className="hover:opacity-100 transition-opacity">vocaloid.rankings@gmail.com</a>
                    </p>
                </div>

                <p>&copy; {new Date().getFullYear()} VocaRank. All rights reserved.</p>
            </div>
        </footer>
    );
}
