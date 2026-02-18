'use client';

import { useEffect, useRef } from 'react';

interface SongPlayerProps {
    youtubeId?: string | null;
    niconicoId?: string | null;
}

export default function SongPlayer({ youtubeId, niconicoId }: SongPlayerProps) {
    const nicoRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!youtubeId && niconicoId && nicoRef.current) {
            // Use 'srcDoc' (Double Iframe) technique to hide 'localhost' origin from Niconico.
            // Niconico blocks localhost in the 'parent' parameter. By nesting it in a srcDoc iframe,
            // the parent becomes 'about:srcdoc' (opaque origin), bypassing the check.
            const iframe = document.createElement('iframe');

            const htmlContent = `
                <!DOCTYPE html>
                <html>
                <head>
                    <style>body{margin:0;padding:0;overflow:hidden;background:black;display:flex;align-items:center;justify-content:center;height:100vh;}</style>
                </head>
                <body>
                    <iframe 
                        src="https://embed.nicovideo.jp/watch/${niconicoId}?jsapi=1" 
                        width="100%" 
                        height="100%" 
                        frameborder="0" 
                        allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
                        style="border:none;width:100%;height:100%;"
                    ></iframe>
                </body>
                </html>
            `;

            iframe.srcdoc = htmlContent;
            iframe.width = "100%";
            iframe.height = "100%";
            iframe.title = "Niconico Video";
            iframe.style.border = "none";

            nicoRef.current.innerHTML = ''; // Clear previous
            nicoRef.current.appendChild(iframe);

            // Add noscript fallback
            const noscript = document.createElement('noscript');
            noscript.innerHTML = `<a href="https://www.nicovideo.jp/watch/${niconicoId}">Watch on Niconico</a>`;
            nicoRef.current.appendChild(noscript);
        }
    }, [youtubeId, niconicoId]);

    if (!youtubeId && !niconicoId) return null;

    return (
        <div className="w-full aspect-video bg-black rounded-xl overflow-hidden shadow-2xl mb-8 flex items-center justify-center">
            {youtubeId ? (
                <iframe
                    width="100%"
                    height="100%"
                    src={`https://www.youtube.com/embed/${youtubeId}?autoplay=0`}
                    title="YouTube video player"
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                ></iframe>
            ) : (
                <div className="w-full h-full flex items-center justify-center overflow-hidden bg-black relative">
                    {/* Niconico Embed Container */}
                    <div ref={nicoRef} className="nico-embed-container" />
                </div>
            )}
        </div>
    );
}
