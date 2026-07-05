import * as dns from 'node:dns/promises';
import * as net from 'node:net';

export interface EvolutionTarget {
  baseUrl: string;
  hostname: string;
  port: number;
  protocol: string;
  path: string;
}

export interface DnsLookupResult {
  hostname: string;
  addresses: string[];
  error?: string;
  code?: string;
}

export interface TcpConnectResult {
  hostname: string;
  port: number;
  success: boolean;
  latencyMs?: number;
  error?: string;
  code?: string;
}

export interface HttpProbeResult {
  url: string;
  success: boolean;
  status?: number;
  latencyMs?: number;
  bodyPreview?: string;
  error?: string;
  code?: string;
}

export interface EvolutionConnectivityReport {
  configuredBaseUrl: string;
  resolvedUrl: string;
  host: string;
  port: number;
  protocol: string;
  dns: DnsLookupResult;
  tcp: TcpConnectResult;
  httpHealth?: HttpProbeResult;
  httpRoot?: HttpProbeResult;
  reachable: boolean;
  alternateHostnames?: Array<{
    hostname: string;
    dns: DnsLookupResult;
    tcp?: TcpConnectResult;
    suggestedUrl?: string;
  }>;
  suggestions: string[];
}

export interface FetchFailureDetails {
  error: string;
  cause?: string;
  code?: string;
  stack?: string;
  connectivity: EvolutionConnectivityReport;
}

let lastStartupReport: EvolutionConnectivityReport | null = null;
let lastRequestReport: EvolutionConnectivityReport | null = null;

export function getLastEvolutionStartupReport(): EvolutionConnectivityReport | null {
  return lastStartupReport;
}

export function getLastEvolutionRequestReport(): EvolutionConnectivityReport | null {
  return lastRequestReport;
}

export function parseEvolutionTarget(baseUrl: string, path = '/'): EvolutionTarget {
  const normalizedBase = baseUrl.replace(/\/$/, '');
  const url = new URL(path, `${normalizedBase}/`);

  return {
    baseUrl: normalizedBase,
    hostname: url.hostname,
    port: url.port ? Number(url.port) : url.protocol === 'https:' ? 443 : 80,
    protocol: url.protocol.replace(':', ''),
    path: `${url.pathname}${url.search}`,
  };
}

export function inferEasyPanelProjectPrefix(): string | null {
  const explicit = process.env.EASYPANEL_PROJECT_NAME?.trim();
  if (explicit) {
    return explicit;
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    return null;
  }

  try {
    const host = new URL(databaseUrl).hostname;
    const underscoreMatch = host.match(/^(.+)_postgres$/i);
    if (underscoreMatch?.[1]) {
      return underscoreMatch[1];
    }

    const hyphenMatch = host.match(/^(.+)-postgres$/i);
    if (hyphenMatch?.[1]) {
      return hyphenMatch[1];
    }
  } catch {
    return null;
  }

  return null;
}

export function suggestEasyPanelEvolutionHostnames(configuredHostname: string): string[] {
  const suggestions = new Set<string>();
  const projectPrefix = inferEasyPanelProjectPrefix();

  if (projectPrefix) {
    suggestions.add(`${projectPrefix}_evolution-api`);
    suggestions.add(`${projectPrefix}-evolution-api`);
    suggestions.add(`${projectPrefix}_evolution_api`);
  }

  if (configuredHostname === 'evolution-api' && projectPrefix) {
    suggestions.delete(configuredHostname);
  }

  suggestions.delete(configuredHostname);
  return [...suggestions];
}

export async function lookupHostname(hostname: string): Promise<DnsLookupResult> {
  try {
    const addresses = await dns.lookup(hostname, { all: true, verbatim: true });
    return {
      hostname,
      addresses: addresses.map((entry) =>
        entry.family === 6 ? `[${entry.address}]` : entry.address,
      ),
    };
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;
    return {
      hostname,
      addresses: [],
      error: nodeError.message,
      code: nodeError.code,
    };
  }
}

export function probeTcp(hostname: string, port: number, timeoutMs = 5_000): Promise<TcpConnectResult> {
  return new Promise((resolve) => {
    const startedAt = Date.now();
    const socket = new net.Socket();

    const finish = (success: boolean, error?: Error) => {
      socket.destroy();
      const nodeError = error as NodeJS.ErrnoException | undefined;
      resolve({
        hostname,
        port,
        success,
        latencyMs: Date.now() - startedAt,
        error: error?.message,
        code: nodeError?.code,
      });
    };

    socket.setTimeout(timeoutMs);
    socket.once('connect', () => finish(true));
    socket.once('timeout', () => finish(false, Object.assign(new Error('Connection timed out'), { code: 'ETIMEDOUT' })));
    socket.once('error', (error) => finish(false, error));

    try {
      socket.connect(port, hostname);
    } catch (error) {
      finish(false, error instanceof Error ? error : new Error(String(error)));
    }
  });
}

