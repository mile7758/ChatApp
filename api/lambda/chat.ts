import { interestCoachClient, VolcanoMessage } from './volcanoClient';
import {
  createConversation,
  getConversationById,
  updateConversation
} from './mongodb/conversationService';

// 兴趣教练的system prompt
const SYSTEM_PROMPT = `角色:
你是一名专业的教练，擅长根据用户的兴趣设定目标并提供指导。

目标:
- 根据用户输入的兴趣，帮助用户设定清晰且可行的方案目标。
- 在用户日常对话或提问时，提供简单且切实可行的回答。

技能:
- 分析用户兴趣并提取关键点。
- 制定适合用户需求的方案目标。
- 提供清晰、简洁且实用的建议。
- 可以使用联网搜索工具，获取更多的信息。

工作流程:
1. 理解用户兴趣：
   - 分析用户输入的兴趣点，识别主要需求和目标。
   - 根据用户兴趣的范围和深度，确定适合的目标类型。
2. 设定方案目标：
   - 根据用户兴趣，提供可操作性强、具体且符合用户背景的目标设定。
   - 确保目标具有明确的时间框架和可衡量的标准。
3. 回答用户问题：
   - 在日常对话或用户提问时，提供针对性强的回答。
   - 回答需简单明了，并且能切实帮助用户实现目标。
4. 持续调整与优化：
   - 根据用户的反馈，调整目标和建议以更好地满足用户需求。
   - 提供鼓励和指导，帮助用户保持动力。

约束:
- 必须根据用户输入的兴趣设定目标，不能随意设定与用户兴趣无关的目标。
- 回答必须简单且可行，不能提供复杂或难以执行的建议。
- 目标设定需具体且具有可衡量性，避免模糊不清。

输出格式:
- 目标设定：以清晰的文字描述用户的方案目标，包含时间框架和衡量标准。
- 回答：针对用户的具体问题，提供简洁实用的建议。
- 文字风格：友好、鼓励、清晰。

示例:
示例一：
输入：我对健康饮食很感兴趣，希望能制定一个相关的目标
输出：目标设定：结合你的兴趣，建议设定一个目标为“每天坚持记录饮食，并每周至少尝试一种新的健康食材”。这个目标可以在一个月内完成，并通过记录的饮食变化来衡量效果。回答：你可以从选择一种你喜欢的健康食材开始，比如西兰花或藜麦，尝试简单的烹饪方式，比如蒸煮或沙拉搭配。这样既简单又容易坚持。

示例二：
输入：我想培养阅读习惯，能帮我制定一个目标吗？
输出：目标设定：建议设定一个目标为“每天阅读至少10页书籍，并在一个月内完成一本书的阅读”。通过记录每天的阅读页数和完成的书籍数量来衡量效果。回答：你可以从选择一本你感兴趣的书开始，比如小说或自我提升类书籍，每天安排固定的时间阅读，比如睡前30分钟。这样既能培养习惯，又能放松心情。`;

//转换消息格式
function convertToVolcanoMessages(history: any[]): VolcanoMessage[] {
  return history.map(item => ({
    role: item.sender === 'user' ? 'user' : 'assistant',
    content: item.content
  }));
}

