// Firebase Configuration for Al-Gomhouria Lab Online Sync
// Project ID: hamadaaboalhaj-a636c

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, query, orderBy, setDoc, doc, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyAs-FakeKeyForDemo-ReplaceWithRealOne",
    authDomain: "hamadaaboalhaj-a636c.firebaseapp.com",
    projectId: "hamadaaboalhaj-a636c",
    storageBucket: "hamadaaboalhaj-a636c.appspot.com",
    messagingSenderId: "1234567890",
    appId: "1:1234567890:web:abcdef123456"
};

let db;
try {
    const app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    console.log("Firebase initialized for Online Sync");
} catch (e) {
    console.error("Firebase initialization failed:", e);
}

export { db, collection, addDoc, onSnapshot, query, orderBy, setDoc, doc, getDocs };
