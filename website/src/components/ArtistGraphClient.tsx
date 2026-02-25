'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { API_BASE_URL } from '@/lib/api';
import { useRouter } from '@/i18n/navigation';
import { forceCollide } from 'd3-force';


interface Props {
    apiEndpoint?: string;
}

export default function ArtistGraphClient({ apiEndpoint = '/artists/graph' }: Props) {
    const [graphData, setGraphData] = useState({ nodes: [], links: [] });
    const [loading, setLoading] = useState(true);
    const containerRef = useRef<HTMLDivElement>(null);
    const graphInstanceRef = useRef<any>(null);
    const [isGraphLoaded, setIsGraphLoaded] = useState(false);
    const [renderTrigger, setRenderTrigger] = useState(0);
    const imgCache = useRef<Record<string, HTMLImageElement>>({});
    const t = useTranslations('GraphPage');

    const [hoverNode, setHoverNode] = useState<any>(null);
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    // CRITICAL UX FIX: The "Bloom" Animation
    // If we spawn 1000 nodes using their massive 'views' radii, the D3 physics engine immediately traps them 
    // in an inescapable overlapped tangle. However, if we spawn them using the tiny 'pagerank' radii, they perfectly 
    // and instantly untangle. 
    // We default to 'pagerank', let the graph breathe and spread out, and then smoothly 
    // transition to 'views' 1.5 seconds later. This creates a gorgeous "swelling" bloom effect on load and guarantees zero overlap!
    const [sizeMode, setSizeMode] = useState<'views' | 'pagerank' | 'uniform'>('pagerank');

    // Render Options State
    const [searchText, setSearchText] = useState("");
    const [showLabels, setShowLabels] = useState(true);
    const [showLines, setShowLines] = useState(true);
    const [freezePhysics, setFreezePhysics] = useState(false);

    // PERFORMANCE OPTIMIZATION: Pre-calculate O(1) Lookups
    // Checking all 3,000 links inside `nodeCanvasObject` for all 1,000 nodes at 60 frames per second
    // results in ~180,000,000 array iterations per second, which completely drains smartphone batteries!
    // We precalculate neighbor links and search matches into O(1) Sets to eliminate render loop math.
    const [linkedNodes, setLinkedNodes] = useState<Map<string, Set<string>>>(new Map());
    const [matchedSearchIds, setMatchedSearchIds] = useState<Set<string>>(new Set());

    // Build Hover Neighbor Cache precisely once
    useEffect(() => {
        if (graphData.nodes.length > 0) {
            const map = new Map<string, Set<string>>();
            graphData.nodes.forEach((n: any) => map.set(n.id, new Set()));
            graphData.links.forEach((l: any) => {
                const sourceId = typeof l.source === 'object' ? l.source.id : l.source;
                const targetId = typeof l.target === 'object' ? l.target.id : l.target;
                map.get(sourceId)?.add(targetId);
                map.get(targetId)?.add(sourceId);
            });
            setLinkedNodes(map);
        }
    }, [graphData]);

    // Build Text Search Cache when input changes
    useEffect(() => {
        if (searchText.trim().length > 0) {
            const lowerSearch = searchText.toLowerCase();
            const matches = new Set<string>();
            graphData.nodes.forEach((n: any) => {
                if (n.name && n.name.toLowerCase().includes(lowerSearch)) {
                    matches.add(n.id);
                }
            });
            setMatchedSearchIds(matches);
        } else {
            setMatchedSearchIds(new Set());
        }
    }, [searchText, graphData]);

    useEffect(() => {
        const fetchGraph = async () => {
            try {
                // Fetch the network graph data we compiled in the API
                const res = await fetch(`${API_BASE_URL}${apiEndpoint}`);
                if (res.ok) {
                    const data = await res.json();

                    // CRITICAL FIX: D3 force naturally spawns all 1000 new nodes at exactly (0,0).
                    // This creates an infinitely dense singularity point. `collide` force cannot un-stack 1000 
                    // massive 'Views' nodes in only 300 ticks because they literally have to travel thousands of pixels 
                    // to escape each other. By pre-scattering them in a wide circle BEFORE initialization, 
                    // the D3 physics engine only has to do local snap adjustments, perfectly resolving overlaps instantly!
                    if (data.nodes) {
                        data.nodes.forEach((node: any) => {
                            const spawnRadius = Math.random() * 1500;
                            const spawnAngle = Math.random() * 2 * Math.PI;
                            // Set initial explicit position coordinates so ForceGraph uses them as anchors
                            node.x = Math.cos(spawnAngle) * spawnRadius;
                            node.y = Math.sin(spawnAngle) * spawnRadius;
                        });
                    }

                    setGraphData(data);
                }
            } catch (e) {
                console.error("Failed to load graph data", e);
            } finally {
                setLoading(false);
            }
        };

        fetchGraph();
    }, []);

    // Trigger the Bloom Effect 1.5 seconds after the graph data is fully loaded and mounted
    useEffect(() => {
        if (graphData.nodes.length > 0) {
            const timer = setTimeout(() => {
                setSizeMode('views');
            }, 1000); // 1 second gives the pagerank graph enough time to effectively distance the nodes
            return () => clearTimeout(timer);
        }
    }, [graphData]);

    const handleNodeClick = useCallback((node: any) => {
        // Navigate to the artist's profile in a new tab to avoid losing graph state
        const locale = window.location.pathname.split('/')[1] || 'en';
        window.open(`/${locale}/artist/${node.id}`, '_blank');
    }, []);

    // Initialize vanilla force-graph
    useEffect(() => {
        if (!containerRef.current || graphInstanceRef.current) return;

        let mounted = true;
        let ro: ResizeObserver | null = null;

        import('force-graph').then((module) => {
            if (!mounted || !containerRef.current) return;
            const ForceGraph = module.default || module;

            // Force container initial explicit dimensions immediately so Canvas avoids 0x0
            const rect = containerRef.current.getBoundingClientRect();

            // @ts-ignore
            const fg = ForceGraph()(containerRef.current)
                .width(rect.width > 0 ? rect.width : 800)
                .height(rect.height > 0 ? rect.height : 600)
                .backgroundColor("transparent")
                .linkWidth(1.5)
                .nodeLabel(() => "")
                .warmupTicks(0)
                .onEngineStop(() => {
                    if (graphInstanceRef.current && mounted) {
                        graphInstanceRef.current.zoomToFit(400);
                    }
                });

            if (!mounted) {
                // Destroy it immediately if component unmounted while downloading
                fg._destructor();
                return;
            }

            graphInstanceRef.current = fg;
            setIsGraphLoaded(true);

            ro = new ResizeObserver((entries) => {
                if (!entries || !entries.length || !mounted) return;
                const { width, height } = entries[0].contentRect;
                if (width > 0 && height > 0 && graphInstanceRef.current) {
                    graphInstanceRef.current.width(width).height(height);
                }
            });
            ro.observe(containerRef.current!);

            if (graphData.nodes.length > 0) {
                fg.graphData(graphData);
            }
        }).catch(err => {
            console.error("Failed to load force-graph dynamically:", err);
        });

        return () => {
            mounted = false;
            if (ro) ro.disconnect();
            if (graphInstanceRef.current) {
                try {
                    graphInstanceRef.current._destructor();
                } catch (e) { }
                graphInstanceRef.current = null;
            }
        };
    }, []);

    // Push graphData when it loads
    useEffect(() => {
        if (graphInstanceRef.current && isGraphLoaded && graphData.nodes.length > 0) {
            graphInstanceRef.current.graphData(graphData);
        }
    }, [graphData, isGraphLoaded]);

    // Push visuals when state changes
    useEffect(() => {
        const fg = graphInstanceRef.current;
        if (!fg || !isGraphLoaded) return;

        fg.enableNodeDrag(!freezePhysics)
            .cooldownTicks(freezePhysics ? 0 : 300)
            .linkVisibility(showLines)
            .onNodeClick(handleNodeClick)
            .onNodeHover(setHoverNode);

        fg.nodeVal((node: any) => {
            let score = 1;
            if (sizeMode === 'views') score = node.val_views || 1;
            else if (sizeMode === 'pagerank') score = node.val_pagerank || 1;

            let r = 15;
            if (sizeMode === 'views') r = Math.cbrt(Math.max(0, score)) * 0.04 + 2;
            else if (sizeMode === 'pagerank') r = Math.sqrt(Math.max(0, score)) * 1.5 + 8;
            else if (sizeMode === 'uniform') r = 15;

            const padding = sizeMode === 'views' ? 8 : 5;
            return Math.pow((r + padding) / 4, 2);
        });

        fg.linkColor((link: any) => {
            const weight = link.value || 1;
            const isConnected = hoverNode && (link.source === hoverNode || link.target === hoverNode ||
                link.source?.id === hoverNode?.id || link.target?.id === hoverNode?.id);

            if (hoverNode && isConnected) {
                const opacity = Math.min(1, 0.2 + (Math.log(weight + 1) * 0.15));
                return `rgba(232, 170, 0, ${opacity})`;
            }
            if (hoverNode && !isConnected) {
                return 'rgba(255,255,255,0.02)';
            }

            const baseOpacity = Math.min(0.6, 0.05 + (Math.log(weight) * 0.05));
            return `rgba(255,255,255,${baseOpacity})`;
        });

        fg.nodePointerAreaPaint((node: any, color: any, ctx: any) => {
            let score = 1;
            if (sizeMode === 'views') score = node.val_views || 1;
            else if (sizeMode === 'pagerank') score = node.val_pagerank || 1;

            let r = 15;
            if (sizeMode === 'views') r = Math.cbrt(Math.max(0, score)) * 0.04 + 2;
            else if (sizeMode === 'pagerank') r = Math.sqrt(Math.max(0, score)) * 1.5 + 8;
            else if (sizeMode === 'uniform') r = 15;

            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(node.x, node.y, r + 2, 0, 2 * Math.PI, false);
            ctx.fill();
        });

        fg.nodeCanvasObject((node: any, ctx: any, globalScale: number) => {
            const label = node.name;
            const fontSize = 12 / globalScale;

            let score = 1;
            if (sizeMode === 'views') score = node.val_views || 1;
            else if (sizeMode === 'pagerank') score = node.val_pagerank || 1;

            let r = 15;
            if (sizeMode === 'views') r = Math.cbrt(Math.max(0, score)) * 0.04 + 2;
            else if (sizeMode === 'pagerank') r = Math.sqrt(Math.max(0, score)) * 1.5 + 8;
            else if (sizeMode === 'uniform') r = 15;

            const isSearching = searchText.trim().length > 0;
            const isMatch = isSearching && matchedSearchIds.has(node.id);
            const isHovered = hoverNode === node;
            const isHoverLinked = hoverNode && (
                hoverNode.id === node.id ||
                linkedNodes.get(hoverNode.id)?.has(node.id)
            );

            let alpha = 1.0;
            if (hoverNode) {
                alpha = isHoverLinked ? 1.0 : (isSearching ? 0.05 : 0.2);
            } else if (isSearching) {
                alpha = isMatch ? 1.0 : 0.15;
            }
            ctx.globalAlpha = alpha;

            let imageDrawn = false;
            if (node.img) {
                let img = imgCache.current[node.id];
                if (!img) {
                    img = new Image();
                    img.src = node.img;
                    img.onload = () => setRenderTrigger(prev => prev + 1);
                    imgCache.current[node.id] = img;
                }

                if (img.complete && img.naturalHeight !== 0 && img.naturalWidth !== 0) {
                    ctx.save();
                    ctx.beginPath();
                    ctx.arc(node.x, node.y, r, 0, 2 * Math.PI, false);

                    ctx.fillStyle = '#111111';
                    ctx.fill();

                    ctx.clip();

                    const sourceSize = Math.min(img.naturalWidth, img.naturalHeight);
                    const sx = (img.naturalWidth - sourceSize) / 2;
                    const sy = 0;

                    ctx.drawImage(img, sx, sy, sourceSize, sourceSize, node.x - r, node.y - r, r * 2, r * 2);
                    ctx.restore();

                    ctx.beginPath();
                    ctx.arc(node.x, node.y, r, 0, 2 * Math.PI, false);
                    if (isSearching && !isMatch) {
                        ctx.strokeStyle = 'rgba(100, 100, 100, 0.15)';
                        ctx.lineWidth = 1 / globalScale;
                    } else if (isMatch || isHovered) {
                        ctx.strokeStyle = 'white';
                        ctx.lineWidth = (isHovered ? 4 : 6) / globalScale;
                        ctx.shadowColor = '#FF5722';
                        ctx.shadowBlur = 10 / globalScale;
                    } else {
                        ctx.strokeStyle = node.color || '#cccccc';
                        ctx.lineWidth = 1.5 / globalScale;
                    }
                    ctx.stroke();
                    ctx.shadowBlur = 0;

                    imageDrawn = true;
                }
            }

            if (!imageDrawn) {
                ctx.beginPath();
                ctx.arc(node.x, node.y, r, 0, 2 * Math.PI, false);

                if (isSearching && !isMatch) {
                    ctx.fillStyle = 'rgba(100, 100, 100, 0.15)';
                } else if (isMatch || isHovered) {
                    ctx.fillStyle = '#FF5722';
                } else {
                    ctx.fillStyle = node.color || '#cccccc';
                }
                ctx.fill();
            }

            if (showLabels && ((globalScale > 2 && !isSearching) || isMatch || isHovered)) {
                ctx.globalAlpha = 1.0;
                ctx.font = (isMatch || isHovered) ? `bold ${fontSize * 1.5}px Sans-Serif` : `${fontSize}px Sans-Serif`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillStyle = isSearching && !isMatch && !isHovered ? 'rgba(255,255,255,0.1)' : 'white';

                if (isMatch || isHovered) {
                    const textWidth = ctx.measureText(label).width;
                    ctx.fillStyle = 'rgba(0,0,0,0.6)';
                    ctx.fillRect(node.x - textWidth / 2 - 2, node.y + r + fontSize / 2, textWidth + 4, fontSize * 1.5 + 4);
                    ctx.fillStyle = 'white';
                }

                ctx.fillText(label, node.x, node.y + r + fontSize + 2);
            }

            ctx.globalAlpha = 1.0;
        });

    }, [isGraphLoaded, sizeMode, searchText, showLabels, showLines, freezePhysics, hoverNode, linkedNodes, matchedSearchIds, handleNodeClick, renderTrigger]);

    // Update Graph Physics when sizeMode or data changes to prevent overlap
    useEffect(() => {
        if (graphInstanceRef.current && isGraphLoaded && graphData.nodes.length > 0) {

            const applyForces = () => {
                const fg = graphInstanceRef.current;
                if (!fg) return;

                // Apply standard repulsion
                const chargeForce = fg.d3Force('charge');
                if (chargeForce) {
                    // Significantly increase negative repulsion for 'views' to spread out the crowded center
                    const repulsion = sizeMode === 'views' ? -1200 : (sizeMode === 'pagerank' ? -250 : -100);
                    chargeForce.strength(repulsion);
                    chargeForce.distanceMax(1500);
                }

                // Dynamically loosen the Node Link spring physics!
                const linkForce = fg.d3Force('link');
                if (linkForce) {
                    linkForce.distance((link: any) => {
                        const getRadius = (node: any) => {
                            let score = 1;
                            if (sizeMode === 'views') score = node.val_views || 1;
                            else if (sizeMode === 'pagerank') score = node.val_pagerank || 1;

                            let r = 15;
                            if (sizeMode === 'views') r = Math.cbrt(Math.max(0, score)) * 0.04 + 2;
                            else if (sizeMode === 'pagerank') r = Math.sqrt(Math.max(0, score)) * 1.5 + 8;
                            else if (sizeMode === 'uniform') r = 15;
                            return r;
                        };
                        const r1 = getRadius(link.source);
                        const r2 = getRadius(link.target);
                        const padding = sizeMode === 'views' ? 16 : 10;
                        return r1 + r2 + padding + 15;
                    });
                }

                // Apply strict anti-collision physics so bubbles bounce off each other.
                fg.d3Force('collide', forceCollide().radius((node: any) => {
                    let score = 1;
                    if (sizeMode === 'views') score = node.val_views || 1;
                    else if (sizeMode === 'pagerank') score = node.val_pagerank || 1;

                    let r = 15;
                    if (sizeMode === 'views') r = Math.cbrt(Math.max(0, score)) * 0.04 + 2;
                    else if (sizeMode === 'pagerank') r = Math.sqrt(Math.max(0, score)) * 1.5 + 8;
                    else if (sizeMode === 'uniform') r = 15;

                    const padding = sizeMode === 'views' ? 12 : 6;
                    return r + padding;
                }).strength(1.5).iterations(8));

                // Re-ignite the simulation so bubbles have kinetic energy to spread out
                fg.d3ReheatSimulation();
            };

            // Re-inject physics over the first 1.5 seconds to survive ForceGraph's asynchronous internal reboot
            let ticks = 0;
            const intervalId = setInterval(() => {
                applyForces();
                ticks++;
                if (ticks > 15) {
                    clearInterval(intervalId);
                }
            }, 100);

            applyForces();

            return () => clearInterval(intervalId);
        }
    }, [isGraphLoaded, graphData, sizeMode]);

    return (
        <div className="relative w-full h-[calc(100vh-var(--header-height))]">

            {/* Loading & Empty State Overlays */}
            {loading && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-[var(--text-secondary)] z-20 bg-[var(--bg-dark)]/[0.8] backdrop-blur-sm">
                    <div className="w-8 h-8 border-4 border-[var(--vermilion)] border-t-transparent rounded-full animate-spin"></div>
                    <span>{t('loading') || 'LOADING...'}</span>
                </div>
            )}

            {!loading && (!graphData || !graphData.nodes || graphData.nodes.length === 0) && (
                <div className="absolute inset-0 flex items-center justify-center text-[var(--text-secondary)] z-20 bg-[var(--bg-dark)]">
                    <p>No graph data available.</p>
                </div>
            )}

            {/* Floating Control Panel Menu */}
            <div className="absolute top-4 left-4 z-10 flex flex-col gap-2">
                {/* Mobile/Collapsed Toggle Button */}
                <button
                    onClick={() => setIsMenuOpen(!isMenuOpen)}
                    className={`bg-[var(--bg-dark)]/80 backdrop-blur-md border border-[var(--hairline)] p-2 rounded-lg shadow-xl text-white hover:text-[var(--miku-teal)] transition-all w-10 h-10 flex items-center justify-center ${!freezePhysics && !isMenuOpen ? 'animate-pulse shadow-[0_0_15px_rgba(255,87,34,0.4)] border-[var(--vermilion)]' : ''}`}
                >
                    {isMenuOpen ? (
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="3"></circle>
                            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.26.6.8.99 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                        </svg>
                    )}
                </button>

                {/* Expanded Menu */}
                {isMenuOpen && (
                    <div className="bg-[var(--bg-dark)]/80 backdrop-blur-md border border-[var(--hairline)] p-4 rounded-lg flex flex-col gap-4 shadow-xl w-64 animate-in fade-in slide-in-from-top-4">
                        <div>
                            <label className="block text-xs text-[var(--text-secondary)] mb-1 font-bold">{t('search')}</label>
                            <input
                                type="text"
                                value={searchText}
                                onChange={(e) => setSearchText(e.target.value)}
                                placeholder={t('search_placeholder')}
                                className="w-full bg-black/50 border border-[var(--hairline)] rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[var(--miku-teal)] transition-colors"
                            />
                        </div>

                        <div>
                            <label className="block text-xs text-[var(--text-secondary)] mb-1 font-bold">{t('node_size_weight')}</label>
                            <select
                                value={sizeMode}
                                onChange={(e) => setSizeMode(e.target.value as any)}
                                className="w-full bg-black/50 border border-[var(--hairline)] rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[var(--miku-teal)]"
                            >
                                <option value="uniform">{t('weight_uniform')}</option>
                                <option value="views">{t('weight_views')}</option>
                                <option value="pagerank">{t('weight_pagerank')}</option>
                            </select>
                        </div>

                        <div className="flex items-center gap-2 pt-1 border-t border-[var(--border-color)] group">
                            <label className="relative flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={showLabels}
                                    onChange={(e) => setShowLabels(e.target.checked)}
                                    className="sr-only peer"
                                />
                                <div className="w-4 h-4 rounded border border-[var(--hairline-strong)] bg-black/30 flex items-center justify-center peer-checked:bg-[var(--miku-teal)] peer-checked:border-[var(--miku-teal)] transition-colors">
                                    <svg className="w-3 h-3 text-black opacity-0 peer-checked:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                    </svg>
                                </div>
                            </label>
                            <span className="text-sm text-white cursor-pointer select-none group-hover:text-[var(--miku-teal)] transition-colors" onClick={() => setShowLabels(!showLabels)}>{t('show_labels')}</span>
                        </div>
                        <div className="flex items-center gap-2 pt-1 border-t border-[var(--border-color)] group">
                            <label className="relative flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={!showLines}
                                    onChange={(e) => setShowLines(!e.target.checked)}
                                    className="sr-only peer"
                                />
                                <div className="w-4 h-4 rounded border border-[var(--hairline-strong)] bg-black/30 flex items-center justify-center peer-checked:bg-[var(--miku-teal)] peer-checked:border-[var(--miku-teal)] transition-colors">
                                    <svg className="w-3 h-3 text-black opacity-0 peer-checked:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                    </svg>
                                </div>
                            </label>
                            <span className="text-sm text-white cursor-pointer select-none group-hover:text-[var(--miku-teal)] transition-colors" onClick={() => setShowLines(!showLines)}>{t('hide_lines')}</span>
                        </div>
                        <div className={`flex items-center gap-2 pt-1 border-t border-[var(--border-color)] group transition-all duration-500 rounded p-1 -mx-1 ${!freezePhysics ? 'bg-[rgba(255,87,34,0.15)] shadow-[0_0_10px_rgba(255,87,34,0.2)] animate-pulse' : ''}`}>
                            <label className="relative flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={freezePhysics}
                                    onChange={(e) => setFreezePhysics(e.target.checked)}
                                    className="sr-only peer"
                                />
                                <div className={`w-4 h-4 rounded border bg-black/30 flex items-center justify-center transition-colors ${!freezePhysics ? 'border-[var(--vermilion)]' : 'border-[var(--hairline-strong)] peer-checked:bg-[var(--vermilion)] peer-checked:border-[var(--vermilion)]'}`}>
                                    <svg className="w-3 h-3 text-black opacity-0 peer-checked:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                    </svg>
                                </div>
                            </label>
                            <span className={`text-sm cursor-pointer select-none transition-colors ${!freezePhysics ? 'text-[var(--vermilion)] font-bold' : 'text-white group-hover:text-[var(--vermilion)]'}`} onClick={() => setFreezePhysics(!freezePhysics)}>
                                {t('freeze_physics', { defaultMessage: 'Lock Map (Save Battery)' })}
                            </span>
                        </div>
                    </div>
                )}
            </div>

            <div className="w-full h-full animate-in fade-in duration-1000 overflow-hidden outline-none">
                <div ref={containerRef} className="w-full h-full outline-none" />
            </div>
        </div>
    );
}