import { resources_url } from "./siteUrls";

export default function urlBuilder(pathname, query) {
  const searchParams = new URLSearchParams(query);
  if (searchParams) return pathname + "?" + searchParams;
  return pathname;
}

export function resourceUrlEncode(url) {
  return encodeURI(url.replace(/^\/?resources/, resources_url));
}