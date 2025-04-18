// api/intensity.js

export default async function handler(req, res) {
  const ba = req.query.ba || "CAISO_NORTH"; // default if none passed
  const user = process.env.WATTTIME_USERNAME;
  const pass = process.env.WATTTIME_PASSWORD;

  if (!user || !pass) {
    return res.status(500).json({ error: "Missing WattTime credentials" });
  }

  // 1) Log in with Basic Auth to get a token
  const basicAuth = Buffer.from(`${user}:${pass}`).toString("base64");
  const authRes = await fetch("https://api2.watttime.org/v2/login", {
    headers: { Authorization: `Basic ${basicAuth}` },
  });
  if (!authRes.ok) {
    return res.status(502).json({ error: "WattTime auth failed" });
  }
  const { token } = await authRes.json();

  // 2) Fetch the latest carbon index for the BA
  const dataRes = await fetch(
    `https://api2.watttime.org/v2/index?ba=${ba}&style=all`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!dataRes.ok) {
    return res.status(502).json({ error: "WattTime data fetch failed" });
  }
  const { data } = await dataRes.json();

  // 3) Convert lbs CO2/MWh → g CO2/kWh
  const lbsPerMWh = data[0].value;
  const gPerMWh = lbsPerMWh * 453.59237;
  const gPerKWh = gPerMWh / 1000;

  return res.json({ intensity: gPerKWh });
}
