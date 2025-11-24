import { Helmet } from '@modern-js/runtime/head';
import { useState, useRef, useEffect } from 'react';
import { get as chatApi } from '@api/chat';
import './index.css';


interface Message {
  id: string;
  content: string;
  sender: 'user' | 'assistant';
  timestamp: string; // 改为字符串存储，便于localStorage序列化
}

// 本地存储的键名
const STORAGE_KEY = 'chat_messages_history';
// 最大历史消息数量
const MAX_HISTORY_MESSAGES = 50;

const ChatApp = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // 从localStorage加载历史消息
  useEffect(() => {
    const loadHistory = () => {
      try {
        const savedMessages = localStorage.getItem(STORAGE_KEY);
        if (savedMessages) {
          const parsedMessages = JSON.parse(savedMessages);
          setMessages(parsedMessages);
        }
      } catch (error) {
        console.error('加载聊天历史失败:', error);
      }
    };

    loadHistory();
    scrollToBottom();

    // 清理函数
    return () => {
      // 清理工作（如果需要）
    };
  }, []);

  // 保存消息到localStorage
  useEffect(() => {
    if (messages.length > 0) {
      try {
        // 限制历史消息数量，防止localStorage过大
        const messagesToSave = messages.slice(-MAX_HISTORY_MESSAGES);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(messagesToSave));
      } catch (error) {
        console.error('保存聊天历史失败:', error);
      }
    }
  }, [messages]);

  // 监听消息变化，自动滚动到底部
  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  // 实现打字机效果的函数
  const typeMessage = (messageId: string, fullContent: string) => {
    let currentIndex = 0;

    // 创建助手消息并添加到列表（第一个字符时）
    const assistantMessage: Message = {
      id: messageId,
      content: '',
      sender: 'assistant',
      timestamp: new Date().toISOString(),
    };
    
    // 添加助手消息到列表
    setMessages(prev => [...prev, assistantMessage]);

    // 更新消息内容，逐字符显示
    const typeInterval = setInterval(() => {
      if (currentIndex <= fullContent.length) {
        setMessages(prev => prev.map(msg =>
          msg.id === messageId
            ? { ...msg, content: fullContent.substring(0, currentIndex) }
            : msg
        ));
        currentIndex++;
      } else {
        clearInterval(typeInterval);
        setIsTyping(false);
      }
    }, 20); // 每20毫秒显示一个字符

    return () => clearInterval(typeInterval);
  };

  const handleSend = async () => {
    if (!inputValue.trim()) return;

    const userMessage: Message = {
      id: `msg_${Date.now()}_user`,
      content: inputValue.trim(),
      sender: 'user',
      timestamp: new Date().toISOString(),
    };

    const assistantMessageId = `msg_${Date.now()}_assistant`;
    
    // 只添加用户消息，设置isTyping状态
    setMessages(prev => [...prev, userMessage]);
    const messageToSend = inputValue.trim();
    setInputValue('');
    setIsTyping(true);

    try {
      // 准备历史记录参数，只发送最近的5条消息作为上下文
      const historyToSend = [...messages].slice(-5).map(msg => ({
        sender: msg.sender,
        content: msg.content
      }));

      console.log('调用 BFF 函数:', { message: messageToSend, history: historyToSend });

      // 调用 Modern.js BFF 函数
      const result = await chatApi({
        query: {
          message: messageToSend,
          history: JSON.stringify(historyToSend)
        }
      });

      console.log('BFF 函数返回:', result);
      
      if (result && result.type === 'success' && result.content) {
        // 使用打字机效果显示响应
        typeMessage(assistantMessageId, result.content);
      } else if (result && result.type === 'error') {
        setIsTyping(false);
        // 创建并添加错误消息
        const errorMessage: Message = {
          id: assistantMessageId,
          content: result.error || '抱歉，我暂时无法回复。请稍后再试。',
          sender: 'assistant',
          timestamp: new Date().toISOString(),
        };
        setMessages(prev => [...prev, errorMessage]);
      } else {
        setIsTyping(false);
        // 创建并添加错误消息
        const errorMessage: Message = {
          id: assistantMessageId,
          content: '抱歉，我暂时无法回复。请稍后再试。',
          sender: 'assistant',
          timestamp: new Date().toISOString(),
        };
        setMessages(prev => [...prev, errorMessage]);
      }
    } catch (error) {
      console.error('发送消息失败:', error);
      setIsTyping(false);
      
      // 创建并添加错误消息
      const errorMessage: Message = {
        id: assistantMessageId,
        content: '抱歉，发送消息失败。请稍后再试。',
        sender: 'assistant',
        timestamp: new Date().toISOString(),
      };
      
      setMessages(prev => [...prev, errorMessage]);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // 清除聊天历史
  const handleClearHistory = () => {
    if (window.confirm('确定要清除所有聊天历史吗？此操作不可撤销。')) {
      try {
        localStorage.removeItem(STORAGE_KEY);
        setMessages([]);
        console.log('聊天历史已清除');
      } catch (error) {
        console.error('清除聊天历史失败:', error);
      }
    }
  };

  // 监听消息变化，控制顶部栏显示
  useEffect(() => {
    const chatHeader = document.querySelector('.chat-header');
    if (messages.length > 0 && chatHeader) {
      // 延迟添加类以确保动画效果可见
      setTimeout(() => {
        chatHeader.classList.add('show-header');
      }, 100);
    } else if (messages.length === 0 && chatHeader) {
      chatHeader.classList.remove('show-header');
    }
  }, [messages.length]);

  return (
    <div className="chat-container">
      <Helmet>
        <link
          rel="icon"
          type="image/x-icon"
          href="https://lf3-static.bytednsdoc.com/obj/eden-cn/uhbfnupenuhf/favicon.ico"
        />
        <title>兴趣教练助手</title>
      </Helmet>
      <div className="chat-header">
        <div className="header-content">
          <div>
            <h1>兴趣教练助手</h1>
            <p>与AI兴趣教练对话，获取个性化建议</p>
          </div>
          <button
            className="clear-history-btn"
            onClick={handleClearHistory}
            disabled={messages.length === 0}
          >
            清除历史
          </button>
        </div>
      </div>
      <div className="chat-messages">
        {messages.length === 0 ? (
          <div className="empty-state">
            <p>你好，欢迎使用兴趣教练助手</p>
          </div>
        ) : (
          messages.map(message => (
            <div
              key={message.id}
              className={`message ${message.sender === 'user' ? 'user-message' : 'assistant-message'}`}
            >
              <div className={`message-bubble ${message.sender}`}>
                <p>{message.content}</p>
                <span className="message-time">
                  {new Date(message.timestamp).toLocaleTimeString()}
                </span>
              </div>
            </div>
          ))
        )}
        {isTyping && (
          <div className="message assistant-message">
            <div className="message-bubble assistant typing">
              <div className="typing-indicator">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      <div className="chat-input-container">
        <textarea
          className="chat-input"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="输入你的问题或想法..."
          disabled={isTyping}
        />
        <button
          className="send-button"
          onClick={handleSend}
          disabled={isTyping || !inputValue.trim()}
        >
          发送
        </button>
      </div>
    </div>
  );
};

export default ChatApp;
