import { getSong } from '@/lib/api';
import SongInfo from '@/components/SongInfo';
import SongPlayer from '@/components/SongPlayer';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import CommentsSection from '@/components/song/CommentsSection';
import IntroductionSection from '@/components/IntroductionSection';
import ViewHistoryChart from '@/components/ViewHistoryChart';

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://vocarank.live';
const LOCALES = ['en', 'zh-TW', 'ja', 'ar'];

export const revalidate = 3600;

export async function generateMetadata({ params }: { params: Promise<{ locale: string; id: string }> }): Promise<Metadata> {
    const { locale, id } = await params;
    const songId = parseInt(id, 10);
    if (isNaN(songId)) return {};
    try {
        const song = await getSong(songId);
        const title = (locale === 'ja' || locale === 'zh-TW')
            ? (song.name_japanese || song.name_english || song.name_romaji || 'Song')
            : (song.name_english || song.name_romaji || song.name_japanese || 'Song');
        const description = song.artist_string ? `${title} by ${song.artist_string}` : title;
        const thumb = song.youtube_id
            ? `https://img.youtube.com/vi/${song.youtube_id}/hqdefault.jpg`
            : (song.niconico_thumb_url ?? undefined);
        return {
            title,
            description,
            openGraph: { title, description, images: thumb ? [{ url: thumb }] : [] },
            twitter: { card: 'summary_large_image', images: thumb ? [thumb] : [] },
            alternates: {
                canonical: `${BASE_URL}/${locale}/song/${songId}`,
                languages: Object.fromEntries(LOCALES.map(l => [l, `${BASE_URL}/${l}/song/${songId}`])),
            },
        };
    } catch {
        return {};
    }
}

interface PageProps {
    params: Promise<{
        locale: string;
        id: string;
    }>;
}

export default async function SongDetailPage({ params }: PageProps) {
    const { id, locale } = await params;
    const songId = parseInt(id, 10);
    const t = await getTranslations('SongDetailPage'); // Added t for translations

    if (isNaN(songId)) {
        notFound();
    }

    try {
        const song = await getSong(songId);

        return (
            <div className="max-w-[var(--max-width)] mx-auto px-6 pt-6 pb-8 md:py-8">
                <SongPlayer youtubeId={song.youtube_id} niconicoId={song.niconico_id} />
                <SongInfo song={song} />
                <IntroductionSection
                    entityType="song"
                    entityId={song.id}
                    initialIntroZh={song.introduction ?? null}
                    initialIntroEn={song.introduction_en ?? null}
                    initialIntroJa={song.introduction_ja ?? null}
                    initialEditor={song.introduction_editor ?? null}
                    initialUpdatedAt={song.introduction_updated_at ?? null}
                />
                <ViewHistoryChart
                    youtubeHistory={song.youtube_history}
                    niconicoHistory={song.niconico_history}
                    publishDate={song.publish_date}
                />
                <CommentsSection songId={song.id} />
            </div>
        );
    } catch (e) {
        notFound();
    }
}
