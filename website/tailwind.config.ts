import type { Config } from "tailwindcss";

const config: Config = {
    content: [
        "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
        "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
        "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    ],
    theme: {
        extend: {
            colors: {
                background: "var(--bg-dark)",
                foreground: "var(--text-primary)",
                'miku-teal': 'var(--cyan-subtle)', // repurposing old variables for backwards compatibility
                'miku-pink': 'var(--vermilion)',   // repurposing old variables
                vermilion: 'var(--vermilion)',
                gold: 'var(--gold)',
                'cyan-subtle': 'var(--cyan-subtle)',
            },
        },
    },
    plugins: [],
};
export default config;
