// == STATE VARS ==
const CONFIG = {
    LOW: [1000, 1200, 1400, 1600, 1800, 2000, 2200, 2400, 2600],
    HIGH: [2600, 2800, 3000, 3200, 3400, 3600, 3800, 4000, 4200],
    HEADER: 4400,
    FOOTER: [900, 800],
    NOTE_LEN: 0.12
};

const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
let isDecoding = false, decodedMessage = "", lastChar = "", isLocked = false;
let toneDuration = 0, spinnerInterval, gibberInterval;
let audioCtx, analyser, mediaRecorder, chunks = [];
const responseEl = document.querySelector('.response');
const btn = document.querySelector('.start-button');
let isSystemActive = !btn.innerText.includes("Start") || btn.innerText !== "Start";
const canvas = document.getElementById('visualizer');
const ctx = canvas.getContext('2d');
recognition.continuous = false;
recognition.lang = 'en-US';

document.addEventListener('DOMContentLoaded', async () => { initSystem() });

// == SYS INIT ==
async function initSystem() {
    if (audioCtx) return;
    try {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const stream = await navigator.mediaDevices.getUserMedia({ 
            audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } 
        });
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 2048;
        audioCtx.createMediaStreamSource(stream).connect(analyser);
        draw(); 
    } catch (e) { showError("MIC ERROR"); }
}

recognition.onresult = async (event) => {
    if (isDecoding) return; 

    const transcript = event.results[event.results.length - 1][0].transcript;
    recognition.stop(); 
    console.log(transcript);
    startThinking(); 
    
    try {
        const res = await fetch('/chat', { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: transcript }) 
        });
        const data = await res.json();
        handleResponse(data);
    } catch (e) { 
        stopThinking(); 
        showError("API ERROR / TIMEOUT"); 
    }
};

// == RESPONSE HANDLER ==
let voices = window.speechSynthesis.getVoices();
if (voices.length === 0) window.speechSynthesis.onvoiceschanged = () => voices = window.speechSynthesis.getVoices();
const targetVoices = voices.filter(v => v.name.includes("Google UK English Female") || v.name.includes("Microsoft Zira") || v.name.includes("Google UK English"));
const randomVoice = targetVoices[Math.floor(Math.random() * targetVoices.length)];

async function handleResponse(data) {
    stopThinking();
    if (data.gibberlink_mode === "true") {
        showGibberCycle();
        const seq = data.text.match(/\d+/g).map(Number); 
        await playGibberL(seq);
        if (!isSystemActive) recognition.start()
    } else {
        responseEl.innerText = data.text;
        txt = new SpeechSynthesisUtterance(data.text)
        txt.voice = randomVoice;
        window.speechSynthesis.speak(txt);

        txt.onend = () => {
            if (!isSystemActive) recognition.start(); 
        };
    }
}

// == PLAYER ==
async function playGibberL(sequence) {
    if (!audioCtx) await initSystem();
    let time = audioCtx.currentTime + 0.1;

    const beep = (f1, f2, t, d) => {
        [f1, f2].forEach(f => {
            const o = audioCtx.createOscillator();
            const g = audioCtx.createGain();
            o.frequency.setValueAtTime(f, t);
            g.gain.setValueAtTime(0.1, t);
            g.gain.exponentialRampToValueAtTime(0.001, t + d);
            o.connect(g).connect(audioCtx.destination);
            o.start(t); o.stop(t + d);
        });
    };

    // HEADER
    beep(CONFIG.HEADER, CONFIG.HEADER + 50, time, 0.2);
    time += 0.3;

    // DATA LOOP
    sequence.forEach(idx => {
        // 9x9 Grid Logic: 
        // Column (Low) = idx / 9
        // Row (High) = idx % 9
        const row = Math.floor(idx / 9);
        const column = idx % 9;

        if (row < CONFIG.LOW.length && column < CONFIG.HIGH.length) {
            beep(CONFIG.LOW[row], CONFIG.HIGH[column], time, CONFIG.NOTE_LEN);
        }
        time += CONFIG.NOTE_LEN + 0.05;
    });

    // FOOTER
    time += 0.1;
    beep(CONFIG.FOOTER[0], CONFIG.FOOTER[1] + 50, time, 0.2);
    
    return new Promise(res => setTimeout(res, (time - audioCtx.currentTime) * 1000));
}

