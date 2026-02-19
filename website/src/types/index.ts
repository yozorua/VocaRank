
export interface ArtistTiny {
    id: number;
    name: string;
    artist_type: string | null;
}

export interface Artist {
    id: number;
    artist_type: string;
    name_default: string;
    name_english: string | null;
    name_japanese: string | null;
    name_romaji: string | null;
    picture_mime: string | null;
    picture_url_original: string | null;
    picture_url_thumb: string | null;
    external_links: string | null; // JSON string
}

export interface SongRanking {
    id: number;
    name_english: string | null;
    name_japanese: string | null;
    name_romaji: string | null;
    total_views: number;
    increment_total?: number | null;
    increment_youtube?: number | null;
    increment_niconico?: number | null;
    views_youtube: number;
    views_niconico: number;
    youtube_id: string | null;
    niconico_id: string | null;
    song_type: string | null;
    publish_date: string | null;
    artist_string: string;
    vocaloid_string: string;
    artists: ArtistTiny[];
    vocalists: ArtistTiny[];
}

export interface SongDetail extends SongRanking {
    length_seconds: number | null;
    original_song_id: number | null;
    youtube_views?: number;
    niconico_views?: number;
}

export type RankingMode = 'daily' | 'weekly' | 'monthly' | 'total';
