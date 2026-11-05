import { X509Certificate } from "node:crypto";
import { readFileSync } from "node:fs";
import { portNumber } from "./network";

export function httpsSettings(host: string, httpPort: number) {
  const {
    UPSCAYL_TLS_CERT: certPath,
    UPSCAYL_TLS_KEY: keyPath,
    UPSCAYL_TLS_CA: caPath,
  } = process.env;
  if (!certPath && !keyPath) return;
  if (!certPath || !keyPath)
    throw Error("Set both UPSCAYL_TLS_CERT and UPSCAYL_TLS_KEY.");
  const cert = readFileSync(certPath),
    key = readFileSync(keyPath);
  const leaf = new X509Certificate(cert);
  if (
    Date.now() < Date.parse(leaf.validFrom) ||
    Date.now() >= Date.parse(leaf.validTo)
  )
    throw Error("Renew the HTTPS certificate for this LAN IP.");
  if (!leaf.checkIP(host))
    throw Error("The HTTPS certificate must cover the configured LAN IP.");
  const port = portNumber(process.env.UPSCAYL_TLS_PORT || httpPort + 1);
  if (port === httpPort) throw Error("HTTPS needs a separate port.");
  const ca = caPath ? new X509Certificate(readFileSync(caPath)) : undefined;
  return {
    tls: { cert, key },
    port,
    url: new URL("https://" + host + ":" + port).origin,
    ca,
  };
}
