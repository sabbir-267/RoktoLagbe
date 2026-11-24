import { HeartPulse, ClipboardCheck, Clock, Info } from "lucide-react";

// One look per notification type the backend can send
export const TYPE_META = {
  donor_match: {
    icon: HeartPulse,
    label: "Blood needed",
    bg: "bg-red-50",
    text: "text-brand-red",
  },
  request_update: {
    icon: ClipboardCheck,
    label: "Request update",
    bg: "bg-blue-50",
    text: "text-brand-blue",
  },
  expiry_alert: {
    icon: Clock,
    label: "Expiry alert",
    bg: "bg-amber-50",
    text: "text-amber-600",
  },
  system: {
    icon: Info,
    label: "Notice",
    bg: "bg-gray-100",
    text: "text-gray-500",
  },
};