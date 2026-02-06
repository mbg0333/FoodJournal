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
let currentTempMeal = null; // Used for both new and editing
let currentDate = new Date().toISOString().split('T')[0];
let currentSettings = {
  geminiKey: localStorage.getItem('gemini_key') || '',
  calGoal: 2000,
  startWeight: 0,
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
  calGoalInput: document.getElementById('cal-goal-input'),
  proteinSuggest: document.getElementById('suggested-protein-val'),
  startWeightInput: document.getElementById('start-weight-input'),
  goalWeightInput: document.getElementById('goal-weight-input'),
  currentWeightInput: document.getElementById('current-weight-input'),
  navItems: document.querySelectorAll('.nav-item'),
  views: {
    journal: document.getElementById('journal-view'),
    shopping: document.getElementById('shopping-view'),
    stats: document.getElementById('stats-view')
  },
  // Date Nav
  prevDay: document.getElementById('prev-day'),
  nextDay: document.getElementById('next-day'),
  dateDisplay: document.getElementById('current-date-display'),
  // Summary
  totalCals: document.getElementById('total-calories'),
  goalCals: document.getElementById('goal-calories-display'),
  totalPro: document.getElementById('total-protein'),
  goalPro: document.getElementById('goal-protein-display'),
  calBar: document.getElementById('cal-progress-bar'),
  proBar: document.getElementById('pro-progress-bar'),
  // Confirm/Edit Modal
  confirmModal: document.getElementById('confirm-modal'),
  confirmTitle: document.getElementById('confirm-title'),
  confirmName: document.getElementById('confirm-name'),
  confirmCalories: document.getElementById('confirm-calories'),
  confirmProtein: document.getElementById('confirm-protein'),
  confirmCarbs: document.getElementById('confirm-carbs'),
  confirmFat: document.getElementById('confirm-fat'),
  servingContainer: document.getElementById('serving-container'),
  servingSlider: document.getElementById('serving-slider'),
  servingLabel: document.getElementById('serving-label'),
  confirmCategory: document.getElementById('confirm-category'),
  saveConfirm: document.getElementById('save-confirm'),
  cancelConfirm: document.getElementById('cancel-confirm'),
  deleteBtn: document.getElementById('delete-btn')
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

  // Date Nav
  elements.prevDay.addEventListener('click', () => changeDate(-1));
  elements.nextDay.addEventListener('click', () => changeDate(1));

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
    elements.calGoalInput.value = currentSettings.calGoal || '';
    elements.startWeightInput.value = currentSettings.startWeight || '';
    elements.goalWeightInput.value = currentSettings.goalWeight || '';
    elements.currentWeightInput.value = currentSettings.currentWeight || '';
    updateSuggestedProtein();
    elements.settingsModal.style.display = 'flex';
  });

  elements.calGoalInput.addEventListener('input', updateSuggestedProtein);
  elements.currentWeightInput.addEventListener('input', updateSuggestedProtein);

  elements.closeSettingsBtn.addEventListener('click', () => {
    elements.settingsModal.style.display = 'none';
  });

  elements.saveSettingsBtn.addEventListener('click', async () => {
    const newSettings = {
      ...currentSettings,
      geminiKey: elements.apiKeyInput.value.trim(),
      calGoal: parseInt(elements.calGoalInput.value) || 2000,
      startWeight: parseFloat(elements.startWeightInput.value) || 0,
      goalWeight: parseFloat(elements.goalWeightInput.value) || 0,
      currentWeight: parseFloat(elements.currentWeightInput.value) || 0
    };
    
    showLoading(true);
    await storage.saveSettings(newSettings);
    localStorage.setItem('gemini_key', newSettings.geminiKey);
    currentSettings = newSettings;
    await updateDashboard();
    await renderMeals();
    showLoading(false);
    elements.settingsModal.style.display = 'none';
  });

  // Actions
  elements.logBtn.addEventListener('click', () => handleLog('text'));
  elements.voiceBtn.addEventListener('click', startVoiceRecognition);
  elements.photoBtn.addEventListener('click', () => elements.fileInput.click());
  elements.fileInput.addEventListener('change', (e) => handleLog('photo', e.target.files[0]));
  
  elements.textLog.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleLog('text');
  });

  // Modal Listeners
  elements.servingSlider.addEventListener('input', updateConfirmValues);
  
  elements.cancelConfirm.addEventListener('click', () => {
    elements.confirmModal.style.display = 'none';
    currentTempMeal = null;
  });

  elements.deleteBtn.addEventListener('click', async () => {
    if (!currentTempMeal?.id) return;
    if (confirm('Delete this entry?')) {
      showLoading(true);
      await storage.deleteMeal(currentTempMeal.id);
      await renderMeals();
      showLoading(false);
      elements.confirmModal.style.display = 'none';
    }
  });

  elements.saveConfirm.addEventListener('click', async () => {
    if (!currentTempMeal) return;
    
    const isEdit = !!currentTempMeal.id;
    const multiplier = isEdit ? 1 : parseFloat(elements.servingSlider.value);
    
    const finalMeal = {
      ...currentTempMeal,
      name: elements.confirmName.value,
      calories: parseInt(elements.confirmCalories.value),
      protein: parseInt(elements.confirmProtein.value) || 0,
      carbs: parseInt(elements.confirmCarbs.value) || 0,
      fat: parseInt(elements.confirmFat.value) || 0,
      category: elements.confirmCategory.value,
      timestamp: currentTempMeal.timestamp || new Date().toISOString()
    };
    // If it was a new record with multiplier, it's already multiplied in updateConfirmValues for visual.
    // Wait, let's keep it simple: sliders only for NEW items. Edits are manual.

    showLoading(true);
    if (isEdit) {
      await storage.updateMeal(currentTempMeal.id, finalMeal);
    } else {
      await storage.addMeal(finalMeal);
    }
    await renderMeals();
    showLoading(false);
    
    elements.confirmModal.style.display = 'none';
    currentTempMeal = null;
    elements.textLog.value = '';
  });
}

