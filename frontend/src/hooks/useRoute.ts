import { useEffect, useState } from "react";

const read = () => (window.location.hash.replace(/^#/, "") || "/home");

/** Tiny hash router: works with the browser back button and survives refresh, no dependency needed. */
export function useRoute(): [string, (to: string) => void] {
  const [path, setPath] = useState(read);
  useEffect(() => {
    const on = () => { setPath(read()); window.scrollTo({ top: 0 }); };
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return [path, (to) => { window.location.hash = to; }];
}
