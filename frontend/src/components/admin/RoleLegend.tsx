'use client';

/**
 * The two role vocabularies, and the ladder.
 *
 * This page shows four role words drawn from TWO unrelated vocabularies, and nothing on screen said
 * which was which. `models/passport.py` puts it bluntly: `Manager`/`Staff` are "a DIFFERENT
 * vocabulary from the org membership's Owner | Admin | Member. Do not conflate them."
 *
 * Native `<details>` rather than a `Collapsible` primitive: it is accessible for free, needs no
 * state, and one disclosure is not yet a pattern worth extracting.
 */
export function RoleLegend() {
  return (
    <details className="rounded-lg border border-border bg-card">
      <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-foreground">
        What do these roles mean?
      </summary>

      <div className="space-y-4 border-t border-border px-4 py-3 text-sm text-muted-foreground">
        <div>
          <p className="font-medium text-foreground">Brand roles — what someone can do at a brand</p>
          <ul className="mt-1 space-y-1">
            <li>
              <span className="font-medium text-foreground">Manager</span> — runs the brand, and can
              give people <span className="font-medium text-foreground">Staff</span> there.
            </li>
            <li>
              <span className="font-medium text-foreground">Staff</span> — works at the brand.
            </li>
          </ul>
        </div>

        <div>
          <p className="font-medium text-foreground">
            Organisation roles — who governs the organisation
          </p>
          <p className="mt-1">
            <span className="font-medium text-foreground">Owner</span>,{' '}
            <span className="font-medium text-foreground">Admin</span> and{' '}
            <span className="font-medium text-foreground">Member</span> are a separate vocabulary,
            set in Passport. They are shown here for context — they are not brand roles, and changing
            one is not something this page does.
          </p>
        </div>

        <div>
          <p className="font-medium text-foreground">Why some rows say “auto”</p>
          <p className="mt-1">
            Owners and Admins get <span className="font-medium text-foreground">Manager</span> at
            every brand automatically, without being given a role — those rows read{' '}
            <span className="font-medium text-foreground">auto</span> and have nothing to edit or
            remove.
          </p>
          <p className="mt-1">
            Giving one of them an explicit role <em>overrides</em> the automatic Manager, so an Owner
            can be set to <span className="font-medium text-foreground">Staff</span> at a single
            brand while staying Manager everywhere else. That row is a real assignment and can be
            changed or removed like any other.
          </p>
        </div>

        <div>
          <p className="font-medium text-foreground">Who can change what</p>
          <ul className="mt-1 space-y-1">
            <li>
              An organisation <span className="font-medium text-foreground">Owner</span> or{' '}
              <span className="font-medium text-foreground">Admin</span> can give either role,
              change an existing one, and remove anyone.
            </li>
            <li>
              A brand <span className="font-medium text-foreground">Manager</span> can give someone{' '}
              <span className="font-medium text-foreground">Staff</span> at a brand they manage, and
              remove Staff there. They cannot change an existing role, and cannot remove another
              Manager.
            </li>
          </ul>
          <p className="mt-1">
            You only see the brands you have access to, so this page may show fewer brands than your
            organisation has.
          </p>
        </div>

        <div>
          <p className="font-medium text-foreground">Passport has the final say</p>
          <p className="mt-1">
            Roles live in Passport; Prepper only asks. Controls you cannot use are hidden rather than
            shown and refused — but Passport still checks every change, so a refusal is normal rather
            than a fault. Changes also appear once Passport syncs them back, not the instant you make
            them.
          </p>
        </div>
      </div>
    </details>
  );
}
