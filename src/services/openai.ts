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

Create an extremely detailed and comprehensive training manual specifically designed for junior staff who are learning these concepts for the first time. Include extensive examples, real-world scenarios, and practical guidance:

## Summary
- Brief overview of what the user will learn to accomplish
- Learning objectives and expected outcomes
- Prerequisites and background knowledge needed

## Step-by-Step Instructions
Provide numbered steps (1., 2., 3., etc.) with extremely detailed explanations for each step:
- **What to do specifically**: Include exact actions, commands, button clicks, and navigation paths
- **Why this step is important**: Explain the context, security implications, business impact, and consequences of skipping
- **How to perform the action**: Provide detailed instructions as if describing to someone over the phone
- **What to expect as a result**: Describe expected outcomes, visual indicators, success criteria, and normal vs abnormal results
- **Multiple examples**: Provide 2-3 different scenarios showing how this step applies in various situations
- **Common mistakes**: List frequent errors junior staff make and how to avoid them
- **Troubleshooting**: Include "what if" scenarios and how to resolve common issues
- **Best practices**: Security considerations, efficiency tips, and professional standards
- **Real-world context**: Explain how this relates to actual job responsibilities

## Verification Checklist
Use markdown checkboxes (- [ ]) to create a comprehensive verification checklist:
- **Pre-implementation checks**: What to verify before starting
- **During implementation**: Checkpoints to validate progress
- **Post-implementation**: Final validation and testing steps
- **Security validation**: Specific security controls and compliance checks
- **Quality assurance**: Standards and quality metrics to meet
- **Documentation**: Required documentation and record-keeping
- **Stakeholder communication**: Who to notify and when

## Multiple Example Scenarios
Provide 2-3 detailed, realistic examples showing how junior staff would apply these steps:

### Scenario 1: [Basic Implementation]
- **Character background**: Junior staff member's role, experience level, and responsibilities
- **Situation**: Specific business context and requirements
- **Step-by-step walkthrough**: Detailed application with realistic dialogue and decision points
- **Challenges faced**: Common obstacles and how they were overcome
- **Results achieved**: Measurable outcomes and lessons learned
- **Manager feedback**: What supervisors would look for and evaluate

### Scenario 2: [Complex Implementation]
- **Advanced context**: More challenging situation with additional variables
- **Stakeholder interactions**: How to communicate with different departments
- **Problem-solving**: Critical thinking required and decision-making process
- **Escalation procedures**: When and how to seek help

### Scenario 3: [Edge Case/Problem Resolution]
- **Unusual circumstances**: When things don't go according to plan
- **Creative solutions**: Alternative approaches and workarounds
- **Learning opportunities**: How to turn problems into growth experiences

## Templates and Artifacts
Provide comprehensive templates with detailed instructions:
- **Configuration files**: Complete examples with line-by-line explanations
- **Report templates**: Professional formats with writing guidelines and examples
- **Email templates**: Communication scripts for different audiences (technical, management, clients)
- **Meeting agendas**: How to structure discussions and presentations
- **Incident response forms**: Step-by-step completion guides
- **Documentation standards**: Formatting, content requirements, and review processes
- **Presentation templates**: How to explain technical concepts to non-technical audiences

## Implementation Timeline
- **Phase-by-phase breakdown**: Detailed timeline with milestones
- **Dependencies and prerequisites**: What must be completed first
- **Realistic timeframes**: Conservative estimates for junior staff
- **Resource requirements**: People, tools, budget, and access needed
- **Risk factors**: What could cause delays and mitigation strategies
- **Success metrics**: How to measure progress and completion

## Common Use Cases and Applications
- **Primary use cases**: Most frequent scenarios where this knowledge applies
- **Secondary applications**: Less common but important situations
- **Industry-specific examples**: How this applies across different business contexts
- **Career development**: How mastering this contributes to professional growth
- **Cross-functional collaboration**: How this knowledge helps work with other teams

## Troubleshooting Guide
- **Common problems**: Frequent issues with detailed solutions
- **Error messages**: What they mean and how to resolve them
- **Performance issues**: How to identify and address bottlenecks
- **When to escalate**: Clear criteria for seeking supervisor help
- **Emergency procedures**: Critical situations and immediate response steps

## Knowledge Check and Self-Assessment
- **Key concepts review**: Summary of critical points to remember
- **Self-test questions**: Ways to verify understanding
- **Practical exercises**: Hands-on activities to reinforce learning
- **Competency indicators**: How to know when you've mastered the material

## Additional Resources
- **Reference documentation**: Links to official guides and standards
- **Advanced training**: Next-level courses and certifications
- **Tools and utilities**: Software, websites, and resources for ongoing work
- **Professional networks**: Communities, forums, and expert contacts
- **Continuing education**: How to stay current with evolving practices
- **Internal contacts**: Who to reach for different types of support
- **External resources**: Industry publications, conferences, and thought leaders

