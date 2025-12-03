// mcp-auth-check.ts
//
// Script para verificar o tipo de autenticação de um servidor MCP
//
// Uso:
//  npx ts-node scripts/mcp-auth-check.ts https://mcp.asana.com/sse
//
// Saída esperada:
//  Origin: https://mcp.asana.com
//  oauth_mcp: true/false
//  auth_type: "none" | "bearer" | "unknown"
//  detalhes...

import { URL } from "node:url";

interface OAuthProtectedResource {
  authorization_servers?: unknown[];
  resource?: string;
  scopes_supported?: string[];
  bearer_methods_supported?: string[];
  resource_documentation?: string;
  resource_name?: string;
}

interface OAuthAuthorizationServer {
  issuer?: string;
  authorization_endpoint?: string;
  token_endpoint?: string;
  token_endpoint_auth_methods_supported?: string[];
  scopes_supported?: string[];
  response_types_supported?: string[];
  grant_types_supported?: string[];
  code_challenge_methods_supported?: string[];
  [key: string]: unknown;
}

function isOAuthProtectedResource(obj: unknown): obj is OAuthProtectedResource {
  return (
    typeof obj === "object" &&
    obj !== null &&
    "authorization_servers" in obj &&
    "resource" in obj
  );
}

function isOAuthAuthorizationServer(obj: unknown): obj is OAuthAuthorizationServer {
  return typeof obj === "object" && obj !== null;
}

async function main() {
  const serverUrl = process.argv[2];

  if (!serverUrl) {
    console.error("Uso: npx ts-node scripts/mcp-auth-check.ts <SERVER_URL>");
    process.exit(1);
  }

  const url = new URL(serverUrl);
  const origin = url.origin;

  console.log(`Server URL: ${serverUrl}`);
  console.log(`Origin    : ${origin}`);
  console.log("==========");

  let oauthMcp = false;
  let authorizationServerUrl: string | null = null;
  let oauthMetadata: OAuthAuthorizationServer | null = null;

  // 1) Tenta o well-known oauth-protected-resource
  console.log("\n[1] Verificando /.well-known/oauth-protected-resource");
  console.log("----------");
  try {
    const protectedResourceUrl = new URL("/.well-known/oauth-protected-resource", origin).toString();
    const res = await fetch(protectedResourceUrl);

    if (res.ok) {
      const json = (await res.json().catch(() => null)) as unknown;
      console.log("Status:", res.status, res.statusText);
      console.log("Body:", JSON.stringify(json, null, 2));

      if (
        isOAuthProtectedResource(json) &&
        Array.isArray(json.authorization_servers) &&
        json.authorization_servers.length > 0 &&
        typeof json.resource === "string"
      ) {
        oauthMcp = true;
        // Pega o primeiro authorization server
        const authServer = json.authorization_servers[0];
        if (typeof authServer === "string") {
          authorizationServerUrl = authServer;
        }
      }
    } else {
      console.log("Status:", res.status, res.statusText);
    }
  } catch (err) {
    console.log("Erro:", (err as Error).message);
  }

  console.log("\noauth_mcp:", oauthMcp);
  if (authorizationServerUrl) {
    console.log("authorization_server:", authorizationServerUrl);
  }

  // 2) Se encontrou authorization server, busca os metadados OAuth2
  if (authorizationServerUrl) {
    console.log("\n[2] Verificando /.well-known/oauth-authorization-server");
    console.log("----------");
    try {
      const authServerUrl = new URL("/.well-known/oauth-authorization-server", authorizationServerUrl).toString();
      const res = await fetch(authServerUrl);

      if (res.ok) {
        const json = (await res.json().catch(() => null)) as unknown;
        console.log("Status:", res.status, res.statusText);
        
        if (isOAuthAuthorizationServer(json)) {
          oauthMetadata = json;
          console.log("Body:", JSON.stringify(json, null, 2));
          
          // Destaca informações importantes
          console.log("\n📋 Informações de Autenticação:");
          if (json.authorization_endpoint) {
            console.log(`  authorization_endpoint: ${json.authorization_endpoint}`);
          }
          if (json.token_endpoint) {
            console.log(`  token_endpoint: ${json.token_endpoint}`);
          }
          if (json.token_endpoint_auth_methods_supported) {
            console.log(`  token_endpoint_auth_methods: ${JSON.stringify(json.token_endpoint_auth_methods_supported)}`);
          }
          if (json.scopes_supported) {
            console.log(`  scopes_supported: ${JSON.stringify(json.scopes_supported)}`);
          }
          if (json.code_challenge_methods_supported) {
            console.log(`  code_challenge_methods: ${JSON.stringify(json.code_challenge_methods_supported)}`);
          }
        } else {
          console.log("Body:", JSON.stringify(json, null, 2));
        }
      } else {
        console.log("Status:", res.status, res.statusText);
        // Tenta também no origin original
        const fallbackUrl = new URL("/.well-known/oauth-authorization-server", origin).toString();
        console.log(`\nTentando fallback em: ${fallbackUrl}`);
        const fallbackRes = await fetch(fallbackUrl);
        if (fallbackRes.ok) {
          const json = (await fallbackRes.json().catch(() => null)) as unknown;
          console.log("Status (fallback):", fallbackRes.status, fallbackRes.statusText);
          if (isOAuthAuthorizationServer(json)) {
            oauthMetadata = json;
            console.log("Body:", JSON.stringify(json, null, 2));
          }
        }
      }
    } catch (err) {
      console.log("Erro:", (err as Error).message);
    }
  }

  console.log("\n==========");

  // 3) Bate no próprio SERVER_URL sem auth pra ver o comportamento
  console.log("\n[3] Testando acesso ao SERVER_URL sem autenticação");
  console.log("----------");
  let authType: "none" | "bearer" | "unknown" = "unknown";

  try {
    const res = await fetch(serverUrl, { method: "GET" });
    console.log("Status:", res.status, res.statusText);

    const wwwAuth = res.headers.get("www-authenticate");
    if (wwwAuth) {
      console.log("WWW-Authenticate:", wwwAuth);
    }

    if (res.status === 200) {
      authType = "none";
    } else if (res.status === 401 && wwwAuth && /bearer/i.test(wwwAuth)) {
      authType = "bearer";
    }
  } catch (err) {
    console.log("Erro:", (err as Error).message);
  }

  console.log("\n==========");
  console.log("📊 RESUMO:");
  console.log("==========");
  console.log("oauth_mcp:", oauthMcp);
  console.log("auth_type:", authType);
  if (authorizationServerUrl) {
    console.log("authorization_server:", authorizationServerUrl);
  }
  if (oauthMetadata?.authorization_endpoint) {
    console.log("authorization_endpoint:", oauthMetadata.authorization_endpoint);
  }
  if (oauthMetadata?.token_endpoint) {
    console.log("token_endpoint:", oauthMetadata.token_endpoint);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

