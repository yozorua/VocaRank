'use client';

import { useState, useEffect } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Link } from '@/i18n/navigation';
import {
    createAnnouncement, updateAnnouncement, deleteAnnouncement,
    createRoadmapItem, updateRoadmapItem, deleteRoadmapItem,
    createReport, toggleReportUpvote, updateReportStatus, deleteReport,
    getMyUpvotes, updateFounder,
    createContributor, updateContributor, deleteContributor,
} from '@/lib/api';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Founder {
    id: number; name: string | null; picture_url: string | null;
    contact_email: string | null; social_x: string | null;
    social_instagram: string | null; social_facebook: string | null;
    social_discord: string | null;
    about_title: string | null;
}
interface Contributor { id: number; user_id: number; name: string | null; picture_url: string | null; role: string | null; display_order: number }
interface Announcement { id: number; title: string; content: string; pinned: boolean; created_at: string; updated_at: string }
interface TimelineItem { id: number; title: string; description: string | null; title_zh_tw: string | null; title_ja: string | null; description_zh_tw: string | null; description_ja: string | null; status: string; display_order: number; event_date: string | null; created_at: string }
interface ReportUser { id: number; name: string | null; picture_url: string | null }
interface Report { id: number; report_type: string; title: string; description: string | null; status: string; created_at: string; upvote_count: number; user_upvoted: boolean; user: ReportUser }

