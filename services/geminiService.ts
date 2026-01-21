
import { GoogleGenAI } from "@google/genai";
import { Invoice } from "../types";

export const generatePersonalizedNote = async (invoice: Invoice): Promise<string> => {
  try {
    // Always initialize a new GoogleGenAI instance right before the call.
    // Use process.env.API_KEY directly as per guidelines.
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
    
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

    // Always query GenAI with both the model name and prompt in a single call.
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });

    // Use .text property (not a method) to extract output text.
    return response.text || "Terima kasih telah menginap bersama kami. Kami berharap dapat menyambut Anda kembali.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Terima kasih telah menginap di Blue Orchid. Semoga perjalanan Anda menyenangkan.";
  }
};
