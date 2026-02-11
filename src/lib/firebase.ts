// Reemplaza con tus credenciales reales de Firebase
// (Project settings → General → Your apps → SDK setup and configuration)
import { initializeApp, getApps } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyA6gnaX1PY6lF3d9ci6FUlEEmoJYORsspc",
  authDomain: "cervezas-eric.firebaseapp.com",
  projectId: "cervezas-eric",
  storageBucket: "cervezas-eric.firebasestorage.app",
  messagingSenderId: "710219392070",
  appId: "1:710219392070:web:98791034c39c5a57d21647",
  measurementId: "G-S502CZ5EWK"
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();