interface Props {
    founder: Founder | null;
    initialAnnouncements: Announcement[];
    initialRoadmap: TimelineItem[];
    initialReports: Report[];
    initialContributors: Contributor[];
    isAdmin: boolean;
    apiToken?: string;
    userId: number | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
    if (!iso) return '';
    return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatTimelineDate(date: string | null) {
    if (!date) return '—';
    return date.replace(/-/g, '/');
}

function SectionHeader({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
    return (
        <div className="flex items-center gap-4 mb-6">
            <h2 className="text-sm md:text-base font-bold tracking-[0.05em] text-[var(--text-secondary)] flex-shrink-0">{children}</h2>
            <div className="flex-1 h-px bg-[var(--hairline)]" />
            {action}
        </div>
    );
}

type BadgeVariant = 'bug' | 'feature' | 'open' | 'resolved' | 'closed' | 'pinned';
function Badge({ label, variant }: { label: string; variant: BadgeVariant }) {
    const styles: Record<BadgeVariant, string> = {
        bug:      'bg-red-900/40 text-red-300 border-red-800/50',
        feature:  'bg-blue-900/40 text-blue-300 border-blue-800/50',
        open:     'bg-emerald-900/40 text-emerald-300 border-emerald-800/50',
        resolved: 'bg-purple-900/40 text-purple-300 border-purple-800/50',
        closed:   'bg-zinc-700/40 text-zinc-400 border-zinc-600/50',
        pinned:   'bg-[var(--gold)]/10 text-[var(--gold)] border-[var(--hairline)]',
    };
    return (
        <span className={`inline-flex items-center px-2 py-0.5 text-[10px] font-semibold border flex-shrink-0 ${styles[variant]}`}>
            {label}
        </span>
    );
}

const inputCls = "w-full bg-transparent border border-[var(--hairline)] px-3 py-2 text-sm text-white placeholder-[var(--text-secondary)] focus:outline-none focus:border-[var(--vermilion)] transition-colors";

// ── Social icon components ────────────────────────────────────────────────────

function EmailIcon() {
    return <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>;
}
function XIcon() {
    return <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.747l7.73-8.835L1.254 2.25H8.08l4.258 5.63 5.906-5.63zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>;
}
function InstagramIcon() {
    return <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="0.5" fill="currentColor" stroke="none"/></svg>;
}
function FacebookIcon() {
    return <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>;
}
function DiscordIcon() {
    return <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/></svg>;
}

// ── Main component ────────────────────────────────────────────────────────────

export default function AboutClient({ founder: initialFounder, initialAnnouncements, initialRoadmap, initialReports, initialContributors, isAdmin, userId }: Props) {
    const t = useTranslations('About');
    const locale = useLocale();

    // ── Announcements ──────────────────────────────────────────────────────────
    const [announcements, setAnnouncements] = useState<Announcement[]>(initialAnnouncements);
    const [annForm, setAnnForm] = useState<{ title: string; content: string; pinned: boolean } | null>(null);
    const [editingAnn, setEditingAnn] = useState<Announcement | null>(null);
    const [annSaving, setAnnSaving] = useState(false);
    const [expandedAnn, setExpandedAnn] = useState<Set<number>>(new Set());

    // ── Timeline ───────────────────────────────────────────────────────────────
    const [timeline, setTimeline] = useState<TimelineItem[]>(initialRoadmap);
    const [timelineForm, setTimelineForm] = useState<{ event_date: string; title: string; description: string; title_zh_tw: string; title_ja: string; description_zh_tw: string; description_ja: string } | null>(null);
    const [timelineFormLang, setTimelineFormLang] = useState<'en' | 'zh-TW' | 'ja'>('en');
    const [editingItem, setEditingItem] = useState<TimelineItem | null>(null);
    const [timelineSaving, setTimelineSaving] = useState(false);

    // ── Reports ────────────────────────────────────────────────────────────────
    const [reports, setReports] = useState<Report[]>(initialReports);
    const [reportFilter, setReportFilter] = useState<'all' | 'bug' | 'feature'>('all');
    const [reportForm, setReportForm] = useState({ report_type: 'bug', title: '', description: '' });
    const [reportSubmitting, setReportSubmitting] = useState(false);
    const [myUpvotedIds, setMyUpvotedIds] = useState<Set<number>>(new Set());
    const [expandedReports, setExpandedReports] = useState<Set<number>>(new Set());
    const [showForm, setShowForm] = useState(false);

    // ── Founder ────────────────────────────────────────────────────────────────
    const [founder, setFounder] = useState<Founder | null>(initialFounder);
    const [editingFounder, setEditingFounder] = useState(false);
    const [founderForm, setFounderForm] = useState({
        contact_email: initialFounder?.contact_email ?? '',
        social_x: initialFounder?.social_x ?? '',
        social_instagram: initialFounder?.social_instagram ?? '',
        social_facebook: initialFounder?.social_facebook ?? '',
        social_discord: initialFounder?.social_discord ?? '',
        about_title: initialFounder?.about_title ?? '',
    });
    const [founderSaving, setFounderSaving] = useState(false);

    // ── Contributors ───────────────────────────────────────────────────────────
    const [contributors, setContributors] = useState<Contributor[]>(initialContributors);
    const [contribForm, setContribForm] = useState<{ user_id: string; role: string } | null>(null);
    const [editingContrib, setEditingContrib] = useState<Contributor | null>(null);
    const [contribSaving, setContribSaving] = useState(false);
    const [contribError, setContribError] = useState<string | null>(null);

    useEffect(() => {
        if (!userId) return;
        getMyUpvotes().then((data: { upvoted_ids: number[] }) => {
            setMyUpvotedIds(new Set(data.upvoted_ids));
            setReports(prev => prev.map(r => ({ ...r, user_upvoted: data.upvoted_ids.includes(r.id) })));
        }).catch(() => {});
    }, [userId]);

    // ── Announcement handlers ──────────────────────────────────────────────────

    const handleAnnSave = async () => {
        if (!annForm) return;
        setAnnSaving(true);
        try {
            if (editingAnn) {
                const updated = await updateAnnouncement(editingAnn.id, annForm);
                setAnnouncements(prev => prev.map(a => a.id === editingAnn.id ? updated : a));
            } else {
                const created = await createAnnouncement(annForm);
                setAnnouncements(prev => [created, ...prev]);
            }
            setAnnForm(null); setEditingAnn(null);
        } catch { /* noop */ } finally { setAnnSaving(false); }
    };

    const handleAnnDelete = async (id: number) => {
        if (!confirm(t('confirm_delete'))) return;
        try { await deleteAnnouncement(id); setAnnouncements(prev => prev.filter(a => a.id !== id)); } catch { /* noop */ }
    };

    // ── Timeline handlers ──────────────────────────────────────────────────────

    const sortTimeline = (items: TimelineItem[]) =>
        [...items].sort((a, b) => {
            if (!a.event_date && !b.event_date) return 0;
            if (!a.event_date) return 1;
            if (!b.event_date) return -1;
            return a.event_date.localeCompare(b.event_date);
        });

    const handleTimelineSave = async () => {
        if (!timelineForm) return;
        setTimelineSaving(true);
        try {
            if (editingItem) {
                const updated = await updateRoadmapItem(editingItem.id, {
                    title: timelineForm.title,
                    description: timelineForm.description,
                    event_date: timelineForm.event_date || undefined,
                    title_zh_tw: timelineForm.title_zh_tw,
                    title_ja: timelineForm.title_ja,
                    description_zh_tw: timelineForm.description_zh_tw,
                    description_ja: timelineForm.description_ja,
                });
                setTimeline(prev => sortTimeline(prev.map(r => r.id === editingItem.id ? updated : r)));
            } else {
                const created = await createRoadmapItem({
                    title: timelineForm.title,
                    description: timelineForm.description || undefined,
                    event_date: timelineForm.event_date || undefined,
                    status: 'completed',
                    display_order: 0,
                    title_zh_tw: timelineForm.title_zh_tw || undefined,
                    title_ja: timelineForm.title_ja || undefined,
                    description_zh_tw: timelineForm.description_zh_tw || undefined,
                    description_ja: timelineForm.description_ja || undefined,
                });
                setTimeline(prev => sortTimeline([...prev, created]));
            }
            setTimelineForm(null); setEditingItem(null);
        } catch { /* noop */ } finally { setTimelineSaving(false); }
    };

    const handleTimelineDelete = async (id: number) => {
        if (!confirm(t('confirm_delete'))) return;
        try { await deleteRoadmapItem(id); setTimeline(prev => prev.filter(r => r.id !== id)); } catch { /* noop */ }
    };

    // ── Report handlers ────────────────────────────────────────────────────────

    const handleReportSubmit = async () => {
        if (!reportForm.title.trim()) return;
        setReportSubmitting(true);
        try {
            const created = await createReport({ ...reportForm, description: reportForm.description || undefined });
            setReports(prev => [created, ...prev]);
            setReportForm({ report_type: 'bug', title: '', description: '' });
            setShowForm(false);
        } catch { /* noop */ } finally { setReportSubmitting(false); }
    };

    const handleUpvote = async (reportId: number) => {
        if (!userId) return;
        const prev = reports.find(r => r.id === reportId);
        if (!prev) return;
        const wasVoted = myUpvotedIds.has(reportId);
        setReports(rs => rs.map(r => r.id === reportId ? { ...r, upvote_count: r.upvote_count + (wasVoted ? -1 : 1), user_upvoted: !wasVoted } : r));
        setMyUpvotedIds(ids => { const n = new Set(ids); wasVoted ? n.delete(reportId) : n.add(reportId); return n; });
        try {
            const result = await toggleReportUpvote(reportId);
            setReports(rs => rs.map(r => r.id === reportId ? { ...r, upvote_count: result.upvote_count, user_upvoted: result.user_upvoted } : r));
        } catch {
            setReports(rs => rs.map(r => r.id === reportId ? { ...r, upvote_count: prev.upvote_count, user_upvoted: prev.user_upvoted } : r));
        }
    };

    const handleReportStatus = async (reportId: number, status: string) => {
        try { await updateReportStatus(reportId, status); setReports(rs => rs.map(r => r.id === reportId ? { ...r, status } : r)); } catch { /* noop */ }
    };

    const handleReportDelete = async (reportId: number) => {
        if (!confirm(t('confirm_delete'))) return;
        try { await deleteReport(reportId); setReports(prev => prev.filter(r => r.id !== reportId)); } catch { /* noop */ }
    };

    const toggleExpand = (id: number) => {
        setExpandedReports(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
    };

    // ── Founder handlers ───────────────────────────────────────────────────────

    const handleFounderSave = async () => {
        setFounderSaving(true);
        try {
            const updated = await updateFounder(founderForm);
            setFounder(updated);
            setEditingFounder(false);
        } catch { /* noop */ } finally { setFounderSaving(false); }
    };

    // ── Contributor handlers ───────────────────────────────────────────────────

    const handleContribSave = async () => {
        if (!contribForm) return;
        setContribSaving(true);
        setContribError(null);
        try {
            if (editingContrib) {
                const updated = await updateContributor(editingContrib.id, { role: contribForm.role || undefined });
                setContributors(prev => prev.map(c => c.id === editingContrib.id ? updated : c));
            } else {
                const uid = parseInt(contribForm.user_id);
                if (isNaN(uid)) { setContribError('Invalid user ID'); setContribSaving(false); return; }
                const created = await createContributor({ user_id: uid, role: contribForm.role || undefined });
                setContributors(prev => [...prev, created]);
            }
            setContribForm(null); setEditingContrib(null);
        } catch (e: any) {
            setContribError(e?.info?.detail ?? 'Failed to save contributor');
        } finally { setContribSaving(false); }
    };

    const handleContribDelete = async (id: number) => {
        if (!confirm(t('confirm_delete'))) return;
        try { await deleteContributor(id); setContributors(prev => prev.filter(c => c.id !== id)); } catch { /* noop */ }
    };

    // ── Derived ────────────────────────────────────────────────────────────────

    const filteredReports = reports
        .filter(r => reportFilter === 'all' || r.report_type === reportFilter)
        .sort((a, b) => b.upvote_count - a.upvote_count);

    const reportTypeLabel = (type: string) => type === 'bug' ? t('bug') : t('feature');
    const reportStatusLabel = (s: string) => s === 'open' ? t('status_open') : s === 'resolved' ? t('status_resolved') : t('status_closed');
    const needsExpand = (r: Report) => !!r.description && (r.description.length > 80 || r.description.includes('\n'));
    const sortedTimeline = sortTimeline(timeline);

    return (
        <>
            {/* ══ 1. ANNOUNCEMENTS ════════════════════════════════════════════════ */}
            <section>
                <SectionHeader action={
                    isAdmin && !annForm ? (
                        <button onClick={() => { setEditingAnn(null); setAnnForm({ title: '', content: '', pinned: false }); }} className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)] hover:text-white border border-[var(--hairline)] px-3 py-1.5 transition-colors hover:border-[var(--hairline-strong)] flex-shrink-0">
                            <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                            {t('add_announcement')}
                        </button>
                    ) : undefined
                }>{t('announcements_section')}</SectionHeader>

                <div className="flex flex-col gap-4">
                    {isAdmin && annForm && !editingAnn && (
                        <div className="glass-panel hairline-border p-5 flex flex-col gap-3">
                            <input className={inputCls} placeholder={t('announcement_title_placeholder')} value={annForm.title} onChange={e => setAnnForm(f => f && ({ ...f, title: e.target.value }))} />
                            <textarea className={`${inputCls} min-h-[100px] resize-y`} placeholder={t('announcement_content_placeholder')} value={annForm.content} onChange={e => setAnnForm(f => f && ({ ...f, content: e.target.value }))} />
                            <label className="flex items-center gap-2 text-xs text-[var(--text-secondary)] cursor-pointer select-none">
                                <input type="checkbox" checked={annForm.pinned} onChange={e => setAnnForm(f => f && ({ ...f, pinned: e.target.checked }))} className="accent-[var(--vermilion)]" />
                                {t('pin')}
                            </label>
                            <div className="flex gap-2">
                                <button onClick={handleAnnSave} disabled={annSaving || !annForm.title.trim() || !annForm.content.trim()} className="px-4 py-1.5 text-xs font-bold bg-[var(--vermilion)] text-white disabled:opacity-50 hover:opacity-90 transition-opacity">{annSaving ? t('submitting') : t('save')}</button>
                                <button onClick={() => { setAnnForm(null); setEditingAnn(null); }} className="px-4 py-1.5 text-xs text-[var(--text-secondary)] border border-[var(--hairline)] hover:text-white transition-colors">{t('cancel')}</button>
                            </div>
                        </div>
                    )}

                    {announcements.length === 0 && !annForm && <p className="text-sm text-[var(--text-secondary)]">{t('no_announcements')}</p>}

                    {announcements.map(ann => {
                        const annExpanded = expandedAnn.has(ann.id);
                        const annCanExpand = ann.content.length > 180 || (ann.content.match(/\n/g)?.length ?? 0) >= 2;
                        return (
                        <div key={ann.id} className="glass-panel hairline-border p-5 flex flex-col gap-3">
                            {isAdmin && editingAnn?.id === ann.id && annForm ? (
                                <div className="flex flex-col gap-3">
                                    <input className={inputCls} value={annForm.title} onChange={e => setAnnForm(f => f && ({ ...f, title: e.target.value }))} />
                                    <textarea className={`${inputCls} min-h-[100px] resize-y`} value={annForm.content} onChange={e => setAnnForm(f => f && ({ ...f, content: e.target.value }))} />
                                    <label className="flex items-center gap-2 text-xs text-[var(--text-secondary)] cursor-pointer select-none">
                                        <input type="checkbox" checked={annForm.pinned} onChange={e => setAnnForm(f => f && ({ ...f, pinned: e.target.checked }))} className="accent-[var(--vermilion)]" />
                                        {t('pin')}
                                    </label>
                                    <div className="flex gap-2">
                                        <button onClick={handleAnnSave} disabled={annSaving || !annForm.title.trim() || !annForm.content.trim()} className="px-4 py-1.5 text-xs font-bold bg-[var(--vermilion)] text-white disabled:opacity-50 hover:opacity-90 transition-opacity">{annSaving ? t('submitting') : t('save')}</button>
                                        <button onClick={() => { setAnnForm(null); setEditingAnn(null); }} className="px-4 py-1.5 text-xs text-[var(--text-secondary)] border border-[var(--hairline)] hover:text-white transition-colors">{t('cancel')}</button>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            {ann.pinned && <Badge label={t('pinned')} variant="pinned" />}
                                            <h3 className="font-bold text-white">{ann.title}</h3>
                                        </div>
                                        {isAdmin && (
                                            <div className="flex gap-3 flex-shrink-0">
                                                <button onClick={() => { setEditingAnn(ann); setAnnForm({ title: ann.title, content: ann.content, pinned: ann.pinned }); }} className="text-xs text-[var(--text-secondary)] hover:text-white transition-colors">{t('edit')}</button>
                                                <button onClick={() => handleAnnDelete(ann.id)} className="text-xs text-red-400 hover:text-red-300 transition-colors">{t('delete')}</button>
                                            </div>
                                        )}
                                    </div>
                                    <div>
                                        <p
                                            className="text-sm text-[var(--text-secondary)] leading-relaxed break-words whitespace-pre-wrap overflow-hidden"
                                            style={!annExpanded && annCanExpand ? { maxHeight: '4.875em' } : undefined}
                                        >{ann.content}</p>
                                        {annCanExpand && (
                                            <button onClick={() => setExpandedAnn(prev => { const n = new Set(prev); n.has(ann.id) ? n.delete(ann.id) : n.add(ann.id); return n; })} className="text-[10px] text-[var(--text-secondary)] hover:text-white mt-0.5 transition-colors">
                                                {annExpanded ? `▲ ${t('show_less')}` : `▼ ${t('show_more')}`}
                                            </button>
                                        )}
                                    </div>
                                    <div className="text-[10px] text-[var(--text-secondary)] tracking-wider">
                                        {ann.updated_at !== ann.created_at ? `${t('updated')} ${formatDate(ann.updated_at)}` : formatDate(ann.created_at)}
                                    </div>
                                </>
                            )}
                        </div>
                        );
                    })}
                </div>
            </section>

            {/* ══ 2. HISTORY TIMELINE ═════════════════════════════════════════════ */}
            <section>
                <SectionHeader action={
                    isAdmin && !timelineForm ? (
                        <button onClick={() => { setEditingItem(null); setTimelineFormLang('en'); setTimelineForm({ event_date: '', title: '', description: '', title_zh_tw: '', title_ja: '', description_zh_tw: '', description_ja: '' }); }} className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)] hover:text-white border border-[var(--hairline)] px-3 py-1.5 transition-colors hover:border-[var(--hairline-strong)] flex-shrink-0">
                            <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                            {t('add_timeline_event')}
                        </button>
                    ) : undefined
                }>{t('roadmap_section')}</SectionHeader>

