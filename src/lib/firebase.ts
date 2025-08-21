import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
    apiKey: "AIzaSyCimygGJd3U7uAijoD1bQePBDlm6Luxpl8",
    authDomain: "callservice-69520.firebaseapp.com",
    projectId: "callservice-69520",
    storageBucket: "callservice-69520.firebasestorage.app",
    messagingSenderId: "1098179653505",
    appId: "1:1098179653505:web:b47bdabc03d53869680280",
    measurementId: "G-N47LS2Q583"
  };

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app); 