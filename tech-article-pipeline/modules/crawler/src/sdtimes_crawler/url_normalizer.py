import re
from typing import Optional, Tuple
from urllib.parse import urlparse, urlunparse, parse_qs, urlencode, urljoin
from bs4 import BeautifulSoup


TRACKING_PARAMS_PREFIXES = ("utm_",)
TRACKING_PARAMS_EXACT = {
    "fbclid", "gclid", "ref", "mc_cid", "mc_eid", "source", "_hsenc", "_hsmi",
    "mkt_tok", "yclid", "_ga"
}
ALLOWED_SDTIMES_HOSTS = {"sdtimes.com", "www.sdtimes.com"}


def is_safe_sdtimes_url(url: str) -> bool:
    try:
        parsed = urlparse(url)
        return (
            parsed.scheme == "https"
            and parsed.hostname in ALLOWED_SDTIMES_HOSTS
            and parsed.username is None
            and parsed.password is None
            and parsed.port in {None, 443}
        )
    except ValueError:
        return False


def make_absolute_url(url: str, base_url: str = "https://sdtimes.com") -> str:
    """Step 1: Ensure URL is absolute."""
    if not url:
        return ""
    return urljoin(base_url, url.strip())


def extract_canonical_from_html(html_content: str, base_url: str = "https://sdtimes.com") -> Optional[str]:
    """Step 3 (Priority 1): Extract <link rel='canonical'> or <meta property='og:url'>."""
    if not html_content:
        return None

    try:
        soup = BeautifulSoup(html_content, "html.parser")
        
        # 1. <link rel="canonical" href="...">
        link_tag = soup.find("link", attrs={"rel": lambda r: r and "canonical" in (r if isinstance(r, str) else " ".join(r)).lower()})
        if link_tag and link_tag.get("href"):
            href = link_tag["href"].strip()
            if href:
                return make_absolute_url(href, base_url)
                
        # 2. <meta property="og:url" content="...">
        meta_tag = soup.find("meta", attrs={"property": "og:url"})
        if meta_tag and meta_tag.get("content"):
            content = meta_tag["content"].strip()
            if content:
                return make_absolute_url(content, base_url)
    except Exception:
        pass
    
    return None


def clean_url_rules(raw_url: str) -> str:
    """
    Step 3 (Priority 2): Common cleaning rules on URL:
    - Remove tracking query parameters (utm_*, fbclid, ref, etc.)
    - Lowercase hostname/domain
    - Remove hash (#fragment)
    - Normalize trailing slash
    """
    if not raw_url:
        return ""

    parsed = urlparse(raw_url)
    
    # 1. Hostname lowercase
    netloc = parsed.netloc.lower()
    scheme = parsed.scheme.lower() or "https"
    
    # 2. Query params cleaning
    query_dict = parse_qs(parsed.query, keep_blank_values=False)
    cleaned_query = {}
    for key, values in query_dict.items():
        key_lower = key.lower()
        if key_lower in TRACKING_PARAMS_EXACT:
            continue
        if any(key_lower.startswith(prefix) for prefix in TRACKING_PARAMS_PREFIXES):
            continue
        cleaned_query[key] = values
        
    new_query = urlencode(cleaned_query, doseq=True)
    
    # 3. Path & Trailing slash normalization
    path = parsed.path or "/"
    # Standardize multiple slashes
    path = re.sub(r"/+", "/", path)
    
    # Standardize trailing slash: strip trailing slash except for root '/'
    if len(path) > 1 and path.endswith("/"):
        path = path.rstrip("/")
        
    # 4. Remove fragment / hash
    fragment = ""

    clean_url = urlunparse((scheme, netloc, path, parsed.params, new_query, fragment))
    return clean_url


def normalize_url_pipeline(
    discovered_url: str,
    final_url: Optional[str] = None,
    html_content: Optional[str] = None,
    base_url: str = "https://sdtimes.com"
) -> Tuple[str, str, str]:
    """
    Executes full 3-step URL normalization:
    Returns (discovered_url, final_url, canonical_url)
    """
    # Step 1: Discovered URL
    discovered_url_abs = make_absolute_url(discovered_url, base_url)
    
    # Step 2: Final URL
    final_url_abs = make_absolute_url(final_url or discovered_url_abs, base_url)
    
    # Step 3: Canonical URL determination
    # Priority 1: HTML tags (<link rel="canonical"> or <meta property="og:url">)
    canonical = None
    if html_content:
        canonical = extract_canonical_from_html(html_content, base_url)
        
    if canonical and is_safe_sdtimes_url(canonical):
        # Apply cleaning rules to the html canonical tag as well for clean parameter/hash stripping
        canonical_clean = clean_url_rules(canonical)
    else:
        # Priority 2: Fallback to cleaned finalUrl
        canonical_clean = (
            clean_url_rules(final_url_abs) if is_safe_sdtimes_url(final_url_abs) else ""
        )
        
    return discovered_url_abs, clean_url_rules(final_url_abs), canonical_clean
