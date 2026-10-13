// ---------------------------------------------------------------------------
// EMAIL-AS-A-SERVICE: Brevo transactional email API.
// The API key stays on the server (BREVO_API_KEY) and is never sent to React.
// ---------------------------------------------------------------------------
const escapeHtml = (s = '') =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Returns { ok: true } or { ok: false, error }. It never throws, so a failed email
// cannot break the matching flow (the match stays stored, status becomes "failed").
export async function sendMatchEmail({ toEmail, toName, itemName, description, otherItemName, score, location }) {
  const apiKey = process.env.BREVO_API_KEY;
  const senderEmail = process.env.BREVO_SENDER_EMAIL;
  if (!apiKey || !senderEmail) return { ok: false, error: 'Brevo is not configured' };

  const percent = (score * 100).toFixed(1);
  const appUrl = process.env.APP_URL || '';

  const text = [
    `Hello ${toName},`, '',
    'We found a potential match for your reported item.', '',
    `Item:\n${itemName}`, '',
    `Description:\n${description}`, '',
    `Potential matching item:\n${otherItemName}`, '',
    `Similarity Score:\n${percent}%`, '',
    `Location:\n${location}`, '',
    'Please log into the Lost & Found platform to review the match and coordinate the return.',
    appUrl, '', 'Thank you.',
  ].join('\n');

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#101b2d;line-height:1.5">
      <p>Hello ${escapeHtml(toName)},</p>
      <p>We found a potential match for your reported item.</p>
      <p><strong>Item:</strong><br>${escapeHtml(itemName)}</p>
      <p><strong>Description:</strong><br>${escapeHtml(description)}</p>
      <p><strong>Potential matching item:</strong><br>${escapeHtml(otherItemName)}</p>
      <p><strong>Similarity Score:</strong><br>${percent}%</p>
      <p><strong>Location:</strong><br>${escapeHtml(location)}</p>
      <p>Please log into the Lost &amp; Found platform to review the match and coordinate the return.</p>
      ${appUrl ? `<p><a href="${escapeHtml(appUrl)}">Open Lost &amp; Found</a></p>` : ''}
      <p>Thank you.</p>
    </div>`;

  try {
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': apiKey, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        sender: { name: process.env.BREVO_SENDER_NAME || 'Campus Lost & Found', email: senderEmail },
        to: [{ email: toEmail, name: toName }],
        subject: 'Potential Lost & Found Match Found',
        htmlContent: html,
        textContent: text,
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) {
      const body = await response.text().catch(() => '');
      return { ok: false, error: `Brevo ${response.status}: ${body.slice(0, 200)}` };
    }
    const json = await response.json().catch(() => ({}));
    return { ok: true, messageId: json.messageId };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}
