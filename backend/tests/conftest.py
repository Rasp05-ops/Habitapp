import os

# Must be set before `app` is imported: anything other than "dev" is treated as production.
os.environ["APP_ENV"] = "dev"
os.environ.pop("GEMINI_API_KEY", None)
