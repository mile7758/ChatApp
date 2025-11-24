// Tavily配置接口
export interface TavilyConfig {
  apiKey?: string;
  endpoint?: string;
}

// Tavily搜索结果接口
export interface TavilySearchResult {
  query: string;
  answer: string;
  results: Array<{
    title: string;
    url: string;
    content: string;
    score: number;
  }>;
}

// Tavily客户端类
export class TavilyClient {
  private config: TavilyConfig;

  constructor(config: Partial<TavilyConfig> = {}) {
    this.config = {
      endpoint: 'https://api.tavily.com/search',
      ...config
    };
  }

  /**
   * 执行搜索
   * @param query 搜索查询
   * @param maxResults 最大结果数
   * @param searchDepth 搜索深度 ('basic' 或 'advanced')
   * @returns 搜索结果
   */
  async search(
    query: string,
    maxResults: number = 5,
    searchDepth: 'basic' | 'advanced' = 'basic'
  ): Promise<TavilySearchResult> {
    if (!this.config.apiKey) {
      throw new Error('Tavily API key is not configured');
    }

    const requestBody = {
      query,
      max_results: maxResults,
      search_depth: searchDepth,
      include_answer: true,
      include_images: false,
      include_raw_content: false
    };

    const response = await fetch(this.config.endpoint!, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Tavily API request failed: ${response.status} - ${errorText}`);
    }

    return response.json() as Promise<TavilySearchResult>;
  }

  /**
   * 执行基本搜索（快捷方法）
   * @param query 搜索查询
   * @returns 搜索结果
   */
  async basicSearch(query: string): Promise<TavilySearchResult> {
    return this.search(query, 5, 'basic');
  }

  /**
   * 执行高级搜索（快捷方法）
   * @param query 搜索查询
   * @returns 搜索结果
   */
  async advancedSearch(query: string): Promise<TavilySearchResult> {
    return this.search(query, 10, 'advanced');
  }
}

// 创建并导出Tavily客户端实例
export const tavilyClient = new TavilyClient({
  apiKey: process.env.TAVILY_API_KEY
});
