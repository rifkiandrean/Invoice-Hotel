
import { GoogleGenAI } from "@google/genai";
import { Invoice } from "../types";

export const generatePersonalizedNote = async (invoice: Invoice): Promise<string> => {
  try {
    // Fix: Using the correct initialization pattern with process.env.API_KEY
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
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

    // Fix: Using correct generateContent pattern and model name
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });

    // Fix: Accessing .text property directly (not as a method)
    return response.text || "Terima kasih telah menginap bersama kami. Kami berharap dapat menyambut Anda kembali.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Terima kasih telah menginap di Azure Luxe Resort & Spa. Semoga perjalanan Anda menyenangkan.";
  }
};
