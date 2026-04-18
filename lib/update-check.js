// Update-check module. Queries the GitHub Releases API for the latest tag,
// compares against the current package version, exposes in-memory state.
// No I/O side effects at import time — use createChecker() and call .check()
// (typically from a boot-time scheduler in server.js).

export function semverGt(a, b) {
  const parse = v => {
    if (typeof v !== 'string') return null;
    const m = v.replace(/^v/, '').match(/^(\d+)\.(\d+)\.(\d+)$/);
    if (!m) return null;
    return [+m[1], +m[2], +m[3]];
  };
  const pa = parse(a);
  const pb = parse(b);
  if (!pa || !pb) return false;
  for (let i = 0; i < 3; i++) {
    if (pa[i] > pb[i]) return true;
    if (pa[i] < pb[i]) return false;
  }
  return false;
}

const GITHUB_RELEASES_URL =
  'https://api.github.com/repos/DerRemo/claude-code-hub/releases/latest';

export function createChecker({
  current,
  fetch: fetchFn = globalThis.fetch,
  url = GITHUB_RELEASES_URL,
  timeoutMs = 10_000,
} = {}) {
  let state = {
    current,
    latest: null,
    publishedAt: null,
    url: null,
    changelogMd: null,
    isNewer: false,
    checkedAt: null,
    error: null,
  };

  async function check() {
    try {
      const res = await fetchFn(url, {
        headers: {
          'User-Agent': 'claude-code-hub',
          'Accept': 'application/vnd.github+json',
        },
        signal: AbortSignal.timeout ? AbortSignal.timeout(timeoutMs) : undefined,
      });
      if (!res.ok) throw new Error(`GitHub API ${res.status}`);
      const data = await res.json();
      const latestTag = String(data.tag_name || '').replace(/^v/, '');
      state = {
        current: state.current,
        latest: latestTag || null,
        publishedAt: data.published_at || null,
        url: data.html_url || null,
        changelogMd: data.body != null ? data.body : '',
        isNewer: latestTag ? semverGt(latestTag, state.current) : false,
        checkedAt: Date.now(),
        error: null,
      };
    } catch (err) {
      state = { ...state, error: err.message, checkedAt: Date.now() };
    }
  }

  return {
    check,
    getState() { return { ...state }; },
  };
}
