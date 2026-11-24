/**
 * RoktoLagbe email relay - Google Apps Script
 *
 * Sends the site's emails (verification links, password resets) from YOUR Gmail
 * over HTTPS, because free hosts like Render block outgoing SMTP ports.
 *
 * Setup (once):
 *   1. Sign in to the Gmail account that should send the emails.
 *   2. Open https://script.google.com -> New project. Delete the sample code, paste this file.
 *   3. Project Settings (gear icon) -> Script Properties -> Add script property:
 *        Property: RELAY_SECRET     Value: the same long random value as EMAIL_RELAY_SECRET on the server
 *   4. Deploy -> New deployment -> type "Web app".
 *        Execute as: Me      Who has access: Anyone
 *      -> Deploy -> Authorize access (choose the account, Advanced -> Go to project -> Allow).
 *   5. Copy the "Web app URL" (ends in /exec) into EMAIL_RELAY_URL on the server.
 *
 * Free Gmail accounts can send about 100 emails per day this way.
 * After editing this code: Deploy -> Manage deployments -> edit -> Version: New version -> Deploy.
 */

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var secret = PropertiesService.getScriptProperties().getProperty("RELAY_SECRET");
    if (!secret || data.secret !== secret) return reply({ ok: false, error: "bad secret" });

    var to = String(data.to || "").trim();
    if (!/^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/.test(to)) return reply({ ok: false, error: "bad recipient" });

    MailApp.sendEmail({
      to: to,
      subject: String(data.subject || "").slice(0, 200),
      body: String(data.text || ""),
      htmlBody: data.html ? String(data.html) : undefined,
      name: String(data.name || "RoktoLagbe").slice(0, 60),
    });
    return reply({ ok: true, remainingToday: MailApp.getRemainingDailyQuota() });
  } catch (err) {
    return reply({ ok: false, error: String(err && err.message ? err.message : err) });
  }
}

// Opening the URL in a browser shows that the relay is deployed
function doGet() {
  return reply({ ok: true, service: "RoktoLagbe email relay" });
}

function reply(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
