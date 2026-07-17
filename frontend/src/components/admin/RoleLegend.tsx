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
          <p className="font-medium text-foreground">Passport has the final say</p>
          <p className="mt-1">
            Roles live in Passport; Prepper only asks. Being refused here is normal — a Manager may
            give someone Staff, but may not change an existing role. Changes also appear once
            Passport syncs them back, not the instant you make them.
          </p>
        </div>
      </div>
    </details>
  );
}
