import { GoogleGenAI, Type, ThinkingLevel } from "@google/genai";
import { WordData } from "../types";

const getApiKey = () => process.env.GEMINI_API_KEY || process.env.API_KEY || '';

// Helper for retrying async operations with timeout
async function withRetry<T>(operation: () => Promise<T>, retries = 2, delay = 1000, timeoutMs = 60000): Promise<T> {
  try {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Operation timed out')), timeoutMs);
    });
    return await Promise.race([operation(), timeoutPromise]);
  } catch (error: any) {
    const errString = error?.message || JSON.stringify(error);
    
    // Check for Quota limits immediately and trigger UI redirect
    if (errString.includes('429') || errString.includes('RESOURCE_EXHAUSTED')) {
        console.warn("Quota exceeded, triggering paywall.");
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('gemini-quota-exceeded'));
        }
        throw error; // Stop execution
    }

    // Other fatal errors
    const isFatal = errString.includes('PERMISSION_DENIED') ||
                    errString.includes('API_KEY_INVALID') ||
                    errString.includes('API_KEY_NOT_FOUND');

    if (retries > 0 && !isFatal) {
      console.warn(`Operation failed, retrying... (${retries} attempts left). Error: ${errString}`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return withRetry(operation, retries - 1, delay * 2, timeoutMs);
    }
    throw error;
  }
}

// Helper to clean JSON string from potential markdown backticks
function cleanJsonString(str: string): string {
  if (!str) return "{}";
  // Remove markdown backticks if present
  let cleaned = str.trim();
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.replace(/^```json\n?/, '').replace(/\n?```$/, '');
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```\n?/, '').replace(/\n?```$/, '');
  }
  return cleaned.trim();
}

export interface WordValidationResult {
  isValid: boolean;
  reason?: string;
  correctedWord?: string;
}

export const validateWordInput = async (word: string): Promise<WordValidationResult> => {
  const apiKey = getApiKey();
  if (!apiKey) {
    return { isValid: false, reason: "API key is missing. Please set GEMINI_API_KEY in Settings > Secrets." };
  }
  const ai = new GoogleGenAI({ apiKey });
  return withRetry(async () => {
    const model = 'gemini-3-flash-preview';
    const response = await ai.models.generateContent({
      model,
      contents: `Validate the word: "${word}"`,
      config: {
        systemInstruction: `You are a strict English vocabulary validator for a children's learning app.
        Validate the following English word input: "${word}".
        
        CRITICAL RULES:
        1. **Existence**: Must be a real, correctly spelled English word (or a very minor typo that can be corrected).
        2. **Allowed POS**: ONLY Nouns (n.), Verbs (v.), and Adjectives (adj.).
        3. **Disallowed POS**: 
           - Adverbs (e.g., "quickly", "very")
           - Pronouns (e.g., "he", "she", "it")
           - Prepositions (e.g., "in", "on", "at")
           - Conjunctions (e.g., "and", "but", "or")
           - Articles (e.g., "a", "an", "the")
           - Interjections (e.g., "wow", "oh")
           - Particles
        4. **Suitability**: The word must be concrete enough to be illustrated for a 6-12 year old child. Avoid highly abstract or inappropriate concepts.
        5. **Typos**: If the input has a minor typo (e.g., "appple"), set isValid to true and provide the correctedWord ("apple").
        6. **Output**: Return a JSON object with isValid (boolean), reason (string, explain why if invalid), and correctedWord (string, optional).`,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            isValid: { type: Type.BOOLEAN },
            reason: { type: Type.STRING },
            correctedWord: { type: Type.STRING }
          },
          required: ["isValid"]
        },
        maxOutputTokens: 2048,
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW }
      }
    });
    
    const jsonStr = cleanJsonString(response.text || "{}");
    return JSON.parse(jsonStr) as WordValidationResult;
  });
};

