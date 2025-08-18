import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
    apiKey: "AIzaSyCst1R5C_Nbm4LfONZy_DW0JNXzlH3LL7U",
    authDomain: "voiceagent-c8f98.firebaseapp.com",
    databaseURL: "https://voiceagent-c8f98-default-rtdb.firebaseio.com",
    projectId: "voiceagent-c8f98",
    storageBucket: "voiceagent-c8f98.firebasestorage.app",
    messagingSenderId: "905853488691",
    appId: "1:905853488691:web:6f68e799b5f3232803dd46",
    measurementId: "G-507J5FBX74"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app); 