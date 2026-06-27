import { createServer } from "node:http";
import { fileURLToPath } from "node:url";

const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_PORT = 7341;
const RUNTIME_MARKER = "de-koi-server";
const SUPPORTED_COMMANDS = new Set([
  "generation_generate",
  "provider_connection_check",
  "storage_create",
  "storage_delete",
  "storage_list",
  "storage_update",
]);

function isRecord(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function readString(value, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function sendJson(response, statusCode, body) {
  response.writeHead(statusCode, {
    "access-control-allow-headers": "authorization, content-type, x-marinara-csrf",
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-allow-origin": "*",
    "cache-control": "no-store",
    "content-type": "application/json; charset=utf-8",
  });
  response.end(JSON.stringify(body));
}

function readRequestJson(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.setEncoding("utf8");
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 2_000_000) {
        reject(new Error("Request body is too large."));
        request.destroy();
      }
    });
    request.on("end", () => {
      if (!body.trim()) {
        resolve(null);
        return;
      }

      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error("Request body must be valid JSON."));
      }
    });
    request.on("error", reject);
  });
}

function getEntityStore(storage, entity) {
  if (!storage.has(entity)) {
    storage.set(entity, new Map());
  }
  return storage.get(entity);
}

function listRecords(storage, args) {
  if (!isRecord(args)) throw new Error("storage_list requires args.");

  const entity = readString(args.entity).trim();
  if (!entity) throw new Error("storage_list requires args.entity.");

  return Array.from(getEntityStore(storage, entity).values());
}

function createRecord(storage, args) {
  if (!isRecord(args)) throw new Error("storage_create requires args.");

  const entity = readString(args.entity).trim();
  const value = args.value;
  if (!entity) throw new Error("storage_create requires args.entity.");
  if (!isRecord(value)) throw new Error("storage_create requires args.value.");

  const id = readString(value.id).trim() || `fixture-record-${Date.now()}`;
  const record = { ...value, id };
  getEntityStore(storage, entity).set(id, record);
  return record;
}

function updateRecord(storage, args) {
  if (!isRecord(args)) throw new Error("storage_update requires args.");

  const entity = readString(args.entity).trim();
  const id = readString(args.id).trim();
  const patch = args.patch;
  if (!entity) throw new Error("storage_update requires args.entity.");
  if (!id) throw new Error("storage_update requires args.id.");
  if (!isRecord(patch)) throw new Error("storage_update requires args.patch.");

  const store = getEntityStore(storage, entity);
  const existing = isRecord(store.get(id)) ? store.get(id) : {};
  const record = { ...existing, ...patch, id };
  store.set(id, record);
  return record;
}

function deleteRecord(storage, args) {
  if (!isRecord(args)) throw new Error("storage_delete requires args.");

  const entity = readString(args.entity).trim();
  const id = readString(args.id).trim();
  if (!entity) throw new Error("storage_delete requires args.entity.");
  if (!id) throw new Error("storage_delete requires args.id.");

  getEntityStore(storage, entity).delete(id);
  return { ok: true };
}

function countEnabledLoreEntries(request) {
  if (!Array.isArray(request.lorebooks)) return 0;

  return request.lorebooks.reduce((count, lorebook) => {
    if (!isRecord(lorebook) || !Array.isArray(lorebook.entries)) return count;
    return count + lorebook.entries.filter((entry) => isRecord(entry) && entry.enabled !== false).length;
  }, 0);
}

function selectCompanion(request) {
  const companions = Array.isArray(request.companions) ? request.companions : [];
  const validCompanions = companions.filter(
    (companion) => isRecord(companion) && readString(companion.id).trim(),
  );
  if (validCompanions.length === 0) return null;

  const messages = isRecord(request.thread) && Array.isArray(request.thread.messages)
    ? request.thread.messages
    : [];
  const companionMessageCount = messages.filter(
    (message) => isRecord(message) && isRecord(message.author) && message.author.kind === "character",
  ).length;
  return validCompanions[companionMessageCount % validCompanions.length];
}

