// import React from 'react';
// import ReactDOM from 'react-dom/client';
// import { AuthProvider } from './auth/AuthProvider';
// import App from './App';
// import './index.css';

// ReactDOM.createRoot(document.getElementById('root')!).render(
//   <AuthProvider>
//     <App />
//   </AuthProvider>
// );



// frontend/src/main.tsx
//import React from 'react';
import ReactDOM from 'react-dom/client';
import { AuthProvider } from './auth/AuthProvider';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <AuthProvider>
    <App />
  </AuthProvider>
);