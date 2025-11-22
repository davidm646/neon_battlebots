import { GoogleGenAI } from "@google/genai";
import { DEFAULT_OPCODE_HELP } from "../constants";

export const generateBotScript = async (prompt: string): Promise<string> => {
  if (!process.env.API_KEY) {
    throw new Error("API Key is missing in environment variables.");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const systemPrompt = `
    You are an expert programmer for the game "Neon BattleBots".
    The language mimics assembly.
    
    ${DEFAULT_OPCODE_HELP}
    
    RULES:
    1. Output ONLY the code. No markdown backticks, no explanation.
    2. Use comments (starting with ;) to explain logic.
    3. Always include a START: label and a main LOOP: label.
    4. 'SHOOT' register resets to 0 every frame. To fire continuously, call 'FIRE 1' inside the loop.
    5. Distinguish between System Registers (SPEED, ANGLE, TURRET, RADAR) and custom variables (A, B, state, etc).
    6. Use variables to store state across frames.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        systemInstruction: systemPrompt,
        thinkingConfig: { thinkingBudget: 0 }
      }
    });

    let code = response.text || "";
    // Clean up if the model accidentally added markdown
    code = code.replace(/```assembly/g, '').replace(/```/g, '').trim();
    return code;
  } catch (error) {
    console.error("Gemini generation failed", error);
    return "; Error generating script. Please try again.\n; Check console for details.";
  }
};