"""Loads the shared game rules. Never hard-code these numbers elsewhere."""
import json
import os
from pathlib import Path

CONTRACT_DIR = Path(__file__).resolve().parents[2] / "contract"
RULES: dict = json.loads((CONTRACT_DIR / "constants.json").read_text(encoding="utf-8"))
CATALOG: dict[str, dict] = {h["id"]: h for h in RULES["habits"]["catalog"]}

STORY_QUIZ_POINTS = 10
STORIES = [
    {
        "id": "the-clever-rabbit",
        "title": "The Clever Rabbit",
        "summary": "A short Panchatantra-inspired story about using courage and wisdom to solve a difficult problem.",
        "video_id": "",
        "questions": [
            {"id": "lesson", "prompt": "What helped the rabbit solve the problem?", "options": ["Wisdom and courage", "Giving up", "Ignoring the danger"]},
            {"id": "choice", "prompt": "What should we do before making a difficult choice?", "options": ["Think about the consequences", "Follow the crowd", "Act without thinking"]},
            {"id": "moral", "prompt": "What is the main lesson?", "options": ["Good thinking can overcome a bigger challenge", "Strength is always enough", "Problems solve themselves"]},
        ],
        "answers": {"lesson": 0, "choice": 0, "moral": 0},
    }
    ,{
        "id": "the-blue-jackal",
        "title": "The Blue Jackal",
        "summary": "A Panchatantra-inspired story about honesty, appearances, and the consequences of pretending to be someone else.",
        "video_id": "",
        "questions": [
            {"id": "truth", "prompt": "What caused the jackal's trouble?", "options": ["Pretending to be someone else", "Helping the animals", "Telling the truth"]},
            {"id": "lesson", "prompt": "What should we value more than appearances?", "options": ["Honesty and character", "Loud promises", "A fancy title"]},
            {"id": "moral", "prompt": "What is the main lesson?", "options": ["False appearances do not last", "A disguise solves every problem", "Being praised is all that matters"]},
        ],
        "answers": {"truth": 0, "lesson": 0, "moral": 0},
    },
    {
        "id": "the-monkey-and-the-crocodile",
        "title": "The Monkey and the Crocodile",
        "summary": "A clever friendship tale about quick thinking, trust, and staying calm in danger.",
        "video_id": "",
        "questions": [
            {"id": "escape", "prompt": "How did the monkey escape?", "options": ["By staying calm and thinking quickly", "By fighting the river", "By hiding underwater"]},
            {"id": "friendship", "prompt": "What does the story teach about trust?", "options": ["Choose friends wisely", "Trust every promise", "Never help anyone"]},
            {"id": "moral", "prompt": "What is the main lesson?", "options": ["Presence of mind can save us", "Strength always wins", "Never change your plan"]},
        ],
        "answers": {"escape": 0, "friendship": 0, "moral": 0},
    },
    {
        "id": "the-lion-and-the-hare",
        "title": "The Lion and the Hare",
        "summary": "A story about a small but brave hare who uses intelligence to protect the forest.",
        "video_id": "",
        "questions": [
            {"id": "strength", "prompt": "What did the hare use instead of strength?", "options": ["Intelligence", "Anger", "A bigger roar"]},
            {"id": "community", "prompt": "Why did the animals work together?", "options": ["To protect everyone", "To find treasure", "To praise the lion"]},
            {"id": "moral", "prompt": "What is the main lesson?", "options": ["Courage and wisdom can overcome power", "The biggest is always right", "Fear is the best guide"]},
        ],
        "answers": {"strength": 0, "community": 0, "moral": 0},
    },
    {
        "id": "the-tortoise-and-the-geese",
        "title": "The Tortoise and the Geese",
        "summary": "A gentle lesson about listening carefully and controlling our words.",
        "video_id": "",
        "questions": [
            {"id": "mistake", "prompt": "What mistake did the tortoise make?", "options": ["He spoke when he was told to stay quiet", "He flew too far", "He helped a friend"]},
            {"id": "control", "prompt": "What skill would have helped him?", "options": ["Self-control", "Haste", "Pride"]},
            {"id": "moral", "prompt": "What is the main lesson?", "options": ["Think before you speak", "Always speak first", "Never listen to advice"]},
        ],
        "answers": {"mistake": 0, "control": 0, "moral": 0},
    },
    {
        "id": "the-four-friends",
        "title": "The Four Friends",
        "summary": "A story about a crow, mouse, deer, and tortoise who overcome danger through teamwork.",
        "video_id": "",
        "questions": [
            {"id": "teamwork", "prompt": "How did the friends solve problems?", "options": ["By combining their different strengths", "By competing", "By working alone"]},
            {"id": "friendship", "prompt": "What makes a strong friendship?", "options": ["Helping one another", "Keeping secrets from everyone", "Only meeting when convenient"]},
            {"id": "moral", "prompt": "What is the main lesson?", "options": ["Unity makes us stronger", "Friends must be identical", "Only one friend should decide"]},
        ],
        "answers": {"teamwork": 0, "friendship": 0, "moral": 0},
    },
    {
        "id": "the-elephant-and-the-mice",
        "title": "The Elephant and the Mice",
        "summary": "A story about kindness returned and how even the smallest friend can make a difference.",
        "video_id": "",
        "questions": [
            {"id": "kindness", "prompt": "Why did the mice help the elephants?", "options": ["The elephants had once spared their homes", "They wanted a reward", "They were forced to help"]},
            {"id": "help", "prompt": "What does the story show about help?", "options": ["Anyone can be useful", "Only the strong can help", "Help is never remembered"]},
            {"id": "moral", "prompt": "What is the main lesson?", "options": ["Kindness comes back to us", "Never trust small friends", "Power solves every problem"]},
        ],
        "answers": {"kindness": 0, "help": 0, "moral": 0},
    }
]
video_ids = [value.strip() for value in os.getenv("STORY_VIDEO_IDS", "").split(",") if value.strip()]
if os.getenv("APP_ENV", "prod").strip().lower() != "dev" and len(video_ids) < len(STORIES):
    raise RuntimeError("Production requires one approved STORY_VIDEO_IDS value per daily story.")
for index, video_id in enumerate(video_ids[:len(STORIES)]):
    STORIES[index]["video_id"] = video_id
