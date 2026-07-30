import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';

// Firebase 配置
// 请在 .env 文件中配置以下环境变量：
// VITE_FIREBASE_API_KEY=你的API密钥
// VITE_FIREBASE_AUTH_DOMAIN=你的项目ID.firebaseapp.com
// VITE_FIREBASE_DATABASE_URL=https://你的项目ID.firebaseio.com
// VITE_FIREBASE_PROJECT_ID=你的项目ID
// VITE_FIREBASE_STORAGE_BUCKET=你的项目ID.appspot.com
// VITE_FIREBASE_MESSAGING_SENDER_ID=你的发送者ID
// VITE_FIREBASE_APP_ID=你的应用ID

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
};

// 只在配置完整时初始化
let app = null;
let database = null;

if (firebaseConfig.apiKey && firebaseConfig.databaseURL) {
  app = initializeApp(firebaseConfig);
  database = getDatabase(app);
}

export { database };