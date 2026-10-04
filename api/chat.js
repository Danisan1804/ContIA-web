const requestCounts = new Map();
const WINDOW_MS = 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 20;
const MAX_MESSAGES = 40;
const MAX_MESSAGE_CHARS = 4000;
const MAX_HISTORY_CHARS = 20000;

function getClientIp(req) {
  return (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').toString().split(',')[0].trim();
}

function isAllowedOrigin(origin) {
  if (!origin) return true;
  const allowed = (process.env.ALLOWED_ORIGINS || '').split(',').map(value => value.trim()).filter(Boolean);
  return allowed.length === 0 || allowed.includes(origin);
}

function validHistory(history) {
  if (!Array.isArray(history) || history.length === 0 || history.length > MAX_MESSAGES) return false;
  let total = 0;
  for (const item of history) {
    if (!item || !['user', 'model'].includes(item.role) || !Array.isArray(item.parts) || item.parts.length !== 1) return false;
    const text = item.parts[0]?.text;
    if (typeof text !== 'string' || text.length === 0 || text.length > MAX_MESSAGE_CHARS) return false;
    total += text.length;
  }
  return total <= MAX_HISTORY_CHARS;
}

export default async function handler(req, res) {
  const origin = req.headers.origin;
  if (!isAllowedOrigin(origin)) return res.status(403).json({ error: 'Origen no autorizado' });
  if (origin) res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  const now = Date.now();
  const ip = getClientIp(req);
  const previous = requestCounts.get(ip);
  const bucket = !previous || now - previous.startedAt >= WINDOW_MS ? { startedAt: now, count: 0 } : previous;
  bucket.count += 1;
  requestCounts.set(ip, bucket);
  if (bucket.count > MAX_REQUESTS_PER_WINDOW) return res.status(429).json({ error: 'Demasiadas solicitudes. Intenta nuevamente en un minuto.' });

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = null; }
  }
  const history = body?.history;
  if (!validHistory(history)) {
    return res.status(400).json({ error: 'Formato inválido' });
  }

  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({ error: 'API key no configurada en el servidor.' });
  }

  const SYSTEM_PROMPT = `Eres un asesor experto en contabilidad y finanzas, especializado en la normativa colombiana (DIAN, NIIF, Código de Comercio, Estatuto Tributario). Tu misión es responder consultas contables y financieras de forma clara, precisa y práctica.

DIRECTRICES:
- Responde siempre en español, con un tono profesional pero accesible.
- Prioriza el contexto colombiano (impuestos DIAN, nómina colombiana, normativa local).
- Cuando expliques conceptos, usa ejemplos concretos y numéricos cuando sea útil.
- Si la pregunta está fuera del ámbito contable/financiero, redirige amablemente al tema.
- Usa formato claro: párrafos cortos, resalta términos clave con **negrita**.
- Al final de respuestas complejas, añade una nota breve si se recomienda consultar un contador certificado.
- No inventes normativas ni cifras; si no estás seguro, dilo claramente.`;

  // Lista de modelos de más nuevo a más antiguo — el primero que funcione se usa
  const MODELS = [
    'gemini-3.6-flash',
    'gemini-2.5-flash',
    'gemini-2.0-flash',
    'gemini-1.5-flash',
    'gemini-1.5-pro',
    'gemini-pro'
  ];

  const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
  const KEY = process.env.GEMINI_API_KEY;

  let lastError = 'No se pudo conectar con ningún modelo disponible.';

  for (const model of MODELS) {
    try {
      const response = await fetch(
        `${BASE_URL}/${model}:generateContent?key=${KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
            contents: history,
            generationConfig: { temperature: 0.7, maxOutputTokens: 1024 }
          })
        }
      );

      const data = await response.json();

      // Si el modelo no está disponible o hubo error, probar el siguiente
      if (data.error) {
        lastError = data.error.message;
        continue;
      }

      const reply = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!reply) {
        lastError = 'El modelo no devolvió respuesta.';
        continue;
      }

      // Éxito — devolver respuesta
      return res.status(200).json({ reply, model });

    } catch (err) {
      lastError = `Error de red con ${model}: ${err.message}`;
      continue;
    }
  }

  // Si ningún modelo funcionó
  return res.status(500).json({ error: lastError });
}
