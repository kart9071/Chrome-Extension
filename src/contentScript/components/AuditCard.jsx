import { useEffect, useRef } from 'react';
import { formatToMMDDYYYY, getStatusLabel } from '../utils/helpers';

/* ── Chevron icon ─────────────────────────────────────────────────── */
function ChevronIcon({ expanded }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{
        transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
        transition: 'transform 0.2s ease',
        flexShrink: 0,
      }}
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

/* ── Arrow icon (for status update row) ───────────────────────────── */
function ArrowIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 640 640"
      className="audit-arrow"
    >
      <path d="M566.6 342.6C579.1 330.1 579.1 309.8 566.6 297.3L406.6 137.3C394.1 124.8 373.8 124.8 361.3 137.3C348.8 149.8 348.8 170.1 361.3 182.6L466.7 288L96 288C78.3 288 64 302.3 64 320C64 337.7 78.3 352 96 352L466.7 352L361.3 457.4C348.8 469.9 348.8 490.2 361.3 502.7C373.8 515.2 394.1 515.2 406.6 502.7L566.6 342.7z" />
    </svg>
  );
}

/* ── Status badge ─────────────────────────────────────────────────── */
const STATUS_CLASS_MAP = {
  'Compliant': 'status-acceptable',
  'Non Compliant': 'status-delete',
  'Partially Compliant': 'status-query-required',
  'Not Applicable': 'status-not-applicable',
};

const UPDATE_STATUS_CLASS_MAP = {
  'ACCEPTABLE': 'status-acceptable',
  'DELETE': 'status-delete',
  'QUERY REQUIRED': 'status-query-required',
  'NOT APPLICABLE': 'status-not-applicable',
};

function StatusBadge({ status }) {
  const cls = STATUS_CLASS_MAP[status] || 'status-not-applicable';
  return (
    <div className={`audit-status-badge ${cls}`}>
      {status || 'Not Applicable'}
    </div>
  );
}

/* ── Expanded body ────────────────────────────────────────────────── */
function ExpandedDetails({ raw }) {
  if (!raw) return null;

  const {
    all_encounter_dates = [],
    exclusion_violation = '',
    marked_as = null,
    updated_status = null,
    overall_recommendation = '',
    coding_issues = '',
    terminology_variation = '',
    user_last_updated = '',
    consistency_explanation = '',
  } = raw;

  const encounterDates = Array.isArray(all_encounter_dates)
    ? all_encounter_dates.join(', ')
    : '';
  const updatedDate =
    user_last_updated?.length > 0 ? formatToMMDDYYYY(user_last_updated) : '';
  const markedStatus = getStatusLabel(marked_as);
  const updatedStatus = getStatusLabel(updated_status);
  const updateStatusClass =
    UPDATE_STATUS_CLASS_MAP[(updated_status || '').toUpperCase()] ||
    'status-query-required';

  return (
    <div className="audit-card-body">
      {/* Encounter dates */}
      {encounterDates && (
        <div className="audit-dates-list">
          <span style={{ fontSize: 12 }}>📅</span>
          <div className="audit-date-item">
            <span>{encounterDates}</span>
          </div>
        </div>
      )}

      {/* Consistency Explanation */}
      {consistency_explanation?.length > 0 && (
        <div className="audit-box">
          <div className="audit-label">
            <div>Consistency Explanation</div>
            <div>:</div>
          </div>
          <div className="audit-text">{consistency_explanation}</div>
        </div>
      )}

      {/* Exclusion Violation */}
      {exclusion_violation?.length > 0 && (
        <div className="audit-box">
          <div className="audit-label">
            <div>Exclusion Violation</div>
            <div>:</div>
          </div>
          <div className="audit-text">{exclusion_violation}</div>
        </div>
      )}

      {/* Terminology Variation */}
      {terminology_variation?.length > 0 && (
        <div className="audit-box">
          <div className="audit-label">
            <div>Terminology Variation</div>
            <div>:</div>
          </div>
          <div className="audit-text">{terminology_variation}</div>
        </div>
      )}

      {/* Coding Issues */}
      {coding_issues?.length > 0 && (
        <div className="audit-box">
          <div className="audit-label">
            <div>Coding Issues</div>
            <div>:</div>
          </div>
          <div className="audit-text">{coding_issues}</div>
        </div>
      )}

      {/* Overall Recommendation */}
      {overall_recommendation?.length > 0 && (
        <div className="audit-recommendation-box">
          <div className="audit-recommendation-label">Overall Recommendation</div>
          <div className="audit-recommendation-text">{overall_recommendation}</div>
        </div>
      )}

      {/* Status update: marked_as → updated_status on date */}
      {updatedDate?.length > 0 && (
        <div className={`audit-update-box ${updateStatusClass}`}>
          <div className="audit-update-text">
            <span className="font-bold">{markedStatus}</span>
            {' '}by System{' '}
            <ArrowIcon />
            <span className="font-bold">{updatedStatus}</span>
            {' '}on <span className="font-bold">{updatedDate}</span>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Card ─────────────────────────────────────────────────────────── */
export default function AuditCard({ row, isExpanded, onToggle }) {
  const cardRef = useRef(null);

  // Scroll expanded card into view
  useEffect(() => {
    if (isExpanded && cardRef.current) {
      const timer = setTimeout(() => {
        cardRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isExpanded]);

  const icdCode = row['ICD-10'] || '';
  const hccCode = row['HCC'] || '';
  const rxHccCode = row['RxHCC'] || '';

  return (
    <div
      ref={cardRef}
      className={`audit-card${isExpanded ? ' expanded' : ''}`}
    >
      <div
        className="audit-card-header"
        onClick={() => onToggle(row.id)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && onToggle(row.id)}
      >
        <div className="audit-card-info">
          <div className="audit-condition-name">{row.Condition || ''}</div>
          <div className="audit-codes-row">
            <span>ICD: {icdCode}</span>
            {hccCode && <span>• HCC: {hccCode}</span>}
            {rxHccCode && <span>• RxHCC: {rxHccCode}</span>}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <StatusBadge status={row.Status} />
          <ChevronIcon expanded={isExpanded} />
        </div>
      </div>

      {isExpanded && <ExpandedDetails raw={row.raw} />}
    </div>
  );
}
