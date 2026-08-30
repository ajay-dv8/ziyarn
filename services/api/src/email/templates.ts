import { formatMoney } from "@repo/money";

export type BookingTemplateInput = {
  domainName: string;
  booking: {
    name: string | null;
    date: string;
    time: string;
    topic: string | null;
  };
};

export type PaymentTemplateInput = {
  domainName: string;
  payment: {
    amountMinor: number;
    currency: string;
    description: string | null;
    id: string;
  };
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatDate(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  if (!year || !month || !day) {
    return date;
  }
  const value = new Date(Date.UTC(year, month - 1, day));
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(value);
}

function formatTime(time: string): string {
  const [hour, minute] = time.split(":").map(Number);
  if (hour === undefined || minute === undefined) {
    return time;
  }
  const period = hour >= 12 ? "PM" : "AM";
  const display = hour % 12 === 0 ? 12 : hour % 12;
  return `${display}:${minute.toString().padStart(2, "0")} ${period}`;
}

const WRAPPER = `
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background-color:#ffffff;border-radius:12px;overflow:hidden;">
          <tr>
            <td style="background-color:#18181b;color:#ffffff;padding:20px 28px;">
              <div style="font-size:14px;font-weight:bold;letter-spacing:0.5px;">__DOMAIN__</div>
            </td>
          </tr>
          <tr>
            <td style="padding:28px;">
              __BODY__
            </td>
          </tr>
          <tr>
            <td style="padding:16px 28px;border-top:1px solid #e4e4e7;color:#71717a;font-size:12px;">
              This is an automated message. No need to reply to this email.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
`;

function render(domainName: string, body: string): string {
  const html = `<!doctype html><html><head><meta charset="utf-8" /></head>${WRAPPER}`
    .replace("__DOMAIN__", escapeHtml(domainName))
    .replace("__BODY__", body);
  return html;
}

function detailsRow(label: string, value: string): string {
  return `
  <tr>
    <td style="padding:8px 0;color:#71717a;font-size:13px;width:96px;">${label}</td>
    <td style="padding:8px 0;color:#18181b;font-size:14px;font-weight:600;">${value}</td>
  </tr>`;
}

export function bookingConfirmationTemplate(
  input: BookingTemplateInput,
): { subject: string; text: string; html: string } {
  const { domainName, booking } = input;
  const greeting = booking.name ? `Hi ${escapeHtml(booking.name)},` : "Hi there,";
  const topicHtml = booking.topic
    ? `<p style="margin:0 0 4px;font-size:13px;color:#71717a;">Topic</p><p style="margin:0 0 20px;font-size:15px;color:#18181b;">${escapeHtml(booking.topic)}</p>`
    : "";
  const body = `
    <h1 style="margin:0 0 12px;font-size:20px;color:#18181b;">Booking confirmed</h1>
    <p style="margin:0 0 24px;font-size:15px;color:#52525b;">${greeting} Your booking with ${escapeHtml(domainName)} is confirmed. Here are the details:</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
      ${detailsRow("Date", formatDate(booking.date))}
      ${detailsRow("Time", formatTime(booking.time))}
    </table>
    ${topicHtml}
    <p style="margin:0;font-size:14px;color:#71717a;">See you then!</p>`;
  const text = [
    "Booking confirmed",
    "",
    `${greeting} Your booking with ${domainName} is confirmed.`,
    `Date: ${formatDate(booking.date)}`,
    `Time: ${formatTime(booking.time)}`,
    ...(booking.topic ? [`Topic: ${booking.topic}`] : []),
    "",
    "See you then!",
  ].join("\n");
  return {
    subject: `Booking confirmed with ${domainName}`,
    text,
    html: render(domainName, body),
  };
}

export function bookingCancelledTemplate(
  input: BookingTemplateInput,
): { subject: string; text: string; html: string } {
  const { domainName, booking } = input;
  const greeting = booking.name ? `Hi ${escapeHtml(booking.name)},` : "Hi there,";
  const topicHtml = booking.topic
    ? `<p style="margin:0 0 4px;font-size:13px;color:#71717a;">Topic</p><p style="margin:0 0 20px;font-size:15px;color:#18181b;">${escapeHtml(booking.topic)}</p>`
    : "";
  const body = `
    <h1 style="margin:0 0 12px;font-size:20px;color:#18181b;">Booking cancelled</h1>
    <p style="margin:0 0 24px;font-size:15px;color:#52525b;">${greeting} Your booking with ${escapeHtml(domainName)} has been cancelled. Here were the details:</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
      ${detailsRow("Date", formatDate(booking.date))}
      ${detailsRow("Time", formatTime(booking.time))}
    </table>
    ${topicHtml}
    <p style="margin:0;font-size:14px;color:#71717a;">If this was a mistake, please contact us to rebook.</p>`;
  const text = [
    "Booking cancelled",
    "",
    `${greeting} Your booking with ${domainName} has been cancelled.`,
    `Date: ${formatDate(booking.date)}`,
    `Time: ${formatTime(booking.time)}`,
    ...(booking.topic ? [`Topic: ${booking.topic}`] : []),
    "",
    "If this was a mistake, please contact us to rebook.",
  ].join("\n");
  return {
    subject: `Booking cancelled with ${domainName}`,
    text,
    html: render(domainName, body),
  };
}

export function paymentReceiptTemplate(
  input: PaymentTemplateInput,
): { subject: string; text: string; html: string } {
  const { domainName, payment } = input;
  const amount = formatMoney({
    amountMinor: payment.amountMinor,
    currency: payment.currency,
  });
  const reference = payment.id.slice(0, 8).toUpperCase();
  const descriptionHtml = payment.description
    ? `<p style="margin:0 0 20px;font-size:15px;color:#52525b;">${escapeHtml(payment.description)}</p>`
    : "";
  const body = `
    <h1 style="margin:0 0 12px;font-size:20px;color:#18181b;">Payment received</h1>
    <p style="margin:0 0 20px;font-size:15px;color:#52525b;">Thanks for your payment to ${escapeHtml(domainName)}.</p>
    ${descriptionHtml}
    <div style="background-color:#f4f4f5;border-radius:8px;padding:16px 20px;margin-bottom:20px;">
      <div style="font-size:13px;color:#71717a;">Amount paid</div>
      <div style="font-size:24px;font-weight:bold;color:#18181b;">${amount}</div>
    </div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      ${detailsRow("Reference", reference)}
    </table>`;
  const text = [
    "Payment received",
    "",
    `Thanks for your payment to ${domainName}.`,
    ...(payment.description ? [payment.description] : []),
    `Amount paid: ${amount}`,
    `Reference: ${reference}`,
  ].join("\n");
  return {
    subject: `Payment received by ${domainName}`,
    text,
    html: render(domainName, body),
  };
}
