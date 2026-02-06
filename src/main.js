import { auth, db } from './lib/firebase';
import { 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged 
} from 'firebase/auth';
import { storage } from './lib/storage';
import { analyzeFood } from './lib/gemini';

// Initialize State
let currentUser = null;
let currentSettings = {
  geminiKey: localStorage.getItem('gemini_key') || '',
  goalWeight: 0,
  currentWeight: 0
};

// DOM Elements
const elements = {
  authScreen: document.getElementById('auth-screen'),
  app: document.getElementById('app'),
  loginBtn: document.getElementById('login-btn'),
  logoutBtn: document.getElementById('logout-btn'),
  settingsBtn: document.getElementById('settings-btn'),
  saveSettingsBtn: document.getElementById('save-settings'),
  closeSettingsBtn: document.getElementById('close-settings'),
  settingsModal: document.getElementById('settings-modal'),
  logBtn: document.getElementById('log-btn'),
  voiceBtn: document.getElementById('voice-btn'),
  photoBtn: document.getElementById('photo-btn'),
  fileInput: document.getElementById('file-input'),
  textLog: document.getElementById('text-log'),
  mealList: document.getElementById('meal-list'),
  shoppingList: document.getElementById('shopping-list'),
  loadingOverlay: document.getElementById('loading-overlay'),
  voiceStatus: document.getElementById('voice-status'),
  goalProgress: document.getElementById('goal-progress'),
  currentWeightDisplay: document.getElementById('current-weight'),
  goalWeightDisplay: document.getElementById('goal-weight'),
  apiKeyInput: document.getElementById('api-key'),
  goalWeightInput: document.getElementById('goal-weight-input'),
  currentWeightInput: document.getElementById('current-weight-input'),
  navItems: document.querySelectorAll('.nav-item'),
  views: {
    journal: document.getElementById('journal-view'),
    shopping: document.getElementById('shopping-view'),
    stats: document.getElementById('stats-view')
  }
};

// Initialize App
function init() {
  lucide.createIcons();
  setupEventListeners();
  
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      currentUser = user;
      elements.authScreen.style.display = 'none';
      elements.app.style.display = 'block';
      await loadUserData();
    } else {
      currentUser = null;
      elements.authScreen.style.display = 'flex';
      elements.app.style.display = 'none';
    }
  });
}

function setupEventListeners() {
  // Auth
  elements.loginBtn.addEventListener('click', () => {
    const provider = new GoogleAuthProvider();
    signInWithPopup(auth, provider);
  });

  elements.logoutBtn.addEventListener('click', () => signOut(auth));

  // Navigation
  elements.navItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const tab = item.dataset.tab;
      switchTab(tab);
    });
  });

  // Settings
  elements.settingsBtn.addEventListener('click', () => {
    elements.apiKeyInput.value = currentSettings.geminiKey || '';
    elements.goalWeightInput.value = currentSettings.goalWeight || '';
    elements.currentWeightInput.value = currentSettings.currentWeight || '';
    elements.settingsModal.style.display = 'flex';
  });

  elements.closeSettingsBtn.addEventListener('click', () => {
    elements.settingsModal.style.display = 'none';
  });

  elements.saveSettingsBtn.addEventListener('click', async () => {
    const newSettings = {
      geminiKey: elements.apiKeyInput.value,
      goalWeight: parseFloat(elements.goalWeightInput.value) || 0,
      currentWeight: parseFloat(elements.currentWeightInput.value) || 0
    };
    
    showLoading(true);
    await storage.saveSettings(newSettings);
    localStorage.setItem('gemini_key', newSettings.geminiKey);
    currentSettings = newSettings;
    await updateDashboard();
    showLoading(false);
    elements.settingsModal.style.display = 'none';
  });

  // Actions
  elements.logBtn.addEventListener('click', () => handleLog('text'));
  elements.voiceBtn.addEventListener('click', startVoiceRecognition);
  elements.photoBtn.addEventListener('click', () => elements.fileInput.click());
  elements.fileInput.addEventListener('change', (e) => handleLog('photo', e.target.files[0]));
  
  // Enter key for text log
  elements.textLog.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleLog('text');
  });
}

