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
let currentTempMeal = null;
let currentDate = new Date().toISOString().split('T')[0];
let currentSettings = {
  geminiKey: localStorage.getItem('gemini_key') || '',
  calGoal: 2000,
  startWeight: 0,
  goalWeight: 0,
  currentWeight: 0
};
let categoriesExpanded = { Breakfast: true, Lunch: true, Dinner: true, Snack: true };

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
  cameraInput: document.getElementById('camera-input'),
  textLog: document.getElementById('text-log'),
  shoppingList: document.getElementById('shopping-list'),
  loadingOverlay: document.getElementById('loading-overlay'),
  voiceStatus: document.getElementById('voice-status'),
  goalProgress: document.getElementById('goal-progress'),
  currentWeightDisplay: document.getElementById('current-weight'),
  goalWeightDisplay: document.getElementById('goal-weight'),
  apiKeyInput: document.getElementById('api-key'),
  calGoalInput: document.getElementById('cal-goal-input'),
  proteinSuggest: document.getElementById('suggested-protein-val'),
  waterSuggest: document.getElementById('suggested-water-val'),
  startWeightInput: document.getElementById('start-weight-input'),
  goalWeightInput: document.getElementById('goal-weight-input'),
  currentWeightInput: document.getElementById('current-weight-input'),
  navItems: document.querySelectorAll('.nav-item'),
  views: {
    journal: document.getElementById('journal-view'),
    weight: document.getElementById('weight-view'),
    shopping: document.getElementById('shopping-view')
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
  // Water
  currentWater: document.getElementById('current-water'),
  goalWater: document.getElementById('goal-water'),
  waterBar: document.getElementById('water-progress-bar'),
  waterBtns: document.querySelectorAll('.water-btn'),
  resetWater: document.getElementById('reset-water'),
  // Categorized List
  categorizedMeals: document.getElementById('categorized-meals'),
  // Photo Modal
  photoModal: document.getElementById('photo-modal'),
  takePhotoBtn: document.getElementById('take-photo-btn'),
  choosePhotoBtn: document.getElementById('choose-photo-btn'),
  closePhotoModal: document.getElementById('close-photo-modal'),
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
  elements.loginBtn.addEventListener('click', () => signInWithPopup(auth, new GoogleAuthProvider()));
  elements.logoutBtn.addEventListener('click', () => signOut(auth));

  elements.prevDay.addEventListener('click', () => changeDate(-1));
  elements.nextDay.addEventListener('click', () => changeDate(1));

  elements.navItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      switchTab(item.dataset.tab);
    });
  });

  // Settings
  elements.settingsBtn.addEventListener('click', () => {
    elements.apiKeyInput.value = currentSettings.geminiKey || '';
    elements.calGoalInput.value = currentSettings.calGoal || '';
    elements.startWeightInput.value = currentSettings.startWeight || '';
    elements.goalWeightInput.value = currentSettings.goalWeight || '';
    elements.currentWeightInput.value = currentSettings.currentWeight || '';
    updateSuggestedValues();
    elements.settingsModal.style.display = 'flex';
  });

  elements.calGoalInput.addEventListener('input', updateSuggestedValues);
  elements.currentWeightInput.addEventListener('input', updateSuggestedValues);
  elements.closeSettingsBtn.addEventListener('click', () => elements.settingsModal.style.display = 'none');

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
    await renderJournal();
    showLoading(false);
    elements.settingsModal.style.display = 'none';
  });

  // Water
  elements.waterBtns.forEach(btn => {
    btn.addEventListener('click', async () => {
      const amt = parseInt(btn.dataset.amt);
      const next = parseInt(elements.currentWater.textContent) + amt;
      elements.currentWater.textContent = next;
      updateWaterSummary(next);
      await storage.setWater(currentDate, next);
    });
  });

  elements.resetWater.addEventListener('click', async () => {
    if (confirm('Reset water intake?')) {
      elements.currentWater.textContent = 0;
      updateWaterSummary(0);
      await storage.setWater(currentDate, 0);
    }
  });

  // Logging Actions
  elements.logBtn.addEventListener('click', () => handleLog('text'));
  elements.voiceBtn.addEventListener('click', startVoiceRecognition);
  
  // Camera / Photo Choice
  elements.photoBtn.addEventListener('click', () => elements.photoModal.style.display = 'flex');
  elements.closePhotoModal.addEventListener('click', () => elements.photoModal.style.display = 'none');
  
  elements.takePhotoBtn.addEventListener('click', () => {
    elements.photoModal.style.display = 'none';
    elements.cameraInput.click();
  });
  
  elements.choosePhotoBtn.addEventListener('click', () => {
    elements.photoModal.style.display = 'none';
    elements.fileInput.click();
  });

  elements.fileInput.addEventListener('change', (e) => handleLog('photo', e.target.files[0]));
  elements.cameraInput.addEventListener('change', (e) => handleLog('photo', e.target.files[0]));
  
  elements.textLog.addEventListener('keypress', (e) => { if (e.key === 'Enter') handleLog('text'); });

  // Modal Listeners
  elements.servingSlider.addEventListener('input', updateConfirmValues);
  elements.cancelConfirm.addEventListener('click', () => { elements.confirmModal.style.display = 'none'; currentTempMeal = null; });

  elements.deleteBtn.addEventListener('click', async () => {
    if (!currentTempMeal?.id) return;
    if (confirm('Delete this entry?')) {
      showLoading(true);
      await storage.deleteMeal(currentTempMeal.id);
      await renderJournal();
      showLoading(false);
      elements.confirmModal.style.display = 'none';
      currentTempMeal = null;
    }
  });

  elements.saveConfirm.addEventListener('click', async () => {
    if (!currentTempMeal) return;
    const isEdit = !!currentTempMeal.id;
    const finalMeal = {
      ...currentTempMeal,
      name: elements.confirmName.value,
      calories: parseInt(elements.confirmCalories.value),
      protein: parseInt(elements.confirmProtein.value) || 0,
      carbs: parseInt(elements.confirmCarbs.value) || 0,
      fat: parseInt(elements.confirmFat.value) || 0,
      category: elements.confirmCategory.value,
      stockPhoto: `https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=150&q=80&sig=${encodeURIComponent(elements.confirmName.value)}`,
      timestamp: currentTempMeal.timestamp || new Date().toISOString()
    };
    showLoading(true);
    if (isEdit) await storage.updateMeal(currentTempMeal.id, finalMeal);
    else await storage.addMeal(finalMeal);
    await renderJournal();
    showLoading(false);
    elements.confirmModal.style.display = 'none';
    currentTempMeal = null;
    elements.textLog.value = '';
  });
}

