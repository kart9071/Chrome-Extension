/* global chrome */
import { useCallback, useEffect, useRef, useState } from 'react';
import AuditContent from './components/AuditContent';
import ChartContent from './components/ChartContent';
import DQAContent from './components/DQAContent';
import FloatingButtons from './components/FloatingButtons';
import MRContent from './components/MRContent';
import FloatingPanel from './components/FloatingPanel';
import {
  fetchAuditDetails,
  fetchChartDetails,
  fetchDqaDetails,
  fetchMRAnalysis,
} from './utils/chrome';
import {
  computeAuditStatus,
  computeChartStatus,
  mapApiAuditRows,
  mapApiMedicalConditions
} from './utils/helpers';

const TABLE_SELECTOR = '#ctl00_MainContent_ucPatientDetail_dlPatient';
const UL_SELECTOR = '#ulReadPatientDetail';

export default function App() {
  // ── Lifecycle ──────────────────────────────────────────────────
  const [hasLoaded, setHasLoaded] = useState(false);
  const observerRef = useRef(null);

  // ── Panel visibility & active tab ─────────────────────────────
  const [panelOpen, setPanelOpen] = useState(false);
  // 'chart' | 'conditionAudit' | 'mrAnalysis' | 'dqa' | 'memberRisk'
  const [contentType, setContentType] = useState('chart');

  // ── Member context ────────────────────────────────────────────
  const [currentMemberId, setCurrentMemberId] = useState(null);
  const [currentMemberName, setCurrentMemberName] = useState('');
  const [currentDos, setCurrentDos] = useState('');
  const [currentAuditDos, setCurrentAuditDos] = useState('');

  // ── API data ──────────────────────────────────────────────────
  const [chartApiData, setChartApiData] = useState(null);
  const [medicalConditionsData, setMedicalConditionsData] = useState([]);
  const [conditionAuditData, setConditionAuditData] = useState([]);
  const [mrAnalysisData, setMrAnalysisData] = useState(null);
  const [dqaData, setDqaData] = useState([]);
  const [dqaNotPresent, setDqaNotPresent] = useState(false);

  // ── Loading flags ─────────────────────────────────────────────
  const [isChartLoading, setIsChartLoading] = useState(false);
  const [isMRLoading, setIsMRLoading] = useState(false);
  const [isDqaLoading, setIsDqaLoading] = useState(false);

  // ── Status display ────────────────────────────────────────────
  const [chartStatus, setChartStatus] = useState({ text: '', color: '#666' });
  const [auditStatus, setAuditStatus] = useState({ text: '', color: '#666' });

  // ── Search / filter / sort ────────────────────────────────────
  const [searchTerm, setSearchTerm] = useState('');
  const [conditionAuditSearchTerm, setConditionAuditSearchTerm] = useState('');
  const [conditionAuditSortConfig, setConditionAuditSortConfig] = useState({
    key: null,
    direction: 'asc',
  });
  const [expandedAuditRows, setExpandedAuditRows] = useState(new Set());

  // DQA filters
  const [dqaStrengthFilter, setDqaStrengthFilter] = useState('WEAK');
  const [dqaCategoryFilters, setDqaCategoryFilters] = useState(['HCC', 'RXHCC']);

  // ── Preload all APIs in parallel ──────────────────────────────
  const preloadData = useCallback(async (chartNumber, patientName) => {
    const [chartRes, auditRes, mrRes, dqaRes] = await Promise.allSettled([
      fetchChartDetails(chartNumber, patientName),
      fetchAuditDetails(chartNumber, patientName),
      fetchMRAnalysis(chartNumber, patientName),
      fetchDqaDetails(chartNumber, patientName),
    ]);

    // Chart
    if (chartRes.status === 'fulfilled') {
      const apiData = chartRes.value;
      setChartApiData(apiData);
      const payload = apiData?.data ?? apiData;
      const mapped = mapApiMedicalConditions(payload?.mcond ?? []);
      setMedicalConditionsData(mapped);

      if (payload?.mem) {
        const name = `${payload.mem.fn || ''} ${payload.mem.ln || ''}`.trim();
        if (name) setCurrentMemberName(name);
      }

      try {
        const dos = payload?.appt?.dos;
        if (dos) setCurrentDos(new Date(dos).toLocaleDateString());
      } catch (_) {}

      setChartStatus(computeChartStatus(apiData, payload));
    }

    // Audit
    if (auditRes.status === 'fulfilled') {
      const apiData = auditRes.value;
      if (apiData?.mn) setCurrentMemberName(apiData.mn);

      try {
        if (apiData?.dos) setCurrentAuditDos(new Date(apiData.dos).toLocaleDateString());
      } catch (_) {}

      setAuditStatus(computeAuditStatus(apiData));

      const auditArray =
        Array.isArray(apiData?.audit_summary_data?.data)
          ? apiData.audit_summary_data.data
          : Array.isArray(apiData)
          ? apiData
          : [];
      setConditionAuditData(mapApiAuditRows(auditArray));
    }

    // MR Analysis
    if (mrRes.status === 'fulfilled') {
      setMrAnalysisData(mrRes.value);
    }

    // DQA
    if (dqaRes.status === 'fulfilled') {
      const apiData = dqaRes.value;
      const details = Array.isArray(apiData?.data?.details)
        ? apiData.data.details
        : [];
      setDqaNotPresent(details.length === 0);
      setDqaData(
        details.map((item, index) => ({
          id: item.id ?? index,
          Condition: item.cn || '',
          'ICD-10': item.rc || '',
          encounter_documented: item.enc_doc || '',
          meat_present: item.me_p || '',
          meat_absent: item.me_a || '',
          supporting_clinical_evidence: item.sce || '',
          education_priority: item.ep || '',
          documentation_strength: item.ds || '',
          comment: item.an_cm || '',
          hcc: item.hcc || '',
          rx_hcc: item.rx || '',
        }))
      );
    } else {
      // API error or no response — treat as not present
      setDqaNotPresent(true);
    }
  }, []);

  // ── Auto-detect member from page DOM ─────────────────────────
  const tryAutoLoad = useCallback(async () => {
    if (hasLoaded) return;

    // const table = document.querySelector(TABLE_SELECTOR);
    // const ul = document.querySelector(UL_SELECTOR);
    // if (!table || !ul) return;

    // const chartNumber = document.querySelector('#chartNumber')?.textContent?.trim();
    // const patientName = document.querySelector('#patientName')?.textContent?.trim();
    const chartNumber = window.prompt("enter the chart number");
    const patientName = window.prompt("enter the patient name");
    if (!chartNumber || !patientName) return;

    setCurrentMemberId(chartNumber);
    setCurrentMemberName(patientName);
    setHasLoaded(true);

    await preloadData(chartNumber, patientName);
  }, [hasLoaded, preloadData]);

  // ── Mount: inject font, start observer ───────────────────────
  useEffect(() => {
    const style = document.createElement('style');
    style.id = 'ct-poppins-font';
    style.textContent = `
      @font-face {
        font-family: 'Poppins';
        src: url('${chrome.runtime.getURL('fonts/Poppins-Regular.ttf')}') format('truetype');
        font-weight: normal;
        font-style: normal;
      }
      #ct-react-root * { font-family: 'Poppins', sans-serif !important; }
    `;
    if (!document.getElementById('ct-poppins-font')) {
      document.head.appendChild(style);
    }

    observerRef.current = new MutationObserver(() => {
      tryAutoLoad().catch(console.error);
    });
    observerRef.current.observe(document.body, { childList: true, subtree: true });

    tryAutoLoad().catch(console.error);

    return () => {
      observerRef.current?.disconnect();
    };
  }, [tryAutoLoad]);

  // ── Fetch helpers that also update state ──────────────────────
  async function reloadChartDetails() {
    if (!currentMemberId) return;
    setIsChartLoading(true);
    try {
      const apiData = await fetchChartDetails(currentMemberId, currentMemberName);
      setChartApiData(apiData);
      const payload = apiData?.data ?? apiData;
      setMedicalConditionsData(mapApiMedicalConditions(payload?.mcond ?? []));
      if (payload?.mem) {
        const name = `${payload.mem.fn || ''} ${payload.mem.ln || ''}`.trim();
        if (name) setCurrentMemberName(name);
      }
      try {
        const dos = payload?.appt?.dos;
        if (dos) setCurrentDos(new Date(dos).toLocaleDateString());
      } catch (_) {}
      setChartStatus(computeChartStatus(apiData, payload));
    } finally {
      setIsChartLoading(false);
    }
  }

  async function reloadAuditDetails() {
    if (!currentMemberId) return;
    try {
      const apiData = await fetchAuditDetails(currentMemberId, currentMemberName);
      if (apiData?.mn) setCurrentMemberName(apiData.mn);
      try {
        if (apiData?.dos) setCurrentAuditDos(new Date(apiData.dos).toLocaleDateString());
      } catch (_) {}
      setAuditStatus(computeAuditStatus(apiData));
      const auditArray =
        Array.isArray(apiData?.audit_summary_data?.data)
          ? apiData.audit_summary_data.data
          : Array.isArray(apiData)
          ? apiData
          : [];
      setConditionAuditData(mapApiAuditRows(auditArray));
    } catch (err) {
      console.error('Failed to reload audit details:', err);
      throw err;
    }
  }

  async function reloadMRAnalysis() {
    if (!currentMemberId) return;
    setIsMRLoading(true);
    try {
      const data = await fetchMRAnalysis(currentMemberId, currentMemberName);
      setMrAnalysisData(data);
    } finally {
      setIsMRLoading(false);
    }
  }

  async function reloadDqaDetails() {
    if (!currentMemberId) return;
    setIsDqaLoading(true);
    try {
      const apiData = await fetchDqaDetails(currentMemberId, currentMemberName);
      const details = Array.isArray(apiData?.data?.details) ? apiData.data.details : [];
      setDqaNotPresent(details.length === 0);
      setDqaData(
        details.map((item, index) => ({
          id: item.id ?? index,
          Condition: item.cn || '',
          'ICD-10': item.rc || '',
          encounter_documented: item.enc_doc || '',
          meat_present: item.me_p || '',
          meat_absent: item.me_a || '',
          supporting_clinical_evidence: item.sce || '',
          education_priority: item.ep || '',
          documentation_strength: item.ds || '',
          comment: item.an_cm || '',
          hcc: item.hcc || '',
          rx_hcc: item.rx || '',
        }))
      );
    } catch (err) {
      console.error('Failed to reload DQA details:', err);
      setDqaNotPresent(true);
    } finally {
      setIsDqaLoading(false);
    }
  }

  // ── Audit row expand/collapse ─────────────────────────────────
  function toggleAuditRow(rowId) {
    setExpandedAuditRows((prev) => {
      const next = new Set(prev);
      if (next.has(String(rowId))) next.delete(String(rowId));
      else next.add(String(rowId));
      return next;
    });
  }

  // ── Sort condition audit ──────────────────────────────────────
  function sortAudit(key) {
    setConditionAuditSortConfig((prev) => {
      if (prev.key === key) {
        if (prev.direction === 'asc') return { key, direction: 'desc' };
        return { key: null, direction: 'asc' };
      }
      return { key, direction: 'asc' };
    });
  }

  // ── Don't render anything until member is detected ────────────
  if (!hasLoaded) return null;

  // ── Shared props passed to child components ───────────────────
  const sharedState = {
    // panel
    panelOpen,
    setPanelOpen,
    contentType,
    setContentType,
    // member
    currentMemberId,
    currentMemberName,
    currentDos,
    currentAuditDos,
    // data
    chartApiData,
    medicalConditionsData,
    conditionAuditData,
    mrAnalysisData,
    dqaData,
    dqaNotPresent,
    // loading
    isChartLoading,
    isMRLoading,
    // status
    chartStatus,
    auditStatus,
    // search/filter/sort
    searchTerm,
    setSearchTerm,
    conditionAuditSearchTerm,
    setConditionAuditSearchTerm,
    conditionAuditSortConfig,
    sortAudit,
    expandedAuditRows,
    toggleAuditRow,
    dqaStrengthFilter,
    setDqaStrengthFilter,
    dqaCategoryFilters,
    setDqaCategoryFilters,
    // reload actions
    reloadChartDetails,
    reloadAuditDetails,
    reloadMRAnalysis,
    reloadDqaDetails,
  };

  // ── Button click: open panel and set view ─────────────────────
  function handleButtonClick(type) {
    const isAlreadyActive = panelOpen && contentType === type;

    if (isAlreadyActive) {
      // Refresh data for the current view
      if (type === 'chart') reloadChartDetails().catch(console.error);
      if (type === 'conditionAudit') reloadAuditDetails().catch(console.error);
      if (type === 'mrAnalysis') reloadMRAnalysis().catch(console.error);
      if (type === 'dqa') reloadDqaDetails().catch(console.error);
      return;
    }

    setPanelOpen(true);
    setContentType(type);

    // Auto-fetch audit data each time audit panel opens (to keep DOS fresh)
    if (type === 'conditionAudit' && currentMemberId) {
      reloadAuditDetails().catch(console.error);
    }
  }

  function handleClose() {
    setPanelOpen(false);
  }

  return (
    <>
      <FloatingButtons
        panelOpen={panelOpen}
        contentType={contentType}
        onButtonClick={handleButtonClick}
      />
      {/* Backdrop */}
      <div
        className={`ct-backdrop${panelOpen ? ' visible' : ''}`}
        onClick={handleClose}
      />
      <FloatingPanel
        panelOpen={panelOpen}
        contentType={contentType}
        currentMemberName={currentMemberName}
        currentDos={currentDos}
        currentAuditDos={currentAuditDos}
        medicalConditionsData={medicalConditionsData}
        dqaData={dqaData}
        chartStatus={chartStatus}
        auditStatus={auditStatus}
        isChartLoading={isChartLoading}
        onClose={handleClose}
      >
        {/* Content components (Steps 3–6) will be rendered here */}
        <PanelContent
          contentType={contentType}
          medicalConditionsData={medicalConditionsData}
          conditionAuditData={conditionAuditData}
          mrAnalysisData={mrAnalysisData}
          dqaData={dqaData}
          dqaNotPresent={dqaNotPresent}
          isChartLoading={isChartLoading}
          isMRLoading={isMRLoading}
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          conditionAuditSearchTerm={conditionAuditSearchTerm}
          setConditionAuditSearchTerm={setConditionAuditSearchTerm}
          conditionAuditSortConfig={conditionAuditSortConfig}
          sortAudit={sortAudit}
          expandedAuditRows={expandedAuditRows}
          toggleAuditRow={toggleAuditRow}
          dqaStrengthFilter={dqaStrengthFilter}
          setDqaStrengthFilter={setDqaStrengthFilter}
          dqaCategoryFilters={dqaCategoryFilters}
          setDqaCategoryFilters={setDqaCategoryFilters}
          currentMemberName={currentMemberName}
        />
      </FloatingPanel>
    </>
  );
}

