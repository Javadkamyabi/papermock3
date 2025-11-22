/**
 * OpenAI client configuration
 */

import OpenAI from 'openai';

let openaiInstance: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (!openaiInstance) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY environment variable is not set');
    }
    openaiInstance = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return openaiInstance;
}

export const openai = new Proxy({} as OpenAI, {
  get(_target, prop) {
    return getOpenAIClient()[prop as keyof OpenAI];
  },
});

/**
 * Call OpenAI API with a prompt
 */
export async function callOpenAI(
  prompt: string,
  model: string = 'gpt-4',
  systemPrompt?: string
): Promise<string> {
  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];

  if (systemPrompt) {
    messages.push({
      role: 'system',
      content: systemPrompt,
    });
  }

  messages.push({
    role: 'user',
    content: prompt,
  });

  const response = await openai.chat.completions.create({
    model,
    messages,
    temperature: 0.7,
  });

  return response.choices[0]?.message?.content || '';
}

/**
 * Call OpenAI API and parse JSON response
 */
export async function callOpenAIJSON<T = any>(
  prompt: string,
  model: string = 'gpt-4',
  systemPrompt?: string
): Promise<T> {
  const response = await callOpenAI(
    `${prompt}\n\nPlease respond with valid JSON only.`,
    model,
    systemPrompt
  );

  try {
    return JSON.parse(response) as T;
  } catch (error) {
    // Enhanced JSON parsing with multiple fix attempts
    let jsonStr = response;
    
    // Step 1: Try to extract JSON from markdown code blocks first
    // Match ```json or ``` followed by content and closing ```
    const codeBlockMatch = response.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    if (codeBlockMatch && codeBlockMatch[1]) {
      jsonStr = codeBlockMatch[1].trim();
      // Try parsing immediately if we got clean JSON from code block
      try {
        return JSON.parse(jsonStr) as T;
      } catch (e) {
        // Continue with other fixes if parsing fails
      }
    }
    
    // Also try without newlines
    if (jsonStr === response) {
      const codeBlockMatch2 = response.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (codeBlockMatch2 && codeBlockMatch2[1]) {
        jsonStr = codeBlockMatch2[1].trim();
        try {
          return JSON.parse(jsonStr) as T;
        } catch (e) {
          // Continue
        }
      }
    }
    
    // Step 2: Try to extract JSON object/array from response
    let jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      jsonMatch = jsonStr.match(/\[[\s\S]*\]/);
    }
    if (jsonMatch) {
      jsonStr = jsonMatch[0];
    }
    
    // Step 2: Fix common JSON issues
    // Fix trailing commas in arrays: [1, 2, 3, ] -> [1, 2, 3]
    jsonStr = jsonStr.replace(/,(\s*[}\]])/g, '$1');
    
    // Fix trailing commas in objects: {"a": 1, } -> {"a": 1}
    jsonStr = jsonStr.replace(/,(\s*})/g, '$1');
    
    // Fix missing quotes around unquoted keys (if any)
    jsonStr = jsonStr.replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":');
    
    // Fix single quotes to double quotes (if any)
    jsonStr = jsonStr.replace(/'/g, '"');
    
    // Try parsing the fixed JSON
    try {
      return JSON.parse(jsonStr) as T;
    } catch (e1) {
      // Step 3: Try to find and fix the specific error position
      const errorMatch = (e1 as Error).message.match(/position (\d+)/);
      if (errorMatch) {
        const errorPos = parseInt(errorMatch[1]);
        // Try to fix around the error position
        let fixedStr = jsonStr;
        // Remove trailing comma before ] or }
        if (errorPos < fixedStr.length) {
          const beforeError = fixedStr.substring(0, errorPos);
          const afterError = fixedStr.substring(errorPos);
          // Look for patterns like ", ]" or ", }" near the error
          const fixedBefore = beforeError.replace(/,\s*$/, '');
          fixedStr = fixedBefore + afterError;
        }
        
        try {
          return JSON.parse(fixedStr) as T;
        } catch (e2) {
          // Step 4: Try progressive truncation to find valid JSON
          for (let len = jsonStr.length; len > 100; len -= 100) {
            try {
              const truncated = jsonStr.substring(0, len) + '}';
              const parsed = JSON.parse(truncated);
              if (parsed && typeof parsed === 'object') {
                console.warn('JSON parsed with truncation - some data may be lost');
                return parsed as T;
              }
            } catch (e3) {
              // Continue
            }
          }
        }
      }
      
      // Step 5: Last resort - try to extract any valid JSON structure
      try {
        // Try to find the largest valid JSON substring
        for (let start = 0; start < jsonStr.length - 10; start += 10) {
          for (let end = jsonStr.length; end > start + 10; end -= 10) {
            try {
              const candidate = jsonStr.substring(start, end);
              const parsed = JSON.parse(candidate);
              if (parsed && typeof parsed === 'object') {
                console.warn('JSON parsed with substring extraction - some data may be lost');
                return parsed as T;
              }
            } catch (e4) {
              // Continue
            }
          }
        }
      } catch (e5) {
        // Final fallback
      }
    }
    
    // If all else fails, log and throw
    console.error('JSON parsing error. Response length:', response.length);
    console.error('Error:', error instanceof Error ? error.message : String(error));
    console.error('Response preview (first 1000 chars):', response.substring(0, 1000));
    console.error('Response preview (last 500 chars):', response.substring(Math.max(0, response.length - 500)));
    throw new Error(`Failed to parse JSON response after multiple attempts: ${error instanceof Error ? error.message : String(error)}`);
  }
}

