import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Volume2, HelpCircle, AlertTriangle, Play, Sparkles } from 'lucide-react';

interface VoiceCommandEngineProps {
  onRecordVoiceNote: (text: string, category: string, voiceCommandUsed?: string) => void;
  isDriving: boolean;
  isOffline: boolean;
}

export default function VoiceCommandEngine({
  onRecordVoiceNote,
  isDriving,
  isOffline
}: VoiceCommandEngineProps) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [speechSupported, setSpeechSupported] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [simulatedCommand, setSimulatedCommand] = useState('');
  const [showHelp, setShowHelp] = useState(false);
  
  const recognitionRef = useRef<any>(null);
  const waveCanvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Initialize Speech Recognition
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      setSpeechSupported(true);
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setIsListening(true);
        setErrorMessage('');
      };

      recognition.onerror = (event: any) => {
        console.warn('Speech recognition error:', event.error);
        if (event.error === 'not-allowed') {
          setErrorMessage('Microphone access blocked. Use the simulated console below!');
        } else {
          setErrorMessage(`Error: ${event.error}`);
        }
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.onresult = (event: any) => {
        let interim = '';
        let final = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            final += event.results[i][0].transcript;
          } else {
            interim += event.results[i][0].transcript;
          }
        }

        if (final) {
          processSpokenText(final);
          setTranscript(final);
        }
        setInterimTranscript(interim);
      };

      recognitionRef.current = recognition;
    } else {
      setSpeechSupported(false);
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  // Audio Waveform Animation for visual feedback
  useEffect(() => {
    const canvas = waveCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let startTime = Date.now();

    const drawWave = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.lineWidth = 2;
      
      const gradient = ctx.createLinearGradient(0, 0, canvas.width, 0);
      gradient.addColorStop(0, '#38bdf8'); // sky-400
      gradient.addColorStop(0.5, '#6366f1'); // indigo-500
      gradient.addColorStop(1, '#f43f5e'); // rose-500
      ctx.strokeStyle = gradient;

      ctx.beginPath();
      const numLines = 40;
      const spacing = canvas.width / numLines;
      const time = (Date.now() - startTime) * 0.005;

      for (let i = 0; i < numLines; i++) {
        const x = i * spacing;
        // Calculate dynamic height based on listening state
        let amplitude = 2;
        if (isListening) {
          amplitude = 12 + Math.sin(time + i * 0.1) * 8 + Math.cos(time * 0.5 + i * 0.2) * 4;
        } else if (isDriving) {
          amplitude = 4 + Math.sin(time + i * 0.05) * 2;
        }
        
        const yOffset = canvas.height / 2;
        ctx.moveTo(x, yOffset - amplitude);
        ctx.lineTo(x, yOffset + amplitude);
      }
      ctx.stroke();

      animationFrameRef.current = requestAnimationFrame(drawWave);
    };

    drawWave();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isListening, isDriving]);

  // Command Parser
  const processSpokenText = (text: string) => {
    const cleanText = text.toLowerCase().trim();
    
    // Command pattern matching:
    // "record note [content]" -> Records note under default 'Commercial' or custom category
    // "tag location as [category]" -> Tags current location with specific category
    // "tag premises as [category]" -> Tags current location with specific category
    // "emergency tag" -> tags with 'Safety' category
    
    if (cleanText.startsWith('record note')) {
      const noteContent = text.slice(11).trim();
      if (noteContent) {
        onRecordVoiceNote(noteContent, 'Commercial', 'record note');
        triggerAestheticNotification('Note Recorded via Hands-Free Command');
      }
    } else if (cleanText.startsWith('tag location as') || cleanText.startsWith('tag premises as')) {
      const category = text.split(' as ')[1]?.trim();
      if (category) {
        const capitalizedCategory = category.charAt(0).toUpperCase() + category.slice(1);
        onRecordVoiceNote('Manually tagged driving landmark', capitalizedCategory, 'tag location');
        triggerAestheticNotification(`Tagged Location as: ${capitalizedCategory}`);
      }
    } else if (cleanText.includes('emergency tag') || cleanText.includes('hazard')) {
      onRecordVoiceNote('Safety hazard or road incident noticed', 'Safety', 'emergency tag');
      triggerAestheticNotification('Emergency Safety Point Registered');
    } else {
      // General voice note capture as default fallback
      onRecordVoiceNote(text, 'Commercial', 'generic voice note');
      triggerAestheticNotification('Voice Note Extracted');
    }
  };

  // Dispatch visual browser custom events for push alerts
  const triggerAestheticNotification = (msg: string) => {
    const event = new CustomEvent('push-notification', {
      detail: {
        title: 'Voice Assistant Active',
        message: msg,
        type: 'recording'
      }
    });
    window.dispatchEvent(event);
  };

  const toggleListening = () => {
    if (!speechSupported) {
      setErrorMessage('Native Speech API not supported in this frame environment. Please use simulation options below.');
      return;
    }

    if (isListening) {
      recognitionRef.current?.stop();
    } else {
      setTranscript('');
      setInterimTranscript('');
      try {
        recognitionRef.current?.start();
      } catch (err) {
        console.error('Failed to start speech recognition:', err);
      }
    }
  };

  const handleSimulatedSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!simulatedCommand.trim()) return;
    processSpokenText(simulatedCommand);
    setTranscript(simulatedCommand);
    setSimulatedCommand('');
  };

  const quickSimulate = (command: string) => {
    processSpokenText(command);
    setTranscript(command);
  };

  return (
    <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 shadow-2xl relative overflow-hidden">
      {/* Background glow when listening */}
      {isListening && (
        <div className="absolute inset-0 bg-sky-500/5 animate-pulse pointer-events-none" />
      )}

      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className={`p-2 rounded-lg ${isListening ? 'bg-rose-500/10 text-rose-400' : 'bg-slate-900 text-slate-400'}`}>
            <Volume2 className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-display font-semibold text-slate-200 tracking-wider uppercase">Hands-Free Driving Engine</h3>
            <p className="text-[10px] text-slate-500 font-mono">
              {isListening ? 'LIVE LISTENING FOR VERBAL COMMANDS' : 'VOICE COGNITION IDLE'}
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowHelp(!showHelp)}
          className="p-1 text-slate-500 hover:text-slate-300 transition-colors"
          title="Voice command help manual"
        >
          <HelpCircle className="w-4 h-4" />
        </button>
      </div>

      {/* Waveform Visualizer */}
      <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl h-16 flex flex-col justify-center items-center relative overflow-hidden mb-4">
        <canvas 
          ref={waveCanvasRef} 
          width={300} 
          height={60} 
          className="w-full h-full object-cover"
        />
        {isListening && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-950/40 backdrop-blur-[1px]">
            <span className="text-[10px] font-mono text-rose-400 uppercase tracking-widest font-semibold flex items-center gap-1.5 animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
              Speak Command Now...
            </span>
          </div>
        )}
      </div>

      {/* Mic Trigger */}
      <div className="flex flex-col items-center gap-2.5 mb-5">
        <button
          onClick={toggleListening}
          className={`w-14 h-14 rounded-full border flex items-center justify-center transition-all shadow-lg hover:scale-105 active:scale-95 ${
            isListening
              ? 'bg-rose-500/20 border-rose-500 text-rose-400 ring-4 ring-rose-500/10'
              : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
          }`}
        >
          {isListening ? <Mic className="w-6 h-6" /> : <MicOff className="w-6 h-6 text-slate-500" />}
        </button>
        <span className="text-[10px] font-mono text-slate-400">
          {isListening ? 'Tap to disable voice recognition' : 'Tap to start hands-free mic'}
        </span>

        {errorMessage && (
          <div className="mt-2 p-2 bg-amber-500/10 border border-amber-500/20 rounded flex items-start gap-2 max-w-full">
            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <span className="text-[10px] text-amber-400 font-mono leading-relaxed">{errorMessage}</span>
          </div>
        )}
      </div>

      {/* Live Text Transcribing Area */}
      {(transcript || interimTranscript) && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 mb-4 animate-fadeIn">
          <div className="text-[9px] font-mono text-slate-500 mb-1">LIVE VOICE LOG:</div>
          <p className="text-xs text-slate-200 font-mono leading-relaxed italic">
            "{transcript}"
            {interimTranscript && <span className="text-slate-500 font-semibold"> {interimTranscript}</span>}
          </p>
        </div>
      )}

      {/* Voice Simulator Console for sandboxed iFrames */}
      <div className="border-t border-slate-800/80 pt-4">
        <div className="flex items-center gap-1.5 mb-2">
          <Sparkles className="w-3.5 h-3.5 text-sky-400" />
          <span className="text-[10px] font-display text-slate-300 uppercase tracking-wider font-semibold">
            Driving Command Simulator
          </span>
        </div>
        <p className="text-[10px] text-slate-500 leading-normal mb-3 font-mono">
          Since microphones are frequently restricted inside web previews or iframes, you can type or click the buttons below to simulate verbal driving cues perfectly.
        </p>

        <form onSubmit={handleSimulatedSubmit} className="flex gap-2 mb-3">
          <input
            type="text"
            placeholder="Type driving command (e.g. 'record note interesting property')"
            value={simulatedCommand}
            onChange={(e) => setSimulatedCommand(e.target.value)}
            className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-sky-500 font-mono"
          />
          <button
            type="submit"
            className="bg-sky-500 hover:bg-sky-600 text-slate-950 font-semibold px-3 py-1 text-xs rounded-lg transition-colors flex items-center gap-1 shrink-0 font-mono"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            SAY
          </button>
        </form>

        <div className="grid grid-cols-2 gap-1.5">
          <button
            onClick={() => quickSimulate('record note found modern architectural retail premises')}
            className="text-left px-2 py-1.5 bg-slate-900 hover:bg-slate-800/80 border border-slate-800 rounded text-[10px] font-mono text-slate-300 truncate"
          >
            💬 Say: "Record note retail..."
          </button>
          <button
            onClick={() => quickSimulate('tag location as Enterprise')}
            className="text-left px-2 py-1.5 bg-slate-900 hover:bg-slate-800/80 border border-slate-800 rounded text-[10px] font-mono text-slate-300 truncate"
          >
            🏷️ Say: "Tag location as Enterprise"
          </button>
          <button
            onClick={() => quickSimulate('tag premises as Tourism')}
            className="text-left px-2 py-1.5 bg-slate-900 hover:bg-slate-800/80 border border-slate-800 rounded text-[10px] font-mono text-slate-300 truncate"
          >
            🏷️ Say: "Tag location as Tourism"
          </button>
          <button
            onClick={() => quickSimulate('emergency tag')}
            className="text-left px-2 py-1.5 bg-slate-900 hover:bg-slate-800/80 border border-slate-800 rounded text-[10px] font-mono text-rose-400/90 truncate border-rose-950/50"
          >
            ⚠️ Say: "Emergency tag"
          </button>
        </div>
      </div>

      {/* Help Modal Overlay */}
      {showHelp && (
        <div className="absolute inset-0 bg-slate-950/95 backdrop-blur-md p-5 overflow-y-auto z-40 animate-fadeIn text-left">
          <div className="flex justify-between items-center mb-3">
            <h4 className="text-xs font-mono font-bold text-sky-400 uppercase tracking-widest">
              Driving Speech Manual
            </h4>
            <button
              onClick={() => setShowHelp(false)}
              className="text-xs text-slate-400 hover:text-white font-mono"
            >
              Close
            </button>
          </div>
          <p className="text-[10px] text-slate-300 leading-relaxed font-mono mb-3">
            The RADIR platform listens for trigger patterns while you keep your eyes on the road:
          </p>
          <ul className="space-y-2.5 text-[10px] font-mono">
            <li className="p-1.5 bg-slate-900 rounded border border-slate-800">
              <span className="text-sky-400 font-semibold block">"RECORD NOTE [content]"</span>
              <span className="text-slate-400 block mt-0.5">Records whatever you say as the text transcription under Commercial category.</span>
              <span className="text-slate-500 italic block mt-0.5">Example: "record note beautiful classic office on main street"</span>
            </li>
            <li className="p-1.5 bg-slate-900 rounded border border-slate-800">
              <span className="text-sky-400 font-semibold block">"TAG LOCATION/PREMISES AS [category]"</span>
              <span className="text-slate-400 block mt-0.5">Tags the current location coordinates with specific categoric tag.</span>
              <span className="text-slate-500 italic block mt-0.5">Example: "tag location as Tourism"</span>
            </li>
            <li className="p-1.5 bg-slate-900 rounded border border-slate-800 text-rose-300">
              <span className="text-rose-400 font-semibold block">"EMERGENCY TAG" or "HAZARD"</span>
              <span className="text-slate-400 block mt-0.5">Instantly marks a safety hazard point with high priority category.</span>
              <span className="text-slate-500 italic block mt-0.5">Example: "emergency tag"</span>
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}
