import os

path = r'C:\Users\maxxg\..gemini\antigravity\brain\FoodJournal\index.html'.replace('..', '.')

with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Replace the entire log-container buttons row to ensure all icons are there
old_row = """          <div style="display: flex; gap: 10px;">
            <button id="voice-btn" class="icon glass"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="22"></line></svg></button>
            <button id="photo-btn" class="icon glass"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg></button>
            <button id="barcode-btn" class="icon glass"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 4H21V20H3V4Z"/><path d="M7 8V16"/><path d="M10 8V16"/><path d="M14 8V16"/><path d="M17 8H17.01"/></svg></button>
            <button id="log-search-btn" class="icon glass"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg></button>
            <button id="open-favs-log-btn" class="glass" style="flex: 1; display: flex; align-items: center; justify-content: center; gap: 8px;">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg> FAVS
            </button>
          </div>"""

# I need to match what's actually in the file.
# The previous view showed it matched my insertion.

# If the user doesn't see it, I'll make the gap smaller or icons smaller.
new_row = """          <div style="display: flex; gap: 8px; justify-content: space-between;">
            <button id="voice-btn" class="icon glass"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="22"></line></svg></button>
            <button id="photo-btn" class="icon glass"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg></button>
            <button id="barcode-btn" class="icon glass"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 4H21V20H3V4Z"/><path d="M7 8V16"/><path d="M10 8V16"/><path d="M14 8V16"/><path d="M17 8H17.01"/></svg></button>
            <button id="log-search-btn" class="icon glass"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg></button>
            <button id="open-favs-log-btn" class="glass" style="flex: 1; display: flex; align-items: center; justify-content: center; gap: 6px; padding: 10px 8px;">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg> <span style="font-size: 0.8rem">FAVS</span>
            </button>
          </div>"""

content = content.replace(old_row, new_row)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Successfully updated index.html buttons")