function updateSuggestedValues() {
  const weight = parseFloat(elements.currentWeightInput.value) || 0;
  elements.proteinSuggest.textContent = Math.round(weight * 0.8) || '--';
  elements.waterSuggest.textContent = Math.round(weight * 0.5) || '--';
}

function changeDate(days) {
  const date = new Date(currentDate + 'T12:00:00');
  date.setDate(date.getDate() + days);
  currentDate = date.toISOString().split('T')[0];
  updateDateDisplay();
  renderJournal();
}

function updateDateDisplay() {
  const today = new Date().toISOString().split('T')[0];
  elements.dateDisplay.textContent = currentDate === today ? 'Today' : new Date(currentDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function updateConfirmValues() {
  if (!currentTempMeal || currentTempMeal.id) return;
  const multiplier = parseFloat(elements.servingSlider.value);
  elements.servingLabel.textContent = `${multiplier}x`;
  elements.confirmCalories.value = Math.round((currentTempMeal.rawCalories || currentTempMeal.calories) * multiplier);
  elements.confirmProtein.value = Math.round((currentTempMeal.rawProtein || currentTempMeal.protein || 0) * multiplier);
  elements.confirmCarbs.value = Math.round((currentTempMeal.rawCarbs || currentTempMeal.carbs || 0) * multiplier);
  elements.confirmFat.value = Math.round((currentTempMeal.rawFat || currentTempMeal.fat || 0) * multiplier);
}

async function loadUserData() {
  if (!currentUser) return;
  showLoading(true);
  try {
    const settings = await storage.getSettings();
    currentSettings = { 
      ...currentSettings,
      geminiKey: settings.geminiKey || localStorage.getItem('gemini_key') || import.meta.env.VITE_GEMINI_API_KEY || '',
      calGoal: settings.calGoal || 2000,
      startWeight: settings.startWeight || 0,
      goalWeight: settings.goalWeight || 0,
      currentWeight: settings.currentWeight || 0
    };
    updateDateDisplay();
    await updateDashboard();
    await renderJournal();
    await renderShoppingList();
  } catch (e) { console.error(e); }
  finally { showLoading(false); }
}

function switchTab(tab) {
  Object.keys(elements.views).forEach(v => { elements.views[v].style.display = v === tab ? 'block' : 'none'; });
  elements.navItems.forEach(item => { item.classList.toggle('active', item.dataset.tab === tab); });
}

async function handleLog(type, data = null) {
  if (!currentSettings.geminiKey) return alert('Add Gemini Key in Settings.');
  showLoading(true);
  try {
    let input = type === 'text' ? elements.textLog.value : data;
    if (type === 'text' && !input) return;
    if (type === 'photo' && data) input = await toBase64(data);
    const result = await analyzeFood(currentSettings.geminiKey, input, type);
    if (result) {
      currentTempMeal = { ...result, rawCalories: result.calories, rawProtein: result.protein, rawCarbs: result.carbs, rawFat: result.fat };
      openConfirmModal(currentTempMeal, false);
    } else alert('AI failed. Try again.');
  } catch (e) { console.error(e); alert('Error logging meal.'); }
  finally { showLoading(false); }
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
  if (!isEdit) { elements.servingSlider.value = 1; elements.servingLabel.textContent = '1x'; }
  elements.confirmModal.style.display = 'flex';
}

function startVoiceRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) return alert('Speech not supported.');
  const recognition = new SpeechRecognition();
  recognition.onresult = (e) => { elements.textLog.value = e.results[0][0].transcript; handleLog('text'); };
  recognition.start();
}

