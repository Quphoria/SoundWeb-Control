export default function urlBuilder(pathname, query) {
  const searchParams = new URLSearchParams(query);
  if (searchParams) return pathname + "?" + searchParams;
  return pathname;
}