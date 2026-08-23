import html
import re
import unicodedata
from typing import Optional
from datetime import datetime, timezone
from dateutil import parser as date_parser
from bs4 import BeautifulSoup, Comment


def clean_text_nfkc(text: str) -> str:
    """
    Applies Unicode NFKC normalization, HTML unescaping, space compression, and line break cleanup.
    """
    if not text:
        return ""

    # 1. Unescape HTML entities (&amp;, &nbsp;, &#8217;, etc.)
    text = html.unescape(text)

    # 2. Unicode NFKC Normalization
    text = unicodedata.normalize("NFKC", text)

    # 3. Line-by-line whitespace cleanup
    lines = text.splitlines()
    cleaned_lines = []
    for line in lines:
        # Compress multiple inline spaces/tabs to single space
        line = re.sub(r"[ \t\r\f\v]+", " ", line).strip()
        cleaned_lines.append(line)

    text = "\n".join(cleaned_lines)

    # 4. Collapse 3+ consecutive newlines to 2 newlines (\n\n)
    text = re.sub(r"\n{3,}", "\n\n", text).strip()
    return text


def clean_title_or_author(text: str) -> str:
    """Clean title or author string."""
    if not text:
        return ""
    text = html.unescape(text)
    text = unicodedata.normalize("NFKC", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def extract_article_body_text(html_content: str) -> str:
    """
    Extracts article text from HTML with boilerplate removal:
    - Removes script, style, nav, footer, header, iframe, form, ads, sidebar, comments.
    - Focuses on article content elements (.entry-content, article, main).
    """
    if not html_content:
        return ""

    soup = BeautifulSoup(html_content, "html.parser")

    # Remove unwanted tags
    unwanted_tags = [
        "script", "style", "nav", "footer", "header", "aside", "iframe",
        "form", "noscript", "svg", "button", "input"
    ]
    for tag in soup.find_all(unwanted_tags):
        tag.decompose()

    # Remove HTML comments
    for comment in soup.find_all(string=lambda text: isinstance(text, Comment)):
        comment.extract()

    # Remove elements matching ad/newsletter/sidebar classes/ids
    unwanted_selectors = [
        ".sdt-in-article-ad", ".sidebar", ".widget", ".nav", ".menu",
        ".footer", ".header", ".comment-respond", ".related-posts",
        ".newsletter-signup", "[id*='gpt-ad']"
    ]
    for selector in unwanted_selectors:
        for tag in soup.select(selector):
            tag.decompose()

    # Try finding main article container
    article_container = (
        soup.find("div", class_=lambda c: c and "entry-content" in c) or
        soup.find("article") or
        soup.find("main") or
        soup.body or
        soup
    )

    # Extract text with linebreaks between block elements
    lines = []
    for elem in article_container.find_all(["p", "h1", "h2", "h3", "h4", "h5", "h6", "li", "blockquote", "div"]):
        # Ignore container div if it has block children to avoid duplicated text
        if elem.name == "div" and elem.find_all(["p", "div", "h1", "h2", "h3"]):
            continue
        line_text = elem.get_text()
        if line_text:
            lines.append(line_text)

    if not lines:
        raw_extracted = article_container.get_text(separator="\n")
        return clean_text_nfkc(raw_extracted)

    full_text = "\n\n".join(lines)
    return clean_text_nfkc(full_text)


def parse_to_iso8601_utc(date_str: Optional[str], default_tz=timezone.utc) -> Optional[str]:
    """
    Parses raw date string (e.g. 'Fri, 07 Aug 2026 17:41:48 +0000', '2026-08-07T17:41:48+00:00')
    into standard ISO 8601 UTC string (e.g. '2026-08-07T17:41:48Z').
    """
    if not date_str or not date_str.strip():
        return None

    cleaned_str = date_str.strip()
    try:
        dt = date_parser.parse(cleaned_str)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=default_tz)
        else:
            dt = dt.astimezone(timezone.utc)

        return dt.strftime("%Y-%m-%dT%H:%M:%SZ")
    except Exception:
        return None
