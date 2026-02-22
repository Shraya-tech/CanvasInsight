// ── Score color helpers ────────────────────────────────
function scoreColor(n){
  if(n>=85) return '#4ade80';
  if(n>=70) return '#60a5fa';
  if(n>=50) return '#fbbf24';
  return '#f87171';
}

function levelClass(l){
  return {'excellent':'lv-excellent','good':'lv-good','fair':'lv-fair','poor':'lv-poor'}[l]||'lv-fair';
}

function actionLabel(a){
  return {'none':'✓ No action needed','monitor':'👁 Monitor','followup':'📩 Follow-up needed','intervention':'🚨 Intervention required'}[a]||a;
}

function actionDotClass(a){
  return {'none':'ad-none','monitor':'ad-monitor','followup':'ad-followup','intervention':'ad-intervention'}[a]||'ad-none';
}

// ── Modal ──────────────────────────────────────────────
let allStudents = [];
function openStudent(idx){
  const s = allStudents[idx];
  if(!s) return;
  document.getElementById('mName').textContent = s.name;
  document.getElementById('mMeta').textContent =
    `Comprehension: ${s.comprehensionScore}%  ·  Level: ${s.comprehensionLevel}  ·  ${actionLabel(s.recommendedAction)}`;
  document.getElementById('mSummary').textContent = s.summary || '—';
  document.getElementById('mStrengths').textContent = s.strengths || '—';
  document.getElementById('mGaps').textContent = s.gaps || 'None identified';
  document.getElementById('mGapsSection').style.display = s.gaps ? 'block' : 'none';
  document.getElementById('mAction').textContent = actionLabel(s.recommendedAction);
  document.getElementById('modal').classList.add('show');
}
function closeModal(e){
  if(e.target === document.getElementById('modal'))
    document.getElementById('modal').classList.remove('show');
}

