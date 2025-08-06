import { render } from "preact";
import App from "./App";
// Import styles directly here to ensure they load before components
import "@xterm/xterm/css/xterm.css";
import "./index.css";

render(<App />, document.getElementById("root") as HTMLElement);
