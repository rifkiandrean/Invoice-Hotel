
import { GoogleGenAI } from "@google/genai";
import { Invoice } from "../types";

export const generatePersonalizedNote = async (invoice: Invoice): Promise<string> => {
  try {
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
      console.warn("API Key tidak ditemukan di environment.");
      return "Terima kasih telah menginap bersama kami. Kami berharap dapat menyambut Anda kembali.";
    }

    const ai = new GoogleGenAI({ apiKey });
    const prompt = `
      Act as a high-end luxury hotel concierge. 
      Generate a short, professional, and warm thank-you note for a guest stay.
      Guest Name: ${invoice.guest.name}
      Room Type: ${invoice.stay.roomType}
      Stay: From ${invoice.stay.checkIn} to ${invoice.stay.checkOut}
      Items billed include: ${invoice.items.map(i => i.description).join(', ')}
      
      The note should mention their specific room type and wish them a pleasant journey. 
      Keep it under 60 words. Language: Indonesian (Sopan/Formal).
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });

    return response.text || "Terima kasih telah menginap bersama kami. Kami berharap dapat menyambut Anda kembali.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Terima kasih telah menginap di Blue Orchid. Semoga perjalanan Anda menyenangkan.";
  }
};
