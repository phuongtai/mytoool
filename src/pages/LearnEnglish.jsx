import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useStore } from '@tanstack/react-store';
import { playTTS, preloadTTS, AVAILABLE_VOICES } from '../services/tts';
import { supabase } from '../services/supabaseClient';
import { learnStore, learnActions } from '../store/learnStore';


export default function LearnEnglish({ topicId, stepNumber } = {}) {
  const navigate = useNavigate();
  
  // Subscribe to store state
  const topics = useStore(learnStore, (state) => state.topics);
  const selectedTopic = useStore(learnStore, (state) => state.selectedTopic);
  const currentStepIndex = useStore(learnStore, (state) => state.currentStepIndex);
  const subStepIndex = useStore(learnStore, (state) => state.subStepIndex);
  const storeLoading = useStore(learnStore, (state) => state.loading);
  const selectedVoiceId = useStore(learnStore, (state) => state.selectedVoiceId) || AVAILABLE_VOICES[0].id;
  
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isGuest, setIsGuest] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Studied Words Modal State
  const [showStudiedModal, setShowStudiedModal] = useState(false);
  const [studiedItems, setStudiedItems] = useState([]);
  const [loadingStudied, setLoadingStudied] = useState(false);

  const handleShowStudied = async () => {
    setShowStudiedModal(true);
    if (!user) {
        setStudiedItems([]); // Or handle guest mode
        return;
    }
    
    setLoadingStudied(true);
    try {
        const res = await fetch(`/api/studied-items?user_id=${user.id}`);
        if (res.ok) {
            const data = await res.json();
            setStudiedItems(data);
        }
    } catch (e) {
        console.error("Failed to load progress:", e);
    } finally {
        setLoadingStudied(false);
    }
  };

  // Auth Handling
  useEffect(() => {
    // Check if user chose guest mode
    const guestMode = localStorage.getItem('guest_mode');
    if (guestMode === 'true') {
      setIsGuest(true);
      setAuthLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setAuthLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Fetch topics from API (store handles deduplication)
  useEffect(() => {
    learnActions.fetchTopics();
  }, []);

  // Restore state from URL params
  useEffect(() => {
    if (topicId) {
      // Pass user ID to fetch progress
      learnActions.restoreFromParams(topicId, stepNumber, user?.id);
    }
  }, [topicId, stepNumber, user]);

  const [input, setInput] = useState('');
  const [feedback, setFeedback] = useState(null);
  const inputRef = useRef(null);

  // Flatten the current step's content into a linear list of items to learn
  const currentStepItems = useMemo(() => {
    if (!selectedTopic || !selectedTopic.steps || !selectedTopic.steps[currentStepIndex]) return [];
    
    const step = selectedTopic.steps[currentStepIndex];
    const items = [];
    
    // Add is_studied to items
    if (step.words) step.words.forEach(w => items.push({ ...w, type: 'word' }));
    if (step.phrases) step.phrases.forEach(p => items.push({ ...p, type: 'phrase' }));
    if (step.sentences) step.sentences.forEach(s => items.push({ ...s, type: 'sentence' }));
    
    return items;
  }, [selectedTopic, currentStepIndex]);

  const currentItem = currentStepItems[subStepIndex];

  const handleVoiceChange = (e) => {
    const voiceId = e.target.value;
    learnActions.setVoiceId(voiceId);
    playTTS("Hello", voiceId);
  };

  // Play audio when item changes (debounced) & Preload next items
  useEffect(() => {
    if (currentItem) {
      // 1. Play current
      const timer = setTimeout(() => {
        playTTS(currentItem.en, selectedVoiceId);
      }, 500);

      // 2. Preload next items within current step
      const PRELOAD_COUNT = 3;
      for (let i = 1; i <= PRELOAD_COUNT; i++) {
        const nextIdx = subStepIndex + i;
        if (nextIdx < currentStepItems.length) {
           preloadTTS(currentStepItems[nextIdx].en, selectedVoiceId);
        }
      }

      // 3. Preload start of next step if we are near the end
      if (subStepIndex >= currentStepItems.length - 2 && selectedTopic) {
         const nextStepIdx = currentStepIndex + 1;
         if (nextStepIdx < selectedTopic.steps.length) {
            const nextStep = selectedTopic.steps[nextStepIdx];
            const nextStepItems = [];
            if (nextStep.words) nextStep.words.forEach(w => nextStepItems.push(w));
            if (nextStep.phrases) nextStep.phrases.forEach(p => nextStepItems.push(p));
            if (nextStep.sentences) nextStep.sentences.forEach(s => nextStepItems.push(s));
            
            for (let i = 0; i < Math.min(3, nextStepItems.length); i++) {
               preloadTTS(nextStepItems[i].english || nextStepItems[i].en, selectedVoiceId);
            }
         }
      }

      return () => clearTimeout(timer);
    }
  }, [currentItem, selectedVoiceId, subStepIndex, currentStepItems, currentStepIndex, selectedTopic]);

  // Focus input when item changes
  useEffect(() => {
    if (inputRef.current && currentItem) {
      inputRef.current.focus();
    }
  }, [currentItem]);

  const navTimeoutRef = useRef(null);
  const lastKeyTimeRef = useRef(0);

  const updateUrlDebounced = () => {
    if (navTimeoutRef.current) clearTimeout(navTimeoutRef.current);
    
    navTimeoutRef.current = setTimeout(() => {
      if (selectedTopic) {
        const newStepIndex = learnStore.state.currentStepIndex;
        navigate({ to: `/learn-english/${selectedTopic.id}/${newStepIndex + 1}`, replace: true });
      }
    }, 500);
  };

  const handleKeyDown = (e) => {
    // Throttle keyboard input to prevent chaotic scrolling (100ms limit)
    const now = Date.now();
    if (now - lastKeyTimeRef.current < 100 && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
        return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      validateInput();
    } else if (e.key === 'ArrowLeft') {
      lastKeyTimeRef.current = now;
      e.preventDefault();
      handlePrevious();
    } else if (e.key === 'ArrowRight') {
      lastKeyTimeRef.current = now;
      e.preventDefault();
      handleNext();
    }
  };

  const handlePrevious = () => {
    learnActions.previousItem();
    setInput('');
    setFeedback(null);
    updateUrlDebounced();
  };

  const handleNext = () => {
    learnActions.nextItem();
    setInput('');
    setFeedback(null);
    updateUrlDebounced();
  };

  const validateInput = () => {
    if (!currentItem) return;

    const expected = currentItem.en.toLowerCase().trim();
    const actual = input.toLowerCase().trim();

    if (actual === expected) {
      setFeedback('correct');
      // Mark as studied
      if (user?.id) {
         learnActions.markItemStudied(currentItem.id, user.id);
      }
      
      setTimeout(() => {
        setFeedback(null);
        setInput('');
        learnActions.nextItem();
      }, 500);
    } else {
      setFeedback('incorrect');
      setTimeout(() => setFeedback(null), 500);
    }
  };

  // 1. Loading State
  if (authLoading || storeLoading) {
     return <div className="fixed inset-0 bg-white dark:bg-gray-900 flex items-center justify-center text-gray-500">Loading...</div>;
  }

  // Handle Login locally
  const handleGoogleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/learn-english` }
    });
  };

  const handleGuestLogin = () => {
    localStorage.setItem('guest_mode', 'true');
    setIsGuest(true);
  };

  const handleLogout = async () => {
    if (isGuest) {
      localStorage.removeItem('guest_mode');
      setIsGuest(false);
    } else {
      await supabase.auth.signOut();
    }
    learnActions.resetTopic();
    navigate({ to: '/learn-english' });
  };

  // --- REUSABLE USER MENU ---
  const UserMenu = (
    (user || isGuest) && (
      <div className="absolute top-4 right-4 z-[60]">
        <div className="relative z-50">
          <button 
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="flex items-center gap-2 px-4 py-2 bg-white/20 backdrop-blur-md rounded-full shadow-sm hover:bg-white/30 transition-all text-gray-700 dark:text-gray-200 border border-white/20 cursor-pointer"
          >
            <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-white font-bold text-xs">
               {user?.email ? user.email[0].toUpperCase() : 'G'}
            </div>
            <span className="text-sm font-medium pr-1">{isGuest ? 'Guest' : user?.email?.split('@')[0]}</span>
            <svg className={`w-4 h-4 transition-transform ${isMenuOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
          </button>

          {isMenuOpen && (
            <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-xl shadow-2xl overflow-hidden border border-gray-100 dark:border-gray-700 animate-in fade-in zoom-in duration-200 origin-top-right">
              <div className="py-1">
                <button 
                  onClick={() => {
                    setIsMenuOpen(false);
                    handleShowStudied();
                  }}
                  className="flex items-center gap-3 w-full px-4 py-3 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left"
                >
                  <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                  Words Studied
                </button>
                <div className="h-px bg-gray-100 dark:bg-gray-700 my-1"></div>
                <button 
                  onClick={() => {
                    setIsMenuOpen(false);
                    handleLogout();
                  }}
                  className="flex items-center gap-3 w-full px-4 py-3 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-left"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                  Logout
                </button>
              </div>
            </div>
          )}
        </div>
        {/* Backdrop to close menu */}
        {isMenuOpen && (
           <div className="fixed inset-0 z-40 bg-transparent" onClick={() => setIsMenuOpen(false)}></div>
        )}
      </div>
    )
  );

  const StudiedModal = (
     showStudiedModal && (
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
         <div className="bg-white dark:bg-gray-900 w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden max-h-[80vh] flex flex-col">
           <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center">
             <h2 className="text-2xl font-['Work_Sans'] font-medium text-gray-900 dark:text-white">Your Progress</h2>
             <button onClick={() => setShowStudiedModal(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors">
               <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
             </button>
           </div>
           
           <div className="overflow-y-auto p-6 space-y-4">
             {loadingStudied ? (
                <div className="text-center py-12 text-gray-500">Loading...</div>
             ) : studiedItems.length === 0 ? (
                <div className="text-center py-12 text-gray-500">No items studied yet. Start learning!</div>
             ) : (
                <div className="grid gap-3">
                  {studiedItems.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                      <div className="flex-1">
                        <div className="font-medium text-lg text-gray-900 dark:text-white">{item.english}</div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">{item.vietnamese}</div>
                      </div>
                      <div className="text-xs font-medium px-2 py-1 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-md uppercase tracking-wider">
                        {item.type}
                      </div>
                    </div>
                  ))}
                </div>
             )}
           </div>
         </div>
      </div>
    )
  );

  // 2. TOPIC SELECTION (Modified to handle Auth State)
  if (!selectedTopic) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden bg-white dark:bg-gray-900">
        {/* Liquid Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-100 via-purple-100 to-pink-100 dark:from-gray-900 dark:via-purple-900 dark:to-blue-900"></div>
        <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-purple-400/30 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-72 h-72 bg-pink-400/30 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-pulse"></div>
        
        {/* User Menu */}
        {UserMenu}

        {/* Studied Items Modal */}
        {StudiedModal}

        {/* Content */}
        <div className="relative z-10 w-full max-w-5xl p-8 space-y-12">
          <div className="text-center space-y-4">
            <h1 className="text-5xl font-['Work_Sans'] font-light text-gray-900 dark:text-white">
              {user || isGuest ? "Choose a Topic" : "Welcome"}
            </h1>
            <p className="text-xl font-['Work_Sans'] font-light text-gray-600 dark:text-gray-300">
              {user || isGuest ? "Select a topic to start your learning journey" : "Sign in to start learning"}
            </p>
          </div>

          {/* LOGIN OVERLAY for Unauthenticated Users */}
          {!user && !isGuest && (
             <div className="flex flex-col items-center gap-4 py-12">
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
                  <span className="text-xl font-medium font-['Work_Sans']">Sign in with Google</span>
                </button>
                
                <button
                  onClick={handleGuestLogin}
                  className="text-sm font-['Work_Sans'] text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 underline transition-colors"
                >
                  Continue as Guest
                </button>
             </div>
          )}

          {/* Render Topics ONLY if authenticated or guest */}
          {(user || isGuest) && topics.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {topics.map((topic) => (
                <button
                  key={topic.id}
                  onClick={() => {
                    navigate({ to: `/learn-english/${topic.id}/1` });
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
                    <span>{topic.steps_count} Steps</span>
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
      
      {/* User Menu */}
      {UserMenu}
      
      {/* Studied Items Modal */}
      {StudiedModal}

      {/* Top Left: Title & Info */}
      <div className="absolute top-6 left-6 md:top-10 md:left-10 space-y-2 z-20">
        <button 
          onClick={() => {
            learnActions.resetTopic();
            navigate({ to: '/learn-english' });
          }}
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

      {/* Center Content (Endless/Borderless) */}
      <div className="relative w-full max-w-7xl p-8 space-y-16 z-10">
        
        {/* Content */}
        <div className="space-y-8 text-center">
          <div className="space-y-4">
            <div className="flex justify-center items-center gap-3">
              <h2 className="text-sm font-['Work_Sans'] font-medium text-indigo-500/80 uppercase tracking-[0.2em]">
                {currentItem?.type}
              </h2>
              {currentItem?.is_studied && (
                <span className="flex items-center gap-1 text-xs bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 px-3 py-1 rounded-full font-bold uppercase tracking-wider shadow-sm border border-green-200 dark:border-green-800">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
                  Studied
                </span>
              )}
            </div>
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
                className="absolute -right-16 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/30 hover:bg-white/50 text-indigo-600 dark:text-indigo-300 transition-all backdrop-blur-sm"
                title="Play pronunciation"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                </svg>
              </button>
            </div>
          </div>

          <div className="relative w-full pt-8">
            {/* Navigation Buttons */}
            <div className="flex justify-between items-center mb-8">
              <button
                onClick={handlePrevious}
                disabled={currentStepIndex === 0 && subStepIndex === 0}
                className="p-3 rounded-full bg-white/20 hover:bg-white/30 disabled:opacity-30 disabled:cursor-not-allowed text-gray-700 dark:text-gray-200 transition-all backdrop-blur-sm"
                title="Previous (←)"
              >
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>

              <button
                onClick={handleNext}
                disabled={currentStepIndex === selectedTopic.steps.length - 1 && subStepIndex === currentStepItems.length - 1}
                className="p-3 rounded-full bg-white/20 hover:bg-white/30 disabled:opacity-30 disabled:cursor-not-allowed text-gray-700 dark:text-gray-200 transition-all backdrop-blur-sm"
                title="Next (→)"
              >
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>

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
