import { useCallback, useEffect, useRef, useState } from "react";
import { chatBackend } from "@/services/backend/chat";
import type { ChatHistory, ChatInbox, ChatSelection } from "@/domain/chat";
import { mergeChatMessages } from "@/domain/chat";
import { errorMessage } from "@/lib/errors";

export const refreshChat = () => window.dispatchEvent(new Event("eleven:chat"));
export function useChatInbox(tournamentId: string) {
  const [inbox, setInbox] = useState<ChatInbox | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true,
      pending = false;
    const load = async () => {
      if (pending) return;
      pending = true;
      try {
        const next = await chatBackend.inbox(tournamentId);
        if (active) {
          setInbox(next);
          setError("");
        }
      } catch (e) {
        if (active) setError(errorMessage(e));
      } finally {
        pending = false;
        if (active) setLoading(false);
      }
    };
    void load();
    const timer = window.setInterval(() => {
      if (!document.hidden) void load();
    }, 15000);
    window.addEventListener("eleven:chat", load);
    window.addEventListener("focus", load);
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener("eleven:chat", load);
      window.removeEventListener("focus", load);
    };
  }, [tournamentId]);
  return { inbox, error, loading };
}

/** Mount with a key containing user, Universe and selection to isolate all local state. */
export function useChatConversation(
  selection: ChatSelection,
  tournamentId: string,
) {
  const [history, setHistory] = useState<ChatHistory>({
    messages: [],
    hasMore: false,
    offer: null,
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const alive = useRef(true);
  const revision = useRef(0);
  const cursor = useRef<string | null>(null);
  const pending = useRef<Promise<void> | null>(null);
  const { kind, targetId } = selection;
  const load = useCallback(() => {
    if (pending.current) return pending.current;
    const current = revision.current;
    const task = (async () => {
      try {
        // Fetch forwards from the last received ID; a busy room cannot skip a burst.
        for (let page = 0; page < 5; page++) {
          const after = cursor.current;
          const next = await chatBackend.history(
            { kind, targetId },
            null,
            after,
            tournamentId,
          );
          if (!alive.current || current !== revision.current) return;
          setHistory((old) => ({
            ...next,
            messages: mergeChatMessages(old.messages, next.messages),
            hasMore: after === null ? next.hasMore : old.hasMore,
          }));
          cursor.current =
            next.messages[next.messages.length - 1]?.id ?? cursor.current;
          setError("");
          if (!next.hasNewer) break;
        }
      } catch (e) {
        if (alive.current && current === revision.current)
          setError(errorMessage(e));
      } finally {
        if (alive.current && current === revision.current) setLoading(false);
      }
    })();
    pending.current = task;
    void task.finally(() => {
      if (pending.current === task) pending.current = null;
    });
    return task;
  }, [kind, targetId, tournamentId]);
  useEffect(() => {
    alive.current = true;
    ++revision.current;
    pending.current = null;
    void load();
    const timer = window.setInterval(() => {
      if (!document.hidden) void load();
    }, 5000);
    window.addEventListener("focus", load);
    return () => {
      alive.current = false;
      clearInterval(timer);
      window.removeEventListener("focus", load);
    };
  }, [load]);
  const loadOlder = async () => {
    if (loadingOlder || !history.messages.length) return;
    setLoadingOlder(true);
    try {
      const next = await chatBackend.history(
        selection,
        history.messages[0].id,
        null,
        tournamentId,
      );
      if (!alive.current) return;
      setHistory((old) => ({
        ...old,
        hasMore: next.hasMore,
        messages: mergeChatMessages(next.messages, old.messages),
      }));
      setError("");
    } catch (e) {
      if (alive.current) setError(errorMessage(e));
    } finally {
      if (alive.current) setLoadingOlder(false);
    }
  };
  return { history, error, loading, loadingOlder, loadOlder, reload: load };
}
