/* ── Icons ────────────────────────────────────────────────────────── */

function FlaskIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M10 2v7.527a2 2 0 0 1-.211.896L4.72 20.55a1 1 0 0 0 .9 1.45h12.76a1 1 0 0 0 .9-1.45l-5.069-10.127A2 2 0 0 1 14 9.527V2" />
      <path d="M8.5 2h7" />
      <path d="M7 16h10" />
    </svg>
  );
}

function ShieldQuestionIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-4 h-4 text-amber-600"
    >
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
      <path d="M9.1 9a3 3 0 0 1 5.82 1c0 2-3 3-3 3" />
      <path d="M12 17h.01" />
    </svg>
  );
}

function MessageIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

/* ── Sub-components ───────────────────────────────────────────────── */

function CodeTypeBadge({ codeType }) {
  if (!codeType) return null;
  const upper = codeType.toUpperCase();
  if (upper === 'MISSED') {
    return <span className="code-type-badge documented">OPPORTUNITY</span>;
  }
  if (upper === 'UPGRADE') {
    return <span className="code-type-badge opportunities">{codeType}</span>;
  }
  return (
    <span className={`code-type-badge ${codeType.toLowerCase()}`}>
      {codeType}
    </span>
  );
}

function CodeExplanation({ raw }) {
  const text = (raw || '').trim();
  if (!text) return null;

  const suggestionIndex = text.search(/suggestion:/i);
  let typePart = '';
  let suggestionPart = '';

  if (suggestionIndex !== -1) {
    typePart = text.slice(0, suggestionIndex).trim();
    suggestionPart = text.slice(suggestionIndex).replace(/suggestion:/i, '').trim();
  } else {
    const typeMatch = text.match(/type:\s*([^\n\r]+)/i);
    if (typeMatch) {
      typePart = typeMatch[1].trim();
      const after = text.slice(typeMatch.index + typeMatch[0].length).trim();
      if (after) suggestionPart = after;
    } else {
      suggestionPart = text.trim();
    }
  }

  typePart = typePart.replace(/^\s*type:\s*/i, '').trim();
  suggestionPart = suggestionPart.replace(/^\s*suggestion:\s*/i, '').trim();

  if (!typePart && !suggestionPart) return null;

  return (
    <div className="card-info-row code-explanation-row">
      <div className="flex-shrink-0 p-1 bg-amber-100 rounded-full">
        <ShieldQuestionIcon />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {typePart && (
          <div>
            <strong>Type:</strong> {typePart}
          </div>
        )}
        {suggestionPart && (
          <div>
            <strong>Suggestion:</strong> {suggestionPart}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Card ─────────────────────────────────────────────────────────── */

export default function MedicalConditionCard({ condition }) {
  const {
    details = {},
    title = '',
    clinicalIndicators = '',
    codeExplanation = '',
    description = '',
    noteText = '',
  } = condition;

  const RADV_score = details.RADV_score || 0;
  const code_status = details.code_status || '';
  const hcc28 = details.hcc28;
  const rxHcc = details.rxHcc;

  const hasHcc = Array.isArray(hcc28) ? hcc28.length > 0 : !!hcc28;
  const hasRxHcc = Array.isArray(rxHcc) ? rxHcc.length > 0 : !!rxHcc;
  const isRADV =
    code_status === 'DOCUMENTED' &&
    RADV_score > 0 &&
    RADV_score < 4 &&
    (hasHcc || hasRxHcc);

  const explanationText = (codeExplanation || '').trim() || (description || '');

  return (
    <div className={`medical-condition-card${isRADV ? ' radv' : ''}`}>
      {/* Badges */}
      <div className="card-badges-row">
        <div className="badge-group">
          {details.icd10 && (
            <span className="icd-badge">ICD: {details.icd10}</span>
          )}
          {hcc28 && (
            <span className="hcc-badge">HCC: {hcc28}</span>
          )}
          {rxHcc && (
            <span className="rx-hcc-badge">Rx-HCC: {rxHcc}</span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <CodeTypeBadge codeType={details.code_type} />
          {isRADV && (
            <span className="audit-score-icon">Audit: {RADV_score}</span>
          )}
        </div>
      </div>

      {/* Title */}
      <h5 className="card-title">{title}</h5>

      {/* Clinical indicators */}
      {clinicalIndicators && (
        <div className="card-info-row indicators-row">
          <span className="label">
            <FlaskIcon />
          </span>
          <span className="value">{clinicalIndicators}</span>
        </div>
      )}

      {/* Code explanation */}
      <CodeExplanation raw={explanationText} />

      {/* Notes */}
      <div className="card-info-row" style={{ marginTop: 4 }}>
        <span className="label">
          <button className="note-button" type="button" aria-label="Notes">
            <MessageIcon />
          </button>
        </span>
        <span
          className="value"
          style={{ display: 'block', transform: 'translateY(10px)', fontSize: 11 }}
        >
          {noteText || ' '}
        </span>
      </div>
    </div>
  );
}
