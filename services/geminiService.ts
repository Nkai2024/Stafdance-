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

  if (!records.length) return "No attendance records available to analyze.";

  const model = "gemini-2.5-flash";
  
  // Prepare data for the prompt
  const recordsSummary = records.slice(0, 50).map(r => ({ // Limit payload size
    staff: r.userName,
    hospital: r.hospitalName,
    checkIn: r.checkInTime,
    duration: r.durationMinutes ? `${r.durationMinutes} mins` : 'Ongoing',
    flagged: r.flagged ? 'YES (Location Warning)' : 'No',
    distance: `${Math.round(r.distanceFromCenter)}m from center`
  }));

  const prompt = `
    You are an intelligent HR assistant for a hospital network.
    Here is a sample of recent staff attendance logs in JSON format:
    ${JSON.stringify(recordsSummary, null, 2)}

    Please provide a concise summary report covering:
    1. Any staff members who frequently have "Flagged" attendance (meaning they checked in/out away from the hospital).
    2. General adherence to schedule (based on check-in times).
    3. Recommendations for the admin.
    
    Keep the tone professional and medical.
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