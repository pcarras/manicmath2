// Short-lived TURN credentials for the TEAM mode link (js/p2p.js). A TURN server relays the game
// when two phones cannot reach each other directly (common on 4G/5G networks).
// Uses Cloudflare Realtime TURN (free tier) when these are set in Vercel:
//   CF_TURN_KEY_ID      the TURN key id
//   CF_TURN_API_TOKEN   the TURN key API token
// GET /api/turn -> { iceServers: [...] }   (just public STUN when not configured)
const STUN_ONLY = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }];

export default async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    const id = process.env.CF_TURN_KEY_ID;
    const token = process.env.CF_TURN_API_TOKEN;
    if (!id || !token) {
        res.status(200).json({ iceServers: STUN_ONLY, turn: false });
        return;
    }
    try {
        const r = await fetch(`https://rtc.live.cloudflare.com/v1/turn/keys/${id}/credentials/generate-ice-servers`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ ttl: 7200 })
        });
        if (!r.ok) throw new Error(String(r.status));
        const data = await r.json();
        // Browsers time out on port 53, so those URLs are left out (Cloudflare's advice)
        const iceServers = (data.iceServers || []).map((s) => ({
            ...s,
            urls: (Array.isArray(s.urls) ? s.urls : [s.urls]).filter((u) => !/:53(\?|$)/.test(u))
        })).filter((s) => s.urls.length);
        res.status(200).json({ iceServers: iceServers.length ? iceServers : STUN_ONLY, turn: iceServers.length > 0 });
    } catch {
        res.status(200).json({ iceServers: STUN_ONLY, turn: false });
    }
}
