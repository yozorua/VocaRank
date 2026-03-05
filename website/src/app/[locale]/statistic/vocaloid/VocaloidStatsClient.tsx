'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { API_BASE_URL } from '@/lib/api';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, Legend, AreaChart, Area
} from 'recharts';
import { formatArtistType } from '@/lib/formatArtistType';

export default function VocaloidStatsClient() {
    const t = useTranslations('StatisticVocaloid');

    const [timeline, setTimeline] = useState<any[]>([]);
    const [engineTimeline, setEngineTimeline] = useState<any[]>([]);
    const [distribution, setDistribution] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [timeUnit, setTimeUnit] = useState<'year' | 'month'>('year');
    const [normalizeEngine, setNormalizeEngine] = useState(false);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const [timeRes, distRes, engineTimeRes] = await Promise.all([
                    fetch(`${API_BASE_URL}/statistics/vocaloids/over-time`),
                    fetch(`${API_BASE_URL}/statistics/vocaloids/distribution`),
                    fetch(`${API_BASE_URL}/statistics/vocaloids/engine-over-time`)
                ]);

                if (timeRes.ok && distRes.ok && engineTimeRes.ok) {
                    setTimeline(await timeRes.json());
                    // Strictly sort distribution by descending popularity so the Legend aligns perfectly with visual segments
                    const distData = await distRes.json();
                    distData.sort((a: any, b: any) => b.value - a.value);
                    setDistribution(distData);
                    setEngineTimeline(await engineTimeRes.json());
                }
            } catch (err) {
                console.error("Failed to fetch vocaloid stats", err);
            } finally {
                setLoading(false);
            }
        };

        fetchStats();
    }, []);

    const ENGINE_COLORS: Record<string, string> = {
        'Vocaloid': '#39C5BB',
        'UTAU': '#E84A5F',
        'SynthesizerV': '#10B981',
        'CeVIO': '#5680E9',
        'VoiSona': '#8884d8',
        'OtherVoiceSynthesizer': '#F9A826',
        'Neutrino': '#a78bfa'
    };

    // Aggregate monthly data into years if timeUnit is 'year'
    const aggregatedTimeline = useMemo(() => {
        if (timeUnit === 'month') return timeline;

        const map: Record<string, number> = {};
        timeline.forEach(item => {
            const year = item.date.substring(0, 4);
            map[year] = (map[year] || 0) + item.count;
        });

        return Object.entries(map).map(([date, count]) => ({ date, count })).sort((a, b) => a.date.localeCompare(b.date));
    }, [timeline, timeUnit]);

    const aggregatedEngineTimeline = useMemo(() => {
        if (timeUnit === 'month') return engineTimeline;

        const map: Record<string, any> = {};
        engineTimeline.forEach(item => {
            const year = item.date.substring(0, 4);
            if (!map[year]) {
                map[year] = { date: year, Vocaloid: 0, UTAU: 0, SynthesizerV: 0, CeVIO: 0, VoiSona: 0, OtherVoiceSynthesizer: 0, Neutrino: 0 };
            }
            Object.keys(ENGINE_COLORS).forEach(engine => {
                if (item[engine]) map[year][engine] += item[engine];
            });
        });

        return Object.values(map).sort((a, b) => a.date.localeCompare(b.date));
    }, [engineTimeline, timeUnit]);

    // Compute normalized (0–100%) version of engine timeline
    const normalizedEngineTimeline = useMemo(() => {
        return aggregatedEngineTimeline.map((row: any) => {
            const engines = Object.keys(ENGINE_COLORS);
            const total = engines.reduce((s, e) => s + (row[e] || 0), 0);
            if (total === 0) return row;
            const result: any = { date: row.date };
            engines.forEach(e => { result[e] = total > 0 ? +((row[e] || 0) / total * 100).toFixed(2) : 0; });
            return result;
        });
    }, [aggregatedEngineTimeline]);

    if (loading) {
        return (
            <div className="flex-1 flex items-center justify-center p-12">
                <div className="w-8 h-8 rounded-full border-4 border-[var(--hairline-strong)] border-t-[var(--vermilion)] animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-10">
            {/* Timeline Bar Chart */}
            <div className="bg-[var(--bg-dark)]/50 border border-[var(--hairline-strong)] p-6">
                <div className="flex items-center justify-between mb-6 border-b border-[var(--hairline)] pb-4">
                    <h2 className="text-base font-bold text-white border-l-2 border-[var(--vermilion)] pl-3">
                        {t('songs_over_time')}
                    </h2>
                    <div className="flex border border-[var(--hairline-strong)]">
                        <button
                            onClick={() => setTimeUnit('year')}
                            className={`px-3 py-1.5 text-xs font-bold transition-colors ${timeUnit === 'year' ? 'bg-[var(--vermilion)] text-white' : 'text-[var(--text-secondary)] hover:text-white'}`}
                        >
                            {t('switch_year')}
                        </button>
                        <button
                            onClick={() => setTimeUnit('month')}
                            className={`px-3 py-1.5 text-xs font-bold transition-colors border-l border-[var(--hairline-strong)] ${timeUnit === 'month' ? 'bg-[var(--vermilion)] text-white' : 'text-[var(--text-secondary)] hover:text-white'}`}
                        >
                            {t('switch_month')}
                        </button>
                    </div>
                </div>
                <div className="h-[400px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                            data={aggregatedTimeline}
                            margin={{ top: 10, right: 30, left: 0, bottom: 20 }}
                        >
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--hairline)" vertical={false} />
                            <XAxis
                                dataKey="date"
                                stroke="#888"
                                tick={{ fill: '#888', fontSize: 12 }}
                                tickMargin={10}
                                minTickGap={30}
                            />
                            <YAxis
                                stroke="#888"
                                tick={{ fill: '#888', fontSize: 12 }}
                            />
                            <Tooltip
                                cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                                contentStyle={{
                                    backgroundColor: 'var(--bg-dark)',
                                    borderColor: 'var(--hairline-strong)',
                                    borderRadius: 0,
                                    padding: '6px 10px',
                                    fontSize: '12px'
                                }}
                                itemStyle={{ color: '#fff', fontWeight: 'bold' }}
                                labelStyle={{ color: 'var(--text-secondary)', marginBottom: '2px' }}
                                formatter={(value: any) => [value, t('song_count')]}
                                labelFormatter={(label) => `${timeUnit === 'year' ? t('year') : t('month')}: ${label}`}
                            />
                            <Bar
                                dataKey="count"
                                fill="var(--vermilion)"
                                radius={0}
                                animationDuration={1500}
                                animationEasing="ease-out"
                            />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Stacked Engine Area Chart */}
            <div className="bg-[var(--bg-dark)]/50 border border-[var(--hairline-strong)] p-6">
                <div className="flex items-center justify-between mb-6 border-b border-[var(--hairline)] pb-4">
                    <h2 className="text-base font-bold text-white border-l-2 border-[#5680E9] pl-3">
                        {t('engine_over_time')}
                    </h2>
                    <div className="flex border border-[var(--hairline-strong)]">
                        <button
                            onClick={() => setNormalizeEngine(false)}
                            className={`px-3 py-1.5 text-xs font-bold transition-colors ${!normalizeEngine ? 'bg-[#5680E9] text-white' : 'text-[var(--text-secondary)] hover:text-white'}`}
                        >
                            {t('switch_count')}
                        </button>
                        <button
                            onClick={() => setNormalizeEngine(true)}
                            className={`px-3 py-1.5 text-xs font-bold transition-colors border-l border-[var(--hairline-strong)] ${normalizeEngine ? 'bg-[#5680E9] text-white' : 'text-[var(--text-secondary)] hover:text-white'}`}
                        >
                            {t('switch_percent')}
                        </button>
                    </div>
                </div>
                <div className="h-[450px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart
                            data={normalizeEngine ? normalizedEngineTimeline : aggregatedEngineTimeline}
                            margin={{ top: 10, right: 30, left: 0, bottom: 20 }}
                        >
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--hairline)" vertical={false} />
                            <XAxis
                                dataKey="date"
                                stroke="#888"
                                tick={{ fill: '#888', fontSize: 12 }}
                                tickMargin={10}
                                minTickGap={30}
                            />
                            <YAxis
                                stroke="#888"
                                tick={{ fill: '#888', fontSize: 12 }}
                                domain={normalizeEngine ? [0, 100] : ['auto', 'auto']}
                                tickFormatter={normalizeEngine ? (v: number) => `${Math.round(v)}%` : undefined}
                            />
                            <Tooltip
                                cursor={{ stroke: 'rgba(255,255,255,0.2)' }}
                                contentStyle={{
                                    backgroundColor: 'var(--bg-dark)',
                                    borderColor: 'var(--hairline-strong)',
                                    borderRadius: 0,
                                    padding: '6px 10px',
                                    fontSize: '12px'
                                }}
                                itemStyle={{ fontWeight: 'bold' }}
                                labelStyle={{ color: 'var(--text-secondary)', marginBottom: '2px' }}
                                formatter={(value: any, name: any) => [normalizeEngine ? `${value}%` : `${value} ${t('songs')}`, formatArtistType(name)]}
                                labelFormatter={(label) => `${timeUnit === 'year' ? t('year') : t('month')}: ${label}`}
                            />
                            <Legend verticalAlign="bottom" iconSize={8} wrapperStyle={{ paddingTop: '16px', display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '4px 8px', fontSize: 'clamp(11px, 1vw, 13px)' }} />
                            {Object.keys(ENGINE_COLORS).map(engine => (
                                <Area
                                    key={engine}
                                    type="monotone"
                                    dataKey={engine}
                                    stackId="1"
                                    stroke={ENGINE_COLORS[engine]}
                                    fill={ENGINE_COLORS[engine]}
                                    animationDuration={1500}
                                />
                            ))}
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Distribution Pie Chart */}
            <div className="bg-[var(--bg-dark)]/50 border border-[var(--hairline-strong)] p-6 mb-12">
                <h2 className="text-base font-bold mb-6 text-white border-l-2 border-[#39C5BB] pl-3">
                    {t('voicebank_distribution')}
                </h2>
                <div className="h-[400px] w-full flex justify-center">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={distribution}
                                cx="50%"
                                cy="50%"
                                innerRadius={80}
                                outerRadius={140}
                                paddingAngle={5}
                                dataKey="value"
                                animationDuration={1000}
                            >
                                {distribution.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={ENGINE_COLORS[entry.name] || '#00C49F'} />
                                ))}
                            </Pie>
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: 'var(--bg-dark)',
                                    borderColor: 'var(--hairline-strong)',
                                    borderRadius: 0,
                                    color: '#fff',
                                    padding: '6px 10px',
                                    fontSize: '12px'
                                }}
                                itemStyle={{ color: '#fff' }}
                                formatter={(value: any, name: any) => [`${value} ${t('songs')}`, formatArtistType(name)]}
                            />
                            <Legend
                                verticalAlign="bottom"
                                iconType="circle"
                                iconSize={8}
                                wrapperStyle={{ paddingTop: '16px', display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '4px 8px', fontSize: 'clamp(11px, 1vw, 13px)' }}
                                formatter={(value: any) => <span className="text-white ml-1">{formatArtistType(value)}</span>}
                            />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
}