// ── Render ─────────────────────────────────────────────
function render(r, meta, materials){
  const students = r.students || [];
  const needHelp = students.filter(s=>s.recommendedAction==='intervention'||s.recommendedAction==='followup');
  const excellent = students.filter(s=>s.comprehensionLevel==='excellent').length;
  allStudents = students;

  // Header chips
  document.getElementById('hCourse').textContent = '📚 ' + (meta.courseTitle||'Course');
  document.getElementById('hParticipants').textContent = `✍ ${r.totalParticipants||0} students`;
  document.getElementById('hTime').textContent = 'Analyzed ' + new Date(meta.scrapedAt).toLocaleString();

  document.getElementById('app').innerHTML = `

  <!-- Page title -->
  <div class="ptitle anim">
    <h1>${meta.discussionTitle||'Discussion Report'}</h1>
    <p>${meta.courseTitle||''} &nbsp;·&nbsp; ${r.totalParticipants||0} student responses analyzed</p>
  </div>
  <div class="divider"></div>

  ${meta.expectedOutcomes ? `
  <div class="outcomes-banner anim">
    <span class="ob-icon">🎯</span>
    <div>
      <div class="ob-label">Analysis based on expected learning outcomes</div>
      <div class="ob-text">${meta.expectedOutcomes}</div>
    </div>
  </div>` : ''}

  ${(materials?.selectedFiles?.length > 0 || materials?.pageContents?.length > 0 || materials?.syllabus) ? `
  <div class="outcomes-banner anim" style="border-color:#2a2a2a;background:#111111;">
    <span class="ob-icon">📚</span>
    <div style="width:100%">
      <div class="ob-label" style="color:#ffffff">Course materials used in this analysis</div>
      <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:5px">
        ${materials?.syllabus ? `<span style="background:#1a1a1a;border:1px solid #333;color:#94a3b8;border-radius:4px;padding:2px 8px;font-size:11px">📋 Syllabus</span>` : ''}
        ${(materials?.pageContents||[]).map(p=>`<span style="background:#1a1a1a;border:1px solid #333;color:#94a3b8;border-radius:4px;padding:2px 8px;font-size:11px">📄 ${p.title}</span>`).join('')}
        ${(materials?.selectedFiles||[]).map(f=>`<span style="background:#1a1a1a;border:1px solid #333;color:#94a3b8;border-radius:4px;padding:2px 8px;font-size:11px">📎 ${f.name}</span>`).join('')}
      </div>
    </div>
  </div>` : ''}

  <!-- Stats -->
  <div class="stats anim d1">
    <div class="stat blue">
      <div class="stat-lbl">Overall Comprehension</div>
      <div class="stat-val">${r.overallComprehension||0}%</div>
      <div class="mini-bar"><div class="mini-fill" style="width:${r.overallComprehension||0}%;background:linear-gradient(90deg,#c53030,#e53e3e)"></div></div>
    </div>
    <div class="stat green">
      <div class="stat-lbl">Students Responded</div>
      <div class="stat-val">${r.totalParticipants||0}</div>
      <div class="stat-sub">${excellent} excelling</div>
    </div>
    <div class="stat amber">
      <div class="stat-lbl">Need Follow-up</div>
      <div class="stat-val">${needHelp.length}</div>
      <div class="stat-sub">students flagged</div>
    </div>
    <div class="stat red">
      <div class="stat-lbl">Topics to Revisit</div>
      <div class="stat-val">${(r.topicsNeedingReview||[]).length}</div>
      <div class="stat-sub">areas of concern</div>
    </div>
  </div>

  <!-- Summary + Topics needing review -->
  <div class="grid-2 anim d2">
    <div>
      <!-- Summary -->
      <div class="panel" style="margin-bottom:16px">
        <div class="ph"><span class="ph-title">🧠 Discussion Summary</span></div>
        <div class="pb"><div class="summary-box">${r.discussionSummary||'—'}</div></div>
      </div>

      <!-- Topics needing review -->
      <div class="panel">
        <div class="ph">
          <span class="ph-title">⚠️ Topics Students Struggled With</span>
          <span class="chip chip-red">${(r.topicsNeedingReview||[]).length} areas</span>
        </div>
        <div class="pb-tight">
          ${(r.topicsNeedingReview||[]).map(t=>`
            <div class="topic-item">
              <div class="topic-name">${t.topic}</div>
              <div class="topic-exp">${t.explanation}</div>
              <div class="topic-students">
                ${(t.studentsAffected||[]).map(n=>`<span class="tstudent" style="background:#1c0505;color:#fca5a5;border:1px solid #7f1d1d">${n}</span>`).join('')}
              </div>
            </div>
          `).join('')||'<p style="color:var(--muted);font-size:13px;padding:8px 0">No major struggles identified.</p>'}
        </div>
      </div>
    </div>

    <!-- Right column -->
    <div style="display:flex;flex-direction:column;gap:16px">

      <!-- Topics covered well -->
      <div class="panel">
        <div class="ph">
          <span class="ph-title">✅ Topics Understood Well</span>
          <span class="chip chip-green">${(r.topicsCoveredWell||[]).length}</span>
        </div>
        <div class="pb-tight">
          ${(r.topicsCoveredWell||[]).map(t=>`
            <div class="well-item"><span class="well-check">✓</span><span class="well-txt">${t}</span></div>
          `).join('')||'<p style="color:var(--muted);font-size:13px">None identified</p>'}
        </div>
      </div>

      <!-- Professor action items -->
      <div class="panel">
        <div class="ph">
          <span class="ph-title">🎯 Action Items for Professor</span>
        </div>
        <div class="pb">
          ${(r.professorActionItems||[]).map(a=>`
            <div class="action-item">
              <div class="apriority ap-${a.priority}"></div>
              <div class="action-body">
                <div class="action-title">${a.action}</div>
                <div class="action-reason">${a.reason}</div>
              </div>
            </div>
          `).join('')||'<p style="color:var(--muted);font-size:13px">No actions needed.</p>'}
        </div>
      </div>
    </div>
  </div>

  <!-- Student-by-student breakdown (full width) -->
  <div class="panel anim d3" style="margin-bottom:18px">
    <div class="ph">
      <span class="ph-title">👥 Student-by-Student Breakdown</span>
      <div class="legend">
        <span class="lg-item"><span class="action-dot ad-none"></span> No action</span>
        <span class="lg-item"><span class="action-dot ad-monitor"></span> Monitor</span>
        <span class="lg-item"><span class="action-dot ad-followup"></span> Follow-up</span>
        <span class="lg-item"><span class="action-dot ad-intervention"></span> Intervention</span>
      </div>
    </div>
    <div style="overflow-x:auto">
      <table class="stable">
        <thead>
          <tr>
            <th>Student</th>
            <th>Score</th>
            <th>Level</th>
            <th>Strengths</th>
            <th>Gaps / Issues</th>
            <th style="text-align:center">Action</th>
          </tr>
        </thead>
        <tbody>
          ${students.map((s,i)=>`
            <tr data-student-idx="${i}" style="cursor:pointer">
              <td>
                <div class="sname">${s.name}</div>
                <div class="ssummary">${s.summary||''}</div>
              </td>
              <td>
                <span class="score-pill" style="color:${scoreColor(s.comprehensionScore)};background:${scoreColor(s.comprehensionScore)}15">${s.comprehensionScore||0}%</span>
              </td>
              <td><span class="level-badge ${levelClass(s.comprehensionLevel)}">${s.comprehensionLevel||'fair'}</span></td>
              <td class="strengths-cell">${s.strengths||'—'}</td>
              <td class="gaps-cell">${s.gaps||'<span style="color:var(--muted)">None</span>'}</td>
              <td style="text-align:center">
                <span class="action-dot ${actionDotClass(s.recommendedAction)}" title="${actionLabel(s.recommendedAction)}"></span>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  </div>

  <!-- Follow-up questions -->
  <div class="panel anim d4">
    <div class="ph"><span class="ph-title">💬 Suggested Follow-up Discussion Questions</span></div>
    <div class="pb-tight">
      ${(r.suggestedNextDiscussionQuestions||[]).map((q,i)=>`
        <div class="fq-item">
          <div class="fq-num">${i+1}</div>
          <div class="fq-q">${q}</div>
        </div>
      `).join('')||'<p style="color:var(--muted);font-size:13px;padding:6px 0">No follow-up questions generated.</p>'}
    </div>
  </div>
  `;

  // ── Event delegation for student table rows ──
  document.getElementById('app').addEventListener('click', e => {
    const row = e.target.closest('tr[data-student-idx]');
    if (row) openStudent(parseInt(row.dataset.studentIdx));
  });
}

function goBack() {
  window.close();
}

// ── Button event listeners (replaces inline onclick attrs) ──
document.addEventListener('DOMContentLoaded', () => {
  const backBtn = document.getElementById('backBtn');
  const printBtn = document.getElementById('printBtn');
  const modalOverlay = document.getElementById('modal');

  if (backBtn) backBtn.addEventListener('click', goBack);
  if (printBtn) printBtn.addEventListener('click', () => window.print());
  if (modalOverlay) modalOverlay.addEventListener('click', closeModal);
});

// ── Load data ──────────────────────────────────────────
async function load(){
  // Keep trying every 500ms for up to 10 seconds
  for(let i = 0; i < 20; i++){
    try {
      const s = await chrome.storage.local.get(['lastResult','lastData','lastMaterials']);
      if(s.lastResult && s.lastData){
        render(s.lastResult, s.lastData, s.lastMaterials || null);
        return;
      }
    } catch(e){ console.log('retry', i, e); }
    await new Promise(r => setTimeout(r, 500));
  }

  // Nothing found — show demo
  render(getDemoData(), {
    courseTitle:'Introduction to Psychology',
    discussionTitle:'Chapter 4 Discussion: Memory, Encoding, and Retrieval',
    expectedOutcomes: 'Students should understand elaborative encoding vs. maintenance rehearsal, the spacing effect and why it works, and the encoding-specificity principle for retrieval.',
    scrapedAt: new Date().toISOString(),
  }, {
    selectedFiles: [{ name: 'Chapter 4 - Memory and Encoding.pdf' },{ name: 'Week 4 Lecture Slides.pptx' }],
    pageContents: [{ title: 'Module 4: Cognitive Psychology Notes', module: 'Week 4' }],
    syllabus: 'PSY 101 — Introduction to Psychology',
  });
}

function getDemoData(){
  return {
    discussionSummary:"Students engaged with the chapter on memory and encoding with mixed results. Most demonstrated familiarity with the three-stage memory model and could identify encoding strategies. However, a significant number confused retrieval cues with encoding cues, and several students struggled to apply concepts like the spacing effect and elaborative encoding to practical scenarios. Overall participation was strong but depth of analysis varied considerably.",
    overallComprehension:71,
    totalParticipants:18,
    topicsCoveredWell:[
      "Three-stage memory model (sensory, short-term, long-term)",
      "Role of rehearsal in transferring information to long-term memory",
      "Difference between explicit and implicit memory",
      "Basic understanding of retrieval failure"
    ],
    topicsNeedingReview:[
      {topic:"Elaborative Encoding vs. Maintenance Rehearsal", explanation:"Many students used these terms interchangeably. They understand rehearsal works but don't grasp that elaborative encoding (connecting new info to existing knowledge) is far more effective.", studentsAffected:["Jordan M.","Priya S.","Carlos D.","Aaliyah T."]},
      {topic:"Spacing Effect and Distributed Practice", explanation:"Students know cramming is 'bad' but cannot explain why spaced practice leads to stronger memory traces at a neurological or psychological level.", studentsAffected:["Marcus W.","Sofia R.","James K."]},
      {topic:"Retrieval Cues and Context-Dependent Memory", explanation:"Several students conflated the encoding-specificity principle with simple repetition. They do not understand how context at retrieval must match context at encoding.", studentsAffected:["Jordan M.","Lena P.","David C."]}
    ],
    students:[
      {name:"Aaliyah Thompson",comprehensionLevel:"excellent",comprehensionScore:94,strengths:"Demonstrated sophisticated understanding of encoding specificity and provided original real-world examples connecting spacing effect to her own study habits.",gaps:"",recommendedAction:"none",summary:"One of the strongest posts in the class — nuanced, well-reasoned, and showed genuine application of concepts."},
      {name:"Marcus Williams",comprehensionLevel:"good",comprehensionScore:78,strengths:"Solid grasp of the three-stage model and explicit/implicit distinction.",gaps:"Confused distributed practice with simple repetition; did not explain the neurological basis of the spacing effect.",recommendedAction:"monitor",summary:"Good foundational understanding but application to novel scenarios needs work."},
      {name:"Sofia Rodriguez",comprehensionLevel:"good",comprehensionScore:75,strengths:"Correctly identified retrieval failure as the primary cause of forgetting in most cases.",gaps:"Spacing effect explanation was superficial — described it as 'studying more' rather than explaining memory consolidation.",recommendedAction:"monitor",summary:"Solid post overall, but depth of explanation for spacing effect fell short."},
      {name:"Jordan Mitchell",comprehensionLevel:"fair",comprehensionScore:58,strengths:"Shows awareness of the distinction between sensory and short-term memory.",gaps:"Used elaborative encoding and maintenance rehearsal interchangeably throughout; misapplied retrieval cue concept in the example provided.",recommendedAction:"followup",summary:"Multiple conceptual mix-ups that will cause compounding confusion — needs targeted clarification."},
      {name:"Priya Sharma",comprehensionLevel:"fair",comprehensionScore:55,strengths:"Understands that memory is not a single unified system.",gaps:"Conflated encoding strategies throughout; the example given for elaborative encoding described maintenance rehearsal.",recommendedAction:"followup",summary:"Core encoding concepts are muddled — a one-on-one check-in before the next module is advisable."},
      {name:"David Chen",comprehensionLevel:"excellent",comprehensionScore:91,strengths:"Excellent synthesis of encoding and retrieval, with a clear original example using context-dependent memory.",gaps:"",recommendedAction:"none",summary:"Very strong post — accurately described encoding specificity with a compelling personal example."},
      {name:"James Kim",comprehensionLevel:"fair",comprehensionScore:52,strengths:"Correctly identified that long-term memory has a much larger capacity than short-term.",gaps:"Explained spacing effect as simply 'studying on different days' with no mechanistic understanding; retrieval cues section was missing entirely.",recommendedAction:"intervention",summary:"Response was too brief and surface-level — may not have completed the reading thoroughly."},
      {name:"Lena Park",comprehensionLevel:"poor",comprehensionScore:38,strengths:"Made a reasonable attempt to define sensory memory.",gaps:"Fundamentally misunderstood retrieval — described it as 'putting information in memory' rather than accessing stored information. Encoding and retrieval appear to be reversed in understanding.",recommendedAction:"intervention",summary:"Serious misunderstanding of the encoding/retrieval distinction — this student needs direct intervention before the unit exam."},
      {name:"Carlos Diaz",comprehensionLevel:"fair",comprehensionScore:61,strengths:"Good understanding of explicit vs. implicit memory with relevant example.",gaps:"Elaborative encoding described incorrectly as rereading notes; spacing effect not mentioned.",recommendedAction:"followup",summary:"Partial understanding — some concepts are solid but key ones are missing or misstated."},
      {name:"Emma Johnson",comprehensionLevel:"good",comprehensionScore:80,strengths:"Accurately described all three encoding strategies and gave a strong example of the spacing effect.",gaps:"Slightly confused about context-dependent vs. state-dependent memory in the last paragraph.",recommendedAction:"monitor",summary:"Strong overall post with one minor area of confusion at the end."},
      {name:"Tyler Brown",comprehensionLevel:"excellent",comprehensionScore:88,strengths:"Clearly explained elaborative encoding with an original mnemonic example and connected it to the levels-of-processing framework.",gaps:"",recommendedAction:"none",summary:"One of the more analytically sophisticated posts — shows reading beyond the core chapter."},
      {name:"Aisha Patel",comprehensionLevel:"good",comprehensionScore:73,strengths:"Solid discussion of retrieval cues and context-dependent memory.",gaps:"Did not address elaborative encoding at all; spacing effect explanation was accurate but brief.",recommendedAction:"monitor",summary:"Good where it covered material, but missed some required concepts entirely."},
      {name:"Ryan Thompson",comprehensionLevel:"poor",comprehensionScore:42,strengths:"Correctly noted that memory can fail at encoding, storage, or retrieval.",gaps:"All three stages were described with significant inaccuracies. Short-term and long-term memory definitions were reversed. Examples given were largely incorrect.",recommendedAction:"intervention",summary:"Foundational misunderstandings across the board — may need to revisit the chapter with guidance."},
      {name:"Natalie Foster",comprehensionLevel:"excellent",comprehensionScore:90,strengths:"Exceptional discussion of the encoding specificity principle with two well-chosen examples. Clearly distinguished elaborative from maintenance rehearsal.",gaps:"",recommendedAction:"none",summary:"One of the best posts in class — accurate, detailed, and showed genuine understanding."},
      {name:"Kevin Martinez",comprehensionLevel:"fair",comprehensionScore:64,strengths:"Understood the basic function of retrieval cues.",gaps:"Spacing effect section contained factual errors — stated that massed practice is equivalent to distributed practice 'when the total time is the same.'",recommendedAction:"followup",summary:"A specific misconception about the spacing effect needs direct correction."},
      {name:"Jasmine Lee",comprehensionLevel:"good",comprehensionScore:77,strengths:"Demonstrated strong understanding of implicit vs. explicit memory with a procedural memory example.",gaps:"Encoding strategies were glossed over without sufficient depth.",recommendedAction:"monitor",summary:"Strong on memory types but light on encoding — could go deeper."},
      {name:"Brandon Scott",comprehensionLevel:"fair",comprehensionScore:59,strengths:"Attempted to connect memory concepts to real-life studying scenarios.",gaps:"Several key definitions were imprecise or inaccurate. Confused retrieval failure with storage failure.",recommendedAction:"followup",summary:"Good intent to apply concepts but accuracy of definitions needs improvement."},
      {name:"Zoe Williams",comprehensionLevel:"good",comprehensionScore:82,strengths:"Very clear explanation of the three-stage model with well-structured writing. Good understanding of encoding types.",gaps:"Missed the spacing effect topic entirely.",recommendedAction:"monitor",summary:"Strong and well-written post but one major topic area was absent."}
    ],
    professorActionItems:[
      {priority:"high",action:"Reteach elaborative encoding vs. maintenance rehearsal with a side-by-side comparison exercise",reason:"6 students conflated these concepts — this will cause errors on every related exam question"},
      {priority:"high",action:"Schedule check-ins with Lena Park and Ryan Thompson before the next class",reason:"Both have fundamental misunderstandings (encoding/retrieval reversal, stage definitions) that need direct correction"},
      {priority:"medium",action:"Add a 5-minute clarification on the spacing effect mechanism at the start of next class",reason:"3 students described it as 'just studying on different days' without understanding memory consolidation"},
      {priority:"low",action:"Acknowledge the strong posts from Aaliyah, David, Natalie, and Tyler in class to model what depth of analysis looks like",reason:"High-quality peer modeling helps set expectations for the rest of the class"}
    ],
    suggestedNextDiscussionQuestions:[
      "You have 4 hours to study for an exam. Walk me through how you would structure that time using the spacing effect and elaborative encoding — and explain why your approach works neurologically.",
      "A friend tells you they failed an exam even though they 'studied for hours.' Using what you've learned about encoding and retrieval, what are three specific explanations for why this might have happened?",
      "How does context-dependent memory explain why students sometimes forget information during an exam that they knew perfectly well at home? What strategies does this suggest?",
      "Compare maintenance rehearsal and elaborative encoding: in what situations might each be appropriate, and which leads to stronger long-term retention and why?"
    ]
  };
}

// ── Expose render for background script injection ──────
window.__ciRender = render;

load();
