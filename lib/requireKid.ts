import "server-only";
import { cookies } from "next/headers";
import { KID_COOKIE_NAME, verifyKidSessionToken } from "@/lib/kidSession";

/** Returns the logged-in kid's child id from the signed cookie, or null. */
export async function requireKid(): Promise<{ childId: string } | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(KID_COOKIE_NAME)?.value;
  return verifyKidSessionToken(token);
}
