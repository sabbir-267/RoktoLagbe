import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";
import { useAuth } from "./AuthContext";
import { TOKEN_KEY, API_ORIGIN } from "../services/api";
import { getMessagesUnread } from "../services/messages";

const MessagesContext = createContext(null);

// One live connection per logged-in user. Pages subscribe to events with useChatEvent().
export function MessagesProvider({ children }) {
  const { user } = useAuth();
  const userId = user?.id;
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [stored, setStored] = useState({ userId: null, count: 0 });
  const activeRef = useRef(null); // conversation currently open on screen

  const refreshUnread = useCallback(async () => {
    if (!userId) return;
    try {
      const data = await getMessagesUnread();
      setStored({ userId, count: data.unreadCount ?? 0 });
    } catch {
      /* the next event or refresh will try again */
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) return undefined;
    // Same address as the API (undefined = this site, used in development)
    const s = io(API_ORIGIN || undefined, {
      auth: (cb) => cb({ token: localStorage.getItem(TOKEN_KEY) }), // read fresh on every reconnect
      transports: ["websocket", "polling"],
    });
    const onConnect = () => {
      setSocket(s); // pages subscribe once there is a live connection
      setConnected(true);
      refreshUnread(); // catch up on anything missed while disconnected
    };
    const onDisconnect = () => setConnected(false);
    const onNew = ({ message, conversation }) => {
      const mine = String(message.sender) === String(userId);
      if (!mine && activeRef.current !== String(conversation.id)) {
        setStored((st) => ({ userId, count: (st.userId === userId ? st.count : 0) + 1 }));
      }
    };
    s.on("connect", onConnect);
    s.on("disconnect", onDisconnect);
    s.on("message:new", onNew);
    s.on("conversation:read", refreshUnread);

    return () => {
      s.off();
      s.disconnect();
      setSocket(null);
      setConnected(false);
    };
  }, [userId, refreshUnread]);

  const setActiveConversation = useCallback((id) => {
    activeRef.current = id ? String(id) : null;
  }, []);

  const unreadCount = stored.userId === userId ? stored.count : 0;

  const value = useMemo(
    () => ({ socket, connected, unreadCount, refreshUnread, setActiveConversation }),
    [socket, connected, unreadCount, refreshUnread, setActiveConversation]
  );

  return <MessagesContext.Provider value={value}>{children}</MessagesContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useMessages() {
  const ctx = useContext(MessagesContext);
  if (!ctx) throw new Error("useMessages must be used inside <MessagesProvider>");
  return ctx;
}

// Subscribes to a socket event for as long as the component is mounted
// eslint-disable-next-line react-refresh/only-export-components
export function useChatEvent(event, handler) {
  const { socket } = useMessages();
  const ref = useRef(handler);
  useEffect(() => {
    ref.current = handler;
  }, [handler]);
  useEffect(() => {
    if (!socket) return undefined;
    const fn = (data) => ref.current(data);
    socket.on(event, fn);
    return () => socket.off(event, fn);
  }, [socket, event]);
}
