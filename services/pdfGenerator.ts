import { AttendanceRecord } from '../types';

// This file assumes jsPDF and jsPDF-AutoTable are loaded from CDN in index.html
declare const jspdf: any;

const CHECK_IN_DEADLINE_HOUR = 8;
const CHECK_IN_DEADLINE_MINUTE = 5; // 5 minute grace period
const CHECK_OUT_DEADLINE_HOUR = 17;

const getTimeStatus = (date: Date, type: 'in' | 'out'): { status: string, style: { textColor: number[] } } => {
  const hours = date.getHours();
  const minutes = date.getMinutes();

  if (type === 'in') {
    if (hours < CHECK_IN_DEADLINE_HOUR || (hours === CHECK_IN_DEADLINE_HOUR && minutes <= CHECK_IN_DEADLINE_MINUTE)) {
      return { status: 'On Time', style: { textColor: [0, 100, 0] } }; // Green
    }
    if (hours === CHECK_IN_DEADLINE_HOUR && minutes > CHECK_IN_DEADLINE_MINUTE) {
      return { status: 'Late', style: { textColor: [255, 0, 0] } }; // Red
    }
    return { status: 'Late', style: { textColor: [255, 0, 0] } }; // Red for hours > 8
  } else { // type === 'out'
    if (hours < CHECK_OUT_DEADLINE_HOUR) {
      return { status: 'Early', style: { textColor: [239, 68, 68] } }; // Orange/Red
    }
    return { status: 'On Time', style: { textColor: [0, 0, 0] } }; // Black
  }
};


export const generateAttendancePDF = (records: AttendanceRecord[], hospitalName: string) => {
  const doc = new jspdf.jsPDF();
  const tableColumn = [
    "Staff Name", 
    "Date", 
    "Check In", 
    "Check Out", 
    "Duration (m)", 
    "Notes & Flags"
  ];
  const tableRows: any[][] = [];

  records.forEach(record => {
    const checkInDate = new Date(record.checkInTime);
    const checkOutDate = record.checkOutTime ? new Date(record.checkOutTime) : null;

    const date = checkInDate.toLocaleDateString();
    const checkInTime = checkInDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const checkOutTime = checkOutDate ? checkOutDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A';
    
    const checkInStatus = getTimeStatus(checkInDate, 'in');
    const checkOutStatus = checkOutDate ? getTimeStatus(checkOutDate, 'out') : { status: 'N/A', style: { textColor: [0,0,0]}};
    
    let notes = [];
    if (record.flagged) {
      notes.push(`Location Flagged (${Math.round(record.distanceFromCenter)}m)`);
    }
    if (record.anomaly === 'DEVICE_MISMATCH') {
      notes.push('DEVICE MISMATCH!');
    }
    notes.push(`Device: ...${(record.checkInDeviceId || '').slice(-6)}`);


    const recordData = [
      record.userName,
      date,
      { content: `${checkInTime} (${checkInStatus.status})`, styles: checkInStatus.style },
      { content: `${checkOutTime} (${checkOutStatus.status})`, styles: checkOutStatus.style },
      record.durationMinutes || 'N/A',
      { content: notes.join('\n'), styles: { textColor: record.anomaly ? [255,0,0] : [0,0,0], fontSize: 8 } },
    ];
    tableRows.push(recordData);
  });

  doc.autoTable({
    head: [tableColumn],
    body: tableRows,
    startY: 20,
    didDrawPage: (data: any) => {
      // Header
      doc.setFontSize(20);
      doc.setTextColor(40);
      doc.text(hospitalName, data.settings.margin.left, 15);
      doc.setFontSize(10);
      doc.text(`Attendance Report - Generated on ${new Date().toLocaleDateString()}`, data.settings.margin.left, 19);

      // Footer
      const pageCount = doc.internal.getNumberOfPages();
      doc.setFontSize(10);
      doc.text(`Page ${data.pageNumber} of ${pageCount}`, data.settings.margin.left, doc.internal.pageSize.height - 10);
    },
    styles: {
      fontSize: 9,
      cellPadding: 2,
    },
    headStyles: {
      fillColor: [22, 163, 74], // Green
      fontSize: 10,
      fontStyle: 'bold',
    },
  });
  
  // Format filename
  const safeHospitalName = hospitalName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  const dateStr = new Date().toISOString().split('T')[0];
  doc.save(`attendance_log_${safeHospitalName}_${dateStr}.pdf`);
};