from __future__ import annotations

from datetime import UTC
from email.utils import parsedate_to_datetime
from xml.etree.ElementTree import Element, ParseError

from defusedxml import ElementTree as DefusedElementTree
from defusedxml.common import DefusedXmlException

from tech_articles_ingestion.config import IngestionConfig
from tech_articles_ingestion.errors import IngestionError
from tech_articles_ingestion.hashing import source_payload_hash
from tech_articles_ingestion.models import RssFeed, RssItem

DC_NAMESPACE = "http://purl.org/dc/elements/1.1/"
CONTENT_NAMESPACE = "http://purl.org/rss/1.0/modules/content/"


class CloudflareRssParser:
    def __init__(self, config: IngestionConfig) -> None:
        self._config = config

    def parse(self, xml_bytes: bytes) -> RssFeed:
        try:
            root = DefusedElementTree.fromstring(
                xml_bytes,
                forbid_dtd=True,
                forbid_entities=True,
                forbid_external=True,
            )
        except (DefusedXmlException, ParseError, ValueError) as exc:
            code = "RSS_DTD_NOT_ALLOWED" if "DTD" in str(exc).upper() else "RSS_XML_INVALID"
            raise IngestionError(
                code=code,
                message="The RSS document is not a safe, well-formed XML document.",
                retryable=False,
                stage="RSS_PARSE",
            ) from exc

        self._validate_tree_limits(root)
        channel = next((child for child in root if self._local_name(child.tag) == "channel"), None)
        if channel is None:
            raise IngestionError(
                code="RSS_XML_INVALID",
                message="The RSS document does not contain a channel.",
                stage="RSS_PARSE",
            )
        language_element = self._first_child(channel, "language")
        last_build_element = self._first_child(channel, "lastBuildDate")
        language = self._element_text(language_element)
        last_build_date = self._element_text(last_build_element)

        items: list[RssItem] = []
        for index, element in enumerate(
            child for child in channel if self._local_name(child.tag) == "item"
        ):
            item = self._parse_item(
                element,
                index=index,
                channel_language=language,
                channel_language_present=language_element is not None,
            )
            item.source_payload_hash = source_payload_hash(item)
            items.append(item)
        return RssFeed(language=language, last_build_date=last_build_date, items=items)

    def _parse_item(
        self,
        element: Element,
        *,
        index: int,
        channel_language: str | None,
        channel_language_present: bool,
    ) -> RssItem:
        guid_element = self._first_child(element, "guid")
        link_element = self._first_child(element, "link")
        title_element = self._first_child(element, "title")
        pub_date_element = self._first_child(element, "pubDate")
        description_element = self._first_child(element, "description")
        creator_elements = [
            child
            for child in element
            if self._namespace(child.tag) == DC_NAMESPACE
            and self._local_name(child.tag) == "creator"
        ]
        category_elements = [
            child for child in element if self._local_name(child.tag) == "category"
        ]
        content_element = next(
            (
                child
                for child in element
                if self._namespace(child.tag) == CONTENT_NAMESPACE
                and self._local_name(child.tag) == "encoded"
            ),
            None,
        )
        pub_date_raw = self._element_text(pub_date_element)
        item = RssItem(
            index=index,
            guid=self._element_text(guid_element),
            link=self._element_text(link_element),
            title=self._element_text(title_element),
            pub_date_raw=pub_date_raw,
            creators=[self._element_text(child) or "" for child in creator_elements],
            categories=[self._element_text(child) or "" for child in category_elements],
            description=self._element_text(description_element),
            content_encoded=self._element_text(content_element),
            channel_language=channel_language,
            field_presence={
                "link": link_element is not None,
                "title": title_element is not None,
                "creators": bool(creator_elements),
                "pubDate": pub_date_element is not None,
                "description": description_element is not None,
                "categories": bool(category_elements),
                "contentEncoded": content_element is not None,
                "channelLanguage": channel_language_present,
            },
        )
        item.parsed_published_at = self._parse_date(pub_date_raw)
        return item

    def _validate_tree_limits(self, root: Element) -> None:
        node_count = 0
        stack: list[tuple[Element, int]] = [(root, 1)]
        while stack:
            node, depth = stack.pop()
            node_count += 1
            if node_count > self._config.maximum_xml_nodes:
                raise IngestionError(
                    code="RSS_XML_INVALID",
                    message="The RSS document exceeds the node limit.",
                    stage="RSS_PARSE",
                )
            if depth > self._config.maximum_xml_depth:
                raise IngestionError(
                    code="RSS_XML_INVALID",
                    message="The RSS document exceeds the nesting limit.",
                    stage="RSS_PARSE",
                )
            if node.text and len(node.text) > self._config.maximum_xml_field_length:
                raise IngestionError(
                    code="RSS_XML_INVALID",
                    message="An RSS field exceeds the configured length limit.",
                    stage="RSS_PARSE",
                )
            stack.extend((child, depth + 1) for child in node)

    @staticmethod
    def _first_child(element: Element, local_name: str) -> Element | None:
        return next(
            (
                child
                for child in element
                if CloudflareRssParser._local_name(child.tag) == local_name
            ),
            None,
        )

    @staticmethod
    def _element_text(element: Element | None) -> str | None:
        if element is None:
            return None
        return "".join(element.itertext())

    @staticmethod
    def _local_name(tag: str) -> str:
        return tag.rsplit("}", 1)[-1] if "}" in tag else tag

    @staticmethod
    def _namespace(tag: str) -> str | None:
        return tag[1:].split("}", 1)[0] if tag.startswith("{") else None

    @staticmethod
    def _parse_date(value: str | None):
        if not value:
            return None
        try:
            parsed = parsedate_to_datetime(value)
        except (TypeError, ValueError, OverflowError):
            return None
        if parsed.tzinfo is None:
            return None
        return parsed.astimezone(UTC)
