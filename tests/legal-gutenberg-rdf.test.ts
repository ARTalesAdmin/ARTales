import test from "node:test";import assert from "node:assert/strict";import {parseGutenbergRdf} from "../lib/legal/gutenbergRights";
test("RDF creator deaths and USA rights",()=>{
 const xml='<rdf:RDF><pgterms:agent rdf:about="agent1"><pgterms:name>Machen, Arthur</pgterms:name><pgterms:deathdate>1947</pgterms:deathdate></pgterms:agent><dcterms:creator><pgterms:agent><pgterms:name>Machen, Arthur</pgterms:name><pgterms:deathdate>1947</pgterms:deathdate></pgterms:agent></dcterms:creator><dcterms:rights>Public domain in the USA.</dcterms:rights></rdf:RDF>';
 const r=parseGutenbergRdf(xml,389);assert.equal(r.usStatus,"public_domain");assert.equal(r.people[0].died,1947);
});
test("absent rights remains unknown",()=>assert.equal(parseGutenbergRdf("<rdf:RDF></rdf:RDF>",389).usStatus,"unknown"));