TONE AND APPROACH: 
- Write as a patient, experienced mentor training someone on their first day
- Be extremely thorough and assume zero prior knowledge
- Include encouraging language and confidence-building statements
- Use conversational explanations alongside technical details
- Provide context for why each piece of information matters
- Include "insider tips" and professional wisdom gained from experience
- Address common fears and concerns junior staff might have
- Emphasize learning from mistakes as part of professional growth
- Make complex topics accessible through analogies and simple explanations
- Focus on building both technical competence and professional confidence`,
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

Create an extremely detailed and comprehensive training manual specifically designed for junior staff who are learning these concepts for the first time. Include extensive examples, real-world scenarios, and practical guidance:

## Summary
- Brief overview of what the user will learn to accomplish
- Learning objectives and expected outcomes
- Prerequisites and background knowledge needed

## Step-by-Step Instructions
Provide numbered steps (1., 2., 3., etc.) with extremely detailed explanations for each step:
- **What to do specifically**: Include exact actions, commands, button clicks, and navigation paths
- **Why this step is important**: Explain the context, security implications, business impact, and consequences of skipping
- **How to perform the action**: Provide detailed instructions as if describing to someone over the phone
- **What to expect as a result**: Describe expected outcomes, visual indicators, success criteria, and normal vs abnormal results
- **Multiple examples**: Provide 2-3 different scenarios showing how this step applies in various situations
- **Common mistakes**: List frequent errors junior staff make and how to avoid them
- **Troubleshooting**: Include "what if" scenarios and how to resolve common issues
- **Best practices**: Security considerations, efficiency tips, and professional standards
- **Real-world context**: Explain how this relates to actual job responsibilities

## Verification Checklist
Use markdown checkboxes (- [ ]) to create a comprehensive verification checklist:
- **Pre-implementation checks**: What to verify before starting
- **During implementation**: Checkpoints to validate progress
- **Post-implementation**: Final validation and testing steps
- **Security validation**: Specific security controls and compliance checks
- **Quality assurance**: Standards and quality metrics to meet
- **Documentation**: Required documentation and record-keeping
- **Stakeholder communication**: Who to notify and when

## Multiple Example Scenarios
Provide 2-3 detailed, realistic examples showing how junior staff would apply these steps:

### Scenario 1: [Basic Implementation]
- **Character background**: Junior staff member's role, experience level, and responsibilities
- **Situation**: Specific business context and requirements
- **Step-by-step walkthrough**: Detailed application with realistic dialogue and decision points
- **Challenges faced**: Common obstacles and how they were overcome
- **Results achieved**: Measurable outcomes and lessons learned
- **Manager feedback**: What supervisors would look for and evaluate

### Scenario 2: [Complex Implementation]
- **Advanced context**: More challenging situation with additional variables
- **Stakeholder interactions**: How to communicate with different departments
- **Problem-solving**: Critical thinking required and decision-making process
- **Escalation procedures**: When and how to seek help

### Scenario 3: [Edge Case/Problem Resolution]
- **Unusual circumstances**: When things don't go according to plan
- **Creative solutions**: Alternative approaches and workarounds
- **Learning opportunities**: How to turn problems into growth experiences

## Templates and Artifacts
Provide comprehensive templates with detailed instructions:
- **Configuration files**: Complete examples with line-by-line explanations
- **Report templates**: Professional formats with writing guidelines and examples
- **Email templates**: Communication scripts for different audiences (technical, management, clients)
- **Meeting agendas**: How to structure discussions and presentations
- **Incident response forms**: Step-by-step completion guides
- **Documentation standards**: Formatting, content requirements, and review processes
- **Presentation templates**: How to explain technical concepts to non-technical audiences

## Implementation Timeline
- **Phase-by-phase breakdown**: Detailed timeline with milestones
- **Dependencies and prerequisites**: What must be completed first
- **Realistic timeframes**: Conservative estimates for junior staff
- **Resource requirements**: People, tools, budget, and access needed
- **Risk factors**: What could cause delays and mitigation strategies
- **Success metrics**: How to measure progress and completion

## Common Use Cases and Applications
- **Primary use cases**: Most frequent scenarios where this knowledge applies
- **Secondary applications**: Less common but important situations
- **Industry-specific examples**: How this applies across different business contexts
- **Career development**: How mastering this contributes to professional growth
- **Cross-functional collaboration**: How this knowledge helps work with other teams

## Troubleshooting Guide
- **Common problems**: Frequent issues with detailed solutions
- **Error messages**: What they mean and how to resolve them
- **Performance issues**: How to identify and address bottlenecks
- **When to escalate**: Clear criteria for seeking supervisor help
- **Emergency procedures**: Critical situations and immediate response steps

## Knowledge Check and Self-Assessment
- **Key concepts review**: Summary of critical points to remember
- **Self-test questions**: Ways to verify understanding
- **Practical exercises**: Hands-on activities to reinforce learning
- **Competency indicators**: How to know when you've mastered the material

## Additional Resources
- **Reference documentation**: Links to official guides and standards
- **Advanced training**: Next-level courses and certifications
- **Tools and utilities**: Software, websites, and resources for ongoing work
- **Professional networks**: Communities, forums, and expert contacts
- **Continuing education**: How to stay current with evolving practices
- **Internal contacts**: Who to reach for different types of support
- **External resources**: Industry publications, conferences, and thought leaders

Original Question: ${originalQuery}

Research Results:
${combinedContext}

TONE AND APPROACH: 
- Write as a patient, experienced mentor training someone on their first day
- Be extremely thorough and assume zero prior knowledge
- Include encouraging language and confidence-building statements
- Use conversational explanations alongside technical details
- Provide context for why each piece of information matters
- Include "insider tips" and professional wisdom gained from experience
- Address common fears and concerns junior staff might have
- Emphasize learning from mistakes as part of professional growth
- Make complex topics accessible through analogies and simple explanations
- Focus on building both technical competence and professional confidence`,
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