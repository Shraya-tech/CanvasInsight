// content.js — handles scraping, API calls, and floating button

(function () {
  if (window.__canvasInsightInjected) return;
  window.__canvasInsightInjected = true;

  // ── Canvas URL parser ─────────────────────────────────────────────────────
  function parseUrl(url) {
    const m = url.match(/^(https:\/\/[^/]+)\/courses\/(\d+)/);
    return m ? { baseUrl: m[1], courseId: m[2] } : null;
  }

  // ── Canvas API helpers ────────────────────────────────────────────────────
  async function cFetch(url) {
    const r = await fetch(url, { credentials: 'include', headers: { Accept: 'application/json' } });
    if (!r.ok) throw new Error(`Canvas API ${r.status}`);
    return r.json();
  }

  async function cFetchAll(url) {
    let results = [], next = url, limit = 8;
    while (next && limit-- > 0) {
      const r = await fetch(next, { credentials: 'include', headers: { Accept: 'application/json' } });
      if (!r.ok) break;
      const data = await r.json();
      results = results.concat(Array.isArray(data) ? data : [data]);
      const lh = r.headers.get('Link') || '';
      const m = lh.match(/<([^>]+)>;\s*rel="next"/);
      next = m ? m[1] : null;
    }
    return results;
  }

  async function getFiles(baseUrl, courseId) {
    try {
      const f = await cFetchAll(`${baseUrl}/api/v1/courses/${courseId}/files?per_page=100`);
      return f.map(x => ({ id: String(x.id), name: x.display_name || x.filename || 'File', contentType: x['content-type'] || '', size: x.size || 0, url: x.url || '' }));
    } catch { return []; }
  }

  async function getModules(baseUrl, courseId) {
    try {
      const m = await cFetchAll(`${baseUrl}/api/v1/courses/${courseId}/modules?include[]=items&per_page=50`);
      return m.map(x => ({ name: x.name || 'Module', items: (x.items || []).map(i => ({ id: String(i.content_id || i.id), title: i.title, type: i.type, apiUrl: i.url })) }));
    } catch { return []; }
  }

  async function getSyllabus(baseUrl, courseId) {
    try {
      const d = await cFetch(`${baseUrl}/api/v1/courses/${courseId}?include[]=syllabus_body`);
      if (!d.syllabus_body) return null;
      const t = document.createElement('div'); t.innerHTML = d.syllabus_body;
      return (t.innerText || '').trim().slice(0, 2000);
    } catch { return null; }
  }

  async function getPageText(apiUrl) {
    try {
      const d = await cFetch(apiUrl);
      const t = document.createElement('div'); t.innerHTML = d.body || '';
      return (t.innerText || '').trim().slice(0, 2500);
    } catch { return ''; }
  }

  async function getFileText(file) {
    const ext = (file.name || '').split('.').pop().toLowerCase();
    if (!['txt','md','html','htm','csv'].includes(ext) || !file.url) return `[${file.name} — binary]`;
    try {
      const r = await fetch(file.url, { credentials: 'include' });
      return r.ok ? (await r.text()).slice(0, 3000) : `[${file.name} — unreadable]`;
    } catch { return `[${file.name} — error]`; }
  }

  // ── Scrape posts ──────────────────────────────────────────────────────────
  function scrape() {
    // ── Course title ──
    const courseTitle =
      document.querySelector('#breadcrumbs li:nth-child(2) a')?.innerText?.trim() ||
      document.querySelector('#breadcrumbs .ellipsible')?.innerText?.trim() ||
      document.querySelector('[aria-label="breadcrumb"] a:nth-child(2)')?.innerText?.trim() ||
      document.querySelector('nav[aria-label="breadcrumb"] li:nth-child(2)')?.innerText?.trim() ||
      'Unknown Course';

    // ── Discussion title ──
    const discussionTitle =
      document.querySelector('[data-testid="discussion-topic-container"] h1')?.innerText?.trim() ||
      document.querySelector('h1.discussion-title')?.innerText?.trim() ||
      document.querySelector('[class*="DiscussionTopicTitle"]')?.innerText?.trim() ||
      document.querySelector('h1')?.innerText?.trim() ||
      document.title?.replace(/\s*[-|].*$/i, '').trim() ||
      'Unknown Discussion';

    // ── Discussion prompt ──
    const discussionPrompt =
      document.querySelector('[data-testid="discussion-topic-container"] [data-testid="message-body"]')?.innerText?.trim() ||
      document.querySelector('#discussion_topic .message')?.innerText?.trim() ||
      document.querySelector('[class*="DiscussionTopicContainer"] [class*="message"]')?.innerText?.trim() ||
      '';

    // ── Posts: try many Canvas DOM strategies ──
    const posts = [];
    const seen = new Set(); // deduplicate by body content

    function addPost(author, body, timestamp) {
      const clean = body.trim();
      if (clean.length < 10) return;
      const key = (author + '|' + clean.slice(0, 80)).toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      posts.push({ author: author || 'Unknown Student', body: clean, timestamp: timestamp || '' });
    }

    // Strategy 1: Canvas new React UI — data-testid="discussion-entry"
    const entryEls = document.querySelectorAll('[data-testid="discussion-entry"]');
    if (entryEls.length) {
      entryEls.forEach((el, i) => {
        const author =
          el.querySelector('[data-testid="author-name"]')?.innerText?.trim() ||
          el.querySelector('[class*="AuthorName"]')?.innerText?.trim() ||
          el.querySelector('[class*="author"]')?.innerText?.trim() ||
          `Student ${i + 1}`;
        const body =
          el.querySelector('[data-testid="message-body"]')?.innerText?.trim() ||
          el.querySelector('[class*="MessageBody"]')?.innerText?.trim() ||
          el.querySelector('[class*="message-body"]')?.innerText?.trim() ||
          el.innerText?.trim() || '';
        const ts = el.querySelector('time')?.getAttribute('datetime') || '';
        addPost(author, body, ts);
      });
    }

    // Strategy 2: data-testid="reply"
    if (!posts.length) {
      document.querySelectorAll('[data-testid="reply"]').forEach((el, i) => {
        const author =
          el.querySelector('[data-testid="author-name"]')?.innerText?.trim() ||
          `Student ${i + 1}`;
        const body = el.querySelector('[data-testid="message-body"]')?.innerText?.trim() || el.innerText?.trim() || '';
        addPost(author, body, el.querySelector('time')?.getAttribute('datetime') || '');
      });
    }

    // Strategy 3: old Canvas UI — .discussion_entry
    if (!posts.length) {
      document.querySelectorAll('.discussion_entry').forEach((el, i) => {
        const author =
          el.querySelector('.author')?.innerText?.trim() ||
          el.querySelector('.user_name')?.innerText?.trim() ||
          `Student ${i + 1}`;
        const body =
          el.querySelector('.message.user_content')?.innerText?.trim() ||
          el.querySelector('.entry-content')?.innerText?.trim() ||
          el.innerText?.trim() || '';
        addPost(author, body, el.querySelector('time')?.getAttribute('datetime') || '');
      });
    }

    // Strategy 4: any element with data-testid containing "entry" or "post"
    if (!posts.length) {
      const dynamicEntries = document.querySelectorAll('[data-testid*="entry"], [data-testid*="post"], [data-testid*="reply"]');
      dynamicEntries.forEach((el, i) => {
        // Skip the discussion prompt container
        if (el.closest('[data-testid="discussion-topic-container"]')) return;
        const authorEl = el.querySelector('[data-testid*="author"], [class*="author"], [class*="Author"]');
        const author = authorEl?.innerText?.trim() || `Student ${i + 1}`;
        const bodyEl = el.querySelector('[data-testid*="body"], [data-testid*="message"], [class*="body"], [class*="message"]');
        const body = bodyEl?.innerText?.trim() || el.innerText?.trim() || '';
        addPost(author, body, el.querySelector('time')?.getAttribute('datetime') || '');
      });
    }

    // Strategy 5: Canvas React class-based selectors (class names often contain these patterns)
    if (!posts.length) {
      const classPatterns = [
        '[class*="DiscussionEntry"]',
        '[class*="discussion-entry"]',
        '[class*="DiscussionPost"]',
        '[class*="discussion-post"]',
        '[class*="ThreadingToolbar"]',
      ];
      for (const pattern of classPatterns) {
        const els = document.querySelectorAll(pattern);
        if (els.length) {
          els.forEach((el, i) => {
            const author = el.querySelector('[class*="Author"], [class*="author"]')?.innerText?.trim() || `Student ${i + 1}`;
            const body = el.querySelector('[class*="Body"], [class*="body"], [class*="Message"], [class*="message"]')?.innerText?.trim() || el.innerText?.trim() || '';
            addPost(author, body, el.querySelector('time')?.getAttribute('datetime') || '');
          });
          if (posts.length) break;
        }
      }
    }

    // Strategy 6: all [data-testid="message-body"] elements (grab each with nearest author sibling)
    if (!posts.length) {
      document.querySelectorAll('[data-testid="message-body"]').forEach((bodyEl, i) => {
        // walk up to find an author near this body
        let authorEl = null;
        let cursor = bodyEl.parentElement;
        for (let depth = 0; depth < 8 && cursor; depth++, cursor = cursor.parentElement) {
          authorEl = cursor.querySelector('[data-testid="author-name"], [class*="author"], [class*="Author"]');
          if (authorEl && authorEl !== bodyEl) break;
        }
        const author = authorEl?.innerText?.trim() || `Student ${i + 1}`;
        const body = bodyEl.innerText?.trim() || '';
        addPost(author, body, bodyEl.closest('[data-testid]')?.querySelector('time')?.getAttribute('datetime') || '');
      });
    }

    // Strategy 7: Canvas API fallback — fetch entries via REST if DOM yields nothing
    // (handled async separately, this sync fallback grabs raw text)
    if (!posts.length) {
      const containers = [
        '#discussion_entries',
        '[data-component="DiscussionEntries"]',
        '[class*="DiscussionEntries"]',
        '[id*="discussion"]',
      ];
      for (const sel of containers) {
        const el = document.querySelector(sel);
        if (el) {
          const blob = el.innerText?.trim() || '';
          if (blob.length > 50) {
            posts.push({ author: 'Full Discussion (raw)', body: blob.slice(0, 10000), timestamp: '' });
            break;
          }
        }
      }
    }

    return { courseTitle, discussionTitle, discussionPrompt, posts, url: window.location.href, scrapedAt: new Date().toISOString() };
  }

  // ── API-based post fetch (Canvas REST) ────────────────────────────────────
  // Fetches posts via the Canvas API as a reliable fallback — called in runAnalysis
  async function fetchPostsViaAPI(baseUrl, courseId) {
    const urlMatch = window.location.href.match(/\/discussion_topics\/(\d+)/);
    if (!urlMatch) return [];
    const topicId = urlMatch[1];

    try {
      const entries = await cFetchAll(`${baseUrl}/api/v1/courses/${courseId}/discussion_topics/${topicId}/entries?per_page=50`);
      const posts = [];

      for (const entry of entries) {
        const author = entry.user?.display_name || entry.user_name || 'Unknown Student';
        const body = (entry.message || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        if (body.length > 10) {
          posts.push({ author, body, timestamp: entry.created_at || '' });
        }
        // Also fetch replies to this entry
        if (entry.has_children || entry.recent_replies?.length) {
          try {
            const replies = await cFetchAll(`${baseUrl}/api/v1/courses/${courseId}/discussion_topics/${topicId}/entries/${entry.id}/replies?per_page=50`);
            for (const reply of replies) {
              const rAuthor = reply.user?.display_name || reply.user_name || 'Unknown Student';
              const rBody = (reply.message || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
              if (rBody.length > 10) posts.push({ author: rAuthor, body: rBody, timestamp: reply.created_at || '' });
            }
          } catch {}
        }
      }
      return posts;
    } catch (e) {
      console.warn('API fetch failed:', e);
      return [];
    }
  }

  // ── Build materials ───────────────────────────────────────────────────────
  async function getMaterials(baseUrl, courseId, selectedFileIds, includePages) {
    const [allFiles, modules, syllabus] = await Promise.all([
      getFiles(baseUrl, courseId),
      includePages ? getModules(baseUrl, courseId) : [],
      getSyllabus(baseUrl, courseId),
    ]);

    const pageContents = [];
    if (includePages) {
      for (const mod of modules) {
        for (const item of mod.items) {
          if (item.type === 'Page' && item.apiUrl) {
            const content = await getPageText(item.apiUrl);
            if (content) pageContents.push({ title: item.title, module: mod.name, content });
          }
        }
      }
    }

    const selectedFiles = allFiles.filter(f => selectedFileIds.includes(f.id));
    const fileContents = [];
    for (const file of selectedFiles) {
      fileContents.push({ name: file.name, contentType: file.contentType, content: await getFileText(file) });
    }

    return { syllabus, modules, pageContents, selectedFiles: fileContents, allFiles };
  }

  // ── Call Anthropic ────────────────────────────────────────────────────────
  async function callClaude(apiKey, prompt) {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4000,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      throw new Error(e.error?.message || `Anthropic API Error ${res.status}`);
    }
    const d = await res.json();
    const raw = d.content?.[0]?.text || '{}';
    return JSON.parse(raw.replace(/```json[\s\S]*?```|```/g, '').trim());
  }

  // ── Build prompt ──────────────────────────────────────────────────────────
  function buildPrompt(discussionData, materials, outcomes) {
    const { courseTitle, discussionTitle, discussionPrompt, posts } = discussionData;
    const hasPosts = posts && posts.length > 0;

    const studentMap = {};
    (posts || []).forEach(p => {
      if (!studentMap[p.author]) studentMap[p.author] = [];
      studentMap[p.author].push(p.body);
    });
    const studentEntries = Object.entries(studentMap);

    const postsText = hasPosts
      ? studentEntries.map(([name, bodies], i) => `[Student ${i + 1}] ${name}:\n${bodies.join('\n---\n')}`).join('\n\n')
      : '[No student posts captured — please analyze based on course materials and discussion topic]';

    let mat = '';
    if (materials) {
      const parts = [];
      if (materials.syllabus) parts.push(`=== SYLLABUS ===\n${materials.syllabus.slice(0, 1500)}`);
      if (materials.pageContents?.length) parts.push(`=== LECTURE PAGES ===\n${materials.pageContents.map(p => `--- ${p.title} ---\n${p.content}`).join('\n\n')}`);
      if (materials.selectedFiles?.length) parts.push(`=== COURSE FILES ===\n${materials.selectedFiles.map(f => `--- ${f.name} ---\n${f.content}`).join('\n\n')}`);
      if (parts.length) mat = `\n--- COURSE MATERIALS ---\n${parts.join('\n\n')}\n--- END MATERIALS ---\n`;
    }

    return `You are an expert educational AI for professors using Canvas LMS.
Analyze the following and produce a professor comprehension report.

Course: "${courseTitle}"
Discussion: "${discussionTitle}"
${discussionPrompt ? `Prompt: "${discussionPrompt}"` : ''}
${outcomes ? `Expected Outcomes: "${outcomes}"` : ''}
${mat}
Total Students: ${studentEntries.length}

--- STUDENT RESPONSES ---
${postsText}
--- END ---

Return ONLY valid JSON, no markdown, no extra text. Use exactly this structure:

{
  "discussionSummary": "2-3 sentence overview of class performance",
  "overallComprehension": 74,
  "totalParticipants": ${hasPosts ? studentEntries.length : 0},
  "topicsCoveredWell": ["topic students understood well"],
  "topicsNeedingReview": [
    {"topic": "Concept name", "explanation": "what they missed or misunderstood", "studentsAffected": ["Name1", "Name2"]}
  ],
  "students": [
    {"name": "Full Name", "comprehensionLevel": "excellent", "comprehensionScore": 85, "strengths": "what they got right", "gaps": "what they missed", "recommendedAction": "none", "summary": "1-2 sentence assessment"}
  ],
  "professorActionItems": [
    {"priority": "high", "action": "what to do", "reason": "why"}
  ],
  "suggestedNextDiscussionQuestions": ["follow-up question targeting gaps"]
}`;
  }

  // ── Main analysis function ────────────────────────────────────────────────
  async function runAnalysis(outcomes, selectedFileIds, includePages) {
    const statusEl = document.getElementById('ci-status');
    const setStatus = txt => { if (statusEl) { statusEl.style.display = 'block'; statusEl.textContent = txt; } };
    const hideStatus = () => setTimeout(() => { if (statusEl) statusEl.style.display = 'none'; }, 5000);

    try {
      // 1. Get API key
      const stored = await new Promise(r => chrome.storage.local.get('apiKey', r));
      const apiKey = stored.apiKey;
      if (!apiKey) {
        setStatus('❌ No API key — click the extension icon → ⚙ Settings → paste key → Save');
        hideStatus();
        return;
      }

      // 2. Scrape
      setStatus('⏳ Reading discussion posts…');
      const discussionData = scrape();

      // 2b. If DOM scrape failed, try Canvas API directly
      if (!discussionData.posts.length && parsed) {
        setStatus('⏳ Fetching posts via Canvas API…');
        try {
          const apiPosts = await fetchPostsViaAPI(parsed.baseUrl, parsed.courseId);
          if (apiPosts.length) {
            discussionData.posts = apiPosts;
            console.log(`[CanvasInsight] Got ${apiPosts.length} posts via API`);
          }
        } catch (e) {
          console.warn('[CanvasInsight] API post fetch failed:', e);
        }
      }

      // 3. Materials
      const parsed = parseUrl(window.location.href);
      let materials = null;
      if (parsed) {
        setStatus('⏳ Fetching course materials…');
        try { materials = await getMaterials(parsed.baseUrl, parsed.courseId, selectedFileIds, includePages); }
        catch (e) { console.warn('Materials error:', e); }
      }

      // 4. Build prompt and call Claude
      setStatus('⏳ Analyzing with Claude AI…');
      const prompt = buildPrompt(discussionData, materials, outcomes);
      const result = await callClaude(apiKey, prompt);

      // 5. Save everything to storage FIRST, then open dashboard
      setStatus('✅ Saving report…');
      await new Promise((resolve, reject) => {
        chrome.storage.local.set({
          lastResult: result,
          lastData: discussionData,
          lastMaterials: materials || null
        }, () => {
          if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
          else resolve();
        });
      });

      // 6. Save to history (fire and forget)
      chrome.runtime.sendMessage({ action: 'SAVE_HISTORY', discussionData, result, materials });

      // 7. Open dashboard AFTER storage confirmed written
      setStatus('✅ Done! Opening report…');
      window.open(chrome.runtime.getURL('dashboard.html'), '_blank');

    } catch (e) {
      setStatus('❌ ' + e.message);
      hideStatus();
    }
  }

  // ── Message listener (for popup) ──────────────────────────────────────────
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.action === 'SCRAPE_DISCUSSION') {
      const data = scrape();
      if (!data.posts.length) {
        const p = parseUrl(window.location.href);
        if (p) {
          fetchPostsViaAPI(p.baseUrl, p.courseId)
            .then(apiPosts => {
              if (apiPosts.length) data.posts = apiPosts;
              sendResponse({ success: true, data });
            })
            .catch(() => sendResponse({ success: true, data }));
          return true; // async
        }
      }
      sendResponse({ success: true, data });
      return true;
    }
    if (msg.action === 'FETCH_COURSE_FILES') {
      const p = parseUrl(window.location.href);
      if (!p) { sendResponse({ success: false }); return true; }
      Promise.all([getFiles(p.baseUrl, p.courseId), getModules(p.baseUrl, p.courseId)])
        .then(([files, modules]) => sendResponse({ success: true, files, modules }))
        .catch(e => sendResponse({ success: false, error: e.message }));
      return true;
    }
    if (msg.action === 'FETCH_MATERIALS') {
      const p = parseUrl(window.location.href);
      if (!p) { sendResponse({ success: false }); return true; }
      getMaterials(p.baseUrl, p.courseId, msg.selectedFileIds || [], msg.includePages !== false)
        .then(materials => sendResponse({ success: true, materials }))
        .catch(e => sendResponse({ success: false, error: e.message }));
      return true;
    }
    // Popup triggers analysis through content script too
    if (msg.action === 'RUN_ANALYSIS') {
      runAnalysis(msg.outcomes || '', msg.selectedFileIds || [], msg.includePages !== false);
      sendResponse({ success: true });
      return true;
    }
  });

  // ── Floating button ───────────────────────────────────────────────────────
  function injectButton() {
    if (document.getElementById('ci-float-panel')) return;
    const panel = document.createElement('div');
    panel.id = 'ci-float-panel';
    panel.innerHTML = `
<style>
#ci-float-panel{position:fixed;bottom:24px;right:24px;z-index:99999;font-family:'Inter',system-ui,sans-serif;display:flex;flex-direction:column;align-items:flex-end;gap:10px}
#ci-card{display:none;background:#0a0a0a;border:1px solid #7f1d1d;border-radius:14px;width:340px;box-shadow:0 12px 40px rgba(0,0,0,.9);overflow:hidden}
#ci-card-hdr{background:#150505;padding:12px 16px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #3f0d0d}
#ci-card-hdr span{font-weight:700;font-size:13px;color:#fc8080}
#ci-x{background:none;border:none;color:#666;font-size:18px;cursor:pointer;padding:0;line-height:1}
#ci-body{padding:14px 16px}
.ci-lbl{font-size:10px;font-weight:600;color:#555;text-transform:uppercase;letter-spacing:.08em;margin-bottom:5px;display:block}
#ci-outcomes{width:100%;background:#000;border:1px solid #2a2a2a;border-radius:7px;padding:8px 10px;color:#e2e8f0;font-size:12px;font-family:inherit;resize:none;outline:none;line-height:1.5;margin-bottom:12px;box-sizing:border-box}
#ci-outcomes:focus{border-color:#e53e3e}
.ci-chk-row{display:flex;align-items:center;gap:8px;margin-bottom:10px}
.ci-chk-row input{accent-color:#e53e3e;cursor:pointer;width:14px;height:14px}
.ci-chk-row label{font-size:12px;color:#94a3b8;cursor:pointer}
#ci-files{background:#000;border:1px solid #2a2a2a;border-radius:8px;max-height:140px;overflow-y:auto;margin-bottom:12px}
.ci-fr{display:flex;align-items:center;gap:8px;padding:7px 10px;border-bottom:1px solid #111;cursor:pointer}
.ci-fr:last-child{border-bottom:none}
.ci-fr:hover{background:#150505}
.ci-fr input{accent-color:#e53e3e;width:13px;height:13px;cursor:pointer;flex-shrink:0}
.ci-fn{font-size:11px;color:#94a3b8;flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ci-fs{font-size:10px;color:#333}
.ci-mt{padding:12px;text-align:center;color:#444;font-size:12px}
.ci-actions{display:flex;gap:8px}
#ci-cancel{flex:1;background:transparent;border:1px solid #2a2a2a;color:#555;border-radius:7px;padding:9px;cursor:pointer;font-size:12px;font-weight:600}
#ci-go{flex:2;background:linear-gradient(135deg,#c53030,#e53e3e);border:none;border-radius:7px;padding:9px 14px;color:#fff;font-size:12px;font-weight:700;cursor:pointer}
#ci-go:hover{opacity:.88}
#ci-status{font-size:11px;color:#fc8080;display:none;background:#0a0a0a;border:1px solid #3f0d0d;border-radius:8px;padding:10px 14px}
#ci-main{display:flex;align-items:center;gap:9px;background:linear-gradient(135deg,#c53030,#e53e3e);border:none;border-radius:50px;padding:11px 20px;color:#fff;font-size:13px;font-weight:700;cursor:pointer;box-shadow:0 4px 20px rgba(229,62,62,.4);white-space:nowrap;font-family:inherit}
#ci-main:hover{transform:translateY(-2px);box-shadow:0 6px 28px rgba(229,62,62,.6)}
#ci-badge{background:rgba(255,255,255,.2);border-radius:20px;padding:2px 8px;font-size:11px}
</style>
<div id="ci-card">
  <div id="ci-card-hdr"><span>📊 CanvasInsight</span><button id="ci-x">×</button></div>
  <div id="ci-body">
    <span class="ci-lbl">Expected Learning Outcomes <span style="color:#444;font-weight:400;text-transform:none">(optional)</span></span>
    <textarea id="ci-outcomes" rows="2" placeholder="e.g. Students should understand encoding types…"></textarea>
    <div class="ci-chk-row"><input type="checkbox" id="ci-pages" checked/><label for="ci-pages">Include Canvas lecture pages & notes</label></div>
    <span class="ci-lbl">Course Files <span style="color:#444;font-weight:400;text-transform:none">— check to include</span></span>
    <div id="ci-files"><div class="ci-mt">⏳ Loading files…</div></div>
    <div class="ci-actions">
      <button id="ci-cancel">Cancel</button>
      <button id="ci-go">📊 Analyze Now</button>
    </div>
  </div>
</div>
<div id="ci-status"></div>
<button id="ci-main"><span>📊 Analyze This Discussion</span><span id="ci-badge">…</span></button>`;

    document.body.appendChild(panel);

    // Badge
    const p = scrape();
    document.getElementById('ci-badge').textContent = p.posts.length > 0 ? `${p.posts.length} posts` : 'ready';

    // Load files
    (async () => {
      const box = document.getElementById('ci-files');
      const parsed = parseUrl(window.location.href);
      if (!parsed) { box.innerHTML = '<div class="ci-mt">Could not detect course</div>'; return; }
      try {
        const files = await getFiles(parsed.baseUrl, parsed.courseId);
        if (!files.length) { box.innerHTML = '<div class="ci-mt">No files in this course</div>'; return; }
        const icon = n => { const e=(n||'').split('.').pop().toLowerCase(); return e==='pdf'?'📄':['ppt','pptx'].includes(e)?'📊':['doc','docx'].includes(e)?'📝':'📎'; };
        const sz = b => !b?'':b<1024?b+'B':b<1048576?Math.round(b/1024)+'KB':(b/1048576).toFixed(1)+'MB';
        box.innerHTML = files.map(f=>`<div class="ci-fr"><input type="checkbox" data-id="${f.id}" class="ci-cb"/><span>${icon(f.name)}</span><span class="ci-fn" title="${f.name}">${f.name}</span><span class="ci-fs">${sz(f.size)}</span></div>`).join('');
        box.querySelectorAll('.ci-fr').forEach(r => r.onclick = e => { if(e.target.type!=='checkbox'){const cb=r.querySelector('.ci-cb');cb.checked=!cb.checked;} });
      } catch(e) { box.innerHTML = `<div class="ci-mt" style="color:#f87171">Error loading files</div>`; }
    })();

    // Events
    const card = document.getElementById('ci-card');
    document.getElementById('ci-main').onclick = () => { card.style.display = card.style.display === 'block' ? 'none' : 'block'; };
    document.getElementById('ci-x').onclick = () => { card.style.display = 'none'; };
    document.getElementById('ci-cancel').onclick = () => { card.style.display = 'none'; };
    document.getElementById('ci-go').onclick = () => {
      card.style.display = 'none';
      const outcomes = document.getElementById('ci-outcomes').value.trim();
      const fileIds = Array.from(document.querySelectorAll('.ci-cb:checked')).map(c => c.dataset.id);
      const pages = document.getElementById('ci-pages').checked;
      runAnalysis(outcomes, fileIds, pages);
    };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', injectButton);
  else injectButton();

})();
