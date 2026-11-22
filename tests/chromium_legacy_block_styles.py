"""Browser-level guard for legacy Reader's centrally managed block typography."""
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
style_a=(ROOT/"components/work/work-content-renderer.css").read_text(encoding="utf-8")
style_b=(ROOT/"components/reader/reader.css").read_text(encoding="utf-8")
html="""<main class="artales-reader artales-reader--theme-light">
<article class="artales-work-content artales-renderer--reader-comfort">
<div data-legacy-block-style="paragraph" style="
--artales-block-font:Arial, Helvetica, sans-serif;
--artales-block-weight:700;
--artales-block-style:italic;
--artales-block-size:1.3em;
--artales-block-leading:1.7;
--artales-block-align:right;
--artales-block-indent:2em;
--artales-block-before:1em;
--artales-block-after:2em;
--artales-block-hyphens:none;
break-before:page;break-inside:avoid">
<section class="artales-block artales-paragraph"><p>First line text for style <em>parity</em>.</p></section></div>
<div data-legacy-block-style="chapter" style="
--artales-block-font:Georgia,serif;
--artales-block-weight:500;
--artales-block-style:normal;
--artales-block-size:1.8em;
--artales-block-leading:1.2;
--artales-block-align:center;
--artales-block-indent:0em;
--artales-block-before:2em;
--artales-block-after:1em;
--artales-block-hyphens:manual;
break-before:page">
<section class="artales-block artales-chapter"><h3>Chapter I</h3></section>
</div></article></main>"""
with sync_playwright() as p:
    browser=p.chromium.launch()
    page=browser.new_page(viewport={"width":1024,"height":768})
    page.set_content(html)
    page.add_style_tag(content=style_a)
    page.add_style_tag(content=style_b)
    got=page.evaluate("""() => {
      const wrap=document.querySelector('[data-legacy-block-style="paragraph"]');
      const para=wrap.querySelector('p');
      const chap=document.querySelector('[data-legacy-block-style="chapter"] h3');
      const w=getComputedStyle(wrap),p=getComputedStyle(para),c=getComputedStyle(chap);
      return {font:p.fontFamily,size:p.fontSize,align:p.textAlign,indent:p.textIndent,
        hyphens:p.hyphens,leading:p.lineHeight,marginBefore:w.marginTop,
        marginAfter:w.marginBottom,page:w.breakBefore,keep:w.breakInside,
        headingAlign:c.textAlign,headingSize:c.fontSize,weight:p.fontWeight,italic:p.fontStyle,inlineItalic:getComputedStyle(para.querySelector('em')).fontStyle,headingWeight:c.fontWeight};
    }""")
    assert "Arial" in got["font"],got
    assert got["align"]=="right",got
    assert got["hyphens"]=="none",got
    assert got["page"]=="page" and got["keep"]=="avoid",got
    assert got["headingAlign"]=="center",got
    assert got["weight"]=="700" and got["italic"]=="italic",got
    assert got["inlineItalic"]=="italic",got
    assert got["headingWeight"]=="500",got
    assert float(got["indent"].removesuffix("px"))>20,got
    assert float(got["size"].removesuffix("px"))>20,got
    assert float(got["headingSize"].removesuffix("px"))>25,got
    print("Legacy Reader enforced global block style CSS: PASS",got)
    browser.close()
