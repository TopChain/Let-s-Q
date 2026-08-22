import { apiRequest, ensureHostSession } from './neon-api-client.js';

let latestReport = null;
let loadingReport = false;

function readJson(key, fallback = null) {
  try { return JSON.parse(localStorage.getItem(key) || '') ?? fallback; } catch { return fallback; }
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function minutesBetween(start, end) {
  const a = start ? new Date(start).getTime() : NaN;
  const b = end ? new Date(end).getTime() : NaN;
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return null;
  return (b - a) / 60000;
}

function mean(values) {
  const usable = values.filter(Number.isFinite);
  return usable.length ? usable.reduce((sum, value) => sum + value, 0) / usable.length : null;
}

function bucketLabel(date) {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  d.setMinutes(d.getMinutes() < 30 ? 0 : 30, 0, 0);
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function buildArrivalBuckets(tickets) {
  const map = new Map();
  for (const ticket of tickets) {
    const date = new Date(ticket.created_at);
    if (Number.isNaN(date.getTime())) continue;
    date.setMinutes(date.getMinutes() < 30 ? 0 : 30, 0, 0);
    const key = date.toISOString();
    map.set(key, (map.get(key) || 0) + 1);
  }
  return Array.from(map, ([key, count]) => ({ key, label: bucketLabel(key), count }))
    .sort((a, b) => a.key.localeCompare(b.key));
}

async function fetchReport() {
  await ensureHostSession();
  const queueId = readJson('letsq.neon.hostQueueId') || readJson('letsq.supabase.hostQueueId');
  if (!queueId) throw new Error('No Host queue is saved on this device yet.');
  const report = await apiRequest('get-report', { queueId }, { host: true });
  if (!report?.queue) throw new Error('This Host queue is no longer available.');
  const queue = report.queue;
  const tickets = report.tickets || [];
  const ratings = report.ratings || [];
  const served = tickets.filter(ticket => ticket.status === 'served').length;
  const cancelled = tickets.filter(ticket => ticket.status === 'cancelled').length;
  const active = tickets.filter(ticket => ['waiting', 'called', 'ready', 'hold'].includes(ticket.status)).length;
  const waits = tickets.map(ticket => minutesBetween(ticket.created_at, ticket.called_at)).filter(Number.isFinite);
  const serviceTimes = tickets.map(ticket => minutesBetween(ticket.called_at, ticket.served_at)).filter(Number.isFinite);
  const ratingValues = ratings.flatMap(rating => [Number(rating.wait_score), Number(rating.service_score), Number(rating.return_score)]);
  const arrivals = buildArrivalBuckets(tickets);
  const peak = arrivals.reduce((best, item) => !best || item.count > best.count ? item : best, null);

  return {
    generatedAt: new Date(),
    queue,
    tickets,
    ratings,
    joined: tickets.length,
    served,
    cancelled,
    active,
    completionRate: tickets.length ? (served / tickets.length) * 100 : 0,
    averageWait: mean(waits),
    averageService: mean(serviceTimes),
    averageRating: mean(ratingValues),
    arrivals,
    peak
  };
}

function metric(value, suffix = '') {
  return Number.isFinite(value) ? `${Math.round(value * 10) / 10}${suffix}` : '—';
}

function reportMarkup(report) {
  const peakText = report.peak
    ? `${escapeHtml(report.peak.label)} was the busiest 30-minute window with ${report.peak.count} ${report.peak.count === 1 ? 'join' : 'joins'}.`
    : 'No arrivals have been recorded for this queue yet.';
  const max = Math.max(1, ...report.arrivals.map(item => item.count));
  const arrivalRows = report.arrivals.length
    ? report.arrivals.map(item => `<div style="display:grid;grid-template-columns:70px 1fr 38px;gap:8px;align-items:center;margin:8px 0"><span class="tiny">${escapeHtml(item.label)}</span><div style="height:10px;background:var(--cloud);border-radius:999px;overflow:hidden"><div style="height:100%;width:${Math.max(4, (item.count / max) * 100)}%;background:var(--brand);border-radius:999px"></div></div><b style="font-size:12px;text-align:right">${item.count}</b></div>`).join('')
    : '<p class="subtitle">No arrival history yet.</p>';

  return `
    <div class="report-highlight">
      <span class="tiny">THE MAIN TAKEAWAY</span>
      <b>${peakText}</b>
      <p>These totals use anonymous queue timing and rating data only.</p>
    </div>
    <div class="grid-2" style="margin-top:14px">
      <div class="stat-card"><b>${report.joined}</b><span>Joined</span></div>
      <div class="stat-card"><b>${report.served}</b><span>Served</span></div>
      <div class="stat-card"><b>${metric(report.averageWait, 'm')}</b><span>Avg wait</span></div>
      <div class="stat-card"><b>${metric(report.averageRating, '/5')}</b><span>Guest rating</span></div>
    </div>
    <div class="grid-2" style="margin-top:10px">
      <div class="stat-card"><b>${report.active}</b><span>Still active</span></div>
      <div class="stat-card"><b>${report.cancelled}</b><span>Cancelled</span></div>
      <div class="stat-card"><b>${metric(report.completionRate, '%')}</b><span>Completion</span></div>
      <div class="stat-card"><b>${metric(report.averageService, 'm')}</b><span>Avg service</span></div>
    </div>
    <div class="card" style="margin-top:14px">
      <div class="card-title"><h3>When guests joined</h3><span class="tiny">every 30 min</span></div>
      ${arrivalRows}
    </div>
    <div class="card" style="margin-top:14px">
      <div class="card-title"><h3>${escapeHtml(report.queue.event_name || report.queue.booth_name || 'Host report')}</h3><span class="tiny">${escapeHtml(report.queue.queue_name || 'Queue')}</span></div>
      <p class="subtitle">Generated ${escapeHtml(report.generatedAt.toLocaleString())}. Reports never include guest names, phone numbers, or email addresses.</p>
      <button class="btn secondary wide" type="button" onclick="exportLetsQReport()">Export report as PDF</button>
    </div>`;
}

async function renderLiveReport() {
  const insights = document.getElementById('reportInsights');
  if (!insights || insights.style.display === 'none' || loadingReport) return;
  loadingReport = true;
  insights.innerHTML = '<div class="card"><h3>Loading your private report…</h3><p class="subtitle">Reading anonymous queue totals.</p></div>';
  try {
    latestReport = await fetchReport();
    insights.innerHTML = reportMarkup(latestReport);
  } catch (error) {
    latestReport = null;
    insights.innerHTML = `<div class="card"><h3>Report unavailable</h3><p class="subtitle">${escapeHtml(error?.message || 'Could not load this report.')}</p><button class="btn secondary wide" type="button" onclick="renderLetsQReport()">Try again</button></div>`;
  } finally {
    loadingReport = false;
  }
}

function ascii(value) {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[^\x20-\x7E]/g, '?');
}

function pdfEscape(value) {
  return ascii(value).replaceAll('\\', '\\\\').replaceAll('(', '\\(').replaceAll(')', '\\)');
}

function createPdf(lines) {
  const visibleLines = lines.slice(0, 38);
  const content = [
    'BT', '/F1 12 Tf', '50 760 Td',
    ...visibleLines.flatMap((line, index) => index === 0 ? [`(${pdfEscape(line)}) Tj`] : ['0 -18 Td', `(${pdfEscape(line)}) Tj`]),
    'ET'
  ].join('\n');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((body, index) => {
    offsets[index + 1] = pdf.length;
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xrefOffset = pdf.length;
  const xrefSpace = String.fromCharCode(32);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f${xrefSpace}\n`;
  for (let index = 1; index <= objects.length; index += 1) {
    pdf += `${String(offsets[index]).padStart(10, '0')} 00000 n${xrefSpace}\n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return new Blob([pdf], { type: 'application/pdf' });
}

function reportLines(report) {
  const queueName = report.queue.event_name || report.queue.booth_name || 'Host queue';
  return [
    "Let's Q - Anonymous Host Report",
    `${queueName} / ${report.queue.queue_name || 'Queue'}`,
    `Generated: ${report.generatedAt.toLocaleString()}`,
    '',
    `Joined: ${report.joined}`,
    `Served: ${report.served}`,
    `Still active: ${report.active}`,
    `Cancelled: ${report.cancelled}`,
    `Completion rate: ${metric(report.completionRate, '%')}`,
    `Average wait: ${metric(report.averageWait, ' min')}`,
    `Average service: ${metric(report.averageService, ' min')}`,
    `Average guest rating: ${metric(report.averageRating, '/5')}`,
    `Ratings submitted: ${report.ratings.length}`,
    '',
    report.peak ? `Peak arrival window: ${report.peak.label} (${report.peak.count} joins)` : 'Peak arrival window: no arrivals yet',
    '',
    ...report.arrivals.slice(0, 16).map(item => `${item.label}: ${item.count} joins`),
    '',
    'Privacy: anonymous aggregate queue data only; no guest name, phone, or email.'
  ];
}

async function exportPdf() {
  if (!latestReport) {
    await renderLiveReport();
    if (!latestReport) return;
  }
  const blob = createPdf(reportLines(latestReport));
  const filename = `lets-q-report-${new Date().toISOString().slice(0, 10)}.pdf`;
  const file = new File([blob], filename, { type: 'application/pdf' });
  try {
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: "Let's Q report" });
      return;
    }
  } catch (error) {
    if (error?.name === 'AbortError') return;
  }
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

window.renderLetsQReport = renderLiveReport;
window.exportLetsQReport = exportPdf;

window.addEventListener('load', () => {
  const originalRenderReport = window.renderReport;
  if (typeof originalRenderReport !== 'function') return;
  window.renderReport = function renderReportWithLiveData() {
    originalRenderReport();
    const insights = document.getElementById('reportInsights');
    if (insights && insights.style.display !== 'none') void renderLiveReport();
  };
});
