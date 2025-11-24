import { ObjectId } from 'mongodb';
import { getCollection } from './config';

//消息接口
export interface Message {
  id: string;
  sender: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

//对话接口
export interface Conversation {
  _id?: ObjectId;
  conversationId: string;
  title: string;
  messages: Message[];
  createdAt: Date;
  updatedAt: Date;
}

//对话集合名称
const CONVERSATIONS_COLLECTION = 'conversations';

//创建新对话
export const createConversation = async (
  conversationId: string,
  title: string,
  initialMessage: Message
): Promise<Conversation> => {
  const collection = await getCollection(CONVERSATIONS_COLLECTION);
  const conversation: Conversation = {
    conversationId,
    title,
    messages: [initialMessage],
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const result = await collection.insertOne(conversation);
  return { ...conversation, _id: result.insertedId };
};

//获取对话列表
export const getConversations = async (): Promise<Conversation[]> => {
  const collection = await getCollection(CONVERSATIONS_COLLECTION);
  return collection.find({}).sort({ updatedAt: -1 }).toArray();
};

//获取单个对话
export const getConversationById = async (conversationId: string): Promise<Conversation | null> => {
  const collection = await getCollection(CONVERSATIONS_COLLECTION);
  return collection.findOne({ conversationId });
};

//更新对话
export const updateConversation = async (
  conversationId: string,
  message: Message,
  title?: string
): Promise<Conversation | null> => {
  const collection = await getCollection(CONVERSATIONS_COLLECTION);
  const update: any = {
    $push: { messages: message },
    $set: { updatedAt: new Date() },
  };
  if (title) {
    update.$set.title = title;
  }
  const result = await collection.findOneAndUpdate(
    { conversationId },
    update,
    { returnDocument: 'after' }
  );
  return result.value;
};

//删除对话
export const deleteConversation = async (conversationId: string): Promise<boolean> => {
  const collection = await getCollection(CONVERSATIONS_COLLECTION);
  const result = await collection.deleteOne({ conversationId });
  return result.deletedCount > 0;
};

//生成对话ID
export const generateConversationId = (): string => {
  return `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};