                {isAdmin && timelineForm && !editingItem && (
                    <div className="glass-panel hairline-border p-5 mb-6 flex flex-col gap-3">
                        <div className="flex flex-col gap-1 sm:w-44 flex-shrink-0">
                            <label className="text-[10px] text-[var(--text-secondary)] tracking-widest uppercase">{t('event_date_label')}</label>
                            <input type="date" className={inputCls} value={timelineForm.event_date} onChange={e => setTimelineForm(f => f && ({ ...f, event_date: e.target.value }))} style={{ colorScheme: 'dark' }} />
                        </div>
                        <div className="flex border-b border-[var(--hairline)]">
                            {(['en', 'zh-TW', 'ja'] as const).map(lang => (
                                <button key={lang} type="button" onClick={() => setTimelineFormLang(lang)} className={`px-3 py-1.5 text-xs transition-colors border-b-2 -mb-px ${timelineFormLang === lang ? 'border-[var(--vermilion)] text-white' : 'border-transparent text-[var(--text-secondary)] hover:text-white'}`}>
                                    {lang === 'en' ? 'EN' : lang === 'zh-TW' ? '繁中' : '日本語'}
                                </button>
                            ))}
                        </div>
                        {timelineFormLang === 'en' && (<>
                            <input className={inputCls} placeholder={t('timeline_title_placeholder')} value={timelineForm.title} onChange={e => setTimelineForm(f => f && ({ ...f, title: e.target.value }))} />
                            <textarea className={`${inputCls} min-h-[70px] resize-y`} placeholder={t('roadmap_desc_placeholder')} value={timelineForm.description} onChange={e => setTimelineForm(f => f && ({ ...f, description: e.target.value }))} />
                        </>)}
                        {timelineFormLang === 'zh-TW' && (<>
                            <input className={inputCls} placeholder={`${t('timeline_title_placeholder')} (繁中)`} value={timelineForm.title_zh_tw} onChange={e => setTimelineForm(f => f && ({ ...f, title_zh_tw: e.target.value }))} />
                            <textarea className={`${inputCls} min-h-[70px] resize-y`} placeholder={`${t('roadmap_desc_placeholder')} (繁中)`} value={timelineForm.description_zh_tw} onChange={e => setTimelineForm(f => f && ({ ...f, description_zh_tw: e.target.value }))} />
                        </>)}
                        {timelineFormLang === 'ja' && (<>
                            <input className={inputCls} placeholder={`${t('timeline_title_placeholder')} (日本語)`} value={timelineForm.title_ja} onChange={e => setTimelineForm(f => f && ({ ...f, title_ja: e.target.value }))} />
                            <textarea className={`${inputCls} min-h-[70px] resize-y`} placeholder={`${t('roadmap_desc_placeholder')} (日本語)`} value={timelineForm.description_ja} onChange={e => setTimelineForm(f => f && ({ ...f, description_ja: e.target.value }))} />
                        </>)}
                        <div className="flex gap-2">
                            <button onClick={handleTimelineSave} disabled={timelineSaving || !timelineForm.title.trim()} className="px-4 py-1.5 text-xs font-bold bg-[var(--vermilion)] text-white disabled:opacity-50 hover:opacity-90 transition-opacity">{timelineSaving ? t('submitting') : t('save')}</button>
                            <button onClick={() => setTimelineForm(null)} className="px-4 py-1.5 text-xs text-[var(--text-secondary)] border border-[var(--hairline)] hover:text-white transition-colors">{t('cancel')}</button>
                        </div>
                    </div>
                )}

