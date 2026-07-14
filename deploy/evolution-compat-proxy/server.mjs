#!/usr/bin/env node
/**
 * Evolution API v2 compatibility proxy.
 * Old BotFlow frontend expects instanceName + object connectionStatus;
 * Evolution v2 returns name + string connectionStatus.
 */
import http from "node:http";
import { URL } from "node:url";

const PORT = Number(process.env.PORT ?? 8089);
const TARGET =
  process.env.EVOLUTION_UPSTREAM?.replace(/\/$/, "") ??
  "http://sass-botflow_botflow-evolution:8080";
const API_KEY = process.env.EVOLUTION_API_KEY?.trim() ?? "";

function normalizeConnectionStatus(status) {
  if (typeof status === "string") {
    return { state: status };
  }
  return status;
}

function normalizeInstanceRow(row) {
  if (!row || typeof row !== "object") return row;

  const record = { ...row };
  const nested = record.instance;

  if (nested && typeof nested === "object") {
    const instance = { ...nested };
    const key =
      (typeof instance.instanceName === "string" && instance.instanceName) ||
      (typeof instance.name === "string" && instance.name) ||
      null;

    if (key) {
      instance.instanceName = key;
      instance.name = key;
    }

    if ("connectionStatus" in instance) {
      instance.connectionStatus = normalizeConnectionStatus(
        instance.connectionStatus,
      );
    }

    record.instance = instance;
    return record;
  }

  const key =
    (typeof record.instanceName === "string" && record.instanceName) ||
    (typeof record.name === "string" && record.name) ||
    null;

  if (key) {
    record.instanceName = key;
    record.name = key;
  }

  if ("connectionStatus" in record) {
    record.connectionStatus = normalizeConnectionStatus(record.connectionStatus);
  }

  return record;
}

function normalizeFetchInstancesPayload(payload) {
  if (Array.isArray(payload)) {
    return payload.map(normalizeInstanceRow);
  }

  if (payload && typeof payload === "object") {
    const record = payload;
    if (Array.isArray(record.instances)) {
      return {
        ...record,
        instances: record.instances.map(normalizeInstanceRow),
      };
    }
    return normalizeInstanceRow(record);
  }

  return payload;
}

function isInstanceAlreadyExists(statusCode, payload, rawText) {
  if (statusCode !== 403) return false;

  const haystack = [
    rawText,
    typeof payload === "string" ? payload : "",
    payload && typeof payload === "object"
      ? JSON.stringify(payload)
      : "",
  ]
    .join(" ")
    .toLowerCase();

  return /already in use|already exists|already exist/.test(haystack);
}

function shouldNormalizeFetchInstances(pathname) {
  return (
    pathname === "/instance/fetchInstances" ||
    pathname.startsWith("/instance/fetchInstances/")
  );
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

async function proxyRequest(req, res) {
  const requestUrl = new URL(req.url ?? "/", `http://127.0.0.1:${PORT}`);
  const upstreamUrl = `${TARGET}${requestUrl.pathname}${requestUrl.search}`;

  const headers = { ...req.headers, host: new URL(TARGET).host };
  delete headers["content-length"];

  if (API_KEY && !headers.apikey) {
    headers.apikey = API_KEY;
  }

  const init = {
    method: req.method,
    headers,
    signal: AbortSignal.timeout(120_000),
  };

  if (req.method !== "GET" && req.method !== "HEAD") {
    init.body = await readBody(req);
  }

  let upstream;
  try {
    upstream = await fetch(upstreamUrl, init);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.writeHead(502, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        error: "Evolution upstream unreachable",
        message,
        upstream: TARGET,
      }),
    );
    return;
  }

  const rawText = await upstream.text();
  let payload = rawText;

  if (rawText) {
    try {
      payload = JSON.parse(rawText);
    } catch {
      payload = rawText;
    }
  }

  if (
    req.method === "POST" &&
    requestUrl.pathname === "/instance/create" &&
    isInstanceAlreadyExists(upstream.status, payload, rawText)
  ) {
    res.writeHead(409, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        message: "Instance already exists",
        status: "already_exists",
      }),
    );
    return;
  }

  if (
    req.method === "GET" &&
    shouldNormalizeFetchInstances(requestUrl.pathname) &&
    upstream.ok
  ) {
    const normalized = normalizeFetchInstancesPayload(payload);
    const body = JSON.stringify(normalized);
    res.writeHead(upstream.status, {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(body),
    });
    res.end(body);
    return;
  }

  const outHeaders = {};
  upstream.headers.forEach((value, key) => {
    if (key.toLowerCase() === "transfer-encoding") return;
    outHeaders[key] = value;
  });

  res.writeHead(upstream.status, outHeaders);
  res.end(rawText);
}

const server = http.createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        ok: true,
        service: "evolution-compat-proxy",
        upstream: TARGET,
      }),
    );
    return;
  }

  void proxyRequest(req, res).catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    if (!res.headersSent) {
      res.writeHead(500, { "Content-Type": "application/json" });
    }
    res.end(JSON.stringify({ error: message }));
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(
    `[evolution-compat-proxy] listening on :${PORT} -> ${TARGET}`,
  );
});
