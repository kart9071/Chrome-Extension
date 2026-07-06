import DQACard from './DQACard';

/* ── Filter logic ─────────────────────────────────────────────────── */
function applyFilters(data, strengthFilter, categoryFilters) {
  const strength = (strengthFilter || 'WEAK').trim().toUpperCase();

  let filtered = data.filter(
    (row) =>
      (row.documentation_strength || '').trim().toUpperCase() === strength
  );

  filtered = filtered.filter((row) => {
    const hcc = (row.hcc || '').toString().trim();
    const rxHcc = (row.rx_hcc || '').toString().trim();

    if (categoryFilters.includes('HCC') && hcc !== '') return true;
    if (categoryFilters.includes('RXHCC') && rxHcc !== '') return true;
    if (categoryFilters.includes('NON-HCC') && hcc === '' && rxHcc === '')
      return true;
    return false;
  });

  return filtered;
}

/* ── Icons used in the legend ─────────────────────────────────────── */
function LegendCheckIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
    >
      <path
        d="M5 13L10 18L19 6"
        stroke="#22C55E"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function LegendFlaskIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="9"
      height="9"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14 2v6a2 2 0 0 0 .245.96l5.51 10.08A2 2 0 0 1 18 22H6a2 2 0 0 1-1.755-2.96l5.51-10.08A2 2 0 0 0 10 8V2" />
      <path d="M6.453 15h11.094" />
      <path d="M8.5 2h7" />
    </svg>
  );
}

/* ── Not-present state ────────────────────────────────────────────── */
function NotPresent() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 300,
        textAlign: 'center',
        padding: '40px 20px',
        color: '#6c757d',
      }}
    >
      <div style={{ fontSize: 36, marginBottom: 14 }}>ℹ️</div>
      <div style={{ fontSize: 16, fontWeight: 600, color: '#374151' }}>
        The DQA Details for this member is not present.
      </div>
      <div style={{ marginTop: 8, fontSize: 13, color: '#9ca3af' }}>
        If you believe this is an error, try refreshing or contact support.
      </div>
    </div>
  );
}

/* ── Component ────────────────────────────────────────────────────── */
export default function DQAContent({
  dqaData,
  dqaNotPresent,
  isDqaLoading,
  dqaStrengthFilter,
  setDqaStrengthFilter,
  dqaCategoryFilters,
  setDqaCategoryFilters,
}) {
  if (isDqaLoading) {
    return (
      <div style={{ padding: 20, color: '#6c757d', fontStyle: 'italic' }}>
        Loading DQA details...
      </div>
    );
  }

  if (dqaNotPresent || dqaData.length === 0) {
    return <NotPresent />;
  }

  const filtered = applyFilters(dqaData, dqaStrengthFilter, dqaCategoryFilters);

  const STRENGTH_TABS = ['WEAK', 'MODERATE', 'STRONG'];

  function toggleCategory(cat) {
    if (dqaCategoryFilters.includes(cat)) {
      setDqaCategoryFilters(dqaCategoryFilters.filter((f) => f !== cat));
    } else {
      setDqaCategoryFilters([...dqaCategoryFilters, cat]);
    }
  }

  const legendStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    color: '#64748b',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* ── Filter toolbar ────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          flexWrap: 'wrap',
          background: '#fff',
          borderBottom: '1px solid #e5e7eb',
          flexShrink: 0,
        }}
      >
        {/* Strength tabs + legend */}
        <div className="dqa-filter-tabs">
          <div>
            {STRENGTH_TABS.map((tab) => (
              <button
                key={tab}
                className={`dqa-filter-btn${dqaStrengthFilter === tab ? ' active' : ''}`}
                onClick={() => setDqaStrengthFilter(tab)}
                type="button"
              >
                {tab.charAt(0) + tab.slice(1).toLowerCase()}
              </button>
            ))}
          </div>

          {/* Legend */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 9,
              fontWeight: 600,
              color: '#64748b',
              flexWrap: 'wrap',
            }}
          >
            <span style={legendStyle}>📅 Encounter Dates</span>
            <span style={legendStyle}>
              <LegendCheckIcon /> MEAT Present
            </span>
            <span style={legendStyle}>❌ MEAT Absent</span>
            <span style={legendStyle}>
              <LegendFlaskIcon /> Supporting Evidence
            </span>
          </div>
        </div>
      </div>

      {/* ── Category checkboxes ───────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          fontSize: 12,
          padding: '6px 10px',
          background: '#f8fafc',
          borderBottom: '1px solid #e5e7eb',
          flexShrink: 0,
        }}
      >
        {[
          { value: 'HCC', label: 'HCC' },
          { value: 'RXHCC', label: 'RXHCC' },
          { value: 'NON-HCC', label: 'NON-HCC' },
        ].map(({ value, label }) => (
          <label
            key={value}
            style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}
          >
            <input
              type="checkbox"
              checked={dqaCategoryFilters.includes(value)}
              onChange={() => toggleCategory(value)}
            />
            {label}
          </label>
        ))}
      </div>

      {/* ── Cards ─────────────────────────────────────────────── */}
      <div className="dqa-conditions-scroll">
        {filtered.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: '40px 20px',
              fontSize: 14,
              color: '#6c757d',
              fontStyle: 'italic',
            }}
          >
            No DQA records found
          </div>
        ) : (
          filtered.map((row, idx) => (
            <DQACard key={row.id ?? idx} row={row} />
          ))
        )}
      </div>
    </div>
  );
}
