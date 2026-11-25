import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Marker, Tooltip } from "react-leaflet";
import { Navigation, Phone, MapPinned, Maximize2, Pencil, Hospital } from "lucide-react";
import BaseMap, { FitPoints } from "../map/BaseMap";
import LocationPicker from "../map/LocationPicker";
import { hospitalIcon, donorIcon, initials } from "../map/icons";
import { isPoint, toPoint, formatDistance, formatEta, formatAgo } from "../map/geo";
import { getTrips, updateRequestLocation } from "../../services/trips";
import { useChatEvent } from "../../context/MessagesContext";
import { parseError } from "../../utils/errors";
import useT from "../../i18n/useT";
import mapDict from "../../i18n/map";

const POLL_MS = 30000;
const STATUS_CHIP = {
  on_the_way: "bg-blue-50 text-brand-blue",
  arrived: "bg-green-50 text-green-700",
  stopped: "bg-gray-100 text-gray-600",
};
const ORDER = { on_the_way: 0, arrived: 1, stopped: 2 };

const donorKey = (trip) => String(trip?.donorId ?? "");

// Requester's view: hospital pin + every donor who started a trip, live
export default function RequesterTripsPanel({ requestId, hospital: requestHospital }) {
  const { t, n, date } = useT(mapDict);
  const [data, setData] = useState({ key: null, hospital: null, trips: [], hidden: false });
  const [savedHospital, setSavedHospital] = useState(null); // set here, before the next fetch confirms it
  const [now, setNow] = useState(() => Date.now());
  const [fitCount, setFitCount] = useState(0);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const [version, setVersion] = useState(0);

  // First load, then a 30 s polling fallback (socket updates arrive in between)
  useEffect(() => {
    let cancelled = false;
    const load = () =>
      getTrips(requestId)
        .then((res) => {
          if (cancelled) return;
          setData({
            key: requestId,
            hospital: toPoint(res?.hospital),
            trips: Array.isArray(res?.trips) ? res.trips : [],
            hidden: false,
          });
        })
        .catch((err) => {
          if (cancelled) return;
          const s = err.response?.status;
          // 403/404 → nothing to show; other errors keep what we had
          setData((d) => (s === 403 || s === 404 ? { key: requestId, hospital: null, trips: [], hidden: true } : { ...d, key: requestId }));
        });
    load();
    const id = setInterval(() => {
      if (document.visibilityState !== "hidden") load();
    }, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [requestId, version]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);

  // Live updates: { requestId, trip: TripView }
  useChatEvent(
    "trip:update",
    useCallback(
      (msg) => {
        if (!msg?.trip || String(msg.requestId) !== String(requestId)) return;
        setNow(Date.now());
        setData((d) => {
          const k = donorKey(msg.trip);
          const exists = d.trips.some((tr) => donorKey(tr) === k);
          return {
            ...d,
            // A TripView is complete: replace (an ended trip must drop its old coordinates)
            trips: exists ? d.trips.map((tr) => (donorKey(tr) === k ? msg.trip : tr)) : [...d.trips, msg.trip],
          };
        });
      },
      [requestId]
    )
  );

  async function saveHospital() {
    if (!isPoint(draft)) return;
    setSaving(true);
    try {
      await updateRequestLocation(requestId, { latitude: draft.lat, longitude: draft.lng });
      setSavedHospital(draft);
      setEditing(false);
      setDraft(null);
      setVersion((v) => v + 1); // distances/ETAs are recalculated by the server
      setFitCount((c) => c + 1);
      toast.success(t("hospitalSaved"));
    } catch (err) {
      toast.error(parseError(err).message);
    } finally {
      setSaving(false);
    }
  }

  if (data.hidden) return null;

  const hospital = savedHospital || data.hospital || (isPoint(requestHospital) ? requestHospital : null);
  const trips = [...data.trips].sort((a, b) => (ORDER[a.status] ?? 3) - (ORDER[b.status] ?? 3));
  const live = trips.filter((tr) => tr.status === "on_the_way" && isPoint(toPoint(tr)));
  const points = [hospital, ...live.map(toPoint)].filter(isPoint);
  const fitKey = `${fitCount}|${hospital ? "h" : ""}|${live.map(donorKey).join(",")}`;

  const picker = (
    <div className="mt-4 space-y-3 rounded-xl border border-blue-100 bg-blue-50/50 p-4">
      <LocationPicker value={draft} onChange={setDraft} height={260} hint={t("hospitalPinHint")} />
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={!isPoint(draft) || saving} onClick={saveHospital} className="btn-primary">
          {saving ? t("saving") : t("saveHospital")}
        </button>
        {hospital && (
          <button
            type="button"
            onClick={() => {
              setEditing(false);
              setDraft(null);
            }}
            className="btn-secondary"
          >
            {t("cancel")}
          </button>
        )}
      </div>
    </div>
  );

  return (
    <section className="rounded-2xl bg-white p-6 shadow-sm" aria-labelledby="trips-panel-title">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="trips-panel-title" className="flex items-center gap-2 font-semibold text-brand-blue">
          <Navigation size={18} />
          {t("donorsOnTheWay")}
        </h2>
        {hospital && !editing && (
          <button
            type="button"
            onClick={() => {
              setDraft(hospital);
              setEditing(true);
            }}
            className="inline-flex items-center gap-1 text-xs font-semibold text-brand-blue hover:underline"
          >
            <Pencil size={13} />
            {t("fixHospital")}
          </button>
        )}
      </div>

      {!hospital && (
        <div className="mt-3">
          <p className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
            <Hospital size={16} className="mt-0.5 shrink-0" />
            {t("setHospitalPrompt")}
          </p>
          {picker}
        </div>
      )}
      {hospital && editing && picker}

      {data.key !== requestId ? (
        <p className="mt-3 text-sm text-gray-400">{t("loading")}</p>
      ) : (
        <>
          {points.length > 0 && !editing && (
            <div className="mt-4">
              <BaseMap center={points[0]} zoom={14} height={300} label={t("requesterMapLabel")}>
                <FitPoints points={points} fitKey={fitKey} />
                {hospital && (
                  <Marker position={[hospital.lat, hospital.lng]} icon={hospitalIcon} keyboard={false}>
                    <Tooltip>{t("hospital")}</Tooltip>
                  </Marker>
                )}
                {live.map((tr) => (
                  <Marker
                    key={donorKey(tr)}
                    position={[Number(tr.lat), Number(tr.lng)]}
                    icon={donorIcon(initials(tr.name), tr.status)}
                    keyboard={false}
                  >
                    <Tooltip>
                      {tr.name || t("donor")}
                      {tr.etaMinutes != null && ` · ${formatEta(tr.etaMinutes, t, n)}`}
                    </Tooltip>
                  </Marker>
                ))}
              </BaseMap>
              {points.length > 1 && (
                <button
                  type="button"
                  onClick={() => setFitCount((c) => c + 1)}
                  className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-brand-blue hover:underline"
                >
                  <Maximize2 size={13} />
                  {t("showAll")}
                </button>
              )}
            </div>
          )}

          {trips.length === 0 ? (
            <p className="mt-4 flex items-start gap-2 rounded-lg bg-gray-50 px-3 py-3 text-sm text-gray-600">
              <MapPinned size={16} className="mt-0.5 shrink-0 text-gray-400" />
              {t("noTripsYet")}
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-gray-100" aria-live="polite">
              {trips.map((tr) => {
                const st = STATUS_CHIP[tr.status] ? tr.status : "stopped";
                const dist = tr.status === "on_the_way" ? formatDistance(tr.distanceKm, t, n) : "";
                const eta = tr.status === "on_the_way" ? formatEta(tr.etaMinutes, t, n) : "";
                const when = tr.status === "on_the_way" ? tr.updatedAt : tr.endedAt || tr.updatedAt;
                return (
                  <li key={donorKey(tr)} className="flex flex-wrap items-center gap-3 py-3">
                    {tr.avatar ? (
                      <img src={tr.avatar} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <span
                        aria-hidden="true"
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-50 text-sm font-bold text-brand-blue"
                      >
                        {initials(tr.name)}
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-gray-800">
                        <span className="break-words">{tr.name || t("donor")}</span>
                        {tr.bloodGroup && <span className="text-xs font-bold text-brand-red">{tr.bloodGroup}</span>}
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_CHIP[st]}`}>
                          {t(`status_${st}`)}
                        </span>
                      </p>
                      <p className="mt-0.5 text-xs text-gray-500">
                        {[dist && t("away", { d: dist }), eta, when && t("updated", { ago: formatAgo(when, now, t, date) })]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                    {tr.phone && (
                      <a
                        href={`tel:${tr.phone}`}
                        aria-label={t("callDonor", { name: tr.name || t("donor") })}
                        className="inline-flex items-center gap-1 rounded-lg bg-brand-red px-3 py-2 text-sm font-semibold text-white transition hover:bg-brand-red-dark"
                      >
                        <Phone size={15} />
                        {t("call")}
                      </a>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          <p className="mt-3 text-xs text-gray-400">{t("estimateNote")}</p>
        </>
      )}
    </section>
  );
}
