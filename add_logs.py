import os

path = r'C:\Users\maxxg\..gemini\antigravity\brain\FoodJournal\src\main.js'.replace('..', '.')

with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Add logging for UPC stages
content = content.replace(
    'if (type === "text" && upcRegex.test(input)) {',
    'if (type === "text" && upcRegex.test(input)) {\n        console.log("Stage 1: Checking Barcode Databases...");'
)

content = content.replace(
    'if (!res) {',
    'if (!res) {\n        console.log("Stage 2: Barcode lookup failed. Falling back to AI Search...");'
)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Added stage logging to main.js")
