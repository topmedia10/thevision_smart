import "server-only";
import { getIronSession, SessionOptions } from "iron-session";
import { cookies } from "next/headers";

export interface SessionData {
  phone?: string; // E.164 of the logged-in employee
  name?: string; // display only
  token?: string; // raw session token; hash is stored on the employee record
  loggedIn?: boolean;
}

const password = process.env.SESSION_SECRET || "";

export const sessionOptions: SessionOptions = {
  password,
  cookieName: "smart_session",
  cookieOptions: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 12, // 12h
  },
};

export async function getSession() {
  if (!password || password.length < 32) {
    throw new Error("SESSION_SECRET must be set to a 32+ char value");
  }
  const cookieStore = await cookies();
  return getIronSession<SessionData>(cookieStore, sessionOptions);
}
