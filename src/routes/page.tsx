import { Helmet } from '@modern-js/runtime/head';
import { useState, useRef, useEffect } from 'react';
import { get as chatApi } from '@api/chat';
import './index.css';


interface Message {
  id: string;
  content: string;
  sender: 'user' | 'assistant';
  timestamp: string;
}

interface Conversation {
  conversationId: string;
  title: string;
  lastMessage: string;
  timestamp: string;
  messages: Message[];
}

// 本地存储键名
const STORAGE_KEY_CONVERSATIONS = 'chat_conversations';
const STORAGE_KEY_CURRENT_CONVERSATION = 'current_conversation_id';

const MAX_HISTORY_MESSAGES = 50;

const ChatApp = () => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string>('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const generateConversationId = (): string => {
    return `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  };

  const currentConversation = conversations.find(conv => conv.conversationId === currentConversationId);

  const createNewConversation = () => {
    const newConversationId = generateConversationId();
    const newConversation: Conversation = {
      conversationId: newConversationId,
      title: '新对话',
      lastMessage: '',
      timestamp: new Date().toISOString(),
      messages: []
    };

    setConversations(prev => [newConversation, ...prev]);
    setCurrentConversationId(newConversationId);
    setMessages([]);
  };

  useEffect(() => {
    const loadConversations = () => {
      try {
        const savedConversations = localStorage.getItem(STORAGE_KEY_CONVERSATIONS);
        const savedCurrentId = localStorage.getItem(STORAGE_KEY_CURRENT_CONVERSATION);
        let parsedConversations: Conversation[] | null = null;

        if (savedConversations) {
          parsedConversations = JSON.parse(savedConversations) as Conversation[];
          setConversations(parsedConversations);
        }

        if (savedCurrentId) {
          setCurrentConversationId(savedCurrentId);
          const currentConv = parsedConversations?.find((conv: Conversation) => conv.conversationId === savedCurrentId);
          if (currentConv) {
            setMessages(currentConv.messages);
          }
        } else if (parsedConversations && parsedConversations.length > 0) {
          setCurrentConversationId(parsedConversations[0].conversationId);
          setMessages(parsedConversations[0].messages);
        }
      } catch (error) {
        console.error('加载对话历史失败:', error);
      }
    };

    loadConversations();
    scrollToBottom();

    return () => {};
  }, []);

  useEffect(() => {
    if (conversations.length > 0) {
      try {
        localStorage.setItem(STORAGE_KEY_CONVERSATIONS, JSON.stringify(conversations));
        if (currentConversationId) {
          localStorage.setItem(STORAGE_KEY_CURRENT_CONVERSATION, currentConversationId);
        }
      } catch (error) {
        console.error('保存对话历史失败:', error);
      }
    }
  }, [conversations, currentConversationId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const typeMessage = (messageId: string, fullContent: string) => {
    let currentIndex = 0;

    const typeInterval = setInterval(() => {
      if (currentIndex <= fullContent.length) {
        const currentContent = fullContent.substring(0, currentIndex);

        setMessages(prev => prev.map(msg =>
          msg.id === messageId
            ? { ...msg, content: currentContent }
            : msg
        ));

        setConversations(prev => prev.map(conv => {
          if (conv.conversationId === currentConversationId) {
            return {
              ...conv,
              messages: conv.messages.map(msg =>
                msg.id === messageId
                  ? { ...msg, content: currentContent }
                  : msg
              )
            };
          }
          return conv;
        }));

        currentIndex++;
      } else {
        clearInterval(typeInterval);
        setIsTyping(false);
      }
    }, 20);

    return () => clearInterval(typeInterval);
  };

  const updateConversationLastMessage = (conversationId: string, message: string) => {
    setConversations(prev => prev.map(conv => {
      if (conv.conversationId === conversationId) {
        return {
          ...conv,
          lastMessage: message,
          timestamp: new Date().toISOString()
        };
      }
      return conv;
    }));
  };

  const updateConversationTitle = (conversationId: string, title: string) => {
    setConversations(prev => prev.map(conv => {
      if (conv.conversationId === conversationId) {
        return {
          ...conv,
          title
        };
      }
      return conv;
    }));
  };

  const switchConversation = (conversationId: string) => {
    setCurrentConversationId(conversationId);
    const conv = conversations.find(c => c.conversationId === conversationId);
    if (conv) {
      setMessages([...conv.messages]);
    } else {
      console.error('未找到指定ID的对话:', conversationId);
      const savedConversations = localStorage.getItem(STORAGE_KEY_CONVERSATIONS);
      if (savedConversations) {
        const parsedConversations = JSON.parse(savedConversations) as Conversation[];
        const backupConv = parsedConversations.find(c => c.conversationId === conversationId);
        if (backupConv) {
          setMessages([...backupConv.messages]);
        }
      }
    }
  };

  const handleSend = async () => {
    if (!inputValue.trim()) return;

    let conversationId = currentConversationId;
    if (!conversationId) {
      conversationId = generateConversationId();
      const newConversation: Conversation = {
        conversationId,
        title: inputValue.trim().substring(0, 20) + (inputValue.trim().length > 20 ? '...' : ''),
        lastMessage: inputValue.trim(),
        timestamp: new Date().toISOString(),
        messages: []
      };
      setConversations(prev => [newConversation, ...prev]);
      setCurrentConversationId(conversationId);
    }

    const userMessage: Message = {
      id: `msg_${Date.now()}_user`,
      content: inputValue.trim(),
      sender: 'user',
      timestamp: new Date().toISOString(),
    };

    const assistantMessageId = `msg_${Date.now()}_assistant`;
    const initialAssistantMessage: Message = {
      id: assistantMessageId,
      content: '',
      sender: 'assistant',
      timestamp: new Date().toISOString(),
    };

    const newMessages = [...messages, userMessage, initialAssistantMessage];
    setMessages(newMessages);

    setConversations(prev => prev.map(conv => {
      if (conv.conversationId === conversationId) {
        return {
          ...conv,
          messages: newMessages,
          lastMessage: inputValue.trim(),
          timestamp: new Date().toISOString()
        };
      }
      return conv;
    }));

    const messageToSend = inputValue.trim();
    setInputValue('');
    setIsTyping(true);

    try {
      const historyToSend = [...messages].slice(-5).map(msg => ({
        sender: msg.sender,
        content: msg.content
      }));

      console.log('调用 BFF 函数:', { message: messageToSend, history: historyToSend, conversationId });

      const result = await chatApi({
        query: {
          message: messageToSend,
          history: JSON.stringify(historyToSend),
          conversationId
        }
      });

      console.log('BFF 函数返回:', result);

      if (result && result.type === 'success' && result.content) {
        typeMessage(assistantMessageId, result.content);

        const conv = conversations.find(c => c.conversationId === conversationId);
        if (conv && conv.title === '新对话' && result.content) {
          const newTitle = result.content.substring(0, 20) + (result.content.length > 20 ? '...' : '');
          updateConversationTitle(conversationId, newTitle);
        }

        updateConversationLastMessage(conversationId, result.content);
      } else if (result && result.type === 'error') {
        setIsTyping(false);
        const errorMessage = result.error || '抱歉，我暂时无法回复。请稍后再试。';

        const updatedMessages = messages.map(msg =>
          msg.id === assistantMessageId
            ? { ...msg, content: errorMessage }
            : msg
        );
        setMessages(updatedMessages);

        setConversations(prev => prev.map(conv => {
          if (conv.conversationId === conversationId) {
            return {
              ...conv,
              messages: updatedMessages,
              lastMessage: errorMessage,
              timestamp: new Date().toISOString()
            };
          }
          return conv;
        }));
      } else {
        setIsTyping(false);
        const errorMessage = '抱歉，我暂时无法回复。请稍后再试。';

        const updatedMessages = messages.map(msg =>
          msg.id === assistantMessageId
            ? { ...msg, content: errorMessage }
            : msg
        );
        setMessages(updatedMessages);

        setConversations(prev => prev.map(conv => {
          if (conv.conversationId === conversationId) {
            return {
              ...conv,
              messages: updatedMessages,
              lastMessage: errorMessage,
              timestamp: new Date().toISOString()
            };
          }
          return conv;
        }));
      }
    } catch (error) {
      console.error('发送消息失败:', error);
      setIsTyping(false);
      const errorMessage = '抱歉，发送消息失败。请稍后再试。';

      const updatedMessages = messages.map(msg =>
        msg.id === assistantMessageId
          ? { ...msg, content: errorMessage }
          : msg
      );
      setMessages(updatedMessages);

      setConversations(prev => prev.map(conv => {
        if (conv.conversationId === conversationId) {
          return {
            ...conv,
            messages: updatedMessages,
            lastMessage: errorMessage,
            timestamp: new Date().toISOString()
          };
        }
        return conv;
      }));
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleClearHistory = () => {
    if (window.confirm('确定要清除所有聊天历史吗？此操作不可撤销。')) {
      try {
        localStorage.removeItem(STORAGE_KEY_CONVERSATIONS);
        localStorage.removeItem(STORAGE_KEY_CURRENT_CONVERSATION);
        setConversations([]);
        setCurrentConversationId('');
        setMessages([]);
        console.log('聊天历史已清除');
      } catch (error) {
        console.error('清除聊天历史失败:', error);
      }
    }
  };

  const clearCurrentConversation = () => {
    if (currentConversationId) {
      setMessages([]);
      setConversations(prev => prev.map(conv => {
        if (conv.conversationId === currentConversationId) {
          return {
            ...conv,
            messages: [],
            lastMessage: '',
            timestamp: new Date().toISOString()
          };
        }
        return conv;
      }));
    }
  };

  const deleteConversation = (conversationId: string) => {
    if (window.confirm('确定要删除这个对话吗？')) {
      setConversations(prev => prev.filter(conv => conv.conversationId !== conversationId));
      if (currentConversationId === conversationId) {
        setCurrentConversationId('');
        setMessages([]);
      }
    }
  };

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

      {/* 对话列表侧边栏 */}
      <div className={`conversation-sidebar ${sidebarOpen ? 'open' : 'closed'}`}>
        <div className="app-title" onClick={() => {
          setCurrentConversationId('');
          setMessages([]);
        }} style={{ cursor: 'pointer' }}>兴趣教练助手</div>

        <button
          className="new-conversation-btn"
          onClick={createNewConversation}
        >
          + 新对话
        </button>

        <div className="conversations-list">
          {conversations.map(conversation => (
            <div
              key={conversation.conversationId}
              className={`conversation-item ${currentConversationId === conversation.conversationId ? 'active' : ''}`}
              onClick={() => switchConversation(conversation.conversationId)}
            >
              <div className="conversation-info">
                <div className="conversation-title">
                  {conversation.title}
                </div>
                <div className="conversation-preview">
                  {conversation.lastMessage || '暂无消息'}
                </div>
                <div className="conversation-time">
                  {new Date(conversation.timestamp).toLocaleTimeString()}
                </div>
              </div>
              <button
                className="delete-conversation-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  deleteConversation(conversation.conversationId);
                }}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* 主聊天区域 */}
      <div className="chat-main">
        {/* 侧边栏展开/收起按钮 */}
        <button
          className={`toggle-sidebar-btn ${sidebarOpen ? 'sidebar-open' : ''}`}
          onClick={() => setSidebarOpen(!sidebarOpen)}
        >
          {sidebarOpen ? '<' : '>'}
        </button>
        {/* 仅当对话有内容时显示标题 */}
        {messages.length > 0 && (
          <div className="chat-title">
            <h1>{currentConversation?.title || '兴趣教练助手'}</h1>
          </div>
        )}
        <div className="chat-messages">
          {messages.length === 0 ? (
            <div className="empty-state">
              <p>你好，欢迎使用兴趣教练助手</p>
              {!currentConversationId && (
                <p>点击 "新对话" 开始聊天</p>
              )}
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
    </div>
  );
};

export default ChatApp;