export async function probeHttp(url: string, timeoutMs = 5_000): Promise<HttpProbeResult> {
  const startedAt = Date.now();

  try {
    const response = await fetch(url, {
      method: 'GET',
      signal: AbortSignal.timeout(timeoutMs),
    });
    const body = await response.text();

    return {
      url,
      success: response.ok,
      status: response.status,
      latencyMs: Date.now() - startedAt,
      bodyPreview: body.trim().slice(0, 200),
    };
  } catch (error) {
    const details = extractNodeError(error);
    return {
      url,
      success: false,
      latencyMs: Date.now() - startedAt,
      error: details.error,
      code: details.code,
    };
  }
}

export function extractNodeError(error: unknown): {
  error: string;
  cause?: string;
  code?: string;
  stack?: string;
} {
  if (!(error instanceof Error)) {
    return { error: String(error) };
  }

  const nodeError = error as NodeJS.ErrnoException;
  const details: {
    error: string;
    cause?: string;
    code?: string;
    stack?: string;
  } = {
    error: error.message,
    stack: error.stack,
    code: nodeError.code,
  };

  if (error.cause instanceof Error) {
    const causeError = error.cause as NodeJS.ErrnoException;
    details.cause = error.cause.message;
    details.code = details.code ?? causeError.code;
  }

  return details;
}

function buildSuggestions(
  target: EvolutionTarget,
  dnsResult: DnsLookupResult,
  tcpResult: TcpConnectResult,
  alternates: EvolutionConnectivityReport['alternateHostnames'],
): string[] {
  const suggestions: string[] = [];

  if (dnsResult.code === 'ENOTFOUND') {
    suggestions.push(
      `DNS could not resolve "${target.hostname}". Backend and Evolution must be in the same EasyPanel project.`,
    );

    const workingAlternate = alternates?.find((entry) => entry.dns.addresses.length > 0);
    if (workingAlternate?.suggestedUrl) {
      suggestions.push(`Try EVOLUTION_API_URL=${workingAlternate.suggestedUrl}`);
    } else {
      const projectPrefix = inferEasyPanelProjectPrefix();
      if (projectPrefix) {
        suggestions.push(
          `EasyPanel often uses "${projectPrefix}_evolution-api" instead of "evolution-api".`,
        );
        suggestions.push(`Try EVOLUTION_API_URL=http://${projectPrefix}_evolution-api:${target.port}`);
      }
    }
  }

  if (tcpResult.code === 'ECONNREFUSED') {
    suggestions.push(
      `TCP connection to ${target.hostname}:${target.port} was refused. Evolution may be stopped or listening on a different port.`,
    );
  }

  if (tcpResult.code === 'ETIMEDOUT') {
    suggestions.push(
      `TCP connection to ${target.hostname}:${target.port} timed out. Check Docker network isolation between backend and Evolution.`,
    );
  }

  if (target.hostname === 'localhost' || target.hostname === '127.0.0.1') {
    suggestions.push('Do not use localhost — use the EasyPanel internal service hostname.');
  }

  if (target.protocol === 'https' && target.port === 8080) {
    suggestions.push('Internal Evolution URL should usually be http://, not https://.');
  }

  return suggestions;
}

async function probeAlternateHostnames(
  target: EvolutionTarget,
  configuredBaseUrl: string,
): Promise<EvolutionConnectivityReport['alternateHostnames']> {
  const alternates = suggestEasyPanelEvolutionHostnames(target.hostname);
  if (alternates.length === 0) {
    return [];
  }

  const results: NonNullable<EvolutionConnectivityReport['alternateHostnames']> = [];

  for (const hostname of alternates) {
    const dnsResult = await lookupHostname(hostname);
    const entry: NonNullable<EvolutionConnectivityReport['alternateHostnames']>[number] = {
      hostname,
      dns: dnsResult,
      suggestedUrl: `${target.protocol}://${hostname}:${target.port}`,
    };

    if (dnsResult.addresses.length > 0) {
      entry.tcp = await probeTcp(hostname, target.port);
    }

    results.push(entry);
  }

  if (configuredBaseUrl.includes('evolution-api')) {
    return results;
  }

  return results;
}

