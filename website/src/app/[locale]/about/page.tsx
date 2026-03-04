import { getTranslations } from 'next-intl/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import type { Metadata } from 'next';
import AboutClient from './AboutClient';

export async function generateMetadata(): Promise<Metadata> {
    const t = await getTranslations('About');
    return { title: t('title') };
}

const API = process.env.API_URL_INTERNAL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

async function fetchJSON(path: string, fallback: unknown) {
    try {
        const res = await fetch(`${API}${path}`, { cache: 'no-store' });
        if (!res.ok) return fallback;
        return res.json();
    } catch {
        return fallback;
    }
}

export default async function AboutPage() {
    const session = await getServerSession(authOptions);
    const isAdmin = session?.isAdmin ?? false;
    const apiToken = session?.apiToken;

    const [founder, announcements, roadmap, reports, contributors] = await Promise.all([
        fetchJSON('/about/founder', null),
        fetchJSON('/about/announcements', []),
        fetchJSON('/about/roadmap', []),
        fetchJSON('/about/reports', []),
        fetchJSON('/about/contributors', []),
    ]);

    return (
        <div className="min-h-screen">
            <div className="max-w-[var(--max-width)] mx-auto px-6 md:px-12 pt-8 pb-20 flex flex-col gap-12">
                <AboutClient
                    founder={founder}
                    initialAnnouncements={announcements}
                    initialRoadmap={roadmap}
                    initialReports={reports}
                    initialContributors={contributors}
                    isAdmin={isAdmin}
                    apiToken={apiToken}
                    userId={session?.userId ?? null}
                />
            </div>
        </div>
    );
}
