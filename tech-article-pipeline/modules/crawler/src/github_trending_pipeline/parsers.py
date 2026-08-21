from __future__ import annotations

import re

from bs4 import BeautifulSoup

from .contracts import TrendingRepository
from .errors import GitHubTrendingError
from .urls import repository_identity_from_href

_NUMBER_PATTERN = re.compile(r"[\d,.]+")
_STARS_TODAY_PATTERN = re.compile(r"([\d,.]+)\s+stars?\s+today", re.IGNORECASE)


def _number(text: str | None) -> int | None:
    if not text or not (match := _NUMBER_PATTERN.search(text)):
        return None
    normalized = match.group(0).replace(",", "").replace(".", "")
    return int(normalized)


def parse_trending_repositories(html: str) -> list[TrendingRepository]:
    soup = BeautifulSoup(html, "html.parser")
    cards = soup.select("article.Box-row")
    if not cards:
        raise GitHubTrendingError(
            "TRENDING_STRUCTURE_CHANGED",
            "GitHub Trending did not contain repository cards.",
            retryable=False,
        )

    repositories: list[TrendingRepository] = []
    for rank, card in enumerate(cards, start=1):
        repository_link = card.select_one("h2 a[href]")
        if repository_link is None:
            raise GitHubTrendingError(
                "TRENDING_STRUCTURE_CHANGED",
                "A GitHub Trending card did not contain a repository link.",
                retryable=False,
                details={"rank": rank},
            )
        owner, repository = repository_identity_from_href(str(repository_link["href"]))
        description_node = card.select_one("p")
        description = description_node.get_text(" ", strip=True) if description_node else None
        language_node = card.select_one('[itemprop="programmingLanguage"]')
        language = language_node.get_text(" ", strip=True) if language_node else None
        stars_link = card.select_one(f'a[href="/{owner}/{repository}/stargazers"]')
        forks_link = card.select_one(f'a[href="/{owner}/{repository}/forks"]')
        card_text = card.get_text(" ", strip=True)
        stars_today_match = _STARS_TODAY_PATTERN.search(card_text)
        contributors = []
        for image in card.select('img[alt^="@"]'):
            handle = str(image.get("alt", "")).removeprefix("@").strip()
            if handle and handle not in contributors:
                contributors.append(handle)
        repositories.append(
            TrendingRepository(
                rank=rank,
                owner=owner,
                repository=repository,
                description=description or None,
                programmingLanguage=language or None,
                totalStars=_number(stars_link.get_text(" ", strip=True) if stars_link else None),
                totalForks=_number(forks_link.get_text(" ", strip=True) if forks_link else None),
                starsToday=(
                    _number(stars_today_match.group(1)) if stars_today_match else None
                ),
                builtBy=contributors,
            )
        )
    return repositories
