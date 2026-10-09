import type { Metadata } from "next";
import EntrarPortal from "./EntrarPortal";

// El token va en la URL: que no viaje como "referer" a ningún otro sitio.
export const metadata: Metadata = { referrer: "no-referrer" };

export default async function EntrarPortalPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const { token } = await searchParams;
  return <EntrarPortal token={typeof token === "string" ? token : ""} />;
}