//生成器函数
async function* volcanoModelResponse(prompt: string, history: any[] = []): AsyncGenerator<string> {
  try {
    console.log('准备调用火山云模型...');
    const volcanoMessages = convertToVolcanoMessages(history);
    volcanoMessages.push({ role: 'user', content: prompt });
    console.log('处理消息:', { systemPrompt: SYSTEM_PROMPT, messages: volcanoMessages });

    //存储响应块
    const chunkQueue: string[] = [];
    let isDone = false;
    let error: Error | null = null;

    //协调异步流
    const streamResolve = new Promise<void>((resolve, reject) => {
      const streamPromise = interestCoachClient.streamChat(
        SYSTEM_PROMPT,
        volcanoMessages,
        {
          onChunk: (chunk: string) => {
            console.log('收到模型响应块:', chunk);
            if (chunk && chunk.trim()) {
              chunkQueue.push(chunk);
            }
          },
          onComplete: () => {
            console.log('模型响应完成');
            isDone = true;
            resolve();
          },
          onError: (err: Error) => {
            console.error('模型调用错误:', err);
            error = err;
            isDone = true;
            reject(err);
          }
        }
      );

      // 启动流式请求 异步
      streamPromise.catch(() => {});
    });

    const maxWaitTime = 60000;
    const startTime = Date.now();

    while (!isDone || chunkQueue.length > 0) {
      if (Date.now() - startTime > maxWaitTime) {
        throw new Error('响应超时');
      }

      if (chunkQueue.length > 0) {
        const chunk = chunkQueue.shift()!;
        for (let i = 0; i < chunk.length; i++) {
          yield chunk[i];
          await new Promise(resolve => setTimeout(resolve, 20));
        }
      } else {
        if (!isDone) {
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      }
    }

    try {
      await streamResolve;
    } catch (e) {}

    if (error) {
      throw error;
    }
  } catch (error) {
    console.error('调用火山云模型时出错:', error);
    const errorMessage = '抱歉，我暂时无法处理你的请求。请稍后再试。';
    for (const char of errorMessage) {
      yield char;
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }
}

//SSE响应
function formatSSEData(data: any): string {
  return `data: ${JSON.stringify(data)}

`;
}

//BFF参数类型
type RequestOption<Q = Record<string, any>, D = Record<string, any>> = {
  query?: Q;
  data?: D;
};

//处理GET
export const get = async ({
  query,
}: RequestOption<{ message?: string; history?: string; conversationId?: string }, never>) => {
  console.log('=== GET handler 被调用 ===');
  console.log('Query params:', query);

  try {
    const prompt = query?.message || '';
    const historyStr = query?.history || '[]';
    const conversationId = query?.conversationId || '';

    let history: any[] = [];
    try {
      history = JSON.parse(historyStr);
    } catch (parseError) {
      console.error('解析历史记录失败:', parseError);
      history = [];
    }

    console.log('解析的参数:', { prompt, historyStr, conversationId });
    console.log('收到请求:', { prompt, history, conversationId });

    if (!prompt || typeof prompt !== 'string') {
      return {
        type: 'error',
        error: '缺少有效的prompt参数',
      };
    }

    const chunks: string[] = [];
    const responseGenerator = volcanoModelResponse(prompt, history);

    try {
      for await (const chunk of responseGenerator) {
        chunks.push(chunk);
      }

      const fullResponse = chunks.join('');

      if (conversationId) {
        try {
          const userMessage = {
            id: `msg_${Date.now()}_user`,
            sender: 'user' as const,
            content: prompt,
            timestamp: new Date(),
          };

          const assistantMessage = {
            id: `msg_${Date.now()}_assistant`,
            sender: 'assistant' as const,
            content: fullResponse,
            timestamp: new Date(),
          };

          const existingConversation = await getConversationById(conversationId);

          if (existingConversation) {
            await updateConversation(
              conversationId,
              assistantMessage,
              existingConversation.title
            );
          } else {
            await createConversation(
              conversationId,
              prompt.substring(0, 20) + (prompt.length > 20 ? '...' : ''),
              userMessage
            );
            await updateConversation(
              conversationId,
              assistantMessage
            );
          }
          console.log('对话已保存到MongoDB:', conversationId);
        } catch (dbError) {
          console.error('保存对话到MongoDB失败:', dbError);
        }
      }

      return {
        type: 'success',
        content: fullResponse,
      };
    } catch (error) {
      console.error('生成响应时出错:', error);
      return {
        type: 'error',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  } catch (error) {
    console.error('处理请求时出错:', error);
    return {
      type: 'error',
      error: error instanceof Error ? error.message : String(error),
    };
  }
};

// 处理POST
export const post = async ({
  query,
  data,
}: RequestOption<{ history?: string; conversationId?: string }, { message?: string }>) => {
  console.log('=== POST handler 被调用 ===');
  console.log('Query:', query);
  console.log('Data:', data);

  const prompt = data?.message || '';
  const historyStr = query?.history || '[]';
  const conversationId = query?.conversationId || '';

  return get({
    query: {
      ...query,
      message: prompt,
      conversationId
    },
    data: undefined as never
  });
};

