//火山云配置接口
export interface VolcanoConfig {
  apiKey?: string;
  apiSecret?: string;
  endpoint: string;
  model?: string;
}

//格式接口
export interface VolcanoMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

//流式响应
interface StreamOptions {
  onChunk: (chunk: string) => void;
  onComplete?: () => void;
  onError?: (error: Error) => void;
}

//火山云模型客户端类
export class VolcanoClient {
  private config: VolcanoConfig;

  constructor(config: Partial<VolcanoConfig> = {}) {
    this.config = {
      endpoint: 'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
      model: process.env.ARK_MODEL || 'doubao-seed-1-6-251015', // 默认模型
      ...config
    };
  }

  private createHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.config.apiKey}`
    };
  }

  private async withRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
    let lastError: Error;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.log(`请求失败，${attempt + 1}/${maxRetries}次尝试，错误:`, lastError.message);

        const delay = Math.pow(2, attempt) * 1000 + Math.random() * 500;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError!;
  }

  //发送流式请求

  async streamChat(
    systemPrompt: string,
    messages: VolcanoMessage[],
    options: StreamOptions
  ): Promise<void> {
    await this.withRetry(async () => {
      const fullMessages: VolcanoMessage[] = [
        { role: 'system', content: systemPrompt },
        ...messages
      ];

      const requestBody = {
        model: this.config.model || 'doubao-seed-1-6-251015',
        messages: fullMessages,
        stream: true,
        temperature: 0.7,
        max_tokens: 1000,
        top_p: 0.95
      };

      const response = await fetch(this.config.endpoint, {
        method: 'POST',
        headers: this.createHeaders(),
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        throw new Error(`API请求失败: ${response.status} ${await response.text()}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('无法获取响应流');
      }

      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data:')) {
            try {
              const dataStr = line.substring(5).trim();
              if (dataStr === '[DONE]') {
                if (options.onComplete) {
                  options.onComplete();
                }
                break;
              }

              const data = JSON.parse(dataStr);
              if (data.choices && data.choices[0] && data.choices[0].delta?.content) {
                options.onChunk(data.choices[0].delta.content);
              }
            } catch (parseError) {
              console.error('解析响应失败:', parseError, '原始数据:', line);
            }
          }
        }
      }

      if (!response.bodyUsed && options.onComplete) {
        options.onComplete();
      }
    }).catch(error => {
      console.error('火山云API请求失败:', error);
      if (options.onError) {
        options.onError(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }


  //同步聊天
  async chat(
    systemPrompt: string,
    messages: VolcanoMessage[]
  ): Promise<string> {
    return this.withRetry(async () => {
      const fullMessages: VolcanoMessage[] = [
        { role: 'system', content: systemPrompt },
        ...messages
      ];

      const requestBody = {
        model: this.config.model || 'doubao-lite-4k',
        messages: fullMessages,
        temperature: 0.7,
        max_tokens: 1000,
        top_p: 0.95
      };

      const response = await fetch(this.config.endpoint, {
        method: 'POST',
        headers: this.createHeaders(),
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        throw new Error(`API请求失败: ${response.status} ${await response.text()}`);
      }

      const data = await response.json();

      if (data.choices && data.choices[0] && data.choices[0].message?.content) {
        return data.choices[0].message.content;
      }

      throw new Error('API返回格式异常，未找到响应内容');
    });
  }


}

//创建火山云客户端实例
export function createVolcanoClient(config?: Partial<VolcanoConfig>): VolcanoClient {
  if (!process.env.ARK_API_KEY) {
    console.warn('警告：未设置真实的API密钥，请设置ARK_API_KEY环境变量。');
  }

  const defaultConfig: VolcanoConfig = {
    apiKey: process.env.ARK_API_KEY || '',
    endpoint: 'https://ark.cn-beijing.volces.com/api/v3/chat/completions', // 官方推荐的端点
    model: process.env.ARK_MODEL || 'doubao-seed-1-6-251015' // 默认模型，可通过环境变量 ARK_MODEL 配置
  };

  return new VolcanoClient({ ...defaultConfig, ...config });
}

//API调用
export const Ark = {
  create: (api_key?: string) => {
    return {
      chat: {
        completions: {
          create: async (params: {
            model: string;
            messages: Array<{role: string; content: string}>;
            temperature?: number;
            max_tokens?: number;
          }) => {
            const clientConfig: Partial<VolcanoConfig> = {
              apiKey: api_key || process.env.ARK_API_KEY || '',
              model: params.model
            };
            const client = new VolcanoClient(clientConfig);
            const volcanoMessages: VolcanoMessage[] = params.messages.map(msg => ({
              role: msg.role as 'system' | 'user' | 'assistant',
              content: msg.content
            }));

            const systemPrompt = 'You are a helpful assistant.';
            const content = await client.chat(systemPrompt, volcanoMessages);

            return {
              choices: [{
                message: { content }
              }]
            };
          }
        }
      }
    };
  }
};

// 导出客户端
export const interestCoachClient = createVolcanoClient();

