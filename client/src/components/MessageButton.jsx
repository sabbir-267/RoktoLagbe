import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { MessageCircle } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { startConversation } from "../services/messages";
import { parseError } from "../utils/errors";
import useT from "../i18n/useT";

const dict = {
  en: { message: "Message", opening: "Opening...", loginFirst: "Log in to send a message" },
  bn: { message: "বার্তা", opening: "খোলা হচ্ছে...", loginFirst: "বার্তা পাঠাতে লগ ইন করুন" },
};

// Opens (or creates) a private chat. target: { donorId } | { requestId } | { userId }
export default function MessageButton({ target, label, className = "" }) {
  const { t } = useT(dict);
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [busy, setBusy] = useState(false);

  async function open() {
    if (!user) {
      toast(t("loginFirst"));
      navigate("/login", { state: { from: location } });
      return;
    }
    setBusy(true);
    try {
      const { conversation } = await startConversation(target);
      navigate(`/messages/${conversation.id}`);
    } catch (err) {
      toast.error(parseError(err).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={open}
      disabled={busy}
      className={
        className ||
        "inline-flex items-center justify-center gap-1.5 rounded-lg border border-brand-blue/30 bg-white px-3 py-2 text-sm font-semibold text-brand-blue transition hover:bg-blue-50 disabled:opacity-60"
      }
    >
      <MessageCircle size={16} />
      {busy ? t("opening") : label || t("message")}
    </button>
  );
}
