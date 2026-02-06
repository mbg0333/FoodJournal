import os

path = r'C:\Users\maxxg\..gemini\antigravity\brain\FoodJournal\src\main.js'.replace('..', '.')

with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Fix res bug in saveBulk
old_save_bulk = 'await storage.addFavorite({ ...agg, name, category: "Lunch", stockPhoto: `https://source.unsplash.com/featured/?${encodeURIComponent(res.photoSearchQuery || res.name)},food` });'
new_save_bulk = 'await storage.addFavorite({ ...agg, name, category: "Lunch", stockPhoto: `https://source.unsplash.com/featured/?${encodeURIComponent(name)},food` });'
content = content.replace(old_save_bulk, new_save_bulk)

# 2. Add null-safety to ID usage
# Fix toggleSelect/editMeal just in case
content = content.replace("window.toggleSelect('${m.id}')", "window.toggleSelect('${m.id || \"\"}')")
content = content.replace("window.editMeal('${m.id}')", "window.editMeal('${m.id || \"\"}')")
content = content.replace("window.quickLog('${m.id}')", "window.quickLog('${m.id || \"\"}')")

# 3. Ensure handleLog handles null res
content = content.replace('if (res) {', 'if (res && typeof res === "object") {')

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Successfully updated main.js")
