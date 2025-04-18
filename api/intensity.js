// api/intensity.js

// Vercel Serverless Function for WattTime carbon intensity
module.exports = async (req, res) => {
  try {
    // 1) Parse region (balancing authority) from query
    const ba = req.query.ba || "CAISO_NORTH";

    // 2) Read WattTime creds from env
    const user = process.env.WATTTIME_USERNAME;
    const pass = process.env.WATTTIME_PASSWORD;
    if (!user || !pass) {
      console.error("Missing WattTime credentials");
      return res.status(500).json({ error: "Missing WattTime credentials" });
    }

    // 3) Login to WattTime via Basic Auth to get a token
    console.log("🔑 Logging in to WattTime as", user);
    const basicAuth = Buffer.from(`${user}:${pass}`).toString("base64");
    const authRes = await fetch("https://api.watttime.org/v3/login", {
      method: "GET",
      headers: { Authorization: `Basic ${basicAuth}` },
    });
    if (!authRes.ok) {
      const text = await authRes.text();
      console.error("❌ WattTime login failed:", authRes.status, text);
      return res
        .status(502)
        .json({ error: "WattTime login failed", details: text });
    }
    const { token } = await authRes.json();
    if (!token) {
      console.error("❌ No token in WattTime login response");
      return res.status(502).json({ error: "No WattTime token returned" });
    }
    console.log("✅ Received WattTime token");

    // 4) Fetch the latest carbon index for that BA
    const url = `https://api.watttime.org/v3/signal-index?ba=${ba}&signal=co2_moer`;
    console.log("🌐 Fetching carbon intensity from:", url);
    const dataRes = await fetch(url, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!dataRes.ok) {
      const text = await dataRes.text();
      console.error("❌ WattTime data fetch failed:", dataRes.status, text);
      return res
        .status(502)
        .json({ error: "WattTime data fetch failed", details: text });
    }
    const json = await dataRes.json();
    if (!json.data || !Array.isArray(json.data) || json.data.length === 0) {
      console.error(
        "❌ Unexpected WattTime response format",
        JSON.stringify(json)
      );
      return res
        .status(502)
        .json({ error: "Unexpected WattTime response format", details: json });
    }

    // 5) Convert lbs CO₂/MWh → g CO₂/kWh
    const lbsPerMWh = json.data[0].value;
    const gPerMWh = lbsPerMWh * 453.59237;
    const gPerKWh = gPerMWh / 1000;
    console.log(`⚡️ Region ${ba} intensity: ${gPerKWh} gCO₂/kWh`);

    // 6) Return JSON
    return res.status(200).json({ intensity: gPerKWh });
  } catch (err) {
    console.error("🔥 Error in /api/intensity:", err);
    return res.status(500).json({ error: err.message });
  }
};