// All 4 content views are now implemented (Steps 3–6 complete)
function PanelContent({
  contentType,
  medicalConditionsData,
  conditionAuditData,
  mrAnalysisData,
  dqaData,
  dqaNotPresent,
  isChartLoading,
  isMRLoading,
  searchTerm,
  conditionAuditSearchTerm,
  setConditionAuditSearchTerm,
  conditionAuditSortConfig,
  sortAudit,
  expandedAuditRows,
  toggleAuditRow,
  isDqaLoading,
  dqaStrengthFilter,
  setDqaStrengthFilter,
  dqaCategoryFilters,
  setDqaCategoryFilters,
}) {
  if (contentType === 'chart') {
    return (
      <ChartContent
        medicalConditionsData={medicalConditionsData}
        searchTerm={searchTerm}
        isChartLoading={isChartLoading}
      />
    );
  }

  if (contentType === 'conditionAudit') {
    return (
      <AuditContent
        conditionAuditData={conditionAuditData}
        conditionAuditSearchTerm={conditionAuditSearchTerm}
        setConditionAuditSearchTerm={setConditionAuditSearchTerm}
        conditionAuditSortConfig={conditionAuditSortConfig}
        sortAudit={sortAudit}
        expandedAuditRows={expandedAuditRows}
        toggleAuditRow={toggleAuditRow}
      />
    );
  }

  if (contentType === 'mrAnalysis') {
    return (
      <MRContent
        mrAnalysisData={mrAnalysisData}
        isMRLoading={isMRLoading}
      />
    );
  }

  if (contentType === 'dqa') {
    return (
      <DQAContent
        dqaData={dqaData}
        dqaNotPresent={dqaNotPresent}
        isDqaLoading={isDqaLoading}
        dqaStrengthFilter={dqaStrengthFilter}
        setDqaStrengthFilter={setDqaStrengthFilter}
        dqaCategoryFilters={dqaCategoryFilters}
        setDqaCategoryFilters={setDqaCategoryFilters}
      />
    );
  }

  return null;
}
