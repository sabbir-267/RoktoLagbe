import { useState } from "react";
import { avatarSrc, initialsOf } from "../utils/avatar";

const TONES = {
  red: "bg-brand-red text-white font-semibold",
  blue: "bg-brand-blue/10 text-brand-blue font-semibold",
  soft: "bg-red-50 text-brand-red font-bold",
};

// A person's profile picture, or their initials when they have none (or it fails to load)
export default function UserAvatar({ name, src, size = "h-10 w-10 text-sm", tone = "blue", className = "" }) {
  const url = avatarSrc(src);
  const [failed, setFailed] = useState(null); // the url that failed, so a new picture is tried again
  if (url && failed !== url) {
    return (
      <img
        src={url}
        alt=""
        referrerPolicy="no-referrer"
        loading="lazy"
        onError={() => setFailed(url)}
        className={`${size} shrink-0 rounded-full bg-gray-100 object-cover ${className}`}
      />
    );
  }
  return (
    <span className={`${size} ${TONES[tone] || TONES.blue} flex shrink-0 items-center justify-center rounded-full ${className}`}>
      {initialsOf(name)}
    </span>
  );
}
