'use client';

import { useEffect, useRef, useState } from 'react';

interface Props {
    value: number;
    suffix: string;
    duration?: number; // ms
}

function easeOutCubic(t: number) {
    return 1 - Math.pow(1 - t, 3);
}

export default function StatNumber({ value, suffix, duration = 1600 }: Props) {
    const [display, setDisplay] = useState(0);
    const ref = useRef<HTMLSpanElement>(null);
    const started = useRef(false);

    useEffect(() => {
        // Use IntersectionObserver so animation fires when element enters viewport
        const el = ref.current;
        if (!el) return;

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting && !started.current) {
                    started.current = true;
                    const start = performance.now();
                    const tick = (now: number) => {
                        const elapsed = now - start;
                        const progress = Math.min(elapsed / duration, 1);
                        const eased = easeOutCubic(progress);
                        setDisplay(Math.round(eased * value));
                        if (progress < 1) requestAnimationFrame(tick);
                    };
                    requestAnimationFrame(tick);
                }
            },
            { threshold: 0.1 }
        );

        observer.observe(el);
        return () => observer.disconnect();
    }, [value, duration]);

    return (
        <span ref={ref} dir="auto" className="inline-flex items-center">
            <bdi>{new Intl.NumberFormat('en-US').format(display)}</bdi>
            <span className="mx-1"></span>
            <bdi>{suffix}</bdi>
        </span>
    );
}
