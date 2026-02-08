import React, { useState, useEffect, useRef } from 'react';
import { Play, Download, Settings2, Volume2, Mic2, Loader2, Sparkles, AlertCircle, Wand2, MessageSquareQuote, ToggleRight, ToggleLeft } from 'lucide-react';

/**
 * AI Voice Over Studio Pro
 * Versi Perbaikan untuk Lingkungan Pratinjau.
 */

const App = () => {
  const [text, setText] = useState('');
  const [voice, setVoice] = useState('Kore');
  const [speed, setSpeed] = useState(1);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isRefining, setIsRefining] = useState(false);
  const [audioUrl, setAudioUrl] = useState(null);
  const [error, setError] = useState(null);
  const [aiSuggestion, setAiSuggestion] = useState(null);
  const [refinementMode, setRefinementMode] = useState('formal');
  const [autoToneEnabled, setAutoToneEnabled] = useState(true);

  const audioPlayerRef = useRef(null);

  /** * API Key dibiarkan kosong karena lingkungan eksekusi akan menyediakannya secara otomatis.
   * Untuk deployment mandiri (Vercel), gunakan: import.meta.env.VITE_GEMINI_API_KEY
   */
  const apiKey = "AIzaSyCw1n-JZ3uU6lNAh97jQHDQZhVo0ryagbw";

  const voices = [
    { name: 'Kore', gender: 'Wanita', style: 'Netral/Profesional' },
    { name: 'Zephyr', gender: 'Pria', style: 'Hangat/Narasi' },
    { name: 'Puck', gender: 'Pria', style: 'Enerjik' },
    { name: 'Charon', gender: 'Pria', style: 'Deep/Formal' },
    { name: 'Leda', gender: 'Wanita', style: 'Lembut/Tenang' },
    { name: 'Orus', gender: 'Pria', style: 'Otoritatif' },
  ];

  const fetchWithRetry = async (url, options, retries = 5, backoff = 1000) => {
    try {
      const response = await fetch(url, options);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      return await response.json();
    } catch (err) {
      if (retries > 0) {
        await new Promise(resolve => setTimeout(resolve, backoff));
        return fetchWithRetry(url, options, retries - 1, backoff * 2);
      }
      throw err;
    }
  };

  const refineScript = async () => {
    if (!text.trim()) return;

    setIsRefining(true);
    setError(null);

    const prompts = {
      formal: "Ubah teks ini menjadi naskah formal dan profesional dalam bahasa Indonesia.",
      story: "Ubah teks ini menjadi narasi bercerita (storytelling) yang menarik dalam bahasa Indonesia.",
      promo: "Ubah teks ini menjadi naskah iklan promosi (copywriting) yang persuasif dalam bahasa Indonesia.",
      natural: "Perbaiki tata bahasa teks ini agar terdengar natural dalam bahasa Indonesia."
    };

    try {
      const result = await fetchWithRetry(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: `${prompts[refinementMode]}: "${text}"` }] }]
          })
        }
      );

      const refinedText = result.candidates?.[0]?.content?.parts?.[0]?.text;
      if (refinedText) setText(refinedText.trim());
    } catch (err) {
      setError("Gagal memperbaiki naskah. Silakan coba lagi.");
    } finally {
      setIsRefining(false);
    }
  };

  const analyzeTone = async () => {
    if (!text.trim() || text.length < 5 || !autoToneEnabled) return;
    
    setIsAnalyzing(true);
    try {
      const result = await fetchWithRetry(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ 
              parts: [{ text: `Analisis teks ini dan berikan 1 kata sifat dalam Bahasa Inggris untuk nada bicaranya. Jawab dengan 1 kata saja. Teks: "${text}"` }] 
            }]
          })
        }
      );

      const suggestion = result.candidates?.[0]?.content?.parts?.[0]?.text;
      if (suggestion) setAiSuggestion(suggestion.trim().replace(/[".]/g, ''));
    } catch (err) {
      console.error("Gagal menganalisis nada suara.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      if (text.length > 10 && autoToneEnabled) analyzeTone();
    }, 1500);
    return () => clearTimeout(timer);
  }, [text, autoToneEnabled]);

  const pcmToWav = (pcmData, sampleRate) => {
    const buffer = new ArrayBuffer(44 + pcmData.length * 2);
    const view = new DataView(buffer);
    const writeString = (offset, string) => {
      for (let i = 0; i < string.length; i++) view.setUint8(offset + i, string.charCodeAt(i));
    };

    writeString(0, 'RIFF');
    view.setUint32(4, 32 + pcmData.length * 2, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, pcmData.length * 2, true);

    for (let i = 0; i < pcmData.length; i++) {
      view.setInt16(44 + i * 2, pcmData[i], true);
    }
    return new Blob([buffer], { type: 'audio/wav' });
  };

  const generateVoiceOver = async () => {
    if (!text.trim()) {
      setError("Masukkan teks terlebih dahulu.");
      return;
    }

    setIsGenerating(true);
    setError(null);
    if (audioUrl) URL.revokeObjectURL(audioUrl);

    let finalPrompt = "";
    const speedInstruction = speed > 1.2 ? "fast" : speed < 0.8 ? "slow" : "normal";
    
    if (autoToneEnabled && aiSuggestion) {
      finalPrompt = `Narrate the following text with a ${aiSuggestion} tone. Maintain a ${speedInstruction} pace. The delivery should be expressive and professional. Text: "${text}"`;
    } else {
      finalPrompt = `Speak in a professional tone at ${speedInstruction} speed: "${text}"`;
    }

    try {
      const result = await fetchWithRetry(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: finalPrompt }] }],
            generationConfig: {
              responseModalities: ["AUDIO"],
              speechConfig: {
                voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } }
              }
            }
          })
        }
      );

      const audioPart = result.candidates?.[0]?.content?.parts?.[0]?.inlineData;
      if (!audioPart) throw new Error("Gagal menerima data audio.");

      const sampleRateMatch = audioPart.mimeType.match(/rate=(\d+)/);
      const sampleRate = sampleRateMatch ? parseInt(sampleRateMatch[1]) : 24000;
      
      const binaryString = atob(audioPart.data);
      const pcmData = new Int16Array(binaryString.length / 2);
      for (let i = 0; i < binaryString.length; i += 2) {
        pcmData[i / 2] = (binaryString.charCodeAt(i + 1) << 8) | binaryString.charCodeAt(i);
      }

      const wavBlob = pcmToWav(pcmData, sampleRate);
      const newUrl = URL.createObjectURL(wavBlob);
      setAudioUrl(newUrl);
      
      setTimeout(() => {
        audioPlayerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);

    } catch (err) {
      setError("Terjadi kesalahan saat membuat suara. Silakan coba lagi nanti.");
      console.error(err);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8 font-sans text-slate-900">
      <div className="max-w-6xl mx-auto">
        <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-indigo-600 to-purple-600 p-3 rounded-xl text-white shadow-lg">
              <Mic2 size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-slate-800 uppercase">VO Studio <span className="text-indigo-600">Pro AI</span></h1>
              <p className="text-slate-500 text-xs font-bold tracking-wide uppercase">Generasi Suara Profesional</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4 bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-sm">
             <div className="flex flex-col items-end">
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Auto-Tone AI</span>
                <span className={`text-xs font-bold ${autoToneEnabled ? 'text-indigo-600' : 'text-slate-400'}`}>
                  {autoToneEnabled ? (aiSuggestion ? `Aktif: ${aiSuggestion}` : 'Mendeteksi...') : 'Non-Aktif'}
                </span>
             </div>
             <button 
               onClick={() => setAutoToneEnabled(!autoToneEnabled)}
               className="text-indigo-600 hover:text-indigo-700 transition-colors"
             >
               {autoToneEnabled ? <ToggleRight size={32} /> : <ToggleLeft size={32} className="text-slate-300" />}
             </button>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          <div className="lg:col-span-3 space-y-6">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden focus-within:ring-2 focus-within:ring-indigo-500 transition-all duration-300">
              <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/50 flex flex-wrap gap-4 justify-between items-center">
                <div className="flex items-center gap-2">
                  <MessageSquareQuote size={16} className="text-indigo-400" />
                  <label className="text-xs font-bold uppercase text-slate-400 tracking-wider">Naskah</label>
                </div>
                
                <div className="flex items-center gap-2 bg-white rounded-lg p-1 border border-slate-200">
                  <select 
                    value={refinementMode}
                    onChange={(e) => setRefinementMode(e.target.value)}
                    className="bg-transparent text-[11px] font-bold text-slate-600 focus:outline-none cursor-pointer pl-2 py-1"
                  >
                    <option value="formal">Format Formal</option>
                    <option value="story">Gaya Bercerita</option>
                    <option value="promo">Bahasa Iklan</option>
                    <option value="natural">Bahasa Natural</option>
                  </select>
                  <button 
                    onClick={refineScript}
                    disabled={isRefining || !text.trim()}
                    className="flex items-center gap-1.5 text-[10px] font-black bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-md hover:bg-indigo-100 disabled:opacity-50 transition-colors uppercase"
                  >
                    {isRefining ? <Loader2 size={10} className="animate-spin" /> : <Wand2 size={10} />}
                    AI Rewrite
                  </button>
                </div>
              </div>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Ketik naskah di sini..."
                className="w-full h-80 p-6 focus:outline-none text-lg leading-relaxed placeholder:text-slate-300 font-light text-slate-700"
              />
              <div className="px-5 py-2 bg-slate-50 border-t border-slate-100 text-right">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{text.length} Karakter</span>
              </div>
            </div>

            {error && (
              <div className="animate-in fade-in slide-in-from-top-4 flex items-center gap-3 bg-red-50 border border-red-100 text-red-600 p-5 rounded-2xl shadow-sm">
                <AlertCircle size={20} className="shrink-0" />
                <p className="text-sm font-semibold">{error}</p>
              </div>
            )}

            {audioUrl && (
              <div ref={audioPlayerRef} className="animate-in fade-in zoom-in-95 duration-500">
                <div className="bg-slate-900 rounded-3xl p-1 shadow-2xl shadow-indigo-200 overflow-hidden">
                  <div className="bg-gradient-to-r from-indigo-600 to-violet-600 rounded-[20px] p-6 md:p-8">
                    <div className="flex items-center gap-3 mb-6">
                       <div className="bg-white/20 p-2 rounded-lg backdrop-blur-sm">
                          <Volume2 className="text-white" size={20} />
                       </div>
                       <div>
                          <h3 className="text-white text-sm font-bold uppercase tracking-widest">Hasil Voice Over</h3>
                          <p className="text-indigo-100 text-[11px]">Siap untuk digunakan</p>
                       </div>
                    </div>
                    
                    <div className="flex flex-col md:flex-row items-center gap-6">
                      <audio controls src={audioUrl} className="w-full h-12 accent-indigo-500" />
                      
                      <button
                        onClick={() => {
                          const link = document.createElement('a');
                          link.href = audioUrl;
                          link.download = `VoiceOver-${Date.now()}.wav`;
                          link.click();
                        }}
                        className="w-full md:w-auto shrink-0 flex items-center justify-center gap-2 bg-white text-indigo-700 px-8 py-3.5 rounded-xl hover:bg-indigo-50 hover:scale-105 active:scale-95 transition-all font-black shadow-lg uppercase text-xs tracking-widest"
                      >
                        <Download size={18} />
                        Download WAV
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-6">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-8 sticky top-6">
              <div className="flex items-center gap-2 text-slate-800 font-bold border-b border-slate-100 pb-4">
                <Settings2 size={20} className="text-indigo-600" />
                Pengaturan Suara
              </div>

              <section>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-4 tracking-[0.15em]">Pilih Talenta</label>
                <div className="grid grid-cols-1 gap-2">
                  {voices.map((v) => (
                    <button
                      key={v.name}
                      onClick={() => setVoice(v.name)}
                      className={`relative text-left p-3.5 rounded-xl border-2 transition-all duration-200 ${
                        voice === v.name
                          ? 'border-indigo-600 bg-indigo-50/50 shadow-sm scale-[1.02]'
                          : 'border-slate-100 hover:border-slate-300 hover:bg-slate-50 text-slate-500'
                      }`}
                    >
                      <div className="flex justify-between items-center mb-1">
                        <span className={`font-bold text-sm ${voice === v.name ? 'text-indigo-700' : 'text-slate-700'}`}>{v.name}</span>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded font-black uppercase ${voice === v.name ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-200 text-slate-500'}`}>{v.gender}</span>
                      </div>
                      <div className="text-[10px] font-medium opacity-80">{v.style}</div>
                    </button>
                  ))}
                </div>
              </section>

              <section>
                <div className="flex justify-between items-center mb-4">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">Kecepatan</label>
                  <span className="text-xs font-black text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full">{speed}x</span>
                </div>
                <input
                  type="range" min="0.5" max="2.0" step="0.1" value={speed}
                  onChange={(e) => setSpeed(parseFloat(e.target.value))}
                  className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                />
              </section>

              <button
                onClick={generateVoiceOver}
                disabled={isGenerating || !text.trim()}
                className={`w-full py-5 rounded-2xl font-black text-sm tracking-widest uppercase flex items-center justify-center gap-3 transition-all duration-300 shadow-xl ${
                  isGenerating || !text.trim()
                    ? 'bg-slate-100 text-slate-300 cursor-not-allowed shadow-none'
                    : 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:shadow-indigo-300 hover:scale-[1.02] active:scale-95'
                }`}
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="animate-spin" size={20} />
                    Memproses...
                  </>
                ) : (
                  <>
                    <Sparkles size={18} fill="currentColor" className="opacity-50" />
                    Buat Voice Over
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
