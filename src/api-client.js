import { buildEndpoint } from './config.js';

function extractThinking(text) {
  const match = text.match(/<think>([\s\S]*?)<\/think>/);
  if (match) {
    return {
      thinking: match[1].trim(),
      answer: text.replace(/<think>[\s\S]*?<\/think>/, '').trim()
    };
  }
  return { thinking: '', answer: text };
}

export async function callApi(config, question, onChunk) {
  const endpoint = buildEndpoint(config.provider.baseUrl);
  const body = {
    model: config.provider.model,
    messages: [
      { role: 'system', content: config.settings.systemPrompt },
      { role: 'user', content: question }
    ],
    stream: config.provider.stream
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), config.settings.timeout * 1000);

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.provider.apiKey}`
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => res.statusText);
      throw new Error(`API ${res.status}: ${errText}`);
    }

    if (config.provider.stream) {
      try {
        return await handleStream(res, onChunk);
      } catch (streamErr) {
        if (streamErr.message === 'STREAM_FALLBACK') {
          config.provider.stream = false;
          return callApi(config, question, onChunk);
        }
        throw streamErr;
      }
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content || '';
    const result = extractThinking(content);
    return { ...result, error: null };
  } catch (err) {
    if (err.name === 'AbortError') {
      return { thinking: '', answer: '', error: 'TIMEOUT' };
    }
    return { thinking: '', answer: '', error: err.message };
  } finally {
    clearTimeout(timeoutId);
  }
}

async function handleStream(res, onChunk) {
  let thinking = '';
  let answer = '';
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith('data:')) continue;
      const dataStr = trimmed.slice(5).trim();
      if (dataStr === '[DONE]') continue;

      let parsed;
      try {
        parsed = JSON.parse(dataStr);
      } catch {
        continue;
      }

      const delta = parsed.choices?.[0]?.delta;
      if (!delta) continue;

      // Handle different thinking formats
      if (delta.reasoning_content) {
        thinking += delta.reasoning_content;
      } else if (delta.thinking) {
        thinking += delta.thinking;
      } else if (delta.content) {
        answer += delta.content;
      }

      if (onChunk) {
        onChunk({ thinking, answer, done: false });
      }
    }
  }

  // Post-process: check for <think> tags in answer
  if (!thinking && answer) {
    const extracted = extractThinking(answer);
    thinking = extracted.thinking;
    answer = extracted.answer;
  }

  if (onChunk) onChunk({ thinking, answer, done: true });
  return { thinking, answer, error: null };
}
