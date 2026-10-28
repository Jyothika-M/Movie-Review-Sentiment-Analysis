"""
test_api.py - Quick API test for ReelMood backend
Sends /health and predict requests and prints formatted results.
"""
import urllib.request
import json

BASE = "http://localhost:8000"

def post(path, data):
    body = json.dumps(data).encode()
    req = urllib.request.Request(
        BASE + path,
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read())

def get(path):
    with urllib.request.urlopen(BASE + path, timeout=10) as r:
        return json.loads(r.read())

def show(expected, text, result):
    ok = "OK" if result["label"] == expected else "FAIL"
    print(f"  [{ok}] Expected: {expected} | Got: {result['label']} | Confidence: {result['confidence']*100:.2f}%")
    print(f"       POSITIVE: {result['scores']['POSITIVE']*100:.2f}%  NEGATIVE: {result['scores']['NEGATIVE']*100:.2f}%")
    print(f"       Raw JSON: {json.dumps(result)}")
    print()

print("=" * 70)
print("ReelMood API Test Suite")
print("=" * 70)

# --- Health check ---
h = get("/health")
print(f"\n[GET /health]\n  {json.dumps(h)}\n")

print("-" * 70)
print("Standard test_api reviews")
print("-" * 70)

# Standard 3-review test
reviews_standard = [
    ("POSITIVE", "This film was an absolute masterpiece! The acting was superb, "
                 "the cinematography breathtaking, and the story deeply moving. "
                 "One of the best movies I have ever seen."),
    ("NEGATIVE", "What a complete waste of time. The plot made no sense, "
                 "the acting was wooden, and I nearly fell asleep halfway through. "
                 "Avoid this movie at all costs."),
    ("NEGATIVE", "The movie had some stunning visuals and a great soundtrack, "
                 "but the storyline felt rushed and characters were underdeveloped."),
]

for expected, text in reviews_standard:
    result = post("/predict", {"text": text})
    print(f"  Review: \"{text[:70]}...\"")
    show(expected, text, result)

print("-" * 70)
print("User-specified test reviews")
print("-" * 70)

# 4 user-specified reviews
reviews_user = [
    ("NEGATIVE", "Absolutely terrible. Boring, badly acted, a complete waste of time."),
    ("POSITIVE", "This movie was fantastic, I loved every minute of it!"),
    ("NEGATIVE", "I had high expectations for this film, but it turned out to be a huge disappointment. "
                 "The plot made no sense, the characters were uninteresting, and the ending was terrible."),
    ("POSITIVE", "Brilliant acting and a beautiful story. Highly recommended."),
]

for expected, text in reviews_user:
    result = post("/predict", {"text": text})
    print(f"  Review: \"{text}\"")
    show(expected, text, result)

print("=" * 70)
print("Done.")
