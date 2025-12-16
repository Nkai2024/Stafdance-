import { GoogleGenAI } from "@google/genai";
import { AttendanceRecord, Hospital } from "../types";

// Initialize Gemini Client
// In a real production app, this should be proxied through a backend.
// For this frontend-only demo, we assume the key is available in process.env.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

export const analyzeAttendance = async (
  records: AttendanceRecord[],
  hospitals: Hospital[]
): Promise<string> => {
  if (!navigator.onLine) {
    return "Offline Mode: AI analysis is unavailable without an internet connection. Please retry when online.";
  }

  if (!records.length) return "No attendance records available for this period.";

  const model = "gemini-2.5-flash";
  
  // Prepare data for the prompt
  // Filter for potential anomalies to highlight
  const anomalies = records.filter(r => r.flagged || r.anomaly);
  const total = records.length;
  const lateCount = records.filter(r => {
    const d = new Date(r.checkInTime);
    return d.getHours() > 8 || (d.getHours() === 8 && d.getMinutes() > 5);
  }).length;

  const recordsSummary = records.slice(0, 40).map(r => ({ // Limit payload size
    staff: r.userName,
    checkIn: new Date(r.checkInTime).toLocaleString(),
    duration: r.durationMinutes ? `${r.durationMinutes} mins` : 'Ongoing',
    status: r.anomaly ? 'DEVICE MISMATCH' : (r.flagged ? 'LOCATION_FLAG' : 'OK')
  }));

  const prompt = `
    Task: Write a Weekly Attendance Report Email Body.
    
    Context:
    - Hospital Name: ${records[0].hospitalName}
    - Total Shifts: ${total}
    - Late Arrivals: ${lateCount}
    - Anomalies/Flagged: ${anomalies.length}
    
    Data Sample:
    ${JSON.stringify(recordsSummary, null, 2)}

    Instructions:
    1. Write the email body ONLY (no subject line).
    2. Start with "Dear Administrator,".
    3. Provide a bullet-point summary of the week's attendance performance.
    4. Specifically name any staff members with anomalies (Device Mismatch or Location Flags).
    5. Be concise, professional, and medical administration focused.
    6. Do not use markdown formatting (like **bold** or # headers), use plain text as this will go into a mailto link.
  `;

  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: prompt,
    });
    return response.text || "Could not generate analysis.";
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    return "Error generating AI analysis. Please check your API key.";
  }
};