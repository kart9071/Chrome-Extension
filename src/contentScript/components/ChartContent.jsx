import MedicalConditionCard from './MedicalConditionCard';
import { filterMedicalConditions } from '../utils/helpers';

function NotPresent() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        minHeight: 300,
        textAlign: 'center',
        padding: '40px 20px',
        color: '#6c757d',
      }}
    >
      <div style={{ fontSize: 36, marginBottom: 14 }}>ℹ️</div>
      <div style={{ fontSize: 16, fontWeight: 600, color: '#374151' }}>
        The Chart Details for this member is not present.
      </div>
      <div style={{ marginTop: 8, fontSize: 13, color: '#9ca3af' }}>
        If you believe this is an error, try refreshing or contact support.
      </div>
    </div>
  );
}

export default function ChartContent({ medicalConditionsData, searchTerm, isChartLoading }) {
  if (isChartLoading) {
    return (
      <div style={{ padding: 20, color: '#6c757d', fontStyle: 'italic' }}>
        Loading chart details...
      </div>
    );
  }

  if (!medicalConditionsData || medicalConditionsData.length === 0) {
    return <NotPresent />;
  }

  const filtered = filterMedicalConditions(medicalConditionsData, searchTerm);

  return (
    <div className="medical-conditions-section">
      <div className="medical-conditions-scroll">
        {filtered.length === 0 ? (
          <div style={{ padding: '20px', color: '#6c757d', textAlign: 'center' }}>
            No conditions match &ldquo;<strong>{searchTerm}</strong>&rdquo;.
          </div>
        ) : (
          filtered.map((condition, idx) => (
            <MedicalConditionCard
              key={condition.id || idx}
              condition={condition}
            />
          ))
        )}
      </div>
    </div>
  );
}
