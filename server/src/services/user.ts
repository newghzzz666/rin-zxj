import { eq } from "drizzle-orm";
import Elysia, { t } from "elysia";
import { URL } from "url";
import type { DB } from "../_worker";
import { users } from "../db/schema";
import { setup } from "../setup";
import { getDB } from "../utils/di";

// Define a specific type for the GitHub user profile to improve type safety.
interface GitHubUser {
    id: string;
    name: string | null;
    login: string;
    avatar_url: string;
}

// Use a constant for the provider name to avoid magic strings.
const GITHUB_PROVIDER = "GitHub";

export function UserService() {
    const db: DB = getDB();
    return new Elysia({ aot: false })
        .use(setup())
        .group('/user', (group) =>
            group
                .get("/github", ({ oauth2, headers: { referer }, cookie: { redirect_to } }) => {
                    if (!referer) {
                        return 'Referer not found';
                    }
                    const referer_url = new URL(referer);
                    redirect_to.value = `${referer_url.protocol}//${referer_url.host}`;
                    return oauth2.redirect(GITHUB_PROVIDER, { scopes: ["read:user"] });
                })
                .get("/github/callback", async ({ jwt, oauth2, set, store, query, cookie: { token, redirect_to } }) => {
                    const gh_token = await oauth2.authorize(GITHUB_PROVIDER);
                    const response = await fetch("https://api.github.com/user", {
                        headers: {
                            Authorization: `Bearer ${gh_token.accessToken}`,
                            Accept: "application/json",
                            "User-Agent": "elysia"
                        },
                    });

                    if (!response.ok) {
                        throw new Error('Failed to fetch user from GitHub');
                    }

                    const user = await response.json() as GitHubUser;

                    const profile = {
                        openid: user.id,
                        username: user.name || user.login,
                        avatar: user.avatar_url,
                        permission: 0
                    };

                    const existingUser = await db.query.users.findFirst({ where: eq(users.openid, profile.openid) });

                    let userId: number;

                    if (existingUser) {
                        profile.permission = existingUser.permission;
                        await db.update(users).set(profile).where(eq(users.id, existingUser.id));
                        userId = existingUser.id;
                    } else {
                        // If no user exists, grant admin permission to the first user.
                        if (!await store.anyUser(db)) {
                             const realTimeCheck = (await db.query.users.findMany({ limit: 1 }))?.length > 0;
                             if (!realTimeCheck) {
                                profile.permission = 1;
                                // Update cache to reflect that a user now exists.
                                store.anyUser = async (_: DB) => true;
                             }
                        }
                        const result = await db.insert(users).values(profile).returning({ insertedId: users.id });
                        if (!result || result.length === 0) {
                            throw new Error('Failed to register user');
                        }
                        userId = result[0].insertedId;
                    }

                    token.set({
                        value: await jwt.sign({ id: userId }),
                        expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
                        path: '/',
                    });

                    const redirect_host = redirect_to.value || "";
                    const redirect_url = `${redirect_host}/callback?token=${token.value}`;

                    set.headers = { 'Content-Type': 'text/html' };
                    set.redirect = redirect_url;

                }, {
                    query: t.Object({
                        state: t.String(),
                        code: t.String(),
                    })
                })
                .get('/profile', async ({ set, uid }) => {
                    if (!uid) {
                        set.status = 403;
                        return 'Permission denied';
                    }
                    const uid_num = parseInt(uid, 10);
                    if (isNaN(uid_num)) {
                        set.status = 400;
                        return 'Invalid user ID';
                    }
                    const user = await db.query.users.findFirst({ where: eq(users.id, uid_num) });
                    if (!user) {
                        set.status = 404;
                        return 'User not found';
                    }
                    return {
                        id: user.id,
                        username: user.username,
                        avatar: user.avatar,
                        permission: user.permission === 1,
                        createdAt: user.createdAt,
                        updatedAt: user.updatedAt,
                    };
                })
        )
}