async function loadUserData() {
  if (!currentUser) return;
  showLoading(true);
  const settings = await storage.getSettings();
  currentSettings = {
    geminiKey: localStorage.getItem('gemini_key') || settings.geminiKey || '',
    goalWeight: settings.goalWeight || 0,
    currentWeight: settings.currentWeight || 0
  };
  
  await updateDashboard();
  await renderMeals();
  await renderShoppingList();
  showLoading(false);
}

function switchTab(tab) {
  Object.keys(elements.views).forEach(v => {
    elements.views[v].style.display = v === tab ? 'block' : 'none';
  });
  elements.navItems.forEach(item => {
    item.classList.toggle('active', item.dataset.tab === tab);
  });
}

async function handleLog(type, data = null) {
  const key = currentSettings.geminiKey;
  if (!key) {
    alert('Please add a Gemini API Key in Settings first.');
    elements.settingsBtn.click();
    return;
  }

  showLoading(true);
  try {
    let input = type === 'text' ? elements.textLog.value : data;
    if (type === 'text' && !input) return;

    // Convert image to base64 if it's a photo
    if (type === 'photo' && data) {
      input = await toBase64(data);
    }

    const result = await analyzeFood(key, input, type);
    if (result) {
      await storage.addMeal(result);
      elements.textLog.value = '';
      await renderMeals();
    } else {
      alert('AI analysis failed. Try again.');
    }
  } catch (e) {
    console.error(e);
    alert('Error logging meal.');
  } finally {
    showLoading(false);
  }
}

function startVoiceRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    alert('Voice recognition is not supported in this browser.');
    return;
  }

  const recognition = new SpeechRecognition();
  recognition.lang = 'en-US';
  
  recognition.onstart = () => {
    elements.voiceStatus.style.display = 'block';
  };

  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    elements.textLog.value = transcript;
    handleLog('text');
  };

  recognition.onerror = () => {
    elements.voiceStatus.style.display = 'none';
  };

  recognition.onend = () => {
    elements.voiceStatus.style.display = 'none';
  };

  recognition.start();
}

async function renderMeals() {
  if (!currentUser) return;
  const meals = await storage.getMeals();
  elements.mealList.innerHTML = meals.map(meal => `
    <div class="meal-item glass">
      <div class="meal-icon">🍱</div>
      <div class="meal-info">
        <span class="meal-name">${meal.name}</span>
        <span class="meal-meta">${meal.calories} kcal • ${meal.category}</span>
      </div>
      ${meal.restaurant ? `<span class="meal-type">${meal.restaurant}</span>` : ''}
    </div>
  `).join('');
}

async function renderShoppingList() {
  if (!currentUser) return;
  const list = await storage.getShoppingList();
  elements.shoppingList.innerHTML = list.map(item => `
    <div class="shopping-item glass">
      <span>${item.name}</span>
      <span class="meal-meta">${item.suggestions ? item.suggestions.join(', ') : ''}</span>
    </div>
  `).join('');
}

async function updateDashboard() {
  elements.currentWeightDisplay.textContent = `${currentSettings.currentWeight}kg`;
  elements.goalWeightDisplay.textContent = `${currentSettings.goalWeight}kg`;
  
  if (currentSettings.goalWeight > 0) {
    const progress = Math.min(100, Math.max(0, (currentSettings.currentWeight / currentSettings.goalWeight) * 100));
    elements.goalProgress.style.width = `${progress}%`;
  }
}

function showLoading(show) {
  elements.loadingOverlay.style.display = show ? 'flex' : 'none';
}

function toBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = error => reject(error);
  });
}

init();
