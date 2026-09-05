/** Minimal, dependency-free email shell so every message looks the same. */
export function renderEmail(opts: { title: string; intro: string; bodyLines?: string[]; cta?: { label: string; href: string } }) {
  const lines = opts.bodyLines ?? [];
  const text = [opts.title, "", opts.intro, ...lines, opts.cta ? `\n${opts.cta.label}: ${opts.cta.href}` : ""]
    .filter(Boolean)
    .join("\n");

  const html = `<!doctype html><html><body style="margin:0;background:#fafafa;font-family:Inter,Arial,sans-serif;color:#2b2b2b">
  <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
    <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border:1px solid #ececec;border-radius:12px">
      <tr><td style="padding:24px 28px;border-bottom:1px solid #f1f1f1;font-weight:700;font-size:15px;color:#e8590c">DealFlow360</td></tr>
      <tr><td style="padding:28px">
        <h1 style="margin:0 0 12px;font-size:20px;line-height:1.3">${escapeHtml(opts.title)}</h1>
        <p style="margin:0 0 16px;font-size:14px;line-height:1.6">${escapeHtml(opts.intro)}</p>
        ${lines.map((l) => `<p style="margin:0 0 8px;font-size:14px;line-height:1.6">${escapeHtml(l)}</p>`).join("")}
        ${opts.cta ? `<p style="margin:24px 0 0"><a href="${opts.cta.href}" style="background:#f97316;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-size:14px;display:inline-block">${escapeHtml(opts.cta.label)}</a></p>` : ""}
      </td></tr>
    </table>
  </td></tr></table></body></html>`;

  return { text, html };
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}
