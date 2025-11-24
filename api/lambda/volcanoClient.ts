// 火山云配置接口
export interface VolcanoConfig {
  apiKey?: string;
  apiSecret?: string;
  endpoint: string;
  model?: string;
}

// 消息格式接口
export interface VolcanoMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// 流式响应选项
interface StreamOptions {
  onChunk: (chunk: string) => void;
  onComplete?: () => void;
  onError?: (error: Error) => void;
}

/**
 * 火山云模型客户端类
 * 用于与火山云大模型API交互
 */
export class VolcanoClient {
  private config: VolcanoConfig;

  /**
   * 构造函数
   * @param config 火山云API配置
   */
  constructor(config: Partial<VolcanoConfig> = {}) {
    this.config = {
      // 默认配置，如果用户不提供可以使用默认值
      endpoint: 'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
      model: process.env.ARK_MODEL || 'doubao-seed-1-6-251015', // 默认模型
      ...config
    };
  }

  /**
   * 创建请求头
   */
  private createHeaders(): Record<string, string> {
    // 使用Bearer Token认证方式，符合官方API示例
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.config.apiKey}`
    };
  }

  /**
   * 带重试机制的请求执行
   */
  private async withRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
    let lastError: Error;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.log(`请求失败，${attempt + 1}/${maxRetries}次尝试，错误:`, lastError.message);

        // 指数退避
        const delay = Math.pow(2, attempt) * 1000 + Math.random() * 500;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError!;
  }

  /**
   * 发送流式请求到火山云模型API
   * @param systemPrompt 系统提示
   * @param messages 消息列表
   * @param options 流式选项
   */
  async streamChat(
    systemPrompt: string,
    messages: VolcanoMessage[],
    options: StreamOptions
  ): Promise<void> {
    await this.withRetry(async () => {
      // 构建完整的消息列表，包含系统提示
      const fullMessages: VolcanoMessage[] = [
        { role: 'system', content: systemPrompt },
        ...messages
      ];

      // 实际环境中的请求体结构 - 符合官方API示例
      const requestBody = {
        model: this.config.model || 'doubao-seed-1-6-251015', // 默认模型
        messages: fullMessages,
        stream: true,
        temperature: 0.7,
        max_tokens: 1000,
        top_p: 0.95
      };

      // 发送真实的HTTP请求
      const response = await fetch(this.config.endpoint, {
        method: 'POST',
        headers: this.createHeaders(),
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        throw new Error(`API请求失败: ${response.status} ${await response.text()}`);
      }

      // 处理流式响应
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('无法获取响应流');
      }

      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        // 解析SSE格式的响应
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
              // 提取内容并传递给回调
              if (data.choices && data.choices[0] && data.choices[0].delta?.content) {
                options.onChunk(data.choices[0].delta.content);
              }
            } catch (parseError) {
              console.error('解析响应失败:', parseError, '原始数据:', line);
            }
          }
        }
      }

      // 确保完成回调被调用
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


  /**
   * 同步聊天方法
   * @param systemPrompt 系统提示
   * @param messages 消息列表
   * @returns 响应消息
   */
  async chat(
    systemPrompt: string,
    messages: VolcanoMessage[]
  ): Promise<string> {
    return this.withRetry(async () => {
      // 构建完整的消息列表，包含系统提示
      const fullMessages: VolcanoMessage[] = [
        { role: 'system', content: systemPrompt },
        ...messages
      ];

      // 非流式请求体结构
      const requestBody = {
        model: this.config.model || 'doubao-lite-4k',
        messages: fullMessages,
        temperature: 0.7,
        max_tokens: 1000,
        top_p: 0.95
      };

      // 发送HTTP请求
      const response = await fetch(this.config.endpoint, {
        method: 'POST',
        headers: this.createHeaders(),
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        throw new Error(`API请求失败: ${response.status} ${await response.text()}`);
      }

      const data = await response.json();

      // 提取响应内容
      if (data.choices && data.choices[0] && data.choices[0].message?.content) {
        return data.choices[0].message.content;
      }

      throw new Error('API返回格式异常，未找到响应内容');
    });
  }


}

/**
 * 创建火山云客户端实例
 * @param config 配置选项
 * @returns 客户端实例
 */
export function createVolcanoClient(config?: Partial<VolcanoConfig>): VolcanoClient {
  // 从环境变量获取API密钥 - 使用与Python示例相同的环境变量名ARK_API_KEY
  // 使用BEARER TOKEN认证，符合官方API示例
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

/**
 * 简化的API调用接口，更接近Python SDK的使用方式
 */
export const Ark = {
  /**
   * 创建客户端实例
   * @param api_key API密钥
   * @returns 客户端实例
   */
  create: (api_key?: string) => {
    return {
      chat: {
        completions: {
          /**
           * 创建聊天完成（非流式）
           * @param params 请求参数
           */
          create: async (params: {
            model: string;
            messages: Array<{role: string; content: string}>;
            temperature?: number;
            max_tokens?: number;
          }) => {
            // 创建临时客户端实例
            const clientConfig: Partial<VolcanoConfig> = {
              apiKey: api_key || process.env.ARK_API_KEY || '',
              model: params.model
            };
            const client = new VolcanoClient(clientConfig);

            // 转换消息格式
            const volcanoMessages: VolcanoMessage[] = params.messages.map(msg => ({
              role: msg.role as 'system' | 'user' | 'assistant',
              content: msg.content
            }));

            // 默认system prompt
            const systemPrompt = 'You are a helpful assistant.';

            // 调用非流式接口
            const content = await client.chat(systemPrompt, volcanoMessages);

            // 返回类似Python SDK的响应格式
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

// 导出预设的兴趣教练模型客户端
export const interestCoachClient = createVolcanoClient();

