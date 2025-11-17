import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles/styles.css';
import { Provider as ReduxProvider } from "react-redux";
import store from './redux/store';

const container = document.getElementById('root');
const root = createRoot(container);
root.render(<ReduxProvider store={store}>
    <App />
  </ReduxProvider>);
