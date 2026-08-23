from __future__ import annotations

import re
from urllib.robotparser import RobotFileParser

from tech_articles_ingestion.config import IngestionConfig
from tech_articles_ingestion.errors import IngestionError
from tech_articles_ingestion.http import SafeHttpClient


class CloudflarePolicyChecker:
    def __init__(self, config: IngestionConfig, http_client: SafeHttpClient) -> None:
        self._config = config
        self._http = http_client

    async def ensure_allowed(self) -> None:
        response = await self._http.get(
            "https://blog.cloudflare.com/robots.txt",
            accept="text/plain,*/*;q=0.1",
            allowed_content_types={"text/plain", "text/robots.txt"},
            error_prefix="POLICY",
        )
        try:
            text = response.body.decode("utf-8")
        except UnicodeDecodeError as exc:
            raise IngestionError(
                code="SOURCE_ACCESS_FORBIDDEN",
                message="The source robots policy is not valid UTF-8 text.",
                stage="RSS_REQUEST",
            ) from exc
        parser = RobotFileParser()
        parser.set_url("https://blog.cloudflare.com/robots.txt")
        parser.parse(text.splitlines())
        if not parser.can_fetch(self._config.user_agent, self._config.rss_url):
            raise IngestionError(
                code="SOURCE_ACCESS_FORBIDDEN",
                message="The source robots policy does not allow the RSS request.",
                stage="RSS_REQUEST",
            )
        signal = self._ai_input_signal(text)
        if signal == "no":
            raise IngestionError(
                code="SOURCE_ACCESS_FORBIDDEN",
                message="The source Content-Signal does not allow AI input.",
                stage="RSS_REQUEST",
            )

    @staticmethod
    def _ai_input_signal(text: str) -> str | None:
        for line in text.splitlines():
            if not line.casefold().startswith("content-signal:"):
                continue
            match = re.search(r"(?:^|[,;\s])ai-input\s*=\s*(yes|no)(?:$|[,;\s])", line, re.I)
            if match:
                return match.group(1).casefold()
        return None
