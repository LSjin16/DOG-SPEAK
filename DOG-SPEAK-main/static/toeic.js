(function () {
  const LEVEL_SHARE = [
    [1, 2, "Level 1~2 (성대만 인간짖는 시늉)"],
    [3, 4, "Level 3~4 (방언 섞인 유치원생)"],
    [5, 6, "Level 5~6 (비즈니스 견공)"],
    [7, 8, "Level 7~8 (견생 2회차 Native)"],
  ];

  function shareLabel(level) {
    for (const [lo, hi, label] of LEVEL_SHARE) {
      if (level >= lo && level <= hi) return label;
    }
    return `Level ${level}`;
  }

  const panelToeic = document.getElementById("panel-toeic");
  const panelLegacy = document.getElementById("panel-legacy");
  const panelWrong = document.getElementById("panel-wrong");
  const panelExplain = document.getElementById("panel-explain");
  const mainGrid = document.getElementById("main-grid");
  const panelSoon = document.getElementById("panel-soon");
  const soonTitle = document.getElementById("soonTitle");
  
  // 로그인 관련 엘리먼트
  const loginOverlay = document.getElementById("loginOverlay");
  const loginNameInput = document.getElementById("loginNameInput");
  const btnLogin = document.getElementById("btnLogin");
  const userInfo = document.getElementById("userInfo");
  const displayUserName = document.getElementById("displayUserName");
  const btnChangeUser = document.getElementById("btnChangeUser");

  let currentUserId = localStorage.getItem("dogToeicUser") || null;

  function checkLogin() {
    if (!currentUserId) {
      if (loginOverlay) loginOverlay.style.display = "flex";
    } else {
      if (loginOverlay) loginOverlay.style.display = "none";
      if (userInfo) userInfo.style.display = "flex";
      if (displayUserName) displayUserName.textContent = currentUserId;
    }
  }

  btnLogin?.addEventListener("click", () => {
    const name = loginNameInput.value.trim();
    if (!name) {
      alert("이름을 입력해 주세요!");
      return;
    }
    currentUserId = name;
    localStorage.setItem("dogToeicUser", name);
    checkLogin();
    if (!panelWrong.classList.contains("hidden")) loadWrongNotes();
  });

  btnChangeUser?.addEventListener("click", () => {
    if (confirm("로그아웃하시겠습니까? 기록은 서버에 저장되어 이름 입력 시 다시 불러올 수 있습니다.")) {
      localStorage.removeItem("dogToeicUser");
      location.reload();
    }
  });

  function clearGnb() {
    document.querySelectorAll(".gnb-item").forEach((b) => b.classList.remove("active"));
  }

  function setMode(mode, clickedBtn) {
    // 모든 패널 숨기기
    [panelToeic, panelLegacy, panelWrong, panelExplain, panelSoon, mainGrid].forEach(p => p?.classList.add("hidden"));

    clearGnb();
    clickedBtn?.classList.add("active");

    if (mode === "toeic") {
      mainGrid.classList.remove("hidden");
      panelToeic.classList.remove("hidden");
    } else if (mode === "legacy") {
      panelLegacy.classList.remove("hidden");
      stopVisualizer();
    } else if (mode === "wrong") {
      panelWrong.classList.remove("hidden");
      loadWrongNotes();
      stopVisualizer();
    } else if (mode === "explain") {
      panelExplain.classList.remove("hidden");
      loadExplanations();
      stopVisualizer();
    } else if (mode === "soon") {
      const t = clickedBtn?.getAttribute("data-soon-title") || "서비스";
      if (soonTitle) soonTitle.textContent = `${t} (준비 중)`;
      panelSoon.classList.remove("hidden");
      stopVisualizer();
    }
  }

  document.querySelectorAll(".gnb-item").forEach((btn) => {
    btn.addEventListener("click", () => {
      const p = btn.getAttribute("data-panel");
      const id = btn.id;
      if (id === "navWrong") setMode("wrong", btn);
      else if (id === "navExplain") setMode("explain", btn);
      else if (p === "toeic") setMode("toeic", btn);
      else if (p === "legacy") setMode("legacy", btn);
      else if (p === "soon") setMode("soon", btn);
    });
  });

  // 오답노트 로딩
  async function loadWrongNotes() {
    const listEl = document.getElementById("wrongNotesList");
    if (!listEl) return;
    listEl.innerHTML = "<p class='muted'>오답 정보를 불러오는 중...</p>";
    
    try {
      const res = await fetch(`/api/v1/toeic/v2/review/wrong-notes/${currentUserId}`);
      const data = await res.json();
      
      if (!data || data.length === 0) {
        listEl.innerHTML = "<p class='muted' style='text-align:center; padding: 40px 0;'>아직 틀린 문제가 없습니다. 모든 문제를 맞추셨거나 시험을 아직 치르지 않으셨네요!</p>";
        return;
      }

      listEl.innerHTML = data.map(item => `
        <div class="card" style="margin-bottom:0; border-left: 4px solid var(--danger);">
          <div style="font-size:12px; color:var(--accent); font-weight:700; margin-bottom:4px;">[${item.subject_name}] ${item.exam_title}</div>
          <div style="font-weight:700; font-size:1.05rem; margin-bottom:10px;">Q. ${item.question}</div>
          <div style="background:var(--accent-soft); padding:10px; border-radius:8px; font-size:14px; color:var(--text);">
            <strong style="color:var(--danger);">[해설]</strong> ${item.explanation}
          </div>
        </div>
      `).join("");
    } catch (e) {
      listEl.innerHTML = "<p class='muted'>오답 노트를 불러오는 데 실패했습니다.</p>";
    }
  }

  // 기출해설 로딩
  async function loadExplanations() {
    const selectEl = document.getElementById("examSelect");
    const listEl = document.getElementById("explainList");
    if (!selectEl || !listEl) return;

    try {
      const res = await fetch("/api/v1/toeic/v2/exams");
      const exams = await res.json();
      
      selectEl.innerHTML = '<option value="">회차를 선택하세요</option>' + 
        exams.map(e => `<option value="${e.exam_id}">${e.year}년 ${e.title}</option>`).join("");
      
      selectEl.onchange = async () => {
        const examId = selectEl.value;
        if (!examId) {
          listEl.innerHTML = "";
          return;
        }
        
        listEl.innerHTML = "<p class='muted'>해설 정보를 불러오는 중...</p>";
        const detailRes = await fetch(`/api/v1/toeic/v2/exams/${examId}`);
        const exam = await detailRes.json();
        
        listEl.innerHTML = exam.questions.map((q, idx) => `
          <div class="card" style="margin-bottom:0;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
              <span style="font-weight:800; color:var(--accent);">문제 ${idx + 1}</span>
              <span class="hero-badge" style="margin-bottom:0; font-size:10px;">${q.subject_name}</span>
            </div>
            <div style="font-weight:700; margin-bottom:12px;">${q.question_text || q.question}</div>
            ${q.image_url ? `<img src="${q.image_url}" class="toeic-img" style="margin-bottom:12px; max-height:150px;" />` : ""}
            <div style="padding:12px; background:var(--bg-elevated); border-radius:8px;">
              <div style="font-size:13px; margin-bottom:6px;"><strong>정답:</strong> ${q.options ? q.options[q.answer] : (q.target_script || "짖음 실기")}</div>
              <div style="font-size:13px; color:var(--muted);"><strong>해설:</strong> ${q.explanation}</div>
            </div>
          </div>
        `).join("");
      };
    } catch (e) {
      listEl.innerHTML = "<p class='muted'>기출 해설을 불러오는 데 실패했습니다.</p>";
    }
  }

  const partBtns = document.querySelectorAll("[data-toeic-part]");
  const toeicPartTitle = document.getElementById("toeicPartTitle");
  const toeicQuestion = document.getElementById("toeicQuestion");
  const toeicImage = document.getElementById("toeicImage");
  const audioSection = document.getElementById("audioSection");
  const choiceSection = document.getElementById("choiceSection");
  const micSection = document.getElementById("micSection");
  const btnPlayAudio = document.getElementById("btnPlayAudio");
  const toeicAudio = document.getElementById("toeicAudio");
  const toeicStatus = document.getElementById("toeicStatus");
  const canvasRef = document.getElementById("canvasRef");
  const canvasUser = document.getElementById("canvasUser");
  const userWaveLabel = document.getElementById("userWaveLabel");
  const grammarBanner = document.getElementById("grammarBanner");
  const shameFill = document.getElementById("shameFill");
  const shamePct = document.getElementById("shamePct");
  const btnMic = document.getElementById("btnMic");
  const btnStop = document.getElementById("btnStop");
  const btnListen = document.getElementById("btnListen");
  const btnEval = document.getElementById("btnEval");
  const toeicResult = document.getElementById("toeicResult");
  const btnShare = document.getElementById("btnShareStory");
  const shareCanvas = document.getElementById("shareCanvas");

  let currentPartId = null;
  let currentQuestionId = null;
  let currentExamId = null;
  let currentCorrectAnswer = null;
  let audioCtx = null;
  let analyser = null;
  let micStream = null;
  let dataArray = null;
  let rafId = null;
  let timeStart = 0;
  let mediaRecorder = null;
  let recordedChunks = [];
  let lastRmsHistory = [];
  let refPeakBin = 0;
  let wasHumanDetectedInSession = false; 
  let recordingTimer = null; // 자동 종료 타이머
  const RECORDING_LIMIT_SEC = 5; // 녹음 제한 시간
  let currentRefBursts = []; // 현재 문제의 파형 시그니처
  
  // 표준 파형의 랜덤 특성을 저장할 변수
  let refWaveParams = { f0: 0.015, m1: 8, m2: 19, a1: 40, a2: 15 };

  btnPlayAudio?.addEventListener("click", () => {
    if (toeicAudio.src) {
      toeicAudio.play();
      toeicStatus.textContent = "음성 재생 중...";
    }
  });

  document.querySelectorAll(".btn-choice").forEach((btn) => {
    btn.addEventListener("click", () => {
      const choice = Number(btn.getAttribute("data-choice"));
      if (currentCorrectAnswer === null) return;
      
      const isCorrect = choice === currentCorrectAnswer;
      toeicResult.classList.remove("muted");
      
      let praise = "정확한 청취 능력을 보유하고 계시군요.";
      if (currentPartId === 3) praise = "뛰어난 상황 판단력과 관찰력을 보유하고 계시군요.";
      if (currentPartId === 4) praise = "해박한 반려견 관련 법률 지식을 보유하고 계시군요.";

      if (isCorrect) {
        toeicResult.innerHTML = `<h3 style="color:#38a169">정답입니다! 🐾</h3><p>${praise}</p>`;
        toeicStatus.textContent = "채점 완료: 정답";
      } else {
        const labels = ["A", "B", "C", "D"];
        toeicResult.innerHTML = `<h3 style="color:#e53e3e">오답입니다. 🐕</h3><p>정답은 ${labels[currentCorrectAnswer]}입니다. 더 정진하세요.</p>`;
        toeicStatus.textContent = "채점 완료: 오답";
        saveWrongNote();
      }
      btnShare.disabled = false;
    });
  });

  async function saveWrongNote() {
    if (!currentQuestionId) return;
    try {
      await fetch("/api/v1/toeic/v2/review/wrong-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: currentUserId,
          question_id: currentQuestionId,
          exam_id: currentExamId
        })
      });
    } catch (e) {
      console.error("Failed to save wrong note:", e);
    }
  }

  function stopVisualizer() {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
    if (recordingTimer) clearInterval(recordingTimer);
    recordingTimer = null;
    if (micStream) {
      micStream.getTracks().forEach((t) => t.stop());
      micStream = null;
    }
    if (audioCtx) {
      audioCtx.close().catch(() => {});
      audioCtx = null;
    }
    analyser = null;
    dataArray = null;
  }

  function drawRefWave() {
    if (!canvasRef) return;
    const w = canvasRef.width;
    const h = canvasRef.height;
    const ctx = canvasRef.getContext("2d");
    ctx.fillStyle = "#0a0d14";
    ctx.fillRect(0, 0, w, h);

    const centerY = h / 2;
    const bursts = currentRefBursts.length > 0 ? currentRefBursts : [
      { pos: 0.2, amp: 30, width: 0.08 },
      { pos: 0.5, amp: 35, width: 0.08 },
      { pos: 0.8, amp: 30, width: 0.08 }
    ];

    // 1. 배경 미세 노이즈 (공기 흐름 묘사)
    ctx.strokeStyle = "rgba(108, 166, 255, 0.15)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x < w; x++) {
      const y = centerY + (Math.random() - 0.5) * 10;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // 2. 메인 짖음 파형 (복합 주파수)
    ctx.strokeStyle = "rgba(108, 166, 255, 0.9)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let x = 0; x < w; x++) {
      let val = 0;
      bursts.forEach(b => {
        const dist = Math.abs(x / w - b.pos);
        if (dist < b.width) {
          const envelope = Math.exp(-Math.pow(dist * (1/b.width) * 2, 2));
          // 고주파 진동(Main) + 저주파 울림(Body) + 랜덤 거칠기(Noise)
          const mainFreq = Math.sin(x * 0.6) * b.amp;
          const bodyFreq = Math.sin(x * 0.15) * (b.amp * 0.4);
          const rugness = (Math.random() - 0.5) * (b.amp * 0.3);
          val += envelope * (mainFreq + bodyFreq + rugness);
        }
      });
      const y = centerY + val;
      if (x === 0) ctx.moveTo(x, centerY + val);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  function drawUserWave(userBuf, isHuman = false) {
    if (!canvasUser) return;
    const w = canvasUser.width;
    const h = canvasUser.height;
    const ctx = canvasUser.getContext("2d");
    ctx.fillStyle = "#0a0d14";
    ctx.fillRect(0, 0, w, h);

    if (isHuman) {
      ctx.strokeStyle = "rgba(255, 0, 0, 1)";
      ctx.lineWidth = 2;
      ctx.fillStyle = "rgba(255, 0, 0, 0.1)";
      ctx.fillRect(0, 0, w, h);
    } else {
      ctx.strokeStyle = "rgba(255, 107, 138, 1)";
      ctx.lineWidth = 2;
    }

    if (userBuf && userBuf.length > 0) {
      ctx.beginPath();
      // 전체 버퍼를 화면 너비에 맞춰 압축하여 그림 (정적 파형)
      const step = Math.ceil(userBuf.length / w);
      for (let x = 0; x < w; x++) {
        let max = 0;
        for(let i=0; i<step; i++) {
          const val = userBuf[x * step + i];
          if(Math.abs(val) > Math.abs(max)) max = val;
        }
        const y = h / 2 + max * (h * 0.45);
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    
    if (isHuman && userWaveLabel) {
      userWaveLabel.style.background = "rgba(255, 0, 0, 0.6)";
      userWaveLabel.style.color = "white";
      userWaveLabel.textContent = "⚠️ HUMAN VOICE DETECTED! (분석 불가)";
    } else if (userWaveLabel) {
      userWaveLabel.style.background = "rgba(255, 107, 138, 0.2)";
      userWaveLabel.style.color = "#ff6b8a";
      userWaveLabel.textContent = userBuf ? "녹음 분석 완료" : "녹음 대기 중...";
    }
  }

  async function decodeAndDrawUserWave(blob) {
    try {
      const arrayBuffer = await blob.arrayBuffer();
      const tempAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const audioBuffer = await tempAudioCtx.decodeAudioData(arrayBuffer);
      const rawData = audioBuffer.getChannelData(0);
      drawUserWave(rawData, wasHumanDetectedInSession);
      await tempAudioCtx.close();
    } catch (e) {
      console.error("Waveform decode error:", e);
    }
  }

  function loopDraw() {
    // 표준 가이드 파형은 항상 고정적으로 그림
    drawRefWave();

    if (analyser) {
      analyser.getByteTimeDomainData(dataArray);
      const buf = new Float32Array(dataArray.length);
      for (let i = 0; i < dataArray.length; i++) buf[i] = (dataArray[i] - 128) / 128;
      
      const rms = Math.sqrt(buf.reduce((s, v) => s + v * v, 0) / buf.length);
      lastRmsHistory.push(rms);
      if (lastRmsHistory.length > 12) lastRmsHistory.shift();
      
      const stability = lastRmsHistory.length > 4
          ? 1 - (lastRmsHistory.reduce((a, b) => a + Math.abs(b - lastRmsHistory[0]), 0) / lastRmsHistory.length)
          : 0;
      
      let accuracy = (rms * 1200) * (1.2 - stability); 
      if (rms < 0.01) accuracy = 0;
      accuracy = Math.min(100, Math.max(0, accuracy + (rms > 0.05 ? 10 : 0)));

      shameFill.style.width = `${accuracy}%`;
      shamePct.textContent = `${Math.round(accuracy)}%`;

      if (rms > 0.04 && stability > 0.75) wasHumanDetectedInSession = true;

      if (grammarBanner) {
        if (wasHumanDetectedInSession) {
          grammarBanner.classList.add("show");
          grammarBanner.textContent = "발음 분석: 인간 방언(Monotone) 감지됨";
        } else {
          grammarBanner.classList.remove("show");
        }
      }
    }

    rafId = requestAnimationFrame(loopDraw);
  }

  async function startMic() {
    stopVisualizer();
    lastRmsHistory = [];
    wasHumanDetectedInSession = false; // 플래그 초기화
    grammarBanner?.classList.remove("show");
    drawUserWave(null, false); // 유저 캔버스 초기화
    
    micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const src = audioCtx.createMediaStreamSource(micStream);
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.65;
    src.connect(analyser);
    dataArray = new Uint8Array(analyser.fftFrequencyBinCount);

    timeStart = performance.now();
    recordedChunks = [];
    const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? "audio/webm;codecs=opus"
      : "audio/webm";
    mediaRecorder = new MediaRecorder(micStream, { mimeType: mime });
    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) recordedChunks.push(e.data);
    };
    mediaRecorder.start(200);
    loopDraw();
    
    // 자동 종료 타이머 시작
    let remaining = RECORDING_LIMIT_SEC;
    toeicStatus.textContent = `마이크 켜짐 · 자동 종료까지 ${remaining}초...`;
    
    recordingTimer = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        clearInterval(recordingTimer);
        finalizeRecording();
      } else {
        toeicStatus.textContent = `마이크 켜짐 · 자동 종료까지 ${remaining}초...`;
      }
    }, 1000);

    btnMic.disabled = true;
    btnStop.disabled = false;
    btnListen.disabled = true;
    btnEval.disabled = true;
  }

  function stopMicKeepBlob() {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
    if (mediaRecorder && mediaRecorder.state !== "inactive") {
      return new Promise((resolve) => {
        mediaRecorder.onstop = () => resolve();
        mediaRecorder.stop();
      });
    }
    return Promise.resolve();
  }

  async function finalizeRecording() {
    if (recordingTimer) {
      clearInterval(recordingTimer);
      recordingTimer = null;
    }
    await stopMicKeepBlob();
    
    // 녹음된 전체 파형 그리기
    if (recordedChunks.length > 0) {
      const blob = new Blob(recordedChunks, { type: recordedChunks[0].type || "audio/webm" });
      await decodeAndDrawUserWave(blob);
    }

    if (micStream) {
      micStream.getTracks().forEach((t) => t.stop());
      micStream = null;
    }
    if (audioCtx) {
      await audioCtx.close().catch(() => {});
      audioCtx = null;
    }
    analyser = null;
    btnMic.disabled = false;
    btnStop.disabled = true;
    btnListen.disabled = recordedChunks.length === 0;
    btnEval.disabled = recordedChunks.length === 0 || currentPartId == null;
    toeicStatus.textContent = recordedChunks.length
      ? "녹음 완료. 파형 분석 결과를 확인하세요."
      : "녹음 데이터가 없습니다.";
  }

  async function loadPart(partId) {
    currentPartId = partId;
    partBtns.forEach((b) =>
      b.classList.toggle("active", Number(b.getAttribute("data-toeic-part")) === partId)
    );
    toeicStatus.textContent = "시험 정보 불러오는 중...";

    // 초기화
    toeicImage.setAttribute("hidden", "true");
    toeicImage.src = "";
    if (audioSection) audioSection.classList.add("hidden");
    if (toeicAudio) toeicAudio.src = "";
    if (choiceSection) choiceSection.classList.add("hidden");
    if (micSection) micSection.classList.add("hidden");
    btnListen.disabled = true;
    currentCorrectAnswer = null;
    toeicResult.innerHTML = "아직 채점 전입니다.";
    toeicResult.classList.add("muted");
    btnShare.disabled = true;

    // 시각화 초기화 및 랜덤 파형 생성
    timeStart = performance.now();
    wasHumanDetectedInSession = false;
    refWaveParams = {
      f0: 0.01 + Math.random() * 0.015,
      m1: 5 + Math.random() * 10,
      m2: 15 + Math.random() * 15,
      a1: 30 + Math.random() * 30,
      a2: 10 + Math.random() * 20
    };
    drawRefWave(0);
    drawUserWave(null, false);

    try {
      // 캐시 방지를 위해 타임스탬프 추가
      const res = await fetch(`/api/v1/toeic/start-part/${partId}?t=${Date.now()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "load failed");
      
      console.log("Loaded data:", data); // 디버깅용 로그

      currentQuestionId = data.question_id || data.id;
      currentExamId = data.exam_id || "2033-ULTIMATE";
      toeicPartTitle.textContent = data.title || "";
      
      // 질문 영역 텍스트 바인딩
      const qContent = data.question_text || "질문 내용을 불러올 수 없습니다.";
      if (data.type === "speaking") {
        const script = data.script || "멍멍!";
        toeicQuestion.textContent = `[과제] 아래 스크립트로 짖으세요: "${script}" (상황: ${qContent})`;
        
        // 지문 기반 파형 시그니처 생성 (더 복잡하게)
        const scriptLen = script.length;
        const burstCount = Math.min(6, Math.max(2, Math.floor(scriptLen / 1.5))); 
        currentRefBursts = [];
        for(let i=0; i<burstCount; i++) {
          const isMain = i % 2 === 0; // 주 짖음과 부차적 울림 교차
          currentRefBursts.push({
            pos: 0.1 + (i * 0.8 / burstCount) + (Math.random() * 0.1),
            amp: isMain ? (20 + Math.random() * 20) : (10 + Math.random() * 10),
            width: isMain ? (0.04 + Math.random() * 0.04) : (0.08 + Math.random() * 0.04)
          });
        }
        
        micSection.classList.remove("hidden");
        toeicStatus.textContent = "파트 로드 완료. 마이크로 녹음 후 채점하세요.";
        if (!rafId) loopDraw();
      } else {
        toeicQuestion.textContent = qContent;
        choiceSection.classList.remove("hidden");
        toeicStatus.textContent = "파트 로드 완료. 문제를 듣고/보고 정답을 선택하세요.";
        if (rafId) cancelAnimationFrame(rafId);
        rafId = null;
      }

      // 객관식 보기 버튼 글자 업데이트
      const choiceButtons = document.querySelectorAll(".btn-choice");
      if (data.options && data.options.length > 0) {
        choiceButtons.forEach((btn, idx) => {
          if (data.options[idx]) {
            btn.textContent = `${["A", "B", "C", "D"][idx]}. ${data.options[idx]}`;
            btn.classList.remove("hidden");
          } else {
            btn.classList.add("hidden");
          }
        });
      }

      currentCorrectAnswer = data.correct_answer;

      // 이미지 처리
      if (data.image_url) {
        toeicImage.src = data.image_url;
        toeicImage.removeAttribute("hidden");
      }

      // 오디오 처리 (음성 듣기 버튼)
      if (data.audio_url) {
        toeicAudio.src = data.audio_url;
        audioSection.classList.remove("hidden");
      }

      toeicImage.alt = data.title || "part image";
    } catch (e) {
      toeicStatus.textContent = "실패: " + e.message;
    }
  }

  partBtns.forEach((btn) => {
    btn.addEventListener("click", () => loadPart(Number(btn.getAttribute("data-toeic-part"))));
  });

  btnMic?.addEventListener("click", () => {
    startMic().catch((e) => {
      toeicStatus.textContent = "마이크 오류: " + e.message;
    });
  });

  btnStop?.addEventListener("click", () => {
    finalizeRecording();
  });

  btnListen?.addEventListener("click", () => {
    if (!recordedChunks.length) return;
    const blob = new Blob(recordedChunks, { type: recordedChunks[0].type || "audio/webm" });
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audio.play();
    toeicStatus.textContent = "내 녹음 듣는 중...";
    audio.onended = () => {
      toeicStatus.textContent = "녹음 재생 완료.";
      URL.revokeObjectURL(url);
    };
  });

  btnEval?.addEventListener("click", async () => {
    if (!currentPartId || !recordedChunks.length) return;
    const blob = new Blob(recordedChunks, { type: recordedChunks[0].type || "audio/webm" });
    const fd = new FormData();
    fd.append("part_id", String(currentPartId));
    fd.append("audio", blob, "bark_recording.webm");
    toeicStatus.textContent = "듀얼 엔진 채점 중...";
    btnEval.disabled = true;
    try {
      const res = await fetch("/api/v1/toeic/evaluate", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "evaluate failed");
      window.__lastToeicResult = data;
      const sr = data.score_report || {};
      const tier = shareLabel(sr.level || 1);
      toeicResult.classList.remove("muted");
      
      const techScoreDisplay = sr.is_human_dialect_detected 
        ? `<span style="color:var(--danger); font-weight:bold;">0 (인간 방언 감지로 인한 실격)</span>`
        : sr.technical_score;
        
      toeicResult.innerHTML = `
        <p><strong>Session:</strong> ${data.session_id}</p>
        <p><strong>Level:</strong> ${sr.level} · <span class="muted">${tier}</span></p>
        <p><strong>기술 점수:</strong> ${techScoreDisplay}</p>
        <p><strong>인간 방언 감지:</strong> ${sr.is_human_dialect_detected ? "예" : "아니오"}</p>
        <p><strong>스펙트럼:</strong> ${sr.spectral_analysis}</p>
        <p><strong>Gemini 피드백:</strong> ${data.gemini_feedback}</p>
        <p><strong>조언:</strong></p>
        <ul>${(data.advice || []).map((a) => `<li>${a}</li>`).join("")}</ul>
      `;
      toeicStatus.textContent = "채점 완료.";
      btnShare.disabled = false;
      
      // 기술 점수가 낮으면 오답노트에 추가
      if (sr.technical_score < 60) {
        saveWrongNote();
      }
    } catch (e) {
      toeicStatus.textContent = "실패: " + e.message;
    } finally {
      btnEval.disabled = false;
    }
  });

  btnShare?.addEventListener("click", () => {
    const data = window.__lastToeicResult || { 
      session_id: "DUMMY", 
      score_report: { level: 1, technical_score: 0 },
      gemini_feedback: "데이터가 없습니다."
    };
    if (!shareCanvas) return;
    const sr = data.score_report || {};
    const w = 1080;
    const h = 1920;
    shareCanvas.width = w;
    shareCanvas.height = h;
    const ctx = shareCanvas.getContext("2d");
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, "#1a1030");
    g.addColorStop(0.5, "#0d1528");
    g.addColorStop(1, "#0a1818");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "rgba(108,166,255,0.4)";
    ctx.lineWidth = 4;
    ctx.strokeRect(40, 40, w - 80, h - 80);
    ctx.fillStyle = "#eef2fa";
    ctx.font = "bold 52px system-ui,sans-serif";
    ctx.fillText("Dog-TOEIC", 80, 160);
    ctx.font = "28px system-ui,sans-serif";
    ctx.fillStyle = "#9aa6bf";
    ctx.fillText("견토익 성적표", 80, 220);
    ctx.fillStyle = "#ff6b8a";
    ctx.font = "bold 44px system-ui,sans-serif";
    const line = `나는 견토익 ${shareLabel(sr.level || 1)} 을(를) 획득함`;
    wrapText(ctx, line, 80, 360, w - 160, 52);
    ctx.fillStyle = "#6ca6ff";
    ctx.font = "30px system-ui,sans-serif";
    ctx.fillText(`Level ${sr.level} · 기술 ${sr.technical_score}`, 80, 620);
    ctx.fillStyle = "#c8d0e4";
    ctx.font = "24px system-ui,sans-serif";
    wrapText(ctx, String(data.gemini_feedback || "").slice(0, 220) + "…", 80, 700, w - 160, 34);
    ctx.fillStyle = "#5a657e";
    ctx.font = "22px monospace";
    ctx.fillText(data.session_id || "", 80, h - 120);
    shareCanvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "dog-toeic-story.png";
      a.click();
      URL.revokeObjectURL(url);
    });
  });

  const pd = document.getElementById("portalDate");
  if (pd) {
    pd.textContent = new Date().toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "long",
      day: "numeric",
      weekday: "short",
    });
  }

  checkLogin();
  loadPart(2);

  function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
    const words = text.split(/\s+/);
    let line = "";
    let yy = y;
    for (let n = 0; n < words.length; n++) {
      const testLine = line + words[n] + " ";
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxWidth && n > 0) {
        ctx.fillText(line, x, yy);
        line = words[n] + " ";
        yy += lineHeight;
        if (yy > y + lineHeight * 6) break;
      } else {
        line = testLine;
      }
    }
    ctx.fillText(line, x, yy);
  }
})();
