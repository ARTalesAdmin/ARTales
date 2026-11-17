"""ARTales real Chromium Reader check. Public page, no credentials.
Bounded to 9 spreads and one viewport. Logs actual DOM ink, not source regexes.
Modes: diagnostic (report only), gate (fail on orphan/overflow).
"""
import json
import os
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright

URL=os.getenv("ARTALES_READER_URL","https://artales.net/reader/the-great-god-pan?mode=full")
MODE=os.getenv("ARTALES_READER_MODE","diagnostic")
OUT=Path(os.getenv("ARTALES_READER_ARTIFACTS","reader-chromium-artifacts"))
OUT.mkdir(parents=True,exist_ok=True)

INSPECT_JS=r"""() => {
  const papers=[...document.querySelectorAll(".semantic-public-reader__spread .semantic-public-reader__paper")];
  return papers.filter(p=>p.querySelector(".semantic-public-reader__page-content")).map(p=>{
    const fragments=[...p.querySelectorAll("p.semantic-reader__fragment")];
    const pageNo=p.dataset.semanticPageIndex??"";
    const content=p.querySelector(".semantic-public-reader__page-content");
    const contentRect=content.getBoundingClientRect();
    const items=fragments.map(f=>{
      const rect=f.getBoundingClientRect(), rows=[];
      const iter=document.createTreeWalker(f,NodeFilter.SHOW_TEXT);
      let n;
      while((n=iter.nextNode())){
        const text=n.textContent??"";
        for(const m of text.matchAll(/\S+/gu)){
          const r=document.createRange();
          r.setStart(n,m.index);r.setEnd(n,m.index+m[0].length);
          const boxes=[...r.getClientRects()];
          if(!boxes.length)continue;
          const box=boxes[boxes.length-1];
          let row=rows.find(v=>Math.abs(v.top-box.top)<1.5);
          if(!row){row={top:box.top,right:box.right,words:[]};rows.push(row);}
          row.right=Math.max(row.right,box.right);row.words.push(m[0]);
        }
      }
      rows.sort((a,b)=>a.top-b.top);
      const last=rows.at(-1);
      const fill=last?Math.max(0,Math.min(1,(last.right-rect.left)/rect.width)):null;
      return {fragmentId:f.dataset.fragmentEnd??null,
        end:f.textContent?.trimEnd().slice(-80)??"",
        continues:!f.classList.contains("semantic-reader__fragment--final"),
        lastLine:last?.words.join(" ")??"",
        words:last?.words.length??0,fill,
        top:rect.top,bottom:rect.bottom,
        contentBottom:contentRect.bottom,
        offset:f.getAttribute("data-fragment-end"),
        alignLast:getComputedStyle(f).textAlignLast,
        flag:f.getAttribute("data-page-end-reason")};
    });
    return {pageNo,fragments:items};
  });
}""";

def inspect(page):
    page.wait_for_timeout(900)
    return page.evaluate(INSPECT_JS)

def main():
    errors=[]
    visited=[]
    with sync_playwright() as pw:
        browser=pw.chromium.launch(headless=True,args=["--no-sandbox"])
        page=browser.new_page(viewport={"width":1366,"height":768},
                             device_scale_factor=1)
        response=page.goto(URL,wait_until="domcontentloaded",timeout=45000)
        if response and response.status>=400:
            raise RuntimeError(f"Reader HTTP {response.status}: {URL}")
        page.wait_for_selector(".semantic-public-reader__spread .semantic-public-reader__paper",
                               timeout=45000)
        page.wait_for_function("!document.querySelector('.semantic-public-reader__reflow-status')",
                                timeout=55000)
        for spread in range(9):
            data=inspect(page)
            if spread in (0,1,2):
                page.screenshot(path=str(OUT/f"spread-{spread}.png"))
            for paper in data:
                visited.append(paper)
                for f in paper["fragments"]:
                    if not f["continues"] or f["fill"] is None:continue
                    bad=("nonsense;" in f["lastLine"] and f["words"]<=2) or (
                        f["fill"]<.25 and f["words"]<=2)
                    if bad:
                        errors.append({"page":paper["pageNo"],
                                       "lastLine":f["lastLine"],"fill":f["fill"],
                                       "words":f["words"],"offset":f["offset"],
                                       "reason":f["flag"]})
                        page.screenshot(path=str(OUT/f"orphan-{spread}.png"))
            next_button=page.locator(".artales-reader-side-nav--next").first
            if next_button.count()==0 or next_button.is_disabled():break
            next_button.click()
            page.wait_for_timeout(200)
        browser.close()
    report={"url":URL,"mode":MODE,"viewports":[[1366,768]],
            "spreads":len(visited)//2,"findings":errors,
            "pages":[{"page":p["pageNo"],
                      "last":[{"lastLine":f["lastLine"],"fill":f["fill"],
                               "words":f["words"],"continues":f["continues"],
                               "end":f["end"],"reason":f["flag"]}
                              for f in p["fragments"][-2:]]} for p in visited]}
    (OUT/"results.json").write_text(json.dumps(report,indent=2,ensure_ascii=False))
    print("ARTALES_CHROMIUM_REPORT="+json.dumps(report,ensure_ascii=False))
    if MODE=="gate" and errors:
        raise AssertionError(f"Chromium detected {len(errors)} short continued-page tails")
    if not visited:
        raise AssertionError("No semantic page was rendered")

if __name__=="__main__":
    main()
