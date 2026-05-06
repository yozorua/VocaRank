'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useTranslations, useLocale } from 'next-intl';
import { updateSongIntroduction, updateArtistIntroduction } from '@/lib/api';

interface EditorInfo {
    id: number;
    name: string | null;
    picture_url: string | null;
}

interface Props {
    entityType: 'song' | 'artist';
    entityId: number;
    initialIntroZh: string | null;
    initialIntroEn: string | null;
    initialIntroJa: string | null;
    initialEditor?: EditorInfo | null;
    initialUpdatedAt?: string | null;
}

const MAX_CHARS = 5000;

async function myMemoryTranslate(text: string, targetLang: 'en' | 'ja'): Promise<string> {
    const res = await fetch(
        `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=zh-TW%7C${targetLang}`
    );
    const data = await res.json();
    return data.responseData?.translatedText ?? '';
}

export default function IntroductionSection({
    entityType, entityId, initialIntroZh, initialIntroEn, initialIntroJa,
    initialEditor, initialUpdatedAt
}: Props) {
    const { data: session } = useSession();
    const locale = useLocale();
    const t = useTranslations('Introduction');

    const [introZh, setIntroZh] = useState(initialIntroZh ?? '');
    const [introEn, setIntroEn] = useState(initialIntroEn ?? '');
    const [introJa, setIntroJa] = useState(initialIntroJa ?? '');
    const [editor, setEditor] = useState<EditorInfo | null>(initialEditor ?? null);
    const [updatedAt, setUpdatedAt] = useState<string | null>(initialUpdatedAt ?? null);

    const [open, setOpen] = useState(false);
    const [draftZh, setDraftZh] = useState('');
    const [draftEn, setDraftEn] = useState('');
    const [draftJa, setDraftJa] = useState('');
    const [saving, setSaving] = useState(false);
    const [translatingEn, setTranslatingEn] = useState(false);
    const [translatingJa, setTranslatingJa] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const isEditor = (session as any)?.isEditor || (session as any)?.isAdmin;

    const displayIntro =
        locale === 'ja' ? (introJa || introZh) :
        locale === 'zh-TW' ? introZh :
        (introEn || introZh);

    const hasAnyIntro = !!(introZh || introEn || introJa);

    if (!hasAnyIntro && !isEditor) return null;

    const openModal = () => {
        setDraftZh(introZh);
        setDraftEn(introEn);
        setDraftJa(introJa);
        setError(null);
        setOpen(true);
    };

    const handleAutoTranslate = async (lang: 'en' | 'ja') => {
        if (!draftZh.trim()) return;
        if (lang === 'en') {
            setTranslatingEn(true);
            try { setDraftEn(await myMemoryTranslate(draftZh, 'en')); }
            catch { /* ignore */ }
            finally { setTranslatingEn(false); }
        } else {
            setTranslatingJa(true);
            try { setDraftJa(await myMemoryTranslate(draftZh, 'ja')); }
            catch { /* ignore */ }
            finally { setTranslatingJa(false); }
        }
    };

    const handleSave = async () => {
        setSaving(true);
        setError(null);
        const body = {
            introduction: draftZh || null,
            introduction_en: draftEn || null,
            introduction_ja: draftJa || null,
        };
        try {
            const fn = entityType === 'song' ? updateSongIntroduction : updateArtistIntroduction;
            await fn(entityId, body);
            setIntroZh(draftZh);
            setIntroEn(draftEn);
            setIntroJa(draftJa);
            if (session?.user) {
                setEditor({
                    id: (session as any).userId,
                    name: session.user.name ?? null,
                    picture_url: session.user.image ?? null,
                });
            }
            setUpdatedAt(new Date().toISOString());
            setOpen(false);
        } catch {
            setError('Failed to save. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    const formatDate = (iso: string) => {
        const d = new Date(iso);
        return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
    };

    return (
        <>
            <div className="my-8">
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl md:text-2xl font-black tracking-wider text-gray-300">{t('title')}</h2>
                    {isEditor && (
                        <button
                            onClick={openModal}
                            className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)] hover:text-white transition-colors px-2 py-1 rounded-md hover:bg-white/10"
                            title={hasAnyIntro ? t('edit') : t('add')}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                            </svg>
                            {hasAnyIntro ? t('edit') : t('add')}
                        </button>
                    )}
                </div>

                {/* Content */}
                {displayIntro ? (
                    <p className="text-[#d4d4d4] text-base leading-relaxed whitespace-pre-wrap mb-4">
                        {displayIntro}
                    </p>
                ) : (
                    isEditor && (
                        <p className="text-[var(--text-secondary)] text-base italic opacity-50 mb-4">
                            {t('placeholder')}
                        </p>
                    )
                )}

                {/* Editor attribution */}
                {(editor || updatedAt) && (
                    <div className="flex items-center gap-2">
                        {editor?.picture_url ? (
                            <img
                                src={editor.picture_url}
                                alt={editor.name ?? ''}
                                className="w-6 h-6 rounded-full object-cover opacity-70"
                            />
                        ) : (
                            <div className="w-6 h-6 rounded-full bg-[var(--hairline)] flex items-center justify-center text-[10px] text-[var(--text-secondary)]">
                                {editor?.name?.charAt(0) ?? '?'}
                            </div>
                        )}
                        <span className="text-xs text-[var(--text-secondary)] opacity-70">
                            {editor?.name ?? ''}
                            {updatedAt && (
                                <span className="ml-1.5 font-mono opacity-60">{formatDate(updatedAt)}</span>
                            )}
                        </span>
                    </div>
                )}
            </div>

            {/* Editor Modal */}
            {open && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div
                        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
                        onClick={() => setOpen(false)}
                    />
                    <div className="relative glass-panel rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                        <h2 className="text-base font-bold text-gray-300 mb-5">
                            {hasAnyIntro ? t('edit') : t('add')}
                        </h2>

                        {/* zh-TW field */}
                        <div className="mb-4">
                            <div className="flex items-center justify-between mb-1.5">
                                <label className="text-xs font-semibold text-[var(--text-secondary)] tracking-wide">
                                    {t('label_zh')}
                                </label>
                                <span className="text-[10px] font-mono text-[var(--text-secondary)] opacity-60">
                                    {draftZh.length}/{MAX_CHARS}
                                </span>
                            </div>
                            <textarea
                                value={draftZh}
                                onChange={e => setDraftZh(e.target.value.slice(0, MAX_CHARS))}
                                className="w-full bg-transparent border border-[var(--hairline)] rounded-lg p-3 text-sm resize-y min-h-[120px] focus:border-[var(--vermilion)] focus:outline-none text-white placeholder:text-gray-600"
                                placeholder={t('placeholder')}
                            />
                        </div>

                        {/* en field */}
                        <div className="mb-4">
                            <div className="flex items-center justify-between mb-1.5">
                                <div className="flex items-center gap-3">
                                    <label className="text-xs font-semibold text-[var(--text-secondary)] tracking-wide">
                                        {t('label_en')}
                                    </label>
                                    <button
                                        type="button"
                                        onClick={() => handleAutoTranslate('en')}
                                        disabled={translatingEn || !draftZh.trim()}
                                        className="text-[10px] text-[var(--vermilion)] hover:underline disabled:opacity-40 disabled:cursor-not-allowed"
                                    >
                                        {translatingEn ? t('translating') : t('auto_translate')}
                                    </button>
                                </div>
                                <span className="text-[10px] font-mono text-[var(--text-secondary)] opacity-60">
                                    {draftEn.length}/{MAX_CHARS}
                                </span>
                            </div>
                            <textarea
                                value={draftEn}
                                onChange={e => setDraftEn(e.target.value.slice(0, MAX_CHARS))}
                                className="w-full bg-transparent border border-[var(--hairline)] rounded-lg p-3 text-sm resize-y min-h-[120px] focus:border-[var(--vermilion)] focus:outline-none text-white placeholder:text-gray-600"
                                placeholder={t('placeholder')}
                            />
                        </div>

                        {/* ja field */}
                        <div className="mb-5">
                            <div className="flex items-center justify-between mb-1.5">
                                <div className="flex items-center gap-3">
                                    <label className="text-xs font-semibold text-[var(--text-secondary)] tracking-wide">
                                        {t('label_ja')}
                                    </label>
                                    <button
                                        type="button"
                                        onClick={() => handleAutoTranslate('ja')}
                                        disabled={translatingJa || !draftZh.trim()}
                                        className="text-[10px] text-[var(--vermilion)] hover:underline disabled:opacity-40 disabled:cursor-not-allowed"
                                    >
                                        {translatingJa ? t('translating') : t('auto_translate')}
                                    </button>
                                </div>
                                <span className="text-[10px] font-mono text-[var(--text-secondary)] opacity-60">
                                    {draftJa.length}/{MAX_CHARS}
                                </span>
                            </div>
                            <textarea
                                value={draftJa}
                                onChange={e => setDraftJa(e.target.value.slice(0, MAX_CHARS))}
                                className="w-full bg-transparent border border-[var(--hairline)] rounded-lg p-3 text-sm resize-y min-h-[120px] focus:border-[var(--vermilion)] focus:outline-none text-white placeholder:text-gray-600"
                                placeholder={t('placeholder')}
                            />
                        </div>

                        {error && (
                            <p className="text-red-400 text-xs mb-4">{error}</p>
                        )}

                        {/* Actions */}
                        <div className="flex justify-end gap-3">
                            <button
                                type="button"
                                onClick={() => setOpen(false)}
                                disabled={saving}
                                className="px-4 py-2 rounded-lg text-sm text-[var(--text-secondary)] hover:text-white transition-colors disabled:opacity-40"
                            >
                                {t('cancel')}
                            </button>
                            <button
                                type="button"
                                onClick={handleSave}
                                disabled={saving}
                                className="px-4 py-2 rounded-lg text-sm bg-[var(--vermilion)] text-white hover:opacity-90 transition-opacity disabled:opacity-40"
                            >
                                {saving ? '...' : t('save')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
