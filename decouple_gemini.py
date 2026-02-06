import os

path = r'C:\Users\maxxg\..gemini\antigravity\brain\FoodJournal\src\main.js'.replace('..', '.')

with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Remove the hard block at the start of handleLog
content = content.replace(
    'if (!currentSettings.geminiKey) return alert("API Key missing");',
    ''
)

# 2. Add an optional check inside the AI fallback
content = content.replace(
    'res = await analyzeFood(currentSettings.geminiKey, input, type);',
    'if (currentSettings.geminiKey) res = await analyzeFood(currentSettings.geminiKey, input, type);'
)

# 3. Add a warning if nothing was found
content = content.replace(
    'if (res && typeof res === "object") {',
    'if (!res && !currentSettings.geminiKey) alert("Product not found in database and AI is disabled (API Key missing).");\n    if (res && typeof res === "object") {'
)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Successfully decoupled Gemini from UPC lookups")
