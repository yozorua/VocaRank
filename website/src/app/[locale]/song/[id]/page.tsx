import { getSong } from '@/lib/api';
import SongInfo from '@/components/SongInfo';
import SongPlayer from '@/components/SongPlayer';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';

interface PageProps {
    params: Promise<{
        locale: string;
        id: string;
    }>;
}

export default async function SongDetailPage({ params }: PageProps) {
    const { id, locale } = await params;
    const songId = parseInt(id, 10);

    if (isNaN(songId)) {
        notFound();
    }

    try {
        const song = await getSong(songId);

        return (
            <div className="max-w-[var(--max-width)] mx-auto px-6 py-8">
                <SongPlayer youtubeId={song.youtube_id} niconicoId={song.niconico_id} />
                <SongInfo song={song} />
            </div>
        );
    } catch (e) {
        notFound();
    }
}
