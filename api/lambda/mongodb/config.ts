import { MongoClient } from 'mongodb';

// MongoDB连接配置
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || 'chat-app';

// 创建MongoDB客户端
const client = new MongoClient(MONGODB_URI);
let db: any = null;

//连接到MongoDB数据库
export const connectToDatabase = async () => {
  if (db) {
    return db;
  }

  try {
    await client.connect();
    db = client.db(MONGODB_DB_NAME);
    console.log('MongoDB连接成功');
    return db;
  } catch (error) {
    console.error('MongoDB连接失败:', error);
    throw error;
  }
};

//获取MongoDB集合
export const getCollection = async (collectionName: string) => {
  const database = await connectToDatabase();
  return database.collection(collectionName);
};

//关闭MongoDB连接
export const closeDatabaseConnection = async () => {
  if (client) {
    await client.close();
    console.log('MongoDB连接已关闭');
  }
};
