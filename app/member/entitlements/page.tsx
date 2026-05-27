import { getCurrentProfile } from "@/lib/auth";
import { listEntitlementRequests } from "@/lib/entitlements";
import { normalizeRole } from "@/lib/permissions";
import {
  approveEntitlementRequest,
  grantOnlineReadAsAdmin,
  rejectEntitlementRequest,
  requestOnlineReadGrant,
} from "./actions";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function getNotice(searchParams: Record<string, string | string[] | undefined>) {
  const success = firstParam(searchParams.success);
  const error = firstParam(searchParams.error);

  if (success === "request_created") return { type: "success", text: "Doporučení bylo uloženo a čeká na schválení adminem." };
  if (success === "grant_created") return { type: "success", text: "Online přístup byl čtenáři přidělen." };
  if (success === "request_approved") return { type: "success", text: "Doporučení bylo schváleno a přístup přidělen." };
  if (success === "request_rejected") return { type: "success", text: "Doporučení bylo zamítnuto." };

  if (error === "admin_required") return { type: "error", text: "Tuto akci může provést pouze admin." };
  if (error === "not_allowed") return { type: "error", text: "Doporučení mohou zadávat jen editor nebo admin." };
  if (error === "missing_request_fields") return { type: "error", text: "Doplň čtenáře a dílo pro doporučení." };
  if (error === "missing_grant_fields") return { type: "error", text: "Doplň čtenáře a dílo pro ruční grant." };
  if (error === "request_failed") return { type: "error", text: "Doporučení se nepodařilo uložit. Zkontroluj přesný e-mail/handle a slug díla." };
  if (error === "grant_failed") return { type: "error", text: "Grant se nepodařilo přidělit. Zkontroluj přesný e-mail/handle a slug díla." };
  if (error === "approve_failed") return { type: "error", text: "Doporučení se nepodařilo schválit." };
  if (error === "reject_failed") return { type: "error", text: "Doporučení se nepodařilo zamítnout." };

  return null;
}

export default async function MemberEntitlementsPage({ searchParams }: PageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const notice = getNotice(resolvedSearchParams);
  const profile = await getCurrentProfile();
  const role = normalizeRole(profile?.role);
  const isAdmin = role === "admin";
  const canRecommend = role === "admin" || role === "editor";
  const requests = await listEntitlementRequests("pending");

  return (
    <main className="artales-member-page">
      <p className="artales-member-kicker">Čtenářské nároky</p>
      <h1>Nároky a přístupy</h1>
      <p className="artales-member-lede">
        Ruční přidělení online čtení je ekonomický zásah, proto ho může provést pouze admin. Editor může doporučit přidělení; admin doporučení schválí nebo zamítne.
      </p>

      {notice ? (
        <div className={`artales-member-notice artales-member-notice--${notice.type}`}>
          {notice.text}
        </div>
      ) : null}

      <section className="artales-member-grid artales-member-grid--two">
        {isAdmin ? (
          <article className="artales-member-panel">
            <p className="artales-member-card-label">Admin</p>
            <h2>Ručně přidělit online čtení</h2>
            <p>
              Přidělí čtenáři trvalý <code>online_read</code> nárok se zdrojem <code>manual_grant</code>.
            </p>
            <form action={grantOnlineReadAsAdmin} className="artales-member-form">
              <label>
                Čtenář — e-mail nebo handle
                <input name="reader_lookup" required placeholder="hana@example.com nebo zizalka" />
              </label>
              <label>
                Dílo — přesný slug
                <input name="work_lookup" required placeholder="napr-vila-pod-lipami" />
              </label>
              <label>
                Interní poznámka
                <textarea name="note" rows={3} placeholder="Např. promo přístup, test, kompenzace…" />
              </label>
              <button className="artales-button-primary" type="submit">
                Přidělit přístup
              </button>
            </form>
          </article>
        ) : null}

        {canRecommend ? (
          <article className="artales-member-panel">
            <p className="artales-member-card-label">Editor</p>
            <h2>Doporučit přidělení</h2>
            <p>
              Doporučení nic nepřidělí. Vznikne záznam pro admina a až schválení vytvoří čtenářský nárok.
            </p>
            <form action={requestOnlineReadGrant} className="artales-member-form">
              <label>
                Čtenář — e-mail nebo handle
                <input name="reader_lookup" required placeholder="reader@example.com nebo handle" />
              </label>
              <label>
                Dílo — přesný slug
                <input name="work_lookup" required placeholder="slug-dila" />
              </label>
              <label>
                Důvod doporučení
                <textarea name="note" rows={3} placeholder="Proč má čtenář dostat přístup?" />
              </label>
              <button className="artales-button-secondary" type="submit">
                Uložit doporučení
              </button>
            </form>
          </article>
        ) : (
          <article className="artales-member-panel">
            <p className="artales-member-card-label">Pouze náhled</p>
            <h2>Bez oprávnění k přidělování</h2>
            <p>
              Tvoje role nemůže přidělovat ani doporučovat čtenářské nároky. Tato vrstva je kvůli hodnotě obsahu pod admin kontrolou.
            </p>
          </article>
        )}
      </section>

      <section className="artales-member-panel" style={{ marginTop: 22 }}>
        <p className="artales-member-card-label">Čekající doporučení</p>
        <h2>Ke schválení adminem</h2>
        {requests.length > 0 ? (
          <div className="artales-member-list">
            {requests.map((request) => (
              <article key={request.id} className="artales-member-list-item">
                <div>
                  <p className="artales-member-card-label">
                    {request.requested_by?.display_name ?? request.requested_by?.email ?? "Neznámý editor"}
                  </p>
                  <h3>{request.work?.title ?? "Neznámé dílo"}</h3>
                  <p>
                    Čtenář: <strong>{request.target_user?.email ?? "neznámý"}</strong>
                    {request.target_user?.handle ? <> / @{request.target_user.handle}</> : null}
                  </p>
                  {request.note ? <p>{request.note}</p> : null}
                </div>

                {isAdmin ? (
                  <div className="artales-member-list-actions">
                    <form action={approveEntitlementRequest} className="artales-member-inline-form">
                      <input type="hidden" name="request_id" value={request.id} />
                      <input name="admin_note" placeholder="Poznámka admina" />
                      <button className="artales-button-primary" type="submit">
                        Schválit
                      </button>
                    </form>
                    <form action={rejectEntitlementRequest} className="artales-member-inline-form">
                      <input type="hidden" name="request_id" value={request.id} />
                      <input name="admin_note" placeholder="Důvod zamítnutí" />
                      <button className="artales-button-secondary" type="submit">
                        Zamítnout
                      </button>
                    </form>
                  </div>
                ) : (
                  <p className="artales-member-muted">Čeká na admina.</p>
                )}
              </article>
            ))}
          </div>
        ) : (
          <p>Žádná čekající doporučení.</p>
        )}
      </section>
    </main>
  );
}
