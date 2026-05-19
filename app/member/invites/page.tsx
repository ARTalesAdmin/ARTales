import { revokeInvite, createInvite } from "@/lib/actions/invites";
import { listRecentInvites } from "@/lib/dbInvites";
import { requireInviteManager } from "@/lib/guards";
import { getAllowedInviteRoles } from "@/lib/permissions";

type PageProps = {
  searchParams: Promise<{ error?: string; success?: string; invite?: string }>;
};

function statusLabel(status: string) {
  switch (status) {
    case "accepted":
      return "přijato";
    case "revoked":
      return "zrušeno";
    case "expired":
      return "expirovalo";
    default:
      return "čeká";
  }
}

export default async function InvitesPage({ searchParams }: PageProps) {
  const profile = await requireInviteManager();
  const allowedRoles = getAllowedInviteRoles(profile);
  const invites = await listRecentInvites();
  const { error, success, invite } = await searchParams;

  return (
    <main
      style={{ padding: "42px 32px", maxWidth: "1100px", margin: "0 auto" }}
    >
      <p
        style={{
          textTransform: "uppercase",
          letterSpacing: "0.12em",
          color: "#8a6a2d",
          fontWeight: 800,
        }}
      >
        ARTales identity
      </p>
      <h1
        style={{
          fontFamily: "Georgia, 'Times New Roman', serif",
          fontSize: "44px",
          margin: "0 0 12px",
        }}
      >
        Pozvánky
      </h1>
      <p style={{ maxWidth: "760px", color: "#5f5247" }}>
        Admin může zvát editory, membery a readery. Editor může zvát membery a
        readery. Každá pozvánka ukládá, kdo koho přivedl, aby šlo později stavět
        strom/síť přínosů.
      </p>

      {error ? (
        <p
          className="artales-member-panel"
          style={{ padding: "12px 14px", color: "#7b1d1d" }}
        >
          Pozvánku se nepodařilo uložit nebo role není povolená.
        </p>
      ) : null}
      {success ? (
        <p
          className="artales-member-panel"
          style={{ padding: "12px 14px", color: "#22602f" }}
        >
          Akce proběhla.
        </p>
      ) : null}
      {invite ? (
        <div
          className="artales-member-panel"
          style={{ padding: "16px", margin: "18px 0" }}
        >
          <strong>Nový invite link:</strong>
          <p style={{ wordBreak: "break-all", marginBottom: 0 }}>{invite}</p>
        </div>
      ) : null}

      <section
        className="artales-member-panel"
        style={{ padding: "22px", marginTop: "26px" }}
      >
        <h2 style={{ marginTop: 0 }}>Vytvořit pozvánku</h2>
        <form
          action={createInvite}
          style={{ display: "grid", gap: "14px", maxWidth: "620px" }}
        >
          <label>
            <strong>E-mail</strong>
            <input
              name="email"
              type="email"
              required
              style={{
                display: "block",
                width: "100%",
                marginTop: 8,
                padding: "12px 14px",
                border: "1px solid rgba(13,21,40,.18)",
              }}
            />
          </label>

          <label>
            <strong>Role</strong>
            <select
              name="invited_role"
              required
              style={{
                display: "block",
                width: "100%",
                marginTop: 8,
                padding: "12px 14px",
                border: "1px solid rgba(13,21,40,.18)",
              }}
            >
              {allowedRoles.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
          </label>

          <label>
            <strong>Poznámka</strong>
            <textarea
              name="note"
              rows={3}
              style={{
                display: "block",
                width: "100%",
                marginTop: 8,
                padding: "12px 14px",
                border: "1px solid rgba(13,21,40,.18)",
              }}
            />
          </label>

          <button
            className="artales-button"
            type="submit"
            style={{ width: "fit-content" }}
          >
            Vytvořit pozvánku
          </button>
        </form>
      </section>

      <section style={{ marginTop: "30px" }}>
        <h2>Poslední pozvánky</h2>
        <div style={{ display: "grid", gap: "12px" }}>
          {invites.map((item) => (
            <article
              key={item.id}
              className="artales-member-card"
              style={{ padding: "16px" }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: "12px",
                  flexWrap: "wrap",
                }}
              >
                <div>
                  <strong>{item.email}</strong>
                  <p style={{ margin: "4px 0", color: "#5f5247" }}>
                    Role: {item.invited_role} · Stav: {statusLabel(item.status)}{" "}
                    · Vytvořeno:{" "}
                    {new Date(item.created_at).toLocaleString("cs-CZ")}
                  </p>
                  {item.note ? (
                    <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>
                      {item.note}
                    </p>
                  ) : null}
                </div>
                {item.status === "pending" ? (
                  <form action={revokeInvite.bind(null, item.id)}>
                    <button type="submit" className="artales-button-secondary">
                      Zrušit
                    </button>
                  </form>
                ) : null}
              </div>
            </article>
          ))}
          {invites.length === 0 ? <p>Zatím nejsou žádné pozvánky.</p> : null}
        </div>
      </section>
    </main>
  );
}
