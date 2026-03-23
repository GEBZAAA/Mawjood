
import { GoogleGenAI, Type } from "@google/genai";
import { FoundItem, LostItemReport, MatchResult } from "../types";

export const performSemanticMatch = async (
  lostItem: LostItemReport,
  database: FoundItem[],
  skipImageAnalysis: boolean = false
): Promise<MatchResult[]> => {
  // Filter database by city first to optimize search
  const filteredDb = database.filter(item => item.city === lostItem.city);

  if (filteredDb.length === 0) return [];

  // Local word-matching algorithm to reduce server load as requested
  const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'with', 'by', 'of', 'is', 'are', 'was', 'were', 'it', 'this', 'that', 'these', 'those']);
  
  const getWords = (text: string) => {
    return (text || '').toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .split(/\s+/)
      .filter(word => word.length > 1 && !stopWords.has(word));
  };

  let lostWords = new Set([...getWords(lostItem.name), ...getWords(lostItem.description)]);
  
  // 1. Translate lost item details to Arabic if they are in English (and vice versa) to improve matching
  try {
    const combinedText = `${lostItem.name} ${lostItem.description}`;
    // If it looks like English, translate to Arabic
    if (/[a-zA-Z]/.test(combinedText)) {
      const translatedAr = await translateToArabic(combinedText);
      getWords(translatedAr).forEach(word => lostWords.add(word));
    }
    // If it looks like Arabic, translate to English
    if (/[\u0600-\u06FF]/.test(combinedText)) {
      const translatedEn = await translateToEnglish(combinedText);
      getWords(translatedEn).forEach(word => lostWords.add(word));
    }
  } catch (e) {
    console.error("Translation failed during matching:", e);
  }

  // 2. Semantic Expansion: Get related terms using Gemini
  try {
    const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
    if (apiKey && lostItem.name) {
      const ai = new GoogleGenAI({ apiKey });
      const expansionPrompt = `
        Given the lost item name: "${lostItem.name}"
        Provide a list of 5-10 related terms, synonyms, or categories in both English and Arabic.
        For example, if the name is "jewelry", return terms like "ring", "necklace", "gold", "مجوهرات", "خاتم".
        Return ONLY a JSON array of strings.
      `;
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: expansionPrompt,
        config: { responseMimeType: "application/json" }
      });
      const expandedTerms: string[] = JSON.parse(response.text || "[]");
      expandedTerms.forEach(term => {
        getWords(term).forEach(word => lostWords.add(word));
      });
    }
  } catch (e) {
    console.error("Semantic expansion failed:", e);
  }

  // 3. If we have an image, analyze it to enhance the search words
  if (lostItem.images && lostItem.images.length > 0 && !skipImageAnalysis) {
    try {
      const base64Data = lostItem.images[0].includes('base64,') 
        ? lostItem.images[0].split('base64,')[1] 
        : lostItem.images[0];
      const analysis = await analyzeItemImage(base64Data, 'image/jpeg');
      const analysisWords = getWords(analysis.description);
      analysisWords.forEach(word => lostWords.add(word));
      // Also add category and color to lostWords
      getWords(analysis.category).forEach(word => lostWords.add(word));
      getWords(analysis.color).forEach(word => lostWords.add(word));
    } catch (e) {
      console.error("Image analysis failed during matching:", e);
    }
  }

  if (lostWords.size === 0) return [];

  const results: MatchResult[] = filteredDb.map(item => {
    const itemWords = [
      ...getWords(item.name), 
      ...getWords(item.description),
      ...getWords(item.nameEn || ''),
      ...getWords(item.descriptionEn || ''),
      ...getWords(item.foundLocation),
      ...getWords(item.foundLocationEn || '')
    ];
    const matchedWords: string[] = [];

    lostWords.forEach(word => {
      if (itemWords.includes(word)) {
        matchedWords.push(word);
      }
    });

    const score = matchedWords.length / Math.max(lostWords.size, 1);
    
    return {
      itemId: item.id,
      matchScore: Math.min(score, 0.95),
      reason: matchedWords.length > 0 
        ? `Matched words: ${matchedWords.join(', ')}`
        : "No common words found"
    };
  });

  const candidates = results
    .filter(res => res.matchScore > 0.1)
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, 10);

  if (candidates.length === 0) return [];

  // 4. Reranking: Use Gemini to rank the top candidates for better accuracy
  try {
    const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
    if (apiKey) {
      const ai = new GoogleGenAI({ apiKey });
      const candidateItems = candidates.map(c => {
        const item = filteredDb.find(i => i.id === c.itemId);
        return {
          id: item?.id,
          name: item?.name,
          description: item?.description,
          nameEn: item?.nameEn,
          descriptionEn: item?.descriptionEn
        };
      });

      const rerankPrompt = `
        You are an expert matching system for a Lost & Found service in the Holy Harams.
        A user lost an item:
        Name: "${lostItem.name}"
        Description: "${lostItem.description}"
        
        We found some potential matches in our database. Rank them from 0 to 1 based on how likely they are to be the same item.
        Return ONLY a JSON array of objects with "itemId" and "score" (0-1) and "reason" (brief explanation in Arabic).
        
        Candidates:
        ${JSON.stringify(candidateItems, null, 2)}
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: rerankPrompt,
        config: { responseMimeType: "application/json" }
      });

      const rankedResults: { itemId: string; score: number; reason: string }[] = JSON.parse(response.text || "[]");
      
      return rankedResults
        .map(r => ({
          itemId: r.itemId,
          matchScore: r.score,
          reason: r.reason
        }))
        .sort((a, b) => b.matchScore - a.matchScore)
        .slice(0, 5);
    }
  } catch (e) {
    console.error("Gemini reranking failed:", e);
  }

  return candidates.slice(0, 5);
};

export const analyzeItemImage = async (base64Image: string, mimeType: string): Promise<{ description: string; category: string; color: string; material: string; condition: string }> => {
  const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
  if (!apiKey) {
    throw new Error("No Gemini API key found");
  }
  const ai = new GoogleGenAI({ apiKey });
  
  const prompt = `
    Analyze this image of a lost item found in the Holy Harams. 
    Provide a detailed description in Arabic (العربية) including visual features like color, material, and condition.
    Also suggest a category for the item in Arabic (e.g., إلكترونيات، مجوهرات، حقائب، وثائق).
    
    Return the analysis in JSON format.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          { text: prompt },
          { inlineData: { data: base64Image, mimeType } }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            description: { type: Type.STRING },
            category: { type: Type.STRING },
            color: { type: Type.STRING },
            material: { type: Type.STRING },
            condition: { type: Type.STRING }
          },
          required: ["description", "category", "color", "material", "condition"]
        }
      }
    });

    return JSON.parse(response.text || "{}");
  } catch (error) {
    console.error("Gemini vision analysis failed:", error);
    throw error;
  }
};
export const translateToArabic = async (text: string): Promise<string> => {
  const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
  if (!apiKey || !text) return text;
  const ai = new GoogleGenAI({ apiKey });
  
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Translate the following text to Arabic: "${text}". Return only the translated text.`,
    });
    return response.text?.trim() || text;
  } catch (error: any) {
    if ((error?.message?.includes('429') || error?.status === 429) && text.length < 500) {
      // Small retry for translation
      await new Promise(resolve => setTimeout(resolve, 1000));
      return translateToArabic(text);
    }
    console.error("Gemini translation to Arabic failed:", error);
    return text;
  }
};

export const translateToEnglish = async (text: string): Promise<string> => {
  const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
  if (!apiKey || !text) return text;
  const ai = new GoogleGenAI({ apiKey });
  
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `
        As an expert translator for the Holy Harams (Makkah and Madina) Lost & Found system, 
        translate the following Arabic text to natural, clear English. 
        Focus on accuracy and context (e.g., gate names, item descriptions).
        
        Arabic Text: "${text}"
        
        Return only the translated English text.
      `,
    });
    return response.text?.trim() || text;
  } catch (error: any) {
    if ((error?.message?.includes('429') || error?.status === 429) && text.length < 500) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      return translateToEnglish(text);
    }
    console.error("Gemini translation to English failed:", error);
    return text;
  }
};

export const translateItemFields = async (item: { name: string; description: string; location: string; city: string }): Promise<{ nameEn: string; descriptionEn: string; locationEn: string }> => {
  const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
  if (!apiKey) return { nameEn: item.name, descriptionEn: item.description, locationEn: item.location };
  const ai = new GoogleGenAI({ apiKey });

  const prompt = `
    As an expert translator for the Holy Harams (Makkah and Madina) Lost & Found system, 
    translate the following Arabic item details into natural, clear English.
    
    Context: The item was found in ${item.city}.
    Item Name: ${item.name}
    Description: ${item.description}
    Location/Gate: ${item.location}
    
    Provide the translations in JSON format with keys: nameEn, descriptionEn, locationEn.
    Ensure the translation is context-aware (e.g., specific gate names in the Harams).
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            nameEn: { type: Type.STRING },
            descriptionEn: { type: Type.STRING },
            locationEn: { type: Type.STRING }
          },
          required: ["nameEn", "descriptionEn", "locationEn"]
        }
      }
    });

    return JSON.parse(response.text || "{}");
  } catch (error) {
    console.error("Gemini batch translation failed:", error);
    return { nameEn: item.name, descriptionEn: item.description, locationEn: item.location };
  }
};
