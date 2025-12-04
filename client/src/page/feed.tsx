import { useContext, useEffect, useRef, useState } from "react";
import { Helmet } from "react-helmet";
import { useTranslation } from "react-i18next";
import ReactModal from "react-modal";
import { Link, useLocation } from "wouter";
import { useAlert, useConfirm } from "../components/dialog";
import { HashTag } from "../components/hashtag";
import { Waiting } from "../components/loading";
import { Markdown } from "../components/markdown";
import { client } from "../main";
import { ClientConfigContext } from "../state/config";
import { ProfileContext } from "../state/profile";
import { headersWithAuth } from "../utils/auth";
import { siteName } from "../utils/constants";
import { timeago } from "../utils/timeago";
import { Button } from "../components/button";
import { Tips } from "../components/tips";
import mermaid from "mermaid";
import { AdjacentSection } from "../components/adjacent_feed.tsx";
import { Comments } from "../components/comment.tsx";

type Feed = {
    id: number;
    title: string | null;
    content: string;
    uid: number;
    createdAt: Date;
    updatedAt: Date;
    top: number;
    hashtags: { id: number; name: string; }[];
    user: { avatar: string | null; id: number; username: string; };
    pv: number;
    uv: number;
};

export function FeedPage({ id, TOC, clean }: { id: string, TOC: () => JSX.Element, clean: (id: string) => void }) {
    const { t } = useTranslation();
    const profile = useContext(ProfileContext);
    const [feed, setFeed] = useState<Feed>();
    const [error, setError] = useState<string>();
    const [headImage, setHeadImage] = useState<string>();
    const ref = useRef("");
    const [, setLocation] = useLocation();
    const { showAlert, AlertUI } = useAlert();
    const { showConfirm, ConfirmUI } = useConfirm();
    const [top, setTop] = useState<number>(0);
    const config = useContext(ClientConfigContext);
    const counterEnabled = config.get<boolean>('counter.enabled');

    const deleteFeed = () => {
        showConfirm(t("article.delete.title"), t("article.delete.confirm"), async () => {
            if (!feed) return;
            const { error } = await client.feed({ id: feed.id }).delete(null, { headers: headersWithAuth() });
            if (error) {
                showAlert(error.value as string);
            } else {
                showAlert(t("delete.success"));
                setLocation("/");
            }
        });
    };

    const topFeed = () => {
        const isUnTop = !(top > 0);
        const topNew = isUnTop ? 1 : 0;
        showConfirm(
            isUnTop ? t("article.top.title") : t("article.untop.title"),
            isUnTop ? t("article.top.confirm") : t("article.untop.confirm"),
            async () => {
                if (!feed) return;
                const { error } = await client.feed.top({ id: feed.id }).post({ top: topNew }, { headers: headersWithAuth() });
                if (error) {
                    showAlert(error.value as string);
                } else {
                    showAlert(isUnTop ? t("article.top.success") : t("article.untop.success"));
                    setTop(topNew);
                }
            }
        );
    };

    useEffect(() => {
        if (ref.current === id) return;
        ref.current = id;

        const fetchFeed = async () => {
            setFeed(undefined);
            setError(undefined);
            setHeadImage(undefined);

            const { data, error } = await client.feed({ id }).get({ headers: headersWithAuth() });

            if (error) {
                setError(error.value as string);
            } else if (data && typeof data !== "string") {
                const feedData = data as Feed;
                setFeed(feedData);
                setTop(feedData.top);

                const img_reg = /!\[.*?\]\((.*?)\)/;
                const img_match = img_reg.exec(feedData.content);
                if (img_match) {
                    setHeadImage(img_match[1]);
                }
                clean(id);
            }
        };

        fetchFeed();
    }, [id, clean]);

    useEffect(() => {
        if (!feed) return;

        const renderMermaid = async () => {
            try {
                mermaid.initialize({ startOnLoad: false, theme: 'default' });
                await mermaid.run({ suppressErrors: true, nodes: document.querySelectorAll('pre.mermaid_default') });

                mermaid.initialize({ startOnLoad: false, theme: 'dark' });
                await mermaid.run({ suppressErrors: true, nodes: document.querySelectorAll('pre.mermaid_dark') });
            } catch (error) {
                console.error("Mermaid rendering error:", error);
            }
        };

        renderMermaid();
    }, [feed]);

    return (
        <Waiting for={feed || error}>
            {feed && (
                <Helmet>
                    <title>{`${feed.title ?? "Unnamed"} - ${import.meta.env.VITE_NAME}`}</title>
                    <meta property="og:site_name" content={siteName} />
                    <meta property="og:title" content={feed.title ?? ""} />
                    <meta property="og:image" content={headImage ?? import.meta.env.VITE_AVATAR} />
                    <meta property="og:type" content="article" />
                    <meta property="og:url" content={document.URL} />
                    <meta name="og:description" content={feed.content.length > 200 ? feed.content.substring(0, 200) : feed.content} />
                    <meta name="author" content={feed.user.username} />
                    <meta name="keywords" content={feed.hashtags.map(({ name }) => name).join(", ")} />
                    <meta name="description" content={feed.content.length > 200 ? feed.content.substring(0, 200) : feed.content} />
                </Helmet>
            )}
            <div className="w-full flex flex-row justify-center ani-show">
                {error && (
                    <div className="flex flex-col w-auto rounded-2xl bg-w m-2 p-6 items-center justify-center space-y-2">
                        <h1 className="text-xl font-bold t-primary">{error}</h1>
                        {error === "Not found" && id === "about" && <Tips value={t("about.notfound")} />}
                        <Button title={t("index.back")} onClick={() => setLocation("/")} />
                    </div>
                )}
                {feed && !error && (
                    <>
                        <div className="xl:w-64" />
                        <main className="w-auto">
                            <article className="rounded-2xl bg-w m-2 px-6 py-4" aria-label={feed.title ?? "Unnamed"}>
                                <div className="flex justify-between">
                                    <div>
                                        <div className="mt-1 mb-1 flex gap-1">
                                            <p className="text-gray-400 text-[12px]" title={new Date(feed.createdAt).toLocaleString()}>
                                                {t("feed_card.published$time", { time: timeago(feed.createdAt) })}
                                            </p>
                                            {feed.createdAt !== feed.updatedAt && (
                                                <p className="text-gray-400 text-[12px]" title={new Date(feed.updatedAt).toLocaleString()}>
                                                    {t("feed_card.updated$time", { time: timeago(feed.updatedAt) })}
                                                </p>
                                            )}
                                        </div>
                                        {counterEnabled && <p className='text-[12px] text-gray-400 font-normal link-line'>
                                            <span> {t("count.pv")} </span>
                                            <span>{feed.pv}</span>
                                            <span> |</span>
                                            <span> {t("count.uv")} </span>
                                            <span>{feed.uv}</span>
                                        </p>}
                                        <div className="flex flex-row items-center">
                                            <h1 className="text-2xl font-bold t-primary break-all">{feed.title}</h1>
                                            <div className="flex-1 w-0" />
                                        </div>
                                    </div>
                                    <div className="pt-2">
                                        {profile?.permission && (
                                            <div className="flex gap-2">
                                                <button aria-label={top > 0 ? t("untop.title") : t("top.title")} onClick={topFeed} className={`flex-1 flex flex-col items-end justify-center px-2 py rounded-full transition ${top > 0 ? "bg-theme text-white hover:bg-theme-hover active:bg-theme-active" : "bg-secondary bg-button dark:text-neutral-400"}`}>
                                                    <i className="ri-skip-up-line" />
                                                </button>
                                                <Link aria-label={t("edit")} href={`/writing/${feed.id}`} className="flex-1 flex flex-col items-end justify-center px-2 py bg-secondary bg-button rounded-full transition">
                                                    <i className="ri-edit-2-line dark:text-neutral-400" />
                                                </Link>
                                                <button aria-label={t("delete.title")} onClick={deleteFeed} className="flex-1 flex flex-col items-end justify-center px-2 py bg-secondary bg-button rounded-full transition">
                                                    <i className="ri-delete-bin-7-line text-red-500" />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <Markdown content={feed.content} />
                                <div className="mt-6 flex flex-col gap-2">
                                    {feed.hashtags.length > 0 && (
                                        <div className="flex flex-row flex-wrap gap-x-2">
                                            {feed.hashtags.map(({ name }, index) => (<HashTag key={index} name={name} />))}
                                        </div>
                                    )}
                                    <div className="flex flex-row items-center">
                                        <img src={feed.user.avatar || "/avatar.png"} className="w-8 h-8 rounded-full" />
                                        <div className="ml-2">
                                            <span className="text-gray-400 text-sm cursor-default">{feed.user.username}</span>
                                        </div>
                                    </div>
                                </div>
                            </article>
                            <AdjacentSection id={id} setError={setError}/>
                            {feed && <Comments id={`${feed.id}`} />}
                            <div className="h-16" />
                        </main>
                        <div className="w-80 hidden lg:block relative">
                            <div className={`start-0 end-0 top-[5.5rem] sticky`}>
                                <TOC />
                            </div>
                        </div>
                    </>
                )}
            </div>
            <AlertUI />
            <ConfirmUI />
        </Waiting>
    );
}

export function TOCHeader({ TOC }: { TOC: () => JSX.Element }) {
    const [isOpened, setIsOpened] = useState(false);

    return (
        <div className="lg:hidden">
            <button onClick={() => setIsOpened(true)} className="w-10 h-10 rounded-full flex flex-row items-center justify-center">
                <i className="ri-menu-2-fill t-primary ri-lg"></i>
            </button>
            <ReactModal
                isOpen={isOpened}
                style={{
                    content: {
                        top: "50%",
                        left: "50%",
                        right: "auto",
                        bottom: "auto",
                        marginRight: "-50%",
                        transform: "translate(-50%, -50%)",
                        padding: "0",
                        border: "none",
                        borderRadius: "16px",
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "center",
                        alignItems: "center",
                        background: "none",
                    },
                    overlay: {
                        backgroundColor: "rgba(0, 0, 0, 0.5)",
                        zIndex: 1000,
                    },
                }}
                onRequestClose={() => setIsOpened(false)}
            >
                <div className="w-[80vw] sm:w-[60vw] lg:w-[40vw] overflow-clip relative t-primary">
                    <TOC />
                </div>
            </ReactModal>
        </div>
    );
}