export async function probeEvolutionConnectivity(
  configuredBaseUrl: string,
  requestPath = '/',
  options?: { includeHttpProbes?: boolean; includeAlternates?: boolean },
): Promise<EvolutionConnectivityReport> {
  const target = parseEvolutionTarget(configuredBaseUrl, requestPath);
  const dnsResult = await lookupHostname(target.hostname);
  const tcpResult =
    dnsResult.addresses.length > 0
      ? await probeTcp(target.hostname, target.port)
      : {
          hostname: target.hostname,
          port: target.port,
          success: false,
          error: dnsResult.error ?? 'Skipped TCP probe because DNS lookup failed',
          code: dnsResult.code ?? 'ENOTFOUND',
        };

  let httpHealth: HttpProbeResult | undefined;
  let httpRoot: HttpProbeResult | undefined;

  if (options?.includeHttpProbes && tcpResult.success) {
    httpHealth = await probeHttp(`${target.baseUrl}/health`);
    httpRoot = await probeHttp(`${target.baseUrl}/`);
  }

  const alternateHostnames = options?.includeAlternates
    ? await probeAlternateHostnames(target, configuredBaseUrl)
    : undefined;

  const suggestions = buildSuggestions(target, dnsResult, tcpResult, alternateHostnames);
  const reachable = Boolean(
    httpHealth?.success || (tcpResult.success && (httpRoot?.success || !options?.includeHttpProbes)),
  );

  return {
    configuredBaseUrl,
    resolvedUrl: `${target.baseUrl}${requestPath}`,
    host: target.hostname,
    port: target.port,
    protocol: target.protocol,
    dns: dnsResult,
    tcp: tcpResult,
    httpHealth,
    httpRoot,
    reachable,
    alternateHostnames,
    suggestions,
  };
}

export async function resolveEvolutionBaseUrl(configuredBaseUrl: string): Promise<{
  baseUrl: string;
  source: string;
  report: EvolutionConnectivityReport;
}> {
  const normalized = configuredBaseUrl.replace(/\/$/, '');
  const target = parseEvolutionTarget(normalized);
  const candidates: Array<{ url: string; source: string }> = [
    { url: normalized, source: 'configured' },
  ];

  for (const hostname of suggestEasyPanelEvolutionHostnames(target.hostname)) {
    const alternateUrl = `${target.protocol}://${hostname}:${target.port}`;
    if (!candidates.some((candidate) => candidate.url === alternateUrl)) {
      candidates.push({ url: alternateUrl, source: `easypanel-dns:${hostname}` });
    }
  }

  let lastReport: EvolutionConnectivityReport | null = null;

  for (const candidate of candidates) {
    const report = await probeEvolutionConnectivity(candidate.url, '/', {
      includeHttpProbes: true,
      includeAlternates: false,
    });
    lastReport = report;

    if (report.tcp.success) {
      return {
        baseUrl: candidate.url,
        source: candidate.source,
        report,
      };
    }
  }

  return {
    baseUrl: normalized,
    source: 'configured-unreachable',
    report:
      lastReport ??
      (await probeEvolutionConnectivity(normalized, '/', {
        includeHttpProbes: true,
        includeAlternates: true,
      })),
  };
}

let lastResolvedEvolutionBaseUrl: { configured: string; resolved: string; source: string } | null =
  null;

export function getResolvedEvolutionBaseUrl(): typeof lastResolvedEvolutionBaseUrl {
  return lastResolvedEvolutionBaseUrl;
}

export async function cacheResolvedEvolutionBaseUrl(
  configuredBaseUrl: string,
): Promise<{ baseUrl: string; source: string; report: EvolutionConnectivityReport }> {
  const resolved = await resolveEvolutionBaseUrl(configuredBaseUrl);
  lastResolvedEvolutionBaseUrl = {
    configured: configuredBaseUrl.replace(/\/$/, ''),
    resolved: resolved.baseUrl,
    source: resolved.source,
  };
  lastStartupReport = resolved.report;
  return resolved;
}


export async function runEvolutionRequestDiagnostics(
  configuredBaseUrl: string,
  requestPath: string,
): Promise<EvolutionConnectivityReport> {
  const report = await probeEvolutionConnectivity(configuredBaseUrl, requestPath, {
    includeHttpProbes: false,
    includeAlternates: true,
  });

  lastRequestReport = report;
  return report;
}

export function buildFetchFailureDetails(
  error: unknown,
  connectivity: EvolutionConnectivityReport,
  requestUrl: string,
  operation?: string,
): FetchFailureDetails & { operation?: string; requestUrl: string } {
  const extracted = extractNodeError(error);

  return {
    operation,
    requestUrl,
    error: extracted.error,
    cause: extracted.cause,
    code: extracted.code,
    stack: extracted.stack,
    connectivity,
  };
}
