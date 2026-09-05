/**
 * Octane-ZAI usage handler
 *
 * Octane-ZAI is a self-hosted sidecar (docker-compose service `octane-zai`)
 * fronting Z.ai/GLM accounts. Its /v1/usage endpoint (REPO A, Go) aggregates
 * per-account quota and returns:
 *   { accounts: [{ name, plan, quotas, points, fetchedLive, error }],
 *     generatedAt: "<ISO>" }
 *
 * This handler flattens that payload into the shared quota-tracker contract:
 * every (account, quota-label) pair becomes one row keyed "<account> · <label>".
 * Fail-open: any fetch/parse error degrades to { message } — never throws.
 */

import { U, fetchWithTimeout } from "./shared.js";

// Default points at the compose-internal sidecar host; registry carries the
// same URL — env wins for local/dev overrides.
const DEFAULT_USAGE_URL = "http://octane-zai:18787/v1/usage";

function usageUrl() {
  return process.env.OCTANE_ZAI_USAGE_URL || U("octane-zai").url || DEFAULT_USAGE_URL;
}

/**
 * Pure: merge the sidecar payload into the quota-tracker contract.
 * Live accounts only — rows from accounts with fetchedLive=false are skipped.
 * @param {{accounts?: Array, generatedAt?: string}} payload
 * @returns {{plan?: string, quotas?: Object, message?: string}}
 */
export function mergeAccounts(payload) {
  const accounts = Array.isArray(payload?.accounts) ? payload.accounts : [];
  const quotas = {};
  const errors = [];

  for (const account of accounts) {
    if (!account || typeof account !== "object") continue;
    const name = typeof account.name === "string" && account.name ? account.name : "account";
    if (account.error) errors.push(`${name}: ${account.error}`);
    if (!account.fetchedLive || !account.quotas || typeof account.quotas !== "object") continue;
    for (const [label, quota] of Object.entries(account.quotas)) {
      if (!quota || typeof quota !== "object") continue;
      quotas[`${name} · ${label}`] = {
        used: quota.used ?? 0,
        total: quota.total ?? 0,
        remaining: quota.remaining ?? 0,
        remainingPercentage: quota.remainingPercentage ?? 0,
        resetAt: quota.resetAt ?? null,
        unlimited: quota.unlimited === true,
      };
    }
  }

  if (Object.keys(quotas).length === 0) {
    const detail = errors.length > 0 ? errors.join("; ") : "no live account data";
    const firstPlan = accounts.find((a) => a?.plan)?.plan;
    return {
      plan: firstPlan || "Octane ZAI",
      message: `Octane-ZAI usage unavailable (${detail}).`,
    };
  }

  // Combined plan: single live account → that account's plan; otherwise "<n> akun ZAI".
  const live = accounts.filter((a) => a?.fetchedLive);
  const firstPlan = live.find((a) => a?.plan)?.plan || "Octane ZAI";
  const plan = live.length === 1 ? firstPlan : `${live.length} akun ZAI`;
  return { plan, quotas };
}

/**
 * Fetch usage from the Octane-ZAI sidecar. The sidecar is noAuth — the Bearer
 * header is sent when a token exists but may be empty.
 */
export async function getOctaneZaiUsage(accessToken, providerSpecificData, proxyOptions = null) {
  try {
    const response = await fetchWithTimeout(
      usageUrl(),
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken || ""}`,
          Accept: "application/json",
        },
      },
      10000,
      proxyOptions,
    );

    if (!response.ok) {
      return { message: `Octane-ZAI usage API error (${response.status}).` };
    }

    const payload = await response.json();
    return mergeAccounts(payload);
  } catch (error) {
    // Fail-open: sidecar down / timeout → message, never throw.
    return { message: `Octane-ZAI usage error: ${error.message}` };
  }
}

export default getOctaneZaiUsage;
