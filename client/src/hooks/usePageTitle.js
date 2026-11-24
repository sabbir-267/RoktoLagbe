import { useEffect } from "react";

const SITE = "RoktoLagbe";

// Sets the browser tab title, e.g. "Find Donors | RoktoLagbe"
export default function usePageTitle(title) {
  useEffect(() => {
    if (title) document.title = `${title} | ${SITE}`;
  }, [title]);
}
