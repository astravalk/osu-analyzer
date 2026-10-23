import axios from 'axios';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { action, username, mode, query, country } = req.query;
  const OSU_CLIENT_ID = process.env.OSU_CLIENT_ID;
  const OSU_CLIENT_SECRET = process.env.OSU_CLIENT_SECRET;

  // Validación de seguridad previa
  if (!OSU_CLIENT_ID || !OSU_CLIENT_SECRET) {
    console.error("ERROR CRÍTICO: Variables OSU_CLIENT_ID o OSU_CLIENT_SECRET no detectadas en Node.js");
    return res.status(500).json({ error: "Faltan variables de entorno en el servidor." });
  }

  try {
    // Autenticación OAuth Client Credentials contra osu! API v2
    const tokenResponse = await axios.post("https://osu.ppy.sh/oauth/token", {
      client_id: parseInt(OSU_CLIENT_ID, 10),
      client_secret: OSU_CLIENT_SECRET,
      grant_type: "client_credentials",
      scope: "public"
    }, {
      headers: { 
        'Content-Type': 'application/json',
        'Accept': 'application/json' 
      }
    });

    const headers = { Authorization: `Bearer ${tokenResponse.data.access_token}` };

    // ACCIÓN 1: AUTOCOMPLETADO EN VIVO
    if (action === 'search') {
      const searchRes = await axios.get(`https://osu.ppy.sh/api/v2/search?mode=user&query=${query}`, { headers });
      return res.status(200).json(searchRes.data.user.data.slice(0, 5));
    }

    // ACCIÓN 2: RANKINGS EN TIEMPO REAL (HOME)
    if (action === 'rankings') {
      const globalRes = await axios.get(`https://osu.ppy.sh/api/v2/rankings/${mode}/performance`, { headers });
      const localRes = await axios.get(`https://osu.ppy.sh/api/v2/rankings/${mode}/performance?country=${country}`, { headers });
      return res.status(200).json({ 
        global: globalRes.data.ranking[0], 
        local: localRes.data.ranking[0] 
      });
    }

    // ACCIÓN 3: PERFIL COMPLETO
    if (action === 'profile') {
      if (!username) return res.status(400).json({ error: "Falta usuario" });
      let userUrl = `https://osu.ppy.sh/api/v2/users/${username}`;
      if (mode && mode !== 'default') userUrl += `/${mode}`;
      
      const userResponse = await axios.get(userUrl, { headers });
      const userData = userResponse.data;
      const actualMode = (mode && mode !== 'default') ? mode : userData.playmode;

      const bestScores = await axios.get(`https://osu.ppy.sh/api/v2/users/${userData.id}/scores/best?mode=${actualMode}&limit=10`, { headers });
      const recentScores = await axios.get(`https://osu.ppy.sh/api/v2/users/${userData.id}/scores/recent?mode=${actualMode}&limit=15`, { headers });
      
      return res.status(200).json({
        user: userData, actualMode: actualMode, bestScores: bestScores.data, recentScores: recentScores.data
      });
    }

    return res.status(400).json({ error: "Acción no válida" });
  } catch (error) {
    console.error("OSU API ERROR LOG:", {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data
    });

    return res.status(500).json({
      error: "Error de conexión con osu! API",
      details: error.response?.data || error.message
    });
  }
}