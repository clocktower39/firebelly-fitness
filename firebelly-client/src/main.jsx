import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./index.css";
import "./styles/tailwind.css";
import { Provider } from "react-redux";
import { store } from "./Redux/store";
import { initializeAuthTokenSync } from "./api/client";
import { registerServiceWorker } from "./utils/pushManager";

// Temporary remove <React.StrictMode> parent container for react-beautiful-dnd, will replace with @dnd-kit/core
/*
  The double invocation of effects in React.StrictMode is likely the cause of the issues with react-beautiful-dnd.
  Since React intentionally invokes lifecycle methods (like useEffect and useLayoutEffect) twice in development mode, libraries like react-beautiful-dnd can experience problems because they might not expect the extra invocation, leading to issues like duplicate rendering or missing IDs.
*/

initializeAuthTokenSync();
// Register the service worker (no permission prompt — that happens when the user opts in).
registerServiceWorker();

ReactDOM.createRoot(document.getElementById("root")).render(
    <Provider store={store}>
      <App />
    </Provider>
);
