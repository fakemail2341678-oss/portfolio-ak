import { describe, expect, it } from "vitest";
import { sanitizeRichText } from "@/server/rich-text/sanitize";

describe("sanitizeRichText", () => {
	it("keeps everything the editor toolbar can produce", () => {
		const html =
			"<h2>Title</h2><h3>Sub</h3><p><strong>b</strong> <em>i</em> <u>u</u> <s>s</s> <code>c</code><br></p>" +
			'<ul><li><p>one</p></li></ul><ol start="3"><li><p>two</p></li></ol><blockquote><p>q</p></blockquote><pre><code>x</code></pre><hr>';
		expect(sanitizeRichText(html)).toBe(html.replace("<br>", "<br />").replace("<hr>", "<hr />"));
	});

	it("removes scripts, event handlers, styles and unknown tags", () => {
		const out = sanitizeRichText(
			'<p onclick="steal()" style="color:red" class="x">hi<img src=x onerror=alert(1)></p><script>alert(1)</script><iframe src="https://evil.test"></iframe><div>kept text</div>',
		);
		expect(out).toBe("<p>hi</p>kept text");
	});

	it("forces safe link attributes and allows only http(s)/mailto", () => {
		expect(sanitizeRichText('<a href="https://example.com" target="_self" rel="opener">ok</a>')).toBe(
			'<a href="https://example.com" target="_blank" rel="noopener noreferrer nofollow">ok</a>',
		);
		expect(sanitizeRichText('<a href="mailto:me@example.com">mail</a>')).toContain('href="mailto:me@example.com"');
		// Dangerous or protocol-relative links lose the link but keep the text.
		expect(sanitizeRichText('<a href="javascript:alert(1)">x</a>')).toBe("x");
		expect(sanitizeRichText('<a href="JaVaScRiPt:alert(1)">x</a>')).toBe("x");
		expect(sanitizeRichText('<a href="data:text/html,hi">x</a>')).toBe("x");
		expect(sanitizeRichText('<a href="//evil.test">x</a>')).toBe("x");
	});

	it("is idempotent", () => {
		const once = sanitizeRichText('<p>a <a href="https://x.test">b</a></p><script>x</script>');
		expect(sanitizeRichText(once)).toBe(once);
	});
});
