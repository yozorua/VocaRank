import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import StatNumber from '@/components/StatNumber';
import SignupCta from '@/components/SignupCta';
import ThumbnailImage from '@/components/ThumbnailImage';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Metadata' });
  return { title: t('title'), description: t('description') };
}

// ─── Data helpers ──────────────────────────────────────────────────────────────
async function getSiteStats() {
  try {
    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    const res = await fetch(`${apiBase}/statistics/site-stats`, { next: { revalidate: 3600 } });
    if (res.ok) return await res.json();
  } catch { }
  return null;
}

// Podium: top 10 by TOTAL view gain
async function getDailyTopTotal(limit = 10) {
  try {
    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    const res = await fetch(
      `${apiBase}/rankings/daily?limit=${limit}&vocaloid_only=true&sort_by=increment_total`,
      { next: { revalidate: 3600 } }
    );
    if (res.ok) return await res.json();
  } catch { }
  return [];
}

// Today's Top Picks: niconico daily
async function getDailyTopNico(limit = 5) {
  try {
    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    const res = await fetch(
      `${apiBase}/rankings/daily?limit=${limit}&vocaloid_only=true&sort_by=increment_niconico`,
      { next: { revalidate: 3600 } }
    );
    if (res.ok) return await res.json();
  } catch { }
  return [];
}

function formatViews(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

// ─── Types ─────────────────────────────────────────────────────────────────────
type SongRow = {
  id: number;
  name_japanese: string | null;
  name_english: string | null;
  name_romaji: string | null;
  artist_string: string;
  increment_total: number;
  increment_niconico?: number;
  niconico_thumb_url?: string | null;
  youtube_id?: string | null;
  artists?: { name: string; artist_type?: string }[] | null;
};

// ─── Medal colors ──────────────────────────────────────────────────────────────
const MEDAL: Record<number, string> = {
  1: '#D4AF37',  // gold
  2: '#A8A9AD',  // silver
  3: '#CD7F32',  // bronze
};
function rankColor(rank: number): string {
  return MEDAL[rank] ?? 'rgba(255,255,255,0.35)';
}

// ─── Section Divider ───────────────────────────────────────────────────────────
function SectionDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-5 justify-center">
      <div className="flex-1 max-w-[80px] h-px bg-[var(--hairline)]" />
      <span className="text-[var(--hairline-strong)] text-[9px]">◇</span>
      <span className="text-[var(--text-secondary)] text-sm tracking-[0.4em] uppercase font-semibold">{label}</span>
      <span className="text-[var(--hairline-strong)] text-[9px]">◇</span>
      <div className="flex-1 max-w-[80px] h-px bg-[var(--hairline)]" />
    </div>
  );
}

// ─── Feature Cards ─────────────────────────────────────────────────────────────
type Card = { href: string; titleKey: string; descKey: string; icon: React.ReactNode; preview: React.ReactNode };
const PREVIEW_H = 'h-[80px]';

