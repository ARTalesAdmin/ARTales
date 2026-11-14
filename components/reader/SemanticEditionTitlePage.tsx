import styles from "./SemanticEditionTitlePage.module.css";

/** One three-line title page for QA and published semantic editions. */
export default function SemanticEditionTitlePage({title,author,headingLevel=2,variant="qa"}:{
 title:string;author:string;headingLevel?:1|2;variant?:"qa"|"public";
}){
 const Heading=headingLevel===1?"h1":"h2";
 return <section aria-label="Titulní strana díla"
  data-semantic-edition-title-page="true"
  className={variant==="public"?styles.publicPage:styles.page}>
  <Heading className={styles.title}>{title}</Heading>
  <p className={styles.author}>{author}</p>
  <p className={styles.signature}>ARTales with love.</p>
 </section>;
}
