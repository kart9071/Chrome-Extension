import { escapeHtml } from '../utils/helpers';

/* ── Text formatter: escapes everything, allows **bold** and <br> ─── */
function formatText(text) {
  if (!text) return '';
  text = text.replace(/<br\s*\/?>/gi, '<br>');
  text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  return escapeHtml(text)
    .replace(/&lt;br&gt;/g, '<br>')
    .replace(/&lt;strong&gt;(.*?)&lt;\/strong&gt;/g, '<strong>$1</strong>');
}

/* ── Table renderer — uses CSS classes so !important reset is beaten ─ */
function renderTable(headers, rows) {
  if (headers.length === 0 || rows.length === 0) return '';

  const headCells = headers
    .map((h) => `<th>${escapeHtml(h)}</th>`)
    .join('');

  const bodyRows = rows
    .map((row) => {
      const cells = row
        .map((cell, ci) => {
          const isCode =
            headers[ci] &&
            (headers[ci].toLowerCase().includes('icd') ||
              headers[ci].toLowerCase().includes('code') ||
              headers[ci].toLowerCase().includes('hcc'));
          return `<td${isCode ? ' class="code-col"' : ''}>${formatText(cell)}</td>`;
        })
        .join('');
      return `<tr>${cells}</tr>`;
    })
    .join('');

  return (
    `<div class="mr-table-wrap">` +
    `<table class="mr-data-table">` +
    `<thead><tr>${headCells}</tr></thead>` +
    `<tbody>${bodyRows}</tbody>` +
    `</table></div>`
  );
}

/* ── Parser: line-by-line markdown-style (matches original logic) ──── */
function parseMRContent(text) {
  const lines = text.split('\n');
  let html = '';
  let inTable = false;
  let tableHeaders = [];
  let tableRows = [];
  let foundHistorical = false;
  let completedHistorical = false;

  const flushTable = () => {
    if (inTable) {
      html += renderTable(tableHeaders, tableRows);
      inTable = false;
      tableHeaders = [];
      tableRows = [];
    }
  };

  for (const line of lines) {
    if (line.toLowerCase().includes('historical substance use analysis')) {
      foundHistorical = true;
    }

    // Stop after the Historical Substance Use Analysis table completes
    if (
      foundHistorical &&
      completedHistorical &&
      (line.startsWith('###') || line.toUpperCase().includes('CODE CANDIDATE ANALYSIS'))
    ) {
      break;
    }

    if (line.startsWith('## ') || line.startsWith('### ') || line.startsWith('# ')) {
      flushTable();
      const title = line.replace(/^#{1,3}\s/, '').trim();
      html += `<div class="mr-section-header">${escapeHtml(title)}</div>`;
    } else if (line.startsWith('**') && line.endsWith('**') && line.length > 4) {
      flushTable();
      const title = line.slice(2, -2).trim();
      html += `<div class="mr-subsection-header">${escapeHtml(title)}</div>`;
    } else if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
      const cells = line
        .split('|')
        .map((c) => c.trim())
        .filter((c) => c !== '');

      if (!inTable) {
        tableHeaders = cells;
        inTable = true;
      } else if (line.includes('---') || line.includes('===')) {
        // separator row — skip
      } else {
        tableRows.push(cells);
        if (foundHistorical && tableRows.length > 0) completedHistorical = true;
      }
    } else if (line.trim().startsWith('- ')) {
      flushTable();
      const content = line.trim().substring(2);
      html += `<ul class="mr-list"><li>${formatText(content)}</li></ul>`;
    } else if (line.trim() === '') {
      flushTable();
      html += '<div class="mr-spacer"></div>';
    } else if (!inTable) {
      html += `<div class="mr-text">${formatText(line)}</div>`;
    }
  }

  flushTable();

  if (!html.trim()) {
    html =
      `<div style="text-align:center;padding:40px 20px;color:#6c757d;">` +
      `<div style="font-size:24px;margin-bottom:10px;">🔍</div>` +
      `<div>No analysis content found</div></div>`;
  }

  return html;
}

/* ── Component ────────────────────────────────────────────────────── */
export default function MRContent({ mrAnalysisData, isMRLoading }) {
  if (isMRLoading) {
    return (
      <div style={{ padding: 20, color: '#6c757d', fontStyle: 'italic' }}>
        Loading MR analysis...
      </div>
    );
  }

  if (!mrAnalysisData?.chart_summary?.text) {
    return (
      <div style={{ textAlign: 'center', padding: '40px 20px', color: '#6c757d' }}>
        <div style={{ fontSize: 24, marginBottom: 10 }}>📊</div>
        <div>No MR analysis data available</div>
      </div>
    );
  }

  const html = parseMRContent(mrAnalysisData.chart_summary.text);

  return (
    <div className="mr-analysis-section">
      {/* dangerouslySetInnerHTML is safe: content comes from our own API,
          and formatText() HTML-escapes all text before injection */}
      <div
        className="mr-analysis-content"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}
