import type { ReactNode } from "react";
export function LegalSourceDiscovery({title,author}:{title:string;author:string}):ReactNode{
 const q=encodeURIComponent(title+" "+author);
 return <section className="ca-card" aria-label="Průzkum právních zdrojů">
  <h2>Průzkum zdrojů</h2>
  <p>Výchozí je Project Gutenberg; Open Library slouží jako další bibliografický zdroj. Žádný text se nenačítá na ARTales.</p>
  <p><a target="_blank" rel="noopener noreferrer" href={`https://www.gutenberg.org/ebooks/search/?query=${q}`}>Hledat v Gutenberg (výchozí) ↗</a></p>
  <p><a target="_blank" rel="noopener noreferrer" href={`https://openlibrary.org/search?q=${q}`}>Hledat v Open Library ↗</a></p>
 </section>;
}
