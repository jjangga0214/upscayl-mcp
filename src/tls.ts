import { createPrivateKey, X509Certificate } from "node:crypto";
import { readFileSync } from "node:fs";
import { isIPv4 } from "node:net";
import { portNumber, serverOrigin } from "./network";

export function httpsSettings(
  host: string,
  httpPort: number,
  env: Record<string, string>,
) {
  const {
    UPSCAYL_TLS_CERT: certPath,
    UPSCAYL_TLS_KEY: keyPath,
    UPSCAYL_TLS_CA: caPath,
  } = env;
  if (!certPath && !keyPath && !caPath && !env.UPSCAYL_TLS_PORT) return;
  if (!certPath || !keyPath)
    throw Error(
      "Provide both --tls-cert and --tls-key, or set UPSCAYL_TLS_CERT and UPSCAYL_TLS_KEY.",
    );
  const cert = readFileSync(certPath),
    key = readFileSync(keyPath);
  const leaf = new X509Certificate(cert);
  if (
    Date.now() < Date.parse(leaf.validFrom) ||
    Date.now() >= Date.parse(leaf.validTo)
  )
    throw Error("Renew the HTTPS certificate for " + host + ".");
  if (
    !(isIPv4(host)
      ? leaf.checkIP(host)
      : leaf.checkHost(host, { subject: "never" }))
  )
    throw Error(
      "The HTTPS certificate must cover " + host + " in its subjectAltName.",
    );
  if (!leaf.checkPrivateKey(createPrivateKey(key)))
    throw Error("The HTTPS certificate and private key do not match.");
  const port = portNumber(env.UPSCAYL_TLS_PORT || httpPort + 1);
  if (port === httpPort) throw Error("HTTPS needs a separate port.");
  const ca = caPath ? new X509Certificate(readFileSync(caPath)) : undefined;
  if (ca) {
    if (!ca.ca) throw Error("--tls-ca must be a public CA certificate.");
    const chain =
      cert
        .toString()
        .match(
          /-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/g,
        ) ?? [];
    const issuers = chain.slice(1).map((pem) => new X509Certificate(pem));
    let current = leaf;
    while (
      !current.raw.equals(ca.raw) &&
      !(current.checkIssued(ca) && current.verify(ca.publicKey))
    ) {
      const index = issuers.findIndex(
        (issuer) =>
          issuer.ca &&
          current.checkIssued(issuer) &&
          current.verify(issuer.publicKey),
      );
      if (index < 0)
        throw Error(
          "The server certificate chain does not lead to --tls-ca. Provide its full chain and matching public CA.",
        );
      current = issuers.splice(index, 1)[0];
    }
  }
  return {
    tls: { cert, key },
    port,
    url: serverOrigin("https", host, port),
    ca,
  };
}
