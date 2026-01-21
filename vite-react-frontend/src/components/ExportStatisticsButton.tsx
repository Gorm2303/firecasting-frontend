import React from 'react';
import { YearlySummary } from '../models/YearlySummary';

interface ExportCSVButtonProps {
  data: YearlySummary[];
}

const ExportCSVButton: React.FC<ExportCSVButtonProps> = ({ data }) => {
  const disabled = !data.length;

  const handleExportCSV = () => {
    if (disabled) return;
    // Create header row using the keys from the first data object.
    const headers = Object.keys(data[0]);
    let csvContent = headers.join(',') + '\n';

    // Append one CSV row for each data entry.
    data.forEach((row) => {
      const rowData = headers.map((header) => row[header as keyof YearlySummary]);
      csvContent += rowData.join(',') + '\n';
    });

    // Create a Blob from the CSV string and trigger a download.
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'yearly_summary_charts.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <button type='button' onClick={handleExportCSV} disabled={disabled}
      style={{
      flex: 1,
      padding: '0.75rem',
      fontSize: '1rem',
      width: '100%',
      opacity: disabled ? 0.6 : 1,
      cursor: disabled ? 'not-allowed' : 'pointer',
    }}>
      Export Statistics CSV
    </button>
  );
};

export default ExportCSVButton;