const cards: Card[] = [
  {
    href: '/ranking', titleKey: 'feature_ranking_title', descKey: 'feature_ranking_desc',
    icon: <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></svg>,
    preview: (
      <div className="flex flex-col justify-center gap-1.5 w-full h-full">
        {[{ r: 1, t: '砂の惑星', g: '+12.4K', w: '100%' }, { r: 2, t: 'ロキ', g: '+9.2K', w: '74%' }, { r: 3, t: 'ECHO', g: '+6.8K', w: '55%' }].map(row => (
          <div key={row.r} className="flex items-center gap-2 text-[10px]">
            <span className="font-black w-3 shrink-0" style={{ color: rankColor(row.r) }}>{row.r}</span>
            <div className="flex-1 h-1.5 rounded-full bg-white/5 overflow-hidden"><div className="h-full bg-[var(--vermilion)]/50 rounded-full" style={{ width: row.w }} /></div>
            <span className="text-[var(--text-secondary)] w-14 text-right truncate">{row.t}</span>
            <span className="text-[var(--gold)] w-10 text-right">{row.g}</span>
          </div>
        ))}
      </div>
    ),
  },
  {
    href: '/search', titleKey: 'feature_search_title', descKey: 'feature_search_desc',
    icon: <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>,
    preview: (
      <div className="flex flex-col justify-center gap-1.5 w-full h-full">
        <div className="w-full h-5 border border-[var(--hairline)] flex items-center px-2 gap-1.5 shrink-0">
          <svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[var(--text-secondary)] shrink-0"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
          <span className="text-[8px] text-[var(--text-secondary)] opacity-50">初音ミク...</span>
        </div>
        {['Hatsune Miku', 'GUMI · Megpoid'].map(n => (<div key={n} className="flex items-center gap-1.5 text-[9px] text-[var(--text-secondary)]"><div className="w-3.5 h-3.5 rounded-full bg-[var(--vermilion)]/30 shrink-0" />{n}</div>))}
      </div>
    ),
  },
  {
    href: '/statistic/vocaloid', titleKey: 'feature_statistics_title', descKey: 'feature_statistics_desc',
    icon: <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21.21 15.89A10 10 0 1 1 8 2.83" /><path d="M22 12A10 10 0 0 0 12 2v10z" /></svg>,
    preview: (
      <div className="flex items-end gap-0.5 w-full h-full justify-center">
        {[30, 55, 40, 70, 50, 85, 65, 90, 75, 100, 80, 95].map((h, i) => (<div key={i} className="flex-1 rounded-t" style={{ height: `${h}%`, background: i === 11 ? 'var(--vermilion)' : `rgba(232,74,95,${0.08 + (i / 11) * 0.35})` }} />))}
      </div>
    ),
  },
  {
    href: '/statistic/producer-network', titleKey: 'feature_network_title', descKey: 'feature_network_desc',
    icon: <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="5" r="2" /><circle cx="5" cy="19" r="2" /><circle cx="19" cy="19" r="2" /><line x1="12" y1="7" x2="5" y2="17" /><line x1="12" y1="7" x2="19" y2="17" /><line x1="5" y1="19" x2="19" y2="19" /></svg>,
    preview: (
      <div className="w-full h-full">
        <svg viewBox="0 0 100 48" className="w-full h-full">
          <line x1="50" y1="10" x2="20" y2="38" stroke="rgba(255,255,255,0.07)" strokeWidth="1" /><line x1="50" y1="10" x2="80" y2="38" stroke="rgba(255,255,255,0.07)" strokeWidth="1" /><line x1="50" y1="10" x2="50" y2="38" stroke="rgba(255,255,255,0.07)" strokeWidth="1" /><line x1="20" y1="38" x2="50" y2="38" stroke="rgba(255,255,255,0.05)" strokeWidth="1" /><line x1="80" y1="38" x2="50" y2="38" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
          <circle cx="50" cy="10" r="5" fill="var(--vermilion)" opacity="0.75" /><circle cx="20" cy="38" r="3.5" fill="rgba(255,255,255,0.22)" /><circle cx="50" cy="38" r="3" fill="rgba(255,255,255,0.18)" /><circle cx="80" cy="38" r="4" fill="rgba(255,255,255,0.18)" /><circle cx="35" cy="24" r="2" fill="rgba(212,175,55,0.55)" /><circle cx="65" cy="24" r="2" fill="rgba(212,175,55,0.45)" />
        </svg>
      </div>
    ),
  },
  {
    href: '/player', titleKey: 'feature_player_title', descKey: 'feature_player_desc',
    icon: <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polygon points="10 8 16 12 10 16 10 8" /></svg>,
    preview: (
      <div className="flex flex-col justify-center gap-2 w-full h-full">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-[var(--vermilion)]/25 shrink-0 flex items-center justify-center border border-[var(--vermilion)]/30">
            <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="currentColor" className="text-[var(--vermilion)]"><polygon points="5 3 19 12 5 21 5 3" /></svg>
          </div>
          <div className="flex-1"><div className="h-1.5 w-16 bg-white/20 rounded-full mb-1.5" /><div className="h-1 w-10 bg-white/10 rounded-full" /></div>
        </div>
        <div className="flex items-center gap-1.5 w-full">
          <span className="text-[8px] text-[var(--text-secondary)]">0:42</span>
          <div className="flex-1 h-0.5 bg-white/10 rounded-full overflow-hidden"><div className="h-full w-1/3 bg-[var(--vermilion)] rounded-full" /></div>
          <span className="text-[8px] text-[var(--text-secondary)]">3:28</span>
        </div>
      </div>
    ),
  },
  {
    href: '/favorites', titleKey: 'feature_favorites_title', descKey: 'feature_favorites_desc',
    icon: <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" /></svg>,
    preview: (
      <div className="flex flex-col justify-center gap-2 w-full h-full">
        {['砂の惑星', 'ロキ', 'テレキャスタービーボーイ'].map(title => (
          <div key={title} className="flex items-center gap-2 text-[9px]">
            <svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" viewBox="0 0 24 24" fill="var(--vermilion)" stroke="none"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" /></svg>
            <span className="text-[var(--text-secondary)]">{title}</span>
          </div>
        ))}
      </div>
    ),
  },
];

