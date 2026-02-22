// canvas-api.js — Fetches course files and modules from Canvas LMS API
// Canvas uses the user's existing session cookie — no extra login needed.

/**
 * Extract the Canvas base URL and course ID from the current page URL.
 * e.g. https://university.instructure.com/courses/12345/discussion_topics/67890
 */
function parseCanvasUrl(url) {
  const match = url.match(/^(https:\/\/[^/]+)\/courses\/(\d+)/);
  if (!match) return null;
  return { baseUrl: match[1], courseId: match[2] };
}

/**
 * Fetch JSON from a Canvas API endpoint using the session cookie (credentials: 'include').
 */
async function canvasFetch(url) {
  const res = await fetch(url, {
    credentials: 'include',
    headers: { 'Accept': 'application/json' },
  });
  if (!res.ok) throw new Error(`Canvas API ${res.status}: ${url}`);
  return res.json();
}

/**
 * Fetch all pages of a paginated Canvas API endpoint.
 */
async function canvasFetchAll(url) {
  let results = [];
  let nextUrl = url;
  let pageLimit = 10; // safety cap

  while (nextUrl && pageLimit-- > 0) {
    const res = await fetch(nextUrl, {
      credentials: 'include',
      headers: { 'Accept': 'application/json' },
    });
    if (!res.ok) break;
    const data = await res.json();
    results = results.concat(Array.isArray(data) ? data : [data]);

    // Canvas uses Link header for pagination
    const linkHeader = res.headers.get('Link') || '';
    const nextMatch = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
    nextUrl = nextMatch ? nextMatch[1] : null;
  }

  return results;
}

/**
 * Fetch the course syllabus body text.
 */
async function fetchSyllabus(baseUrl, courseId) {
  try {
    const data = await canvasFetch(`${baseUrl}/api/v1/courses/${courseId}?include[]=syllabus_body`);
    if (!data.syllabus_body) return null;
    // Strip HTML tags
    const tmp = document.createElement('div');
    tmp.innerHTML = data.syllabus_body;
    return tmp.innerText?.trim() || null;
  } catch {
    return null;
  }
}

/**
 * Fetch course modules and their items (pages, files, assignments).
 */
async function fetchModules(baseUrl, courseId) {
  try {
    const modules = await canvasFetchAll(
      `${baseUrl}/api/v1/courses/${courseId}/modules?include[]=items&per_page=50`
    );
    return modules.map(m => ({
      name: m.name,
      items: (m.items || []).map(item => ({
        id: item.content_id || item.id,
        title: item.title,
        type: item.type, // 'File', 'Page', 'Assignment', 'ExternalUrl', etc.
        url: item.html_url,
        apiUrl: item.url,
      })),
    }));
  } catch {
    return [];
  }
}

/**
 * Fetch the text content of a Canvas Page (wiki page).
 */
async function fetchPageContent(pageApiUrl) {
  try {
    const data = await canvasFetch(pageApiUrl);
    const tmp = document.createElement('div');
    tmp.innerHTML = data.body || '';
    return tmp.innerText?.trim() || '';
  } catch {
    return '';
  }
}

/**
 * Fetch the list of files in the course.
 */
async function fetchFileList(baseUrl, courseId) {
  try {
    const files = await canvasFetchAll(
      `${baseUrl}/api/v1/courses/${courseId}/files?per_page=100&sort=updated_at&order=desc`
    );
    return files.map(f => ({
      id: f.id,
      name: f.display_name || f.filename,
      contentType: f.content-type || f['content-type'] || f.mime_class || '',
      size: f.size,
      url: f.url,
      updatedAt: f.updated_at,
    }));
  } catch {
    return [];
  }
}

/**
 * Fetch text content from a plain-text or HTML file URL.
 * Only attempts for text-readable file types.
 */
async function fetchFileText(fileUrl, contentType, fileName) {
  const readable = [
    'text/plain', 'text/html', 'text/markdown',
    'application/json',
  ];
  const ext = (fileName || '').split('.').pop().toLowerCase();
  const readableExt = ['txt', 'md', 'html', 'htm', 'csv'];

  if (!readable.some(t => (contentType||'').includes(t)) && !readableExt.includes(ext)) {
    return null; // PDFs, DOCX, PPTX — skip for now, just use metadata
  }

  try {
    const res = await fetch(fileUrl, { credentials: 'include' });
    if (!res.ok) return null;
    const text = await res.text();
    return text.slice(0, 3000); // Cap at 3000 chars per file
  } catch {
    return null;
  }
}

/**
 * MAIN: Fetch all course materials relevant to a given discussion.
 * Returns a structured object the AI can use.
 */
async function fetchCourseMaterials(pageUrl, selectedFileIds = []) {
  const parsed = parseCanvasUrl(pageUrl);
  if (!parsed) throw new Error('Could not parse Canvas URL');

  const { baseUrl, courseId } = parsed;

  // Run parallel fetches
  const [syllabus, modules, allFiles] = await Promise.all([
    fetchSyllabus(baseUrl, courseId),
    fetchModules(baseUrl, courseId),
    fetchFileList(baseUrl, courseId),
  ]);

  // Fetch content for Canvas Pages found in modules
  const pageContents = [];
  for (const mod of modules) {
    for (const item of mod.items) {
      if (item.type === 'Page' && item.apiUrl) {
        const content = await fetchPageContent(item.apiUrl);
        if (content) {
          pageContents.push({ title: item.title, module: mod.name, content: content.slice(0, 2000) });
        }
      }
    }
  }

  // For selected files — fetch readable ones
  const selectedFiles = allFiles.filter(f => selectedFileIds.includes(f.id));
  const fileContents = [];
  for (const file of selectedFiles) {
    const text = await fetchFileText(file.url, file.contentType, file.name);
    fileContents.push({
      name: file.name,
      contentType: file.contentType,
      content: text || `[File: ${file.name} — content not extractable, used as reference]`,
    });
  }

  return {
    courseId,
    baseUrl,
    syllabus,
    modules,
    pageContents,
    allFiles,
    selectedFiles: fileContents,
  };
}

// Expose for use in content.js and popup.js
window.__canvasApi = {
  parseCanvasUrl,
  fetchCourseMaterials,
  fetchFileList,
};
