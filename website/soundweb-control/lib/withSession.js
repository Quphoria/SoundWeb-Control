import { withIronSessionApiRoute, withIronSessionSsr } from "iron-session/next";
import { sessionOptions } from "../config/session";

export function withSessionRoute(handler) {
  return withIronSessionApiRoute(handler, sessionOptions);
}

export function withSessionSsr(handler) {
  return withIronSessionSsr(handler, sessionOptions);
}