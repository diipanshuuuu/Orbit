import { useEffect } from "react";
import { useLocation } from "wouter";

function setMeta(attribute: "name" | "property", key: string, content: string) {
  let element = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`);
  if (!element) {
    element = document.createElement("meta");
    element.setAttribute(attribute, key);
    document.head.append(element);
  }
  element.content = content;
}

function humanizeSlug(slug: string) {
  try {
    return decodeURIComponent(slug).split("-").filter(Boolean)
      .map((word) => word[0]!.toUpperCase() + word.slice(1)).join(" ");
  } catch {
    return "Shared room";
  }
}

export function PageMetadata() {
  const [path] = useLocation();
  useEffect(() => {
    const zone = path.match(/^\/z\/([^/]+)/);
    let title = "Orbit";
    let description = "Check shared rooms and machines before walking over.";

    if (zone?.[1]) {
      const name = humanizeSlug(zone[1]);
      title = `${name} status | Orbit`;
      description = `Check the latest shared-space status for ${name} on Orbit.`;
    } else if (path === "/how-it-works") {
      title = "How Orbit works";
      description = "How Orbit turns occasional camera stills into shared-facility status, and what it stores.";
    } else if (path.startsWith("/cam/")) {
      title = "Camera check-in | Orbit";
      description = "Orbit facility camera check-in.";
    } else if (path === "/admin") {
      title = "Admin | Orbit";
      description = "Manage Orbit shared-facility status.";
    } else if (path !== "/") {
      title = "Page not found | Orbit";
      description = "This page is not available on Orbit.";
    }

    document.title = title;
    setMeta("name", "description", description);
    setMeta("property", "og:title", title);
    setMeta("property", "og:description", description);
  }, [path]);
  return null;
}
