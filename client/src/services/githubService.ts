import { FileNode } from '../types';

export interface GitHubRepoResult {
  files: FileNode[];
  defaultBranch: string;
  source: 'github_api' | 'archive_pipeline';
  rateLimitBypassed?: boolean;
  message?: string;
  count: number;
}

export function parseGitHubUrl(url: string): { owner: string; repo: string } | null {
  if (!url) return null;
  const match = url.match(/github\.com\/([^/]+)\/([^/]+)/);
  if (!match) return null;
  const owner = match[1];
  const repo = match[2].replace(/\.git$/, '').split('#')[0].split('?')[0];
  return { owner, repo };
}

export function getStoredGitHubToken(): string {
  try {
    return localStorage.getItem('repolens_github_token') || '';
  } catch (_) {
    return '';
  }
}

export function setStoredGitHubToken(token: string): void {
  try {
    if (token) {
      localStorage.setItem('repolens_github_token', token.trim());
    } else {
      localStorage.removeItem('repolens_github_token');
    }
  } catch (_) {}
}

export async function fetchRepositoryData(
  repoUrl: string,
  userToken?: string
): Promise<GitHubRepoResult> {
  const parsed = parseGitHubUrl(repoUrl);
  if (!parsed) {
    throw new Error('Invalid URL: Please provide a valid GitHub repository link (e.g., https://github.com/user/repo).');
  }

  const token = userToken || getStoredGitHubToken();
  const params = new URLSearchParams({
    owner: parsed.owner,
    repo: parsed.repo
  });
  if (token) {
    params.set('token', token);
  }

  const response = await fetch(`/api/github/repo?${params.toString()}`);
  
  if (!response.ok) {
    const errorJson = await response.json().catch(() => null);
    const msg = errorJson?.error || `Failed to fetch repository (${response.status})`;

    if (response.status === 403) {
      throw new Error(
        `GitHub API rate limit exceeded. ` +
        `You can provide a personal GitHub Token in Settings, or upload a ZIP archive of the repository.`
      );
    }
    if (response.status === 404) {
      throw new Error(
        `Repository not found: "${parsed.owner}/${parsed.repo}". ` +
        `If this is a private repository, please add a GitHub Personal Access Token.`
      );
    }
    throw new Error(msg);
  }

  const data: GitHubRepoResult = await response.json();
  if (!data.files || data.files.length === 0) {
    throw new Error(`No files found in repository "${parsed.owner}/${parsed.repo}".`);
  }

  return data;
}

export async function fetchFileContent(
  owner: string,
  repo: string,
  branch: string = 'main',
  filePath: string,
  userToken?: string
): Promise<string> {
  const token = userToken || getStoredGitHubToken();
  
  // 1. First attempt: server raw proxy
  try {
    const params = new URLSearchParams({
      owner,
      repo,
      branch,
      path: filePath
    });
    if (token) params.set('token', token);

    const res = await fetch(`/api/github/raw?${params.toString()}`);
    if (res.ok) {
      return await res.text();
    }
  } catch (err) {
    console.warn('Backend raw proxy error, attempting direct raw fetch:', err);
  }

  // 2. Direct raw.githubusercontent.com fallback
  try {
    const cleanRepo = repo.replace(/\.git$/, '');
    const directRes = await fetch(`https://raw.githubusercontent.com/${owner}/${cleanRepo}/${branch}/${filePath}`);
    if (directRes.ok) {
      return await directRes.text();
    }
  } catch (_) {}

  return 'Content unavailable or excluded.';
}
