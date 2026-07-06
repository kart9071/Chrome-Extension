/* global chrome */
import React, { useEffect, useState } from 'react';

/* ── Title map per content type ───────────────────────────────── */
const TITLES = {
  chart: 'HCC Opportunities',
  conditionAudit: 'Audit Details',
  mrAnalysis: 'Medical Record Analysis',
  dqa: 'Documentation Quality Analysis',
  memberRisk: 'Member Risk Profile',
};

/* ── Component ────────────────────────────────────────────────── */
export default function FloatingPanel({
  panelOpen,
  contentType,
  currentMemberName,
  currentDos,
  currentAuditDos,
  medicalConditionsData,
  dqaData,
  chartStatus,
  auditStatus,
  isChartLoading,
  onClose,
  children,
}) {
  // Drives the CSS slide animation — we defer adding `show` by one frame
  // so the browser registers the initial translateX(100%) before transitioning.
  const [isShowing, setIsShowing] = useState(false);

  useEffect(() => {
    if (panelOpen) {
      // two rAFs ensure the element is painted before the transition fires
      requestAnimationFrame(() =>
        requestAnimationFrame(() => setIsShowing(true))
      );
    } else {
      setIsShowing(false);
    }
  }, [panelOpen]);

  if (!panelOpen && !isShowing) return null;

  const logoUrl = chrome.runtime.getURL('HOM_Logo.svg');

  /* Count badge — shown only on chart view */
  const countBadge =
    contentType === 'chart'
      ? ` [ ${isChartLoading ? 'Loading...' : medicalConditionsData.length} ]`
      : '';

  /* DOS string — chart/MR/memberRisk use chart DOS; audit uses audit DOS */
  const dosString =
    contentType === 'conditionAudit'
      ? currentAuditDos
        ? `DOS: ${currentAuditDos}`
        : ''
      : currentDos
      ? `DOS: ${currentDos}`
      : '';

  /* Results label — DQA shows record count */
  const resultsLabel =
    contentType === 'dqa'
      ? `${dqaData.length} Records`
      : dosString;

  /* Status visibility */
  const showChartStatus =
    contentType === 'chart' || contentType === 'mrAnalysis';
  const showAuditStatus = contentType === 'conditionAudit';

  return (
    <div
      id="ct-chart-floating"
      className={isShowing ? 'show' : ''}
    >
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="ct-chart-header">
        {/* Logo + AADI 2.0 — left side */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 2,
            flexShrink: 0,
          }}
        >
          <img
            src={logoUrl}
            alt="HOM"
            style={{
              width: 36,
              height: 36,
              objectFit: 'contain',
              borderRadius: 6,
              background: '#fff',
              padding: 3,
              boxShadow: '0 3px 8px rgba(0,0,0,0.12)',
            }}
          />
          <span
            style={{
              fontWeight: 700,
              fontSize: 10,
              color: '#111',
              lineHeight: 1,
            }}
          >
            AADI 2.0
          </span>
        </div>

        {/* Title + patient name + status row */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
          {/* Row 1: title + patient name */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
            }}
          >
            <h3 style={{ fontSize: 15, margin: 0 }}>
              {TITLES[contentType] || 'Details'}
              {countBadge && (
                <span style={{ fontWeight: 600, marginLeft: 8 }}>
                  {countBadge}
                </span>
              )}
            </h3>
            <div
              style={{
                textAlign: 'right',
                fontWeight: 700,
                fontSize: 15,
                flexShrink: 0,
              }}
            >
              {currentMemberName}
            </div>
          </div>

          {/* Row 2: status + DOS/count */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
            }}
          >
            {/* Review status */}
            <div>
              {showChartStatus && chartStatus.text && (
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: chartStatus.color,
                  }}
                >
                  {chartStatus.text}
                </div>
              )}
              {showAuditStatus && auditStatus.text && (
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: auditStatus.color,
                  }}
                >
                  {auditStatus.text}
                </div>
              )}
            </div>

            {/* DOS / record count — right aligned */}
            {resultsLabel && (
              <div
                className="ct-chart-subtitle"
                style={{ textAlign: 'right', whiteSpace: 'nowrap' }}
              >
                <strong>{resultsLabel}</strong>
              </div>
            )}
          </div>
        </div>

        {/* Close button */}
        <button className="ct-close-btn" onClick={onClose} aria-label="Close panel">
          ✕
        </button>
      </div>

      {/* ── Content area (filled by Steps 3-6) ─────────────── */}
      <div id="chartContent">
        {children}
      </div>
    </div>
  );
}
