import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import RequestForm from "../components/RequestForm";
import useT from "../i18n/useT";
import requests from "../i18n/requests";

export default function NewRequest() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { t } = useT(requests);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Link
        to="/requests"
        className="inline-flex items-center gap-1 text-sm font-semibold text-brand-blue hover:underline"
      >
        <ArrowLeft size={16} />
        {t("allRequests")}
      </Link>
      <h1 className="mt-4 text-3xl font-bold text-brand-blue">{t("newTitle")}</h1>
      <p className="mt-1 mb-6 text-gray-500">
        {t("newSubtitle")}
      </p>

      {!user.phone && (
        <p className="mb-6 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {t("noPhone")}
        </p>
      )}

      <RequestForm
        defaultPhone={user.phone}
        onCreated={(request) => navigate(`/requests/${request.id}`, { replace: true })}
      />
    </div>
  );
}