// ─── Page ─────────────────────────────────────────────────────────────────────
export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Home' });
  const [stats, dailyTop, nicoTop] = await Promise.all([
    getSiteStats(),
    getDailyTopTotal(10),
    getDailyTopNico(5),
  ]);

  return (
    <div className="flex flex-col">

      {/* ═══════════════════════════════════════════════════════════════ HERO */}
      <section className="relative min-h-[calc(100vh-var(--header-height))] flex flex-col items-center justify-center overflow-hidden">

        {/* Radial ambient glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[60%] pointer-events-none z-0"
          style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(232,74,95,0.08) 0%, transparent 55%)' }} />

        <div className="relative z-10 w-full flex flex-col items-center gap-6">

          {/* Eyebrow — hidden on mobile, flush near navbar on desktop */}
          <div className="hidden md:flex items-center gap-4 animate-fade-in-up px-6" style={{ animationDelay: '0ms' }}>
            <div className="w-10 md:w-16 h-px bg-[var(--hairline-strong)]" />
            <span className="text-xs text-[var(--text-secondary)] tracking-[0.35em] uppercase font-light select-none">
              Vocaloid
            </span>
            <div className="w-10 md:w-16 h-px bg-[var(--hairline-strong)]" />
          </div>

          {/* ── Big thumbnail card podium — horizontal scroll ───────────────── */}
          <div className="w-full animate-fade-in-up relative" style={{ animationDelay: '60ms' }}>
            <div
              className="flex gap-3 overflow-x-auto px-4 md:px-6 pb-2"
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
              {(dailyTop as SongRow[]).map((song, idx) => {
                const rank = idx + 1;
                const title = song.name_japanese || song.name_english || song.name_romaji || '—';
                const thumb = song.niconico_thumb_url
                  || (song.youtube_id ? `https://img.youtube.com/vi/${song.youtube_id}/maxresdefault.jpg` : null);
                const isTop3 = rank <= 3;

                return (
                  <Link
                    key={song.id}
                    href={`/song/${song.id}`}
                    className={`group flex-none relative overflow-hidden cursor-pointer transition-all duration-300
                      ${isTop3
                        ? 'w-[420px] md:w-[560px] h-[340px] md:h-[450px]'
                        : 'w-[320px] md:w-[420px] h-[260px] md:h-[370px] opacity-80 hover:opacity-100'
                      }
                    `}
                    style={{ border: `1px solid ${isTop3 ? `${rankColor(rank)}50` : 'var(--hairline)'}` }}
                  >
                    {/* Thumbnail */}
                    {song.youtube_id || song.niconico_thumb_url ? (
                      <ThumbnailImage
                        youtubeId={song.youtube_id || ''}
                        niconicoThumb={song.niconico_thumb_url}
                        alt={title}
                        className="absolute inset-0 w-full h-full object-cover"
                      />
                    ) : (
                      <div className="absolute inset-0 bg-[var(--bg-panel)]" />
                    )}

                    {/* Gradient overlay for text readability */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />

                    {/* Rank badge — top-left */}
                    <span
                      className="absolute top-3 left-4 font-black text-2xl select-none drop-shadow-lg"
                      style={{ color: rankColor(rank) }}
                    >
                      {String(rank).padStart(2, '0')}
                    </span>

                    {/* Song info — bottom overlay */}
                    <div className="absolute bottom-0 left-0 right-0 p-3">
                      <p className={`font-bold text-white truncate drop-shadow-md group-hover:text-[var(--vermilion)] transition-colors ${isTop3 ? 'text-base' : 'text-sm'}`}>
                        {title}
                      </p>
                      <p className="text-xs text-white/70 truncate mt-0.5 drop-shadow-md">
                        {song.artists?.map((a: any) => a.name).join(' · ') || song.artist_string?.replace(/, /g, ' · ')}
                      </p>
                    </div>

                    {/* Top-3 medal glow border on hover */}
                    {isTop3 && (
                      <div
                        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
                        style={{ boxShadow: `inset 0 0 20px ${rankColor(rank)}30` }}
                      />
                    )}
                  </Link>
                );
              })}
              <div className="flex-none w-4" />
            </div>
          </div>

          {/* Stat strip — bigger text */}
          {stats && (
            <p className="text-xs text-[var(--text-secondary)] tracking-[0.35em] animate-fade-in-up px-6"
              style={{ animationDelay: '120ms' }}>
              <StatNumber value={stats.vocaloid_songs} suffix={t('stat_songs')} />
              <span className="mx-3 opacity-30">·</span>
              <StatNumber value={stats.vocaloid_producers} suffix={t('stat_producers')} />
            </p>
          )}

          {/* CTA Buttons — spaced away from stat strip */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-8 animate-fade-in-up px-6 mt-4" style={{ animationDelay: '160ms' }}>
            <Link href="/ranking"
              className="group relative px-12 py-5 text-white font-medium text-sm tracking-[0.15em] transition-all hover:text-[var(--vermilion)]">
              <div className="absolute inset-0 border border-[var(--hairline-strong)] group-hover:border-[var(--vermilion)]/50 transition-colors duration-500" />
              <div className="absolute -top-[1px] -left-[1px] w-3 h-3 border-t border-l border-white group-hover:border-[var(--vermilion)] group-hover:-translate-x-1 group-hover:-translate-y-1 transition-all duration-300" />
              <div className="absolute -top-[1px] -right-[1px] w-3 h-3 border-t border-r border-white group-hover:border-[var(--vermilion)] group-hover:translate-x-1 group-hover:-translate-y-1 transition-all duration-300" />
              <div className="absolute -bottom-[1px] -left-[1px] w-3 h-3 border-b border-l border-white group-hover:border-[var(--vermilion)] group-hover:-translate-x-1 group-hover:translate-y-1 transition-all duration-300" />
              <div className="absolute -bottom-[1px] -right-[1px] w-3 h-3 border-b border-r border-white group-hover:border-[var(--vermilion)] group-hover:translate-x-1 group-hover:translate-y-1 transition-all duration-300" />
              <span className="relative z-10">{t('cta_ranking')}</span>
            </Link>

            <Link href="/search"
              className="group relative px-6 py-4 text-[var(--text-secondary)] font-light text-sm tracking-[0.15em] transition-all hover:text-white">
              <span className="inline-block font-serif opacity-50 group-hover:opacity-100 group-hover:text-[var(--vermilion)] group-hover:-translate-x-2 transition-all duration-300 mr-2">〈</span>
              <span>{t('cta_search')}</span>
              <span className="inline-block font-serif opacity-50 group-hover:opacity-100 group-hover:text-[var(--vermilion)] group-hover:translate-x-2 transition-all duration-300 ml-2">〉</span>
            </Link>
          </div>

          {/* Signup CTA — only shown when not logged in */}
          <SignupCta />

        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════ CONTENT AREA */}
      <div className="max-w-[var(--max-width)] mx-auto w-full px-6 md:px-12 flex flex-col gap-24 py-24">

        {/* ─── Today's Top Picks ────────────────────────────────────────────── */}
        <section className="flex flex-col gap-8">
          <SectionDivider label={t('section_top_movers')} />
          <div className="glass-panel hairline-border">
            {(nicoTop as SongRow[]).length > 0 ? (
              <div className="divide-y divide-[var(--hairline)]">
                {(nicoTop as SongRow[]).map((song, idx) => {
                  const rank = idx + 1;
                  const title = song.name_japanese || song.name_english || song.name_romaji || '—';
                  const thumb = song.niconico_thumb_url
                    || (song.youtube_id ? `https://img.youtube.com/vi/${song.youtube_id}/hqdefault.jpg` : null);
                  const gain = song.increment_niconico ?? song.increment_total;
                  return (
                    <Link key={song.id} href={`/song/${song.id}`}
                      className={`flex items-center gap-4 px-6 py-4 hover:bg-white/[0.02] transition-colors group relative ${rank <= 3 ? 'pl-5' : ''}`}
                    >
                      {rank <= 3 && (
                        <div className="absolute left-0 top-0 bottom-0 w-0.5" style={{ backgroundColor: rankColor(rank) }} />
                      )}
                      <span className={`font-black shrink-0 font-serif ${rank <= 3 ? 'text-xl w-7' : 'text-lg w-6'}`} style={{ color: rankColor(rank) }}>{rank}</span>
                      {(song.youtube_id || song.niconico_thumb_url) ? (
                        <ThumbnailImage
                          youtubeId={song.youtube_id || ''}
                          niconicoThumb={song.niconico_thumb_url}
                          alt={title}
                          className="w-10 h-10 object-cover shrink-0 border border-[var(--hairline)]"
                        />
                      ) : (
                        <div className="w-10 h-10 bg-white/5 border border-[var(--hairline)] shrink-0 flex items-center justify-center">
                          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-[var(--text-secondary)]"><circle cx="12" cy="12" r="10" /><polygon points="10 8 16 12 10 16 10 8" /></svg>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate group-hover:text-[var(--vermilion)] transition-colors">{title}</p>
                        <p className="text-xs text-[var(--text-secondary)] truncate">{song.artist_string}</p>
                      </div>
                      <div className="shrink-0 flex items-center gap-1.5">
                        <span className="text-sm font-bold" style={{ color: rankColor(rank) }}>+{formatViews(gain)}</span>
                        <span className="text-[9px] text-[var(--text-secondary)] tracking-wide">{t('top_movers_views')}</span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <div className="px-6 py-10 text-center text-[var(--text-secondary)] text-sm">{t('top_movers_loading')}</div>
            )}

            <div className="px-6 py-4 border-t border-[var(--hairline)] text-right">
              <Link href="/ranking" className="group inline-flex items-center gap-1 text-[10px] tracking-[0.3em] uppercase text-[var(--text-secondary)] hover:text-[var(--vermilion)] transition-colors">
                <span className="inline-block font-serif opacity-50 group-hover:opacity-100 group-hover:-translate-x-1 transition-all duration-300">〈</span>
                {t('top_movers_see_all')}
                <span className="inline-block font-serif opacity-50 group-hover:opacity-100 group-hover:translate-x-1 transition-all duration-300">〉</span>
              </Link>
            </div>
          </div>
        </section>

        {/* ─── Feature Cards ────────────────────────────────────────────────── */}
        <section className="flex flex-col gap-8">
          <SectionDivider label={t('section_features')} />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {cards.map(card => (
              <Link key={card.href} href={card.href}
                className="group glass-panel hairline-border p-5 flex flex-col gap-4 hover:border-[var(--vermilion)]/40 transition-colors duration-300">
                <div className="flex items-center gap-3">
                  <span className="text-[var(--vermilion)] opacity-80 group-hover:opacity-100 transition-opacity">{card.icon}</span>
                  <span className="text-sm font-bold tracking-[0.25em] uppercase text-white group-hover:text-[var(--vermilion)] transition-colors">
                    {t(card.titleKey as Parameters<typeof t>[0])}
                  </span>
                </div>
                <div className={`w-full border border-[var(--hairline)] p-3 bg-black/20 ${PREVIEW_H}`}>{card.preview}</div>
                <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{t(card.descKey as Parameters<typeof t>[0])}</p>
                <div className="flex items-center gap-1 text-[10px] tracking-[0.3em] uppercase text-[var(--text-secondary)] group-hover:text-[var(--vermilion)] transition-colors mt-auto">
                  <span className="inline-block font-serif opacity-60 group-hover:opacity-100 group-hover:-translate-x-0.5 transition-all duration-300">〈</span>
                  <span>{t('feature_explore')}</span>
                  <span className="inline-block font-serif opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all duration-300">〉</span>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* ─── About VocaRank ───────────────────────────────────────────────── */}
        <section className="flex flex-col gap-8">
          <SectionDivider label={t('section_about')} />
          <div className="glass-panel hairline-border p-8 md:p-12 relative">
            <div className="absolute -top-[1px] -left-[1px] w-4 h-4 border-t-2 border-l-2 border-[var(--vermilion)] opacity-60" />
            <div className="absolute -bottom-[1px] -right-[1px] w-4 h-4 border-b-2 border-r-2 border-[var(--vermilion)] opacity-60" />
            <div className="flex gap-8 md:gap-16 items-start">
              <div className="hidden md:flex vertical-text text-[var(--vermilion)] text-[10px] tracking-[0.5em] opacity-60 select-none shrink-0">VocaRank について</div>
              <div className="flex-1 flex flex-col gap-4">
                <h2 className="text-lg font-bold tracking-[0.05em] text-white">{t('about_title')}</h2>
                <div className="w-12 h-px bg-[var(--vermilion)] opacity-60" />
                <p className="text-[var(--text-secondary)] leading-loose font-light text-sm md:text-base">{t('about_body')}</p>
              </div>
            </div>
          </div>
        </section>

      </div>
    </div>
  );
}
