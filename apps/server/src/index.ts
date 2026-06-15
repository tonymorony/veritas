// Load apps/server/.env (if present) into process.env before anything reads config.
// No-op when the file is absent, so the zero-config demo path is unaffected.
import "dotenv/config";
import { createApp } from "./app";
import { loadConfig } from "./config";

const config = loadConfig();
const app = createApp(config);

app.listen(config.port, () => {
  console.log(
    `[veritas] listening on :${config.port}  engine=${config.engine}  x402=${config.x402Mode}`,
  );
});
