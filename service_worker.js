/* global chrome */

console.log("⚙️ CareTracker service worker loaded.");

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "fetchChartDetails") {
    const { member_id, member_name } = message.payload;
    fetchWithTimeout(
      "https://h4xqr89uik.execute-api.us-east-1.amazonaws.com/dev/",
      { member_id, member_name },
      10000 // 10 seconds timeout
    )
      .then((data) => sendResponse({ data }))
      .catch((err) => sendResponse({ error: err.message }));
    return true;
  }

  if (message.action === "fetchAuditDetails") {
    const { member_id, member_name } = message.payload;
    fetchWithTimeout(
      "https://xclgdxg33a.execute-api.us-east-1.amazonaws.com/dev",
      { member_id, member_name },
      10000 // 10 seconds timeout
    )
      .then((data) => sendResponse({ data }))
      .catch((err) => sendResponse({ error: err.message }));
    return true;
  }

  if (message.action === "fetchMRAnalysis") {
    const { member_id, member_name } = message.payload;
    fetchWithTimeout(
      "https://iag1sy7y08.execute-api.us-east-1.amazonaws.com/dev",
      { member_id, member_name },
      15000 // 15 seconds timeout (longer for analysis)
    )
      .then((data) => sendResponse({ data }))
      .catch((err) => sendResponse({ error: err.message }));
    return true;
  }
});

/**
 * Helper: fetch with timeout
 */
async function fetchWithTimeout(url, body, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return data;
  } catch (err) {
    if (err.name === "AbortError") {
      throw new Error(`⚠️ Request timed out after ${timeoutMs / 1000} seconds`);
    }
    throw new Error(`❌ Fetch failed: ${err.message}`);
  } finally {
    clearTimeout(timeout);
  }
}
