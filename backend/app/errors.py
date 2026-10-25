class ApiError(Exception):
    """Raise this anywhere; main.py turns it into {"error": {"code", "message"}}."""

    def __init__(self, status: int, code: str, message: str):
        self.status, self.code, self.message = status, code, message
