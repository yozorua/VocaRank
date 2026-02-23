import NextAuth, { AuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";

export const authOptions: AuthOptions = {
    providers: [
        GoogleProvider({
            clientId: process.env.AUTH_GOOGLE_ID as string,
            clientSecret: process.env.AUTH_GOOGLE_SECRET as string,
        }),
    ],
    session: {
        strategy: "jwt",
    },
    callbacks: {
        async jwt({ token, account }) {
            // When user first signs in, send Google token to our backend
            if (account && account.provider === "google" && account.id_token) {
                try {
                    // We need to use internal URL if fetching server-side
                    const baseUrl = process.env.API_URL_INTERNAL || 'http://localhost:8000';
                    const res = await fetch(`${baseUrl}/auth/google`, {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify({ id_token: account.id_token }),
                    });

                    if (res.ok) {
                        const data = await res.json();
                        // Store the VocaRank API token in the JWT token object
                        token.apiToken = data.access_token;
                    } else {
                        console.error("Backend auth failed:", await res.text());
                    }
                } catch (error) {
                    console.error("Fetch to backend failed during auth:", error);
                }
            }
            return token;
        },
        async session({ session, token }) {
            // Make the API token available to the client session
            if (token && token.apiToken) {
                session.apiToken = token.apiToken as string;
            }
            return session;
        },
    },
    secret: process.env.AUTH_SECRET,
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