export const generateWordData = async (word: string): Promise<WordData> => {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error("API key is missing. Please set GEMINI_API_KEY in Settings > Secrets.");
  }
  const ai = new GoogleGenAI({ apiKey });
  return withRetry(async () => {
    const model = 'gemini-3-flash-preview';
    
    const response = await ai.models.generateContent({
      model,
      contents: `Generate data for: "${word}"`,
      config: {
        systemInstruction: `Generate detailed vocabulary data for English words. 
        Target audience: Elementary school students learning English. 
        
        1. "parts": Break the word into **Spelling Chunks** using a **Right-to-Left** analysis strategy.
           - **Rule 1 (Right-to-Left, Vowel+Consonant)**: Scan from right to left. Group one vowel sound with its leading consonant(s).
           - **Rule 2 (Silent E)**: 'e' at the end of a word is silent and does NOT count as a vowel. It belongs to the preceding group (e.g., 'cake' -> ['cake'], 'slime' -> ['s', 'lime']).
           - **Rule 3 (Vowel Teams)**: Vowel digraphs (e.g., 'ai', 'ea', 'oa', 'ou', 'ir', 'er', 'ur', 'oo') count as ONE vowel sound.
           - **Rule 4 (Y as Vowel)**: 'y' at the end of a word or syllable acts as a vowel (e.g., 'happy' -> ['hap', 'py'], 'sky' -> ['sky']).
           - **Rule 5 (Double Consonants)**: Split between double consonants (e.g., 'apple' -> ['ap', 'ple'], 'rabbit' -> ['rab', 'bit']).
           - **Rule 6 (Compound Words)**: Split between the two base words first (e.g., 'football' -> ['foot', 'ball'], 'sunflower' -> ['sun', 'flow', 'er']).
           - **Rule 7 (Suffixes)**: Keep common suffixes intact (e.g., 'ment', 'tion', 'ing', 'ness').
           - **Rule 8 (Single Vowel Sound)**: If a word has only one vowel sound, do NOT split it.
           - **Examples**: 
             - "bird" -> ["bird"]
             - "shirt" -> ["shirt"]
             - "cake" -> ["cake"]
             - "slime" -> ["s", "lime"]
             - "apple" -> ["ap", "ple"]
             - "tiger" -> ["ti", "ger"]
             - "education" -> ["e", "du", "ca", "tion"]
             - "helicopter" -> ["he", "li", "cop", "ter"]
             - "kangaroo" -> ["kan", "ga", "roo"]
             - "dolphin" -> ["dol", "phin"]
             - "family" -> ["fam", "i", "ly"]
           - **Goal**: Every part should be a pronounceable chunk, ideally following "One Vowel One Consonant" flow where the consonant leads the next vowel.
        2. "partsPronunciation": An array of simple English strings mirroring "parts" to help a TTS engine pronounce the syllable correctly in isolation.
           - **Crucial**: The goal is standard American pronunciation.
           - **Rule (le ending)**: If a part ends in "le" (like "ple", "tle", "ble"), the pronunciation should end in "ull" or "ull" sound (e.g., "pull", "tull", "bull").
           - **Specific Override**: "bird" -> "bird".
           - **Specific Override**: "shirt" -> "shirt".
           - **Specific Override**: "ti" in tiger -> "tie". "ger" in tiger -> "gur".
           - **Specific Override**: "gu" in argument -> "gyou".
           - **Specific Override**: "bu" in bucket -> "buck". "cket" in bucket -> "it".
           - **Specific Override**: "s" in slime -> "ss". "lime" in slime -> "lime".
           - **Specific Override**: "bait" in bait -> "bate".
           - **Specific Override**: "cake" in cake -> "cake".
           - **Specific Override**: "kit" in kitchen -> "kit". "chen" in kitchen -> "chin".
           - **Specific Override**: "com" in complementary -> "kom". "ple" in complementary -> "pluh". "men" in complementary -> "men". "ta" in complementary -> "tuh". "ry" in complementary -> "ree".
           - **Specific Override**: "kan" in kangaroo -> "kang". "ga" in kangaroo -> "guh". "roo" in kangaroo -> "roo".
           - **Specific Override**: "pen" in penguin -> "pen". "guin" in penguin -> "gwin".
           - **Specific Override**: "pur" in purple -> "purr". "ple" in purple -> "pull".
           - **Specific Override**: "tur" in turtle -> "ter". "tle" in turtle -> "tull".
           - **Specific Override**: "or" in orange -> "or". "ange" in orange -> "inj".
           - **Specific Override**: "yel" in yellow -> "yel". "low" in yellow -> "loh".
           - **Specific Override**: "dol" in dolphin -> "dol". "phin" in dolphin -> "fin".
           - **Specific Override**: "fright" in frightened -> "frite". "ened" in frightened -> "und".
           - **Specific Override**: "thirs" in thirsty -> "ther". "ty" in thirsty -> "stee".
           - **Specific Override**: "fam" in family -> "fam". "i" in family -> "ih". "ly" in family -> "lee".
           - **Specific Override**: "vou" in favourite -> "vuh". "rite" in favourite -> "rit".
           - **Specific Override**: "vo" in favorite -> "vuh". "rite" in favorite -> "rit".
           - **Specific Override**: "ca" in education -> "kay". "du" in education -> "jew".
        3. "partOfSpeech": The part of speech abbreviation (e.g., "n.", "v.", "adj.", "adv.").
        4. "root": A very simple memory aid or mnemonic for kids. Avoid complex Latin etymology.
           - **Specific Override**: For "purple", use "purr (like a cat) + ple (sounds like pull)".
           - **Specific Override**: For "orange", use "or (like the word) + ange (sounds like inj)".
           - **Specific Override**: For "yellow", use "yel (like bell) + low (like the word)".
           - **Specific Override**: For "dolphin", use "dol (like doll) + phin (sounds like fin)".
           - **Specific Override**: For "frightened", use "fright (like light) + ened (sounds like und)".
           - **Specific Override**: For "thirsty", use "thirs (like first) + ty (sounds like tee)".
           - **Specific Override**: For "family", use "fam (like ham) + i (sounds like ih) + ly (sounds like lee)".
        5. "phonetic": **Standard US English IPA**.
        6. "translation": The Chinese translation of the word.
        7. "sentence": Simple example sentence.
        9. "phrases": List 3 short, simple, and common phrases/collocations using this word (max 3-4 words each).
        10. "relatedWords": List of 3 English words that share similar spelling patterns, roots, or are compound words containing this word.`,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            word: { type: Type.STRING },
            partOfSpeech: { type: Type.STRING },
            parts: { type: Type.ARRAY, items: { type: Type.STRING } },
            partsPronunciation: { type: Type.ARRAY, items: { type: Type.STRING } },
            root: { type: Type.STRING },
            phonetic: { type: Type.STRING },
            translation: { type: Type.STRING },
            sentence: { type: Type.STRING },
            phrases: { type: Type.ARRAY, items: { type: Type.STRING } },
            relatedWords: { type: Type.ARRAY, items: { type: Type.STRING } }
          },
          required: ["word", "partOfSpeech", "parts", "partsPronunciation", "root", "phonetic", "translation", "sentence", "phrases", "relatedWords"]
        },
        maxOutputTokens: 8192,
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW }
      }
    });

    const text = response.text;
    console.log("Gemini Response for", word, ":", text);
    if (!text) throw new Error("No data returned from Gemini");
    
    const jsonStr = cleanJsonString(text);
    const data = JSON.parse(jsonStr) as WordData;
    console.log("Parsed Data for", word, ":", data);
    return data;
  });
};

