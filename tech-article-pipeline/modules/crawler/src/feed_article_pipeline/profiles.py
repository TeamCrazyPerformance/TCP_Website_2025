from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum


class FeedContentMode(StrEnum):
    FEED_CONTENT = "FEED_CONTENT"
    ARTICLE_PAGE = "ARTICLE_PAGE"


@dataclass(frozen=True, slots=True)
class FeedSourceProfile:
    source_id: str
    name: str
    base_url: str
    feed_url: str
    robots_url: str
    section_key: str
    content_mode: FeedContentMode
    allowed_hosts: tuple[str, ...]
    article_selectors: tuple[str, ...] = ()
    additional_robots_urls: tuple[str, ...] = ()
    language_hint: str | None = None
    minimum_request_interval_seconds: float = 1.0

    @property
    def source_path(self) -> str:
        from urllib.parse import urlsplit

        return urlsplit(self.feed_url).path or "/"

    @property
    def robots_urls(self) -> tuple[str, ...]:
        return (self.robots_url, *self.additional_robots_urls)


FEED_SOURCE_PROFILES: dict[str, FeedSourceProfile] = {
    "tailscale-blog": FeedSourceProfile(
        source_id="tailscale-blog",
        name="Tailscale Blog",
        base_url="https://tailscale.com",
        feed_url="https://tailscale.com/blog/index.xml",
        robots_url="https://tailscale.com/robots.txt",
        section_key="BLOG",
        content_mode=FeedContentMode.ARTICLE_PAGE,
        allowed_hosts=("tailscale.com",),
        article_selectors=(".blog-content-prose", "main article", "article"),
        language_hint="en",
    ),
    "rust-blog": FeedSourceProfile(
        source_id="rust-blog",
        name="Rust Blog",
        base_url="https://blog.rust-lang.org",
        feed_url="https://blog.rust-lang.org/feed.xml",
        robots_url="https://blog.rust-lang.org/robots.txt",
        section_key="BLOG",
        content_mode=FeedContentMode.FEED_CONTENT,
        allowed_hosts=("blog.rust-lang.org",),
        language_hint="en",
    ),
    "hugging-face-blog": FeedSourceProfile(
        source_id="hugging-face-blog",
        name="Hugging Face Blog",
        base_url="https://huggingface.co",
        feed_url="https://huggingface.co/blog/feed.xml",
        robots_url="https://huggingface.co/robots.txt",
        section_key="BLOG",
        content_mode=FeedContentMode.ARTICLE_PAGE,
        allowed_hosts=("huggingface.co",),
        article_selectors=(".blog-content", "main article", "article"),
        language_hint="en",
    ),
    "deepmind-blog": FeedSourceProfile(
        source_id="deepmind-blog",
        name="Google DeepMind Blog",
        base_url="https://deepmind.google",
        feed_url="https://deepmind.google/blog/rss.xml",
        robots_url="https://deepmind.google/robots.txt",
        section_key="BLOG",
        content_mode=FeedContentMode.ARTICLE_PAGE,
        allowed_hosts=("deepmind.google", "www.deepmind.google", "blog.google"),
        article_selectors=("main article", "main"),
        additional_robots_urls=("https://blog.google/robots.txt",),
        language_hint="en",
    ),
}
