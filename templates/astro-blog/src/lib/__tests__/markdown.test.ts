import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { renderMarkdown } from "../markdown.ts";

describe("renderMarkdown — XSS protection", () => {
  it("strips <script> tags", () => {
    const out = renderMarkdown("<script>alert(1)</script>");
    assert.ok(!out.includes("<script"), `expected <script> stripped, got: ${out}`);
    assert.ok(!out.includes("alert(1)"), `expected script body stripped, got: ${out}`);
  });

  it("strips on* event handlers from img tags", () => {
    const out = renderMarkdown('<img src=x onerror="alert(1)">');
    assert.ok(!out.includes("onerror"), `expected onerror stripped, got: ${out}`);
    assert.ok(!out.includes("alert(1)"), `expected handler body stripped, got: ${out}`);
  });

  it("blocks javascript: URLs in links", () => {
    const out = renderMarkdown('<a href="javascript:alert(1)">click</a>');
    assert.ok(!out.includes("javascript:"), `expected javascript: scheme removed, got: ${out}`);
  });

  it("strips <iframe> tags", () => {
    const out = renderMarkdown('<iframe src="https://evil.example"></iframe>');
    assert.ok(!out.includes("<iframe"), `expected iframe stripped, got: ${out}`);
  });

  it("strips <object> and <embed>", () => {
    const out = renderMarkdown('<object data="evil.swf"></object><embed src="evil.swf">');
    assert.ok(!out.includes("<object"), `expected object stripped, got: ${out}`);
    assert.ok(!out.includes("<embed"), `expected embed stripped, got: ${out}`);
  });

  it("strips <style> and <link> tags", () => {
    const out = renderMarkdown('<style>body{background:url("javascript:alert(1)")}</style>');
    assert.ok(!out.includes("<style"), `expected style stripped, got: ${out}`);
  });

  it("discards <xmp> contents (GHSA-rpr9-rxv7-x643 / CVE-2026-44990)", () => {
    const payloads = [
      "<xmp><script>alert(1)</script></xmp>",
      "<xmp><img src=x onerror=alert(1)></xmp>",
      "<xmp><svg><script>alert(1)</script></svg></xmp>",
    ];
    for (const p of payloads) {
      const out = renderMarkdown(p);
      assert.ok(!out.includes("<script"), `xmp bypass: script survived for ${p}, got: ${out}`);
      assert.ok(!out.includes("onerror"), `xmp bypass: onerror survived for ${p}, got: ${out}`);
      assert.ok(!out.includes("alert(1)"), `xmp bypass: payload survived for ${p}, got: ${out}`);
    }
  });
});

describe("renderMarkdown — happy paths", () => {
  it("renders headings, lists, emphasis", () => {
    const out = renderMarkdown("# Title\n\n- item\n\n**bold**");
    assert.ok(out.includes("<h1"), "expected h1");
    assert.ok(out.includes("<ul"), "expected ul");
    assert.ok(out.includes("<strong>bold</strong>"), "expected bold");
  });

  it("renders fenced code blocks", () => {
    const out = renderMarkdown("```\nconst x = 1;\n```");
    assert.ok(out.includes("<pre"), "expected pre");
    assert.ok(out.includes("<code"), "expected code");
  });

  it("preserves legitimate <img> with safe attributes", () => {
    const out = renderMarkdown('<img src="/media/foo.png" alt="x" width="100" height="50">');
    assert.ok(out.includes("<img"), `expected img preserved, got: ${out}`);
    assert.ok(out.includes('src="/media/foo.png"'), `expected src preserved, got: ${out}`);
    assert.ok(out.includes('alt="x"'), `expected alt preserved, got: ${out}`);
  });

  it("renders autolinks as anchors", () => {
    const out = renderMarkdown("<https://example.com>");
    assert.ok(out.includes("<a"), `expected anchor, got: ${out}`);
    assert.ok(out.includes("https://example.com"), `expected URL, got: ${out}`);
  });

  it("returns empty string for null / undefined / empty input", () => {
    assert.equal(renderMarkdown(null), "");
    assert.equal(renderMarkdown(undefined), "");
    assert.equal(renderMarkdown(""), "");
  });
});