// == INITERPRETER ==
function runDecoder(seq) {
    if (responseEl.innerText.includes("LISTENING...") || responseEl.innerText.includes("PROCESSING")) return
    const specials = "()=+-/_*!@#$%^&<>?"; 

    if (!seq) {
        if (!analyser || isLocked) return;
        const data = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(data);
        const getPeak = (min, max) => {
            let top = {v:0, f:0};
            const bSize = audioCtx.sampleRate / analyser.fftSize;
            for (let i = Math.floor(min/bSize); i <= Math.ceil(max/bSize); i++) {
                if (data[i] > top.v) { top.v = data[i]; top.f = i * bSize; }
            }
            return top;
        };

        // HEADER DETECTOR
        const h = getPeak(CONFIG.HEADER-100, CONFIG.HEADER+100);
        if (h.v > 160) {
            isDecoding = true;
            decodedMessage = "";
            lastChar = "";
            responseEl.setAttribute('data-msg', "");
            isLocked = true; setTimeout(() => isLocked = false, 250);
            return;
        }

        // FOOTER DETECTOR
        const f = getPeak(CONFIG.FOOTER[0]-100, CONFIG.FOOTER[0]+100);
        if (f.v > 160) {
            isDecoding = false;    
            stopGibberCycle();
            responseEl.innerHTML = `<span>"${decodedMessage}"</span>`;
            isLocked = true; setTimeout(() => isLocked = false, 500);
            return;
        }

        // DATA LISTENER
        if (!isDecoding) {
            const pL = getPeak(900, 2600);
            const pH = getPeak(2650, 4300);
            
            if (pL.v < 60 || pH.v < 60) { lastChar = ""; return; }

            if (pL.v > 80 && pH.v > 80) {
                const col = CONFIG.LOW.findIndex(f => Math.abs(f - pL.f) < 70);
                const row = CONFIG.HIGH.findIndex(f => Math.abs(f - pH.f) < 70);
                
                if (col !== -1 && row !== -1) {
                    // REVERSE MATH: Index = (Column * 9) + Row
                    const idx = (col * 9) + row;
                    let char = "";

                    // Simple Range Checks
                    if (idx <= 25) char = String.fromCharCode(65 + idx);      // A-Z
                    else if (idx === 26) char = " ";                          // Space
                    else if (idx >= 27 && idx <= 52) char = String.fromCharCode(97 + (idx - 27)); // a-z
                    else if (idx >= 53 && idx <= 62) char = (idx - 53).toString(); // 0-9
                    else if (idx >= 63) char = specials[idx - 63] || "";      // Specials

                    if (char && char !== lastChar) {
                        decodedMessage += char;
                        responseEl.setAttribute('data-msg', decodedMessage);
                        lastChar = char;
                        toneDuration = 0;
                    }
                }
            }
        }
    } else {
        // T-Key Test Logic (Direct map)
        return seq.map(idx => {
            if (idx <= 25) return String.fromCharCode(65 + idx);
            if (idx === 26) return " ";
            if (idx >= 27 && idx <= 52) return String.fromCharCode(97 + (idx - 27));
            if (idx >= 53 && idx <= 62) return (idx - 53).toString();
            if (idx >= 63) return specials[idx - 63] || "";
            return "";
        }).join('');
    }
}

// == VISUALIZER & UI ==
function draw() {
    requestAnimationFrame(draw);
    runDecoder();
    ctx.fillStyle = 'rgba(13, 13, 13, 0.4)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (!analyser) return;
    const data = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(data);
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = 100;
    const points = 100;
    for (let i = 0; i < points; i++) {
        const angle = (i / points) * Math.PI * 2;
        const binIndex = Math.floor((i / points) * 200);
        const barHeight = (data[binIndex] / 255) * 140;
        ctx.strokeStyle = `hsl(${(i / points) * 360}, 100%, 50%)`;
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(centerX - Math.cos(angle) * radius, centerY + Math.sin(angle) * radius);
        ctx.lineTo(centerX - Math.cos(angle) * (radius - barHeight), centerY + Math.sin(angle) * (radius - barHeight));
        ctx.stroke();
    }
}

function startThinking() {
    const frames = ['-', '/', '|', '\\']; let i = 0;
    spinnerInterval = setInterval(() => { responseEl.innerText = frames[i++ % frames.length] + " PROCESSING"; }, 100);
} function stopThinking() { clearInterval(spinnerInterval); }

function showGibberCycle() {
    const frames = ['$##', '#$#', '##$']; let i = 0;
    gibberInterval = setInterval(() => {
        const m = responseEl.getAttribute('data-msg') || "";
        responseEl.innerHTML = `<span style="color: #00ff00">${frames[i++ % frames.length]}</span>`;
    }, 150);
} function stopGibberCycle() { clearInterval(gibberInterval); }

function changeToLoadingBtn(toggle) {
    if (toggle) {
        const frames = ['-', '/', '|', '\\']; let i = 0;
        spinnerInterval = setInterval(() => { btn.innerText = frames[i++ % frames.length] + " LISTENING"; }, 100);
        btn.classList.add('recording')
    } else {
        btn.classList.remove('recording')
        clearInterval(spinnerInterval)
        btn.innerHTML = 'Start'
    }
}

function showError(err) {
    responseEl.innerHTML = `<span><span style="color:red">!</span> ${err}</span>`;
}

btn.onclick = async () => {
    if (!audioCtx) await initSystem();
    if (audioCtx.state === 'suspended') await audioCtx.resume();

    if (!isSystemActive) {
        isSystemActive = true
        recognition.start();
        responseEl.innerText = "LISTENING...";
        changeToLoadingBtn(true);
    } else {
        isSystemActive = false;
        responseEl.innerText = '';
        recognition.stop();
        changeToLoadingBtn(false);
    }
};

recognition.onend = () => {
    if (isSystemActive) {
        try {
            recognition.stop();
            recognition.start();
        } catch(e) {}
    }
};

window.addEventListener('keydown', (e) => {
    if (e.key === 't') 
        handleResponse({"gibberlink_mode": "true", "text": "[7][31][38][38][41][26][22][41][44][38][30]"});
});