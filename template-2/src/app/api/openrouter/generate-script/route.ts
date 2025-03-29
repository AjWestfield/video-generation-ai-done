import { NextResponse } from "next/server";

export async function POST(request: Request) {
  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error(
      "The OPENROUTER_API_KEY environment variable is not set. See README.md for instructions on how to set it."
    );
  }

  const { prompt, duration = 1 } = await request.json();
  
  // Calculate target word count based on duration
  const targetWordCount = duration * 180; // 180 words per minute
  // Set minimum acceptable word count (exactly the target)
  const minWordCount = targetWordCount;
  // Set maximum acceptable word count (15% over target)
  const maxWordCount = Math.floor(targetWordCount * 1.15);
  
  // Max attempts to generate a script without duplicate sentences
  const maxGenerationAttempts = 3;
  let generationAttempt = 0;
  let finalScript = null;

  while (generationAttempt < maxGenerationAttempts && finalScript === null) {
    generationAttempt++;
    console.log(`Script generation attempt ${generationAttempt} of ${maxGenerationAttempts}`);
    
    try {
      // Implement retry mechanism for API calls
      const maxRetries = 3;
      let retryCount = 0;
      let responseData = null;

      while (retryCount < maxRetries && !responseData) {
        try {
          console.log(`Attempt ${retryCount + 1} to call OpenRouter API...`);
          
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
          
          const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
              "HTTP-Referer": "https://localhost:3000",
              "X-Title": "AI Video Creator"
            },
            body: JSON.stringify({
              model: process.env.OPENROUTER_MODEL_ID || "google/gemini-2.0-flash-001",
              messages: [
                {
                  role: "system",
                  content: `You are a professional video script writer. Create a concise and engaging script based on the user's idea.
                  
                  IMPORTANT WORD COUNT REQUIREMENTS:
                  - The script MUST contain EXACTLY between ${minWordCount} and ${maxWordCount} words
                  - Target word count: ${targetWordCount} words
                  - Script must AT MINIMUM meet the target word count (${targetWordCount} words)
                  - Script must NOT exceed ${maxWordCount} words (15% over target)
                  
                  SCRIPT FORMAT REQUIREMENTS:
                  - Include ONLY the actual narration text to be spoken by the voice actor
                  - DO NOT include any labels like "Script:", "Title:", "Introduction:", etc.
                  - DO NOT include any production directions or technical instructions
                  - DO NOT include any metadata or descriptions
                  - Structure the script with proper paragraphs and natural breaks
                  - ONLY return text that will be narrated in the voiceover
                  
                  CRITICAL QUALITY REQUIREMENTS:
                  - Every sentence MUST be unique - DO NOT repeat sentences or phrases
                  - DO NOT use repetitive sentence structures
                  - Ensure the script has a coherent structure with a clear beginning, middle, and end
                  - Maintain context throughout the entire script
                  - Create a narrative flow with a storyline that develops naturally
                  - Vary sentence length and structure to maintain engagement
                  - Avoid generic filler content and cliches
                  - Make sure the script covers the full narrative and completes the story
                  
                  Your response must be a valid JSON object with this structure:
                  {"script": "The actual narration script with paragraphs separated by \\n"}
                  
                  IMPORTANT: The script value MUST be a single line with escaped newlines (\\n) instead of actual line breaks to ensure valid JSON.`
                },
                {
                  role: "user",
                  content: prompt,
                },
              ],
              max_tokens: 2000,
              temperature: 0.7,
            }),
            signal: controller.signal,
          });
          
          clearTimeout(timeoutId);
          
          if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: "Failed to parse error response" }));
            throw new Error(
              `OpenRouter API error: ${response.status} ${JSON.stringify(errorData)}`
            );
          }

          const data = await response.json();
          responseData = data;
          break;
          
        } catch (error) {
          retryCount++;
          console.error(`Attempt ${retryCount} failed:`, error);
          
          if (error.name === 'AbortError') {
            console.log('Request timed out, retrying...');
          }
          
          // If we've exhausted all retries, throw the error
          if (retryCount >= maxRetries) {
            throw error;
          }
          
          // Wait before retrying (exponential backoff)
          const delay = Math.min(1000 * Math.pow(2, retryCount), 10000);
          console.log(`Waiting ${delay}ms before retry ${retryCount + 1}...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
      
      const data = responseData;
      
      if (!data.choices || !data.choices[0] || !data.choices[0].message || !data.choices[0].message.content) {
        throw new Error("Unexpected response format from OpenRouter API");
      }
      
      const content = data.choices[0].message.content;
      console.log("Raw model response:", content);
      
      // Handle JSON parsing more robustly
      let parsedContent;
      try {
        // Check if the content is already valid JSON
        try {
          parsedContent = JSON.parse(content);
        } catch (initialParseError) {
          // Look for JSON content in the response - find anything between curly braces
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          
          if (!jsonMatch) {
            throw new Error("Could not extract JSON from model response");
          }
          
          let jsonContent = jsonMatch[0];
          
          // Remove any backticks and "json" prefix that might be in the response
          jsonContent = jsonContent.replace(/```json|```/g, "").trim();
          
          // Fix common JSON issues: escape unescaped quotes in the script content
          // This regex handles properly escaping double quotes within the "script" value
          jsonContent = jsonContent.replace(/"script"\s*:\s*"((?:\\.|[^"\\])*)"/g, (match, p1) => {
            // Replace any unescaped quotes within the script content
            const escapedScript = p1.replace(/(?<!\\)"/g, '\\"');
            return `"script": "${escapedScript}"`;
          });
          
          // Try to parse the fixed JSON
          parsedContent = JSON.parse(jsonContent);
        }
        
        // Validate that the response has required fields
        if (!parsedContent.script) {
          throw new Error("Missing script field in JSON response");
        }
        
      } catch (e) {
        console.error("JSON parse error:", e);
        console.error("Attempted to parse:", content.substring(0, 500) + "...");
        
        // Try an alternative approach - extract script content directly
        try {
          // Use a more flexible regex to extract the script content
          const scriptMatch = content.match(/"script"\s*:\s*"([^]*?)(?:"(?:\s*\}|\s*,))/);
          if (scriptMatch && scriptMatch[1]) {
            // Clean up and decode the extracted script content
            const scriptContent = scriptMatch[1]
              .replace(/\\n/g, "\n")
              .replace(/\\"/g, '"')
              .replace(/\\\\/g, '\\');
            
            parsedContent = {
              script: scriptContent
            };
          } else {
            throw new Error("Could not extract script content");
          }
        } catch (extractError) {
          console.error("Extraction error:", extractError);
          
          // Emergency fallback - generate a basic structure if parsing fails
          parsedContent = {
            script: "Sorry, there was an issue generating your script. Please try again with a different prompt."
          };
        }
      }

      // Convert any \n in the script to actual newlines for display
      if (parsedContent.script) {
        parsedContent.script = parsedContent.script.replace(/\\n/g, "\n");
        
        // Clean the script to ensure ONLY narration text is included
        parsedContent.script = cleanScriptText(parsedContent.script);
        
        // Check for duplicate sentences
        const duplicateCheck = checkForDuplicateSentences(parsedContent.script);
        
        if (duplicateCheck.hasDuplicates) {
          console.log(`Found ${duplicateCheck.duplicateCount} duplicate sentences in attempt ${generationAttempt}.`);
          console.log("Duplicate sentences:", duplicateCheck.duplicateSentences.slice(0, 3));
          
          // Continue to next attempt if duplicates found
          continue;
        }
        
        // Calculate the original word count
        const originalWordCount = parsedContent.script.trim().split(/\s+/).length;
        console.log(`Original word count: ${originalWordCount}, Target: ${targetWordCount}-${maxWordCount}`);
        
        // Verify the word count and adjust if necessary
        if (originalWordCount < minWordCount) {
          console.log(`Script is too short (${originalWordCount} words). Expanding to reach at least ${minWordCount} words.`);
          parsedContent.script = expandScript(parsedContent.script, minWordCount);
          const expandedWordCount = parsedContent.script.trim().split(/\s+/).length;
          console.log(`After expansion: ${expandedWordCount} words`);
          
          // Check again for duplicate sentences after expansion
          const postExpansionCheck = checkForDuplicateSentences(parsedContent.script);
          if (postExpansionCheck.hasDuplicates) {
            console.log(`Found duplicates after expansion in attempt ${generationAttempt}.`);
            continue;
          }
        } else if (originalWordCount > maxWordCount) {
          console.log(`Script is too long (${originalWordCount} words). Reducing to max ${maxWordCount} words.`);
          parsedContent.script = reduceScript(parsedContent.script, maxWordCount);
          const reducedWordCount = parsedContent.script.trim().split(/\s+/).length;
          console.log(`After reduction: ${reducedWordCount} words`);
        } else {
          console.log(`Script length is acceptable (${originalWordCount} words).`);
        }
        
        // Final check - if still too short, force expansion with generic content
        const finalWordCount = parsedContent.script.trim().split(/\s+/).length;
        if (finalWordCount < minWordCount) {
          console.log(`Script still too short after adjustment. Forcing expansion with safe non-repetitive content.`);
          parsedContent.script = safeForcedExpansion(parsedContent.script, prompt, minWordCount, duplicateCheck.sentenceMap);
          const forcedWordCount = parsedContent.script.trim().split(/\s+/).length;
          console.log(`After forced expansion: ${forcedWordCount} words`);
          
          // One final check for duplicates after forced expansion
          const finalDuplicateCheck = checkForDuplicateSentences(parsedContent.script);
          if (finalDuplicateCheck.hasDuplicates) {
            console.log(`Found duplicates after forced expansion in attempt ${generationAttempt}.`);
            continue;
          }
        }
        
        // If we've made it this far, the script has no duplicates and meets length requirements
        finalScript = parsedContent.script;
      }
    } catch (error) {
      console.error(`Error in generation attempt ${generationAttempt}:`, error);
      // Continue to next attempt if an error occurs
    }
  }
  
  // If we couldn't generate a script without duplicates after all attempts
  if (!finalScript) {
    console.error("Failed to generate a script without duplicates after all attempts");
    return NextResponse.json(
      { error: "Could not generate a valid script after multiple attempts. Please try again with a different prompt." },
      { status: 500 }
    );
  }
  
  return NextResponse.json({ script: finalScript }, { status: 200 });
}

// Function to clean script text to ensure only narration is included
function cleanScriptText(script: string): string {
  // Remove common non-narration elements
  let cleanedScript = script;
  
  // Remove any "Script:" prefix
  cleanedScript = cleanedScript.replace(/^(Script:|SCRIPT:).*?\n/i, "");
  
  // Remove section labels like "Introduction:", "Conclusion:", etc.
  cleanedScript = cleanedScript.replace(/^(Introduction:|Intro:|Conclusion:|Title:).*?\n/gmi, "");
  
  // Remove any metadata or annotations in brackets/parentheses that might not be for narration
  cleanedScript = cleanedScript.replace(/\[(.*?)\]|\((NOTE:|PAUSE:|EMPHASIS:)(.*?)\)/gi, "");
  
  // Remove any stage directions like (pause) or [dramatic music]
  cleanedScript = cleanedScript.replace(/\[.*?\]|\(.*?\)/g, "");
  
  // Clean up any double spacing or extra line breaks
  cleanedScript = cleanedScript.replace(/\n{3,}/g, "\n\n").trim();
  
  return cleanedScript;
}

// Function to check for duplicate sentences in a script
function checkForDuplicateSentences(script: string) {
  // Split text into sentences using a more sophisticated regex that handles ellipses, quotes, etc.
  const sentences = script.match(/[^.!?]+[.!?]+(?:\s+|$)/g) || [];
  
  // Map to store normalized sentences we've seen
  const sentenceMap = new Map();
  const duplicateSentences = [];
  
  // Process each sentence
  for (const sentence of sentences) {
    // Normalize the sentence (trim, lowercase, remove excess whitespace)
    const normalized = sentence.trim().toLowerCase().replace(/\s+/g, ' ');
    
    // Skip very short sentences (less than 4 words) as they're more likely to be common phrases
    if (normalized.split(/\s+/).length < 4) {
      continue;
    }
    
    // Check if we've seen this sentence before
    if (sentenceMap.has(normalized)) {
      duplicateSentences.push({
        sentence: sentence.trim(),
        firstPosition: sentenceMap.get(normalized),
        currentPosition: sentences.indexOf(sentence)
      });
    } else {
      sentenceMap.set(normalized, sentences.indexOf(sentence));
    }
  }
  
  return {
    hasDuplicates: duplicateSentences.length > 0,
    duplicateCount: duplicateSentences.length,
    duplicateSentences: duplicateSentences,
    sentenceMap: sentenceMap
  };
}

// Safe forced expansion function that avoids adding duplicate sentences
function safeForcedExpansion(script: string, topic: string, targetWordCount: number, existingSentences: Map<string, number>): string {
  const currentWordCount = script.trim().split(/\s+/).length;
  if (currentWordCount >= targetWordCount) {
    return script;
  }
  
  // Unique expansion sentences that are unlikely to be in the script already
  const uniqueExpansionSentences = [
    "This experience reminds us how fragile our sense of security can be.",
    "Even in familiar places, the unexpected can happen.",
    "Many people have similar stories that challenge what we think we know about the world around us.",
    "The human mind is fascinating in how it processes fear and the unknown.",
    "When faced with unexplainable events, we often try to rationalize them.",
    "We find comfort in logical explanations for unusual occurrences.",
    "Some experiences defy easy explanation and leave us wondering.",
    "What makes these stories compelling is their universal appeal.",
    "We all understand the feeling of vulnerability in unfamiliar situations.",
    "These moments connect us to our most primal instincts and emotions.",
    "Throughout history, similar narratives have appeared across different cultures.",
    "These stories help us process our collective anxieties about the unknown.",
    "Whether you believe in supernatural explanations or scientific ones, mystery still exists.",
    "An open mind allows us to consider possibilities beyond our everyday experiences.",
    "Our perception of reality is shaped by both what we know and what we've yet to discover."
  ];
  
  // Filter out sentences that are too similar to existing ones
  const filteredSentences = uniqueExpansionSentences.filter(sentence => {
    const normalized = sentence.toLowerCase().trim();
    // Check if this sentence or anything very similar exists in our map
    return ![...existingSentences.keys()].some(existing => 
      normalized.includes(existing) || 
      existing.includes(normalized) ||
      calculateSimilarity(normalized, existing) > 0.7); // 70% similarity threshold
  });
  
  // Add sentences until we reach the target word count
  let expandedScript = script;
  let currentCount = currentWordCount;
  let sentenceIndex = 0;
  
  // Create a paragraph of expansion sentences
  const expansionParagraph = [];
  
  while (currentCount < targetWordCount && sentenceIndex < filteredSentences.length) {
    const sentenceToAdd = filteredSentences[sentenceIndex];
    expansionParagraph.push(sentenceToAdd);
    currentCount += sentenceToAdd.split(/\s+/).length;
    sentenceIndex++;
  }
  
  // Add the expansion paragraph if we have sentences to add
  if (expansionParagraph.length > 0) {
    expandedScript += "\n\n" + expansionParagraph.join(" ");
  }
  
  return expandedScript;
}

// Simple similarity function based on character overlap
function calculateSimilarity(str1: string, str2: string): number {
  // Convert strings to character sets
  const set1 = new Set(str1.split(''));
  const set2 = new Set(str2.split(''));
  
  // Calculate intersection and union
  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);
  
  // Return Jaccard similarity: intersection size / union size
  return intersection.size / union.size;
}

// Function to expand a script to meet minimum word count
function expandScript(script: string, targetWordCount: number): string {
  const currentWordCount = script.trim().split(/\s+/).length;
  
  if (currentWordCount >= targetWordCount) {
    return script; // Already meets the minimum
  }
  
  // Generic expansion sentences that can work with most scripts
  const expansionSentences = [
    "This is something worth considering in more detail.",
    "Let's take a moment to reflect on what this means.",
    "The implications of this are far-reaching and significant.",
    "Many people often overlook this important aspect.",
    "It's fascinating to consider how this impacts our daily lives.",
    "There's more to this story than meets the eye.",
    "This perspective offers valuable insights into the topic.",
    "When we examine this more closely, we discover additional layers of complexity.",
    "This highlights an essential point that deserves our attention.",
    "It's worth taking the time to fully appreciate this concept."
  ];
  
  // Split the script into paragraphs
  let paragraphs = script.split("\n\n");
  if (paragraphs.length === 1 && script.includes("\n")) {
    paragraphs = script.split("\n");
  }
  if (paragraphs.length === 0) {
    paragraphs = [script];
  }
  
  // Add expansion sentences to paragraphs until we reach the target word count
  let expandedScript = "";
  let currentCount = currentWordCount;
  let expansionIndex = 0;
  
  for (let i = 0; i < paragraphs.length && currentCount < targetWordCount; i++) {
    // Add the original paragraph
    expandedScript += paragraphs[i];
    
    // Add expansion sentences if we still need more words
    if (currentCount < targetWordCount) {
      // Add one expansion sentence per paragraph until we reach the target
      const sentenceToAdd = expansionSentences[expansionIndex % expansionSentences.length];
      expandedScript += " " + sentenceToAdd;
      currentCount += sentenceToAdd.split(/\s+/).length;
      expansionIndex++;
    }
    
    expandedScript += "\n\n";
  }
  
  // If we still need more words, add a concluding paragraph
  if (currentCount < targetWordCount) {
    const remainingWordsNeeded = targetWordCount - currentCount;
    const concludingSentences = [
      "In conclusion, this topic continues to fascinate and engage audiences around the world.",
      "As we've explored throughout this discussion, there are multiple perspectives to consider.",
      "Ultimately, the significance of this cannot be overstated.",
      "Looking ahead, we can anticipate further developments in this area.",
      "This is certainly a subject worthy of our continued attention and reflection."
    ];
    
    const selectedConclusions = [];
    let wordsAdded = 0;
    
    for (let i = 0; i < concludingSentences.length && wordsAdded < remainingWordsNeeded; i++) {
      selectedConclusions.push(concludingSentences[i]);
      wordsAdded += concludingSentences[i].split(/\s+/).length;
    }
    
    expandedScript += selectedConclusions.join(" ");
  }
  
  return expandedScript.trim();
}

// Function to reduce a script to meet maximum word count
function reduceScript(script: string, maxWordCount: number): string {
  const words = script.trim().split(/\s+/);
  
  if (words.length <= maxWordCount) {
    return script; // Already within the limit
  }
  
  // Simply truncate to the max word count and ensure the last sentence is complete
  const truncatedWords = words.slice(0, maxWordCount);
  let truncatedText = truncatedWords.join(" ");
  
  // Find the last complete sentence
  const lastPeriodIndex = truncatedText.lastIndexOf(".");
  if (lastPeriodIndex !== -1 && lastPeriodIndex > truncatedText.length * 0.8) {
    // Only truncate at the last period if it's in the last 20% of the text
    // This prevents cutting off too much content
    truncatedText = truncatedText.substring(0, lastPeriodIndex + 1);
  }
  
  return truncatedText;
} 