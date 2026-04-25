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

  const navToeic = document.getElementById("navToeic");
  const navLegacy = document.getElementById("navLegacy");
  const panelToeic = document.getElementById("panel-toeic");
  const panelLegacy = document.getElementById("panel-legacy");
  const mainGrid = document.getElementById("main-grid");
  const panelSoon = document.getElementById("panel-soon");
  const soonTitle = document.getElementById("soonTitle");
  if (!navToeic || !panelToeic || !mainGrid || !panelSoon) return;

  function clearGnb() {
    document.querySelectorAll(".gnb-item").forEach((b) => b.classList.remove("active"));
  }

  function setMode(mode, clickedBtn) {
    if (mode === "toeic") {
      clearGnb();
      (clickedBtn || navToeic).classList.add("active");
      panelSoon.classList.add("hidden");
      mainGrid.classList.remove("hidden");
      panelLegacy.classList.add("hidden");
    } else if (mode === "legacy") {
      clearGnb();
      (clickedBtn || navLegacy).classList.add("active");
      panelSoon.classList.add("hidden");
      mainGrid.classList.add("hidden");
      panelLegacy.classList.remove("hidden");
      stopVisualizer();
    } else if (mode === "soon") {
      clearGnb();
      clickedBtn?.classList.add("active");
      const t = clickedBtn?.getAttribute("data-soon-title") || "서비스";
      if (soonTitle) soonTitle.textContent = `${t} (준비 중)`;
      panelSoon.classList.remove("hidden");
      mainGrid.classList.add("hidden");
      panelLegacy.classList.add("hidden");
      stopVisualizer();
    }
  }

  document.querySelectorAll(".gnb-item").forEach((btn) => {
    btn.addEventListener("click", () => {
      const p = btn.getAttribute("data-panel");
      if (p === "toeic") setMode("toeic", btn);
      else if (p === "legacy") setMode("legacy", btn);
      else if (p === "soon") setMode("soon", btn);
    });
  });

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
  const canvasCombined = document.getElementById("canvasCombined");
  const grammarBanner = document.getElementById("grammarBanner");
  const shameFill = document.getElementById("shameFill");
  const shamePct = document.getElementById("shamePct");
  const btnMic = document.getElementById("btnMic");
  const btnStop = document.getElementById("btnStop");
  const btnEval = document.getElementById("btnEval");
  const toeicResult = document.getElementById("toeicResult");
  const btnShare = document.getElementById("btnShareStory");
  const shareCanvas = document.getElementById("shareCanvas");

  let currentPartId = null;
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
      if (isCorrect) {
        toeicResult.innerHTML = `<h3 style="color:#38a169">정답입니다! 🐾</h3><p>정확한 청취 능력을 보유하고 계시군요.</p>`;
        toeicStatus.textContent = "채점 완료: 정답";
      } else {
        const labels = ["A", "B", "C", "D"];
        toeicResult.innerHTML = `<h3 style="color:#e53e3e">오답입니다. 🐕</h3><p>정답은 ${labels[currentCorrectAnswer]}입니다. 더 정진하세요.</p>`;
        toeicStatus.textContent = "채점 완료: 오답";
      }
      btnShare.disabled = false;
    });
  });

  function stopVisualizer() {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
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

  function drawCombinedWave(userBuf, t) {
    if (!canvasCombined) return;
    const w = canvasCombined.width;
    const h = canvasCombined.height;
    const ctx = canvasCombined.getContext("2d");

    // 배경 청소
    ctx.fillStyle = "#0a0d14";
    ctx.fillRect(0, 0, w, h);

    // 1. 표준 음성 스펙트럼 (Reference - 파란색, '짖음' 버스트 패턴)
    ctx.strokeStyle = "rgba(108, 166, 255, 0.5)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    
    // 짖음(Bark) 특유의 폭발적 주기를 생성
    const barkInterval = 2.0; // 2초마다 짖음
    const barkPhase = t % barkInterval;
    const isBarking = barkPhase < 0.4; // 0.4초 동안 짖음
    const barkEnvelope = isBarking ? Math.exp(-barkPhase * 8) : 0; // 급격한 감쇄 효과

    for (let x = 0; x < w; x++) {
      const freq = 0.02 + Math.sin(t * 0.1) * 0.01;
      const wave = Math.sin(x * freq * 10) * 50 + Math.sin(x * freq * 25) * 20;
      // 짖는 중일 때만 파동이 크게 일어남
      const y = h / 2 + wave * barkEnvelope * (0.5 + Math.random() * 0.2);
      
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // 2. 사용자 입력 파형 (Target - 분홍색)
    if (userBuf) {
      ctx.strokeStyle = "rgba(255, 107, 138, 0.9)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      const step = Math.max(1, Math.floor(userBuf.length / w));
      for (let x = 0; x < w; x++) {
        const i = Math.min(userBuf.length - 1, x * step);
        const y = h / 2 + userBuf[i] * (h * 0.45);
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    // 라벨 표시
    ctx.font = "12px system-ui";
    ctx.fillStyle = "rgba(108, 166, 255, 0.8)";
    ctx.fillText("Standard Reference", 15, h - 35);
    ctx.fillStyle = "rgba(255, 107, 138, 1)";
    ctx.fillText("User Input (Target)", 15, h - 15);
  }

  function dominantBinFromTimeDomain(buf, sr) {
    const n = 256;
    const slice = buf.slice(0, n);
    const x = new Float32Array(n);
    for (let i = 0; i < n; i++) x[i] = slice[i] * (0.5 * (1 - Math.cos((2 * Math.PI * i) / (n - 1))));
    const re = new Float32Array(n / 2);
    const im = new Float32Array(n / 2);
    for (let k = 0; k < n / 2; k++) {
      let rr = 0;
      let ii = 0;
      for (let i = 0; i < n; i++) {
        const ang = (-2 * Math.PI * k * i) / n;
        rr += x[i] * Math.cos(ang);
        ii += x[i] * Math.sin(ang);
      }
      re[k] = rr;
      im[k] = ii;
    }
    let maxK = 2;
    let maxM = 0;
    for (let k = 3; k < n / 2; k++) {
      const m = re[k] * re[k] + im[k] * im[k];
      if (m > maxM) {
        maxM = m;
        maxK = k;
      }
    }
    return { bin: maxK };
  }

  function loopDraw() {
    if (!canvasCombined) return;
    
    let buf = null;
    if (analyser) {
      analyser.getByteTimeDomainData(dataArray);
      buf = new Float32Array(dataArray.length);
      for (let i = 0; i < dataArray.length; i++) buf[i] = (dataArray[i] - 128) / 128;
      
      const rms = Math.sqrt(buf.reduce((s, v) => s + v * v, 0) / buf.length);
      lastRmsHistory.push(rms);
      if (lastRmsHistory.length > 12) lastRmsHistory.shift();
      
      const stability = lastRmsHistory.length > 4
          ? 1 - (lastRmsHistory.reduce((a, b) => a + Math.abs(b - lastRmsHistory[0]), 0) / lastRmsHistory.length)
          : 0;
      
      const accuracy = Math.min(100, Math.max(0, (rms * 1500) * stability + (rms > 0.01 ? 20 : 0)));
      shameFill.style.width = `${accuracy}%`;
      shamePct.textContent = `${Math.round(accuracy)}%`;

      const sr = audioCtx.sampleRate;
      const { bin: userBin } = dominantBinFromTimeDomain(buf, sr);
      if (grammarBanner) {
        if (refPeakBin > 0 && Math.abs(userBin - refPeakBin) > 14) {
          grammarBanner.classList.add("show");
          grammarBanner.textContent = "발음 분석: 주파수 불일치";
        } else {
          grammarBanner.classList.remove("show");
        }
      }
    }

    const t = (performance.now() - timeStart) / 1000;
    drawCombinedWave(buf, t);
    rafId = requestAnimationFrame(loopDraw);
  }

  async function startMic() {
    stopVisualizer();
    lastRmsHistory = [];
    grammarBanner?.classList.remove("show");
    micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const src = audioCtx.createMediaStreamSource(micStream);
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.65;
    src.connect(analyser);
    dataArray = new Uint8Array(analyser.fftFrequencyBinCount);
    const tmp = new Uint8Array(analyser.fftSize);
    analyser.getByteTimeDomainData(tmp);
    const f32 = new Float32Array(tmp.length);
    for (let i = 0; i < tmp.length; i++) f32[i] = (tmp[i] - 128) / 128;
    refPeakBin = dominantBinFromTimeDomain(f32, audioCtx.sampleRate).bin;

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
    toeicStatus.textContent = "마이크 켜짐 · 짖은 뒤 '녹음 종료 및 채점'을 누르세요.";
    btnMic.disabled = true;
    btnStop.disabled = false;
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
    await stopMicKeepBlob();
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
    btnEval.disabled = recordedChunks.length === 0 || currentPartId == null;
    toeicStatus.textContent = recordedChunks.length
      ? "녹음 완료. 채점을 누르세요."
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
    currentCorrectAnswer = null;
    toeicResult.innerHTML = "아직 채점 전입니다.";
    toeicResult.classList.add("muted");
    btnShare.disabled = true;

    // 시각화 초기화 및 랜덤 파형 생성
    timeStart = performance.now();
    refWaveParams = {
      f0: 0.01 + Math.random() * 0.015,
      m1: 5 + Math.random() * 10,
      m2: 15 + Math.random() * 15,
      a1: 30 + Math.random() * 30,
      a2: 10 + Math.random() * 20
    };
    drawCombinedWave(null, 0);

    try {
      // 캐시 방지를 위해 타임스탬프 추가
      const res = await fetch(`/api/v1/toeic/start-part/${partId}?t=${Date.now()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "load failed");
      
      console.log("Loaded data:", data); // 디버깅용 로그

      toeicPartTitle.textContent = data.title || "";
      
      // 질문 영역 텍스트 바인딩
      const qContent = data.question_text || "질문 내용을 불러올 수 없습니다.";
      if (data.type === "speaking") {
        const script = data.script || "멍멍!";
        toeicQuestion.textContent = `[과제] 아래 스크립트로 짖으세요: "${script}" (상황: ${qContent})`;
      } else {
        toeicQuestion.textContent = qContent;
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

      // 유형별 UI 분기
      if (data.type === "speaking") {
        micSection.classList.remove("hidden");
        toeicStatus.textContent = "파트 로드 완료. 마이크로 녹음 후 채점하세요.";
        // 마이크는 안켜져있어도 스펙트럼은 계속 돌아가게 함
        if (!rafId) loopDraw();
      } else {
        choiceSection.classList.remove("hidden");
        toeicStatus.textContent = "파트 로드 완료. 문제를 듣고/보고 정답을 선택하세요.";
        if (rafId) cancelAnimationFrame(rafId);
        rafId = null;
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
      toeicResult.innerHTML = `
        <p><strong>Session:</strong> ${data.session_id}</p>
        <p><strong>Level:</strong> ${sr.level} · <span class="muted">${tier}</span></p>
        <p><strong>기술 점수:</strong> ${sr.technical_score}</p>
        <p><strong>인간 방언 감지:</strong> ${sr.is_human_dialect_detected ? "예" : "아니오"}</p>
        <p><strong>스펙트럼:</strong> ${sr.spectral_analysis}</p>
        <p><strong>Gemini 피드백:</strong> ${data.gemini_feedback}</p>
        <p><strong>조언:</strong></p>
        <ul>${(data.advice || []).map((a) => `<li>${a}</li>`).join("")}</ul>
      `;
      toeicStatus.textContent = "채점 완료.";
      btnShare.disabled = false;
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
