import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { injectThmanyahFont } from "./fonts";

injectThmanyahFont();

createRoot(document.getElementById("root")!).render(<App />);
