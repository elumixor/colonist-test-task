import "./styles.scss";
import { wireCtas } from "./buttons.ts";

// DOM is already parsed by the time this module-script runs (type=module is
// deferred by default), so we can wire up immediately.
wireCtas();
