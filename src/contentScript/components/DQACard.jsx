/* ── Icons ────────────────────────────────────────────────────────── */

function CheckIcon() {
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

function FlaskIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="11"
      height="11"
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

/* ── Card ─────────────────────────────────────────────────────────── */

export default function DQACard({ row }) {
  const {
    Condition = '',
    hcc,
    rx_hcc,
    encounter_documented,
    meat_present,
    meat_absent,
    supporting_clinical_evidence,
  } = row;

  return (
    <div className="dqa-condition-card">
      {/* Header: condition name + HCC/RxHCC badges */}
      <div className="dqa-header-row">
        <div className="dqa-condition-text">
          <h5 className="dqa-card-title">{Condition}</h5>
        </div>
        <div className="dqa-badge-group">
          {hcc && <span className="hcc-badge">HCC</span>}
          {rx_hcc && <span className="rx-hcc-badge">Rx-HCC</span>}
        </div>
      </div>

      {/* Encounter date */}
      {encounter_documented && (
        <div
          className="dqa-info-row dqa-date-row"
          style={{ marginBottom: 10 }}
        >
          <span className="label">📅</span>
          <span className="value">{encounter_documented}</span>
        </div>
      )}

      {/* MEAT Present */}
      {meat_present && (
        <div className="dqa-info-row dqa-indicators-row">
          <span
            className="label"
            style={{ color: '#16a34a', fontSize: 12, lineHeight: 1 }}
          >
            <CheckIcon />
          </span>
          <span className="value">{meat_present}</span>
        </div>
      )}

      {/* MEAT Absent */}
      {meat_absent && (
        <div
          className="dqa-info-row dqa-indicators-row"
          style={{ marginTop: 8 }}
        >
          <span
            className="label"
            style={{ color: '#dc2626', fontSize: 10, lineHeight: 1 }}
          >
            ❌
          </span>
          <span className="value">{meat_absent}</span>
        </div>
      )}

      {/* Supporting Clinical Evidence */}
      {supporting_clinical_evidence && (
        <div className="dqa-info-row dqa-evidence-row">
          <span className="label">
            <FlaskIcon />
          </span>
          <span className="value">{supporting_clinical_evidence}</span>
        </div>
      )}
    </div>
  );
}
