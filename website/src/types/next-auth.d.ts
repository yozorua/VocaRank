import "next-auth";

declare module "next-auth" {
    interface Session {
        apiToken?: string;
        userId?: number;
        isAdmin?: boolean;
    }
}

declare module "next-auth/jwt" {
    interface JWT {
        apiToken?: string;
        userId?: number;
        isAdmin?: boolean;
    }
}
