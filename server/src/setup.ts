import { cors } from "@elysiajs/cors";
import { eq } from "drizzle-orm";
import Elysia, { t } from "elysia";
import { oauth2 } from "elysia-oauth2";
import type { DB } from "./_worker";
import type { Env } from "./db/db";
import { users } from "./db/schema";
import { getDB, getEnv } from "./utils/di";
import jwt from "./utils/jwt";

const anyUser = async (db: DB) => (await db.query.users.findFirst()) !== undefined;

export function setup() {
    const db: DB = getDB();
    const env: Env = getEnv();
    const gh_client_id = env.RIN_GITHUB_CLIENT_ID || env.GITHUB_CLIENT_ID;
    const gh_client_secret = env.RIN_GITHUB_CLIENT_SECRET || env.GITHUB_CLIENT_SECRET;
    const jwt_secret = env.JWT_SECRET;

    if (!gh_client_id || !gh_client_secret) {
        throw new Error('GitHub OAuth credentials are not configured. Please set RIN_GITHUB_CLIENT_ID and RIN_GITHUB_CLIENT_SECRET');
    }
    if (!jwt_secret) {
        throw new Error('JWT secret is not configured. Please set JWT_SECRET');
    }
    if (jwt_secret.length < 32) {
        console.warn("Warning: JWT_SECRET is less than 32 characters. It is strongly recommended to use a secret of at least 32 characters.");
    }

    const oauth = oauth2({
        GitHub: [gh_client_id, gh_client_secret],
    });

    return new Elysia({ aot: false, name: 'setup' })
        .state('anyUser', anyUser)
        .use(cors()) // Basic CORS setup, refine as needed
        .use(oauth)
        .use(
            jwt({
                aot: false,
                name: 'jwt',
                secret: jwt_secret,
                schema: t.Object({
                    id: t.Integer(),
                })
            })
        )
        .derive({ as: 'global' }, async ({ headers, jwt }) => {
            const authorization = headers['authorization'];
            if (!authorization || !authorization.startsWith('Bearer ')) {
                return {};
            }

            const token = authorization.substring(7);
            const profile = await jwt.verify(token);

            if (!profile) {
                // Consider logging failed verification attempts
                return {};
            }

            const user = await db.query.users.findFirst({ where: eq(users.id, profile.id) });

            if (!user) {
                // Consider logging attempts with valid tokens but no user
                return {};
            }

            return {
                uid: user.id,
                username: user.username,
                admin: user.permission === 1,
            };
        });
}
