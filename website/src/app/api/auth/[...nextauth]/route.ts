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
        async jwt({ token, account, trigger, session }) {
            // Handle active session updates (e.g. from the Profile Page)
            if (trigger === "update" && session) {
                if (session.name) token.name = session.name;
                if (session.email) token.email = session.email;
                if (session.picture) token.picture = session.picture;
            }

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
                        token.apiToken = data.access_token;

                        // Fetch the actual VocaRank profile to override Google's stale cache on sign-in
                        const profileRes = await fetch(`${baseUrl}/auth/me`, {
                            headers: { 'Authorization': `Bearer ${token.apiToken}` }
                        });
                        if (profileRes.ok) {
                            const profileData = await profileRes.json();
                            if (profileData.name) token.name = profileData.name;
                            if (profileData.picture_url) token.picture = profileData.picture_url;
                        }

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
            // Bind VocaRank customizations
            if (token.name && session.user) session.user.name = token.name;
            if (token.picture && session.user) session.user.image = token.picture as string;

            return session;
        },
    },
    secret: process.env.AUTH_SECRET,
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