                {sortedTimeline.length === 0 && !timelineForm && <p className="text-sm text-[var(--text-secondary)]">{t('no_roadmap_items')}</p>}

                <div className="relative">
                    {sortedTimeline.length > 0 && <div className="absolute left-[5.5rem] top-2 bottom-2 w-px bg-[var(--hairline)]" />}
                    {sortedTimeline.map((item, idx) => (
                        <div key={item.id} className="relative flex items-start group/item">
                            <div className="flex-shrink-0 h-5 flex items-center justify-end pr-4" style={{ width: '5.5rem' }}>
                                <span className="text-[11px] font-mono text-[var(--text-secondary)]">{formatTimelineDate(item.event_date)}</span>
                            </div>
                            <div className="relative z-10 flex-shrink-0 h-5 flex items-center">
                                <div className={`w-3 h-3 rounded-full border-2 border-[var(--bg-dark)] ${idx === sortedTimeline.length - 1 ? 'bg-[var(--vermilion)]' : 'bg-[var(--hairline-strong)]'}`} />
                            </div>
                            <div className="flex-1 pl-4 pb-8 min-w-0">
                                {isAdmin && editingItem?.id === item.id && timelineForm ? (
                                    <div className="glass-panel hairline-border p-4 flex flex-col gap-3">
                                        <div className="flex flex-col gap-1 sm:w-44 flex-shrink-0">
                                            <label className="text-[10px] text-[var(--text-secondary)] tracking-widest uppercase">{t('event_date_label')}</label>
                                            <input type="date" className={inputCls} value={timelineForm.event_date} onChange={e => setTimelineForm(f => f && ({ ...f, event_date: e.target.value }))} style={{ colorScheme: 'dark' }} />
                                        </div>
                                        <div className="flex border-b border-[var(--hairline)]">
                                            {(['en', 'zh-TW', 'ja'] as const).map(lang => (
                                                <button key={lang} type="button" onClick={() => setTimelineFormLang(lang)} className={`px-3 py-1.5 text-xs transition-colors border-b-2 -mb-px ${timelineFormLang === lang ? 'border-[var(--vermilion)] text-white' : 'border-transparent text-[var(--text-secondary)] hover:text-white'}`}>
                                                    {lang === 'en' ? 'EN' : lang === 'zh-TW' ? '繁中' : '日本語'}
                                                </button>
                                            ))}
                                        </div>
                                        {timelineFormLang === 'en' && (<>
                                            <input className={inputCls} value={timelineForm.title} onChange={e => setTimelineForm(f => f && ({ ...f, title: e.target.value }))} />
                                            <textarea className={`${inputCls} min-h-[60px] resize-y`} value={timelineForm.description} onChange={e => setTimelineForm(f => f && ({ ...f, description: e.target.value }))} />
                                        </>)}
                                        {timelineFormLang === 'zh-TW' && (<>
                                            <input className={inputCls} placeholder={`${t('timeline_title_placeholder')} (繁中)`} value={timelineForm.title_zh_tw} onChange={e => setTimelineForm(f => f && ({ ...f, title_zh_tw: e.target.value }))} />
                                            <textarea className={`${inputCls} min-h-[60px] resize-y`} value={timelineForm.description_zh_tw} onChange={e => setTimelineForm(f => f && ({ ...f, description_zh_tw: e.target.value }))} />
                                        </>)}
                                        {timelineFormLang === 'ja' && (<>
                                            <input className={inputCls} placeholder={`${t('timeline_title_placeholder')} (日本語)`} value={timelineForm.title_ja} onChange={e => setTimelineForm(f => f && ({ ...f, title_ja: e.target.value }))} />
                                            <textarea className={`${inputCls} min-h-[60px] resize-y`} value={timelineForm.description_ja} onChange={e => setTimelineForm(f => f && ({ ...f, description_ja: e.target.value }))} />
                                        </>)}
                                        <div className="flex gap-2">
                                            <button onClick={handleTimelineSave} disabled={timelineSaving || !timelineForm.title.trim()} className="px-4 py-1.5 text-xs font-bold bg-[var(--vermilion)] text-white disabled:opacity-50 hover:opacity-90 transition-opacity">{timelineSaving ? t('submitting') : t('save')}</button>
                                            <button onClick={() => { setTimelineForm(null); setEditingItem(null); }} className="px-4 py-1.5 text-xs text-[var(--text-secondary)] border border-[var(--hairline)] hover:text-white transition-colors">{t('cancel')}</button>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        <div className="flex items-start justify-between gap-3">
                                            <span className="font-semibold text-sm text-white leading-5 break-words min-w-0">
                                                {locale === 'zh-TW' && item.title_zh_tw ? item.title_zh_tw : locale === 'ja' && item.title_ja ? item.title_ja : item.title}
                                            </span>
                                            {isAdmin && (
                                                <div className="flex gap-3 flex-shrink-0 opacity-0 group-hover/item:opacity-100 transition-opacity">
                                                    <button onClick={() => { setEditingItem(item); setTimelineFormLang('en'); setTimelineForm({ event_date: item.event_date ?? '', title: item.title, description: item.description ?? '', title_zh_tw: item.title_zh_tw ?? '', title_ja: item.title_ja ?? '', description_zh_tw: item.description_zh_tw ?? '', description_ja: item.description_ja ?? '' }); }} className="text-[10px] text-[var(--text-secondary)] hover:text-white transition-colors">{t('edit')}</button>
                                                    <button onClick={() => handleTimelineDelete(item.id)} className="text-[10px] text-red-400 hover:text-red-300 transition-colors">{t('delete')}</button>
                                                </div>
                                            )}
                                        </div>
                                        {(locale === 'zh-TW' && item.description_zh_tw ? item.description_zh_tw : locale === 'ja' && item.description_ja ? item.description_ja : item.description) && (
                                            <p className="text-xs text-[var(--text-secondary)] leading-relaxed mt-1 whitespace-pre-wrap break-words">
                                                {locale === 'zh-TW' && item.description_zh_tw ? item.description_zh_tw : locale === 'ja' && item.description_ja ? item.description_ja : item.description}
                                            </p>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* ══ 3. REPORTS ══════════════════════════════════════════════════════ */}
            <section>
                <SectionHeader>{t('reports_section')}</SectionHeader>

                {/* Filter tabs */}
                <div className="flex mb-4 border-b border-[var(--hairline)]">
                    {(['all', 'bug', 'feature'] as const).map(f => (
                        <button key={f} onClick={() => {
                            setReportFilter(f);
                            setShowForm(false);
                            if (f !== 'all') setReportForm(prev => ({ ...prev, report_type: f }));
                        }} className={`px-4 py-2 text-xs font-bold transition-colors border-b-2 -mb-px ${reportFilter === f ? 'border-[var(--vermilion)] text-white' : 'border-transparent text-[var(--text-secondary)] hover:text-white'}`}>
                            {f === 'all' ? t('all') : f === 'bug' ? t('filter_bugs') : t('filter_features')}
                        </button>
                    ))}
                </div>

                {/* Scrollable report list — shows ~5 cards */}
                <div className="overflow-y-auto mb-4" style={{ maxHeight: '460px' }}>
                    <div className="flex flex-col gap-3 pr-1">
                        {filteredReports.length === 0 && <p className="text-sm text-[var(--text-secondary)] py-4">{t('no_reports')}</p>}
                        {filteredReports.map(report => {
                            const expanded = expandedReports.has(report.id);
                            const canExpand = needsExpand(report);
                            return (
                                <div key={report.id} className="glass-panel hairline-border p-4 flex gap-4">
                                    {/* Upvote column */}
                                    <div className="flex flex-col items-center gap-1 flex-shrink-0 w-9">
                                        <button onClick={() => handleUpvote(report.id)} disabled={!userId} title={t('upvote')} className={`transition-colors disabled:cursor-default ${myUpvotedIds.has(report.id) ? 'text-[var(--vermilion)]' : 'text-[var(--text-secondary)] hover:text-white'}`}>
                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill={myUpvotedIds.has(report.id) ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2"><polyline points="18 15 12 9 6 15"/></svg>
                                        </button>
                                        <span className="text-xs font-bold text-white">{report.upvote_count}</span>
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1 min-w-0 overflow-hidden">
                                        {/* Badges + title */}
                                        <div className="flex items-start gap-2 flex-wrap mb-1.5">
                                            <Badge label={reportStatusLabel(report.status)} variant={report.status as BadgeVariant} />
                                            <Badge label={reportTypeLabel(report.report_type)} variant={report.report_type as BadgeVariant} />
                                            <span className="font-semibold text-sm text-white break-words min-w-0">{report.title}</span>
                                        </div>

                                        {/* Description — 2-line clamp when collapsed */}
                                        {report.description && (
                                            <div className="mb-1.5">
                                                <p className={`text-xs text-[var(--text-secondary)] leading-relaxed whitespace-pre-wrap break-words overflow-wrap-anywhere ${!expanded && canExpand ? 'line-clamp-1' : ''}`}>
                                                    {report.description}
                                                </p>
                                                {canExpand && (
                                                    <button onClick={() => toggleExpand(report.id)} className="text-[10px] text-[var(--text-secondary)] hover:text-white mt-0.5 transition-colors">
                                                        {expanded ? `▲ ${t('show_less')}` : `▼ ${t('show_more')}`}
                                                    </button>
                                                )}
                                            </div>
                                        )}

                                        {/* Meta row */}
                                        <div className="flex items-center gap-2 text-[10px] text-[var(--text-secondary)]">
                                            {report.user.picture_url && <img src={report.user.picture_url} alt="" className="w-4 h-4 rounded-full object-cover flex-shrink-0" />}
                                            <span className="truncate">{report.user.name ?? 'Anonymous'}</span>
                                            <span className="flex-shrink-0">·</span>
                                            <span className="flex-shrink-0">{formatDate(report.created_at)}</span>
                                        </div>
                                    </div>

                                    {/* Admin controls */}
                                    {isAdmin && (
                                        <div className="flex flex-col gap-2 flex-shrink-0 items-end">
                                            <select value={report.status} onChange={e => handleReportStatus(report.id, e.target.value)} className="bg-[var(--bg-dark)] border border-[var(--hairline)] text-[10px] text-[var(--text-secondary)] px-2 py-1 focus:outline-none focus:border-[var(--vermilion)] cursor-pointer">
                                                <option value="open">{t('status_open')}</option>
                                                <option value="resolved">{t('status_resolved')}</option>
                                                <option value="closed">{t('status_closed')}</option>
                                            </select>
                                            <button onClick={() => handleReportDelete(report.id)} className="text-[10px] text-red-400 hover:text-red-300 transition-colors">{t('delete')}</button>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Submit form — collapsible, below the list */}
                {userId ? (
                    <div>
                        {!showForm ? (
                            <button onClick={() => { setReportForm(f => ({ ...f, report_type: reportFilter === 'all' ? 'bug' : reportFilter })); setShowForm(true); }} className="flex items-center gap-2 text-xs text-[var(--text-secondary)] hover:text-white border border-[var(--hairline)] px-4 py-2 transition-colors hover:border-[var(--hairline-strong)]">
                                <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                                {t('submit_report')}
                            </button>
                        ) : (
                            <div className="glass-panel hairline-border p-5 flex flex-col gap-3">
                                {/* Type selector — styled segmented control */}
                                <div className="flex gap-0 border border-[var(--hairline)] self-start">
                                    {(['bug', 'feature'] as const).map(type => (
                                        <button
                                            key={type}
                                            onClick={() => setReportForm(f => ({ ...f, report_type: type }))}
                                            className={`px-4 py-1.5 text-xs font-semibold transition-colors ${reportForm.report_type === type ? 'bg-[var(--vermilion)] text-white' : 'text-[var(--text-secondary)] hover:text-white'}`}
                                        >
                                            {reportTypeLabel(type)}
                                        </button>
                                    ))}
                                </div>
                                <input className={inputCls} placeholder={t('report_title_placeholder')} value={reportForm.title} onChange={e => setReportForm(f => ({ ...f, title: e.target.value }))} />
                                <textarea className={`${inputCls} min-h-[80px] resize-y`} placeholder={t('report_desc_placeholder')} value={reportForm.description} onChange={e => setReportForm(f => ({ ...f, description: e.target.value }))} />
                                <div className="flex gap-2">
                                    <button onClick={handleReportSubmit} disabled={reportSubmitting || !reportForm.title.trim()} className="px-5 py-2 text-xs font-bold bg-[var(--vermilion)] text-white disabled:opacity-50 hover:opacity-90 transition-opacity">
                                        {reportSubmitting ? t('submitting') : t('submit_report')}
                                    </button>
                                    <button onClick={() => setShowForm(false)} className="px-4 py-2 text-xs text-[var(--text-secondary)] border border-[var(--hairline)] hover:text-white transition-colors">{t('cancel')}</button>
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="glass-panel hairline-border p-5 flex items-center gap-3">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[var(--text-secondary)] flex-shrink-0"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>
                        <p className="text-sm text-[var(--text-secondary)]">
                            {t('login_to_submit')}{' '}
                            <a href={`/api/auth/signin?callbackUrl=/${locale}/about`} className="text-[var(--vermilion)] hover:underline">{t('login')}</a>
                        </p>
                    </div>
                )}
            </section>

            {/* ══ 4. DEVELOPER (last) ═════════════════════════════════════════════ */}
            <section>
                <SectionHeader action={
                    isAdmin && !editingFounder ? (
                        <button
                            onClick={() => {
                                setFounderForm({
                                    contact_email: founder?.contact_email ?? '',
                                    social_x: founder?.social_x ?? '',
                                    social_instagram: founder?.social_instagram ?? '',
                                    social_facebook: founder?.social_facebook ?? '',
                                    social_discord: founder?.social_discord ?? '',
                                    about_title: founder?.about_title ?? '',
                                });
                                setEditingFounder(true);
                            }}
                            className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)] hover:text-white border border-[var(--hairline)] px-3 py-1.5 transition-colors hover:border-[var(--hairline-strong)] flex-shrink-0"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
                            {t('edit')}
                        </button>
                    ) : undefined
                }>{t('founder_section')}</SectionHeader>

                {editingFounder ? (
                    /* ── Admin edit form — full width ── */
                    <div className="glass-panel hairline-border p-6 md:p-8">
                        <div className="flex flex-col gap-4">
                            <div>
                                <label className="text-[10px] text-[var(--text-secondary)] mb-1 block">{t('founder_title_label')}</label>
                                <input className={inputCls} placeholder={t('founder_title_placeholder')} value={founderForm.about_title} onChange={e => setFounderForm(f => ({ ...f, about_title: e.target.value }))} />
                            </div>
                            <p className="text-xs text-[var(--text-secondary)] -mb-1">Social links — fill to show icon, leave empty to hide.</p>
                            {[
                                { key: 'contact_email', label: 'Email', icon: <EmailIcon />, placeholder: 'your@email.com' },
                                { key: 'social_x', label: 'X / Twitter', icon: <XIcon />, placeholder: 'https://x.com/yourhandle' },
                                { key: 'social_instagram', label: 'Instagram', icon: <InstagramIcon />, placeholder: 'https://instagram.com/yourhandle' },
                                { key: 'social_facebook', label: 'Facebook', icon: <FacebookIcon />, placeholder: 'https://facebook.com/yourhandle' },
                                { key: 'social_discord', label: 'Discord', icon: <DiscordIcon />, placeholder: 'https://discord.gg/yourserver' },
                            ].map(({ key, label, icon, placeholder }) => (
                                <div key={key} className="flex items-center gap-3">
                                    <div className="w-6 flex-shrink-0 text-[var(--text-secondary)] flex items-center justify-center">{icon}</div>
                                    <div className="flex-1">
                                        <label className="text-[10px] text-[var(--text-secondary)] mb-1 block">{label}</label>
                                        <input className={inputCls} placeholder={placeholder} value={founderForm[key as keyof typeof founderForm]} onChange={e => setFounderForm(f => ({ ...f, [key]: e.target.value }))} />
                                    </div>
                                </div>
                            ))}
                            <div className="flex gap-2 mt-2">
                                <button onClick={handleFounderSave} disabled={founderSaving} className="px-4 py-1.5 text-xs font-bold bg-[var(--vermilion)] text-white disabled:opacity-50 hover:opacity-90 transition-opacity">{founderSaving ? t('submitting') : t('save')}</button>
                                <button onClick={() => setEditingFounder(false)} className="px-4 py-1.5 text-xs text-[var(--text-secondary)] border border-[var(--hairline)] hover:text-white transition-colors">{t('cancel')}</button>
                            </div>
                        </div>
                    </div>
                ) : (
                    /* ── Display mode: founder left, contributors right on desktop ── */
                    <div className="flex flex-col md:flex-row gap-6 items-start">
                        {/* Left: founder card */}
                        <div className="glass-panel hairline-border p-6 md:flex-1 min-w-0 w-full">
                            <div className="flex flex-col gap-4">
                                <div className="flex items-center gap-5">
                                    {founder?.picture_url ? (
                                        <img src={founder.picture_url} alt={founder.name ?? ''} className="w-16 h-16 rounded-full object-cover ring-2 ring-[var(--hairline-strong)] flex-shrink-0" />
                                    ) : (
                                        <div className="w-16 h-16 rounded-full bg-[var(--hairline)] flex items-center justify-center flex-shrink-0">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-[var(--text-secondary)]"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                                        </div>
                                    )}
                                    <div>
                                        <div className="text-xs text-[var(--text-secondary)] tracking-wider mb-0.5">{founder?.about_title ?? 'Founder & developer'}</div>
                                        <div className="text-xl font-bold text-white">{founder?.name ?? 'VocaRank Team'}</div>
                                    </div>
                                </div>
                                {(founder?.contact_email || founder?.social_x || founder?.social_instagram || founder?.social_facebook || founder?.social_discord) && (
                                    <div className="flex flex-wrap gap-4">
                                        {founder.contact_email && (
                                            <a href={`mailto:${founder.contact_email}`} title={founder.contact_email} className="text-[var(--text-secondary)] hover:text-white transition-colors flex items-center gap-1.5 text-xs"><EmailIcon /> Email</a>
                                        )}
                                        {founder.social_x && (
                                            <a href={founder.social_x} target="_blank" rel="noopener noreferrer" className="text-[var(--text-secondary)] hover:text-white transition-colors flex items-center gap-1.5 text-xs"><XIcon /> X / Twitter</a>
                                        )}
                                        {founder.social_instagram && (
                                            <a href={founder.social_instagram} target="_blank" rel="noopener noreferrer" className="text-[var(--text-secondary)] hover:text-white transition-colors flex items-center gap-1.5 text-xs"><InstagramIcon /> Instagram</a>
                                        )}
                                        {founder.social_facebook && (
                                            <a href={founder.social_facebook} target="_blank" rel="noopener noreferrer" className="text-[var(--text-secondary)] hover:text-white transition-colors flex items-center gap-1.5 text-xs"><FacebookIcon /> Facebook</a>
                                        )}
                                        {founder.social_discord && (
                                            <a href={founder.social_discord} target="_blank" rel="noopener noreferrer" className="text-[var(--text-secondary)] hover:text-white transition-colors flex items-center gap-1.5 text-xs"><DiscordIcon /> Discord</a>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Right: contributors */}
                        {(contributors.length > 0 || isAdmin) && (
                            <div className="md:flex-1 min-w-0 w-full flex flex-col gap-3">
                                {isAdmin && !contribForm && (
                                    <button onClick={() => { setEditingContrib(null); setContribError(null); setContribForm({ user_id: '', role: '' }); }} className="self-start flex items-center gap-1.5 text-xs text-[var(--text-secondary)] hover:text-white border border-[var(--hairline)] px-3 py-1.5 transition-colors hover:border-[var(--hairline-strong)]">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                                        {t('add_contributor')}
                                    </button>
                                )}
                                {isAdmin && contribForm && !editingContrib && (
                                    <div className="glass-panel hairline-border p-4 flex flex-col gap-3">
                                        <div className="flex flex-col gap-3">
                                            <div className="flex flex-col gap-1">
                                                <label className="text-[10px] text-[var(--text-secondary)]">{t('contributor_user_id_label')}</label>
                                                <input type="number" min="1" className={inputCls} placeholder={t('contributor_user_id_placeholder')} value={contribForm.user_id} onChange={e => setContribForm(f => f && ({ ...f, user_id: e.target.value }))} />
                                            </div>
                                            <div className="flex flex-col gap-1">
                                                <label className="text-[10px] text-[var(--text-secondary)]">Role</label>
                                                <input className={inputCls} placeholder={t('contributor_role_placeholder')} value={contribForm.role} onChange={e => setContribForm(f => f && ({ ...f, role: e.target.value }))} />
                                            </div>
                                        </div>
                                        {contribError && <p className="text-xs text-red-400">{contribError}</p>}
                                        <div className="flex gap-2">
                                            <button onClick={handleContribSave} disabled={contribSaving || !contribForm.user_id.trim()} className="px-4 py-1.5 text-xs font-bold bg-[var(--vermilion)] text-white disabled:opacity-50 hover:opacity-90 transition-opacity">{contribSaving ? t('submitting') : t('save')}</button>
                                            <button onClick={() => { setContribForm(null); setContribError(null); }} className="px-4 py-1.5 text-xs text-[var(--text-secondary)] border border-[var(--hairline)] hover:text-white transition-colors">{t('cancel')}</button>
                                        </div>
                                    </div>
                                )}
                                <div className="flex flex-wrap gap-3">
                                    {contributors.map(c => (
                                        <div key={c.id} className="glass-panel hairline-border px-4 py-3 flex items-center gap-3 group/contrib">
                                            {isAdmin && editingContrib?.id === c.id && contribForm ? (
                                                <div className="flex flex-col gap-2 min-w-[200px]">
                                                    <div className="text-xs text-[var(--text-secondary)]">User #{c.user_id} — {c.name}</div>
                                                    <input className={inputCls} placeholder={t('contributor_role_placeholder')} value={contribForm.role} onChange={e => setContribForm(f => f && ({ ...f, role: e.target.value }))} />
                                                    {contribError && <p className="text-[10px] text-red-400">{contribError}</p>}
                                                    <div className="flex gap-2">
                                                        <button onClick={handleContribSave} disabled={contribSaving} className="px-3 py-1 text-[10px] font-bold bg-[var(--vermilion)] text-white disabled:opacity-50">{contribSaving ? t('submitting') : t('save')}</button>
                                                        <button onClick={() => { setContribForm(null); setEditingContrib(null); setContribError(null); }} className="px-3 py-1 text-[10px] text-[var(--text-secondary)] border border-[var(--hairline)]">{t('cancel')}</button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <>
                                                    {c.picture_url ? (
                                                        <img src={c.picture_url} alt={c.name ?? ''} className="w-9 h-9 rounded-full object-cover ring-1 ring-[var(--hairline)] flex-shrink-0" />
                                                    ) : (
                                                        <div className="w-9 h-9 rounded-full bg-[var(--hairline)] flex items-center justify-center flex-shrink-0 text-xs font-bold text-[var(--text-secondary)]">
                                                            {(c.name ?? '?').charAt(0).toUpperCase()}
                                                        </div>
                                                    )}
                                                    <div className="min-w-0">
                                                        <div className="text-sm font-semibold text-white truncate">{c.name ?? `User #${c.user_id}`}</div>
                                                        {c.role && <div className="text-[11px] text-[var(--text-secondary)] truncate">{c.role}</div>}
                                                    </div>
                                                    {isAdmin && (
                                                        <div className="flex gap-2 ml-2 opacity-0 group-hover/contrib:opacity-100 transition-opacity flex-shrink-0">
                                                            <button onClick={() => { setEditingContrib(c); setContribError(null); setContribForm({ user_id: String(c.user_id), role: c.role ?? '' }); }} className="text-[10px] text-[var(--text-secondary)] hover:text-white transition-colors">{t('edit')}</button>
                                                            <button onClick={() => handleContribDelete(c.id)} className="text-[10px] text-red-400 hover:text-red-300 transition-colors">{t('delete')}</button>
                                                        </div>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </section>
        </>
    );
}
