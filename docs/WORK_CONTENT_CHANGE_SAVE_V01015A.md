# ARTales v0.10.15a — Unified content change save

Cíl patche: přestat nutit editory u velkých děl ukládat zvlášť podle typu akce.

## Co řeší v této fázi

U existujícího velkého díla může jedno kliknutí na **Uložit** uložit běžnou kombinaci obsahových změn:

- nově vložené bloky,
- upravené existující bloky,
- smazané existující bloky,
- metadata díla ve stejném uživatelském kroku.

Změny obsahu se neukládají jako celé obří `content_blocks`, ale jako změnová sada do `work_content_block_batches.metadata.content_change_set`.

## Co zůstává pro další patch

- přesuny původních bloků jako samostatná operace,
- lepší stav „uloženo / pracovní kopie / neuložené změny“,
- lokální recovery s bezpečným porovnáním proti uložené verzi,
- pozdější serverový autosave draftu.

## Proč ne full-save

Velká díla už dříve narážela na timeouty a velikost payloadu. Nový model zachovává dávkovou vrstvu, ale sjednocuje editorový UX: editor pracuje přirozeně a interní formát řeší systém.
