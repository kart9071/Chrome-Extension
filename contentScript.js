(() => {
  /* global chrome */
  const FLOATING_DIV_ID = "ct-chart-floating";
  const TABLE_SELECTOR = "#ctl00_MainContent_ucPatientDetail_dlPatient";
  const UL_SELECTOR = "#ulReadPatientDetail";

  let observer;
  let hasLoaded = false;
  // Global variable
  let dqaData = [];

  window.dqaCategoryFilter =
    window.dqaCategoryFilter || 'HCC';

  window.dqaCategoryFilters =
    window.dqaCategoryFilters || ['HCC', 'RXHCC'];
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

  function injectAuditStyles() {

    if (document.getElementById('audit-accordion-styles')) return;

    const style = document.createElement('style');

    style.id = 'audit-accordion-styles';

    style.textContent = `
    .audit-accordion-container {
      display: flex !important;
      flex-direction: column !important;
      gap: 8px !important;
      padding: 8px !important;
      background: #f8f9fa !important;
    }

    .audit-card {
      background: #ffffff !important;
      border: 1px solid #e5e7eb !important;
      border-radius: 8px !important;
      overflow: hidden !important;
      box-shadow: 0 1px 3px rgba(0,0,0,0.08) !important;
    }

    .audit-card-header {
      padding: 12px !important;
      display: flex !important;
      justify-content: space-between !important;
      align-items: flex-start !important;
      gap: 12px !important;
    }

    .audit-card-info {
      flex: 1 !important;
    }

    .audit-condition-name {
      font-size: 14px !important;
      font-weight: 700 !important;
      color: #111827 !important;
      margin-bottom: 4px !important;
    }

    .audit-codes-row {
      display: flex !important;
      gap: 8px !important;
      flex-wrap: wrap !important;
      font-size: 12px !important;
      color: #6b7280 !important;
    }

    .audit-status-badge {
      padding: 6px 10px !important;
      border-radius: 999px !important;
      font-size: 11px !important;
      font-weight: 700 !important;
      white-space: nowrap !important;
    }

    .status-acceptable {
      background: #ecfdf5 !important;
      color: #065f46 !important;
    }

    .status-delete {
      background: #fef2f2 !important;
      color: #991b1b !important;
    }

    .status-query-required {
      background: #fffbeb !important;
      color: #92400e !important;
    }

    .status-not-applicable {
      background: #eff6ff !important;
      color: #1d4ed8 !important;
    }

    .audit-card-body {
      padding: 12px !important;
      border-top: 1px solid #f3f4f6 !important;
    }

    .dqa-filter-tabs {
  display: flex !important;
  gap: 2px !important;
  padding: 8px 8px 0px 8px !important;
  background: #ffffff !important;
  border-bottom: 1px solid #e5e7eb !important;
  width: 100%;
  justify-content:space-between;
}

.dqa-filter-btn {
  border: 1px solid #cbd5e1 !important;
  background: #f8fafc !important;
  color: #334155 !important;
  padding: 8px 16px !important;
  border-radius: 8px 8px 0 0 !important;
  cursor: pointer !important;
  font-size: 12px !important;
  font-weight: 700 !important;
}

.dqa-filter-btn:hover {
  background: #e2e8f0 !important;
}

.dqa-filter-btn.active {
  background: #114391 !important;
  color: white !important;
  border-color: #114391 !important;
}
 .audit-box {
  display: grid !important;
  grid-template-columns: 150px 1fr !important;
  column-gap: 8px !important;
  margin-bottom: 4px !important;
  align-items: center !important;
}

.audit-label {
  font-size: 12px !important;
  font-weight: 700 !important;
  color: #374151 !important;
  text-align: left !important;
  line-height: 1.2 !important;
  margin: 0 !important;
  padding: 0 !important;
}

.audit-text {
  font-size: 12px !important;
  color: #111827 !important;
  line-height: 1.5 !important;

  text-align: left !important;
  white-space: normal !important;
  word-break: break-word !important;

  margin: 0 !important;
  padding: 0 !important;

  justify-self: start !important;
  align-self: start !important;
  width: 100% !important;

  display: block !important;
}




  `;

    document.head.appendChild(style);
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
    const svgIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4 text-amber-600 lucide lucide-shield-question"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"></path><path d="M9.1 9a3 3 0 0 1 5.82 1c0 2-3 3-3 3"></path><path d="M12 17h.01"></path></svg>`;

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
  let mrAnalysisData = null;
  let isMRAnalysisLoading = false;
  let chartApiData = null; // Cache original chart API response for review status

  // current member context (used for API calls)
  let currentMemberId = null;
  let currentMemberName = null;
  let currentDos = null; // formatted DOS from chart API (for chart and MR Analysis UI)
  let currentAuditDos = null; // formatted DOS from audit API (for audit UI only)
  let isChartLoading = false;
  // Medical Conditions Data (populated from API)
  const medicalConditionsData = [];
  // Condition Audit Table Data (populated from API)
  let conditionAuditData = [];
  // Cached audit review status (used when API returns before panel is created)
  let currentAuditStatusText = '';
  let currentAuditStatusColor = '';
  // Cached chart review status (used when chart API returns during preload)
  let currentChartStatusText = '';
  let currentChartStatusColor = '';
  // DQA empty-response marker so the UI can show not-present immediately
  let dqaNotPresent = false;


  // if (!window.dqaStrengthFilter) {
  //   window.dqaStrengthFilter = "ALL";
  // }

  function showDQAContent() {

    injectAuditStyles();

    if (!window.dqaStrengthFilter) {
      window.dqaStrengthFilter = "STRONG";
    }
    const chartContent =
      document.getElementById('chartContent');

    if (!chartContent) return;

    if (dqaData.length === 0 && dqaNotPresent) {
      showApiNotPresentMessage('dqa');
      return;
    }

    if (!window.expandedDQARows) {
      window.expandedDQARows = new Set();
    }

    const STATUS_OPTIONS = [
      {
        label: "Strong",
        value: "STRONG",
        class: "status-acceptable"
      },
      {
        label: "Medium",
        value: "MEDIUM",
        class: "status-query-required"
      },
      {
        label: "Weak",
        value: "WEAK",
        class: "status-delete"
      }
    ];

    // const filteredData =
    //   window.dqaStrengthFilter === "ALL"
    //     ? dqaData
    //     : dqaData.filter(row =>
    //       (row.documentation_strength || "")
    //         .trim()
    //         .toUpperCase() === window.dqaStrengthFilter
    //     );

    // let filteredData = [...dqaData];

    // // Existing Strong / Moderate / Weak filter
    // if (window.dqaStrengthFilter !== "ALL") {

    //   filteredData = filteredData.filter(row =>
    //     (row.documentation_strength || '')
    //       .trim()
    //       .toUpperCase() === window.dqaStrengthFilter
    //   );
    // }

    let filteredData = [...dqaData];

    const activeFilter = (window.dqaStrengthFilter || "STRONG").trim().toUpperCase();

    // Always apply filter
    filteredData = filteredData.filter(row => {
      const strength = (row.documentation_strength || '')
        .trim()
        .toUpperCase();

      return strength === activeFilter;
    });

    const selectedFilters =
      window.dqaCategoryFilters || [];

    filteredData = filteredData.filter(row => {

      const hcc =
        (row.hcc || '').toString().trim();

      const rxHcc =
        (row.rx_hcc || '').toString().trim();

      let matches = false;

      if (
        selectedFilters.includes('HCC') &&
        hcc !== ''
      ) {
        matches = true;
      }

      if (
        selectedFilters.includes('RXHCC') &&
        rxHcc !== ''
      ) {
        matches = true;
      }

      if (
        selectedFilters.includes('NON-HCC') &&
        hcc === '' &&
        rxHcc === ''
      ) {
        matches = true;
      }

      return matches;

    });
    console.log("filtered data:", filteredData)
    const cardsHtml = filteredData.map((row, i) => {

      const rowId = String(row.id || i);

      const icdCode =
        row["ICD-10"] || '';

      const encounterDates =
        row.encounter_documented || '';

      const meatPresent =
        row.meat_present || '';

      const meatAbsent =
        row.meat_absent || '';

      const supportingEvidence =
        row.supporting_clinical_evidence || '';

      const statusValue =
        (row.documentation_strength || '')
          .trim()
          .toUpperCase();


      return `

    <div class="dqa-condition-card">

      <!-- Badges Row -->
      <div class="dqa-header-row">

        <div class="dqa-condition-text">
    <h5 class="dqa-card-title">
      ${escapeHtml(row.Condition || '')}
    </h5>
  </div>

  <!-- RIGHT: Badges -->
  <div class="dqa-badge-group">
    ${row.hcc ? `<span class="hcc-badge">HCC</span>` : ''}
    ${row.rx_hcc ? `<span class="rx-hcc-badge">Rx-HCC</span>` : ''}
  </div>
  
      </div>

      <!-- Encounter Date -->
      ${encounterDates
          ? `
      <div style="margin-bottom:10px;">
        <span style="
          display:inline-flex;
          align-items:center;
          gap:4px;
          padding:4px 8px;
          color:black;
          font-size:11px;
          font-weight:600;
        ">
          📅 ${escapeHtml(encounterDates)}
        </span>
      </div>
    `
          : ''
        }

      ${meatPresent
          ? `
    <div class="dqa-info-row dqa-indicators-row">
      <span class="label" style="
  color:#16a34a;
  font-size:16px;
  line-height:1;
">
  ✅
</span>

      <span class="value">
        ${escapeHtml(meatPresent)}
      </span>
    </div>
  `
          : ''
        }

${meatAbsent
          ? `
    <div class="dqa-info-row dqa-indicators-row" style="margin-top:8px;">
      <span class="label" style="
  color:#dc2626;
  font-size:16px;
  line-height:1;
">
  ❌
</span>

      <span class="value">
        ${escapeHtml(meatAbsent)}
      </span>
    </div>
  `
          : ''
        }

      <!-- Supporting Evidence -->
      ${supportingEvidence
          ? `
            <div class="dqa-info-row dqa-evidence-row">

              <span class="label">

                 <svg xmlns="http://www.w3.org/2000/svg"
             width="18"
             height="18"
             viewBox="0 0 24 24"
             fill="none"
             stroke="currentColor"
             stroke-width="2"
             stroke-linecap="round"
             stroke-linejoin="round"
             class="lucide lucide-flask-conical">

          <path d="M14 2v6a2 2 0 0 0 .245.96l5.51 10.08A2 2 0 0 1 18 22H6a2 2 0 0 1-1.755-2.96l5.51-10.08A2 2 0 0 0 10 8V2"></path>
          <path d="M6.453 15h11.094"></path>
          <path d="M8.5 2h7"></path>

        </svg>

              </span>

              <span class="value">
                ${escapeHtml(supportingEvidence)}
              </span>

            </div>
          `
          : ''
        }

    </div>

  `;

    }).join('');

    chartContent.innerHTML = `
    <div style="
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:16px;
  margin-bottom:12px;
  flex-wrap:wrap;
">
     <div class="dqa-filter-tabs">

    <div>
     <button
      class="dqa-filter-btn ${window.dqaStrengthFilter === 'WEAK' ? 'active' : ''}"
      data-filter="WEAK">
      Weak
    </button>

    <button
      class="dqa-filter-btn ${window.dqaStrengthFilter === 'MODERATE' ? 'active' : ''}"
      data-filter="MODERATE">
      Moderate
    </button>

    <button
      class="dqa-filter-btn ${window.dqaStrengthFilter === 'STRONG' ? 'active' : ''}"
      data-filter="STRONG">
      Strong
    </button>
    </div>
 <!-- Legend -->
  <div style="
    display:flex;
    align-items:center;
    gap:8px;
    font-size:9px;
    font-weight:600;
    color:#64748b;
    flex-wrap:wrap;
  ">

    <span style="display:flex;align-items:center;gap:4px;">
      📅 Encounter Dates
    </span>

    <span style="
      display:flex;
      align-items:center;
      gap:4px;
      color:#64748b;
    ">
      ✅ MEAT Present
    </span>

    <span style="
      display:flex;
      align-items:center;
      gap:4px;
      color:#64748b;
    ">
      ❌ MEAT Absent
    </span>

    <span style="display:flex;align-items:center;gap:4px;">

                 <svg xmlns="http://www.w3.org/2000/svg"
             width="14"
             height="14"
             viewBox="0 0 24 24"
             fill="none"
             stroke="currentColor"
             stroke-width="2"
             stroke-linecap="round"
             stroke-linejoin="round"
             class="lucide lucide-flask-conical">

          <path d="M14 2v6a2 2 0 0 0 .245.96l5.51 10.08A2 2 0 0 1 18 22H6a2 2 0 0 1-1.755-2.96l5.51-10.08A2 2 0 0 0 10 8V2"></path>
          <path d="M6.453 15h11.094"></path>
          <path d="M8.5 2h7"></path>

        </svg>

            Supporting Evidence
    </span>

  </div>

</div>
  </div>
    <div class="dqa-conditions-scroll">
  ${filteredData.length === 0 ? `
    <div style="
      text-align:center;
      padding:40px 20px;
      font-size:14px;
      color:#6c757d;
      font-style:italic;
    ">
      No DQA records found
    </div>
  ` : cardsHtml}
</div>
  `;

    const filterButtons =
      chartContent.querySelectorAll('.dqa-filter-btn');



    filterButtons.forEach(btn => {

      btn.addEventListener('click', e => {

        e.stopPropagation();

        window.dqaStrengthFilter =
          btn.dataset.filter;

        showDQAContent();

      });

    });

    const resultsEl =
      document.getElementById('chartResultsCount');

    // if (resultsEl) {
    //   resultsEl.textContent =
    //     `${filteredData.length} records`;
    // }
    if (resultsEl) {

      resultsEl.innerHTML = `

    <div style="
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap:16px;
      flex-wrap:wrap;
    ">

      <div style="
        display:flex;
        align-items:center;
        gap:12px;
        font-size:13px;
      ">

        <label style="display:flex;align-items:center;gap:4px;cursor:pointer;">
          <input
            type="checkbox"
            class="dqa-category-checkbox"
            value="HCC"
            ${window.dqaCategoryFilters?.includes('HCC') ? 'checked' : ''}
          />
          HCC
        </label>

        <label style="display:flex;align-items:center;gap:4px;cursor:pointer;">
          <input
            type="checkbox"
            class="dqa-category-checkbox"
            value="RXHCC"
            ${window.dqaCategoryFilters?.includes('RXHCC') ? 'checked' : ''}
          />
          RXHCC
        </label>

        <label style="display:flex;align-items:center;gap:4px;cursor:pointer;">
          <input
            type="checkbox"
            class="dqa-category-checkbox"
            value="NON-HCC"
            ${window.dqaCategoryFilters?.includes('NON-HCC') ? 'checked' : ''}
          />
          NON-HCC
        </label>

      </div>

    </div>

  `;

      const checkboxes =
        resultsEl.querySelectorAll('.dqa-category-checkbox');

      checkboxes.forEach(cb => {

        cb.addEventListener('change', () => {

          if (!window.dqaCategoryFilters) {
            window.dqaCategoryFilters = [];
          }

          if (cb.checked) {

            if (
              !window.dqaCategoryFilters.includes(cb.value)
            ) {
              window.dqaCategoryFilters.push(cb.value);
            }

          } else {

            window.dqaCategoryFilters =
              window.dqaCategoryFilters.filter(
                item => item !== cb.value
              );

          }

          console.log(
            'Selected Filters:',
            window.dqaCategoryFilters
          );
          showDQAContent();

        });

      });

    }

  }

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

      #conditionAuditBtn,
      #mrAnalysisBtn {
        display: none;
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

      .dqa-middle-tabs{
        justify-content: space-between;
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

       .floating-icon-btn.notes-btn.active::before {
         background: linear-gradient(135deg, #28a745 0%, #20c997 100%) !important;
       }

       .floating-icon-btn.notes-btn.active::after {
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

       .floating-icon-btn.notes-btn.active {
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

       /* MR Analysis Button Active States */
       .floating-icon-btn.mr-analysis-btn.active::before {
         background: linear-gradient(135deg, #10B981 0%, #059669 100%) !important;
       }

       .floating-icon-btn.mr-analysis-btn.active::after {
         border-left-color: #10B981 !important;
       }

       .floating-icon-btn.mr-analysis-btn.active {
         background: #10B981 !important;
         color: #fff !important;
       }

       .floating-icon-btn.member-risk-btn.active::before {
         background: linear-gradient(135deg, #8B5CF6 0%, #6366F1 100%) !important;
       }

       .floating-icon-btn.member-risk-btn.active::after {
         border-left-color: #8B5CF6 !important;
       }

       .floating-icon-btn.member-risk-btn.active {
         background: #8B5CF6 !important;
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
         background: transparent !important;
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

      .dqa-conditions-scroll {
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




       dqa

        .dqa-conditions-scroll::-webkit-scrollbar {
         width: 8px !important;
       }

       .dqa-conditions-scroll::-webkit-scrollbar-track {
         background: #f1f1f1 !important;
       }

       .dqa-conditions-scroll::-webkit-scrollbar-thumb {
         background: #888 !important;
         border-radius: 4px !important;
       }

       

       .dqa-conditions-scroll::-webkit-scrollbar-thumb:hover {
         background: #555 !important;
       }

       /* Force scrollbar to always show */
       .dqa-conditions-scroll {
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

      .dqa-condition-card {
        background: #ffffff !important;
        border: 1px solid #e8e8e8 !important;
        border-left: 4px solid #1e40af !important;
        border-radius: 4px !important;
        padding: 5px !important;
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.06) !important;
        height: fit-content !important;
        transition: all 0.3s ease !important;
        display: flex;
        flex-direction:column;
        gap:4px;
      }

      .dqa-condition-card:hover {
        box-shadow: 0 3px 12px rgba(0, 0, 0, 0.1) !important;
        transform: translateY(-1px) !important;
      }

      .dqa-header-row {
        display: flex !important;
        width: 100% !important;
        gap: 12px !important;
        align-items: flex-start !important;
      }

      .dqa-header-row .dqa-badge-group {
  flex: 1 !important;
  display: flex !important;
  flex-wrap: wrap !important;
  gap: 6px !important;
  align-items: flex-start !important;
  justify-content: flex-end !important;
}

.dqa-condition-text {
  flex: 3 !important;
  min-width: 0 !important; /* IMPORTANT for wrapping */
}

       /* Badges Row */
       .card-badges-row {
         margin-bottom: 10px !important;
         display: flex !important;
         justify-content: space-between !important;
       }

       .dqa-card-badges-row {
         margin-bottom: 10px !important;
         display: flex !important;
         justify-content: flex-end !important;
       }


       .badge-group {
         display: flex !important;
         flex-wrap: wrap !important;
         gap: 6px !important;
         align-items: center !important;
       }

       .dqa-badge-group {
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

      .dqa-card-title {
        font-size: 13px !important;
        font-weight: 700 !important;
        color: #111827 !important;
        margin: 0 0 10px 0 !important;
        line-height: 1.3 !important;
        white-space: normal !important;
        word-break: break-word !important;
        overflow-wrap: anywhere !important;
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
      
      .dqa-info-row {
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

      .dqa-info-row.dqa-indicators-row {
        padding: 8px 10px !important;
        gap: 10px !important;
        border-radius: 6px !important;
      }
      .dqa-info-row dqa-indicators-row .label {
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

      .dqa-info-row.dqa-evidence-row {
        background: #fff7ed !important; /* very light orange */
        border: 0.5px solid rgba(249, 115, 22, 0.35) !important; /* subtle medium-light orange */
        padding: 8px 10px !important;
        gap: 10px !important;
        border-radius: 6px !important;
        margin-top: 0px !important; /* small gap between indicators and this row */
      }
      .dqa-info-row.dqa-evidence-row .label {
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
         min-width: 50px !important;
         width: 50px !important;
         max-width: 50px !important;
       }

       .audit-table th:nth-child(4),
       .audit-table td:nth-child(4) {
         min-width: 50px !important;
         width: 50px !important;
         max-width: 50px !important;
       }

       .audit-table th:nth-child(5),
       .audit-table td:nth-child(5) {
        min-width: 50px !important;
         width: 50px !important;
         max-width: 50px !important;
       }

       .audit-table th:nth-child(6),
       .audit-table td:nth-child(6) {
         min-width: 80px !important;
         width: 80px !important;
         max-width: 80px !important;
       }

       .audit-table th:nth-child(7),
       .audit-table td:nth-child(7) {
      min-width: 90px !important;
         width: 90px !important;
       }

       .audit-table th:nth-child(8),
       .audit-table td:nth-child(8) {
         min-width: 90px !important;
         width: 90px !important;
       }

       .audit-table th:nth-child(9),
       .audit-table td:nth-child(9) {
         min-width: 190px !important;
         width: 90px !important;
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

  function getStatusLabel(value) {
    if (!value) return "Not Applicable";

    const v = value.toLowerCase();

    if (v === "acceptable") return "Compliant";
    if (v === "delete") return "Non Compliant";
    if (v === "query required") return "Partially Compliant";
    if (v === "not applicable") return "Not Applicable";

    return "Not Applicable";
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

  // Helper: detect API 'not found' / 404 style errors
  function isNotFoundError(err) {
    if (!err || !err.message) return false;
    const m = err.message.toString().toLowerCase();
    // Treat 404-like and 500/internal server errors as "not present" per UX requirement
    return (
      m.includes('404') ||
      m.includes('not found') ||
      m.includes('no data') ||
      m.includes('not present') ||
      m.includes('500') ||
      m.includes('internal server') ||
      m.includes('server error')
    );
  }

  // Helper: show a unified "not present" UI for a given API area
  function showApiNotPresentMessage(area) {
    const chartContent = document.getElementById('chartContent');
    const resultsEl = document.getElementById('chartResultsCount');
    const patientEl = document.getElementById('patientNameDisplay');
    const titleMap = {
      chart: 'Chart Details',
      conditionAudit: 'Audit Details',
      mrAnalysis: 'MR Details',
      dqa: 'DQA Details'
    };
    const title = titleMap[area] || 'Data';
    if (chartContent) {
      chartContent.innerHTML = `
        <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;min-height:300px;text-align:center;padding:40px 20px;color:#6c757d;">
          <div style="font-size:36px;margin-bottom:14px;">ℹ️</div>
          <div style="font-size:16px;font-weight:600;color:#374151;">The ${escapeHtml(title)} for this member is not present.</div>
          <div style="margin-top:8px;font-size:13px;color:#9ca3af;">If you believe this is an error, try refreshing or contact support.</div>
        </div>
      `;
    }
    if (resultsEl) resultsEl.textContent = '';
    // If chart API not present, ensure header count shows 0 (not Loading)
    if (area === 'chart') {
      const countEl = document.getElementById('chartCount');
      if (countEl) countEl.textContent = `[ 0 ]`;
    }

    if (area === 'dqa') {
      const countEl = document.getElementById('chartCount');
      if (countEl) countEl.textContent = '[ 0 ]';
    }
    if (patientEl) patientEl.textContent = currentMemberName || 'N/A';
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

  // Fetch MR Analysis details from the extension service worker
  function fetchMRAnalysisFromServiceWorker(memberId, memberName) {
    return new Promise((resolve, reject) => {
      try {
        chrome.runtime.sendMessage(
          { action: 'fetchMRAnalysis', payload: { member_id: memberId, member_name: memberName } },
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
    return apiRows.map(a => {
      const status = a.updated_status || a.marked_as || ""
      return ({
        id: a.id || null,
        "Condition": a.condition_name || '',
        "ICD-10": a.icd10_code || '',
        "HCC": a.hcc_code || '',
        "RxHCC": a.rxhcc_code || '',
        "Status": getStatusLabel(status) || "NOT APPLICABLE",
        raw: a,
      })
    });
  }

  // Fetch audit details and update conditionAuditData
  async function fetchAuditDetails(memberId, memberName) {
    const apiData = await fetchAuditDetailsFromServiceWorker(memberId, memberName);

    // Normalize payload shapes: apiData may be nested in audit_data.data
    let auditArray = [];
    if (apiData && apiData.audit_summary_data && Array.isArray(apiData.audit_summary_data.data)) {
      auditArray = apiData.audit_summary_data.data;
    } else if (apiData && Array.isArray(apiData.data)) {
      auditArray = apiData.data;
    } else if (Array.isArray(apiData)) {
      auditArray = apiData;
    }

    const mapped = mapApiAuditRows(auditArray || []);

    // Determine member name from multiple possible API shapes so header updates reliably
    const memberNameFromApi = (apiData && (
      apiData.member_name ||
      (apiData.data && apiData.data.member_name) ||
      (apiData.audit_summary_data && apiData.audit_summary_data.member_name) ||
      (apiData.member && ((apiData.member.fname || '') + ' ' + (apiData.member.lname || '')).trim())
    )) || memberName || currentMemberName || '';
    const patientElImmediate = document.getElementById('patientNameDisplay');
    if (patientElImmediate) patientElImmediate.textContent = memberNameFromApi || 'N/A';

    // Update audit-specific review status header from numeric `sts` (or string) if present
    try {
      const auditStatusEl = document.getElementById('auditReviewStatusHeader');
      const stsVal = apiData && (typeof apiData.sts !== 'undefined' ? apiData.sts : (apiData.status || (apiData.audit_summary_data && apiData.audit_summary_data.status)));
      let stsNum = null;
      if (typeof stsVal === 'number') stsNum = stsVal;
      else if (typeof stsVal === 'string' && !isNaN(Number(stsVal))) stsNum = Number(stsVal);

      if (auditStatusEl) {
        let statusText = '';
        let statusColor = '#666';
        if (stsNum === 1) {
          statusText = 'Under Pending';
          statusColor = '#ff8c00';
        } else if (stsNum === 2 || stsNum === 3) {
          statusText = 'Under Analyst Review';
          statusColor = '#ff8c00';
        } else if (stsNum === 4 || stsNum === 5) {
          statusText = 'Under Auditor Review';
          statusColor = '#007bff';
        } else if (stsNum === 6 || stsNum === 7) {
          statusText = 'Completed';
          statusColor = '#28a745';
        } else if (typeof stsVal === 'string' && stsVal.trim()) {
          // fallback: use textual status if provided
          statusText = String(stsVal);
        }
        // cache for later (panel may not exist during preload)
        currentAuditStatusText = statusText;
        currentAuditStatusColor = statusColor;
        auditStatusEl.textContent = statusText;
        auditStatusEl.style.color = statusColor;
      }
    } catch (e) {
      console.warn('Failed to set audit review status header', e);
    }

    if (mapped.length) {
      // replace conditionAuditData
      conditionAuditData = mapped;

      // Update DOS from audit API response (store separately, do NOT overwrite chart DOS)
      if (apiData && apiData.dos) {
        try {
          const formatted = new Date(apiData.dos).toLocaleDateString();
          currentAuditDos = formatted;
          // Update audit DOS display element if audit view is active
          if (contentType === 'conditionAudit') {
            const auditResultsEl = document.getElementById('auditResultsCount');
            if (auditResultsEl) auditResultsEl.innerHTML = `<strong>DOS: ${formatted}</strong>`;
          }
        } catch (e) {
          console.warn('Failed to parse DOS from audit payload', e);
        }
      }

      // If audit panel is visible, refresh UI
      if (contentType === 'conditionAudit') {
        try { showConditionAuditContent(); } catch (e) { console.error(e); }
      }
    } else {
      console.warn('No audit rows returned from API; clearing audit data and showing not-present message.');
      conditionAuditData = [];
      // If the audit panel is currently visible, show a helpful 'not present' UI
      if (contentType === 'conditionAudit') {
        showApiNotPresentMessage('conditionAudit');
      }
    }
  }



  function mapApiMedicalConditions(apiConditions) {
    if (!Array.isArray(apiConditions)) return [];
    return apiConditions.map((c, idx) => {
      return {
        id: c.id || '',
        title: c.cn || c.dx || 'Unknown condition',
        icon: '🩺',
        // icon: c.isChronic ? '🩺' : '📌',
        details: {
          icd10: (c.icd || '').toString(),
          // hcc24: c.hcc_v24 || c.hcc24 || null,
          hcc24: 'hcc' || null,
          hcc28: c.v28 || null,
          rxHcc: c.rx || null,
          source: c.di || '',
          note: !!(c.a_nt || c.qr),
          // active: !!c.isChronic,
          active: true,
          code_type: c.cs || '',
          // RADV_score: c.RADV_score || c.radv_score || 0,
          RADV_score: 1 || 0,
          code_status: c.cs || '',
          date: c.ldd || null
        },
        description: c.ce || '',
        clinicalIndicators: c.ci || '',
        codeExplanation: c.qr || '',
        noteText: c.a_nt || null
      };
    });
  }

  // function showMemberRiskProfileContent() {
  //   const chartContent = document.getElementById('chartContent');
  //   if (!chartContent) return;

  //   chartContent.innerHTML = `
  //     <div style="display:flex;height:100%;min-height:100%;overflow:hidden;">

  //       <div style="width:240px;background:#f8fafc;color:#0f172a;padding:20px;display:flex;flex-direction:column;gap:16px;overflow-y:auto;align-items:center;justify-content:center;">
  //         <button class="risk-menu-item active" data-target="risk-scores" style="width:100%;max-width:220px;padding:16px;border-radius:18px;border:1px solid #cbd5e1;background:white;color:#0f172a;font-size:15px;font-weight:600;cursor:pointer;text-align:center;box-shadow:0 1px 3px rgba(15,23,42,0.08);">Clinical Scores</button>
  //         <button class="risk-menu-item" data-target="risk-assessment" style="width:100%;max-width:220px;padding:16px;border-radius:18px;border:1px solid #cbd5e1;background:white;color:#0f172a;font-size:15px;font-weight:600;cursor:pointer;text-align:center;box-shadow:0 1px 3px rgba(15,23,42,0.08);">Clinical Assessment</button>
  //         <button class="risk-menu-item" data-target="risk-indicators" style="width:100%;max-width:220px;padding:16px;border-radius:18px;border:1px solid #cbd5e1;background:white;color:#0f172a;font-size:15px;font-weight:600;cursor:pointer;text-align:center;box-shadow:0 1px 3px rgba(15,23,42,0.08);">Risk Indicators</button>
  //       </div>

  //       <div style="flex:1;overflow-y:auto;padding:20px;background:#f1f5f9;">
  //         <div id="risk-scores" class="risk-section active" style="display:block;">
  //           <div style="display:flex;flex-direction:column;gap:14px;">
  //             <div style="background:white;border-radius:16px;padding:20px;box-shadow:0 2px 10px rgba(0,0,0,0.06);border-left:6px solid #2563eb;">
  //               <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;">
  //                 <div style="font-size:16px;font-weight:700;color:#0f172a;">RI-6 — Care Gap Urgency Index</div>
  //                 <span style="padding:6px 12px;border-radius:20px;background:#dc2626;color:#fff;font-size:12px;font-weight:700;">HIGH</span>
  //               </div>
  //               <div style="margin-top:14px;font-size:15px;color:#334155;font-weight:600;">Score: 72 / 100</div>
  //               <div style="height:10px;background:#e2e8f0;border-radius:20px;overflow:hidden;margin-top:16px;">
  //                 <div style="width:72%;height:100%;background:#2563eb;"></div>
  //               </div>
  //             </div>
  //             <div style="background:white;border-radius:16px;padding:20px;box-shadow:0 2px 10px rgba(0,0,0,0.06);border-left:6px solid #2563eb;">
  //               <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;">
  //                 <div style="font-size:16px;font-weight:700;color:#0f172a;">RI-7 — Progression Risk Index</div>
  //                 <span style="padding:6px 12px;border-radius:20px;background:#dc2626;color:#fff;font-size:12px;font-weight:700;">HIGH</span>
  //               </div>
  //               <div style="margin-top:14px;font-size:15px;color:#334155;font-weight:600;">Score: 62 / 100</div>
  //               <div style="height:10px;background:#e2e8f0;border-radius:20px;overflow:hidden;margin-top:16px;">
  //                 <div style="width:62%;height:100%;background:#2563eb;"></div>
  //               </div>
  //             </div>
  //           </div>
  //         </div>

  //         <div id="risk-assessment" class="risk-section" style="display:none;">
  //           <div style="display:flex;flex-direction:column;gap:14px;">
  //             <div style="background:white;border-radius:16px;padding:20px;box-shadow:0 2px 10px rgba(0,0,0,0.06);">
  //               <div style="font-size:16px;font-weight:700;color:#0f172a;">Hypertension (HTN)</div>
  //               <div style="margin-top:8px;font-size:13px;color:#64748b;">Active • Chronic Condition</div>
  //               <div style="margin-top:16px;border-top:1px solid #e2e8f0;padding-top:14px;">
  //                 <div style="font-size:13px;font-weight:700;color:#334155;">Evidence</div>
  //                 <div style="font-size:13px;color:#475569;line-height:1.8;margin-top:6px;">BP 138/78 mmHg; on lisinopril 5 mg + HCTZ 25 mg</div>
  //                 <div style="font-size:13px;font-weight:700;color:#334155;margin-top:12px;">Rationale</div>
  //                 <div style="font-size:13px;color:#475569;line-height:1.8;margin-top:6px;">BP at goal with active medication management.</div>
  //               </div>
  //             </div>
  //             <div style="background:white;border-radius:16px;padding:20px;box-shadow:0 2px 10px rgba(0,0,0,0.06);">
  //               <div style="font-size:16px;font-weight:700;color:#0f172a;">Major Depressive Disorder (MDD)</div>
  //               <div style="margin-top:8px;font-size:13px;color:#64748b;">Rising • Chronic Condition</div>
  //               <div style="margin-top:16px;border-top:1px solid #e2e8f0;padding-top:14px;">
  //                 <div style="font-size:13px;font-weight:700;color:#334155;">Evidence</div>
  //                 <div style="font-size:13px;color:#475569;line-height:1.8;margin-top:6px;">PHQ-9 score 7; citalopram non-adherence</div>
  //                 <div style="font-size:13px;font-weight:700;color:#334155;margin-top:12px;">Rationale</div>
  //                 <div style="font-size:13px;color:#475569;line-height:1.8;margin-top:6px;">Depression worsening risk due to bereavement and smoking relapse.</div>
  //               </div>
  //             </div>
  //           </div>
  //         </div>

  //         <div id="risk-indicators" class="risk-section" style="display:none;">
  //           <div style="display:flex;flex-direction:column;gap:14px;">
  //             <div style="background:white;border-radius:16px;padding:20px;box-shadow:0 2px 10px rgba(0,0,0,0.06);">
  //               <div style="font-size:16px;font-weight:700;color:#0f172a;">RI-1 — Readmission Risk Index</div>
  //               <div style="margin-top:8px;font-size:13px;color:#64748b;">Moderate Risk</div>
  //               <div style="margin-top:16px;border-top:1px solid #e2e8f0;padding-top:14px;">
  //                 <div style="font-size:13px;font-weight:700;color:#334155;">Evidence</div>
  //                 <div style="font-size:13px;color:#475569;line-height:1.8;margin-top:6px;">MDD non-adherence, smoking relapse, chronic conditions.</div>
  //                 <div style="font-size:13px;font-weight:700;color:#334155;margin-top:12px;">Rationale</div>
  //                 <div style="font-size:13px;color:#475569;line-height:1.8;margin-top:6px;">Moderate instability burden without acute hospitalization.</div>
  //               </div>
  //             </div>
  //           </div>
  //         </div>
  //       </div>
  //     </div>
  //   `;

  //   chartContent.querySelectorAll('.risk-menu-item').forEach(button => {
  //     button.addEventListener('click', () => {
  //       chartContent.querySelectorAll('.risk-menu-item').forEach(btn => {
  //         btn.style.background = 'white';
  //         btn.style.color = '#0f172a';
  //         btn.style.borderColor = '#cbd5e1';
  //         btn.classList.remove('active');
  //       });
  //       button.style.background = '#eff6ff';
  //       button.style.color = '#0f172a';
  //       button.style.borderColor = '#2563eb';
  //       button.classList.add('active');

  //       const target = button.getAttribute('data-target');
  //       chartContent.querySelectorAll('.risk-section').forEach(section => {
  //         section.style.display = section.id === target ? 'block' : 'none';
  //       });
  //     });
  //   });
  // }

  function showMemberRiskProfileContent() {
    const chartContent = document.getElementById("chartContent");
    if (!chartContent) return;

    chartContent.innerHTML = `
  <style>

    .risk-container{
      padding:12px;
      background:#f8f9fa;
      height:100%;
      overflow:auto;
    }

    /* TOP TABS */

    .risk-tabs{
      display:flex;
      gap:8px;
      margin-bottom:16px;
      flex-wrap:wrap;
    }

    .risk-tab{
      border:none;
      background:#ffffff;
      color:#374151;
      padding:10px 16px;
      border-radius:8px;
      font-size:13px;
      font-weight:700;
      cursor:pointer;
      box-shadow:0 1px 3px rgba(0,0,0,.08);
    }

    .risk-tab.active{
      background:#2563eb;
      color:white;
    }

    .risk-section{
      display:none;
    }

    .risk-section.active{
      display:block;
    }

    /* SECTION TITLE */

    .section-title{
      font-size:18px;
      font-weight:700;
      color:#111827;
      margin-bottom:12px;
    }

    /* SCORE CARD */

    .score-card{
      background:#ffffff;
      border:1px solid #e5e7eb;
      border-radius:8px;
      padding:14px;
      margin-bottom:10px;
      box-shadow:0 1px 3px rgba(0,0,0,.08);
    }

    .score-header{
      display:flex;
      justify-content:space-between;
      align-items:flex-start;
      gap:12px;
    }

    .score-title{
      font-size:14px;
      font-weight:700;
      color:#111827;
      margin-bottom:10px;
    }

    .score-value{
      font-size:13px;
      color:#374151;
      font-weight:600;
    }

    .risk-badge{
      padding:5px 10px;
      border-radius:999px;
      font-size:11px;
      font-weight:700;
      white-space:nowrap;
    }

    .risk-high{
      background:#fee2e2;
      color:#dc2626;
    }

    .risk-moderate{
      background:#fef3c7;
      color:#d97706;
    }

    .risk-low{
      background:#dcfce7;
      color:#16a34a;
    }

    .progress-track{
      height:6px;
      background:#e5e7eb;
      border-radius:999px;
      overflow:hidden;
      margin-top:10px;
    }

    .progress-fill{
      height:100%;
      background:#2563eb;
    }

    /* ACCORDION */

    .accordion-card{
      background:#ffffff;
      border:1px solid #e5e7eb;
      border-radius:8px;
      overflow:hidden;
      margin-bottom:10px;
      box-shadow:0 1px 3px rgba(0,0,0,.08);
    }

    .accordion-header{
      padding:12px;
      display:flex;
      justify-content:space-between;
      align-items:flex-start;
      cursor:pointer;
    }

    .accordion-title{
      font-size:14px;
      font-weight:700;
      color:#111827;
      margin-bottom:4px;
    }

    .accordion-meta{
      font-size:12px;
      color:#6b7280;
    }

    .accordion-arrow{
      color:#6b7280;
      transition:.2s;
      font-size:14px;
    }

    .accordion-card.active .accordion-arrow{
      transform:rotate(180deg);
    }

    .accordion-content{
      display:none;
      padding:12px;
      border-top:1px solid #f3f4f6;
    }

    .accordion-card.active .accordion-content{
      display:block;
    }

    .content-label{
      font-size:12px;
      font-weight:700;
      color:#374151;
      margin-top:8px;
    }

    .content-value{
      font-size:12px;
      color:#111827;
      line-height:1.6;
      margin-top:4px;
    }

  </style>

  <div class="risk-container">

    <div class="risk-tabs">

      <button class="risk-tab active" data-target="risk-scores">
        Clinical Scores
      </button>

      <button class="risk-tab" data-target="risk-assessment">
        Clinical Assessment
      </button>

      <button class="risk-tab" data-target="risk-indicators">
        Risk Indicators
      </button>

    </div>

    <!-- SCORES -->

    <div id="risk-scores" class="risk-section active">

      <div class="section-title">
        Clinical Scores
      </div>

      <div class="score-card">

        <div class="score-header">

          <div>

            <div class="score-title">
              RI-6 — Care Gap Urgency Index
            </div>

            <div class="score-value">
              Score: 72 / 100
            </div>

          </div>

          <div class="risk-badge risk-high">
            HIGH
          </div>

        </div>

        <div class="progress-track">
          <div class="progress-fill" style="width:72%"></div>
        </div>

      </div>

      <div class="score-card">

        <div class="score-header">

          <div>

            <div class="score-title">
              RI-7 — Progression Risk Index
            </div>

            <div class="score-value">
              Score: 62 / 100
            </div>

          </div>

          <div class="risk-badge risk-high">
            HIGH
          </div>

        </div>

        <div class="progress-track">
          <div class="progress-fill" style="width:62%"></div>
        </div>

      </div>

    </div>

    <!-- CLINICAL ASSESSMENT -->

    <div id="risk-assessment" class="risk-section">

      <div class="section-title">
        Clinical Assessment
      </div>

      <div class="accordion-card">

        <div class="accordion-header">

          <div>

            <div class="accordion-title">
              Hypertension (HTN)
            </div>

            <div class="accordion-meta">
              Active • Chronic Condition
            </div>

          </div>

          <div class="accordion-arrow">
            ▼
          </div>

        </div>

        <div class="accordion-content">

          <div class="content-label">
            Evidence
          </div>

          <div class="content-value">
            BP 138/78 mmHg; on lisinopril 5 mg + HCTZ 25 mg
          </div>

          <div class="content-label">
            Rationale
          </div>

          <div class="content-value">
            BP at goal with active medication management.
          </div>

        </div>

      </div>

    </div>

    <!-- RISK INDICATORS -->

    <div id="risk-indicators" class="risk-section">

      <div class="section-title">
        Risk Indicators
      </div>

      <div class="accordion-card">

        <div class="accordion-header">

          <div>

            <div class="accordion-title">
              RI-1 — Readmission Risk Index
            </div>

            <div class="accordion-meta">
              Moderate Risk
            </div>

          </div>

          <div class="accordion-arrow">
            ▼
          </div>

        </div>

        <div class="accordion-content">

          <div class="content-label">
            Evidence
          </div>

          <div class="content-value">
            MDD non-adherence, smoking relapse, chronic conditions.
          </div>

          <div class="content-label">
            Rationale
          </div>

          <div class="content-value">
            Moderate instability burden without acute hospitalization.
          </div>

        </div>

      </div>

    </div>

  </div>
  `;

    chartContent.querySelectorAll(".risk-tab").forEach(tab => {
      tab.addEventListener("click", () => {

        chartContent
          .querySelectorAll(".risk-tab")
          .forEach(btn => btn.classList.remove("active"));

        tab.classList.add("active");

        const target = tab.dataset.target;

        chartContent
          .querySelectorAll(".risk-section")
          .forEach(section => {
            section.classList.remove("active");
          });

        chartContent
          .querySelector("#" + target)
          .classList.add("active");
      });
    });

    chartContent.querySelectorAll(".accordion-header").forEach(header => {

      header.addEventListener("click", () => {
        header.parentElement.classList.toggle("active");
      });

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
      <button class="floating-icon-btn condition-audit-btn" id="conditionAuditBtn" data-tooltip="Audit Findings" aria-label="Audit Details" style="display:none !important;">
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
      <button class="floating-icon-btn mr-analysis-btn" id="mrAnalysisBtn" data-tooltip="MR Details" aria-label="Medical Record Analysis" style="display:none !important;">
        <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none">
            <defs>
              <linearGradient id="analysisGradient" x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stop-color="#10B981"/>
                <stop offset="100%" stop-color="#059669"/>
              </linearGradient>
            </defs>
            
            <!-- Main document background -->
            <rect x="4" y="2" width="16" height="20" rx="2" fill="white" stroke="url(#analysisGradient)" stroke-width="2"/>
            
            <!-- Header section -->
            <rect x="4" y="2" width="16" height="6" rx="2" fill="url(#analysisGradient)" opacity="0.1"/>
            
            <!-- Analysis chart/graph representation -->
            <path d="M7 12l3 3 4-4 3 2" stroke="url(#analysisGradient)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
            
            <!-- Data points -->
            <circle cx="7" cy="12" r="1.5" fill="url(#analysisGradient)"/>
            <circle cx="10" cy="15" r="1.5" fill="url(#analysisGradient)"/>
            <circle cx="14" cy="11" r="1.5" fill="url(#analysisGradient)"/>
            <circle cx="17" cy="13" r="1.5" fill="url(#analysisGradient)"/>
            
            <!-- Text lines -->
            <line x1="6" y1="17" x2="12" y2="17" stroke="#D1D5DB" stroke-width="1" stroke-linecap="round"/>
            <line x1="6" y1="19" x2="18" y2="19" stroke="#D1D5DB" stroke-width="1" stroke-linecap="round"/>
        </svg>
      </button>
      <button class="floating-icon-btn notes-btn" id="doc_quality" data-tooltip="DQA Details" aria-label="DQA Details">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="28"
          height="28"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#000000"
          stroke-width="2.2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M21 7h-3a2 2 0 0 1-2-2V2"></path>
          <path d="M21 6v6.5c0 .8-.7 1.5-1.5 1.5h-7c-.8 0-1.5-.7-1.5-1.5v-9c0-.8.7-1.5 1.5-1.5H17Z"></path>
          <path d="M7 8v8.8c0 .3.2.6.4.8.2.2.5.4.8.4H15"></path>
          <path d="M3 12v8.8c0 .3.2.6.4.8.2.2.5.4.8.4H11"></path>
        </svg>
    </button>
    `;

    document.body.appendChild(buttonsDiv);

    // Add event listeners
    // wire up chart button click below
    // DQA button click handler
    document.getElementById('doc_quality').addEventListener('click', async () => {

      const isAlreadyOnDQA = contentType === 'dqa';

      showPanel('dqa');

      const chartContent =
        document.getElementById('chartContent');

      // Refresh if already on DQA
      if (isAlreadyOnDQA) {

        console.log(
          '🔄 Refreshing DQA data for member:',
          currentMemberId
        );

        const patientEl =
          document.getElementById('patientNameDisplay');

        if (patientEl) {
          patientEl.textContent =
            currentMemberName || 'N/A';
        }

        if (chartContent) {
          chartContent.innerHTML = `
        <div style="padding:20px">
          Refreshing DQA details...
        </div>
      `;
        }

        try {

          const response =
            await chrome.runtime.sendMessage({
              action: 'fetchDqaDetails',
              payload: {
                member_id: currentMemberId,
                member_name: currentMemberName
              }
            });

          if (response.error) {
            throw new Error(response.error);
          }

          const apiData =
            response?.data?.data?.details || [];

          dqaData = apiData.map(item => ({

            id: item.id,

            Condition: item.cn || '',

            "ICD-10": item.rc || '',

            encounter_documented: item.enc_doc || '',

            meat_present: item.me_p || '',

            meat_absent: item.me_a || '',

            supporting_clinical_evidence: item.sce || '',

            education_priority: item.ep || '',

            documentation_strength: item.ds || '',

            comment: item.an_cm || '',

            hcc: item.hcc || '',

            rx_hcc: item.rx || ''

          }));

          console.log(
            '✅ DQA refreshed:',
            dqaData.length
          );

          showDQAContent();

        } catch (err) {

          console.error(err);

          if (isNotFoundError(err)) {
            showApiNotPresentMessage('dqa');
          } else {
            chartContent.innerHTML = `
          <div style="padding:20px;color:#c00">
            Failed to refresh DQA details:
            ${err.message}
          </div>
        `;
          }
        }

        return;
      }

      // Cached data
      if (dqaData.length > 0) {

        showDQAContent();

        const patientEl =
          document.getElementById('patientNameDisplay');

        if (patientEl) {
          patientEl.textContent =
            currentMemberName || 'N/A';
        }

        return;
      }

      if (dqaNotPresent) {
        showApiNotPresentMessage('dqa');
        return;
      }

      // First load...
      if (chartContent) chartContent.innerHTML = `<div style="padding:20px">Loading DQA details...</div>`;
      try {
        const apiData = await fetchDqaDetailsFromServiceWorker(currentMemberId || '89700511', currentMemberName || 'N/A');
        const details =
          apiData &&
            apiData.data &&
            Array.isArray(apiData.data.details)
            ? apiData.data.details
            : [];

        dqaData = details.map((item, index) => ({
          id: item.id || index,
          Condition: item.cn || '',
          "ICD-10": item.rc || '',
          encounter_documented: item.enc_doc || '',
          meat_present: item.me_p || '',
          meat_absent: item.me_a || '',
          supporting_clinical_evidence: item.sce || '',
          education_priority: item.ep || '',
          documentation_strength: item.ds || '',
          comment: item.an_cm || '',
          hcc: item.hcc || '',
          rx_hcc: item.rx || ''
        }));

        dqaNotPresent = dqaData.length === 0;

        if (dqaNotPresent) {
          showApiNotPresentMessage('dqa');
          return;
        }

        showDQAContent();
      } catch (err) {
        console.error(err);
        if (isNotFoundError(err)) {
          dqaNotPresent = true;
          showApiNotPresentMessage('dqa');
        } else {
          if (chartContent) chartContent.innerHTML = `
          <div style="padding:20px;color:#c00">
            Failed to load DQA details: ${err.message}
          </div>
        `;
        }
      }
    });
    document.getElementById('chartBtn').addEventListener('click', async () => {
      // Check if we're already on chart view and user wants to refresh
      const isAlreadyOnChart = contentType === 'chart' && document.getElementById('chartBtn').classList.contains('active');

      // Ensure UI is visible and load chart details using the current member context (tryAutoLoad sets these)
      showPanel('chart');
      const chartContent = document.getElementById('chartContent');

      // If already on chart view, force refresh by calling API
      if (isAlreadyOnChart) {
        console.log('🔄 Refreshing chart data for member:', currentMemberId);
        if (chartContent) chartContent.innerHTML = `<div style="padding:20px">Refreshing chart details...</div>`;
        try {
          await showChartDetails(currentMemberId, currentMemberName);
        } catch (err) {
          console.error('Failed to refresh chart details:', err);
          if (chartContent) chartContent.innerHTML = `<div style="padding:20px;color:#c00">Failed to refresh chart details: ${err.message}</div>`;
        }
        return;
      }

      // Check if data is already available for current member (first time opening this view)
      if (medicalConditionsData.length > 0) {
        console.log('📊 Using cached chart data for member:', currentMemberId);
        showChartContent();

        // Update the count display
        const countEl = document.getElementById('chartCount');
        if (countEl) countEl.textContent = `[ ${medicalConditionsData.length} ]`;

        // Update patient name
        const patientEl = document.getElementById('patientNameDisplay');
        if (patientEl && currentMemberName) {
          patientEl.textContent = currentMemberName;
        }

        // Update DOS
        const resultsEl = document.getElementById('chartResultsCount');
        if (resultsEl && currentDos) {
          resultsEl.innerHTML = `<strong>DOS: ${currentDos}</strong>`;
        }

        // Update review status from cached API data
        const reviewStatusEl = document.getElementById('reviewStatusHeader');
        if (reviewStatusEl && chartApiData) {
          const status = chartApiData.status;
          const payload = chartApiData.data || chartApiData;
          const analystData = payload && payload.anst;

          let statusText = '';
          let statusColor = '#666';

          if (status === 7 || status === 8 || status === 9 || status === 10) {
            statusText = 'Under Analyst Review';
            statusColor = '#ff8c00';
          } else if (status === 11 || status === 12 || status === 13 || status === 14) {
            if (analystData && analystData.fn && analystData.ln) {
              statusText = `Reviewed by ${analystData.fn} ${analystData.ln}`;
            } else {
              statusText = 'Under Provider Review';
            }
            statusColor = '#007bff';
          } else if (status === 15) {
            if (analystData && analystData.fn && analystData.ln) {
              statusText = `Reviewed by ${analystData.fn} ${analystData.ln}`;
            } else {
              statusText = 'Completed';
            }
            statusColor = '#28a745';
          }

          console.log('📝 Setting cached review status:', { statusText, statusColor, status });
          reviewStatusEl.textContent = statusText;
          reviewStatusEl.style.color = statusColor;
        }

        return;
      }

      if (chartContent) chartContent.innerHTML = `<div style="padding:20px">Loading chart details...</div>`;
      try {
        // Pass the current cached member context explicitly to the loader
        await showChartDetails(currentMemberId, currentMemberName);
      } catch (err) {
        console.error('Failed to fetch chart details:', err);
        if (isNotFoundError(err)) {
          showApiNotPresentMessage('chart');
        } else {
          if (chartContent) chartContent.innerHTML = `<div style="padding:20px;color:#c00">Failed to load chart details: ${err.message}</div>`;
        }
      }
    });
    // When user clicks Audit, show panel and fetch audit details via service worker
    document.getElementById('conditionAuditBtn').addEventListener('click', async () => {
      // Check if we're already on audit view and user wants to refresh
      const isAlreadyOnAudit = contentType === 'conditionAudit' && document.getElementById('conditionAuditBtn').classList.contains('active');

      // Ensure UI is visible
      showPanel('conditionAudit');
      const chartContent = document.getElementById('chartContent');

      // If already on audit view, force refresh by calling API
      if (isAlreadyOnAudit) {
        console.log('🔄 Refreshing audit data for member:', currentMemberId);
        if (chartContent) chartContent.innerHTML = `<div style="padding:20px">Refreshing audit details...</div>`;
        const headerCountEl = document.getElementById('chartResultsCount');
        if (headerCountEl) headerCountEl.textContent = 'Refreshing...';
        const patientEl = document.getElementById('patientNameDisplay');
        if (patientEl) patientEl.textContent = 'Refreshing...';
        try {
          await fetchAuditDetails(currentMemberId || '89700511', currentMemberName || 'John Doe');
        } catch (err) {
          console.error('Failed to refresh audit details:', err);
          if (isNotFoundError(err)) {
            showApiNotPresentMessage('conditionAudit');
          } else {
            if (chartContent) chartContent.innerHTML = `<div style="padding:20px;color:#c00">Failed to refresh audit details: ${err.message}</div>`;
          }
        }
        return;
      }

      // Check if audit data is already available for current member (first time opening this view)
      if (conditionAuditData.length > 0) {
        console.log('🔍 Using cached audit data for member:', currentMemberId);
        // Show the panel UI first so it becomes visible
        showPanel('conditionAudit');
        showConditionAuditContent();
        // Update patient name display
        const patientEl = document.getElementById('patientNameDisplay');
        if (patientEl) patientEl.textContent = currentMemberName || 'N/A';

        // Update DOS display
        const resultsEl = document.getElementById('chartResultsCount');
        if (resultsEl && currentDos) {
          resultsEl.innerHTML = `<strong>DOS: ${currentDos}</strong>`;
        } else if (resultsEl) {
          resultsEl.textContent = `${conditionAuditData.length} records`;
        }
        return;
      }

      if (chartContent) chartContent.innerHTML = `<div style="padding:20px">Loading audit details...</div>`;
      // show loading state in header count area
      const headerCountEl = document.getElementById('chartResultsCount');
      if (headerCountEl) headerCountEl.textContent = 'Loading...';
      // Reset patient name to loading state - will be updated by audit API response
      const patientEl = document.getElementById('patientNameDisplay');
      if (patientEl) patientEl.textContent = currentMemberName;
      try {
        await fetchAuditDetails(currentMemberId || '89700511', currentMemberName || 'John Doe');
      } catch (err) {
        console.error('Failed to fetch audit details:', err);
        if (isNotFoundError(err)) {
          showApiNotPresentMessage('conditionAudit');
        } else {
          if (chartContent) chartContent.innerHTML = `<div style="padding:20px;color:#c00">Failed to load audit details: ${err.message}</div>`;
        }
      }
    });

    // MR Analysis button click handler
    document.getElementById('mrAnalysisBtn').addEventListener('click', async () => {
      // Check if we're already on MR analysis view and user wants to refresh
      const isAlreadyOnMRAnalysis = contentType === 'mrAnalysis' && document.getElementById('mrAnalysisBtn').classList.contains('active');

      showPanel('mrAnalysis');
      const chartContent = document.getElementById('chartContent');

      // If already on MR analysis view, force refresh by calling API
      if (isAlreadyOnMRAnalysis) {
        console.log('🔄 Refreshing MR analysis data for member:', currentMemberId);
        if (chartContent) chartContent.innerHTML = `<div style="padding:20px">Refreshing MR analysis...</div>`;
        const headerCountEl = document.getElementById('chartResultsCount');
        if (headerCountEl) headerCountEl.textContent = 'Refreshing...';
        const patientEl = document.getElementById('patientNameDisplay');
        if (patientEl) patientEl.textContent = 'Refreshing...';
        try {
          isMRAnalysisLoading = true;
          const apiData = await fetchMRAnalysisFromServiceWorker(currentMemberId || '89700511', currentMemberName || 'fd');
          mrAnalysisData = apiData;
          isMRAnalysisLoading = false;
          showMRAnalysisContent();
        } catch (err) {
          console.error('Failed to refresh MR analysis:', err);
          isMRAnalysisLoading = false;
          if (isNotFoundError(err)) {
            showApiNotPresentMessage('mrAnalysis');
          } else {
            if (chartContent) chartContent.innerHTML = `<div style="padding:20px;color:#c00">Failed to refresh MR analysis: ${err.message}</div>`;
          }
        }
        return;
      }

      // Check if MR analysis data is already available for current member (first time opening this view)
      if (mrAnalysisData && mrAnalysisData.chart_summary && mrAnalysisData.chart_summary.text) {
        console.log('📊 Using cached MR analysis data for member:', currentMemberId);
        showMRAnalysisContent();
        return;
      }

      if (chartContent) chartContent.innerHTML = `<div style="padding:20px">Loading MR analysis...</div>`;

      const headerCountEl = document.getElementById('chartResultsCount');
      if (headerCountEl) headerCountEl.textContent = 'Loading...';

      const patientEl = document.getElementById('patientNameDisplay');
      if (patientEl) patientEl.textContent = currentMemberName;

      try {
        isMRAnalysisLoading = true;
        const apiData = await fetchMRAnalysisFromServiceWorker(currentMemberId || '89700511', currentMemberName || 'fd');
        mrAnalysisData = apiData;
        isMRAnalysisLoading = false;
        showMRAnalysisContent();
      } catch (err) {
        console.error('Failed to fetch MR analysis:', err);
        isMRAnalysisLoading = false;
        if (isNotFoundError(err)) {
          showApiNotPresentMessage('mrAnalysis');
        } else {
          if (chartContent) chartContent.innerHTML = `<div style="padding:20px;color:#c00">Failed to load MR analysis: ${err.message}</div>`;
        }
      }
    });

    document.getElementById('memberRiskBtn').addEventListener('click', () => {
      const isAlreadyOnMemberRisk = contentType === 'memberRisk' && document.getElementById('memberRiskBtn').classList.contains('active');
      showPanel('memberRisk');
      if (isAlreadyOnMemberRisk) {
        const chartContent = document.getElementById('chartContent');
        if (chartContent) chartContent.innerHTML = `<div style="padding:20px">Loading Member Risk Profile...</div>`;
        showMemberRiskProfileContent();
        return;
      }
      showMemberRiskProfileContent();
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
  function createFloatingPanel(memberName) {
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
            <div id="patientNameDisplay" style="text-align:right;font-weight:700;font-size:15px;">${memberName}</div>
          </div>
          <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;">
            <div style="display:flex;flex-direction:column;gap:2px;">
              <div id="chartSubTitle" class="chart-subtitle"></div>
              <div id="reviewStatusHeader" style="font-size:12px;font-weight:600;color:#666;"></div>
              <div id="auditReviewStatusHeader" style="font-size:12px;font-weight:600;color:#666;display:none;"></div>
            </div>
            <div id="chartResultsCount" class="chart-subtitle" style="text-align:right;"></div>
            <div id="auditResultsCount" class="chart-subtitle" style="text-align:right;display:none;"></div>
          </div>
        </div>
        <button class="close-btn" id="closeChartDiv">✕</button>
      </div>
      <!-- removed duplicate absolute-positioned logo to avoid duplication -->
      <div id="chartContent" style="flex: 1; overflow-y: auto; height: calc(100vh - 85px);"></div>
    `;
    // append and wire close button
    document.body.appendChild(div);
    const closeBtn = div.querySelector('#closeChartDiv');
    if (closeBtn) closeBtn.addEventListener('click', closePanel);
    // Apply cached review statuses if API returned earlier (preload)
    try {
      const chartStatusEl = div.querySelector('#reviewStatusHeader');
      const auditStatusEl = div.querySelector('#auditReviewStatusHeader');
      if (chartStatusEl && currentChartStatusText) {
        chartStatusEl.textContent = currentChartStatusText;
        chartStatusEl.style.color = currentChartStatusColor || '#666';
      }
      if (auditStatusEl && currentAuditStatusText) {
        auditStatusEl.textContent = currentAuditStatusText;
        auditStatusEl.style.color = currentAuditStatusColor || '#666';
      }
      // Ensure visibility reflects current contentType
      if (contentType === 'conditionAudit') {
        if (chartStatusEl) chartStatusEl.style.display = 'none';
        if (auditStatusEl) auditStatusEl.style.display = '';
      } else {
        if (chartStatusEl) chartStatusEl.style.display = '';
        if (auditStatusEl) auditStatusEl.style.display = 'none';
      }
    } catch (e) {
      console.warn('Failed to apply cached review status to panel', e);
    }
    return div;
  }

  // Show/activate the floating panel. type: 'chart' | 'conditionAudit'
  function showPanel(type) {
    createFloatingButtons();
    createBackdrop();
    createFloatingPanel(currentMemberName);
    const div = document.getElementById(FLOATING_DIV_ID);
    const backdrop = document.getElementById('backdrop');
    const floatingButtons = document.getElementById('floatingButtons');
    const chartBtn = document.getElementById('chartBtn');
    const conditionAuditBtn = document.getElementById('conditionAuditBtn');
    const mrAnalysisBtn = document.getElementById('mrAnalysisBtn');
    const memberRiskBtn = document.getElementById('memberRiskBtn');

    if (!div || !backdrop || !floatingButtons) return;

    // show panel and backdrop
    div.classList.remove('hidden');
    setTimeout(() => div.classList.add('show'), 10);
    backdrop.classList.add('visible');

    // default shifted state
    floatingButtons.classList.add('shifted');
    // audit-specific adjustments (wider panel and move buttons further left)
    if (type === 'conditionAudit' || type === 'mrAnalysis') {
      div.classList.add('audit');
      floatingButtons.classList.add('audit-shift');
    } else {
      div.classList.remove('audit');
      floatingButtons.classList.remove('audit-shift');
    }

    contentType = type;

    if (type === 'chart') {
      if (chartBtn) chartBtn.classList.add('active');
      if (mrAnalysisBtn) {
        mrAnalysisBtn.classList.remove('active');
        mrAnalysisBtn.setAttribute('data-tooltip', 'MR Details'); //this is changed
      }
      if (conditionAuditBtn) {
        conditionAuditBtn.classList.remove('active');
        conditionAuditBtn.setAttribute('data-tooltip', 'Audit Details');
      }
      if (memberRiskBtn) {
        memberRiskBtn.classList.remove('active');
        memberRiskBtn.setAttribute('data-tooltip', 'Member Risk Profile');
      }
      const dqaBtn = document.getElementById('doc_quality');
      if (dqaBtn) {
        dqaBtn.classList.remove('active');
        dqaBtn.setAttribute('data-tooltip', 'DQA Details');
      }
      if (chartBtn) chartBtn.setAttribute('data-tooltip', 'HCC Analysis');
      // Keep title static and show loading state in the bracketed count while data fetches
      const titleEl = document.getElementById('chartTitle');
      if (titleEl) titleEl.innerHTML = 'HCC Opportunities <span id="chartCount" style="font-weight:600;margin-left:8px;">[ Loading... ]</span>';
      // Move the date/metadata to the right-aligned results area (chart/MR DOS).
      // Keep the left subtitle empty; show chart DOS on the right instead.
      const resultsEl = document.getElementById('chartResultsCount');
      const auditResultsEl = document.getElementById('auditResultsCount');
      if (resultsEl) {
        resultsEl.style.display = '';  // Ensure element is visible
        resultsEl.innerHTML = currentDos ? `<strong>DOS: ${currentDos}</strong>` : '';
      }
      if (auditResultsEl) auditResultsEl.style.display = 'none';
      // Show chart status header, hide audit header (don't clear status—showChartDetails handles that on fetch)
      const reviewStatusEl = document.getElementById('reviewStatusHeader');
      const auditStatusEl = document.getElementById('auditReviewStatusHeader');
      if (reviewStatusEl) reviewStatusEl.style.display = '';
      if (auditStatusEl) auditStatusEl.style.display = 'none';
      // patient name display updated when data loads
      showChartContent();
    } else if (type === 'conditionAudit') {
      if (conditionAuditBtn) {
        conditionAuditBtn.classList.add('active');
        conditionAuditBtn.setAttribute('data-tooltip', 'Audit Findings');
      }
      if (chartBtn) chartBtn.classList.remove('active');
      if (mrAnalysisBtn) {
        mrAnalysisBtn.classList.remove('active');
        mrAnalysisBtn.setAttribute('data-tooltip', 'MR Details'); // this id changed
      }
      if (memberRiskBtn) {
        memberRiskBtn.classList.remove('active');
        memberRiskBtn.setAttribute('data-tooltip', 'Member Risk Profile');
      }
      const dqaBtn = document.getElementById('doc_quality');
      if (dqaBtn) {
        dqaBtn.classList.remove('active');
        dqaBtn.setAttribute('data-tooltip', 'DQA Details');
      }
      if (chartBtn) chartBtn.setAttribute('data-tooltip', 'Chart Details');
      document.getElementById('chartTitle').textContent = 'Audit Details';
      const subEl = document.getElementById('chartSubTitle');
      if (subEl) subEl.textContent = '';
      // show audit-specific status and hide chart status; swap DOS elements
      try {
        const reviewStatusElLocal = document.getElementById('reviewStatusHeader');
        const auditStatusElLocal = document.getElementById('auditReviewStatusHeader');
        if (reviewStatusElLocal) reviewStatusElLocal.style.display = 'none';
        if (auditStatusElLocal) auditStatusElLocal.style.display = '';
        // Hide chart DOS, show audit DOS
        const chartResultsElLocal = document.getElementById('chartResultsCount');
        const auditResultsElLocal = document.getElementById('auditResultsCount');
        if (chartResultsElLocal) chartResultsElLocal.style.display = 'none';
        if (auditResultsElLocal) {
          auditResultsElLocal.style.display = '';
          auditResultsElLocal.innerHTML = currentAuditDos ? `<strong>DOS: ${currentAuditDos}</strong>` : '';
        }
      } catch (e) {
        console.warn('Failed to toggle status header visibility for audit', e);
      }
      // Fetch latest audit details to ensure DOS is fresh
      if (currentMemberId && currentMemberName) {
        fetchAuditDetails(currentMemberId, currentMemberName).catch(e => console.error('Error fetching audit details:', e));
      } else {
        showConditionAuditContent();
      }
    } else if (type === 'mrAnalysis') {
      if (mrAnalysisBtn) {
        mrAnalysisBtn.classList.add('active');
        mrAnalysisBtn.setAttribute('data-tooltip', 'MR Analysis');
      }
      if (chartBtn) {
        chartBtn.classList.remove('active');
        chartBtn.setAttribute('data-tooltip', 'Chart Details');
      }
      if (conditionAuditBtn) {
        conditionAuditBtn.classList.remove('active');
        conditionAuditBtn.setAttribute('data-tooltip', 'Audit Details');
      }
      if (memberRiskBtn) {
        memberRiskBtn.classList.remove('active');
        memberRiskBtn.setAttribute('data-tooltip', 'Member Risk Profile');
      }

      const dqaBtn = document.getElementById('doc_quality');
      if (dqaBtn) {
        dqaBtn.classList.remove('active');
        dqaBtn.setAttribute('data-tooltip', 'DQA Details');
      }
      document.getElementById('chartTitle').textContent = 'Medical Record Analysis';
      const subEl = document.getElementById('chartSubTitle');
      if (subEl) subEl.textContent = '';
      // Ensure MR Analysis uses the same chart review status header and chart DOS
      try {
        const reviewStatusEl = document.getElementById('reviewStatusHeader');
        const auditStatusEl = document.getElementById('auditReviewStatusHeader');
        if (reviewStatusEl) {
          reviewStatusEl.style.display = '';
          // Apply cached chart status if available
          if (currentChartStatusText) {
            reviewStatusEl.textContent = currentChartStatusText;
            reviewStatusEl.style.color = currentChartStatusColor || '#666';
          }
        }
        if (auditStatusEl) {
          auditStatusEl.style.display = 'none';
        }
        // Show chart DOS, hide audit DOS (MR Analysis uses chart DOS)
        const chartResultsEl = document.getElementById('chartResultsCount');
        const auditResultsEl = document.getElementById('auditResultsCount');
        if (chartResultsEl) {
          chartResultsEl.style.display = '';
          chartResultsEl.innerHTML = currentDos ? `<strong>DOS: ${currentDos}</strong>` : '';
        }
        if (auditResultsEl) auditResultsEl.style.display = 'none';
      } catch (e) {
        console.warn('Failed to toggle status header visibility for MR Analysis', e);
      }
      showMRAnalysisContent();
    } else if (type === 'memberRisk') {
      if (memberRiskBtn) {
        memberRiskBtn.classList.add('active');
        memberRiskBtn.setAttribute('data-tooltip', 'Member Risk Profile');
      }
      if (chartBtn) {
        chartBtn.classList.remove('active');
        chartBtn.setAttribute('data-tooltip', 'Chart Details');
      }
      if (conditionAuditBtn) {
        conditionAuditBtn.classList.remove('active');
        conditionAuditBtn.setAttribute('data-tooltip', 'Audit Details');
      }
      if (mrAnalysisBtn) {
        mrAnalysisBtn.classList.remove('active');
        mrAnalysisBtn.setAttribute('data-tooltip', 'MR Details');
      }
      const dqaBtn = document.getElementById('doc_quality');
      if (dqaBtn) {
        dqaBtn.classList.remove('active');
        dqaBtn.setAttribute('data-tooltip', 'DQA Details');
      }
      document.getElementById('chartTitle').textContent = 'Member Risk Profile';
      const subEl = document.getElementById('chartSubTitle');
      if (subEl) subEl.textContent = '';
      const reviewStatusEl = document.getElementById('reviewStatusHeader');
      const auditStatusEl = document.getElementById('auditReviewStatusHeader');
      if (reviewStatusEl) reviewStatusEl.style.display = 'none';
      if (auditStatusEl) auditStatusEl.style.display = 'none';
      const chartResultsEl = document.getElementById('chartResultsCount');
      const auditResultsEl = document.getElementById('auditResultsCount');
      if (chartResultsEl) {
        chartResultsEl.style.display = '';
        chartResultsEl.innerHTML = currentDos ? `<strong>DOS: ${currentDos}</strong>` : '';
      }
      if (auditResultsEl) auditResultsEl.style.display = 'none';
      showMemberRiskProfileContent();
    } else if (type === 'dqa') {

      const dqaBtn = document.getElementById('doc_quality');

      if (dqaBtn) {
        dqaBtn.classList.add('active');
        dqaBtn.setAttribute('data-tooltip', 'DQA Analysis');
      }

      if (chartBtn) {
        chartBtn.classList.remove('active');
        chartBtn.setAttribute('data-tooltip', 'Chart Details');
      }

      if (conditionAuditBtn) {
        conditionAuditBtn.classList.remove('active');
        conditionAuditBtn.setAttribute('data-tooltip', 'Audit Details');
      }

      if (mrAnalysisBtn) {
        mrAnalysisBtn.classList.remove('active');
        mrAnalysisBtn.setAttribute('data-tooltip', 'MR Details');
      }

      if (memberRiskBtn) {
        memberRiskBtn.classList.remove('active');
        memberRiskBtn.setAttribute('data-tooltip', 'Member Risk Profile');
      }

      document.getElementById('chartTitle').textContent = 'DQA Analysis';

      const subEl = document.getElementById('chartSubTitle');
      if (subEl) subEl.textContent = 'Documentation Quality Analysis';

      // show chart-style header
      const reviewStatusEl = document.getElementById('reviewStatusHeader');
      const auditStatusEl = document.getElementById('auditReviewStatusHeader');

      // if (reviewStatusEl) {
      //   reviewStatusEl.style.display = '';
      //   reviewStatusEl.textContent = 'DQA Review';
      //   reviewStatusEl.style.color = '#7C3AED';
      // }
      if (reviewStatusEl) {
        reviewStatusEl.style.display = 'none';
        reviewStatusEl.textContent = '';
      }
      if (auditStatusEl) {
        auditStatusEl.style.display = 'none';
      }

      const chartResultsEl = document.getElementById('chartResultsCount');
      const auditResultsEl = document.getElementById('auditResultsCount');

      if (chartResultsEl) {
        chartResultsEl.style.display = '';
        chartResultsEl.innerHTML = `<strong>${dqaData.length} Records</strong>`;
      }

      if (auditResultsEl) {
        auditResultsEl.style.display = 'none';
      }

      showDQAContent();
    }
  }


  // async function showChartDetails(memberIdArg, memberNameArg) {
  //   // Accept optional memberId/memberName arguments. If not provided, fall back to the
  //   // cached `currentMemberId`/`currentMemberName` (set by tryAutoLoad) and lastly try to
  //   // infer values from the page DOM.
  //   let memberId = memberIdArg || null;
  //   let memberName = memberNameArg || '';

  //   // Show loading UI while fetching
  //   showPanel('chart');
  //   isChartLoading = true;
  //   // show a loading placeholder in the content area
  //   const chartContent = document.getElementById('chartContent');
  //   if (chartContent) {
  //     chartContent.innerHTML = `<div style="padding:20px">Loading chart details...</div>`;
  //   }
  //   // update header count to show loading state
  //   const headerCountEl = document.getElementById('chartResultsCount');
  //   if (headerCountEl) headerCountEl.textContent = 'Loading...';
  //   // clear review status during loading
  //   const reviewStatusEl = document.getElementById('reviewStatusHeader');
  //   if (reviewStatusEl) reviewStatusEl.textContent = '';

  //   try {
  //     const apiData = await fetchChartDetailsFromServiceWorker(memberId, memberName);
  //     chartApiData = apiData; // Cache the full API response
  //     // The service worker returns a wrapper { status, message, data }
  //     const payload = apiData && apiData.data ? apiData.data : apiData;
  //     const apiConditions = payload && payload.medical_conditions ? payload.medical_conditions : [];


  //     const mapped = mapApiMedicalConditions(apiConditions);


  //     // Replace medicalConditionsData contents with mapped results
  //     medicalConditionsData.length = 0;
  //     Array.prototype.push.apply(medicalConditionsData, mapped);
  //     isChartLoading = false;
  //     // Update patient name and chart count if member info available
  //     const patientEl = document.getElementById('patientNameDisplay');
  //     if (payload && payload.member) {
  //       const name = `${payload.member.fname || ''} ${payload.member.lname || ''}`.trim();
  //       if (name && patientEl) patientEl.textContent = name;
  //     } else if (memberName && patientEl) {
  //       patientEl.textContent = memberName;
  //     }
  //     // Extract DOS (date of service) from payload.appointment.DOS and format for subtitle
  //     try {
  //       const dosIso = payload && payload.appointment && (payload.appointment.DOS || payload.appointment.dos);
  //       if (dosIso) {
  //         const formatted = new Date(dosIso).toLocaleDateString();
  //         currentDos = formatted;
  //         // Put the date on the right-aligned results element instead of the left subtitle
  //         const resultsElDos = document.getElementById('chartResultsCount');
  //         if (resultsElDos) resultsElDos.innerHTML = `<strong>DOS: ${formatted}</strong> }`;
  //         const sub = document.getElementById('chartSubTitle');
  //         if (sub) sub.textContent = '';
  //       } else {
  //         const resultsElDos = document.getElementById('chartResultsCount');
  //         if (resultsElDos) resultsElDos.textContent = '';
  //         const sub = document.getElementById('chartSubTitle');
  //         if (sub) sub.textContent = '';
  //       }
  //     } catch (e) {
  //       console.warn('Failed to parse DOS from chart payload', e);
  //     }
  //     // Update review status header based on API response status
  //     const reviewStatusEl = document.getElementById('reviewStatusHeader');
  //     if (reviewStatusEl && apiData) {
  //       const status = apiData.status;
  //       const analystData = payload && payload.analyst;

  //       let statusText = '';
  //       let statusColor = '#666';

  //       if (status === 7) {
  //         statusText = 'Under Analyst Review';
  //         statusColor = '#ff8c00'; // orangish color
  //       } else if (status === 12) {
  //         if (analystData && analystData.Fname && analystData.Lname) {
  //           statusText = `Reviewed by ${analystData.Fname} ${analystData.Lname}`;
  //         } else {
  //           statusText = 'Reviewed by Analyst';
  //         }
  //         statusColor = '#007bff'; // blue color
  //       } else if (status === 13) {
  //         if (analystData && analystData.Fname && analystData.Lname) {
  //           statusText = `Reviewed by ${analystData.Fname} ${analystData.Lname}`;
  //         } else {
  //           statusText = 'Reviewed by Analyst';
  //         }
  //         statusColor = '#28a745'; // green color
  //       }

  //       reviewStatusEl.textContent = statusText;
  //       reviewStatusEl.style.color = statusColor;
  //     }

  //     // Refresh UI and update the bracketed count
  //     updateChartContent();
  //     const countEl = document.getElementById('chartCount');
  //     if (countEl) countEl.textContent = `[ ${medicalConditionsData.length} ]`;
  //   } catch (err) {
  //     console.error('Failed to fetch chart details:', err);
  //     isChartLoading = false;
  //     if (isNotFoundError(err)) {
  //       showApiNotPresentMessage('chart');
  //     } else {
  //       if (chartContent) {
  //         chartContent.innerHTML = `<div style="padding:20px;color:#c00">Failed to load chart details: ${err.message}</div>`;
  //       }
  //     }
  //     // clear review status on error
  //     const reviewStatusEl = document.getElementById('reviewStatusHeader');
  //     if (reviewStatusEl) reviewStatusEl.textContent = '';
  //   }
  // }

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
    // clear review status during loading
    const reviewStatusEl = document.getElementById('reviewStatusHeader');
    if (reviewStatusEl) reviewStatusEl.textContent = '';

    try {
      const apiData = await fetchChartDetailsFromServiceWorker(memberId, memberName);
      chartApiData = apiData; // Cache the full API response
      // The service worker returns a wrapper { status, message, data }
      const payload = apiData && apiData.data ? apiData.data : apiData;
      const apiConditions = payload && payload.mcond ? payload.mcond : [];


      const mapped = mapApiMedicalConditions(apiConditions);


      // Replace medicalConditionsData contents with mapped results
      medicalConditionsData.length = 0;
      Array.prototype.push.apply(medicalConditionsData, mapped);
      isChartLoading = false;
      // Update patient name and chart count if member info available
      const patientEl = document.getElementById('patientNameDisplay');
      if (payload && payload.mem) {
        const name = `${payload.mem.fn || ''} ${payload.mem.ln || ''}`.trim();
        if (name && patientEl) patientEl.textContent = name;
      } else if (memberName && patientEl) {
        patientEl.textContent = memberName;
      }
      // Extract DOS (date of service) from payload.appointment.DOS and format for subtitle
      try {
        const dosIso = payload && payload.appt && (payload.appt.dos);
        if (dosIso) {
          const formatted = new Date(dosIso).toLocaleDateString();
          currentDos = formatted;
          // Put the date on the right-aligned results element instead of the left subtitle
          const resultsElDos = document.getElementById('chartResultsCount');
          if (resultsElDos) resultsElDos.innerHTML = `<strong>DOS: ${formatted}</strong> }`;
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
      // Update review status header based on API response status
      const reviewStatusEl = document.getElementById('reviewStatusHeader');
      if (reviewStatusEl && apiData) {
        const status = apiData.status;
        const analystData = payload && payload.anst;

        let statusText = '';
        let statusColor = '#666';

        if (status === 7 || status === 8 || status === 9 || status === 10) {
          statusText = 'Under Analyst Review';
          statusColor = '#ff8c00'; // orangish color
        } else if (status === 11 || status === 12 || status === 13 || status === 14) {
          if (analystData && analystData.fn && analystData.ln) {
            statusText = `Reviewed by ${analystData.fn} ${analystData.ln}`;
          } else {
            statusText = 'Under Provider Review';
          }
          statusColor = '#007bff'; // blue color
        } else if (status === 15) {
          if (analystData && analystData.fn && analystData.ln) {
            statusText = `Reviewed by ${analystData.fn} ${analystData.ln}`;
          } else {
            statusText = 'Completed';
          }
          statusColor = '#28a745'; // green color
        }

        reviewStatusEl.textContent = statusText;
        reviewStatusEl.style.color = statusColor;
      }

      // Refresh UI and update the bracketed count
      updateChartContent();
      const countEl = document.getElementById('chartCount');
      if (countEl) countEl.textContent = `[ ${medicalConditionsData.length} ]`;
    } catch (err) {
      console.error('Failed to fetch chart details:', err);
      isChartLoading = false;
      if (isNotFoundError(err)) {
        showApiNotPresentMessage('chart');
      } else {
        if (chartContent) {
          chartContent.innerHTML = `<div style="padding:20px;color:#c00">Failed to load chart details: ${err.message}</div>`;
        }
      }
      // clear review status on error
      const reviewStatusEl = document.getElementById('reviewStatusHeader');
      if (reviewStatusEl) reviewStatusEl.textContent = '';
    }
  }


  function closePanel() {
    const div = document.getElementById(FLOATING_DIV_ID);
    const backdrop = document.getElementById('backdrop');
    const floatingButtons = document.getElementById('floatingButtons');
    const chartBtn = document.getElementById('chartBtn');
    const conditionAuditBtn = document.getElementById('conditionAuditBtn');
    const mrAnalysisBtn = document.getElementById('mrAnalysisBtn');

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
    if (mrAnalysisBtn) {
      mrAnalysisBtn.classList.remove('active');
      mrAnalysisBtn.setAttribute('data-tooltip', 'MR Analysis');
    }
    chartBtn.setAttribute('data-tooltip', 'Chart Details');

    setTimeout(() => div.classList.add('hidden'), 400);
  }

  function showChartContent() {
    // Check if content already exists
    let chartContent = document.getElementById('chartContent');

    if (!chartContent) {
      // Try to create the panel and re-query
      createFloatingPanel(currentMemberName);
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
               <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4 text-blue-600 lucide lucide-flask-conical"><path d="M14 2v6a2 2 0 0 0 .245.96l5.51 10.08A2 2 0 0 1 18 22H6a2 2 0 0 1-1.755-2.96l5.51-10.08A2 2 0 0 0 10 8V2"></path><path d="M6.453 15h11.094"></path><path d="M8.5 2h7"></path></svg>
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
        resultsCount.innerHTML = currentDos ? `<strong>DOS: ${currentDos}</strong>` : '';
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

  function formatToMMDDYYYY(dateStr) {
    if (!dateStr) return '';

    const date = new Date(dateStr);

    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const year = date.getFullYear();

    return `${month}/${day}/${year}`;
  }


  // Helper function to render expanded row details
  function renderExpandedAuditDetails(row) {
    const raw = row.raw || {};
    const { all_encounter_dates, exclusion_violation = "", marked_as = null, updated_status = null, overall_recommendation = "", coding_issues = "", terminology_variation = "", user_last_updated = "", consistency_explanation = "", } = raw



    const encounterDates = all_encounter_dates.join(", ") || "";
    const updatedDate = user_last_updated?.length > 0 ? formatToMMDDYYYY(user_last_updated) : ""
    const markedStatus = getStatusLabel(marked_as);
    const updatedStatus = getStatusLabel(updated_status)

    // Map updated_status to color class
    const statusClasses = {
      'ACCEPTABLE': 'status-acceptable',
      'DELETE': 'status-delete',
      'QUERY REQUIRED': 'status-query-required',
      'NOT APPLICABLE': 'status-not-applicable'
    };
    const updateStatusClass = statusClasses[(updated_status || '').toUpperCase()] || 'status-query-required';


    return `
      <div class="audit-card-body">
      <div class="audit-dates-list">
        <span style="font-size: 12px;">📅</span>
            <div class="audit-date-item">
                <span>${encounterDates}</span>
              </div>
      </div>     
        ${consistency_explanation?.length > 0 ? `
          <div class="audit-box">
            <div class="audit-label">
              <div>Consistency Explanation </div>
              <div>:</div>
            </div>
            <div class="audit-text">${escapeHtml(consistency_explanation)}</div>
          </div>
        ` : ""}
          ${exclusion_violation?.length > 0 ? `
          <div class="audit-box">
            <div class="audit-label">
              <div>Exclusion Violation </div>
              <div>:</div>
            </div>
            <div class="audit-text">${escapeHtml(exclusion_violation)}</div>
          </div>
        ` : ""}
         ${terminology_variation?.length > 0 ? `
          <div class="audit-box">
            <div class="audit-label">
              <div>Terminology Variation</div>
              <div>:</div>
            </div>
            <div class="audit-text">${escapeHtml(terminology_variation)}</div>
          </div>
        ` : ""}
        ${coding_issues?.length > 0 ? `
          <div class="audit-box">
            <div class="audit-label">
              <div>Coding Issues </div>
              <div>:</div>
            </div>
            <div class="audit-text">${escapeHtml(coding_issues)}</div>
          </div>
        ` : ""}
        ${overall_recommendation?.length > 0 ? `
          <div class="audit-recommendation-box">
            <div class="audit-recommendation-label">Overall Recommendation</div>
            <div class="audit-recommendation-text">${escapeHtml(overall_recommendation)}</div>
          </div>
        ` : ''}
         ${updatedDate?.length > 0 ? `
          <div class="audit-update-box ${updateStatusClass}">
            <div class="audit-update-text">
              <span class="font-bold">${markedStatus}</span>
              by System
        
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                viewBox="0 0 640 640"
                class="audit-arrow"
              >
                <path d="M566.6 342.6C579.1 330.1 579.1 309.8 566.6 297.3L406.6 137.3C394.1 124.8 373.8 124.8 361.3 137.3C348.8 149.8 348.8 170.1 361.3 182.6L466.7 288L96 288C78.3 288 64 302.3 64 320C64 337.7 78.3 352 96 352L466.7 352L361.3 457.4C348.8 469.9 348.8 490.2 361.3 502.7C373.8 515.2 394.1 515.2 406.6 502.7L566.6 342.7z"/>
              </svg>
        
              <span class="font-bold">${updatedStatus}</span>
              on <span class="font-bold">${updatedDate}</span>
            </div>
          </div>
        ` : ''}
      </div>
    `;
  }

  // PN dates rendering removed from table rows (PN DOS moved into expanded details)

  // Global expanded rows state
  window.expandedAuditRows = window.expandedAuditRows || new Set();

  // Toggle expand handler
  window.toggleAuditRowExpand = function (rowId) {
    const idStr = String(rowId);
    console.log('🔄 toggleAuditRowExpand called with:', idStr);

    // Ensure expandedAuditRows exists
    if (!window.expandedAuditRows) {
      window.expandedAuditRows = new Set();
      console.log('📝 Created new expandedAuditRows Set');
    }

    const wasExpanded = window.expandedAuditRows.has(idStr);
    if (wasExpanded) {
      window.expandedAuditRows.delete(idStr);
      console.log('📉 Collapsed row:', idStr);
    } else {
      window.expandedAuditRows.add(idStr);
      console.log('📈 Expanded row:', idStr);
    }

    console.log('🔍 Current expanded rows:', Array.from(window.expandedAuditRows));
    showConditionAuditContent();
  };

  function showConditionAuditContent() {
    console.log('🔍 showConditionAuditContent called, conditionAuditData length:', conditionAuditData.length);
    const chartContent = document.getElementById('chartContent');
    console.log('🔍 chartContent element found:', !!chartContent);

    // Add custom styles for the accordion design
    if (!document.getElementById('audit-accordion-styles')) {
      const style = document.createElement('style');
      style.id = 'audit-accordion-styles';
      style.textContent = `
        .audit-accordion-container {
          display: flex !important;
          flex-direction: column !important;
          gap: 3px !important;
          padding: 6px !important;
          background: #f8f9fa !important;
          min-height: 100% !important;
        }
        .audit-card {
          background: #ffffff !important;
          border: 1px solid #e5e7eb !important;
          border-radius: 6px !important;
          overflow: hidden !important;
          transition: all 0.3s ease !important;
          box-shadow: 0 1px 3px rgba(0,0,0,0.05) !important;
          margin-bottom: 8px !important;
          width: 100% !important;
          box-sizing: border-box !important;
        }
        .audit-card.expanded {
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06) !important;
          border-color: #d1d5db !important;
        }
        .audit-card-header {
          padding: 8px !important;
          cursor: pointer !important;
          display: flex !important;
          justify-content: space-between !important;
          align-items: flex-start !important;
          gap: 16px !important;
          transition: background-color 0.2s !important;
          text-align: left !important;
        }
        .audit-card-header:hover {
          background-color: #f9fafb !important;
        }
        .audit-card-info {
          flex: 1 !important;
        }
        .audit-condition-name {
          font-size: 12px !important;
          font-weight: 700 !important;
          color: #111827 !important;
          margin-bottom: 4px !important;
          line-height: 1.2 !important;
        }
        .audit-codes-row {
          display: flex !important;
          gap: 12px !important;
          font-size: 13px !important;
          color: #6b7280 !important;
        }
        .audit-status-badge {
          padding: 6px 12px !important;
          border-radius: 9999px !important;
          font-size: 11px !important;
          font-weight: 700 !important;
          text-transform: uppercase !important;
          letter-spacing: 0.025em !important;
          white-space: nowrap !important;
        }
        /* More robust status colors */
        .audit-status-badge.status-acceptable {
          background-color: #ecfdf5 !important;
          color: #065f46 !important;
          border: 1px solid #d1fae5 !important;
        }
        .audit-status-badge.status-query-required {
          background-color: #fffbeb !important;
          color: #92400e !important;
          border: 1px solid #fef3c7 !important;
        }
        .audit-status-badge.status-delete {
          background-color: #fef2f2 !important;
          color: #991b1b !important;
          border: 1px solid #fee2e2 !important;
        }
        .audit-status-badge.status-not-applicable {
          background-color: #f0f9ff !important;
          color: #075985 !important;
          border: 1px solid #e0f2fe !important;
        }
        .audit-card-body {
          padding: 0 10px 10px 10px !important;
          border-top: 1px solid #f3f4f6 !important;
        }
        .audit-section-title {
          font-size: 14px !important;
          font-weight: 700 !important;
          color: #374151 !important;
          margin: 16px 0 12px 0 !important;
        }
        .audit-stats-grid {
          display: grid !important;
          grid-template-columns: 1fr 1fr !important;
          gap: 12px !important;
          margin-bottom: 16px !important;
        }
        .audit-stat-card {
          background: #f9fafb !important;
          padding: 12px !important;
          border-radius: 8px !important;
        }
        .audit-stat-label {
          font-size: 12px !important;
          color: #6b7280 !important;
          margin-bottom: 4px !important;
        }
        .audit-stat-value {
          font-size: 18px !important;
          font-weight: 700 !important;
          color: #111827 !important;
        }
        .audit-dates-list {
          margin-top: 8px !important;
          display: flex !important;
          gap: 8px !important;
          margin-bottom: 8px !important;
        }
        .audit-date-item {
          display: flex !important;
          align-items: center !important;
          gap: 8px !important;
          font-size: 11px !important;
          color: #374151 !important;
        }
        .audit-trend-banner {
          background-color: #eff6ff !important;
          color: #1e40af !important;
          padding: 10px 16px !important;
          border-radius: 6px !important;
          font-weight: 600 !important;
          font-size: 14px !important;
          margin-bottom: 16px !important;
        }
        .audit-recommendation-box {
          background-color: #fffbeb !important;
          border-left: 4px solid #f59e0b !important;
          padding: 6px 8px !important;
          border-radius: 4px !important;
        }
        .audit-update-text {
          display: flex;
          align-items: center;
          gap: 6px;
          white-space: nowrap;
          font-size: 14px;
        }
        .audit-arrow {
          width: 14px;
          height: 14px;
          fill: currentColor;
          flex-shrink: 0;
        }
        .audit-update-box {
            margin-top: 10px !important;
            padding: 2px 6px !important;
        }
        .audit-update-box.status-acceptable {
          background-color: #ecfdf5 !important;
          border-left-color: #10b981 !important;
        }
        .audit-update-box.status-acceptable .audit-update-text {
          color: #065f46 !important;
        }
        .audit-update-box.status-query-required {
          background-color: #fffbeb !important;
          border-left-color: #f59e0b !important;
        }
        .audit-update-box.status-query-required .audit-update-text {
          color: #92400e !important;
        }
        .audit-update-box.status-delete {
          background-color: #fef2f2 !important;
          border-left-color: #ef4444 !important;
        }
        .audit-update-box.status-delete .audit-update-text {
          color: #991b1b !important;
        }
        .audit-update-box.status-not-applicable {
          background-color: #f0f9ff !important;
          border-left-color: #0ea5e9 !important;
        }
        .audit-update-box.status-not-applicable .audit-update-text {
          color: #075985 !important;
        }
        .font-bold{
          font-weight: 700 !important;
        }
        .audit-update-text {
          font-size: 11px !important;
          color: #cc5500 !important;
          line-height: 1.5 !important;
        }
         .audit-box {
           margin-bottom: 10px !important;
           display: flex;
           gap:10px
        }
        .audit-label{
          font-weight: 700 !important;
          min-width: 140px;
          font-size: 11px !important;
          margin-bottom: 4px !important;
          white-space: nowrap !important;
          display: flex; 
          justify-content: space-between;
        }
        .audit-text {
          font-size: 11px !important;
          line-height: 1.5 !important;
        }
        .audit-recommendation-label {
          font-weight: 700 !important;
          color: #92400e !important;
          font-size: 11px !important;
          margin-bottom: 4px !important;
        }
        .audit-recommendation-text {
          font-size: 11px !important;
          color: #b45309 !important;
          line-height: 1.5 !important;
        }
      `;
      document.head.appendChild(style);
    }

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

    const cardsHtml = sortedData.map((row, i) => {
      const rowId = String(row.id || i);
      const isExpanded = window.expandedAuditRows && window.expandedAuditRows.has(rowId);
      const icdCode = row["ICD-10"] || '';
      const hccCode = row["HCC"] || '';
      const rxHccCode = row["RxHCC"] || '';
      const statusValue = (row["Status"] || '').trim();

      const STATUS_OPTIONS = [
        { label: "Compliant", value: "ACCEPTABLE", class: "status-acceptable" },
        { label: "Non Compliant", value: "DELETE", class: "status-delete" },
        { label: "Partially Compliant", value: "QUERY REQUIRED", class: "status-query-required" },
        { label: "Not Applicable", value: "NOT APPLICABLE", class: "status-not-applicable" },
      ];

      // Debug mapping
      const normalizedStatus = statusValue.toUpperCase();
      let statusInfo = STATUS_OPTIONS.find(opt => opt.value === normalizedStatus);

      if (!statusInfo) {
        // Fallback or specific mappings
        if (normalizedStatus === 'COMPLIANT') statusInfo = STATUS_OPTIONS[0];
        else if (normalizedStatus === 'NON COMPLIANT') statusInfo = STATUS_OPTIONS[1];
        else if (normalizedStatus === 'PARTIALLY COMPLIANT') statusInfo = STATUS_OPTIONS[2];
        else {
          statusInfo = {
            label: statusValue || 'Unknown',
            class: "status-query-required"
          };
        }
      }

      return `
        <div class="audit-card ${isExpanded ? 'expanded' : ''}" data-row-id="${rowId}">
          <div class="audit-card-header">
            <div class="audit-card-info">
              <div class="audit-condition-name">${escapeHtml(row.Condition || '')}</div>
              <div class="audit-codes-row">
                <span>ICD: ${escapeHtml(icdCode)}</span>
                ${hccCode ? `<span>• HCC: ${escapeHtml(hccCode)}</span>` : ''}
                ${rxHccCode ? `<span>• RxHCC: ${escapeHtml(rxHccCode)}</span>` : ''}
              </div>
            </div>
            <div class="audit-status-badge ${statusInfo.class}">
              ${escapeHtml(statusInfo.label)}
            </div>
          </div>
          ${isExpanded ? renderExpandedAuditDetails(row) : ''}
        </div>
      `;
    }).join('');

    const containerHtml = `
      <div class="audit-accordion-container">
        ${sortedData.length === 0 ?
        `<div style="text-align: center; padding: 40px 20px; font-size: 14px; color: #6c757d; font-style: italic; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px;">
            <div style="font-size: 24px;">🔍</div>
            <div>No audit records found</div>
          </div>` :
        cardsHtml
      }
      </div>
    `;

    chartContent.innerHTML = containerHtml;

    // Add event listeners for accordion headers
    const headers = chartContent.querySelectorAll('.audit-card-header');
    headers.forEach(header => {
      header.addEventListener('click', (e) => {
        const card = header.closest('.audit-card');
        const rowId = card.getAttribute('data-row-id');
        const wasExpanded = window.expandedAuditRows && window.expandedAuditRows.has(rowId);

        window.toggleAuditRowExpand(rowId);

        // After expansion, scroll to make the expanded content visible
        if (!wasExpanded) {
          setTimeout(() => {
            const expandedCard = chartContent.querySelector(`.audit-card[data-row-id="${rowId}"]`);
            if (expandedCard) {
              expandedCard.scrollIntoView({
                behavior: 'smooth',
                block: 'nearest'
              });
            }
          }, 100);
        }
      });
    });

    // Update results count
    try {
      const resultsEl = document.getElementById('chartResultsCount');
      if (resultsEl) {
        if (!resultsEl.textContent || resultsEl.textContent === 'Loading...') {
          resultsEl.textContent = `${sortedData.length} records`;
        }
      }
    } catch (e) {
      console.warn('Failed to update chartResultsCount', e);
    }
  }

  // Show MR Analysis content
  function showMRAnalysisContent() {
    const chartContent = document.getElementById('chartContent');

    if (!mrAnalysisData || !mrAnalysisData.chart_summary || !mrAnalysisData.chart_summary.text) {
      chartContent.innerHTML = `
        <div style="text-align: center; padding: 40px 20px; color: #6c757d;">
          <div style="font-size: 24px; margin-bottom: 10px;">📊</div>
          <div>No MR analysis data available</div>
        </div>
      `;
      return;
    }

    // Update header with DOS and member information
    const resultsEl = document.getElementById('chartResultsCount');
    if (resultsEl) {
      // Format the latest_dos to show just the date part
      const latestDos = mrAnalysisData.latest_dos;
      const formattedDos = latestDos ? new Date(latestDos).toLocaleDateString() : 'N/A';
      resultsEl.innerHTML = `<strong>DOS: ${formattedDos}</strong>`;
    }

    const patientEl = document.getElementById('patientNameDisplay');
    if (patientEl) {
      // Use member_name from API response, fallback to currentMemberName if null
      const memberName = mrAnalysisData.member_name || currentMemberName || 'N/A';
      patientEl.textContent = memberName;
    }

    // Parse and render the complete MR analysis
    const analysisHtml = parseMRAnalysisContent(mrAnalysisData.chart_summary.text);

    chartContent.innerHTML = `
      <div class="mr-analysis-section" style="max-height: calc(100vh - 85px); overflow-y: auto; padding-right: 8px; padding-left: 15px;">
        <div class="analysis-content" style="font-size: 11px; line-height: 1.4; padding:10px !important;">
          ${analysisHtml}
        </div>
      </div>
    `;

    // Add custom scrollbar styling
    const style = document.createElement('style');
    style.textContent = `
      .mr-analysis-section::-webkit-scrollbar {
        width: 6px;
      }
      .mr-analysis-section::-webkit-scrollbar-track {
        background: #f1f1f1;
        border-radius: 3px;
      }
      .mr-analysis-section::-webkit-scrollbar-thumb {
        background: #c1c1c1;
        border-radius: 3px;
      }
      .mr-analysis-section::-webkit-scrollbar-thumb:hover {
        background: #a8a8a8;
      }
    `;
    document.head.appendChild(style);
  }

  // Parse MR Analysis content and show all sections and tables up to Historical Substance Use Analysis
  function parseMRAnalysisContent(text) {
    const lines = text.split('\n');
    let html = '';
    let inTable = false;
    let tableHeaders = [];
    let tableRows = [];
    let foundHistoricalSection = false;
    let completedHistoricalTable = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Check if we've found the Historical Substance Use Analysis section
      if (line.toLowerCase().includes('historical substance use analysis')) {
        foundHistoricalSection = true;
      }

      // Stop parsing after completing the Historical Substance Use Analysis table
      if (foundHistoricalSection && completedHistoricalTable &&
        (line.startsWith('###') || line.toUpperCase().includes('CODE CANDIDATE ANALYSIS'))) {
        break;
      }

      if (line.startsWith('## ') || line.startsWith('### ') || line.startsWith('# ')) {
        // Flush any pending table
        if (inTable) {
          html += renderMRAnalysisTable(tableHeaders, tableRows);
          inTable = false;
          tableHeaders = [];
          tableRows = [];
        }
        // Section header
        if (line.startsWith('## ')) {
          const sectionTitle = line.substring(2).trim();
          html += `<div class="section-name" style="font-size: 1.125rem; --tw-text-opacity: 1; line-height: 1.75rem; color: rgb(30 41 59 / var(--tw-text-opacity, 1)); font-weight: 700; padding-right: 2rem !important; --tw-bg-opacity: 1; padding-left: .75rem !important; background-color: rgb(229 231 235 / var(--tw-bg-opacity, 1)); --tw-border-opacity: 1; border-color: rgb(59 130 246 / var(--tw-border-opacity, 1)) !important; border-left-width: 4px !important;">${escapeHtml(sectionTitle)}</div>`;
        }
        if (line.startsWith('# ')) {
          const sectionTitle = line.substring(1).trim();
          html += `<div class="section-name" style="font-size: 1.125rem; --tw-text-opacity: 1; line-height: 1.75rem; color: rgb(30 41 59 / var(--tw-text-opacity, 1)); font-weight: 700; padding-right: 2rem !important; --tw-bg-opacity: 1; padding-left: .75rem !important; background-color: rgb(229 231 235 / var(--tw-bg-opacity, 1)); --tw-border-opacity: 1; border-color: rgb(59 130 246 / var(--tw-border-opacity, 1)) !important; border-left-width: 4px !important;">${escapeHtml(sectionTitle)}</div>`;

        }
        if (line.startsWith('### ')) {
          const sectionTitle = line.substring(3).trim();
          html += `<div class="section-name" style="font-size: 1.125rem; --tw-text-opacity: 1; line-height: 1.75rem; color: rgb(30 41 59 / var(--tw-text-opacity, 1)); font-weight: 700; padding-right: 2rem !important; --tw-bg-opacity: 1; padding-left: .75rem !important; background-color: rgb(229 231 235 / var(--tw-bg-opacity, 1)); --tw-border-opacity: 1; border-color: rgb(59 130 246 / var(--tw-border-opacity, 1)) !important; border-left-width: 4px !important;">${escapeHtml(sectionTitle)}</div>`;

        }
      } else if (line.startsWith('**') && line.endsWith('**')) {
        // Flush any pending table
        if (inTable) {
          html += renderMRAnalysisTable(tableHeaders, tableRows);
          inTable = false;
          tableHeaders = [];
          tableRows = [];
        }
        // Subsection header
        const subsectionTitle = line.substring(2, line.length - 2).trim();
        html += `<div class="subsection-name" style="font-size: 14px; font-weight: 600; color: #374151; background: #f3f4f6; padding: 6px 10px; border-left: 3px solid #6b7280; margin: 8px 0 3px 0;">${escapeHtml(subsectionTitle)}</div>`;

      } else if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
        // Table row
        const cells = line.split('|').map(cell => cell.trim()).filter(cell => cell !== '');

        if (!inTable) {
          // First row is headers
          tableHeaders = cells;
          inTable = true;
        } else if (line.includes('---') || line.includes('===')) {
          // Skip separator rows
          continue;
        } else {
          // Data row
          tableRows.push(cells);

          // If we're in the Historical Substance Use Analysis section and have data rows, mark as completed
          if (foundHistoricalSection && tableRows.length > 0) {
            completedHistoricalTable = true;
          }
        }

      } else if (line.trim().startsWith('- ')) {
        // Flush any pending table
        if (inTable) {
          html += renderMRAnalysisTable(tableHeaders, tableRows);
          inTable = false;
          tableHeaders = [];
          tableRows = [];
        }
        // List item
        const listContent = line.trim().substring(2);
        const isTitle = listContent.includes('**:');
        const className = isTitle ? 'list-title' : '';
        html += `<ul class="content-list" style="margin: 8px 0; padding-left: 16px;"><li class="${className}" style="margin-bottom: 6px; line-height: 1.4; color: #374151; font-size: 13px;">${formatMRAnalysisText(listContent)}</li></ul>`;

      } else if (line.trim() === '') {
        // Flush any pending table
        if (inTable) {
          html += renderMRAnalysisTable(tableHeaders, tableRows);
          inTable = false;
          tableHeaders = [];
          tableRows = [];
        }
        // Empty line
        html += '<div style="height: 8px;"></div>';

      } else if (line.trim() !== '' && !inTable) {
        // Regular text content
        html += `<div class="text-content" style="line-height: 1.5; color: #374151; margin: 8px 0; font-size: 13px;">${formatMRAnalysisText(line)}</div>`;
      }
    }

    // Flush any remaining table
    if (inTable) {
      html += renderMRAnalysisTable(tableHeaders, tableRows);
    }

    if (!html.trim()) {
      html = `
        <div style="text-align: center; padding: 40px 20px; color: #6c757d;">
          <div style="font-size: 24px; margin-bottom: 10px;">🔍</div>
          <div>No analysis content found</div>
        </div>
      `;
    }

    return html;
  }

  // Render MR Analysis table - compact version for floating panel
  function renderMRAnalysisTable(headers, rows) {
    if (headers.length === 0 || rows.length === 0) {
      return '';
    }

    let html = '<div class="table-container" style="padding-top: .5rem !important;overflow: auto !important; border-color: hsl(var(--border)); border-radius: 6px; border: 0 solid #e5e7eb; box-sizing: border-box;">';
    html += '<table class="data-table" style="width: 100%; font-size: 11px;">';

    // Headers
    html += '<thead style="background: #f8f9fa;"><tr>';
    headers.forEach(header => {
      html += `<th style="padding: .625rem !important; !important; font-size: .75rem; font-weight: 600; text-transform: uppercase; color: rgb(51 65 85 / var(--tw-text-opacity, 1)); letter-spacing: .05em !important; text-transform: uppercase !important; background-color: rgb(248 250 252 / var(--tw-bg-opacity, 1)); border-color: rgb(226 232 240 / var(--tw-border-opacity, 1)); --tw-text-opacity: 1 !important;">${escapeHtml(header)}</th>`;
    });
    html += '</tr></thead>';

    // Rows
    html += '<tbody>';
    rows.forEach((row, index) => {
      html += `<tr style="background: white; border-bottom: 2px solid #dee2e6;">`;
      row.forEach((cell, cellIndex) => {
        const isCodeColumn = headers[cellIndex] && (
          headers[cellIndex].toLowerCase().includes('icd') ||
          headers[cellIndex].toLowerCase().includes('code') ||
          headers[cellIndex].toLowerCase().includes('hcc')
        );

        let cellStyle = 'padding: .5rem !important; --tw-border-opacity: 1 !important; border-color: rgb(226 232 240 / var(--tw-border-opacity, 1)); line-height: 1rem !important; font-size: .75rem !important; color: rgb(30 41 59 / var(--tw-text-opacity, 1)); vertical-align: top !important; border-right-width: 1px !important; border: 0 solid #e5e7eb;box-sizing: border-box;';

        if (isCodeColumn) {
          cellStyle += ' font-family: "Courier New", monospace; font-weight: 600; color: #000000ff;';
        }

        html += `<td style="${cellStyle}">${formatMRAnalysisText(cell)}</td>`;
      });
      html += '</tr>';
    });
    html += '</tbody>';

    html += '</table></div>';
    return html;
  }

  // Format text with bold and line breaks for MR Analysis
  function formatMRAnalysisText(text) {
    if (!text) return '';

    // Handle line breaks
    text = text.replace(/<br\s*\/?>/gi, '<br>');

    // Handle bold text
    text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

    return escapeHtml(text).replace(/&lt;br&gt;/g, '<br>').replace(/&lt;strong&gt;(.*?)&lt;\/strong&gt;/g, '<strong>$1</strong>');
  }

  function fetchDqaDetailsFromServiceWorker(memberId, memberName) {
    return new Promise((resolve, reject) => {

      chrome.runtime.sendMessage(
        {
          action: "fetchDqaDetails",
          payload: {
            member_id: memberId,
            member_name: memberName
          }
        },
        (response) => {

          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }

          if (!response) {
            reject(new Error("No response from service worker"));
            return;
          }

          if (response.error) {
            reject(new Error(response.error));
            return;
          }

          resolve(response.data);
        }
      );
    });
  }

  // 🧩 Detect patient info and trigger automatically (non-blocking)
  async function tryAutoLoad() {
    if (hasLoaded) return;

    // Try to detect patient/chart info from known selectors on the page.
    // If not available, don't prompt the user (non-blocking).
    // const chartNumberEl = document.querySelector('#chartNumber') || document.querySelector('[data-chart-number]');
    // const patientNameEl = document.querySelector('#patientName') || document.querySelector('.patient-name');

    // const chartNumber = chartNumberEl ? (chartNumberEl.textContent || chartNumberEl.getAttribute('data-chart-number') || '').trim() : '';
    // const patientName = patientNameEl ? (patientNameEl.textContent || '').trim() : '';
    // const chartNumber = window.prompt("enter the chart number");
    // const patientName = window.prompt("enter the patient name");
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
    createFloatingPanel(patientName);

    // Persist detected member info and mark loaded
    currentMemberId = chartNumber;
    currentMemberName = patientName;
    hasLoaded = true;

    // Pre-load data from all APIs asynchronously
    console.log('🔄 Pre-loading data for member:', chartNumber, patientName);

    // Ensure UI elements are created before updating them and wait for DOM
    await new Promise(resolve => setTimeout(resolve, 100));

    try {
      // Call all APIs in parallel to pre-load data
      // const [chartResponse, auditResponse, mrAnalysisResponse] = await Promise.allSettled([
      //   fetchChartDetailsFromServiceWorker(chartNumber, patientName),
      //   fetchAuditDetailsFromServiceWorker(chartNumber, patientName),
      //   fetchMRAnalysisFromServiceWorker(chartNumber, patientName)
      // ]);
      const [
        chartResponse,
        auditResponse,
        mrAnalysisResponse,
        dqaResponse
      ] = await Promise.allSettled([
        fetchChartDetailsFromServiceWorker(chartNumber, patientName),
        fetchAuditDetailsFromServiceWorker(chartNumber, patientName),
        fetchMRAnalysisFromServiceWorker(chartNumber, patientName),
        fetchDqaDetailsFromServiceWorker(chartNumber, patientName)
      ]);
      console.log("chartResponse", chartResponse);
      console.log("auditResponse", auditResponse);
      console.log("mrAnalysisResponse", mrAnalysisResponse);
      console.log("dqaResponse", dqaResponse);
      // Process chart details response
      if (chartResponse.status === 'fulfilled') {
        console.log('✅ Chart details pre-loaded successfully');
        const apiData = chartResponse.value;
        chartApiData = apiData; // Cache the full API response
        const payload = apiData && apiData.data ? apiData.data : apiData;
        const apiConditions = payload && payload.mcond ? payload.mcond : [];
        const mapped = mapApiMedicalConditions(apiConditions);

        // Replace medicalConditionsData contents with mapped results
        medicalConditionsData.length = 0;
        Array.prototype.push.apply(medicalConditionsData, mapped);

        // Update patient name in UI and cache
        const patientEl = document.getElementById('patientNameDisplay');
        if (payload && payload.mem) {
          const name = `${payload.mem.fn || ''} ${payload.mem.ln || ''}`.trim();
          if (name) {
            currentMemberName = name;
            if (patientEl) patientEl.textContent = name;
          }
        }

        // Extract DOS from payload and update UI
        try {
          const dosIso = payload && payload.appt && (payload.appt.dos);
          if (dosIso) {
            const dosDate = new Date(dosIso);
            currentDos = dosDate.toLocaleDateString();
            // Update DOS in results element
            const resultsEl = document.getElementById('chartResultsCount');
            if (resultsEl) resultsEl.innerHTML = `<strong>DOS: ${currentDos}</strong>`;
          }
        } catch (e) {
          console.warn('Failed to parse DOS from chart payload', e);
        }

        // Update review status header based on API response status (robust extraction + cache)
        try {
          const reviewStatusEl = document.getElementById('reviewStatusHeader');
          // status may be in apiData.status or apiData.sts or payload.status
          const statusVal = (apiData && (typeof apiData.status !== 'undefined' ? apiData.status : (apiData.sts || (payload && payload.status)))) || null;
          let statusNum = null;
          if (typeof statusVal === 'number') statusNum = statusVal;
          else if (typeof statusVal === 'string' && !isNaN(Number(statusVal))) statusNum = Number(statusVal);

          // Try several possible places for analyst name
          let analystName = '';
          const a = payload || apiData || {};
          if (a.anst && (a.anst.fn || a.anst.Fname || a.anst.Fname)) {
            analystName = `${a.anst.fn || a.anst.Fname || ''} ${a.anst.ln || a.anst.Lname || ''}`.trim();
          } else if (a.analyst && (a.analyst.fn || a.analyst.Fname || a.analyst.name)) {
            analystName = `${a.analyst.fn || a.analyst.Fname || a.analyst.name || ''} ${a.analyst.ln || a.analyst.Lname || ''}`.trim();
          } else if (a.analyst_name) {
            analystName = String(a.analyst_name).trim();
          } else if (apiData && apiData.analyst_name) {
            analystName = String(apiData.analyst_name).trim();
          }
          console.log("the status is :" + statusNum)
          console.log("the analyst name is :" + analystName)
          let statusText = '';
          let statusColor = '#666';
          if (statusNum === 7 || statusNum === 8 || statusNum === 9 || statusNum === 10) {
            statusText = 'Under Analyst Review';
            statusColor = '#ff8c00';
          } else if (statusNum === 11 || statusNum === 12 || statusNum === 13 || statusNum === 14) {
            statusText = analystName ? `Reviewed by ${analystName}` : 'Reviewed by Analyst';
            statusColor = '#007bff';
          } else if (statusNum === 15) {
            statusText = analystName ? `Reviewed by ${analystName}` : 'Reviewed by Analyst';
            statusColor = '#28a745';
          }

          // cache the computed chart status and update DOM if available
          currentChartStatusText = statusText;
          currentChartStatusColor = statusColor;
          if (reviewStatusEl && statusText) {
            reviewStatusEl.textContent = statusText;
            reviewStatusEl.style.color = statusColor;
            // Only show chart status when chart/MR view is active; hide it during audit view
            if (contentType === 'conditionAudit') {
              reviewStatusEl.style.display = 'none';
            } else {
              reviewStatusEl.style.display = '';
            }
          }
          console.log('📝 Chart review status set (preload):', { statusText, statusColor, statusNum, analystName });
        } catch (e) {
          console.warn('⚠️ Failed to set chart review status during preload', e);
        }

        // Update chart count if on chart view
        const countEl = document.getElementById('chartCount');
        if (countEl) countEl.textContent = `[ ${medicalConditionsData.length} ]`;

      } else {
        console.warn('⚠️ Chart details pre-load failed:', chartResponse.reason);
      }

      // Process audit details response
      if (auditResponse.status === 'fulfilled') {
        console.log('✅ Audit details pre-loaded successfully');
        const apiData = auditResponse.value;

        // Extract member name from audit response (override if available)
        if (apiData && apiData.mn) {
          currentMemberName = apiData.mn;
          console.log('📝 Updated member name from audit API:', currentMemberName);
        }

        // Extract DOS from audit response (store separately; do NOT overwrite chart DOS)
        if (apiData && apiData.dos) {
          try {
            const dosDate = new Date(apiData.dos);
            currentAuditDos = dosDate.toLocaleDateString();
            console.log('📅 Updated audit DOS (kept separate from chart):', currentAuditDos);
          } catch (e) {
            console.warn('Failed to parse DOS from audit payload', e);
          }
        }

        // Set review status from audit response `sts` (or related fields) so preload updates header
        try {
          const auditStatusEl = document.getElementById('auditReviewStatusHeader');
          const stsVal = apiData && (typeof apiData.sts !== 'undefined' ? apiData.sts : (apiData.status || (apiData.audit_summary_data && apiData.audit_summary_data.status)));
          let stsNum = null;
          if (typeof stsVal === 'number') stsNum = stsVal;
          else if (typeof stsVal === 'string' && !isNaN(Number(stsVal))) stsNum = Number(stsVal);

          let statusText = '';
          let statusColor = '#666';
          if (stsNum === 1) {
            statusText = 'Under Pending';
            statusColor = '#ff8c00';
          } else if (stsNum === 2 || stsNum === 3) {
            statusText = 'Under Analyst Review';
            statusColor = '#ff8c00';
          } else if (stsNum === 4 || stsNum === 5) {
            statusText = 'Under Auditor Review';
            statusColor = '#007bff';
          } else if (stsNum === 6 || stsNum === 7) {
            statusText = 'Completed';
            statusColor = '#28a745';
          } else if (typeof stsVal === 'string' && stsVal && stsVal.trim()) {
            statusText = String(stsVal);
          }

          // cache and update DOM (audit-specific)
          currentAuditStatusText = statusText;
          currentAuditStatusColor = statusColor;
          if (auditStatusEl) {
            auditStatusEl.textContent = statusText;
            auditStatusEl.style.color = statusColor;
            // Only show the audit status immediately if the panel is currently
            // displaying audit content; otherwise keep it hidden until the
            // user switches to the Audit view to avoid leaking audit status
            // into the Chart header during preload.
            if (contentType === 'conditionAudit') {
              auditStatusEl.style.display = '';
            } else {
              auditStatusEl.style.display = 'none';
            }
          }
        } catch (e) {
          console.warn('Failed to set review status during preload', e);
        }

        // Normalize payload shapes: apiData may be nested in audit_data.data
        let auditArray = [];
        if (apiData && apiData.audit_summary_data && Array.isArray(apiData.audit_summary_data.data)) {
          auditArray = apiData.audit_summary_data.data;
        } else if (Array.isArray(apiData)) {
          auditArray = apiData;
        }

        const mapped = mapApiAuditRows(auditArray || []);
        conditionAuditData.length = 0;
        Array.prototype.push.apply(conditionAuditData, mapped);
      } else {
        console.warn('⚠️ Audit details pre-load failed:', auditResponse.reason);
      }

      // Process MR Analysis response
      if (mrAnalysisResponse.status === 'fulfilled') {
        console.log('✅ MR Analysis pre-loaded successfully');
        mrAnalysisData = mrAnalysisResponse.value;
      } else {
        console.warn('⚠️ MR Analysis pre-load failed:', mrAnalysisResponse.reason);
      }

      console.log('🎉 Data pre-loading completed');
      // Process DQA response
      if (dqaResponse.status === 'fulfilled') {

        console.log('✅ DQA details pre-loaded successfully');

        const apiData = dqaResponse.value;

        const details =
          apiData &&
            apiData.data &&
            Array.isArray(apiData.data.details)
            ? apiData.data.details
            : [];

        dqaNotPresent = details.length === 0;

        dqaMeta = {
          sts: apiData?.data?.sts || null,
          doc_sc: apiData?.data?.doc_sc || null,
          did: apiData?.data?.did || null
        };

        // dqaData = details.map((item, index) => ({

        //   id: item.id || index,

        //   Condition: item.cn || '',

        //   ICD10: item.rc || '',

        //   encounterDates: item.enc_doc || '',

        //   meatPresent: item.me_p || '',

        //   meatAbsent: item.me_a || '',

        //   supportingEvidence: item.sce || '',

        //   educationPriority: item.ep || '',

        //   documentationStrength: item.ds || ''

        // }));
        dqaData = details.map((item, index) => ({

          id: item.id || index,

          Condition: item.cn || '',

          "ICD-10": item.rc || '',

          encounter_documented: item.enc_doc || '',

          meat_present: item.me_p || '',

          meat_absent: item.me_a || '',

          supporting_clinical_evidence: item.sce || '',

          education_priority: item.ep || '',

          documentation_strength: item.ds || '',

          comment: item.an_cm || '',
          hcc: item.hcc || '',

          rx_hcc: item.rx || ''

        }));
        console.log(dqaData)

        console.log('📝 DQA mapped rows:', dqaData.length);

      } else {

        console.warn(
          '⚠️ DQA preload failed:',
          dqaResponse.reason
        );

      }
      // Apply cached statuses to panel if it was created before preload data arrived
      setTimeout(() => {
        try {
          const chartStatusEl = document.getElementById('reviewStatusHeader');
          const auditStatusEl = document.getElementById('auditReviewStatusHeader');

          if (chartStatusEl && currentChartStatusText) {
            console.log('✏️ Applying cached chart status to panel:', currentChartStatusText);
            chartStatusEl.textContent = currentChartStatusText;
            chartStatusEl.style.color = currentChartStatusColor || '#666';
          }

          if (auditStatusEl && currentAuditStatusText) {
            console.log('✏️ Applying cached audit status to panel:', currentAuditStatusText);
            auditStatusEl.textContent = currentAuditStatusText;
            auditStatusEl.style.color = currentAuditStatusColor || '#666';
          }
        } catch (e) {
          console.warn('⚠️ Failed to apply cached statuses after preload:', e);
        }
      }, 50);

    } catch (error) {
      console.error('❌ Error during data pre-loading:', error);
    }
  }

  // Make functions globally available for onclick handlers
  window.handleSearch = handleSearch;
  window.handleConditionAuditSearch = handleConditionAuditSearch;
  window.sortConditionAuditData = sortConditionAuditData;
  window.renderConditionAuditSortIcon = renderConditionAuditSortIcon;

  // 🧠 Observe DOM changes
  observer = new MutationObserver(() => {
    tryAutoLoad().catch(error => console.error('Error in tryAutoLoad:', error));
  });
  observer.observe(document.body, { childList: true, subtree: true });

  // Try once immediately
  tryAutoLoad().catch(error => console.error('Error in initial tryAutoLoad:', error));
})();
