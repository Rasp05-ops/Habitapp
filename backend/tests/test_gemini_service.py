import logging
from types import SimpleNamespace

from google import genai
from google.genai import errors

from app import gemini_service


def test_invalid_model_falls_back_and_redacts_api_key(monkeypatch, caplog):
    class FakeAPIError(Exception):
        code = 404

    calls = []

    def generate_content(model, **_kwargs):
        calls.append(model)
        if model == "missing-model":
            raise FakeAPIError("invalid model; key=private-test-key")
        return SimpleNamespace(text='{"reason":"ok","confidence":0.9}')

    monkeypatch.setattr(gemini_service, "IS_DEV", False)
    monkeypatch.setattr(errors, "APIError", FakeAPIError)
    monkeypatch.setattr(
        genai,
        "Client",
        lambda **_kwargs: SimpleNamespace(
            models=SimpleNamespace(generate_content=generate_content)
        ),
    )
    monkeypatch.setenv("GEMINI_API_KEY", "private-test-key")
    monkeypatch.setenv("GEMINI_MODEL", "missing-model")
    caplog.set_level(logging.ERROR, "habit.gemini")

    result = gemini_service.verify("study", b"photo", "image/jpeg")

    assert result.reason == "ok"
    assert calls == ["missing-model", "gemini-3.6-flash"]
    assert "[REDACTED]" in caplog.text
    assert "private-test-key" not in caplog.text
