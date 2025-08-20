import { config } from '../config/config';
import type { Message, ReasoningData } from '../types';

export class OpenAIService {
  private apiKey: string;
  private baseURL = 'https://api.openai.com/v1';

  constructor(apiKey?: string) {
    this.apiKey = apiKey || config.openai.apiKey;
  }

  updateApiKey(apiKey: string) {
    this.apiKey = apiKey;
  }

  async generateEmbedding(text: string): Promise<number[]> {
    if (!this.apiKey) {
      throw new Error('OpenAI API key is required');
    }

    try {
      const response = await fetch(`${this.baseURL}/embeddings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: config.openai.embeddingModel,
          input: text,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'Failed to generate embedding');
      }

      const data = await response.json();
      return data.data[0].embedding;
    } catch (error) {
      console.error('Error generating embedding:', error);
      throw error;
    }
  }

  async generateResponse(
    messages: Message[],
    context: string,
    settings: {
      temperature: number;
      maxTokens: number;
    }
  ): Promise<{ response: string; reasoning: ReasoningData }> {
    return this.generateQuickResponse(messages, context, settings);
  }

  async generateQuickResponse(
    messages: Message[],
    context: string,
    settings: {
      temperature: number;
      maxTokens: number;
    }
  ): Promise<{ response: string; reasoning: ReasoningData }> {
    if (!this.apiKey) {
      throw new Error('OpenAI API key is required');
    }

    console.log('Generating response with context:', context.substring(0, 100) + '...');

    try {
      const systemMessage = {
        role: 'system' as const,
        content: `You are an expert cybersecurity and AI knowledge tutor helping junior security and sales staff. Your role is to provide comprehensive, step-by-step guidance that serves as a "paint-by-number" guide for novices.

${context.includes('No specific context available') 
  ? 'No specific knowledge base context is available, so provide detailed general guidance based on cybersecurity and AI best practices from your training.'
  : `Use the following context from our knowledge base to answer questions about different AI models, their features, performance, and comparisons.

Context from knowledge base:
${context}`}

REQUIRED RESPONSE STRUCTURE:
1. **Summary:** Start with 1-2 sentences explaining what you'll help them accomplish
2. **Detailed Steps:** Provide numbered steps (1., 2., 3., etc.) with 3-5 sentences per step explaining:
   - What to do specifically
   - Why this step is important
   - How to perform the action
   - What to expect as a result
3. **Verification Checklist:** Include a section with markdown checkboxes (- [ ]) listing key items to verify
4. **Example Scenario:** Provide a concrete example showing how someone would apply these steps
5. **Template (when applicable):** If the solution involves creating documents, provide a template with placeholder instructions

TONE REQUIREMENTS:
- Write as if coaching a junior employee through their first time
- Use encouraging, patient language
- Explain the reasoning behind each step
- Be thorough and detailed - verbosity is preferred over brevity
- Use specific, actionable language

Remember: Your audience needs comprehensive guidance with examples and verification methods. Never assume prior knowledge.`,
      };

      const conversationMessages = messages.map(msg => ({
        role: msg.role,
        content: msg.content,
      }));

      console.log('Sending request to OpenAI...');

      const response = await fetch(`${this.baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: config.openai.chatModel,
          messages: [systemMessage, ...conversationMessages],
          temperature: settings.temperature,
          max_tokens: Math.max(settings.maxTokens, 2000),
        }),
      });

      if (!response.ok) {
        console.error('OpenAI API error:', response.status, response.statusText);
        const error = await response.json();
        console.error('OpenAI API error details:', error);
        throw new Error(error.error?.message || 'Failed to generate response');
      }

      const data = await response.json();
      const responseText = data.choices[0].message.content;

      console.log('Received response from OpenAI:', responseText.substring(0, 100) + '...');

