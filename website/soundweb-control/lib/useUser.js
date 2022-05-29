import { useEffect } from "react";
import Router from "next/router";
import { useRouter } from "next/router";
import useSWR from "swr";

export default function useUser({
  redirectTo = "",
  redirectIfFound = false,
  redirectQuery = false,
} = {}) {
  const { data: user, mutate: mutateUser } = useSWR("/api/user", url => fetch(url, {method: 'POST'}).then(res => res.json()));
  const router = useRouter();

  useEffect(() => {
    // if no redirect needed, just return (example: already on /dashboard)
    // if user data not yet there (fetch in progress, logged in or not) then don't do anything yet
    if (!redirectTo || !user) return;

    if (
      // If redirectTo is set, redirect if the user was not found.
      (redirectTo && !redirectIfFound && !user?.isLoggedIn) ||
      // If redirectIfFound is also set, redirect if the user was found
      (redirectIfFound && user?.isLoggedIn)
    ) {
      if (redirectQuery) {
        Router.push({ pathname: redirectTo, query: {p: JSON.stringify({pathname: router.pathname, query: router.query})}});
      } else {
        Router.push(redirectTo);
      }
    }
  }, [user, redirectIfFound, redirectTo]);

  return { user, mutateUser };
}