async function renderJournal() {
  if (!currentUser) return;
  const meals = await storage.getMeals(currentDate);
  const water = await storage.getWater(currentDate);
  const grouped = { Breakfast: [], Lunch: [], Dinner: [], Snack: [] };
  let totalCals = 0, totalPro = 0;
  meals.forEach(m => {
    totalCals += (m.calories || 0); totalPro += (m.protein || 0);
    if (grouped[m.category]) grouped[m.category].push(m); else grouped.Snack.push(m);
  });
  elements.currentWater.textContent = water;
  updateWaterSummary(water);
  elements.categorizedMeals.innerHTML = Object.keys(grouped).map(cat => `
    <div class="category-section glass ${categoriesExpanded[cat] ? '' : 'collapsed'}" data-cat="${cat}">
      <div class="category-header">
        <h4><i data-lucide="chevron-down" class="chevron"></i> ${cat}</h4>
        <span class="category-stats">${grouped[cat].reduce((s, m) => s + (m.calories || 0), 0)} kcal • ${grouped[cat].reduce((s, m) => s + (m.protein || 0), 0)}g P</span>
      </div>
      <div class="category-content">
        ${grouped[cat].length === 0 ? '<p style="color:var(--text-dim);font-size:0.8rem">Empty</p>' : grouped[cat].map(m => `
          <div class="meal-item glass" data-id="${m.id}">
            <div class="meal-photo" style="background-image: url('${m.stockPhoto || `https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=150&q=80&sig=${encodeURIComponent(m.name)}`}')"></div>
            <div class="meal-details"><span class="meal-name">${m.name}</span><span class="meal-meta">${m.calories} kcal</span>
              <div class="macro-chips"><span class="chip protein">P: ${m.protein || 0}g</span><span class="chip carbs">C: ${m.carbs || 0}g</span><span class="chip fat">F: ${m.fat || 0}g</span></div>
            </div>
          </div>`).join('')}
      </div>
    </div>`).join('');
  lucide.createIcons();
  setupJournalInteractions(grouped);
  updateSummary(totalCals, totalPro);
}

function setupJournalInteractions(grouped) {
  document.querySelectorAll('.category-header').forEach(h => h.addEventListener('click', () => {
    const s = h.parentElement; categoriesExpanded[s.dataset.cat] = !categoriesExpanded[s.dataset.cat]; s.classList.toggle('collapsed');
  }));
  document.querySelectorAll('.meal-item').forEach(i => i.addEventListener('click', (e) => {
    const meal = Object.values(grouped).flat().find(m => m.id === i.dataset.id);
    if (meal) { currentTempMeal = meal; openConfirmModal(meal, true); }
  }));
}

function updateSummary(cals, pro) {
  const calGoal = currentSettings.calGoal || 2000;
  const proGoal = Math.round((currentSettings.currentWeight || 180) * 0.8) || 150;
  elements.totalCals.textContent = cals; elements.goalCals.textContent = calGoal;
  elements.totalPro.textContent = pro; elements.goalPro.textContent = proGoal;
  elements.calBar.style.width = `${Math.min(100, (cals / calGoal) * 100)}%`;
  elements.proBar.style.width = `${Math.min(100, (pro / proGoal) * 100)}%`;
}

function updateWaterSummary(amt) {
  const goal = Math.round((currentSettings.currentWeight || 180) * 0.5) || 90;
  elements.goalWater.textContent = goal; elements.waterBar.style.width = `${Math.min(100, (amt / goal) * 100)}%`;
}

async function renderShoppingList() {
  const list = await storage.getShoppingList();
  elements.shoppingList.innerHTML = list.map(item => `<div class="shopping-item glass"><span>${item.name}</span><span class="meal-meta">${item.suggestions ? item.suggestions.join(', ') : ''}</span></div>`).join('');
}

async function updateDashboard() {
  elements.currentWeightDisplay.textContent = `${currentSettings.currentWeight || '--'} lbs`;
  elements.goalWeightDisplay.textContent = `${currentSettings.goalWeight || '--'} lbs`;
  if (currentSettings.goalWeight > 0 && currentSettings.startWeight > 0) {
    const total = currentSettings.startWeight - currentSettings.goalWeight;
    const lost = currentSettings.startWeight - currentSettings.currentWeight;
    elements.goalProgress.style.width = `${Math.min(100, Math.max(0, (lost / total) * 100))}%`;
  } else elements.goalProgress.style.width = '0%';
}

function showLoading(s) { elements.loadingOverlay.style.display = s ? 'flex' : 'none'; }
function toBase64(f) { return new Promise((s, r) => { const reader = new FileReader(); reader.readAsDataURL(f); reader.onload = () => s(reader.result.split(',')[1]); reader.onerror = e => r(e); }); }

init();
