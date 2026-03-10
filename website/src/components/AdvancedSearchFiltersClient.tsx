'use client';

import { useRouter } from '@/i18n/navigation';
import AdvancedSearchFilters, { AdvancedFilters, DEFAULT_FILTERS } from '@/components/AdvancedSearchFilters';

interface Props {
    initialFilters: AdvancedFilters;
    initialSelectedVocalists: { id: number; name: string; artist_type: string; picture_url_thumb: string | null }[];
    locale: string;
    currentQuery: string;
}

export default function AdvancedSearchFiltersClient({ initialFilters, initialSelectedVocalists, locale, currentQuery }: Props) {
    const router = useRouter();

    const handleApply = (filters: AdvancedFilters) => {
        const params = new URLSearchParams();
        if (currentQuery) params.set('q', currentQuery);

        if (filters.vocalist_ids) params.set('vocalist_ids', filters.vocalist_ids);
        if (filters.vocalist_exclusive) params.set('vocalist_exclusive', 'true');
        if (filters.sort_by && filters.sort_by !== DEFAULT_FILTERS.sort_by) params.set('sort_by', filters.sort_by);
        if (filters.publish_date_start) params.set('date_start', filters.publish_date_start);
        if (filters.publish_date_end) params.set('date_end', filters.publish_date_end);
        if (filters.song_type) params.set('song_type', filters.song_type);

        const search = params.toString();
        router.push(`/search${search ? `?${search}` : ''}`);
    };

    return (
        <AdvancedSearchFilters
            initialFilters={initialFilters}
            initialSelectedVocalists={initialSelectedVocalists}
            onApply={handleApply}
        />
    );
}
