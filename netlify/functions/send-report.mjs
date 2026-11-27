const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const TENANTS = {
  wievonselbstai: {
    name: 'wievonselbstai',
    from: process.env.RESEND_FROM || 'wievonselbstai <onboarding@resend.dev>',
    replyTo: process.env.REPLY_TO || undefined
  },
  demo: {
    name: 'Demo-Rechner',
    from: process.env.RESEND_FROM || 'Demo-Rechner <onboarding@resend.dev>',
    replyTo: process.env.REPLY_TO || undefined
  }
};

function json(statusCode, body, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status: statusCode,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...extraHeaders
    }
  });
}

export default async (request, context) => {
  if (request.method !== 'POST') {
    return json(405, { error: 'Methode nicht erlaubt.' }, { Allow: 'POST' });
  }

  const origin = request.headers.get('origin');
  const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map(value => value.trim())
    .filter(Boolean);

  if (allowedOrigins.length && origin && !allowedOrigins.includes(origin)) {
    return json(403, { error: 'Diese Website ist für den Versand nicht freigeschaltet.' });
  }

  if (!process.env.RESEND_API_KEY) {
    return json(503, { error: 'Der E-Mail-Versand ist noch nicht konfiguriert. Der PDF-Download funktioniert weiterhin.' });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json(400, { error: 'Ungültige Anfrage.' });
  }

  const {
    tenantId = 'wievonselbstai',
    email,
    firstName = '',
    pdfBase64
  } = body || {};

  const tenant = TENANTS[tenantId];
  if (!tenant) return json(400, { error: 'Unbekannte Rechner-Konfiguration.' });

  if (typeof email !== 'string' || !EMAIL_RE.test(email) || email.length > 254) {
    return json(400, { error: 'Bitte gib eine gültige E-Mail-Adresse ein.' });
  }

  if (typeof pdfBase64 !== 'string' || pdfBase64.length < 100 || pdfBase64.length > 3_500_000) {
    return json(400, { error: 'Der PDF-Report ist ungültig oder zu groß.' });
  }

  if (typeof firstName !== 'string' || !/^[A-Za-zÀ-ÿ0-9 .'-]{0,80}$/.test(firstName)) {
    return json(400, { error: 'Der Vorname enthält ungültige Zeichen.' });
  }

  let pdfBuffer;
  try {
    pdfBuffer = Buffer.from(pdfBase64, 'base64');
  } catch {
    return json(400, { error: 'Der PDF-Report ist ungültig.' });
  }

  if (pdfBuffer.subarray(0, 4).toString() !== '%PDF') {
    return json(400, { error: 'Die Datei ist kein gültiges PDF.' });
  }

  const safeFirstName = escapeHtml(firstName);
  const html = `<div style="font-family:Arial,sans-serif;color:#24332b;line-height:1.6"><h2>Dein Stundensatz-Report</h2><p>Hallo ${safeFirstName}${firstName ? ',' : ''}</p><p>anbei findest du deinen persönlichen Report aus dem Echter-Stundensatz-Rechner.</p><p>Viele Grüße<br>${escapeHtml(tenant.name)}</p></div>`;

  const payload = {
    from: tenant.from,
    to: [email],
    subject: 'Dein persönlicher Stundensatz-Report',
    html,
    attachments: [{
      filename: 'wievonselbstai-echter-stundensatz.pdf',
      content: pdfBuffer.toString('base64')
    }]
  };

  if (tenant.replyTo) payload.reply_to = tenant.replyTo;

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error('Resend request failed', { status: response.status, name: result.name || null });
      return json(502, { error: 'Der E-Mail-Dienst konnte den Report nicht versenden. Bitte versuche es später erneut.' });
    }

    return json(200, { ok: true, id: result.id || null });
  } catch (error) {
    console.error('Email delivery failed', error?.message || 'unknown error');
    return json(502, { error: 'Der E-Mail-Versand ist fehlgeschlagen. Bitte versuche es später erneut.' });
  }
};

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[character]));
}
