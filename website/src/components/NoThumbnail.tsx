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
                className="w-1/3 h-1/3 opacity-30"
            >
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                <circle cx="8.5" cy="8.5" r="1.5"></circle>
                <polyline points="21 15 16 10 5 21"></polyline>
            </svg>
        </div>
    );
}