function updateSuggestedProtein() {
  const weight = parseFloat(elements.currentWeightInput.value) || 0;
  // Suggested Protein: 1g per lb for active / 0.8g for normal
  const suggested = Math.round(weight * 0.825);
  elements.proteinSuggest.textContent = suggested || '--';
}

function changeDate(days) {
  const date = new Date(currentDate + 'T12:00:00');
  date.setDate(date.getDate() + days);
  currentDate = date.toISOString().split('T')[0];
  updateDateDisplay();
  renderMeals();
}

function updateDateDisplay() {
  const today = new Date().toISOString().split('T')[0];
  if (currentDate === today) {
    elements.dateDisplay.textContent = 'Today';
  } else {
    const d = new Date(currentDate + 'T12:00:00');
    elements.dateDisplay.textContent = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
}

function updateConfirmValues() {
  if (!currentTempMeal || currentTempMeal.id) return; // Slider only for fresh scans
  const multiplier = parseFloat(elements.servingSlider.value);
  elements.servingLabel.textContent = `${multiplier}x`;
  
  elements.confirmCalories.value = Math.round(currentTempMeal.rawCalories * multiplier);
  elements.confirmProtein.value = Math.round(currentTempMeal.rawProtein * multiplier);
  elements.confirmCarbs.value = Math.round(currentTempMeal.rawCarbs * multiplier);
  elements.confirmFat.value = Math.round(currentTempMeal.rawFat * multiplier);
}

async function loadUserData() {
  if (!currentUser) return;
  showLoading(true);
  try {
    const settings = await storage.getSettings();
    const envKey = import.meta.env.VITE_GEMINI_API_KEY;
    
    currentSettings = {
      geminiKey: settings.geminiKey || localStorage.getItem('gemini_key') || envKey || '',
      calGoal: settings.calGoal || 2000,
      startWeight: settings.startWeight || 0,
      goalWeight: settings.goalWeight || 0,
      currentWeight: settings.currentWeight || 0
    };
    
    updateDateDisplay();
    await updateDashboard();
    await renderMeals();
    await renderShoppingList();
  } catch (e) {
    console.error("Error loading user data:", e);
  } finally {
    showLoading(false);
  }
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
    elements.settingsModal.style.display = 'flex';
    return;
  }

  showLoading(true);
  try {
    let input = type === 'text' ? elements.textLog.value : data;
    if (type === 'text' && !input) return;

    if (type === 'photo' && data) {
      input = await toBase64(data);
    }

    const result = await analyzeFood(key, input, type);
    if (result) {
      // Store raw values for slider scaling
      currentTempMeal = {
        ...result,
        rawCalories: result.calories,
        rawProtein: result.protein || 0,
        rawCarbs: result.carbs || 0,
        rawFat: result.fat || 0
      };
      openConfirmModal(currentTempMeal, false);
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

function openConfirmModal(meal, isEdit = false) {
  elements.confirmTitle.textContent = isEdit ? 'Edit Entry' : `Confirm: ${meal.name}`;
  elements.confirmName.value = meal.name;
  elements.confirmCalories.value = meal.calories;
  elements.confirmProtein.value = meal.protein || 0;
  elements.confirmCarbs.value = meal.carbs || 0;
  elements.confirmFat.value = meal.fat || 0;
  elements.confirmCategory.value = meal.category || 'Lunch';
  
  elements.deleteBtn.style.display = isEdit ? 'flex' : 'none';
  elements.servingContainer.style.display = isEdit ? 'none' : 'block';
  
  if (!isEdit) {
    elements.servingSlider.value = 1;
    elements.servingLabel.textContent = '1x';
  }
  
  elements.confirmModal.style.display = 'flex';
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
  const meals = await storage.getMeals(currentDate);
  
  // Calculate Totals
  let totalCals = 0;
  let totalPro = 0;
  
  elements.mealList.innerHTML = meals.map(meal => {
    totalCals += (meal.calories || 0);
    totalPro += (meal.protein || 0);
    
    return `
      <div class="meal-item glass" data-id="${meal.id}">
        <div class="meal-icon">🍱</div>
        <div class="meal-info">
          <span class="meal-name">${meal.name}</span>
          <span class="meal-meta">${meal.calories} kcal • ${meal.category}</span>
          <div class="macro-chips">
            <span class="chip protein">P: ${meal.protein || 0}g</span>
            <span class="chip carbs">C: ${meal.carbs || 0}g</span>
            <span class="chip fat">F: ${meal.fat || 0}g</span>
          </div>
        </div>
        ${meal.restaurant && meal.restaurant !== "" ? `<span class="meal-type">${meal.restaurant}</span>` : ''}
      </div>
    `;
  }).join('');

  // Add Click Listeners for Editing
  document.querySelectorAll('.meal-item').forEach(el => {
    el.addEventListener('click', () => {
      const id = el.dataset.id;
      const meal = meals.find(m => m.id === id);
      if (meal) {
        currentTempMeal = meal;
        openConfirmModal(meal, true);
      }
    });
  });

  updateSummary(totalCals, totalPro);
}

function updateSummary(cals, pro) {
  const calGoal = currentSettings.calGoal || 2000;
  const proGoal = Math.round(currentSettings.currentWeight * 0.825) || 150;

  elements.totalCals.textContent = cals;
  elements.goalCals.textContent = calGoal;
  elements.totalPro.textContent = pro;
  elements.goalPro.textContent = proGoal;

  const calPerc = Math.min(100, (cals / calGoal) * 100);
  const proPerc = Math.min(100, (pro / proGoal) * 100);

  elements.calBar.style.width = `${calPerc}%`;
  elements.proBar.style.width = `${proPerc}%`;
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
  elements.currentWeightDisplay.textContent = `${currentSettings.currentWeight || '--'} lbs`;
  elements.goalWeightDisplay.textContent = `${currentSettings.goalWeight || '--'} lbs`;
  
  if (currentSettings.goalWeight > 0 && currentSettings.startWeight > 0) {
    const totalToLose = currentSettings.startWeight - currentSettings.goalWeight;
    const lostSoFar = currentSettings.startWeight - currentSettings.currentWeight;
    let progress = totalToLose > 0 ? (lostSoFar / totalToLose) * 100 : 0;
    progress = Math.min(100, Math.max(0, progress));
    elements.goalProgress.style.width = `${progress}%`;
  } else {
    elements.goalProgress.style.width = `0%`;
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
