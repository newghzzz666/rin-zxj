import { memo, useContext, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import Popup from "reactjs-popup";
import { useAlert, useConfirm } from "./dialog";
import { client } from "../main";
import { ClientConfigContext } from "../state/config";
import { ProfileContext } from "../state/profile";
import { headersWithAuth } from "../utils/auth";
import { timeago } from "../utils/timeago";
import { useLoginModal } from "../hooks/useLoginModal";

// Type definitions for Comment
type Comment = {
    id: number;
    content: string;
    createdAt: Date;
    updatedAt: Date;
    user: {
        id: number;
        username: string;
        avatar: string | null;
        permission: number | null;
    };
};

// Component for inputting a new comment
function CommentInput({ id, onRefresh }: { id: string; onRefresh: () => void; }) {
    const { t } = useTranslation();
    const [content, setContent] = useState("");
    const [error, setError] = useState("");
    const { showAlert, AlertUI } = useAlert();
    const profile = useContext(ProfileContext);
    const { LoginModal, setIsOpened } = useLoginModal();

    function errorHumanize(error: string) {
        if (error === "Unauthorized") return t("login.required");
        if (error === "Content is required") return t("comment.empty");
        return error;
    }

    function submit() {
        if (!profile) {
            setIsOpened(true);
            return;
        }
        client.feed
            .comment({ feed: id })
            .post({ content }, { headers: headersWithAuth() })
            .then(({ error }) => {
                if (error) {
                    setError(errorHumanize(error.value as string));
                } else {
                    setContent("");
                    setError("");
                    showAlert(t("comment.success"), onRefresh);
                }
            });
    }

    return (
        <div className="w-full rounded-2xl bg-w t-primary p-6 items-end flex flex-col">
            <div className="flex flex-col w-full items-start mb-4">
                <label htmlFor="comment">{t("comment.title")}</label>
            </div>
            {profile ? (
                <>
                    <textarea
                        id="comment"
                        placeholder={t("comment.placeholder.title")}
                        className="bg-w w-full h-24 rounded-lg"
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                    />
                    <button
                        className="mt-4 bg-theme text-white px-4 py-2 rounded-full"
                        onClick={submit}
                    >
                        {t("comment.submit")}
                    </button>
                </>
            ) : (
                <div className="flex flex-row w-full items-center justify-center space-x-2 py-12">
                    <button
                        className="mt-2 bg-theme text-white px-4 py-2 rounded-full"
                        onClick={() => setIsOpened(true)}
                    >
                        {t("login.required")}
                    </button>
                </div>
            )}
            {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
            <AlertUI />
            <LoginModal />
        </div>
    );
}

// Memoized component for displaying a single comment
const CommentItem = memo(({ comment, onRefresh }: { comment: Comment; onRefresh: () => void; }) => {
    const { showConfirm, ConfirmUI } = useConfirm();
    const { showAlert, AlertUI } = useAlert();
    const { t } = useTranslation();
    const profile = useContext(ProfileContext);

    function deleteComment() {
        showConfirm(
            t("delete.comment.title"),
            t("delete.comment.confirm"),
            () => {
                client
                    .comment({ id: comment.id })
                    .delete(null, { headers: headersWithAuth() })
                    .then(({ error }) => {
                        if (error) {
                            showAlert(error.value as string);
                        } else {
                            showAlert(t("delete.success"), onRefresh);
                        }
                    });
            }
        );
    }

    return (
        <div className="flex flex-row items-start rounded-xl mt-2">
            <img src={comment.user.avatar || "/avatar.png"} className="w-8 h-8 rounded-full mt-4" />
            <div className="flex flex-col flex-1 w-0 ml-2 bg-w rounded-xl p-4">
                <div className="flex flex-row">
                    <span className="t-primary text-base font-bold">{comment.user.username}</span>
                    <div className="flex-1 w-0" />
                    <span title={new Date(comment.createdAt).toLocaleString()} className="text-gray-400 text-sm">
                        {timeago(comment.createdAt)}
                    </span>
                </div>
                <p className="t-primary break-words">{comment.content}</p>
                <div className="flex flex-row justify-end">
                    {(profile?.permission || profile?.id === comment.user.id) && (
                        <Popup
                            arrow={false}
                            trigger={<button className="px-2 py bg-secondary rounded-full"><i className="ri-more-fill t-secondary"></i></button>}
                            position="left center"
                        >
                            <div className="flex flex-row self-end mr-2">
                                <button onClick={deleteComment} aria-label={t("delete.comment.title")} className="px-2 py bg-secondary rounded-full">
                                    <i className="ri-delete-bin-2-line t-secondary"></i>
                                </button>
                            </div>
                        </Popup>
                    )}
                </div>
            </div>
            <ConfirmUI />
            <AlertUI />
        </div>
    );
});

// Component for displaying a list of comments
export function Comments({ id }: { id: string }) {
    const config = useContext(ClientConfigContext);
    const [comments, setComments] = useState<Comment[]>([]);
    const [error, setError] = useState<string>();
    const ref = useRef("");
    const { t } = useTranslation();

    function loadComments() {
        client.feed
            .comment({ feed: id })
            .get({ headers: headersWithAuth() })
            .then(({ data, error }) => {
                if (error) {
                    setError(error.value as string);
                } else if (data && Array.isArray(data)) {
                    setComments(data);
                }
            });
    }

    useEffect(() => {
        if (ref.current === id) return;
        loadComments();
        ref.current = id;
    }, [id]);

    if (!config.get<boolean>('comment.enabled')) {
        return null;
    }

    return (
        <div className="m-2 flex flex-col justify-center items-center">
            <CommentInput id={id} onRefresh={loadComments} />
            {error && (
                <div className="flex flex-col w-auto rounded-2xl bg-w t-primary m-2 p-6 items-center justify-center">
                    <h1 className="text-xl font-bold t-primary">{error}</h1>
                    <button className="mt-2 bg-theme text-white px-4 py-2 rounded-full" onClick={loadComments}>
                        {t("reload")}
                    </button>
                </div>
            )}
            {comments.length > 0 && (
                <div className="w-full">
                    {comments.map((comment) => (
                        <CommentItem key={comment.id} comment={comment} onRefresh={loadComments} />
                    ))}
                </div>
            )}
        </div>
    );
}
