"""Unit tests for SEC-02 Server-Side HTML & Rich Text Sanitization."""

from app.core.sanitization import sanitize_html


def test_sanitize_script_tags():
    raw = "<script>alert('xss')</script><p>Hello World</p>"
    clean = sanitize_html(raw)
    assert "<script>" not in clean
    assert "alert" not in clean
    assert "<p>Hello World</p>" in clean


def test_sanitize_img_onerror_payload():
    raw = '<p>Test Image</p><img src="x" onerror="alert(1)">'
    clean = sanitize_html(raw)
    assert "onerror" not in clean
    assert "alert" not in clean
    assert "<p>Test Image</p>" in clean


def test_sanitize_javascript_urls():
    raw = '<a href="javascript:alert(1)">Click Me</a>'
    clean = sanitize_html(raw)
    assert "javascript:" not in clean
    assert "alert" not in clean
    assert "Click Me" in clean


def test_sanitize_svg_payloads():
    raw = '<svg onload="alert(1)"><circle cx="50" cy="50" r="40"/></svg>'
    clean = sanitize_html(raw)
    assert "<svg" not in clean
    assert "onload" not in clean
    assert "alert" not in clean


def test_sanitize_nested_html():
    raw = '<div><script><iframe>nested</iframe></script><p>Valid <b>text</b></p></div>'
    clean = sanitize_html(raw)
    assert "<script>" not in clean
    assert "<iframe>" not in clean
    assert "<p>Valid <b>text</b></p>" in clean


def test_preserve_legitimate_formatted_content():
    raw = '<h1>Announcement Title</h1><p>Welcome to <b>GateSphere</b> community. Please visit <a href="https://example.com" target="_blank">our portal</a>.</p>'
    clean = sanitize_html(raw)
    assert "<h1>Announcement Title</h1>" in clean
    assert "<b>GateSphere</b>" in clean
    assert 'href="https://example.com"' in clean
