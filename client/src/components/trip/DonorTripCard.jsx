import { useCallback, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { Marker, Tooltip } from "react-leaflet";
import { Navigation, MapPinCheck, Square, ShieldCheck, Smartphone, AlertTriangle, Loader2 } from "lucide-react";
import BaseMap, { FitPoints } from "../map/BaseMap";
import { hospitalIcon, youIcon } from "../map/icons";
import {
  isPoint,
  toPoint,
  haversineKm,
  etaMinutesFor,
  formatDistance,
  formatEta,
  formatAgo,
  geoProblem,
  geoErrorKey,
} from "../map/geo";
import { getTrips, startTrip, arriveTrip, stopTrip, sendTripLocation } from "../../services/trips";
import { parseError } from "../../utils/errors";
import useT from "../../i18n/useT";
import mapDict from "../../i18n/map";

const SEND_EVERY_MS = 5000; // never more often than this
const SEND_MOVED_M = 25; // …and only after moving this far
const HEARTBEAT_MS = 30000; // still refresh "updated x min ago" when standing still
const WATCH_OPTIONS = { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 };

const STATUS_CHIP = {
  on_the_way: "bg-blue-50 text-brand-blue",
  arrived: "bg-green-50 text-green-700",
  stopped: "bg-gray-100 text-gray-600",
};

// "Going to donate?" card for a donor who accepted this request
export default function DonorTripCard({ requestId, hospital: requestHospital }) {
  const { t, n, date } = useT(mapDict);
  const [loaded, setLoaded] = useState({ key: null, hospital: null, trip: null, hidden: false });
  const [trip, setTrip] = useState(null); // latest TripOwn from start/location/end
  const [sharing, setSharing] = useState(false);
  const [myPos, setMyPos] = useState(null); // { lat, lng, accuracy }
  const [geoMsg, setGeoMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const watchId = useRef(null);
  const lastSent = useRef(null); // { at, lat, lng }
  const inFlight = useRef(false);
  const wakeLock = useRef(null);

  // Load my own trip (if any) and the hospital pin
  useEffect(() => {
    let cancelled = false;
    getTrips(requestId)
      .then((data) => {
        if (cancelled) return;
        setLoaded({ key: requestId, hospital: toPoint(data?.hospital), trip: data?.trips?.[0] || null, hidden: false });
      })
      .catch((err) => {
        if (cancelled) return;
        // 403/404: not (or no longer) an accepted donor. Anything else: still let them start.
        const s = err.response?.status;
        setLoaded({ key: requestId, hospital: null, trip: null, hidden: s === 403 || s === 404 });
      });
    return () => {
      cancelled = true;
    };
  }, [requestId]);

  // Ticks "updated x min ago"
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);

  const stopWatching = useCallback(() => {
    if (watchId.current != null) navigator.geolocation?.clearWatch(watchId.current);
    watchId.current = null;
    lastSent.current = null;
    wakeLock.current?.release?.().catch(() => {});
    wakeLock.current = null;
    setSharing(false);
  }, []);

  // Sharing stops when the page is closed or the card goes away
  useEffect(() => stopWatching, [stopWatching]);

  const maybeSend = useCallback(
    (pos) => {
      const at = Date.now();
      const prev = lastSent.current;
      if (prev) {
        const elapsed = at - prev.at;
        const moved = (haversineKm(prev, pos) ?? 0) * 1000;
        if (elapsed < SEND_EVERY_MS) return;
        if (moved < SEND_MOVED_M && elapsed < HEARTBEAT_MS) return;
      }
      if (inFlight.current) return;
      inFlight.current = true;
      lastSent.current = { at, lat: pos.lat, lng: pos.lng };
      sendTripLocation(requestId, {
        latitude: pos.lat,
        longitude: pos.lng,
        accuracy: Number.isFinite(pos.accuracy) ? Math.min(5000, Math.max(0, Math.round(pos.accuracy))) : undefined,
      })
        .then((data) => {
          if (data?.trip) setTrip(data.trip);
        })
        .catch((err) => {
          const s = err.response?.status;
          if (s === 409 || s === 403 || s === 404) {
            // The trip ended on the server (request closed, or too old): stop sharing
            stopWatching();
            setTrip((tr) => (tr ? { ...tr, status: "stopped" } : tr));
            toast.error(parseError(err).message);
          }
          // Network blips and rate limits: the next position will try again
        })
        .finally(() => {
          inFlight.current = false;
        });
    },
    [requestId, stopWatching]
  );

  const startWatching = useCallback(() => {
    if (watchId.current != null) return true;
    const problem = geoProblem();
    if (problem) {
      setGeoMsg(t(problem === "insecure" ? "geoInsecure" : "geoUnsupported"));
      return false;
    }
    setGeoMsg("");
    watchId.current = navigator.geolocation.watchPosition(
      (p) => {
        const pos = { lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy };
        setMyPos(pos);
        setGeoMsg("");
        maybeSend(pos);
      },
      (err) => {
        setGeoMsg(t(geoErrorKey(err)));
        if (err.code === 1) stopWatching(); // permission denied: watching is pointless
      },
      WATCH_OPTIONS
    );
    setSharing(true);
    // Keep the screen on while travelling, where supported (quietly ignored otherwise)
    navigator.wakeLock
      ?.request?.("screen")
      .then((lock) => {
        wakeLock.current = lock;
      })
      .catch(() => {});
    return true;
  }, [maybeSend, stopWatching, t]);

  async function onStart() {
    const problem = geoProblem();
    if (problem) {
      setGeoMsg(t(problem === "insecure" ? "geoInsecure" : "geoUnsupported"));
      return;
    }
    setBusy(true);
    try {
      const data = await startTrip(requestId);
      setTrip(data?.trip || { status: "on_the_way", startedAt: new Date().toISOString() });
      startWatching();
      toast.success(t("tripStarted"));
    } catch (err) {
      toast.error(parseError(err).message);
    } finally {
      setBusy(false);
    }
  }

  async function onEnd(kind) {
    setBusy(true);
    try {
      const data = await (kind === "arrived" ? arriveTrip(requestId) : stopTrip(requestId));
      stopWatching();
      setMyPos(null);
      setTrip(data?.trip || { status: kind === "arrived" ? "arrived" : "stopped" });
      toast.success(kind === "arrived" ? t("arrivedToast") : t("stoppedToast"));
    } catch (err) {
      toast.error(parseError(err).message);
    } finally {
      setBusy(false);
    }
  }

  if (loaded.key !== requestId) {
    return (
      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <Loader2 size={20} className="animate-spin text-gray-400" aria-label={t("loading")} />
      </section>
    );
  }
  if (loaded.hidden) return null;

  const current = trip || loaded.trip;
  const status = current?.status || "";
  const onTheWay = status === "on_the_way";
  const hospital = loaded.hospital || (isPoint(requestHospital) ? requestHospital : null);

  // Prefer the server's numbers; fall back to a local estimate from my own position
  const localKm = myPos && hospital ? haversineKm(myPos, hospital) : null;
  const km = current?.distanceKm ?? localKm;
  const eta = status === "arrived" ? 0 : (current?.etaMinutes ?? etaMinutesFor(localKm));
  const points = [hospital, myPos].filter(isPoint);

  return (
    <section className="rounded-2xl bg-white p-6 shadow-sm" aria-labelledby="trip-card-title">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="trip-card-title" className="flex items-center gap-2 font-semibold text-brand-blue">
          <Navigation size={18} />
          {t("goingTitle")}
        </h2>
        {status && (
          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_CHIP[status] || STATUS_CHIP.stopped}`}>
            {t(`status_${STATUS_CHIP[status] ? status : "stopped"}`)}
          </span>
        )}
      </div>

      {!onTheWay && (
        <p className="mt-1 text-sm text-gray-500">{status === "arrived" ? t("arrivedText") : t("goingText")}</p>
      )}

      {onTheWay && (
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3" aria-live="polite">
          <div className="rounded-xl bg-gray-50 px-3 py-2">
            <p className="text-xs text-gray-500">{t("distance")}</p>
            <p className="font-semibold text-gray-800">{km != null ? formatDistance(km, t, n) : "—"}</p>
          </div>
          <div className="rounded-xl bg-gray-50 px-3 py-2">
            <p className="text-xs text-gray-500">{t("eta")}</p>
            <p className="font-semibold text-gray-800">{eta != null ? formatEta(eta, t, n) : "—"}</p>
          </div>
          <div className="col-span-2 rounded-xl bg-gray-50 px-3 py-2 sm:col-span-1">
            <p className="text-xs text-gray-500">{t("lastSent")}</p>
            <p className="font-semibold text-gray-800">
              {current?.updatedAt ? formatAgo(current.updatedAt, now, t, date) : "—"}
            </p>
          </div>
        </div>
      )}

      {onTheWay && !sharing && (
        <p className="mt-3 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          {t("sharingPaused")}
        </p>
      )}

      {geoMsg && (
        <p role="alert" className="mt-3 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          {geoMsg}
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-3">
        {!onTheWay && (
          <button type="button" disabled={busy} onClick={onStart} className="btn-primary">
            <Navigation size={16} />
            {status ? t("startAgain") : t("onMyWay")}
          </button>
        )}
        {onTheWay && !sharing && (
          <button type="button" disabled={busy} onClick={startWatching} className="btn-primary">
            <Navigation size={16} />
            {t("resumeSharing")}
          </button>
        )}
        {onTheWay && (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={() => onEnd("arrived")}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-green-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-green-700 disabled:opacity-60"
            >
              <MapPinCheck size={16} />
              {t("arrived")}
            </button>
            <button type="button" disabled={busy} onClick={() => onEnd("stop")} className="btn-secondary">
              <Square size={14} />
              {t("stopSharing")}
            </button>
          </>
        )}
      </div>

      {(onTheWay || !status) && (
        <ul className="mt-4 space-y-2 text-xs text-gray-600">
          <li className="flex items-start gap-2">
            <ShieldCheck size={15} className="mt-0.5 shrink-0 text-green-600" />
            {t("privacyNotice")}
          </li>
          <li className="flex items-start gap-2">
            <Smartphone size={15} className="mt-0.5 shrink-0 text-brand-blue" />
            {t("keepOpen")}
          </li>
        </ul>
      )}

      {onTheWay && points.length > 0 && (
        <div className="mt-4">
          <BaseMap center={points[0]} zoom={14} height={260} label={t("donorMapLabel")}>
            <FitPoints points={points} fitKey={`${hospital ? "h" : ""}${myPos ? "y" : ""}`} />
            {hospital && (
              <Marker position={[hospital.lat, hospital.lng]} icon={hospitalIcon} keyboard={false}>
                <Tooltip>{t("hospital")}</Tooltip>
              </Marker>
            )}
            {myPos && (
              <Marker position={[myPos.lat, myPos.lng]} icon={youIcon} keyboard={false}>
                <Tooltip>{t("you")}</Tooltip>
              </Marker>
            )}
          </BaseMap>
          {!hospital && <p className="mt-2 text-xs text-gray-500">{t("noHospitalPinDonor")}</p>}
          {myPos && Number.isFinite(myPos.accuracy) && (
            <p className="mt-1 text-xs text-gray-400">{t("accuracy", { m: Math.round(myPos.accuracy) })}</p>
          )}
        </div>
      )}
    </section>
  );
}