export const generateWordImage = async (word: string): Promise<string> => {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error("API key is missing. Please set GEMINI_API_KEY in Settings > Secrets.");
  }
  const ai = new GoogleGenAI({ apiKey });
  try {
    // Step 1: Generate a descriptive prompt using gemini-3-flash-preview
    const descriptivePrompt = await withRetry(async () => {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Generate a descriptive image prompt for the word: "${word}"`,
        config: {
          systemInstruction: `You are an expert at writing prompts for image generation models.
          Your goal is to create a prompt for a children's learning app illustration.
          
          STYLE GUIDELINES:
          - Core Style: Cute cartoon style illustration, vibrant colors, thick lines, child-friendly, vector illustration, soft lighting.
          - Composition: Centered subject, simple white background, single object, high contrast.
          - Constraints: NO TEXT, NO COMPLEX SCENES, NO BACKGROUND DISTRACTIONS.
          
          TASK:
          Describe the word "${word}" in a way that is easy for a child to recognize. 
          For example, if the word is "apple", describe a shiny red apple with a small green leaf.
          If the word is "run", describe a cute puppy running happily.
          
          OUTPUT:
          Return ONLY the descriptive prompt string. Do not include any other text.`,
          maxOutputTokens: 500,
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW }
        }
      });
      return response.text?.trim() || `A cute cartoon illustration of ${word}`;
    });

    console.log("Generated Image Prompt for", word, ":", descriptivePrompt);

    // Step 2: Generate the image using gemini-2.5-flash-image
    const model = 'gemini-2.5-flash-image';
    const finalPrompt = `${descriptivePrompt}. Cute cartoon style, vibrant colors, thick lines, child-friendly, vector illustration, soft lighting, centered subject, simple white background, no text, single object, high contrast.`;
    
    // Attempt generation with retry
    const rawImage = await withRetry(async () => {
      const response = await ai.models.generateContent({
        model,
        contents: { parts: [{ text: finalPrompt }] },
        config: {
          maxOutputTokens: 2048
        }
      });

      const candidates = response.candidates;
      if (candidates && candidates.length > 0) {
         const parts = candidates[0].content.parts;
         for (const part of parts) {
           // Check for inlineData (base64 image)
           if (part.inlineData && part.inlineData.data) {
             return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
           }
         }
      }
      throw new Error("No image data found in response");
    }, 2); // Retry 2 times
    
    // Compress the image before returning
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.src = rawImage;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxWidth = 1024;
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(rawImage);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.7)); // Compress to JPEG with 70% quality
      };
      img.onerror = (err) => {
        console.warn("Image compression failed, returning raw image", err);
        resolve(rawImage);
      };
    });
    
  } catch (error: any) {
    const errString = error?.message || JSON.stringify(error);
    
    // If it was a quota error, it would have been caught in withRetry and dispatched the event.
    // If we are here, it's a different error (e.g., content policy, network).
    
    console.error("Image generation failed:", error);
    
    // Return a consistent fallback image based on the word seed
    return `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='400' height='400' viewBox='0 0 400 400'><rect width='400' height='400' fill='%23e0f2fe'/><text x='50%' y='50%' font-family='sans-serif' font-size='80' fill='%237dd3fc' text-anchor='middle' dominant-baseline='middle'>🖼️</text><text x='50%' y='65%' font-family='sans-serif' font-size='20' fill='%237dd3fc' text-anchor='middle' dominant-baseline='middle'>No Image</text></svg>`;
  }
};