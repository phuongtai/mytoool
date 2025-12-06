import { Store } from '@tanstack/react-store';

// Create the store with initial state
export const learnStore = new Store({
  topics: [],
  selectedTopic: null,
  currentStepIndex: 0,
  subStepIndex: 0,
  loading: true,
  loading: true,
  hasFetched: false, // Track if we've already fetched topics
  isFetching: false, // Track if a fetch is currently in progress
  selectedVoiceId: null,
});

// Actions to update the store
export const learnActions = {
  setTopics: (topics) => {
    learnStore.setState((state) => ({
      ...state,
      topics,
      loading: false,
      hasFetched: true,
      isFetching: false,
    }));
  },

  setSelectedTopic: (topic) => {
    learnStore.setState((state) => ({
      ...state,
      selectedTopic: topic,
      currentStepIndex: 0,
      subStepIndex: 0,
    }));
  },

  setCurrentStepIndex: (index) => {
    learnStore.setState((state) => ({
      ...state,
      currentStepIndex: index,
      subStepIndex: 0,
    }));
  },

  setSubStepIndex: (index) => {
    learnStore.setState((state) => ({
      ...state,
      subStepIndex: index,
    }));
  },

  setVoiceId: (voiceId) => {
    learnStore.setState((state) => ({
      ...state,
      selectedVoiceId: voiceId,
    }));
    localStorage.setItem('learn_english_voice_id', voiceId);
  },

  resetTopic: () => {
    learnStore.setState((state) => ({
      ...state,
      selectedTopic: null,
      currentStepIndex: 0,
      subStepIndex: 0,
    }));
  },

  // Navigate to next item/step
  nextItem: () => {
    const state = learnStore.state;
    const { selectedTopic, currentStepIndex, subStepIndex } = state;
    
    if (!selectedTopic) return;

    const currentStep = selectedTopic.steps[currentStepIndex];
    const stepItemsCount = 
      (currentStep.words?.length || 0) + 
      (currentStep.phrases?.length || 0) + 
      (currentStep.sentences?.length || 0);

    if (subStepIndex < stepItemsCount - 1) {
      learnActions.setSubStepIndex(subStepIndex + 1);
    } else if (currentStepIndex < selectedTopic.steps.length - 1) {
      learnActions.setCurrentStepIndex(currentStepIndex + 1);
    } else {
      // Loop back to start
      learnStore.setState((state) => ({
        ...state,
        currentStepIndex: 0,
        subStepIndex: 0,
      }));
    }
  },

  // Navigate to previous item/step
  previousItem: () => {
    const state = learnStore.state;
    const { selectedTopic, currentStepIndex, subStepIndex } = state;
    
    if (!selectedTopic) return;

    if (subStepIndex > 0) {
      learnActions.setSubStepIndex(subStepIndex - 1);
    } else if (currentStepIndex > 0) {
      const prevStepIndex = currentStepIndex - 1;
      const prevStep = selectedTopic.steps[prevStepIndex];
      const prevStepLength = 
        (prevStep.words?.length || 0) + 
        (prevStep.phrases?.length || 0) + 
        (prevStep.sentences?.length || 0);
      
      learnStore.setState((state) => ({
        ...state,
        currentStepIndex: prevStepIndex,
        subStepIndex: prevStepLength - 1,
      }));
    }
  },

  // Fetch topics from API (only if not already fetched)
  fetchTopics: async () => {
    const { hasFetched, isFetching } = learnStore.state;
    
    // Skip if already fetched or currently fetching
    if (hasFetched || isFetching) {
      console.log('Topics already fetched or fetching, skipping...');
      return learnStore.state.topics;
    }

    console.log('Fetching topics from API...');
    learnStore.setState((state) => ({ ...state, isFetching: true }));
    
    try {
      const response = await fetch('/api/topics');
      if (response.ok) {
        const data = await response.json();
        learnActions.setTopics(data);
        return data;
      } else {
        console.error('Failed to fetch topics');
        learnStore.setState((state) => ({ ...state, loading: false, hasFetched: true, isFetching: false }));
        return [];
      }
    } catch (error) {
      console.error('Error fetching topics:', error);
      learnStore.setState((state) => ({ ...state, loading: false, hasFetched: true, isFetching: false }));
      return [];
    }
  },

  // Restore state from URL params
  restoreFromParams: (topicSlug, stepNumber) => {
    const { topics } = learnStore.state;
    console.log('[Store] restoreFromParams called with:', { topicSlug, stepNumber, topicsCount: topics.length });
    
    if (topicSlug && topics.length > 0) {
      const topic = topics.find(t => t.topic.toLowerCase().replace(/\s+/g, '-') === topicSlug);
      console.log('[Store] Found topic:', topic?.topic);
      if (topic) {
        const step = stepNumber ? parseInt(stepNumber, 10) - 1 : 0;
        console.log('[Store] Setting selectedTopic:', topic.topic, 'step:', step);
        learnStore.setState((state) => ({
          ...state,
          selectedTopic: topic,
          currentStepIndex: step >= 0 && step < topic.steps.length ? step : 0,
          subStepIndex: 0,
        }));
      }
    }
  },
};

// Initialize voice ID from localStorage
const savedVoiceId = localStorage.getItem('learn_english_voice_id');
if (savedVoiceId) {
  learnStore.setState((state) => ({
    ...state,
    selectedVoiceId: savedVoiceId,
  }));
}
