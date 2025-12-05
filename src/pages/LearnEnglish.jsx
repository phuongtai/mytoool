import React, { useState, useEffect, useRef, useMemo } from 'react';
import TOPICS from '../data/topics.json';
import { playTTS, AVAILABLE_VOICES } from '../services/tts';
import { supabase } from '../services/supabaseClient';


export default function LearnEnglish() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Auth Handling
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const [selectedTopic, setSelectedTopic] = useState(null);
  
  const [currentStepIndex, setCurrentStepIndex] = useState(() => {
    const saved = localStorage.getItem('learn_english_step_index');
    return saved ? parseInt(saved, 10) : 0;
  });
  
  // Index within the flattened items of the current step
  const [subStepIndex, setSubStepIndex] = useState(0);

  const [input, setInput] = useState('');
  const [selectedVoiceId, setSelectedVoiceId] = useState(() => {
    const saved = localStorage.getItem('learn_english_voice_id');
    const isValid = AVAILABLE_VOICES.some(v => v.id === saved);
    return isValid ? saved : AVAILABLE_VOICES[0].id;
  });
  const [feedback, setFeedback] = useState(null);
  const inputRef = useRef(null);

  // Flatten the current step's content into a linear list of items to learn
  const currentStepItems = useMemo(() => {
    if (!selectedTopic || !selectedTopic.steps[currentStepIndex]) return [];
    
    const step = selectedTopic.steps[currentStepIndex];
    const items = [];
    
    if (step.words) step.words.forEach(w => items.push({ ...w, type: 'word' }));
    if (step.phrases) step.phrases.forEach(p => items.push({ ...p, type: 'phrase' }));
    if (step.sentences) step.sentences.forEach(s => items.push({ ...s, type: 'sentence' }));
    
    return items;
  }, [selectedTopic, currentStepIndex]);

  const currentItem = currentStepItems[subStepIndex];

  const handleVoiceChange = (e) => {
    const voiceId = e.target.value;
    setSelectedVoiceId(voiceId);
    localStorage.setItem('learn_english_voice_id', voiceId);
    playTTS("Hello", voiceId);
  };

  // Play audio when item changes
  useEffect(() => {
    if (currentItem) {
      playTTS(currentItem.en, selectedVoiceId);
    }
  }, [currentItem, selectedVoiceId]);

  // Focus input when item changes
  useEffect(() => {
    if (inputRef.current && currentItem) {
      inputRef.current.focus();
    }
  }, [currentItem]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      validateInput();
    }
  };

  const validateInput = () => {
    if (!currentItem) return;

    const expected = currentItem.en.toLowerCase().trim();
    const actual = input.toLowerCase().trim();

    if (actual === expected) {
      setFeedback('correct');
      
      setTimeout(() => {
        setFeedback(null);
        setInput('');
        
        // Move to next item
        if (subStepIndex < currentStepItems.length - 1) {
          setSubStepIndex(prev => prev + 1);
        } else {
          // Move to next step
          if (currentStepIndex < selectedTopic.steps.length - 1) {
            setCurrentStepIndex(prev => prev + 1);
            setSubStepIndex(0);
          } else {
            // Topic Complete - Reset to start or show completion screen
            // For now, just loop back to start of topic
            setCurrentStepIndex(0);
            setSubStepIndex(0);
          }
        }
      }, 500);
    } else {
      setFeedback('incorrect');
      setTimeout(() => setFeedback(null), 500);
    }
  };

  // 1. Loading State
  if (loading) {
     return <div className="fixed inset-0 bg-white dark:bg-gray-900 flex items-center justify-center text-gray-500">Loading...</div>;
  }

  // Handle Login locally
  const handleGoogleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin }
    });
  };

  // 2. TOPIC SELECTION (Modified to handle Auth State)
  if (!selectedTopic) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden bg-white dark:bg-gray-900">
        {/* Liquid Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-100 via-purple-100 to-pink-100 dark:from-gray-900 dark:via-purple-900 dark:to-blue-900"></div>
        <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-purple-400/30 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-72 h-72 bg-pink-400/30 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-pulse"></div>
        
        {/* User Info / Logout (Optional) */}
        {user && (
          <button onClick={() => supabase.auth.signOut()} className="absolute top-4 right-4 z-50 text-xs text-gray-500 hover:text-red-500 uppercase tracking-widest">
              Logout ({user.email})
          </button>
        )}

        {/* Content */}
        <div className="relative z-10 w-full max-w-5xl p-8 space-y-12">
          <div className="text-center space-y-4">
            <h1 className="text-5xl font-['Work_Sans'] font-light text-gray-900 dark:text-white">
              {user ? "Choose a Topic" : "Welcome"}
            </h1>
            <p className="text-xl font-['Work_Sans'] font-light text-gray-600 dark:text-gray-300">
              {user ? "Select a topic to start your learning journey" : "Sign in to start learning"}
            </p>
          </div>

          {/* LOGIN OVERLAY for Unauthenticated Users */}
          {!user && (
             <div className="flex justify-center py-12">
                <button
                  onClick={handleGoogleLogin}
                  className="flex items-center justify-center gap-4 px-8 py-5 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-900 dark:text-white rounded-2xl shadow-xl hover:shadow-2xl hover:scale-105 transition-all duration-300 group ring-1 ring-black/5 dark:ring-white/10"
                >
                  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                  </svg>
                  <span className="text-xl font-medium font-['Work_Sans']">One-Tap Sign in with Google</span>
                </button>
             </div>
          )}

          {/* Render Topics ONLY if authenticated */}
          {user && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {TOPICS.map((topic) => (
                <button
                  key={topic.topic}
                  onClick={() => {
                    setSelectedTopic(topic);
                    setCurrentStepIndex(0);
                    setSubStepIndex(0);
                  }}
                  className="group relative p-8 bg-white/10 backdrop-blur-md rounded-3xl shadow-xl hover:bg-white/20 transition-all duration-300 transform hover:-translate-y-1 text-left space-y-4 border border-white/20 hover:border-white/40"
                >
                  <h3 className="text-2xl font-['Work_Sans'] font-medium text-gray-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-300 transition-colors">
                    {topic.topic}
                  </h3>
                  <p className="text-gray-600 dark:text-gray-300 font-['Work_Sans'] font-light">
                    {topic.description}
                  </p>
                  <div className="pt-4 flex items-center text-sm font-medium text-gray-500 dark:text-gray-400">
                    <span>{topic.steps.length} Steps</span>
                    <span className="mx-2">•</span>
                    <span>{topic.steps.reduce((acc, step) => acc + (step.words?.length || 0) + (step.phrases?.length || 0) + (step.sentences?.length || 0), 0)} Items</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // 4. Authenticated: LEARNING SCREEN
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-hidden bg-white dark:bg-gray-900">
      {/* Liquid Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:via-indigo-950 dark:to-purple-950"></div>
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-400/20 rounded-full mix-blend-multiply filter blur-[100px] opacity-70 animate-pulse"></div>
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-400/20 rounded-full mix-blend-multiply filter blur-[100px] opacity-70 animate-pulse"></div>

      {/* Top Left: Title & Info */}
      <div className="absolute top-6 left-6 md:top-10 md:left-10 space-y-2 z-20">
        <button 
          onClick={() => setSelectedTopic(null)}
          className="flex items-center gap-2 text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white transition-colors mb-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
          Back to Topics
        </button>
        <h1 className="text-2xl md:text-3xl font-['Work_Sans'] font-light text-gray-800 dark:text-white">
          {selectedTopic.topic}
        </h1>
        <div className="text-sm font-['Work_Sans'] text-gray-500 dark:text-gray-400">
          Step {currentStepIndex + 1}/{selectedTopic.steps.length} • Item {subStepIndex + 1}/{currentStepItems.length}
        </div>
      </div>

      {/* Top Right: Voice Selector */}
      <div className="absolute top-6 right-6 md:top-10 md:right-10 z-20">
        <div className="relative group">
          <select
            value={selectedVoiceId}
            onChange={handleVoiceChange}
            className="appearance-none pl-4 pr-10 py-2 bg-white/30 dark:bg-black/30 backdrop-blur-md rounded-xl text-sm text-gray-700 dark:text-gray-200 outline-none focus:ring-2 focus:ring-indigo-500/50 cursor-pointer hover:bg-white/40 transition-colors"
          >
            {AVAILABLE_VOICES.map(v => (
              <option key={v.id} value={v.id} className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white">
                {v.name} ({v.gender})
              </option>
            ))}
          </select>
          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
          </div>
        </div>
      </div>

      {/* Center Content (Endless/Borderless) */}
      <div className="relative w-full max-w-7xl p-8 space-y-16 z-10">
        
        {/* Content */}
        <div className="space-y-8 text-center">
          <div className="space-y-4">
            <h2 className="text-sm font-['Work_Sans'] font-medium text-indigo-500/80 uppercase tracking-[0.2em]">
              {currentItem?.type}
            </h2>
            <div className="relative group inline-block">
              <p className="text-3xl md:text-4xl font-sans font-medium text-blue-600 dark:text-blue-400 leading-tight">
                {currentItem?.vi}
              </p>
              
              <button
                onClick={() => {
                  if (currentItem) {
                    playTTS(currentItem.en, selectedVoiceId);
                    inputRef.current?.focus();
                  }
                }}
                className="absolute -right-16 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/30 hover:bg-white/50 text-indigo-600 dark:text-indigo-300 transition-all opacity-0 group-hover:opacity-100 backdrop-blur-sm"
                title="Play pronunciation"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                </svg>
              </button>
            </div>
          </div>

          <div className="relative w-full pt-8">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              className={`w-full text-center text-5xl md:text-6xl font-['Work_Sans'] font-light p-4 bg-transparent outline-none transition-all duration-300 placeholder-gray-400/30 dark:placeholder-gray-600/30
                ${feedback === 'correct' 
                  ? 'text-green-600 dark:text-green-400 drop-shadow-[0_0_15px_rgba(74,222,128,0.5)]' 
                  : feedback === 'incorrect'
                  ? 'text-red-500 dark:text-red-400 drop-shadow-[0_0_15px_rgba(248,113,113,0.5)]'
                  : 'text-gray-800 dark:text-white'
                }
              `}
              placeholder="Type here..."
              autoComplete="off"
              autoCorrect="off"
              spellCheck="false"
            />
            
            <p className="mt-8 text-sm font-['Work_Sans'] text-gray-400 dark:text-gray-500">
              Press <span className="font-medium text-gray-500 dark:text-gray-400">ENTER</span> to check
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
