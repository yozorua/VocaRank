'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';
import { API_BASE_URL } from '@/lib/api';
import { useRouter } from '@/i18n/navigation';
import { forceCollide } from 'd3-force';

// Dynamically import react-force-graph-2d with ssr disabled because it relies on Canvas/Window
const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), { ssr: false });

export default function ArtistGraphClient() {
    const [graphData, setGraphData] = useState({ nodes: [], links: [] });
    const [loading, setLoading] = useState(true);
    const router = useRouter();
    const fgRef = useRef<any>(null);
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
                const res = await fetch(`${API_BASE_URL}/artists/graph`);
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

    // Update Graph Physics when sizeMode or data changes to prevent overlap
    useEffect(() => {
        if (fgRef.current && graphData.nodes.length > 0) {

            const applyForces = () => {
                if (!fgRef.current) return;

                // Apply standard repulsion
                const chargeForce = fgRef.current.d3Force('charge');
                if (chargeForce) {
                    // Significantly increase negative repulsion for 'views' to spread out the crowded center
                    const repulsion = sizeMode === 'views' ? -1200 : (sizeMode === 'pagerank' ? -250 : -100);
                    chargeForce.strength(repulsion);
                    chargeForce.distanceMax(1500);
                }

                // Dynamically loosen the Node Link spring physics!
                const linkForce = fgRef.current.d3Force('link');
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
                fgRef.current.d3Force('collide', forceCollide().radius((node: any) => {
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
                fgRef.current.d3ReheatSimulation();
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
    }, [graphData, sizeMode]);

    const handleNodeClick = useCallback((node: any) => {
        // Navigate to the artist's profile when they click a node
        router.push(`/artist/${node.id}`);
    }, [router]);

    if (loading) {
        return (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-[var(--text-secondary)] z-0 bg-[var(--bg-dark)]">
                <div className="w-8 h-8 border-2 border-[var(--hairline-strong)] border-t-[var(--text-secondary)] rounded-full animate-spin"></div>
                <p className="text-xs uppercase tracking-[0.2em] animate-pulse">{t('loading', { defaultMessage: 'Loading...' })}</p>
            </div>
        );
    }

    if (graphData.nodes.length === 0) {
        return (
            <div className="absolute inset-0 flex items-center justify-center text-[var(--text-secondary)] z-0 bg-[var(--bg-dark)]">
                <p>No graph data available.</p>
            </div>
        );
    }

    return (
        <div className="relative w-full h-[calc(100vh-var(--header-height))]">
            {/* Floating Control Panel Menu */}
            <div className="absolute top-4 left-4 z-10 flex flex-col gap-2">
                {/* Mobile/Collapsed Toggle Button */}
                <button
                    onClick={() => setIsMenuOpen(!isMenuOpen)}
                    className="bg-[var(--bg-dark)]/80 backdrop-blur-md border border-[var(--hairline)] p-2 rounded-lg shadow-xl text-white hover:text-[var(--miku-teal)] transition-colors w-10 h-10 flex items-center justify-center"
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

                        <div className="flex items-center gap-2 pt-1 border-t border-[var(--border-color)]">
                            <input
                                type="checkbox"
                                id="showLabels"
                                checked={showLabels}
                                onChange={(e) => setShowLabels(e.target.checked)}
                                className="accent-[var(--miku-teal)] w-4 h-4 cursor-pointer"
                            />
                            <label htmlFor="showLabels" className="text-sm text-white cursor-pointer select-none">{t('show_labels')}</label>
                        </div>
                        <div className="flex items-center gap-2 pt-1 border-t border-[var(--border-color)]">
                            <input
                                type="checkbox"
                                id="showLines"
                                checked={!showLines}
                                onChange={(e) => setShowLines(!e.target.checked)}
                                className="accent-[var(--miku-teal)] w-4 h-4 cursor-pointer"
                            />
                            <label htmlFor="showLines" className="text-sm text-white cursor-pointer select-none">{t('hide_lines')}</label>
                        </div>
                        <div className="flex items-center gap-2 pt-1 border-t border-[var(--border-color)]">
                            <input
                                type="checkbox"
                                id="freezePhysics"
                                checked={freezePhysics}
                                onChange={(e) => setFreezePhysics(e.target.checked)}
                                className="accent-[var(--vermilion)] w-4 h-4 cursor-pointer"
                            />
                            <label htmlFor="freezePhysics" className="text-sm text-white cursor-pointer select-none">{t('freeze_physics', { defaultMessage: 'Lock Map (Save Battery)' })}</label>
                        </div>
                    </div>
                )}
            </div>

            <div className="w-full h-full animate-in fade-in duration-1000">
                <ForceGraph2D
                    ref={fgRef}
                    graphData={graphData}
                    nodeAutoColorBy="group"
                    enableNodeDrag={!freezePhysics} // Freezing kills D3 engine reheating
                    cooldownTicks={freezePhysics ? 0 : 300} // Skip cooldown if frozen to drop CPU instantly
                    // Disable browser native tooltip since we draw labels ourselves on canvas
                    nodeLabel={() => ""}
                    // Feed custom math radius back into the D3 physics engine to prevent physical overlap
                    nodeVal={(node: any) => {
                        let score = 1;
                        if (sizeMode === 'views') score = node.val_views || 1;
                        else if (sizeMode === 'pagerank') score = node.val_pagerank || 1;

                        let r = 15;
                        if (sizeMode === 'views') r = Math.cbrt(Math.max(0, score)) * 0.04 + 2;
                        else if (sizeMode === 'pagerank') r = Math.sqrt(Math.max(0, score)) * 1.5 + 8;
                        else if (sizeMode === 'uniform') r = 15;

                        // ForceGraph automatically creates a d3Force collide using the Math.sqrt(nodeVal) * 4 to represent radius.
                        // However, we want strict anti-collision so we manually override the radius multiplier padding.
                        // Native formula: R = Math.sqrt(node.val) * 4
                        // padding = sizeMode === 'views' ? 8 : 5
                        const padding = sizeMode === 'views' ? 8 : 5;

                        // By returning the reverse-math equivalent of our visual radius PLUS padding,
                        // the native synchronous `d3Collide` handles the overlap before the first frame even paints.
                        return Math.pow((r + padding) / 4, 2);
                    }}
                    linkWidth={1.5}
                    nodeCanvasObject={(node: any, ctx, globalScale) => {
                        const label = node.name;
                        const fontSize = 12 / globalScale;

                        // Determine node size based on selected mode
                        let score = 1;
                        if (sizeMode === 'views') score = node.val_views || 1;
                        else if (sizeMode === 'pagerank') score = node.val_pagerank || 1;

                        // Calculate radius using cubic root for a graceful curve of extremely large view counts
                        let r = 15;
                        if (sizeMode === 'views') {
                            r = Math.cbrt(Math.max(0, score)) * 0.04 + 2;
                        } else if (sizeMode === 'pagerank') {
                            r = Math.sqrt(Math.max(0, score)) * 1.5 + 8;
                        } else if (sizeMode === 'uniform') {
                            r = 15;
                        }

                        // Search and Hover Highlight Logic
                        const isSearching = searchText.trim().length > 0;
                        const isMatch = isSearching && matchedSearchIds.has(node.id);
                        const isHovered = hoverNode === node;
                        const isHoverLinked = hoverNode && (
                            hoverNode.id === node.id ||
                            linkedNodes.get(hoverNode.id)?.has(node.id)
                        );

                        // Apply Global Alpha Dimming
                        let alpha = 1.0;
                        if (hoverNode) {
                            alpha = isHoverLinked ? 1.0 : (isSearching ? 0.05 : 0.2);
                        } else if (isSearching) {
                            alpha = isMatch ? 1.0 : 0.15;
                        }
                        ctx.globalAlpha = alpha;

                        // Draw Image if we have one
                        let imageDrawn = false;
                        if (node.img) {
                            let img = imgCache.current[node.id];
                            if (!img) {
                                img = new Image();
                                img.src = node.img;
                                imgCache.current[node.id] = img;
                            }

                            if (img.complete && img.naturalHeight !== 0) {
                                ctx.save();
                                // Create Circular clip path
                                ctx.beginPath();
                                ctx.arc(node.x, node.y, r, 0, 2 * Math.PI, false);
                                ctx.clip();

                                // Draw image filling the circle center
                                ctx.drawImage(img, node.x - r, node.y - r, r * 2, r * 2);
                                ctx.restore();

                                // Draw nice Border over the image
                                ctx.beginPath();
                                ctx.arc(node.x, node.y, r, 0, 2 * Math.PI, false);
                                if (isSearching && !isMatch) {
                                    ctx.strokeStyle = 'rgba(100, 100, 100, 0.15)';
                                    ctx.lineWidth = 1 / globalScale;
                                } else if (isMatch || isHovered) {
                                    ctx.strokeStyle = 'white';
                                    ctx.lineWidth = (isHovered ? 4 : 6) / globalScale;

                                    // Outer glow for vermilion highlighting
                                    ctx.shadowColor = 'var(--vermilion)';
                                    ctx.shadowBlur = 10 / globalScale;
                                } else {
                                    ctx.strokeStyle = node.color || 'var(--miku-teal)';
                                    ctx.lineWidth = 1.5 / globalScale;
                                }
                                ctx.stroke();
                                ctx.shadowBlur = 0; // Reset shadow

                                imageDrawn = true;
                            }
                        }

                        // Fallback to solid color circle if no image or image is still loading
                        if (!imageDrawn) {
                            ctx.beginPath();
                            ctx.arc(node.x, node.y, r, 0, 2 * Math.PI, false);

                            // Dim non-matching nodes if searching, pop hovered nodes
                            if (isSearching && !isMatch) {
                                ctx.fillStyle = 'rgba(100, 100, 100, 0.15)';
                            } else if (isMatch || isHovered) {
                                ctx.fillStyle = 'var(--vermilion)';
                                ctx.lineWidth = (isHovered ? 2 : 4) / globalScale;
                                ctx.strokeStyle = 'white';
                                ctx.stroke();
                            } else {
                                ctx.fillStyle = node.color || 'var(--miku-teal)';
                            }
                            ctx.fill();
                        }

                        // Draw Text Label
                        if (showLabels && ((globalScale > 2 && !isSearching) || isMatch || isHovered)) {
                            ctx.globalAlpha = 1.0; // Force full opacity for labels of highlighted nodes
                            ctx.font = (isMatch || isHovered) ? `bold ${fontSize * 1.5}px Sans-Serif` : `${fontSize}px Sans-Serif`;
                            ctx.textAlign = 'center';
                            ctx.textBaseline = 'middle';
                            ctx.fillStyle = isSearching && !isMatch && !isHovered ? 'rgba(255,255,255,0.1)' : 'white';

                            // Add slight background to text for readability when highlighted
                            if (isMatch || isHovered) {
                                const textWidth = ctx.measureText(label).width;
                                ctx.fillStyle = 'rgba(0,0,0,0.6)';
                                ctx.fillRect(node.x - textWidth / 2 - 2, node.y + r + fontSize / 2, textWidth + 4, fontSize * 1.5 + 4);
                                ctx.fillStyle = 'white';
                            }

                            ctx.fillText(label, node.x, node.y + r + fontSize + 2);
                        }

                        ctx.globalAlpha = 1.0; // Reset canvas context
                    }}
                    nodePointerAreaPaint={(node: any, color, ctx) => {
                        let score = 1;
                        if (sizeMode === 'views') score = node.val_views || 1;
                        else if (sizeMode === 'pagerank') score = node.val_pagerank || 1;

                        let r = 15;
                        if (sizeMode === 'views') {
                            r = Math.cbrt(Math.max(0, score)) * 0.04 + 2;
                        } else if (sizeMode === 'pagerank') {
                            r = Math.sqrt(Math.max(0, score)) * 1.5 + 8;
                        } else if (sizeMode === 'uniform') {
                            r = 15;
                        }

                        ctx.fillStyle = color;
                        ctx.beginPath();
                        ctx.arc(node.x, node.y, r + 2, 0, 2 * Math.PI, false); // +2 for easier clicking
                        ctx.fill();
                    }}
                    onNodeClick={handleNodeClick}
                    onNodeHover={setHoverNode}
                    backgroundColor="transparent"
                    linkVisibility={showLines}
                    linkColor={(link: any) => {
                        // Line width is uniform, but color opacity and brightness depends on connections
                        const weight = link.value || 1;
                        const isConnected = hoverNode && (link.source === hoverNode || link.target === hoverNode ||
                            link.source.id === hoverNode.id || link.target.id === hoverNode.id);

                        if (hoverNode && isConnected) {
                            // Math.min limits max opacity to 1. The more connections, the more opaque red.
                            const opacity = Math.min(1, 0.5 + (weight * 0.1));
                            return `rgba(255, 87, 34, ${opacity})`;
                        }
                        if (hoverNode && !isConnected) {
                            return 'rgba(255,255,255,0.02)'; // Fade out deeply
                        }

                        // Default state without hover
                        const baseOpacity = Math.min(0.6, 0.05 + (weight * 0.05));
                        return `rgba(255,255,255,${baseOpacity})`;
                    }}
                    warmupTicks={0}
                    onEngineStop={() => {
                        if (fgRef.current) fgRef.current.zoomToFit(400);
                    }}
                />
            </div>
        </div>
    );
}
