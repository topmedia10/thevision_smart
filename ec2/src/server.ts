import { createApp } from "./api";
import { config } from "./config";
import { log } from "./logger";

const app = createApp();
app.listen(config.port, "127.0.0.1", () => {
  // Bind to localhost only — nginx terminates TLS and proxies to this port.
  log.info("EC2 API listening", { port: config.port });
});
