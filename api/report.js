const MAX_FIELD_LENGTH = 1000;
const recentReports = new Map();

function clean(value, maxLength = MAX_FIELD_LENGTH) {
  return String(value ?? '').replace(/[<>]/g, '').trim().slice(0, maxLength);
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const webhook = process.env.DISCORD_WEBHOOK_URL;
  if (!webhook) return res.status(503).json({ error: 'Report delivery is not configured' });

  const { volume, chapter, paragraph, text, reason, page } = req.body || {};
  const excerpt = clean(text, 700);
  const issue = clean(reason, 500);
  if (!excerpt || !issue) return res.status(400).json({ error: 'Missing report details' });

  const client = clean(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown', 80);
  const now = Date.now();
  for (const [key, timestamp] of recentReports) {
    if (now - timestamp > 60_000) recentReports.delete(key);
  }
  if (recentReports.has(client)) return res.status(429).json({ error: 'Please wait before sending another report' });

  const safePage = clean(page, 300);
  const payload = {
    embeds: [{
      title: 'Báo lỗi nội dung',
      color: 0xe0a84f,
      fields: [
        { name: 'Tập / chương / đoạn', value: clean(`${volume} · ${chapter} · đoạn ${paragraph}`, 200) || 'Không rõ' },
        { name: 'Mô tả lỗi', value: issue || 'Không có mô tả' },
        { name: 'Nội dung đoạn', value: excerpt || 'Không có nội dung' },
        ...(safePage ? [{ name: 'Trang', value: safePage }] : [])
      ],
      timestamp: new Date().toISOString()
    }]
  };

  recentReports.set(client, now);
  try {
    const response = await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8000)
    });
    if (!response.ok) {
      recentReports.delete(client);
      console.error('Discord report delivery failed:', response.status);
      return res.status(502).json({ error: 'Could not deliver report' });
    }
    return res.status(200).json({ ok: true });
  } catch (error) {
    recentReports.delete(client);
    console.error('Discord report delivery failed:', error.message);
    return res.status(502).json({ error: 'Could not deliver report' });
  }
}
