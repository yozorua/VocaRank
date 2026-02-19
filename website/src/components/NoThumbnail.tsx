export default function NoThumbnail({ className = "" }: { className?: string }) {
    return (
        <div className={`w-full h-full flex flex-col items-center justify-center bg-[#1a1a1a] text-gray-600 ${className}`}>
            <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-1/3 h-1/3 mb-1 opacity-50"
            >
                <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
                <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
                <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
                <line x1="2" y1="22" x2="22" y2="2"></line>
            </svg>
            <span className="text-[10px] uppercase font-bold tracking-wider opacity-60">No Video</span>
        </div>
    );
}
