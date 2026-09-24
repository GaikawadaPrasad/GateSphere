"""Server-side HTML / Rich Text Sanitization Module (SEC-02).

Strips dangerous HTML tags (<script>, <iframe>, <object>, <embed>, <form>, <svg>, etc.),
event attributes (onerror, onload, onclick, etc.), and `javascript:` / `data:` URI schemes.
Preserves legitimate rich-text formatting tags (<p>, <b>, <i>, <ul>, <li>, <a>, <h1>-<h6>, etc.).
"""

import html
import re

# Allowed HTML tags for rich text fields
ALLOWED_TAGS = {
    "a",
    "b",
    "blockquote",
    "br",
    "code",
    "div",
    "em",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "hr",
    "i",
    "li",
    "ol",
    "p",
    "pre",
    "span",
    "strong",
    "u",
    "ul",
}

# Allowed attributes per tag
ALLOWED_ATTRIBUTES = {
    "a": {"href", "title", "target", "rel"},
    "span": {"style", "class"},
    "div": {"style", "class"},
    "p": {"style", "class"},
}

# Regex patterns for stripping dangerous constructs
DANGEROUS_TAGS_PATTERN = re.compile(
    r"<\s*(script|iframe|object|embed|svg|style|link|meta|form|button|input|select|option|applet|base)\b[^>]*>.*?<\s*/\s*\1\s*>",
    re.IGNORECASE | re.DOTALL,
)

SELF_CLOSING_DANGEROUS_TAGS_PATTERN = re.compile(
    r"<\s*(script|iframe|object|embed|svg|style|link|meta|form|button|input|select|option|applet|base)\b[^>]*/>",
    re.IGNORECASE,
)

EVENT_HANDLER_PATTERN = re.compile(
    r"\s+on[a-z]+\s*=\s*(?:'[^']*'|\"[^\"]*\"|[^\s>]+)",
    re.IGNORECASE,
)

JAVASCRIPT_URL_PATTERN = re.compile(
    r"(?:href|src|action)\s*=\s*(?:'[^']*javascript:[^']*'|\"[^\"]*javascript:[^\"]*\"|[^\s>]*javascript:[^\s>]+)",
    re.IGNORECASE,
)


def sanitize_html(content: str | None) -> str:
    """Sanitize a rich-text HTML string, stripping dangerous tags, scripts, and event handlers.

    If content is None or empty, returns empty string.
    """
    if not content:
        return ""

    text = content

    # 1. Remove dangerous paired tags (e.g. <script>...</script>, <iframe...>...</iframe>, <svg>...</svg>)
    text = DANGEROUS_TAGS_PATTERN.sub("", text)
    text = SELF_CLOSING_DANGEROUS_TAGS_PATTERN.sub("", text)

    # 2. Remove inline event handlers (onerror=, onclick=, onload=, etc.)
    text = EVENT_HANDLER_PATTERN.sub("", text)

    # 3. Remove javascript: URLs
    text = JAVASCRIPT_URL_PATTERN.sub("", text)

    # 4. Strip any remaining disallowed tags while preserving text content
    def _replace_tag(match: re.Match) -> str:
        tag_match = re.match(r"<\s*(/?)\s*([a-zA-Z0-9]+)", match.group(0))
        if not tag_match:
            return ""
        is_closing = bool(tag_match.group(1))
        tag_name = tag_match.group(2).lower()

        if tag_name not in ALLOWED_TAGS:
            return ""

        if is_closing:
            return f"</{tag_name}>"

        # Check attributes for allowed tags
        attrs_str = match.group(0)[len(tag_match.group(0)) :]
        allowed_attrs = ALLOWED_ATTRIBUTES.get(tag_name, set())

        cleaned_attrs = []
        attr_matches = re.findall(
            r'([a-zA-Z0-9_-]+)\s*=\s*(?:"([^"]*)"|\'([^\']*)\'|([^\s>]+))', attrs_str
        )
        for attr_name, val1, val2, val3 in attr_matches:
            attr_name_lower = attr_name.lower()
            if attr_name_lower in allowed_attrs:
                val = val1 or val2 or val3 or ""
                # Ensure no javascript: or data: in href
                if attr_name_lower == "href" and (
                    "javascript:" in val.lower() or "data:" in val.lower()
                ):
                    continue
                cleaned_attrs.append(f'{attr_name_lower}="{html.escape(val)}"')

        attr_formatted = (" " + " ".join(cleaned_attrs)) if cleaned_attrs else ""
        return f"<{tag_name}{attr_formatted}>"

    tag_pattern = re.compile(r"</?[a-zA-Z0-9]+\b[^>]*>")
    text = tag_pattern.sub(_replace_tag, text)

    return text.trim() if hasattr(text, "trim") else text.strip()
