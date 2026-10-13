export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  const raw = typeof req.query.url === "string" ? req.query.url : "";
  if (!raw || raw.length > 2048) return res.status(400).json({ error: "Paste a valid Google Maps link." });
  let input;
  try { input = new URL(raw); } catch { return res.status(400).json({ error: "That Maps link is not a valid URL." }); }
  const allowed = h => h === "maps.app.goo.gl" || h === "goo.gl" || h === "google.com" || h.endsWith(".google.com") || h === "maps.google.com";
  if (input.protocol !== "https:" || !allowed(input.hostname.toLowerCase())) return res.status(400).json({ error: "For safety, only Google Maps links are supported." });
  try {
    let finalUrl = input.toString();
    if (input.hostname === "maps.app.goo.gl" || input.hostname === "goo.gl") {
      const response = await fetch(finalUrl, { redirect: "follow", headers: { "User-Agent": "Mozilla/5.0 (compatible; ScrapACIndia/1.0)" } });
      finalUrl = response.url || finalUrl;
      if (!response.ok && !response.url) throw new Error("Google Maps link could not be opened.");
    }
    const decoded = decodeURIComponent(finalUrl.replace(/\+/g, " "));
    let match = decoded.match(/@(-?\d{1,3}\.\d+),\s*(-?\d{1,3}\.\d+)/)
      || decoded.match(/!3d(-?\d{1,3}\.\d+)!4d(-?\d{1,3}\.\d+)/)
      || decoded.match(/[?&](?:q|query|ll|center|destination|daddr)=(-?\d{1,3}\.\d+)[,%+\s]+(-?\d{1,3}\.\d+)/);
    let lat = null, lon = null;
    if (match) { lat = Number(match[1]); lon = Number(match[2]); }
    let placeQuery = "";
    const u = new URL(finalUrl);
    if (lat === null || lon === null) {
      for (const key of ["query", "q", "destination", "daddr"]) {
        const value = u.searchParams.get(key);
        if (value) {
          const coords = value.match(/^\s*(-?\d{1,3}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)/);
          if (coords) { lat = Number(coords[1]); lon = Number(coords[2]); }
          else placeQuery = value;
          break;
        }
      }
      if (!placeQuery) {
        const p = decoded.match(/\/maps\/place\/([^/@?]+)/);
        if (p) placeQuery = p[1].replace(/\+/g, " ").replace(/,/g, " ");
      }
    }
    if (!(Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180)) { lat = null; lon = null; }
    return res.status(200).json({ resolvedUrl: finalUrl, lat, lon, placeQuery });
  } catch (error) {
    return res.status(422).json({ error: "Could not resolve this Google Maps link. Open it in Google Maps and copy the link again." });
  }
}