
/* ── SVG Icons ────────────────────────────────────────────────── */

function AuditIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none">
      <defs>
        <linearGradient id="ct-clipGrad" x1="0" y1="0" x2="0" y2="6" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#00B8D9" />
          <stop offset="100%" stopColor="#0094FF" />
        </linearGradient>
      </defs>
      <rect x="5" y="4" width="14" height="17" rx="2.5" fill="white" stroke="#CBD5E1" strokeWidth="1.8" />
      <line x1="7" y1="9" x2="17" y2="9" stroke="#D1D5DB" strokeWidth="1" strokeLinecap="round" />
      <line x1="7" y1="12" x2="17" y2="12" stroke="#D1D5DB" strokeWidth="1" strokeLinecap="round" />
      <line x1="7" y1="15" x2="17" y2="15" stroke="#D1D5DB" strokeWidth="1" strokeLinecap="round" />
      <rect x="8" y="2" width="8" height="4" rx="1" fill="url(#ct-clipGrad)" stroke="#007BFF" strokeWidth="1.5" />
      <path d="M21.378 12.626a1 1 0 0 0-3.004-3.004l-4.01 4.012a2 2 0 0 0-.506.854l-.837 2.87a.5.5 0 0 0 .62.62l2.87-.837a2 2 0 0 0 .854-.506z" fill="black" stroke="#222" strokeWidth="1.3" />
      <circle cx="18.6" cy="11.1" r="0.7" fill="white" opacity="0.8" />
      <rect x="5" y="4" width="14" height="17" rx="2.5" stroke="black" strokeOpacity="0.08" strokeWidth="1" />
    </svg>
  );
}

function ChartIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none">
      <defs>
        <linearGradient id="ct-medGrad" x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#000000" />
          <stop offset="100%" stopColor="#070707" />
        </linearGradient>
      </defs>
      <rect width="18" height="18" x="3" y="3" rx="3" stroke="url(#ct-medGrad)" strokeWidth="2.5" fill="rgba(0,184,217,0.08)" />
      <path d="M9 8h7" stroke="url(#ct-medGrad)" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M8 12h6" stroke="url(#ct-medGrad)" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M11 16h5" stroke="url(#ct-medGrad)" strokeWidth="2.5" strokeLinecap="round" />
      <rect width="18" height="18" x="3" y="3" rx="3" stroke="white" strokeOpacity="0.2" strokeWidth="1" />
    </svg>
  );
}

function MRIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none">
      <defs>
        <linearGradient id="ct-mrGrad" x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#10B981" />
          <stop offset="100%" stopColor="#059669" />
        </linearGradient>
      </defs>
      <rect x="4" y="2" width="16" height="20" rx="2" fill="white" stroke="url(#ct-mrGrad)" strokeWidth="2" />
      <rect x="4" y="2" width="16" height="6" rx="2" fill="url(#ct-mrGrad)" opacity="0.1" />
      <path d="M7 12l3 3 4-4 3 2" stroke="url(#ct-mrGrad)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <circle cx="7" cy="12" r="1.5" fill="url(#ct-mrGrad)" />
      <circle cx="10" cy="15" r="1.5" fill="url(#ct-mrGrad)" />
      <circle cx="14" cy="11" r="1.5" fill="url(#ct-mrGrad)" />
      <circle cx="17" cy="13" r="1.5" fill="url(#ct-mrGrad)" />
      <line x1="6" y1="17" x2="12" y2="17" stroke="#D1D5DB" strokeWidth="1" strokeLinecap="round" />
      <line x1="6" y1="19" x2="18" y2="19" stroke="#D1D5DB" strokeWidth="1" strokeLinecap="round" />
    </svg>
  );
}

function DQAIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#000000" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 7h-3a2 2 0 0 1-2-2V2" />
      <path d="M21 6v6.5c0 .8-.7 1.5-1.5 1.5h-7c-.8 0-1.5-.7-1.5-1.5v-9c0-.8.7-1.5 1.5-1.5H17Z" />
      <path d="M7 8v8.8c0 .3.2.6.4.8.2.2.5.4.8.4H15" />
      <path d="M3 12v8.8c0 .3.2.6.4.8.2.2.5.4.8.4H11" />
    </svg>
  );
}

/* ── Button config ────────────────────────────────────────────── */
const BUTTONS = [
  {
    id: 'conditionAuditBtn',
    type: 'conditionAudit',
    defaultTooltip: 'Audit Findings',
    activeTooltip: 'Audit Findings',
    label: 'Audit Details',
    hidden: true,
    activeClass: 'active',
    icon: <AuditIcon />,
  },
  {
    id: 'chartBtn',
    type: 'chart',
    defaultTooltip: 'Chart Details',
    activeTooltip: 'HCC Analysis',
    label: 'Chart Details',
    hidden: false,
    activeClass: 'active',
    icon: <ChartIcon />,
  },
  {
    id: 'mrAnalysisBtn',
    type: 'mrAnalysis',
    defaultTooltip: 'MR Details',
    activeTooltip: 'MR Analysis',
    label: 'Medical Record Analysis',
    hidden: true,
    activeClass: 'active',
    icon: <MRIcon />,
  },
  {
    id: 'doc_quality',
    type: 'dqa',
    defaultTooltip: 'DQA Details',
    activeTooltip: 'Documentation Quality Analysis',
    label: 'DQA Details',
    hidden: false,
    activeClass: 'active',
    icon: <DQAIcon />,
  },
];

/* ── Component ────────────────────────────────────────────────── */
export default function FloatingButtons({
  panelOpen,
  contentType,
  onButtonClick,
}) {
  const shifted = panelOpen ? ' shifted' : '';

  return (
    <div className={`ct-floating-buttons${shifted}`}>
      {BUTTONS.map((btn) => {
        if (btn.hidden) return null;

        const isActive = panelOpen && contentType === btn.type;
        const tooltip = isActive ? btn.activeTooltip : btn.defaultTooltip;
        const activeClass = isActive ? ` ${btn.activeClass}` : '';

        return (
          <button
            key={btn.id}
            id={btn.id}
            className={`ct-floating-icon-btn${activeClass}`}
            data-tooltip={tooltip}
            aria-label={btn.label}
            onClick={() => onButtonClick(btn.type)}
          >
            {btn.icon}
          </button>
        );
      })}
    </div>
  );
}
