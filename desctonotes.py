import spacy

# Load English model
try:
    nlp = spacy.load("en_core_web_sm")
except OSError:
    # Auto-download if missing
    from spacy.cli import download
    download("en_core_web_sm")
    nlp = spacy.load("en_core_web_sm")

description = """Our first coffee from Harvest ‘24 is a medium-dark roast with chocolatey and nutty flavours. This single-origin ground coffee hails from the beautiful Kolli Berri Estate, set in Chikmagalur, Karnataka. 
While brewing this one, you’ll notice the unique characteristics of the coffee beans, starting with the aroma of dried fruits, followed by a syrupy mouthfeel in every sip. With medium acidity and medium- high bitterness, it offers a full-bodied profile which is enhanced when brewed as an espresso or using an AeroPress, Moka Pot or a French Press. 
"""

doc = nlp(description)

# Keyword lists
process_keywords = ["washed", "natural", "honey", "anaerobic", "fermentation", "process"]
brewing_methods = ["espresso", "moka pot", "french press", "south indian filter", "aeropress", "pour over", "cold brew"]
taste_indicators = ["notes", "flavour", "flavor", "taste", "hint"]

# Extract process
process = None
for token in doc:
    if token.text.lower() in process_keywords:
        process = token.text
        break

# Extract tasting notes
tasting_notes = []
for sent in doc.sents:
    if any(word in sent.text.lower() for word in taste_indicators):
        tasting_notes.append(sent.text.strip())

# Extract brewing methods
found_methods = []
for method in brewing_methods:
    if method in description.lower():
        found_methods.append(method)

print("Process:", process if process else "None")
print("Tasting Notes:", ", ".join(tasting_notes) if tasting_notes else "None")
print("Brewing Methods:", ", ".join(found_methods) if found_methods else "None")
