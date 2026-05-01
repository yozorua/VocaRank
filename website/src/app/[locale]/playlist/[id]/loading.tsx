export default function PlaylistDetailLoading() {
    return (
        <div className="min-h-screen">
            <div className="max-w-[var(--max-width)] mx-auto px-6 md:px-12 py-8 flex flex-col gap-8">

                {/* Hero row */}
                <div className="flex flex-col md:flex-row gap-8 items-start">
                    {/* Cover */}
                    <div className="w-44 h-44 shrink-0 bg-[var(--hairline)] animate-pulse" />

                    {/* Meta */}
                    <div className="flex flex-col gap-3 flex-1 min-w-0 pt-1">
                        <div className="h-8 w-64 bg-[var(--hairline)] animate-pulse" />
                        <div className="h-4 w-48 bg-[var(--hairline)] animate-pulse" />
                        <div className="h-3 w-32 bg-[var(--hairline)] animate-pulse" />
                        <div className="flex items-center gap-2 mt-1">
                            <div className="h-9 w-28 bg-[var(--hairline)] animate-pulse" />
                            <div className="h-9 w-24 bg-[var(--hairline)] animate-pulse" />
                            <div className="h-9 w-16 bg-[var(--hairline)] animate-pulse" />
                        </div>
                    </div>
                </div>

                {/* Song list skeleton */}
                <div className="glass-panel hairline-border overflow-hidden">
                    {Array.from({ length: 12 }).map((_, i) => (
                        <div
                            key={i}
                            className="flex items-center gap-4 px-4 py-3 border-b border-[var(--hairline)] last:border-0"
                        >
                            <div className="w-5 text-right shrink-0">
                                <div className="h-3 w-4 bg-[var(--hairline)] animate-pulse ml-auto" />
                            </div>
                            <div className="w-10 h-10 shrink-0 bg-[var(--hairline)] animate-pulse" />
                            <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                                <div
                                    className="h-3.5 bg-[var(--hairline)] animate-pulse"
                                    style={{ width: `${55 + (i * 17) % 35}%` }}
                                />
                                <div
                                    className="h-3 bg-[var(--hairline)] animate-pulse"
                                    style={{ width: `${30 + (i * 13) % 25}%` }}
                                />
                            </div>
                        </div>
                    ))}
                </div>

            </div>
        </div>
    );
}
