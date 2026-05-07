(() => {
  /* global chrome */
  const FLOATING_DIV_ID = "ct-chart-floating";
  const TABLE_SELECTOR = "#ctl00_MainContent_ucPatientDetail_dlPatient";
  const UL_SELECTOR = "#ulReadPatientDetail";

  let observer;
  let hasLoaded = false;

  // Simple HTML escaper for safe insertion into templates
  function escapeHtml(input) {
    if (input === null || typeof input === 'undefined') return '';
    return String(input)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatCodeExplanationHtml(raw) {
    const text = raw || '';
    if (!text.trim()) return '';

    // Try to split into Type and Suggestion parts (case-insensitive)
    const suggestionIndex = text.search(/suggestion:/i);
    let typePart = '';
    let suggestionPart = '';
    if (suggestionIndex !== -1) {
      typePart = text.slice(0, suggestionIndex).trim();
      suggestionPart = text.slice(suggestionIndex).replace(/suggestion:/i, '').trim();
    } else {
      // No explicit 'Suggestion:' label; try to extract a leading 'Type:' if present
      const typeMatch = text.match(/type:\s*([^\n\r]+)/i);
      if (typeMatch) {
        typePart = typeMatch[1].trim();
        // the rest after the matched segment may be suggestion-like
        const after = text.slice(typeMatch.index + typeMatch[0].length).trim();
        if (after) suggestionPart = after;
      } else {
        // Fallback: treat whole text as suggestion
        suggestionPart = text.trim();
      }
    }

    // Normalize extracted parts to avoid repeating labels like "Type: Type: ..."
    typePart = (typePart || '').replace(/^\s*type:\s*/i, '').trim();
    suggestionPart = (suggestionPart || '').replace(/^\s*suggestion:\s*/i, '').trim();

    // SVG icon used in the template
    const svgIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-shield-question w-4 h-4 text-amber-600"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"></path><path d="M9.1 9a3 3 0 0 1 5.82 1c0 2-3 3-3 3"></path><path d="M12 17h.01"></path></svg>`;

    let html = `
    <div class="card-info-row code-explanation-row">
      <div class="flex-shrink-0 p-1 bg-amber-100 rounded-full">${svgIcon}</div>
      <div style="display:flex;flex-direction:column;gap:6px;">
        ${typePart ? `<div><strong>Type:</strong> ${escapeHtml(typePart)}</div>` : ''}
        ${suggestionPart ? `<div><strong>Suggestion:</strong> ${escapeHtml(suggestionPart)}</div>` : ''}
      </div>
    </div>
  `;
    return html;
  }

  // State management
  let contentType = 'chart';
  let searchTerm = '';
  let conditionAuditSearchTerm = '';
  let conditionAuditSortConfig = { key: null, direction: 'asc' };

  // current member context (used for API calls)
  let currentMemberId = null;
  let currentMemberName = null;
  let currentDos = null; // formatted DOS (date of service) to show in UI
  let isChartLoading = false;
  // Medical Conditions Data (populated from API)
  const medicalConditionsData = [];
  // Condition Audit Table Data (populated from API)
  let conditionAuditData = [];

  // Add CSS styles
  function addStyles() {
    const style = document.createElement('style');
    style.textContent = `
       /* Reset and base styles */
       * {
         margin: 0 !important;
         padding: 0 !important;
         box-sizing: border-box !important;
       }

      @font-face {
        font-family: 'Poppins';
        src: url('${chrome.runtime.getURL("fonts/Poppins-Regular.ttf")}') format('truetype');
        font-weight: normal;
        font-style: normal;
      }

      * {
      font-family: 'Poppins', sans-serif !important;
      }

       /* Rectangular Floating Button Container */
       .floating-buttons {
         position: fixed !important;
         right: 0 !important;
         top: 50% !important;
         transform: translateY(-50%) !important;
         z-index: 10000 !important;
         display: flex !important;
         flex-direction: column !important;
         gap: 8px !important;
         background: #007bff !important;
         border-radius: 12px 0 0 12px !important;
         padding: 15px 8px 15px 15px !important;
         box-shadow: -4px 0 12px rgba(0, 123, 255, 0.3) !important;
         transition: all 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94) !important;
       }

      .floating-buttons.shifted {
        right: 50% !important;
      }

       .floating-icon-btn {
         width: 45px !important;
         height: 45px !important;
         background: #fff !important;
         color: #007bff !important;
         border: none !important;
         border-radius: 50% !important;
         font-size: 20px !important;
         cursor: pointer !important;
         box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15) !important;
         transition: all 0.3s ease !important;
         display: flex !important;
         align-items: center !important;
         justify-content: center !important;
         position: relative !important;
       }

       .floating-icon-btn:hover {
         transform: scale(1.05) !important;
         box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2) !important;
       }

       /* Enhanced Tooltip Design */
       .floating-icon-btn::before {
         content: attr(data-tooltip) !important;
         position: absolute !important;
         right: 60px !important;
         top: 50% !important;
         transform: translateY(-50%) !important;
         background: linear-gradient(135deg, #2c3e50 0%, #34495e 100%) !important;
         color: white !important;
         padding: 8px 12px !important;
         border-radius: 8px !important;
         font-size: 12px !important;
         font-weight: 600 !important;
         white-space: nowrap !important;
         opacity: 0 !important;
         visibility: hidden !important;
         transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1) !important;
         z-index: 10000 !important;
         box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3) !important;
         border: 1px solid rgba(255, 255, 255, 0.1) !important;
       }

       .floating-icon-btn::after {
         content: '' !important;
         position: absolute !important;
         right: 52px !important;
         top: 50% !important;
         transform: translateY(-50%) !important;
         border: 6px solid transparent !important;
         border-left-color: #2c3e50 !important;
         opacity: 0 !important;
         visibility: hidden !important;
         transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1) !important;
         z-index: 10000 !important;
       }

       .floating-icon-btn:hover::before {
         opacity: 1 !important;
         visibility: visible !important;
         transform: translateY(-50%) translateX(-5px) !important;
         animation: tooltipPulse 2s infinite !important;
       }

       .floating-icon-btn:hover::after {
         opacity: 1 !important;
         visibility: visible !important;
         transform: translateY(-50%) translateX(-5px) !important;
       }

      @keyframes tooltipPulse {
        0%, 100% {
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        }
        50% {
          box-shadow: 0 6px 16px rgba(0, 0, 0, 0.4);
        }
      }

       /* Tooltip Animation for Active States */
       .floating-icon-btn.chart-btn.active::before {
         background: linear-gradient(135deg, #28a745 0%, #20c997 100%) !important;
       }

       .floating-icon-btn.chart-btn.active::after {
         border-left-color: #28a745 !important;
       }

       .floating-icon-btn.audit-btn.active::before {
         background: linear-gradient(135deg, #28a745 0%, #20c997 100%) !important;
       }

       .floating-icon-btn.audit-btn.active::after {
         border-left-color: #28a745 !important;
       }

       .floating-icon-btn.chart-btn.active {
         background: #28a745 !important;
         color: #fff !important;
       }

       .floating-icon-btn.audit-btn.active {
         background: #28a745 !important;
         color: #fff !important;
       }

       /* Condition Audit Button Active States */
       .floating-icon-btn.condition-audit-btn.active::before {
         background: linear-gradient(135deg, #28a745 0%, #20c997 100%) !important;
       }

       .floating-icon-btn.condition-audit-btn.active::after {
         border-left-color: #28a745 !important;
       }

       .floating-icon-btn.condition-audit-btn.active {
         background: #28a745 !important;
         color: #fff !important;
       }

       /* Backdrop Overlay with animation */
       .backdrop {
         position: fixed !important;
         top: 0 !important;
         left: 0 !important;
         right: 0 !important;
         bottom: 0 !important;
         background: rgba(0, 0, 0, 0.5) !important;
         z-index: 9998 !important;
         opacity: 0 !important;
         visibility: hidden !important;
         transition: opacity 0.3s ease, visibility 0.3s ease !important;
       }

       .backdrop.visible {
         opacity: 1 !important;
         visibility: visible !important;
       }

      /* Floating Panel with Slide Animation */
      #ct-chart-floating {
        position: fixed !important;
        top: 0 !important;
        right: 0 !important;
        width: 50% !important;
        height: 100vh !important;
        background: #f8f9fa !important;
        box-shadow: -4px 0 12px rgba(0, 0, 0, 0.3) !important;
        z-index: 9999 !important;
        font-family: Arial, sans-serif !important;
        font-size: 13px !important;
        color: #333 !important;
        transform: translateX(100%) !important;
        transition: transform 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94) !important;
        display: flex !important;
        flex-direction: column !important;
        overflow: hidden !important;
      }

      /* Use same width for audit panel as chart details to keep consistent sizing */
      #ct-chart-floating.audit {
        width: 50% !important;
        /* keep anchored to the right */
        right: 0 !important;
      }

      /* Move the floating buttons further left when the audit panel is open (match chart width) */
      .floating-buttons.shifted.audit-shift {
        right: 50% !important;
      }

      #ct-chart-floating.show {
        transform: translateX(0) !important;
      }

       #ct-chart-floating .chart-header {
         display: flex !important;
         justify-content: space-between !important;
         align-items: center !important;
         padding: 12px 20px !important;
         /* make header background transparent per user request */
         background: transparent !important;
         border-bottom: 1px solid #e0e0e0 !important;
         flex-shrink: 0 !important;
       }

       #ct-chart-floating h3 {
         margin: 0 !important;
         font-size: 18px !important;
         color: #333 !important;
         font-weight: 600 !important;
       }

      /* Subtitle under chart title (small, muted) */
      .chart-subtitle {
        font-size: 12px !important;
        color: #6c757d !important;
        margin-top: 2px !important;
        font-weight: 500 !important;
      }

       #ct-chart-floating .close-btn {
         background: transparent !important;
         color: #666 !important;
         border: none !important;
         cursor: pointer !important;
         padding: 4px 8px !important;
         font-size: 24px !important;
         transition: color 0.2s ease !important;
       }

       #ct-chart-floating .close-btn:hover {
         color: #333 !important;
       }

       /* Medical Conditions Section */
       .medical-conditions-section {
         flex: 1 !important;
         display: flex !important;
         flex-direction: column !important;
         background: #f8f9fa !important;
         min-height: 0 !important;
         height: 100% !important;
       }

       .medical-conditions-section > h4 {
         padding: 15px 20px !important;
         margin: 0 !important;
         background: #fff !important;
         border-bottom: 1px solid #e0e0e0 !important;
         flex-shrink: 0 !important;
       }

       /* Search Container */
       .search-container {
         padding: 10px 20px !important;
         background: #fff !important;
         border-bottom: 1px solid #e0e0e0 !important;
         flex-shrink: 0 !important;
       }

       .search-input {
         width: 100% !important;
         padding: 8px 12px !important;
         border: 2px solid #e9ecef !important;
         border-radius: 8px !important;
         font-size: 14px !important;
         background: #f8f9fa !important;
         transition: all 0.3s ease !important;
         box-sizing: border-box !important;
       }

       .search-input:focus {
         outline: none !important;
         border-color: #007bff !important;
         background: #fff !important;
         box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.1) !important;
       }

       .search-input::placeholder {
         color: #6c757d !important;
         font-style: italic !important;
       }

       .search-results-count {
         margin-top: 4px !important;
         font-size: 12px !important;
         color: #6c757d !important;
         font-weight: 500 !important;
         text-align: right !important;
       }

      /* No Results UI */
      .no-results {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 60px 20px;
        text-align: center;
        color: #6c757d;
        min-height: 400px;
        width: 100%;
        grid-column: 1 / -1;
        margin: 50px 0;
      }

      .no-results-icon {
        font-size: 48px;
        margin-bottom: 20px;
        opacity: 0.6;
      }

      .no-results h3 {
        color: #495057;
        margin-bottom: 10px;
        font-size: 20px;
        font-weight: 600;
      }

      .no-results p {
        margin-bottom: 20px;
        font-size: 14px;
        line-height: 1.5;
      }

      .no-results-suggestions {
        background: #f8f9fa;
        padding: 20px;
        border-radius: 8px;
        border: 1px solid #e9ecef;
        max-width: 400px;
        text-align: left;
      }

      .no-results-suggestions p {
        margin-bottom: 10px;
        font-weight: 600;
        color: #495057;
      }

      .no-results-suggestions ul {
        margin: 0;
        padding-left: 20px;
        color: #6c757d;
      }

      .no-results-suggestions li {
        margin-bottom: 5px;
        font-size: 13px;
      }

      .medical-conditions-scroll {
        flex: 1 !important;
        overflow-y: auto !important;
        padding: 15px !important;
        display: grid !important;
        grid-template-columns: 1fr !important;
        gap: 15px !important;
        min-height: 0 !important;
        height: 100% !important;
        align-content: start !important;
      }

      /* Scroll container specifically for audit cards so scrollbar appears and size is bounded */
      .audit-cards-scroll {
        max-height: calc(100vh - 160px) !important; /* leaves room for header/search */
        overflow-y: auto !important;
        display: grid !important;
        grid-template-columns: 1fr !important;
        gap: 12px !important;
        padding: 12px !important;
      }

      .audit-cards-scroll::-webkit-scrollbar {
        width: 10px !important;
      }
      .audit-cards-scroll::-webkit-scrollbar-track {
        background: #f1f1f1 !important;
        border-radius: 6px !important;
      }
      .audit-cards-scroll::-webkit-scrollbar-thumb {
        background: #c1c1c1 !important;
        border-radius: 6px !important;
      }
      .audit-cards-scroll::-webkit-scrollbar-thumb:hover {
        background: #9e9e9e !important;
      }

       /* Custom Scrollbar for Medical Conditions */
       .medical-conditions-scroll::-webkit-scrollbar {
         width: 8px !important;
       }

       .medical-conditions-scroll::-webkit-scrollbar-track {
         background: #f1f1f1 !important;
       }

       .medical-conditions-scroll::-webkit-scrollbar-thumb {
         background: #888 !important;
         border-radius: 4px !important;
       }

       .medical-conditions-scroll::-webkit-scrollbar-thumb:hover {
         background: #555 !important;
       }

       /* Force scrollbar to always show */
       .medical-conditions-scroll {
         scrollbar-width: thin !important;
         scrollbar-color: #888 #f1f1f1 !important;
         overflow-y: auto !important;
         max-height: calc(100vh - 100px) !important;
         min-height: 400px !important;
       }

      /* Beautiful Medical Condition Card Design */
      .medical-condition-card {
        background: #ffffff !important;
        border: 1px solid #e8e8e8 !important;
        border-left: 4px solid #1e40af !important;
        border-radius: 4px !important;
        padding: 5px !important;
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.06) !important;
        height: fit-content !important;
        transition: all 0.3s ease !important;
      }

      .medical-condition-card:hover {
        box-shadow: 0 3px 12px rgba(0, 0, 0, 0.1) !important;
        transform: translateY(-1px) !important;
      }

       /* Badges Row */
       .card-badges-row {
         margin-bottom: 10px !important;
         display: flex !important;
         justify-content: space-between !important;
       }

       .badge-group {
         display: flex !important;
         flex-wrap: wrap !important;
         gap: 6px !important;
         align-items: center !important;
       }

       .icd-badge {
         display: inline-block !important;
         padding: 4px 8px !important;
         background: #dbeafe !important;
         color: #1e40af !important;
         border: 1px solid #93c5fd !important;
         border-radius: 2px !important;
         font-size: 10px !important;
         font-weight: 600 !important;
         font-family: 'Courier New', monospace !important;
       }

       .hcc-badge {
         display: inline-block !important;
         padding: 4px 8px !important;
         background: #d1fae5 !important;
         color: #065f46 !important;
         border: 1px solid #6ee7b7 !important;
         border-radius: 2px !important;
         font-size: 10px !important;
         font-weight: 600 !important;
         font-family: 'Courier New', monospace !important;
       }

       .rx-hcc-badge {
         display: inline-block !important;
         padding: 4px 8px !important;
         background: #f3e8ff !important;
         color: #6b21a8 !important;
         border: 1px solid #c084fc !important;
         border-radius: 2px !important;
         font-size: 10px !important;
         font-weight: 600 !important;
         font-family: 'Courier New', monospace !important;
       }

       .code-type-badge {
         display: inline-block !important;
         padding: 4px 8px !important;
         border-radius: 2px !important;
         font-size: 10px !important;
         font-weight: 600 !important;
         font-family: 'Courier New', monospace !important;
       }

       .code-type-badge.documented {
         background: #d1fae5 !important;
         color: #065f46 !important;
         border: 1px solid #6ee7b7 !important;
       }

       .code-type-badge.opportunities {
         background: #fed7aa !important;
         color: #9a3412 !important;
         border: 1px solid #fdba74 !important;
       }

       .audit-score-icon {
         display: inline-flex !important;
         align-items: center !important;
         gap: 4px !important;
         padding: 4px 8px !important;
         background: #fee2e2 !important;
         color: #dc2626 !important;
         border: 1px solid #fca5a5 !important;
         border-radius: 2px !important;
         font-size: 10px !important;
         font-weight: 700 !important;
         font-family: 'Courier New', monospace !important;
         cursor: pointer !important;
       }

      /* Card Title */
      .card-title {
        font-size: 13px !important;
        font-weight: 700 !important;
        color: #111827 !important;
        margin: 0 0 10px 0 !important;
        line-height: 1.3 !important;
      }

      /* Card Description Paragraph */
      .card-description {
        font-size: 11px !important;
        color: #374151 !important;
        line-height: 1.5 !important;
        margin: 0 0 10px 0 !important;
      }

      /* Card Sections */
      .card-info-row {
        display: flex !important;
        align-items: flex-start !important;
        gap: 8px !important;
        padding: 6px 0 !important;
        font-size: 11px !important;
        color: #374151 !important;
      }

      /* Special styling for the Clinical Indicators row */
      .card-info-row.indicators-row {
        background: #ecfdf5 !important; /* light green */
        border: 0.5px solid #81c791ff !important; /* darker green border */
        padding: 8px 10px !important;
        gap: 10px !important;
        border-radius: 6px !important;
      }
      .card-info-row.indicators-row .label {
        color: #111111ff !important;
        font-weight: 600 !important;
      }
      /* Code Explanation row styling - light orange background, subtle border, rounded */
      .card-info-row.code-explanation-row {
        background: #fff7ed !important; /* very light orange */
        border: 0.5px solid rgba(249, 115, 22, 0.35) !important; /* subtle medium-light orange */
        padding: 8px 10px !important;
        gap: 10px !important;
        border-radius: 6px !important;
        margin-top: 8px !important; /* small gap between indicators and this row */
      }
      .card-info-row.code-explanation-row .label {
        color: #92400e !important; /* darker orange for label */
        font-weight: 600 !important;
      }
      /* Small utility classes for icon sizing and color (from request) */
      .text-blue-600 {
        --tw-text-opacity: 1 !important;
        color: rgb(37 99 235 / var(--tw-text-opacity, 1)) !important;
      }
      .w-4 { width: 1rem !important; }
      .h-4 { height: 1rem !important; }
      /* Amber utility classes for Code Explanation icon */
      .p-1 { padding: .25rem !important; }
      .bg-amber-100 { --tw-bg-opacity: 1 !important; background-color: rgb(254 243 199 / var(--tw-bg-opacity, 1)) !important; }
      .rounded-full { border-radius: 9999px !important; }
      .flex-shrink-0, .shrink-0 { flex-shrink: 0 !important; }
  .text-amber-600 { --tw-text-opacity: 1 !important; color: rgb(217 119 6 / var(--tw-text-opacity, 1)) !important; }

      /* Shared Note / action-button used as a label for card rows (compact, icon + text + chevron) */
      .note-button {
        display: inline-flex !important;
        align-items: center !important;
        gap: 0.5rem !important; /* matches .gap-2 */
        justify-content: space-between !important;
        background: transparent !important;
        border: none !important;
        padding: 0.375rem 0.5rem !important; /* px-2 py-2 equivalent compact */
        font-size: 0.75rem !important; /* text-xs */
        color: #4b5563 !important; /* text-gray-600 */
        border-radius: 6px !important; /* rounded-sm approximation */
        cursor: pointer !important;
      }
      .note-button:hover {
        color: #111827 !important; /* hover:text-gray-900 */
        background: #f3f4f6 !important; /* hover:bg-gray-100 */
      }
      .note-button:focus {
        outline: 2px solid rgba(59,130,246,0.18) !important;
        outline-offset: 2px !important;
      }
      .note-button .note-text {
        font-size: 0.875rem !important; /* text-sm */
        font-weight: 500 !important; /* font-medium */
      }
      .note-button .note-icon,
      .note-button .note-chevron {
        width: 1rem !important; /* w-4 */
        height: 1rem !important; /* h-4 */
        flex-shrink: 0 !important;
      }

      .card-info-row .label {
        font-weight: 600 !important;
        color: #6b7280 !important;
      }

      .card-info-row .value {
        flex: 1 !important;
      }

       /* Audit Table Section */
       .audit-table-container {
         width: 100% !important;
         height: 100% !important;
         padding: 10px !important;
         overflow: auto !important;
         background: #f8f9fa !important;
       }

       .audit-table-wrapper {
         width: 100% !important;
         overflow: auto !important;
         margin-top: 10px !important;
         margin-bottom: 5px !important;
         border-radius: 8px !important;
         box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1) !important;
         max-height: calc(100vh - 100px) !important;
       }

       /* Custom Scrollbar for Audit Table */
       .audit-table-wrapper::-webkit-scrollbar {
         width: 10px !important;
         height: 10px !important;
       }

       .audit-table-wrapper::-webkit-scrollbar-track {
         background: #f1f1f1 !important;
         border-radius: 6px !important;
       }

       .audit-table-wrapper::-webkit-scrollbar-thumb {
         background: #c1c1c1 !important;
         border-radius: 6px !important;
       }

       .audit-table-wrapper::-webkit-scrollbar-thumb:hover {
         background: #9e9e9e !important;
       }

       .audit-table {
         width: 100% !important;
         border-collapse: collapse !important;
         background: white !important;
         border-radius: 8px !important;
         overflow: visible !important;
         box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1) !important;
         table-layout: auto !important;
         /* reduce the table min width slightly to make it less wide */
         min-width: 680px !important;
         max-width: 100% !important;
       }

       .audit-table thead {
         background: linear-gradient(135deg, #1e3a8a 0%, #1e40af 100%) !important;
         color: white !important;
         position: sticky !important;
         top: 0 !important;
         z-index: 10 !important;
       }

       .audit-table th {
           background: #1e3ea3 !important;
         padding: 10px 8px !important;
         text-align: left !important;
         font-size: 12px !important;
         font-weight: 700 !important;
         text-transform: uppercase !important;
         letter-spacing: 0.5px !important;
         white-space: nowrap !important;
         overflow: visible !important;
         text-overflow: clip !important;
         height: 56px !important;
         vertical-align: middle !important;
         border-bottom: 2px solid rgba(255, 255, 255, 0.2) !important;
         position: relative !important;
         box-sizing: border-box !important;
         min-width: fit-content !important;
         width: auto !important;
         flex-shrink: 0 !important;
         word-wrap: normal !important;
         overflow-wrap: normal !important;
         hyphens: none !important;
       }

       .audit-table tbody tr {
         border-bottom: 1px solid #e5e7eb !important;
       }

       .audit-table tbody tr:nth-child(even) {
         background: #f9fafb !important;
       }

       .audit-table td {
         padding: 8px 8px !important;
         font-size: 12px !important;
         color: #374151 !important;
         border-bottom: 1px solid #e5e7eb !important;
         vertical-align: middle !important;
         word-wrap: break-word !important;
         overflow-wrap: break-word !important;
       }

       /* Column Widths - Expand button is now child 1 */
       .audit-table th:nth-child(1),
       .audit-table td:nth-child(1) {
         width: 40px !important;
         min-width: 40px !important;
         max-width: 40px !important;
         padding: 0 !important;
       }

       .audit-table th:nth-child(2),
       .audit-table td:nth-child(2) {
         min-width: 130px !important;
         width: 130px !important;
       }

       .audit-table th:nth-child(3),
       .audit-table td:nth-child(3) {
         min-width: 120px !important;
         width: 120px !important;
       }

       .audit-table th:nth-child(4),
       .audit-table td:nth-child(4) {
         min-width: 120px !important;
         width: 120px !important;
       }

       .audit-table th:nth-child(5),
       .audit-table td:nth-child(5) {
         min-width: 80px !important;
         width: 80px !important;
       }

       .audit-table th:nth-child(6),
       .audit-table td:nth-child(6) {
         min-width: 110px !important;
         width: 110px !important;
       }

       .audit-table th:nth-child(7),
       .audit-table td:nth-child(7) {
         min-width: 100px !important;
         width: 100px !important;
       }

       .audit-table th:nth-child(8),
       .audit-table td:nth-child(8) {
         min-width: 120px !important;
         width: 120px !important;
       }

       .audit-table th:nth-child(9),
       .audit-table td:nth-child(9) {
         min-width: 120px !important;
         width: 120px !important;
       }

       .audit-table th:nth-child(10),
       .audit-table td:nth-child(10) {
         min-width: 160px !important;
         width: 160px !important;
         padding-right: 20px !important;
       }

       /* Audit Table Expansion Styles */
       .audit-expanded-container {
         background: #fff !important;
         border: 1px solid #e5e7eb !important;
         border-radius: 8px !important;
        padding: 6px 10px !important;
         width: 100% !important;
         box-shadow: 0 3px 8px rgba(30, 64, 175, 0.07) !important;
         margin: 10px !important
       }

       .audit-expanded-empty {
         color: #6b7280 !important;
         font-size: 14px !important;
         font-style: italic !important;
         text-align: center !important;
         padding: 30px 0 !important;
       }

       /* Use a vertical list of rows where each row is a 2-column grid: label | value
          This ensures all values line up in the same column and rows are vertically centered. */
       .audit-expanded-grid {
         display: flex !important;
         flex-direction: column !important;
         gap: 8px !important;
       }

       @media (max-width:700px) {
         .audit-expanded-grid {
           grid-template-columns: 1fr !important;
           gap: 14px !important;
         }
       }

       .audit-detail-row {
         display: grid !important;
         grid-template-columns: 140px 1fr !important;
         align-items: center !important;
         padding: 6px 0 !important;
         border-bottom: 1px solid #f3f4f6 !important;
         gap: 8px 12px !important;
       }

       .audit-detail-row:last-child {
         border-bottom: none !important;
       }

       .audit-detail-label {
         color: #64748b !important;
         font-weight: 700 !important;
         font-size: 11px !important;
         letter-spacing: .02em !important;
         text-align: left !important;
       }

       /* Add a colon after every label for consistent "label : value" look */
       .audit-detail-label::after {
         content: ':' !important;
         display: inline-block !important;
         margin-left: 6px !important;
         color: #64748b !important;
       }

       .audit-detail-value {
         color: #1e293b !important;
         font-size: 11px !important;
         word-break: break-word !important;
       }

       .expand-col {
         width: 40px !important;
         min-width: 40px !important;
         max-width: 40px !important;
         text-align: center !important;
         padding: 0 !important;
       }

       .expand-btn {
         background: none !important;
         border: none !important;
         cursor: pointer !important;
         padding: 0 2px !important;
         outline: none !important;
         transition: background .13s !important;
         border-radius: 4px !important;
       }

       .expand-btn:hover,
       .expand-btn.expanded {
         background: #e0e7ef !important;
       }

       .expand-chevron {
         transition: transform 0.23s cubic-bezier(.55, .06, .68, .19) !important;
         font-size: 17px !important;
         color: #64748b !important;
       }

       .audit-pn-badge {
         display: inline-block !important;
         background: #f3f4f6 !important;
         border: 1px solid #d1d5db !important;
         border-radius: 4px !important;
         padding: 1px 6px !important;
         margin: 0 2px 2px 0 !important;
         font-size: 11px !important;
         color: #334155 !important;
       }

       .text-center {
         text-align: center !important;
       }

       .condition-name-col {
         font-weight: 700 !important;
         color: #1e293b !important;
       }

       /* Audit Table Section */
       .audit-table-section {
         flex: 1 !important;
         overflow-y: auto !important;
         padding: 5px !important;
         background: #f8f9fa !important;
       }

       .audit-expanded-row {
         background: #f9fafb !important;
       }


       .expanded {
         background: #f0f9ff !important;
       }

       @media (max-width:560px) {
         .audit-expanded-container {
           padding: 12px 4px !important;
         }

         .audit-detail-row {
           flex-direction: column !important;
           gap: 4px !important;
         }

         .audit-detail-label {
           min-width: 0 !important;
           font-size: 12px !important;
         }

         .audit-detail-value {
           font-size: 12px !important;
         }
       }

       /* Sortable Headers */
       .audit-table .sortable {
         cursor: pointer !important;
         user-select: none !important;
         position: relative !important;
         transition: all 0.2s ease !important;
         text-align: left !important;
         white-space: nowrap !important;
         overflow: visible !important;
         text-overflow: ellipsis !important;
         max-width: 100% !important;
         padding-right: 20px !important;
       }

       .audit-table .sortable:hover {
         background: rgba(255, 255, 255, 0.1) !important;
         transform: translateY(-1px) !important;
       }

       .sort-icon {
         width: 16px !important;
         height: 16px !important;
         fill: currentColor !important;
         opacity: 0.7 !important;
         transition: opacity 0.2s ease !important;
         display: inline-block !important;
         vertical-align: middle !important;
         margin-left: 4px !important;
         flex-shrink: 0 !important;
         margin-top: -2px !important;
         padding-bottom: 2px !important;
       }

       .audit-table .sortable span {
         display: inline-block !important;
         overflow: hidden !important;
         text-overflow: ellipsis !important;
         white-space: nowrap !important;
       }

       .sort-icon.active {
         opacity: 1 !important;
       }

      /* Pagination Styles */
      .pagination-wrapper {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 20px;
        border-top: 1px solid #e5e7eb;
        flex-wrap: wrap;
        gap: 15px;
      }

      .pagination-info {
        font-size: 13px;
        color: #6b7280;
        font-weight: 500;
      }

      .pagination {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      }

      .pagination-btn {
        padding: 8px 16px;
        border: 1px solid #d1d5db;
        background: #fff;
        color: #374151;
        border-radius: 6px;
        font-size: 13px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s ease;
      }

      .pagination-btn:hover:not(:disabled) {
        background: #f3f4f6;
        border-color: #9ca3af;
      }

      .pagination-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .pagination-btn.active {
        background: #1e40af;
        color: #fff;
        border-color: #1e40af;
      }

      .pagination-btn.active:hover {
        background: #1e3a8a;
      }

      /* Responsive Design */
      @media (max-width: 1024px) {
        #ct-chart-floating {
          width: 50% !important;
        }

        .floating-buttons.shifted {
          right: 50% !important;
        }
      }

      @media (max-width: 768px) {
        #ct-chart-floating {
          width: 100% !important;
        }

        .floating-buttons {
          right: 0 !important;
          padding: 12px 6px 12px 12px !important;
        }

        .floating-buttons.shifted {
          right: 0 !important;
        }

        .floating-icon-btn {
          width: 40px !important;
          height: 40px !important;
          font-size: 18px !important;
        }

        .medical-conditions-scroll {
          grid-template-columns: 1fr !important;
        }

        .card-info-row {
          flex-direction: column !important;
          gap: 4px !important;
        }

        .card-info-row .label {
          min-width: auto !important;
        }

        .pagination-wrapper {
          flex-direction: column !important;
          align-items: center !important;
        }

        .pagination {
          justify-content: center !important;
        }
      }

      @media (max-width: 480px) {
        .floating-buttons {
          padding: 10px 4px 10px 10px !important;
        }

        .floating-icon-btn {
          width: 35px !important;
          height: 35px !important;
          font-size: 16px !important;
        }

        .medical-condition-card {
          padding: 10px !important;
        }

        .card-title {
          font-size: 12px !important;
        }

        .card-description,
        .card-info-row {
          font-size: 10px !important;
        }

        .badge-group {
          gap: 4px !important;
        }

        .icd-badge,
        .hcc-badge,
        .rx-hcc-badge {
          font-size: 9px !important;
          padding: 3px 6px !important;
        }

        .pagination-wrapper {
          padding: 15px !important;
        }

        .pagination-info {
          font-size: 11px !important;
        }

        .pagination-btn {
          padding: 6px 12px !important;
          font-size: 11px !important;
        }

        /* Mobile tooltip adjustments */
        .floating-icon-btn::before {
          right: 50px !important;
          font-size: 11px !important;
          padding: 6px 10px !important;
        }

        .floating-icon-btn::after {
          right: 42px !important;
          border-width: 5px !important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  // Filter medical conditions based on search term
  function filterMedicalConditions() {
    const trimmedSearch = searchTerm.trim();

    if (!trimmedSearch) {
      return medicalConditionsData;
    }

    const searchLower = trimmedSearch.toLowerCase();
    const filtered = medicalConditionsData.filter(condition => {
      const matches = (
        // Title
        condition.title.toLowerCase().includes(searchLower) ||
        // Description
        (condition.description && condition.description.toLowerCase().includes(searchLower)) ||
        // Clinical Indicators
        condition.clinicalIndicators.toLowerCase().includes(searchLower) ||
        // Code Explanation
        condition.codeExplanation.toLowerCase().includes(searchLower) ||
        // Note Text
        (condition.noteText && condition.noteText.toLowerCase().includes(searchLower)) ||
        // Documentation
        (condition.documentation && condition.documentation.toLowerCase().includes(searchLower)) ||
        // ICD-10 code
        condition.details.icd10.toLowerCase().includes(searchLower) ||
        // HCC codes
        (condition.details.hcc24 && condition.details.hcc24.toString().includes(searchLower)) ||
        (condition.details.hcc28 && condition.details.hcc28.toString().includes(searchLower)) ||
        (condition.details.rxHcc && condition.details.rxHcc.toString().includes(searchLower)) ||
        // Status
        (condition.details.active ? 'active' : 'inactive').includes(searchLower) ||
        // Source
        (condition.details.source && condition.details.source.toLowerCase().includes(searchLower)) ||
        // Date
        (condition.details.date && condition.details.date.includes(searchLower)) ||
        // Additional fields
        (condition.details.eGFR && condition.details.eGFR.toString().includes(searchLower)) ||
        (condition.details.bmi && condition.details.bmi.toString().includes(searchLower)) ||
        (condition.details.encounter && condition.details.encounter.toLowerCase().includes(searchLower)) ||
        // Code Type
        (condition.details.code_type && condition.details.code_type.toLowerCase().includes(searchLower))
      );

      // no-op: matched conditions will be returned

      return matches;
    });

    return filtered;
  }

  // Check if search bar should be shown (more than 6 conditions)
  const showSearchBar = medicalConditionsData.length > 6;


  // Filter condition audit data based on search term
  function filterConditionAuditData() {
    const trimmedSearch = conditionAuditSearchTerm.trim();
    if (!trimmedSearch) {
      return conditionAuditData;
    }

    const searchLower = trimmedSearch.toLowerCase();
    return conditionAuditData.filter(row => {
      return (
        // Condition Name
        row.conditionName.toLowerCase().includes(searchLower) ||
        // Accurate Code
        row.accurateCode.toLowerCase().includes(searchLower) ||
        // Progress Notes
        row.progressNotes.some(note => note.toLowerCase().includes(searchLower)) ||
        // HCC Code
        row.hccCode.toString().includes(searchLower) ||
        // Evidence Strength
        row.evidenceStrength.toLowerCase().includes(searchLower) ||
        // Audit Date
        row.auditDate.toLowerCase().includes(searchLower) ||
        // Audit Score
        row.auditScore.toString().includes(searchLower)
      );
    });
  }


  function renderConditionAuditSortIcon(columnKey) {
    if (conditionAuditSortConfig.key === columnKey) {
      if (conditionAuditSortConfig.direction === 'asc') {
        return `<svg class="sort-icon active" viewBox="0 0 100 100"><polygon points="50,20 80,60 20,60" fill="currentColor"/></svg>`;
      } else if (conditionAuditSortConfig.direction === 'desc') {
        return `<svg class="sort-icon active" viewBox="0 0 100 100"><polygon points="20,20 80,20 50,60" fill="currentColor"/></svg>`;
      }
    }
    return '';
  }


  // Sort condition audit data
  function sortConditionAuditData(key) {
    let direction;
    if (conditionAuditSortConfig.key === key) {
      if (conditionAuditSortConfig.direction === 'asc') {
        direction = 'desc';
      } else if (conditionAuditSortConfig.direction === 'desc') {
        direction = null; // Reset
        conditionAuditSortConfig = { key: null, direction: null };
        showConditionAuditContent();
        return;
      }
    } else {
      direction = 'asc';
    }
  conditionAuditSortConfig = { key, direction };
    showConditionAuditContent();
  }

  // Fetch chart details from the extension service worker
  function fetchChartDetailsFromServiceWorker(memberId, memberName) {
    return new Promise((resolve, reject) => {
      try {
        chrome.runtime.sendMessage(
          { action: 'fetchChartDetails', payload: { member_id: memberId, member_name: memberName } },
          (response) => {
            if (chrome.runtime.lastError) {
              return reject(new Error(chrome.runtime.lastError.message));
            }
            if (!response) return reject(new Error('No response from service worker'));
            if (response.error) return reject(new Error(response.error));
            return resolve(response.data);
          }
        );
      } catch (err) {
        reject(err);
      }
    });
  }

  // Fetch audit details from the extension service worker
  function fetchAuditDetailsFromServiceWorker(memberId, memberName) {
    return new Promise((resolve, reject) => {
      try {
        chrome.runtime.sendMessage(
          { action: 'fetchAuditDetails', payload: { member_id: memberId, member_name: memberName } },
          (response) => {
            if (chrome.runtime.lastError) {
              return reject(new Error(chrome.runtime.lastError.message));
            }
            if (!response) return reject(new Error('No response from service worker'));
            if (response.error) return reject(new Error(response.error));
            return resolve(response.data);
          }
        );
      } catch (err) {
        reject(err);
      }
    });
  }

  // Map audit API rows to internal audit data shape
  function mapApiAuditRows(apiRows) {
    if (!Array.isArray(apiRows)) return [];
    return apiRows.map(a => ({
      id: a.id || null,
      conditionName: a.documented_condition || '',
      accurateCode: a.accurate_code || a.documented_icd_code || '',
      progressNotes: a.pn_dates ? a.pn_dates.split(',').map(s => s.trim()).filter(Boolean) : [],
      hccCode: a.hcc_code || '',
      evidenceStrength: a.evidence_strength || '',
      auditDate: a.audit_date || '',
      auditScore: (typeof a.audit_score !== 'undefined' && a.audit_score !== null) ? a.audit_score : 0,
      // Make sure we also expose fields that might be used directly
      documented_condition: a.documented_condition || '',
      documented_icd_code: a.documented_icd_code || '',
      accurate_code: a.accurate_code || '',
      hcc_code: a.hcc_code || '',
      pn_dates: a.pn_dates || '',
      evidence_strength: a.evidence_strength || '',
      audit_date: a.audit_date || '',
      radv_compliance_score: a.radv_compliance_score || null,
      raw: a
    }));
  }

  // Fetch audit details and update conditionAuditData
  async function fetchAuditDetails(memberId, memberName) {
    const apiData = await fetchAuditDetailsFromServiceWorker(memberId, memberName);

    // Normalize payload shapes: apiData may be { status,message,data:[...] } or the array directly
    let payload = apiData && apiData.data ? apiData.data : apiData;
    let auditArray = [];
    if (Array.isArray(payload)) {
      auditArray = payload;
    } else if (payload && Array.isArray(payload.data)) {
      auditArray = payload.data;
    }

    const mapped = mapApiAuditRows(auditArray || []);
    if (mapped.length) {
      // replace conditionAuditData
      conditionAuditData = mapped;
      // If audit panel is visible, refresh UI
      if (contentType === 'conditionAudit') {
        try { showConditionAuditContent(); } catch (e) { console.error(e); }
      }
    } else {
      console.warn('No audit rows returned from API; keeping existing audit data.');
    }
  }

  // Map API medical_conditions -> internal medicalConditionsData shape
  function mapApiMedicalConditions(apiConditions) {
    if (!Array.isArray(apiConditions)) return [];
    return apiConditions.map((c, idx) => {
      return {
        id: c.id || idx,
        title: c.condition_name || c.diagnosis || 'Unknown condition',
        icon: c.isChronic ? '🩺' : '📌',
        details: {
          icd10: (c.icd_code || '').toString(),
          hcc24: c.hcc_v24 || c.hcc24 || null,
          hcc28: c.hcc_v28 || c.hcc28 || null,
          rxHcc: c.rx_hcc || c.rxHcc || null,
          source: c.documented_in || c.source || '',
          note: !!(c.analyst_notes || c.query),
          active: !!c.isChronic,
          code_type: c.code_status || '',
          RADV_score: c.RADV_score || c.radv_score || 0,
          code_status: c.code_status || '',
          date: c.last_documented_date || null
        },
        description: c.code_explanation || '',
        clinicalIndicators: c.clinical_indicators || '',
        codeExplanation: c.query || '',
        noteText: c.analyst_notes || null
      };
    });
  }


  // Create floating buttons
  function createFloatingButtons() {
    const existing = document.getElementById('floatingButtons');
    if (existing) return existing;

    const buttonsDiv = document.createElement('div');
    buttonsDiv.id = 'floatingButtons';
    buttonsDiv.className = 'floating-buttons';

    buttonsDiv.innerHTML = `
      <button class="floating-icon-btn chart-btn" id="chartBtn" data-tooltip="Chart Details" aria-label="Chart Details">
        <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <!-- Gradient Definition -->
          <defs>
            <linearGradient id="medicalGradient" x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stop-color="#000000ff"/>
              <stop offset="100%" stop-color="#070707ff"/>
            </linearGradient>
          </defs>

          <!-- Background Square -->
          <rect width="18" height="18" x="3" y="3" rx="3" stroke="url(#medicalGradient)" stroke-width="2.5" fill="rgba(0, 184, 217, 0.08)" />

          <!-- Chart Lines -->
          <path d="M9 8h7" stroke="url(#medicalGradient)" stroke-width="2.5" stroke-linecap="round"/>
          <path d="M8 12h6" stroke="url(#medicalGradient)" stroke-width="2.5" stroke-linecap="round"/>
          <path d="M11 16h5" stroke="url(#medicalGradient)" stroke-width="2.5" stroke-linecap="round"/>

          <!-- Optional subtle highlight for a polished look -->
          <rect width="18" height="18" x="3" y="3" rx="3" stroke="white" stroke-opacity="0.2" stroke-width="1" />
        </svg>
      </button>
      <button class="floating-icon-btn condition-audit-btn" id="conditionAuditBtn" data-tooltip="Audit Findings" aria-label="Audit Details">
        <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none">
            <defs>
              <!-- Gradient for clipboard top -->
              <linearGradient id="clipGradient" x1="0" y1="0" x2="0" y2="6" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stop-color="#00B8D9"/>
                <stop offset="100%" stop-color="#0094FF"/>
              </linearGradient>
            </defs>

            <!-- Paper background -->
            <rect x="5" y="4" width="14" height="17" rx="2.5" fill="white" stroke="#CBD5E1" stroke-width="1.8"/>

            <!-- Paper lines -->
            <line x1="7" y1="9" x2="17" y2="9" stroke="#D1D5DB" stroke-width="1" stroke-linecap="round"/>
            <line x1="7" y1="12" x2="17" y2="12" stroke="#D1D5DB" stroke-width="1" stroke-linecap="round"/>
            <line x1="7" y1="15" x2="17" y2="15" stroke="#D1D5DB" stroke-width="1" stroke-linecap="round"/>

            <!-- Clipboard top -->
            <rect x="8" y="2" width="8" height="4" rx="1" fill="url(#clipGradient)" stroke="#007BFF" stroke-width="1.5"/>

            <!-- Pen (black version) -->
            <path d="M21.378 12.626a1 1 0 0 0-3.004-3.004l-4.01 4.012a2 2 0 0 0-.506.854l-.837 2.87a.5.5 0 0 0 .62.62l2.87-.837a2 2 0 0 0 .854-.506z"
                  fill="black" stroke="#222" stroke-width="1.3"/>

            <!-- Highlight pen tip -->
            <circle cx="18.6" cy="11.1" r="0.7" fill="white" opacity="0.8"/>

            <!-- Subtle shadow for depth -->
            <rect x="5" y="4" width="14" height="17" rx="2.5" stroke="black" stroke-opacity="0.08" stroke-width="1"/>
        </svg>

      </button>

    `;

    document.body.appendChild(buttonsDiv);

    // Add event listeners
  // wire up chart button click below

    document.getElementById('chartBtn').addEventListener('click', async () => {
      // Ensure UI is visible and load chart details using the current member context (tryAutoLoad sets these)
      showPanel('chart');
      const chartContent = document.getElementById('chartContent');
      if (chartContent) chartContent.innerHTML = `<div style="padding:20px">Loading chart details...</div>`;
      try {
        // Pass the current cached member context explicitly to the loader
        await showChartDetails(currentMemberId, currentMemberName);
      } catch (err) {
        console.error('Failed to fetch chart details:', err);
        if (chartContent) chartContent.innerHTML = `<div style="padding:20px;color:#c00">Failed to load chart details: ${err.message}</div>`;
      }
    });
    // When user clicks Audit, show panel and fetch audit details via service worker
    document.getElementById('conditionAuditBtn').addEventListener('click', async () => {
      // Ensure UI is visible
      showPanel('conditionAudit');
      const chartContent = document.getElementById('chartContent');
      if (chartContent) chartContent.innerHTML = `<div style="padding:20px">Loading audit details...</div>`;
      // show loading state in header count area
      const headerCountEl = document.getElementById('chartResultsCount');
      if (headerCountEl) headerCountEl.textContent = 'Loading...';
      try {
        await fetchAuditDetails(currentMemberId || '89700511', currentMemberName || 'John Doe');
      } catch (err) {
        console.error('Failed to fetch audit details:', err);
        if (chartContent) chartContent.innerHTML = `<div style="padding:20px;color:#c00">Failed to load audit details: ${err.message}</div>`;
      }
    });

    return buttonsDiv;
  }

  // Create backdrop
  function createBackdrop() {
    const existing = document.getElementById('backdrop');
    if (existing) return existing;

    const backdrop = document.createElement('div');
    backdrop.id = 'backdrop';
    backdrop.className = 'backdrop';
    backdrop.addEventListener('click', closePanel);
    document.body.appendChild(backdrop);
    return backdrop;
  }

  // Create floating panel
  function createFloatingPanel() {
    const existing = document.getElementById(FLOATING_DIV_ID);
    if (existing) return existing;

    const div = document.createElement('div');
    div.id = FLOATING_DIV_ID;
    div.className = 'hidden';
    const logoUrl = chrome.runtime.getURL('HOM_Logo.svg');

    // make container relative so we can absolutely position the logo above the header
    div.style.position = 'relative';

    div.innerHTML = `
      
      <div class="chart-header" style="padding-right:84px;display:flex;align-items:center;justify-content:space-between;gap:12px;">
      <div class="panel-top" style="display:flex;padding:6px 12px;justify-content:flex-end;">
        <!-- logo + label container (right-aligned) -->
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;">
          <img id="homLogoTop" src="${logoUrl}" alt="HOM" style="width:40px;height:40px;object-fit:contain;border-radius:6px;background:#fff;padding:4px;box-shadow:0 3px 8px rgba(0,0,0,0.12);" />
          <div style="font-weight:700;font-size:11px;color:#111;line-height:1;transform: translateX(2px);">AADI 2.0</div>
        </div>
      </div>
        <div style="display:flex;flex-direction:column;gap:4px;flex:1;">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;">
            <h3 id="chartTitle" style="font-size:15px !important;margin:0;">HCC Opportunities <span id="chartCount" style="font-weight:600;margin-left:8px;">[ 0 ]</span></h3>
            <div id="patientNameDisplay" style="text-align:right;font-weight:700;font-size:15px;">Loading..</div>
          </div>
          <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;">
            <div id="chartSubTitle" class="chart-subtitle"></div>
            <div id="chartResultsCount" class="chart-subtitle" style="text-align:right;"></div>
          </div>
        </div>
        <button class="close-btn" id="closeChartDiv">✕</button>
      </div>
      <!-- removed duplicate absolute-positioned logo to avoid duplication -->
      <div id="chartContent"></div>
    `;
    // append and wire close button
    document.body.appendChild(div);
    const closeBtn = div.querySelector('#closeChartDiv');
    if (closeBtn) closeBtn.addEventListener('click', closePanel);
    return div;
  }

  // Show/activate the floating panel. type: 'chart' | 'conditionAudit'
  function showPanel(type) {
    createFloatingButtons();
    createBackdrop();
    createFloatingPanel();
    const div = document.getElementById(FLOATING_DIV_ID);
    const backdrop = document.getElementById('backdrop');
    const floatingButtons = document.getElementById('floatingButtons');
    const chartBtn = document.getElementById('chartBtn');
    const conditionAuditBtn = document.getElementById('conditionAuditBtn');

    if (!div || !backdrop || !floatingButtons) return;

    // show panel and backdrop
    div.classList.remove('hidden');
    setTimeout(() => div.classList.add('show'), 10);
    backdrop.classList.add('visible');

    // default shifted state
    floatingButtons.classList.add('shifted');
    // audit-specific adjustments (wider panel and move buttons further left)
    if (type === 'conditionAudit') {
      div.classList.add('audit');
      floatingButtons.classList.add('audit-shift');
    } else {
      div.classList.remove('audit');
      floatingButtons.classList.remove('audit-shift');
    }

    contentType = type;

    if (type === 'chart') {
      if (chartBtn) chartBtn.classList.add('active');
      if (conditionAuditBtn) {
        conditionAuditBtn.classList.remove('active');
        conditionAuditBtn.setAttribute('data-tooltip', 'Audit Details');
      }
      if (chartBtn) chartBtn.setAttribute('data-tooltip', 'Active - Chart Details');
  // Keep title static and show loading state in the bracketed count while data fetches
  const titleEl = document.getElementById('chartTitle');
  if (titleEl) titleEl.innerHTML = 'HCC Opportunities <span id="chartCount" style="font-weight:600;margin-left:8px;">[ Loading... ]</span>';
  // Move the date/metadata to the right-aligned results area.
  // Keep the left subtitle empty; show "Chart reviewed on {date}" on the right instead.
  const resultsEl = document.getElementById('chartResultsCount');
  if (resultsEl) resultsEl.textContent = currentDos ? `Chart reviewed on ${currentDos}` : '';
      // patient name display updated when data loads
      showChartContent();
    } else if (type === 'conditionAudit') {
      if (conditionAuditBtn) {
        conditionAuditBtn.classList.add('active');
        conditionAuditBtn.setAttribute('data-tooltip', 'Audit Findings');
      }
      if (chartBtn) chartBtn.classList.remove('active');
      if (chartBtn) chartBtn.setAttribute('data-tooltip', 'Chart Details');
      document.getElementById('chartTitle').textContent = 'Audit Details';
      const subEl = document.getElementById('chartSubTitle');
      if (subEl) subEl.textContent = '';
      showConditionAuditContent();
    }
  }


  async function showChartDetails(memberIdArg, memberNameArg) {
    // Accept optional memberId/memberName arguments. If not provided, fall back to the
    // cached `currentMemberId`/`currentMemberName` (set by tryAutoLoad) and lastly try to
    // infer values from the page DOM.
    let memberId = memberIdArg || null;
    let memberName = memberNameArg || '';

    // Show loading UI while fetching
    showPanel('chart');
    isChartLoading = true;
    // show a loading placeholder in the content area
    const chartContent = document.getElementById('chartContent');
    if (chartContent) {
      chartContent.innerHTML = `<div style="padding:20px">Loading chart details...</div>`;
    }
    // update header count to show loading state
    const headerCountEl = document.getElementById('chartResultsCount');
    if (headerCountEl) headerCountEl.textContent = 'Loading...';

    try {
      const apiData = await fetchChartDetailsFromServiceWorker(memberId, memberName);
      // The service worker returns a wrapper { status, message, data }
      const payload = apiData && apiData.data ? apiData.data : apiData;
      const apiConditions = payload && payload.medical_conditions ? payload.medical_conditions : [];


      const mapped = mapApiMedicalConditions(apiConditions);


      // Replace medicalConditionsData contents with mapped results
      medicalConditionsData.length = 0;
      Array.prototype.push.apply(medicalConditionsData, mapped);
  isChartLoading = false;
      // Update patient name and chart count if member info available
      const patientEl = document.getElementById('patientNameDisplay');
      if (payload && payload.member) {
        const name = `${payload.member.fname || ''} ${payload.member.lname || ''}`.trim();
        if (name && patientEl) patientEl.textContent = name;
      } else if (memberName && patientEl) {
        patientEl.textContent = memberName;
      }
  // Extract DOS (date of service) from payload.appointment.DOS and format for subtitle
      try {
        const dosIso = payload && payload.appointment && (payload.appointment.DOS || payload.appointment.dos);
        if (dosIso) {
          const formatted = new Date(dosIso).toLocaleDateString();
          currentDos = formatted;
          // Put the date on the right-aligned results element instead of the left subtitle
          const resultsElDos = document.getElementById('chartResultsCount');
          if (resultsElDos) resultsElDos.textContent = `Chart reviewed on ${formatted}`;
          const sub = document.getElementById('chartSubTitle');
          if (sub) sub.textContent = '';
        } else {
          const resultsElDos = document.getElementById('chartResultsCount');
          if (resultsElDos) resultsElDos.textContent = '';
          const sub = document.getElementById('chartSubTitle');
          if (sub) sub.textContent = '';
        }
      } catch (e) {
        console.warn('Failed to parse DOS from chart payload', e);
      }
  // member details updated

  // Refresh UI and update the bracketed count
  updateChartContent();
  const countEl = document.getElementById('chartCount');
  if (countEl) countEl.textContent = `[ ${medicalConditionsData.length} ]`;
    } catch (err) {
      console.error('Failed to fetch chart details:', err);
      isChartLoading = false;
      if (chartContent) {
        chartContent.innerHTML = `<div style="padding:20px;color:#c00">Failed to load chart details: ${err.message}</div>`;
      }
    }
  }

  function closePanel() {
    const div = document.getElementById(FLOATING_DIV_ID);
    const backdrop = document.getElementById('backdrop');
    const floatingButtons = document.getElementById('floatingButtons');
    const chartBtn = document.getElementById('chartBtn');
    const conditionAuditBtn = document.getElementById('conditionAuditBtn');

    div.classList.remove('show');
    backdrop.classList.remove('visible');
    floatingButtons.classList.remove('shifted');
    // remove audit-specific classes when closing
    div.classList.remove('audit');
    floatingButtons.classList.remove('audit-shift');
    chartBtn.classList.remove('active');
    if (conditionAuditBtn) {
      conditionAuditBtn.classList.remove('active');
      conditionAuditBtn.setAttribute('data-tooltip', 'Audit Details');
    }
    chartBtn.setAttribute('data-tooltip', 'Chart Details');

    setTimeout(() => div.classList.add('hidden'), 400);
  }

  function showChartContent() {
    // Check if content already exists
    let chartContent = document.getElementById('chartContent');

    if (!chartContent) {
      // Try to create the panel and re-query
      createFloatingPanel();
      chartContent = document.getElementById('chartContent');
    }
    if (!chartContent) return; // give up safely if still missing


    let medicalSection = chartContent.querySelector('.medical-conditions-section');

    if (!medicalSection) {
      // First time - create the structure
      // Keep the conditional present (for future toggling) but intentionally render no search UI
      const searchBarHTML = showSearchBar ? '' : '';

      chartContent.innerHTML = `
          <div class="medical-conditions-section">
            ${searchBarHTML}
            <div class="medical-conditions-scroll">
            </div>
          </div>
        `;
    }

    // Update the content
    updateChartContent();
  }

  function updateChartContent() {
  const filteredConditions = filterMedicalConditions();

    // Prefer scoping to the panel's chartContent to avoid collisions and to handle dynamic inserts
    const chartContent = document.getElementById('chartContent');
    let scrollContainer = chartContent ? chartContent.querySelector('.medical-conditions-scroll') : null;
    // Prefer the header results count if present, otherwise fallback to the older in-search results element
    let resultsCount = document.getElementById('chartResultsCount') || (chartContent ? chartContent.querySelector('.search-results-count') : null);

    // Fallback to global selectors if not found (keeps previous behavior)
    if (!scrollContainer) scrollContainer = document.querySelector('.medical-conditions-scroll');
    if (!resultsCount) resultsCount = document.querySelector('.search-results-count');

  // Scroll/result count presence checked above

    // If not found, attempt to (re)create the chart content structure and re-query
    if (!scrollContainer || !resultsCount) {
      console.warn('Scroll container or results count not found, recreating chart content structure.');
      showChartContent();
      // re-query after ensuring structure exists
      const newChartContent = document.getElementById('chartContent');
      scrollContainer = newChartContent ? newChartContent.querySelector('.medical-conditions-scroll') : scrollContainer;
      resultsCount = newChartContent ? newChartContent.querySelector('.search-results-count') : resultsCount;
  // after recreate - presence flags available in scrollContainer/resultsCount
    }

    if (!scrollContainer) {
      console.error('Scroll container still not found! Aborting update.'); // Debug log
      return;
    }

    if (filteredConditions.length === 0 && searchTerm.trim()) {
      // Show no results UI
      scrollContainer.innerHTML = `
         <div style="text-align: center; padding: 40px 20px; height: 60px; font-size: 14px; color: #6c757d; font-style: italic; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px;">
           <div style="font-size: 24px;">🔍</div>
           <div>No conditions found</div>
           <div style="font-size: 12px; color: #9ca3af;">
             No conditions match your search for "<strong>${searchTerm}</strong>"
           </div>
         </div>
       `;
    } else {
      // Show filtered conditions
      const conditionsHTML = filteredConditions
        .map(condition => {
          const RADV_score = condition.details.RADV_score || 0;
          const code_status = condition.details.code_status || '';
          const rxHcc = condition.details.rxHcc;
          const hcc28 = condition.details.hcc28;
          const isRADV = (code_status === "DOCUMENTED" && (RADV_score > 0 && RADV_score < 4) && (rxHcc?.length > 0 || hcc28?.length > 0));

          // Prepare code type badge with explicit coloring for UPGRADE (green) and MISSED (red)
          const _codeType = (condition.details && condition.details.code_type) ? String(condition.details.code_type) : '';
          let codeTypeBadge = '';
          if (_codeType) {
            const upper = _codeType.toUpperCase();
            if (upper === 'MISSED') {
              // MISSED should display as OPPORTUNITIES and be styled green (use documented/green style)
              codeTypeBadge = `<span class="code-type-badge documented">OPPORTUNITY</span>`;
            } else if (upper === 'UPGRADE') {
              // UPGRADE should be orange (use opportunities/orange style)
              codeTypeBadge = `<span class="code-type-badge opportunities">${_codeType}</span>`;
            } else {
              codeTypeBadge = `<span class="code-type-badge ${_codeType.toLowerCase()}">${_codeType}</span>`;
            }
          }

          return `
           <div class="medical-condition-card" style="${isRADV ? 'border-left: 4px solid #dc2626; border-top: 1px solid #dc2626; border-right: 1px solid #dc2626; border-bottom: 1px solid #dc2626;' : ''}">
           <!-- Badges Row -->
           <div class="card-badges-row">
             <div class="badge-group">
               <span class="icd-badge">ICD: ${condition.details.icd10}</span>
               ${condition.details.hcc28?.length > 0
              ? `<span class="hcc-badge">HCC: ${condition.details.hcc28}</span>`
              : ""
            }
               ${condition.details.rxHcc
              ? `<span class="rx-hcc-badge">Rx-HCC: ${condition.details.rxHcc}</span>`
              : ""
            }
             </div>
             <div style="display: flex; align-items: center; gap: 8px;">
               ${codeTypeBadge}
               ${isRADV
              ? `<span class="audit-score-icon">Audit: ${RADV_score}</span>`
              : ""
            }
             </div>
           </div>

           <!-- Title -->
           <h5 class="card-title" style="${isRADV ? 'color: #dc2626;' : ''}">${condition.title}</h5>

           <!-- Clinical Indicators (icon label) -->
           <div class="card-info-row indicators-row">
             <span class="label">
               <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-flask-conical w-4 h-4 text-blue-600"><path d="M14 2v6a2 2 0 0 0 .245.96l5.51 10.08A2 2 0 0 1 18 22H6a2 2 0 0 1-1.755-2.96l5.51-10.08A2 2 0 0 0 10 8V2"></path><path d="M6.453 15h11.094"></path><path d="M8.5 2h7"></path></svg>
             </span>
             <span class="value">${condition.clinicalIndicators}</span>
           </div>

          <!-- Code Explanation (icon label) -->
          ${formatCodeExplanationHtml((condition.codeExplanation && condition.codeExplanation.trim()) ? condition.codeExplanation : (condition.description || ''))}

          <!-- Note Section -->
          <div class="card-info-row">
            <span class="label">
              <button aria-label="add-note" class="note-button" tabindex="0">
                <!-- left icon -->
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="note-icon" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                <span class="note-text">Notes</span>
              </button>
            </span>
            <span class="value" style="display:block;transform: translateY(10px);">${condition.noteText || ' '}</span>
          </div>
        </div>
       `;
        })
        .join('');

      scrollContainer.innerHTML = conditionsHTML;
    }

    // Update results count (show loading state while data is being fetched)
    if (resultsCount) {
      if (isChartLoading) {
        resultsCount.textContent = 'Loading...';
      } else {
        // Show the review date on the right when not loading (left header bracket remains the canonical count)
        resultsCount.textContent = currentDos ? `Chart reviewed on ${currentDos}` : '';
      }
    }
  }

  function handleSearch(value) {
    searchTerm = value;
    // updated searchTerm

    // Always update chart content when searching
    updateChartContent();

    if (contentType === 'chart') {
      const input = document.querySelector('.search-input');
      const isFocused = document.activeElement === input;
      // Refocus the input if it was focused before
      setTimeout(() => {
        const newInput = document.querySelector('.search-input');
        if (newInput && isFocused) {
          newInput.focus();
          // Restore cursor position
          newInput.setSelectionRange(value.length, value.length);
        }
      }, 0);
    }
  }


  function handleConditionAuditSearch(value) {
    conditionAuditSearchTerm = value;
    // updated conditionAuditSearchTerm
    if (contentType === 'conditionAudit') {
      const input = document.querySelector('.search-input');
      const isFocused = document.activeElement === input;
      showConditionAuditContent();
      // Refocus the input if it was focused before
      setTimeout(() => {
        const newInput = document.querySelector('.search-input');
        if (newInput && isFocused) {
          newInput.focus();
          // Restore cursor position
          newInput.setSelectionRange(value.length, value.length);
        }
      }, 0);
    }
  }


  // Helper function to render expanded row details
  function renderExpandedAuditDetails(row) {
    const raw = row.raw || {};
    const pnDates = row.pn_dates || raw.pn_dates || '';
    const radvDate = row.audit_date || row.auditDate || raw.audit_date || raw.auditDate || '';
    const details = [
      { label: 'PN DOS', value: pnDates },
      { label: 'RADV Concerns', value: raw.radv_concerns },
      { label: 'Diagnosis Criteria Gaps', value: raw.diag_criteria_gaps },
      { label: 'CI Gaps', value: raw.ci_gaps },
      { label: 'Contradictory Evidence', value: raw.contradictory_evidence },
      { label: 'Rationale', value: raw.rationale },
      { label: 'Misclassification Potential', value: raw.miscls_potential },
      { label: 'RADV Score', value: row.auditScore },
      { label: 'RADV Date', value: radvDate },
    ];

    const validDetails = details.filter(item =>
      item.value !== undefined && item.value !== null && String(item.value).trim() !== '' && String(item.value).trim() !== '-'
    );

    if (validDetails.length === 0) {
      return '<div class="audit-expanded-empty">No additional audit details available.</div>';
    }

    return `
      <div class="audit-expanded-grid">
        ${validDetails.map(item => `
          <div class="audit-detail-row">
            <div class="audit-detail-label">${item.label}</div>
            <div class="audit-detail-value">${escapeHtml(String(item.value))}</div>
          </div>
        `).join('')}
      </div>
    `;
  }

  // PN dates rendering removed from table rows (PN DOS moved into expanded details)

  // Global expanded rows state
  window.expandedAuditRows = window.expandedAuditRows || new Set();

  // Toggle expand handler
  window.toggleAuditRowExpand = function (rowId) {
    const idStr = String(rowId);
    // Ensure expandedAuditRows exists
    if (!window.expandedAuditRows) {
      window.expandedAuditRows = new Set();
    }
    if (window.expandedAuditRows.has(idStr)) {
      window.expandedAuditRows.delete(idStr);
    } else {
      window.expandedAuditRows.add(idStr);
    }
    showConditionAuditContent();
  };

  function showConditionAuditContent() {
    // Filter data first
    let filteredData = filterConditionAuditData();
    // Sort data if needed
    let sortedData = [...filteredData];
    if (conditionAuditSortConfig.key) {
      sortedData.sort((a, b) => {
        if (conditionAuditSortConfig.key === 'auditScore' || conditionAuditSortConfig.key === 'hccCode') {
          return conditionAuditSortConfig.direction === 'asc' ? a[conditionAuditSortConfig.key] - b[conditionAuditSortConfig.key] : b[conditionAuditSortConfig.key] - a[conditionAuditSortConfig.key];
        }
        const aVal = String(a[conditionAuditSortConfig.key]).toLowerCase();
        const bVal = String(b[conditionAuditSortConfig.key]).toLowerCase();
        return conditionAuditSortConfig.direction === 'asc' ? aVal < bVal ? -1 : aVal > bVal ? 1 : 0 : aVal > bVal ? -1 : aVal < bVal ? 1 : 0;
      });
    }

    const chartContent = document.getElementById('chartContent');
    const tableRows = sortedData.map((row, i) => {
      const rowId = String(row.id || i);
      const isExpanded = window.expandedAuditRows && window.expandedAuditRows.has(rowId);
      const raw = row.raw || {};
    const documentedCode = row.documented_icd_code || raw.documented_icd_code || row.accurateCode || '';
    const suggestedCode = row.accurate_code || raw.accurate_code || '';
    const hccCode = row.hcc_code || row.hccCode || '';
    const evidenceStrength = row.evidence_strength || row.evidenceStrength || '';
  // PN DOS column removed from the table and moved to expanded details; RADV/initial columns were removed earlier

      return `
        <tr class="${isExpanded ? 'expanded' : ''}">
          <td class="expand-col">
            <button class="expand-btn ${isExpanded ? 'expanded' : ''}" onclick="window.toggleAuditRowExpand('${rowId}')" aria-label="${isExpanded ? 'Collapse' : 'Expand'} row">
              <span class="expand-chevron" style="display:inline-block;transition:transform 0.2s;transform:${isExpanded ? 'rotate(180deg)' : 'rotate(0deg)'}">▼</span>
            </button>
          </td>
          <td class="condition-name-col">${escapeHtml(row.conditionName || row.documented_condition || '')}</td>
          <td class="text-center">${escapeHtml(documentedCode)}</td>
          <td class="text-center">${escapeHtml(suggestedCode)}</td>
          <td class="text-center">${escapeHtml(hccCode)}</td>
          <!-- PN DOS column removed from table rows; shown in expanded details -->
          <td>${escapeHtml(evidenceStrength)}</td>
          <!-- RADV Date, RADV Score, Initial Quality Score columns removed per request -->
        </tr>
        ${isExpanded ? `
        <tr class="audit-expanded-row">
          <td colspan="7">
            <div class="audit-expanded-container">
              ${renderExpandedAuditDetails(row)}
            </div>
          </td>
        </tr>
        ` : ''}
      `;
    }).join('');

    // Render audit table
    chartContent.innerHTML = `
      <div class="audit-table-section">
        <div class="audit-table-container">
          <div class="audit-table-wrapper">
            ${sortedData.length === 0 ?
        `<div style="text-align: center; padding: 40px 20px; height: 60px; font-size: 14px; color: #6c757d; font-style: italic; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px;">
                  <div style="font-size: 24px;">🔍</div>
                  <div>No audit records found</div>
               </div>` :
        `<table class="audit-table">
                <thead>
                  <tr>
                    <th></th>
                    <th>Condition Name</th>
                    <th>Documented Code</th>
                    <th>Suggested Code</th>
                    <th>HCC</th>
                    <th>Evidence</th>
                  </tr>
                </thead>
                <tbody>
                  ${tableRows}
                </tbody>
              </table>`
      }
          </div>
        </div>
      </div>
    `;

    // Update header results count for audit view
    try {
      const resultsEl = document.getElementById('chartResultsCount');
      if (resultsEl) {
        // Prefer showing the chart DOS (date of service) from the Chart API when available.
        // Fallback to the record count if DOS is not yet available.
        if (currentDos) {
          resultsEl.textContent = `Chart reviewed on ${currentDos}`;
        } else {
          resultsEl.textContent = `${sortedData.length} records`;
        }
      }
    } catch (e) {
      console.warn('Failed to update chartResultsCount for audit view', e);
    }

    // Add event delegation for expand buttons after rendering
    setTimeout(() => {
      const expandButtons = chartContent.querySelectorAll('.expand-btn');
      expandButtons.forEach((btn) => {
        const onclickAttr = btn.getAttribute('onclick');
        if (onclickAttr && onclickAttr.includes('toggleAuditRowExpand')) {
          // Extract the rowId from the onclick attribute
          const match = onclickAttr.match(/'([^']+)'/);
          if (match) {
            const rowId = match[1];
            btn.addEventListener('click', function (e) {
              e.preventDefault();
              e.stopPropagation();
              window.toggleAuditRowExpand(rowId);
            });
          }
        }
      });
    }, 0);
  }


  // 🧩 Detect patient info and trigger automatically (non-blocking)
  function tryAutoLoad() {
    if (hasLoaded) return;

    // const chartNumber= window.prompt("enter the chart number");
    // const patientName= window.prompt("enter the patient name");
    const table = document.querySelector(TABLE_SELECTOR);
    const ul = document.querySelector(UL_SELECTOR);
    if (!table || !ul) return;

    const chartNumber = document.querySelector("#chartNumber")?.textContent?.trim();
    const patientName = document.querySelector("#patientName")?.textContent?.trim();

    if (!chartNumber || !patientName) {
      // Nothing to auto-load yet; wait for DOM mutations
      return;
    }

    // Initialize the UI components
    addStyles();
    createFloatingButtons();
    createBackdrop();
    createFloatingPanel();

    // Persist detected member info and mark loaded
    currentMemberId = chartNumber;
    currentMemberName = patientName;
    hasLoaded = true;
  }

  // Make functions globally available for onclick handlers
  window.handleSearch = handleSearch;
  window.handleConditionAuditSearch = handleConditionAuditSearch;
  window.sortConditionAuditData = sortConditionAuditData;
  window.renderConditionAuditSortIcon = renderConditionAuditSortIcon;

  // 🧠 Observe DOM changes
  observer = new MutationObserver(() => tryAutoLoad());
  observer.observe(document.body, { childList: true, subtree: true });

  // Try once immediately
  tryAutoLoad();
})();
