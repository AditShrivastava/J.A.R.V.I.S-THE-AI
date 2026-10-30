import { useCallback, useEffect, useRef, useState } from "react";
import {
  Download,
  Mic,
  MicOff,
  Send,
  Settings,
  X,
} from "lucide-react";

type Message = {
  role: "user" | "assistant";
  content: string;
  pdfUrl?: string;
};
type Mode = "idle" | "listening" | "thinking" | "speaking";



function supportsSpeechRecognition() {
  return (
    typeof window !== "undefined" &&
    ("SpeechRecognition" in window || "webkitSpeechRecognition" in window)
  );
}

function LivingOrb({ mode }: { mode: Mode }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const modeRef = useRef<Mode>(mode);
  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    let raf = 0;
    let width = 0;
    let height = 0;
    let dpr = 1;
    let angle = 0;
    let lastTime = 0;
    const latSteps = 18;
    const lonSteps = 46;
    const grid: { x: number; y: number; z: number }[][] = [];

    for (let latIndex = 0; latIndex <= latSteps; latIndex++) {
      const lat = -Math.PI / 2 + (Math.PI * latIndex) / latSteps;
      const row = [];
      for (let lonIndex = 0; lonIndex < lonSteps; lonIndex++) {
        const lon = (Math.PI * 2 * lonIndex) / lonSteps;
        row.push({
          x: Math.cos(lat) * Math.cos(lon),
          y: Math.sin(lat),
          z: Math.cos(lat) * Math.sin(lon),
        });
      }
      grid.push(row);
    }

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();

    const frame = (time: number) => {
      const delta = lastTime ? Math.min(time - lastTime, 40) : 16;
      lastTime = time;
      const current = modeRef.current;
      const thinking = current === "thinking";
      const speaking = current === "speaking";
      const listening = current === "listening";
      angle += (thinking ? 0.012 : speaking ? 0.0085 : 0.0032) * (delta / 16);

      ctx.clearRect(0, 0, width, height);
      const cx = width / 2;
      const cy = height / 2;
      const base = Math.min(width, height);
      const radius = base * 0.345;
      const pulse = 1 + Math.sin(time * (thinking ? 0.008 : 0.003)) * (thinking ? 0.035 : speaking ? 0.022 : 0.012);
      const ballRadius = radius * pulse;

      const aura = ctx.createRadialGradient(cx, cy, radius * 0.12, cx, cy, radius * 1.46);
      aura.addColorStop(0, `rgba(255,177,51,${thinking ? 0.17 : 0.10})`);
      aura.addColorStop(0.48, "rgba(160,90,15,0.055)");
      aura.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = aura;
      ctx.beginPath();
      ctx.arc(cx, cy, radius * 1.46, 0, Math.PI * 2);
      ctx.fill();

      const rotated: { x: number; y: number; z: number }[][] = [];
      const sy = Math.sin(angle);
      const cyRot = Math.cos(angle);
      const tilt = 0.29 + Math.sin(angle * 0.37) * 0.08;
      const sx = Math.sin(tilt);
      const cxRot = Math.cos(tilt);
      for (let latIndex = 0; latIndex < grid.length; latIndex++) {
        const row = [];
        for (let lonIndex = 0; lonIndex < lonSteps; lonIndex++) {
          const p = grid[latIndex][lonIndex];
          const x1 = p.x * cyRot + p.z * sy;
          const z1 = -p.x * sy + p.z * cyRot;
          const y2 = p.y * cxRot - z1 * sx;
          const z2 = p.y * sx + z1 * cxRot;
          row.push({ x: cx + x1 * ballRadius, y: cy + y2 * ballRadius, z: z2 });
        }
        rotated.push(row);
      }

      // Draw the rear wire structure first, then the brighter front wires.
      for (let pass = 0; pass < 2; pass++) {
        for (let latIndex = 1; latIndex < latSteps; latIndex++) {
          for (let lonIndex = 0; lonIndex < lonSteps; lonIndex++) {
            const nextLon = (lonIndex + 1) % lonSteps;
            const a = rotated[latIndex][lonIndex];
            const b = rotated[latIndex][nextLon];
            const depth = (a.z + b.z) / 2;
            if ((pass === 0 && depth > 0.12) || (pass === 1 && depth <= 0.12)) continue;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.strokeStyle = pass === 0
              ? `rgba(181,111,28,${0.075 + Math.max(0, -depth) * 0.07})`
              : `rgba(255,190,78,${0.20 + depth * 0.38})`;
            ctx.lineWidth = pass === 0 ? 0.55 : 0.68 + Math.max(0, depth) * 0.35;
            ctx.stroke();
          }
        }
        for (let lonIndex = 0; lonIndex < lonSteps; lonIndex++) {
          for (let latIndex = 0; latIndex < latSteps; latIndex++) {
            const a = rotated[latIndex][lonIndex];
            const b = rotated[latIndex + 1][lonIndex];
            const depth = (a.z + b.z) / 2;
            if ((pass === 0 && depth > 0.12) || (pass === 1 && depth <= 0.12)) continue;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.strokeStyle = pass === 0
              ? `rgba(177,104,22,${0.07 + Math.max(0, -depth) * 0.06})`
              : `rgba(255,181,58,${0.19 + depth * 0.39})`;
            ctx.lineWidth = pass === 0 ? 0.5 : 0.66 + Math.max(0, depth) * 0.3;
            ctx.stroke();
          }
        }
      }

      // The wire lattice nodes shimmer as if packets are travelling through it.
      for (let latIndex = 2; latIndex < latSteps; latIndex += 2) {
        for (let lonIndex = 0; lonIndex < lonSteps; lonIndex += 3) {
          const p = rotated[latIndex][lonIndex];
          const shimmer = (Math.sin(time * 0.0025 + latIndex * 1.7 + lonIndex) + 1) / 2;
          const alpha = 0.18 + Math.max(0, p.z) * 0.65 + shimmer * 0.13;
          ctx.beginPath();
          ctx.arc(p.x, p.y, 0.7 + shimmer * 0.55, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255,205,112,${alpha})`;
          ctx.fill();
        }
      }

      // Offset orbit rings create the floating orrery effect.
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(-0.27 + Math.sin(angle * 0.5) * 0.08);
      ctx.beginPath();
      ctx.ellipse(0, 0, radius * 1.22, radius * 0.34, angle * 0.24, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255,185,64,${thinking ? 0.58 : 0.36})`;
      ctx.lineWidth = 1.15;
      ctx.shadowColor = "rgba(255,168,34,0.75)";
      ctx.shadowBlur = thinking ? 15 : 8;
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.beginPath();
      ctx.ellipse(0, 0, radius * 1.32, radius * 0.23, -angle * 0.41, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255,205,108,${speaking ? 0.58 : 0.25})`;
      ctx.lineWidth = 0.8;
      ctx.stroke();
      ctx.restore();

      // The central reactor-like heart has a warm, living pulse.
      const coreSize = radius * (thinking ? 0.26 : speaking ? 0.22 + Math.abs(Math.sin(time * 0.012)) * 0.035 : 0.20);
      const core = ctx.createRadialGradient(cx, cy, coreSize * 0.02, cx, cy, coreSize * 2.5);
      core.addColorStop(0, "rgba(255,248,215,0.96)");
      core.addColorStop(0.15, `rgba(255,190,75,${thinking ? 0.9 : 0.72})`);
      core.addColorStop(0.48, "rgba(255,136,20,0.22)");
      core.addColorStop(1, "rgba(255,119,0,0)");
      ctx.fillStyle = core;
      ctx.beginPath();
      ctx.arc(cx, cy, coreSize * 2.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(-angle * 1.8);
      ctx.beginPath();
      ctx.ellipse(0, 0, coreSize * 1.52, coreSize * 0.47, 0, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(255,221,151,0.88)";
      ctx.lineWidth = 1.15;
      ctx.shadowColor = "#ffae35";
      ctx.shadowBlur = 14;
      ctx.stroke();
      ctx.restore();

      // A soft scan pulse expands during computation and speech.
      if (thinking || speaking || listening) {
        const pulsePhase = (time % (thinking ? 1600 : speaking ? 850 : 2100)) / (thinking ? 1600 : speaking ? 850 : 2100);
        const pulseRadius = radius * (0.74 + pulsePhase * 0.68);
        ctx.beginPath();
        ctx.arc(cx, cy, pulseRadius, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255,174,48,${(1 - pulsePhase) * (thinking ? 0.24 : 0.13)})`;
        ctx.lineWidth = 0.8;
        ctx.stroke();
      }

      // A handful of drifting particles add depth without visual clutter.
      for (let i = 0; i < 34; i++) {
        const drift = time * (thinking ? 0.00020 : 0.00008) + i * 2.399;
        const orbit = radius * (0.92 + (i % 9) * 0.055);
        const px = cx + Math.cos(drift + i) * orbit;
        const py = cy + Math.sin(drift * 0.82 + i * 1.7) * orbit * 0.65;
        const alpha = 0.12 + ((Math.sin(drift * 2.8) + 1) / 2) * 0.48;
        ctx.fillStyle = `rgba(255,188,82,${alpha})`;
        ctx.beginPath();
        ctx.arc(px, py, i % 7 === 0 ? 1.5 : 0.7, 0, Math.PI * 2);
        ctx.fill();
      }

      raf = window.requestAnimationFrame(frame);
    };

    raf = window.requestAnimationFrame(frame);
    return () => {
      window.cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, []);

  return <canvas ref={canvasRef} className="orb-canvas" aria-hidden="true" />;
}

export default function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [mode, setMode] = useState<Mode>("idle");
  const [transcript, setTranscript] = useState("");
  const [wakeEnabled, setWakeEnabled] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [typedReply, setTypedReply] = useState("");
  const [isTypingReply, setIsTypingReply] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [voiceReplies, setVoiceReplies] = useState(true);
  const [wakeWord, setWakeWord] = useState("Hey Jarvis");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const recognitionRef = useRef<any>(null);
  const recognitionRunningRef = useRef(false);
  const pauseRecognitionRef = useRef(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const wakeEnabledRef = useRef(false);
  const messagesRef = useRef<Message[]>([]);
  const listeningForCommandRef = useRef(false);

  const pauseRecognition = useCallback(() => {
    if (!wakeEnabledRef.current) return;
    pauseRecognitionRef.current = true;
    try { recognitionRef.current?.stop(); } catch { /* recognition may already be stopped */ }
  }, []);

  const resumeRecognition = useCallback(() => {
    pauseRecognitionRef.current = false;
    if (!wakeEnabledRef.current) return;
    const recognition = recognitionRef.current;
    if (!recognition || recognitionRunningRef.current) return;
    window.setTimeout(() => {
      if (wakeEnabledRef.current && !pauseRecognitionRef.current && !recognitionRunningRef.current && recognitionRef.current === recognition) {
        try { recognition.start(); } catch { /* onend may already be restarting it */ }
      }
    }, 220);
  }, []);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);
  useEffect(() => {
    wakeEnabledRef.current = wakeEnabled;
  }, [wakeEnabled]);

  const speak = useCallback(async (text: string) => {
    pauseRecognition();
    if (!voiceReplies) {
      setMode(wakeEnabledRef.current ? "listening" : "idle");
      resumeRecognition();
      return;
    }
    window.speechSynthesis?.cancel();
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    try {
      const response = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (response.ok && response.headers.get("content-type")?.includes("audio")) {
        const audioUrl = URL.createObjectURL(await response.blob());
        const audio = new Audio(audioUrl);
        audioRef.current = audio;
        audio.onplay = () => setMode("speaking");
        audio.onended = () => {
          URL.revokeObjectURL(audioUrl);
          audioRef.current = null;
          setMode(wakeEnabledRef.current ? "listening" : "idle");
          resumeRecognition();
        };
        audio.onerror = () => {
          URL.revokeObjectURL(audioUrl);
          audioRef.current = null;
          setMode(wakeEnabledRef.current ? "listening" : "idle");
          resumeRecognition();
        };
        await audio.play();
        return;
      }
    } catch {
      // Browser speech is used as a fallback if custom TTS is unavailable.
    }

    if (!("speechSynthesis" in window)) {
      setMode(wakeEnabledRef.current ? "listening" : "idle");
      resumeRecognition();
      return;
    }
    const utterance = new SpeechSynthesisUtterance(text.replace(/\|/g, " "));
    utterance.rate = 1.01;
    utterance.pitch = 0.88;
    utterance.onstart = () => setMode("speaking");
    utterance.onend = () => {
      setMode(wakeEnabledRef.current ? "listening" : "idle");
      resumeRecognition();
    };
    utterance.onerror = () => {
      setMode(wakeEnabledRef.current ? "listening" : "idle");
      resumeRecognition();
    };
    window.speechSynthesis.speak(utterance);
  }, [voiceReplies, pauseRecognition, resumeRecognition]);

  const sendMessage = useCallback(async (content: string) => {
    const clean = content.trim();
    if (!clean) return;

    pauseRecognition();
    listeningForCommandRef.current = false;
    window.speechSynthesis?.cancel();
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    const next: Message[] = [...messagesRef.current, { role: "user", content: clean }];
    setMessages(next);
    messagesRef.current = next;
    setTranscript("");
    setMode("thinking");
    setTypedReply("");
    setIsTypingReply(false);
    setError("");

    const wantsReport = /\b(pdf|report|export|download)\b/i.test(clean);
    const requestMessages = next.map((message) => ({ role: message.role, content: message.content }));
    if (wantsReport && requestMessages.length) {
      const last = requestMessages[requestMessages.length - 1];
      last.content += `

Create a decision-ready business report using the full conversation context. Use Markdown headings and valid Markdown tables (header row plus separator row); never use HTML tags. Include an executive decision summary, business context with confirmed inputs and unknowns, relevant customer-segment analysis, a six-factor attractiveness matrix with numeric scores only in score cells and the rationale in its own column, an evidence-informed recommendation with trade-offs, a concrete validation plan, risks and mitigations, and a 30/60/90-day action plan where suitable. Never invent market sizes, growth rates, prices, budgets, staffing, costs, citations, or sources. Write “Not provided - validate before investing” for missing data, and label any strategic scores as provisional judgments when evidence is incomplete. For financial calculations, use only user-provided figures and show formulas for missing inputs.`;
    }

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: requestMessages }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Request failed.");

      const assistantMessage: Message = { role: "assistant", content: data.reply };
      if (wantsReport) {
        try {
          const pdfResponse = await fetch("/api/report", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              title: "J.A.R.V.I.S. Business Strategy Report",
              content: data.reply,
            }),
          });
          if (!pdfResponse.ok) {
            const pdfError = await pdfResponse.json().catch(() => ({}));
            throw new Error(pdfError.error || "The PDF could not be generated.");
          }
          assistantMessage.pdfUrl = URL.createObjectURL(await pdfResponse.blob());
        } catch (pdfError) {
          const reason = pdfError instanceof Error ? pdfError.message : "Unknown PDF error.";
          setError(`The answer is ready, but PDF export failed: ${reason}`);
        }
      }

      const updated = [...next, assistantMessage];
      setMessages(updated);
      messagesRef.current = updated;
      setMode("idle");
      speak(wantsReport && assistantMessage.pdfUrl
        ? "Your report is ready. Open the conversation console to download the PDF."
        : data.reply);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Something went wrong.";
      setError(message);
      setMode(wakeEnabledRef.current ? "listening" : "idle");
      resumeRecognition();
    }
  }, [speak, pauseRecognition, resumeRecognition]);

  const startRecognition = useCallback(() => {
    if (!supportsSpeechRecognition()) {
      setError("Speech recognition is not supported in this browser. Use Chrome or Edge, or open the conversation console to type.");
        return;
    }
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch { /* already stopped */ }
    }
    const SpeechRecognitionCtor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognitionCtor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-IN";
    recognitionRef.current = recognition;

    recognition.onresult = (event: any) => {
      let finalText = "";
      let interimText = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) finalText += result[0].transcript + " ";
        else interimText += result[0].transcript;
      }
      setTranscript(`${finalText}${interimText}`.trim());
      if (!finalText.trim()) return;

      const final = finalText.trim();
      if (!final) return;

      if (/\b(stop listening|cancel|never mind)\b/i.test(final)) {
        listeningForCommandRef.current = false;
        setTranscript("");
        setMode("listening");
        speak("Understood. I'm standing by.");
        return;
      }

      if (listeningForCommandRef.current) {
        listeningForCommandRef.current = false;
        void sendMessage(final);
        return;
      }

      // Match the wake phrase even if Edge inserts punctuation or a pause.
      const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const wakeParts = wakeWord.trim().split(/\s+/).filter(Boolean).map(escapeRegex);
      const wakePattern = wakeParts.length
        ? new RegExp(`\\b${wakeParts.join("[\\s,.:;!?-]*")}\\b`, "i")
        : /\bhey[\s,.:;!?-]*jarvis\b/i;
      const wakeMatch = final.match(wakePattern);

      if (wakeMatch && typeof wakeMatch.index === "number") {
        const after = final.slice(wakeMatch.index + wakeMatch[0].length).replace(/^[\s,.:;!?-]+/, "").trim();
        if (after.length > 1) {
          void sendMessage(after);
        } else {
          listeningForCommandRef.current = true;
          setMode("listening");
          setTranscript("Wake phrase detected. Go ahead…");
          speak("I'm listening. How can I help?");
        }
        return;
      }

      // When the microphone has been activated with a button click, also accept
      // a direct command without requiring the wake phrase. This fixes the case
      // where Edge transcribes the user but the transcript is never submitted.
      if (final.length > 1) void sendMessage(final);
    };
    recognition.onstart = () => {
      if (recognitionRef.current === recognition) recognitionRunningRef.current = true;
    };
    recognition.onerror = (event: any) => {
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        setError("Microphone permission was denied. Allow microphone access in your browser settings.");
        setWakeEnabled(false);
        wakeEnabledRef.current = false;
        pauseRecognitionRef.current = false;
        recognitionRunningRef.current = false;
        setMode("idle");
      } else if (event.error !== "no-speech" && event.error !== "aborted") {
        setError(`Speech recognition issue: ${event.error}`);
      }
    };
    recognition.onend = () => {
      if (recognitionRef.current !== recognition) return;
      recognitionRunningRef.current = false;
      if (wakeEnabledRef.current && !pauseRecognitionRef.current) {
        window.setTimeout(() => {
          if (wakeEnabledRef.current && !pauseRecognitionRef.current && !recognitionRunningRef.current && recognitionRef.current === recognition) {
            try { recognition.start(); } catch { /* recognition is already restarting */ }
          }
        }, 180);
      }
    };
    try {
      pauseRecognitionRef.current = false;
      recognition.start();
      setWakeEnabled(true);
      wakeEnabledRef.current = true;
      setMode("listening");
      setError("");
    } catch {
      setError("Could not start the microphone. Try clicking the microphone again.");
    }
  }, [sendMessage, speak, wakeWord]);

  const stopRecognition = useCallback(() => {
    setWakeEnabled(false);
    wakeEnabledRef.current = false;
    pauseRecognitionRef.current = false;
    listeningForCommandRef.current = false;
    try { recognitionRef.current?.stop(); } catch { /* already stopped */ }
    window.speechSynthesis?.cancel();
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setMode("idle");
    setTranscript("");
  }, []);

  useEffect(() => () => {
    wakeEnabledRef.current = false;
    pauseRecognitionRef.current = false;
    try { recognitionRef.current?.stop(); } catch { /* already stopped */ }
    window.speechSynthesis?.cancel();
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    messagesRef.current.forEach((message) => {
      if (message.pdfUrl) URL.revokeObjectURL(message.pdfUrl);
    });
  }, []);

  const toggleWake = () => wakeEnabled ? stopRecognition() : startRecognition();
  const latestAssistantMessage = [...messages].reverse().find((message) => message.role === "assistant");
  const latestReply = latestAssistantMessage?.content;

  useEffect(() => {
    if (!latestReply) {
      setTypedReply("");
      setIsTypingReply(false);
      return;
    }
    let index = 0;
    setTypedReply("");
    setIsTypingReply(true);
    const step = Math.max(1, Math.ceil(latestReply.length / 420));
    const timer = window.setInterval(() => {
      index = Math.min(latestReply.length, index + step);
      setTypedReply(latestReply.slice(0, index));
      if (index >= latestReply.length) {
        window.clearInterval(timer);
        setIsTypingReply(false);
      }
    }, 14);
    return () => window.clearInterval(timer);
  }, [latestReply]);
  const statusText = mode === "thinking"
    ? "PROCESSING REQUEST"
    : mode === "speaking"
      ? "VOICE OUTPUT ACTIVE"
      : mode === "listening"
        ? "MICROPHONE ACTIVE"
        : "SYSTEM STANDING BY";

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch {
      setError("Fullscreen is not available in this browser.");
    }
  };

  const downloadPdf = (message: Message) => {
    if (!message.pdfUrl) return;
    const link = document.createElement("a");
    link.href = message.pdfUrl;
    link.download = "JARVIS-business-strategy-report.pdf";
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  return (
    <main className={`app-shell mode-${mode}`}>
      <div className="ambient-grid" aria-hidden="true" />
      <div className="ambient-vignette" aria-hidden="true" />
      <div className="background-particles" aria-hidden="true"><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /></div>

      <header className="topbar">
        <div className="brand-lockup">
          <div className="brand-mark"><span /><span /><span /></div>
          <div>
            <div className="brand-name">J.A.R.V.I.S.</div>
            <div className="brand-subtitle">PERSONAL INTELLIGENCE SYSTEM</div>
          </div>
        </div>
        <div className="system-status"><span className={`system-dot ${mode}`} /><span>{statusText}</span></div>
        <div className="top-actions">
          <button className="top-icon" onClick={() => setShowSettings(true)} aria-label="Open settings" title="Settings"><Settings size={17} /></button>
          <button className="top-icon" onClick={toggleFullscreen} aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"} title="Fullscreen"><span className="fullscreen-glyph">{isFullscreen ? "↙" : "⛶"}</span></button>
        </div>
      </header>

      <section className={`hero hero-${mode}`} aria-label="JARVIS holographic interface">
        <div className="hero-pretitle"><span /> NEURAL INTERFACE <span /></div>
        <div className={`voice-waveform ${mode === "speaking" ? "waveform-active" : mode === "listening" ? "waveform-listening" : ""}`} aria-label={mode === "speaking" ? "JARVIS speaking" : "Voice waveform idle"}>
          {Array.from({ length: 51 }, (_, i) => <i key={i} style={{ "--bar": `${12 + ((i * 17 + i * i * 3) % 34)}px`, "--delay": `${(i % 11) * -0.07}s` } as React.CSSProperties} />)}
        </div>
        <div className={`orb-wrap orb-${mode}`}>
          <div className="orb-floor-glow" />
          <div className="floor-disc floor-disc-one" />
          <div className="floor-disc floor-disc-two" />
          <div className="orb-body"><LivingOrb mode={mode} /></div>
          <div className="orbit-streak orbit-streak-one" />
          <div className="orbit-streak orbit-streak-two" />
        </div>
        <div className="hero-title">J.A.R.V.I.S.</div>
        <div className="hero-expansion">JUST A RATHER VERY INTELLIGENT SYSTEM</div>
        <div className="hero-state"><span className={`state-led ${mode}`} />{mode === "thinking" ? "ANALYSING YOUR REQUEST" : mode === "speaking" ? "RESPONDING" : mode === "listening" ? (listeningForCommandRef.current ? "AWAITING COMMAND" : `LISTENING · ${wakeWord.toUpperCase()}`) : "AWAITING INPUT"}</div>
        {transcript && <div className="transcript-chip"><span className="transcript-bars"><i /><i /><i /><i /></span>{transcript}</div>}
      </section>

      <section className="interaction-dock" aria-label="JARVIS conversation">
        <form className="main-composer" onSubmit={(event) => {
          event.preventDefault();
          if (query.trim() && mode !== "thinking") {
            const submitted = query;
            setQuery("");
            void sendMessage(submitted);
          }
        }}>
          <button type="button" className={`composer-mic ${wakeEnabled ? "is-active" : ""}`} onClick={toggleWake} aria-label={wakeEnabled ? "Stop microphone" : "Start microphone"} title={wakeEnabled ? "Stop microphone" : "Start microphone"}>
            {wakeEnabled ? <MicOff size={19} /> : <Mic size={19} />}
          </button>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Ask J.A.R.V.I.S. anything about your business…" aria-label="Type your query" autoComplete="off" />
          <button type="submit" className="composer-send" disabled={!query.trim() || mode === "thinking"} aria-label="Send query" title="Send query"><Send size={18} /></button>
        </form>

        {(typedReply || mode === "thinking" || error) && <div className="response-panel" aria-live="polite">
          <div className="response-heading"><span className="response-indicator" /><span>{mode === "thinking" ? "ANALYSING" : isTypingReply ? "J.A.R.V.I.S. RESPONDING" : "RESPONSE"}</span><span className="response-rule" /></div>
          {mode === "thinking" && !typedReply ? <div className="response-thinking"><span className="thinking-orbit"><i /></span><span>Processing your request…</span></div> : <div className="response-content">{typedReply}{isTypingReply && <span className="typing-caret" />}</div>}
          {error && <div className="response-error" role="alert">{error}</div>}
          {latestAssistantMessage?.pdfUrl && !isTypingReply && <button className="report-download" onClick={() => downloadPdf(latestAssistantMessage)}><Download size={16} /><span><strong>Download strategy report</strong><small>Professionally formatted PDF</small></span><span className="report-filetype">PDF <span>↓</span></span></button>}
        </div>}
        <div className="dock-footer"><span><i /> GROQ INTELLIGENCE</span><span>{wakeEnabled ? "MICROPHONE ACTIVE" : "VOICE INPUT AVAILABLE"} · ELEVENLABS VOICE</span></div>
      </section>

      {showSettings && <div className="modal-backdrop" onClick={() => setShowSettings(false)}>
        <section className="settings-modal" onClick={(event) => event.stopPropagation()}>
          <div className="settings-heading"><div><span className="drawer-kicker">SYSTEM CONFIGURATION</span><h2>Preferences</h2></div><button className="drawer-close" onClick={() => setShowSettings(false)} aria-label="Close settings"><X size={18} /></button></div>
          <label className="setting-label">Wake phrase<input value={wakeWord} onChange={(event) => setWakeWord(event.target.value || "Hey Jarvis")} maxLength={24} /></label>
          <label className="setting-toggle"><span><strong>Spoken responses</strong><small>Read J.A.R.V.I.S. replies aloud</small></span><input type="checkbox" checked={voiceReplies} onChange={(event) => setVoiceReplies(event.target.checked)} /></label>
          <p className="settings-note">Wake phrase detection uses browser speech recognition. This is not a dedicated always-on wake-word engine; microphone permission and an open browser tab are required.</p>
          <button className="settings-save" onClick={() => setShowSettings(false)}>Save preferences</button>
        </section>
      </div>}
    </main>
  );
}