function checkProviderConnection(args) {
  if (!isRecord(args) || !isRecord(args.connection)) {
    throw new Error("provider_connection_check requires args.connection.");
  }

  const connection = args.connection;
  const provider = readString(connection.provider).trim();
  const baseUrl = readString(connection.baseUrl).trim();
  const model = readString(connection.model).trim();
  if (!provider || !baseUrl || !model) {
    throw new Error("Provider connection needs provider, base URL, and model.");
  }

  return {
    success: true,
    message: "Fixture provider connection check passed.",
  };
}
function generateReply(args) {
  if (!isRecord(args) || !isRecord(args.request)) {
    throw new Error("generation_generate requires args.request.");
  }

  const request = args.request;
  const requestId = readString(request.id).trim();
  if (!requestId) throw new Error("generation_generate request requires id.");

  const companion = selectCompanion(request);
  const createdAt = readString(request.createdAt) || new Date().toISOString();
  if (!companion) {
    return {
      schemaVersion: 1,
      requestId,
      providerKind: "remote-runtime",
      createdAt,
      messages: [],
      warnings: ["Fixture runtime found no selected companion."],
    };
  }

  const companionName = readString(companion.nickname) || readString(companion.displayName, "Companion");
  const companionId = readString(companion.id).trim();
  const personaName = isRecord(request.activePersona)
    ? readString(request.activePersona.displayName, "the active persona")
    : "no active persona";
  const loreCount = countEnabledLoreEntries(request);

  return {
    schemaVersion: 1,
    requestId,
    providerKind: "remote-runtime",
    createdAt,
    messages: [
      {
        characterId: companionId,
        body: `Fixture reply from ${companionName}: received ${personaName} with ${loreCount} enabled lore notes.`,
      },
    ],
    warnings: [],
  };
}

function invokeCommand(storage, command, args) {
  if (!SUPPORTED_COMMANDS.has(command)) {
    throw new Error(`Unsupported fixture command: ${command}`);
  }

  switch (command) {
    case "generation_generate":
      return generateReply(args);
    case "provider_connection_check":
      return checkProviderConnection(args);
    case "storage_create":
      return createRecord(storage, args);
    case "storage_delete":
      return deleteRecord(storage, args);
    case "storage_list":
      return listRecords(storage, args);
    case "storage_update":
      return updateRecord(storage, args);
    default:
      throw new Error(`Unhandled fixture command: ${command}`);
  }
}

export function createRemoteRuntimeFixtureServer() {
  const storage = new Map();

  return createServer(async (request, response) => {
    if (request.method === "OPTIONS") {
      sendJson(response, 204, null);
      return;
    }

    const url = new URL(request.url ?? "/", "http://127.0.0.1");

    if (request.method === "GET" && url.pathname === "/health") {
      sendJson(response, 200, {
        ok: true,
        runtime: RUNTIME_MARKER,
        writable: true,
      });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/invoke") {
      try {
        const body = await readRequestJson(request);
        if (!isRecord(body)) throw new Error("Invoke body must be an object.");

        const command = readString(body.command).trim();
        const result = invokeCommand(storage, command, body.args ?? null);
        sendJson(response, 200, result);
      } catch (error) {
        sendJson(response, 400, {
          message: error instanceof Error ? error.message : "Fixture command failed.",
        });
      }
      return;
    }

    sendJson(response, 404, { message: "Fixture route not found." });
  });
}

function readCliOption(name, fallback) {
  const prefix = `--${name}=`;
  const inline = process.argv.find((arg) => arg.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);

  const index = process.argv.indexOf(`--${name}`);
  if (index >= 0 && process.argv[index + 1]) return process.argv[index + 1];

  return fallback;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const host = readCliOption("host", process.env.DEKOI_RUNTIME_FIXTURE_HOST || DEFAULT_HOST);
  const port = Number(readCliOption("port", process.env.DEKOI_RUNTIME_FIXTURE_PORT || String(DEFAULT_PORT)));
  const server = createRemoteRuntimeFixtureServer();

  server.listen(port, host, () => {
    const address = server.address();
    const actualPort = typeof address === "object" && address ? address.port : port;
    console.log(`DeKoi remote runtime fixture listening at http://${host}:${actualPort}`);
  });

  process.on("SIGINT", () => {
    server.close(() => process.exit(0));
  });
}