      const reasoning: ReasoningData = {
        retrievedChunks: context && !context.includes('No specific context available') ? [
          {
            content: context.substring(0, 200) + '...',
            source: 'Knowledge Base',
            similarity: 0.85,
          }
        ] : [{
          content: 'No knowledge base context available',
          source: 'General AI Knowledge', 
          similarity: 0,
        }],
        processingTime: Date.now(),
        tokensUsed: data.usage?.total_tokens || 0,
        model: config.openai.chatModel,
        orchestrationMode: false,
      };

      return {
        response: responseText,
        reasoning,
      };
    } catch (error) {
      console.error('Error generating response:', error);
      throw error;
    }
  }

  async generateDetailedResponse(
    messages: Message[],
    context: string,
    settings: {
      temperature: number;
      maxTokens: number;
    }
  ): Promise<{ response: string; reasoning: ReasoningData }> {
    if (!this.apiKey) {
      throw new Error('OpenAI API key is required');
    }

    try {
      const systemMessage = {
        role: 'system' as const,
        content: `You are an expert cybersecurity and AI knowledge tutor creating comprehensive training manuals for junior security and sales staff.

${context.includes('No specific context available') 
  ? 'No specific knowledge base context is available, so provide a detailed general training manual based on your knowledge.'
  : `Use the following context from our knowledge base:

Context from knowledge base:
${context}`}

Create a comprehensive training manual that includes:

## Summary
- Brief overview of what the user will learn to accomplish (1-2 sentences)

## Step-by-Step Instructions
Provide numbered steps (1., 2., 3., etc.) with comprehensive explanations for each step:
- What to do specifically (with exact actions and commands)
- Why this step is important (context, security implications, business impact)
- How to perform the action (detailed instructions with screenshots descriptions)
- What to expect as a result (outcomes, indicators, success criteria)
- Common pitfalls to avoid and troubleshooting tips
- Best practices and security considerations

## Verification Checklist
Use markdown checkboxes (- [ ]) to list comprehensive verification items:
- Technical configuration points
- Security validation steps
- Quality assurance checks
- Compliance requirements
- Performance indicators

## Example Scenario
Provide a detailed, realistic example showing how a junior staff member would apply these steps:
- Character background and role
- Specific situation and requirements
- Step-by-step application with realistic details
- Challenges encountered and how they were resolved
- Final outcomes and lessons learned

## Templates and Artifacts
When applicable, provide templates for:
- Configuration files with detailed comments
- Report templates with section descriptions
- Checklists for ongoing maintenance
- Documentation templates
- Communication templates for stakeholders

## Implementation Timeline
- Suggested phases for implementation
- Dependencies and prerequisites
- Estimated timeframes
- Resource requirements

## Additional Resources
- Related documentation
- Training materials
- Tools and utilities
- Contact information for support

TONE: Write as a comprehensive instructor manual. Be extremely thorough, patient, and encouraging. Assume the reader is learning this for the first time. Include practical wisdom and real-world insights throughout.`,
      };

      const conversationMessages = messages.map(msg => ({
        role: msg.role,
        content: msg.content,
      }));

      const response = await fetch(`${this.baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: config.openai.chatModel,
          messages: [systemMessage, ...conversationMessages],
          temperature: settings.temperature,
          max_tokens: settings.maxTokens,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'Failed to generate detailed response');
      }

      const data = await response.json();
      const responseText = data.choices[0].message.content;

      const reasoning: ReasoningData = {
        retrievedChunks: context && !context.includes('No specific context available') ? [
          {
            content: context.substring(0, 200) + '...',
            source: 'Knowledge Base',
            similarity: 0.85,
          }
        ] : [{
          content: 'No knowledge base context available',
          source: 'General AI Knowledge', 
          similarity: 0,
        }],
        processingTime: Date.now(),
        tokensUsed: data.usage?.total_tokens || 0,
        model: config.openai.chatModel,
        orchestrationMode: false,
      };

      return {
        response: responseText,
        reasoning,
      };
    } catch (error) {
      console.error('Error generating detailed response:', error);
      throw error;
    }
  }

  async orchestrateQuery(query: string): Promise<string[]> {
    if (!this.apiKey) {
      throw new Error('OpenAI API key is required');
    }

    try {
      const response = await fetch(`${this.baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: config.openai.chatModel,
          messages: [
            {
              role: 'system',
              content: `You are a query orchestrator that breaks down complex questions about AI models into focused subtopics for parallel research.

Your task is to analyze the user's question and decompose it into 3-7 specific, focused subtopics that can be researched independently. Each subtopic should:
- Be specific and actionable for information retrieval
- Cover a distinct aspect of the original question
- Be suitable for parallel processing
- Together, comprehensively address the original question

Return ONLY a JSON array of strings, where each string is a focused subtopic. No additional text or explanation.

Example:
["Compare GPT-4 and Claude performance metrics", "Analyze cost differences between OpenAI and Anthropic models", "Evaluate use cases where each model excels"]`
            },
            {
              role: 'user',
              content: query
            }
          ],
          temperature: 0.3,
          max_tokens: 500,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to orchestrate query');
      }

      const data = await response.json();
      const content = data.choices[0].message.content.trim();
      
      try {
        const subtopics = JSON.parse(content);
        if (Array.isArray(subtopics) && subtopics.length > 0) {
          return subtopics.slice(0, 7);
        }
      } catch (parseError) {
        console.error('Failed to parse orchestration response:', parseError);
      }
      
      return [query];
    } catch (error) {
      console.error('Error orchestrating query:', error);
      return [query];
    }
  }

  async synthesizeResponse(
    originalQuery: string,
    subtopicResults: Array<{
      subtopic: string;
      chunks: Array<{ content: string; source: string; similarity: number }>;
    }>,
    conversationHistory: Message[],
    settings: { temperature: number; maxTokens: number }
  ): Promise<{ response: string; tokensUsed: number }> {
    return this.synthesizeQuickResponse(originalQuery, subtopicResults, conversationHistory, settings);
  }

  async synthesizeQuickResponse(
    originalQuery: string,
    subtopicResults: Array<{
      subtopic: string;
      chunks: Array<{ content: string; source: string; similarity: number }>;
    }>,
    conversationHistory: Message[],
    settings: { temperature: number; maxTokens: number }
  ): Promise<{ response: string; tokensUsed: number }> {
    if (!this.apiKey) {
      throw new Error('OpenAI API key is required');
    }

    const combinedContext = subtopicResults
      .map(result => {
        const chunks = result.chunks
          .map(chunk => `[Source: ${chunk.source}] ${chunk.content}`)
          .join('\n\n');
        return `## ${result.subtopic}\n${chunks}`;
      })
      .join('\n\n---\n\n');

    try {
      const systemMessage = {
        role: 'system' as const,
        content: `You are an expert cybersecurity and AI knowledge tutor creating detailed step-by-step guides from multiple research subtopics.

Create a comprehensive guide that includes:

## Summary
- Brief overview of what you'll help them accomplish (1-2 sentences)

## Step-by-Step Instructions
Provide numbered steps (1., 2., 3., etc.) with detailed explanations:
- What to do specifically
- Why this step is important
- How to perform the action
- What to expect as a result

## Verification Checklist
Use markdown checkboxes (- [ ]) to list key verification items

## Example Scenario
Provide a concrete example showing how someone would apply these steps

## Template (when applicable)
If the solution involves creating documents, provide a template

Original Question: ${originalQuery}

Research Results:
${combinedContext}

TONE: Write as if coaching a junior employee through their first time. Be thorough, patient, and encouraging.`,
      };

      const conversationMessages = conversationHistory.slice(-3).map(msg => ({
        role: msg.role,
        content: msg.content,
      }));

      const response = await fetch(`${this.baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: config.openai.chatModel,
          messages: [systemMessage, ...conversationMessages],
          temperature: settings.temperature,
          max_tokens: settings.maxTokens,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to synthesize response');
      }

      const data = await response.json();
      return {
        response: data.choices[0].message.content,
        tokensUsed: data.usage?.total_tokens || 0,
      };
    } catch (error) {
      console.error('Error synthesizing response:', error);
      throw error;
    }
  }

  async generateDetailedReport(
    originalQuery: string,
    subtopicResults: Array<{
      subtopic: string;
      chunks: Array<{ content: string; source: string; similarity: number }>;
    }>,
    conversationHistory: Message[],
    settings: { temperature: number; maxTokens: number }
  ): Promise<{ response: string; tokensUsed: number }> {
    if (!this.apiKey) {
      throw new Error('OpenAI API key is required');
    }

    const combinedContext = subtopicResults
      .map(result => {
        const chunks = result.chunks
          .map((chunk, index) => `### Source ${index + 1}: ${chunk.source}\n${chunk.content}\n**Relevance Score:** ${(chunk.similarity * 100).toFixed(1)}%`)
          .join('\n\n');
        return `# Research Area: ${result.subtopic}\n\n${chunks}`;
      })
      .join('\n\n---\n\n');

    try {
      const systemMessage = {
        role: 'system' as const,
        content: `You are an expert cybersecurity and AI knowledge tutor creating comprehensive training manuals for junior security and sales staff from multiple research subtopics.

Create a detailed training manual that includes:

## Summary
- Brief overview of what the user will learn to accomplish (1-2 sentences)

## Step-by-Step Instructions
Provide numbered steps (1., 2., 3., etc.) with comprehensive explanations for each step:
- What to do specifically (with exact actions and commands)
- Why this step is important (context, security implications, business impact)
- How to perform the action (detailed instructions with screenshots descriptions)
- What to expect as a result (outcomes, indicators, success criteria)
- Common pitfalls to avoid and troubleshooting tips
- Best practices and security considerations

## Verification Checklist
Use markdown checkboxes (- [ ]) to list comprehensive verification items:
- Technical configuration points
- Security validation steps
- Quality assurance checks
- Compliance requirements
- Performance indicators

## Example Scenario
Provide a detailed, realistic example showing how a junior staff member would apply these steps:
- Character background and role
- Specific situation and requirements
- Step-by-step application with realistic details
- Challenges encountered and how they were resolved
- Final outcomes and lessons learned

## Templates and Artifacts
When applicable, provide templates for:
- Configuration files with detailed comments
- Report templates with section descriptions
- Checklists for ongoing maintenance
- Documentation templates
- Communication templates for stakeholders

## Implementation Timeline
- Suggested phases for implementation
- Dependencies and prerequisites
- Estimated timeframes
- Resource requirements

## Additional Resources
- Related documentation
- Training materials
- Tools and utilities
- Contact information for support

Original Question: ${originalQuery}

Research Results:
${combinedContext}

TONE: Write as a comprehensive instructor manual. Be extremely thorough, patient, and encouraging. Assume the reader is learning this for the first time. Include practical wisdom and real-world insights throughout.`,
      };

      const conversationMessages = conversationHistory.slice(-3).map(msg => ({
        role: msg.role,
        content: msg.content,
      }));

      const response = await fetch(`${this.baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: config.openai.chatModel,
          messages: [systemMessage, ...conversationMessages],
          temperature: settings.temperature,
          max_tokens: Math.max(settings.maxTokens, 4000),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate detailed report');
      }

      const data = await response.json();
      return {
        response: data.choices[0].message.content,
        tokensUsed: data.usage?.total_tokens || 0,
      };
    } catch (error) {
      console.error('Error generating detailed report:', error);
      throw error;
    }
  }

  async testConnection(): Promise<boolean> {
    if (!this.apiKey) {
      return false;
    }

    try {
      const response = await fetch(`${this.baseURL}/models`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
      });

      return response.ok;
    } catch {
      return false;
    }
  }
}