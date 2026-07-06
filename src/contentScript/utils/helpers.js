export function escapeHtml(input) {
  if (input === null || typeof input === 'undefined') return '';
  return String(input)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function getStatusLabel(value) {
  if (!value) return 'Not Applicable';
  const v = value.toLowerCase();
  if (v === 'acceptable') return 'Compliant';
  if (v === 'delete') return 'Non Compliant';
  if (v === 'query required') return 'Partially Compliant';
  if (v === 'not applicable') return 'Not Applicable';
  return 'Not Applicable';
}

export function isNotFoundError(err) {
  if (!err || !err.message) return false;
  const m = err.message.toString().toLowerCase();
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

export function formatToMMDDYYYY(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${month}/${day}/${date.getFullYear()}`;
}

export function mapApiMedicalConditions(apiConditions) {
  if (!Array.isArray(apiConditions)) return [];
  return apiConditions.map((c) => ({
    id: c.id || '',
    title: c.cn || c.dx || 'Unknown condition',
    icon: '🩺',
    details: {
      icd10: (c.icd || '').toString(),
      hcc24: 'hcc' || null,
      hcc28: c.v28 || null,
      rxHcc: c.rx || null,
      source: c.di || '',
      note: !!(c.a_nt || c.qr),
      active: true,
      code_type: c.cs || '',
      RADV_score: 1 || 0,
      code_status: c.cs || '',
      date: c.ldd || null,
    },
    description: c.ce || '',
    clinicalIndicators: c.ci || '',
    codeExplanation: c.qr || '',
    noteText: c.a_nt || null,
  }));
}

export function mapApiAuditRows(apiRows) {
  if (!Array.isArray(apiRows)) return [];
  return apiRows.map((a) => {
    const status = a.updated_status || a.marked_as || '';
    return {
      id: a.id || null,
      Condition: a.condition_name || '',
      'ICD-10': a.icd10_code || '',
      HCC: a.hcc_code || '',
      RxHCC: a.rxhcc_code || '',
      Status: getStatusLabel(status) || 'NOT APPLICABLE',
      raw: a,
    };
  });
}

export function computeChartStatus(apiData, payload) {
  const statusVal =
    apiData?.status ?? apiData?.sts ?? payload?.status ?? null;
  let statusNum = null;
  if (typeof statusVal === 'number') statusNum = statusVal;
  else if (typeof statusVal === 'string' && !isNaN(Number(statusVal)))
    statusNum = Number(statusVal);

  const a = payload || apiData || {};
  let analystName = '';
  if (a.anst?.fn) analystName = `${a.anst.fn} ${a.anst.ln || ''}`.trim();
  else if (a.analyst?.fn) analystName = `${a.analyst.fn} ${a.analyst.ln || ''}`.trim();
  else if (a.analyst_name) analystName = String(a.analyst_name).trim();
  else if (apiData?.analyst_name) analystName = String(apiData.analyst_name).trim();

  let text = '', color = '#666';
  if ([7, 8, 9, 10].includes(statusNum)) {
    text = 'Under Analyst Review'; color = '#ff8c00';
  } else if ([11, 12, 13, 14].includes(statusNum)) {
    text = analystName ? `Reviewed by ${analystName}` : 'Reviewed by Analyst'; color = '#007bff';
  } else if (statusNum === 15) {
    text = analystName ? `Reviewed by ${analystName}` : 'Completed'; color = '#28a745';
  }
  return { text, color };
}

export function filterMedicalConditions(conditions, searchTerm) {
  const trimmed = (searchTerm || '').trim();
  if (!trimmed) return conditions;
  const lower = trimmed.toLowerCase();
  return (conditions || []).filter((c) => {
    const d = c.details || {};
    return (
      c.title?.toLowerCase().includes(lower) ||
      c.description?.toLowerCase().includes(lower) ||
      c.clinicalIndicators?.toLowerCase().includes(lower) ||
      c.codeExplanation?.toLowerCase().includes(lower) ||
      c.noteText?.toLowerCase().includes(lower) ||
      d.icd10?.toLowerCase().includes(lower) ||
      d.hcc24?.toString().includes(lower) ||
      d.hcc28?.toString().includes(lower) ||
      d.rxHcc?.toString().includes(lower) ||
      d.source?.toLowerCase().includes(lower) ||
      d.date?.includes(lower) ||
      d.encounter?.toLowerCase().includes(lower) ||
      d.code_type?.toLowerCase().includes(lower)
    );
  });
}

export function computeAuditStatus(apiData) {
  const stsVal =
    apiData?.sts ?? apiData?.status ?? apiData?.audit_summary_data?.status;
  let stsNum = null;
  if (typeof stsVal === 'number') stsNum = stsVal;
  else if (typeof stsVal === 'string' && !isNaN(Number(stsVal)))
    stsNum = Number(stsVal);

  let text = '', color = '#666';
  if (stsNum === 1) { text = 'Under Pending'; color = '#ff8c00'; }
  else if ([2, 3].includes(stsNum)) { text = 'Under Analyst Review'; color = '#ff8c00'; }
  else if ([4, 5].includes(stsNum)) { text = 'Under Auditor Review'; color = '#007bff'; }
  else if ([6, 7].includes(stsNum)) { text = 'Completed'; color = '#28a745'; }
  else if (typeof stsVal === 'string' && stsVal?.trim()) text = String(stsVal);
  return { text, color };
}
