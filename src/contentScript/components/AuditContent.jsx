import AuditCard from './AuditCard';

/* ── Filter ───────────────────────────────────────────────────────── */
function filterAuditData(data, term) {
  const t = (term || '').trim().toLowerCase();
  if (!t) return data;
  return data.filter(
    (r) =>
      r.Condition?.toLowerCase().includes(t) ||
      r['ICD-10']?.toLowerCase().includes(t) ||
      r.HCC?.toString().includes(t) ||
      r.RxHCC?.toString().includes(t) ||
      r.Status?.toLowerCase().includes(t)
  );
}

/* ── Sort ─────────────────────────────────────────────────────────── */
function sortAuditData(data, config) {
  if (!config.key) return data;
  return [...data].sort((a, b) => {
    const aVal = String(a[config.key] || '').toLowerCase();
    const bVal = String(b[config.key] || '').toLowerCase();
    if (aVal < bVal) return config.direction === 'asc' ? -1 : 1;
    if (aVal > bVal) return config.direction === 'asc' ? 1 : -1;
    return 0;
  });
}

/* ── Sort button ──────────────────────────────────────────────────── */
function SortButton({ label, sortKey, config, onSort }) {
  const isActive = config.key === sortKey;
  const arrow = !isActive ? '' : config.direction === 'asc' ? ' ↑' : ' ↓';
  return (
    <button
      type="button"
      onClick={() => onSort(sortKey)}
      style={{
        border: `1px solid ${isActive ? '#1e40af' : '#cbd5e1'}`,
        background: isActive ? '#dbeafe' : '#f8fafc',
        color: isActive ? '#1e40af' : '#334155',
        padding: '4px 10px',
        borderRadius: 6,
        cursor: 'pointer',
        fontSize: 11,
        fontWeight: 600,
      }}
    >
      {label}{arrow}
    </button>
  );
}

/* ── Empty state ──────────────────────────────────────────────────── */
function EmptyState({ searching }) {
  return (
    <div
      style={{
        textAlign: 'center',
        padding: '40px 20px',
        fontSize: 14,
        color: '#6c757d',
        fontStyle: 'italic',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
      }}
    >
      <div style={{ fontSize: 24 }}>🔍</div>
      <div>{searching ? 'No matching audit records.' : 'No audit records found.'}</div>
    </div>
  );
}

/* ── Component ────────────────────────────────────────────────────── */
export default function AuditContent({
  conditionAuditData,
  conditionAuditSearchTerm,
  setConditionAuditSearchTerm,
  conditionAuditSortConfig,
  sortAudit,
  expandedAuditRows,
  toggleAuditRow,
}) {
  const filtered = filterAuditData(conditionAuditData, conditionAuditSearchTerm);
  const sorted = sortAuditData(filtered, conditionAuditSortConfig);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* ── Search + sort bar ─────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 10px',
          background: '#fff',
          borderBottom: '1px solid #e5e7eb',
          flexShrink: 0,
          flexWrap: 'wrap',
        }}
      >
        <input
          type="text"
          placeholder="Search conditions, ICD, HCC…"
          value={conditionAuditSearchTerm}
          onChange={(e) => setConditionAuditSearchTerm(e.target.value)}
          style={{
            flex: 1,
            minWidth: 140,
            padding: '5px 10px',
            border: '1px solid #cbd5e1',
            borderRadius: 6,
            fontSize: 12,
            outline: 'none',
          }}
        />
        <SortButton
          label="Condition"
          sortKey="Condition"
          config={conditionAuditSortConfig}
          onSort={sortAudit}
        />
        <SortButton
          label="Status"
          sortKey="Status"
          config={conditionAuditSortConfig}
          onSort={sortAudit}
        />
      </div>

      {/* ── Accordion list ────────────────────────────────────── */}
      <div
        className="audit-accordion-container"
        style={{ flex: 1, overflowY: 'auto', maxHeight: 'calc(100vh - 145px)' }}
      >
        {sorted.length === 0 ? (
          <EmptyState searching={!!conditionAuditSearchTerm} />
        ) : (
          sorted.map((row, idx) => {
            const rowId = String(row.id ?? idx);
            return (
              <AuditCard
                key={rowId}
                row={row}
                isExpanded={expandedAuditRows.has(rowId)}
                onToggle={toggleAuditRow}
              />
            );
          })
        )}
      </div>
    </div>
  );
}
