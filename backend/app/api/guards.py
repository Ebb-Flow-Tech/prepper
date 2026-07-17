"""Resource-access guards.

Authentication is global (`deps.require_auth`); it proves WHO is calling. These prove what they may
*touch*. That gap produced every cross-brand leak found in this codebase: a route would resolve a
`User` and then never consult it, or consult it for one branch and not another.

They are FastAPI dependencies, not helper functions, and deliberately so:

- The path parameter (`recipe_id` / `session_id`) resolves automatically, so a route cannot pass the
  wrong id.
- The guard returns the resource, so the route has no reason to re-fetch it unchecked — the
  natural way to write the route is the safe way.
- `scripts/route_auth_census.py` can then assert mechanically that no recipe-child route lacks one,
  which a hand-rolled `if` in forty routes never allowed.

**404, not 403, for a resource you cannot see.** Its existence is not yours to learn. The one
exception is `require_recipe_access`, which 403s — `GET /recipes/{id}` has always done that and the
tests pin it; changing it would be an unrelated behaviour change smuggled into a security fix.

That exception stops at the org boundary. A recipe in ANOTHER org 404s like any other unseeable
resource; only a recipe in your own org that sits outside your brands gets the historical 403. The
two failures are not the same failure: one says "not yours to reach", the other says "not yours to
know about".
"""

from fastapi import Depends, HTTPException, status
from sqlalchemy import or_
from sqlmodel import Session, col, select

from app.api.deps import OrgContext, get_current_user, get_org_context, get_session
from app.domain.org_scope import org_scope
from app.models import (
    Ingredient,
    Recipe,
    RecipeImage,
    RecipeOutlet,
    TastingNoteImage,
    User,
)
from app.models.ingredient_tasting import IngredientTastingNote
from app.models.menu_sketch import MenuSketch
from app.models.menu_sketch_section import MenuSketchSection
from app.models.menu_sketch_section_item import MenuSketchSectionItem
from app.models.menu_sketch_section_item_comment import MenuSketchSectionItemComment
from app.models.recipe_tasting import RecipeTasting
from app.models.tasting import TastingNote, TastingSession, TastingUser
from app.passport import access


def _in_org(recipe: Recipe, organization_id: str) -> bool:
    """Whether the recipe belongs to the org being acted in.

    The in-Python twin of `domain.org_scope.org_scope` — a guard resolves one row it already holds,
    so it tests the value rather than adding a predicate. The two must stay in step; both dropped
    their transitional NULL arm at `q3orgnn3t4u`.

    Kept separate from :func:`_may_see_recipe` because the two answer different questions and
    deserve different answers: failing THIS one means the row is in another tenant, which is a
    404 — its existence is not yours to learn. Failing that one means the row is in your org but
    not on your brands, which is a 403 you are allowed to see.
    """
    return recipe.organization_id == organization_id


def _may_see_recipe(session: Session, user: User, recipe: Recipe) -> bool:
    """The canonical WITHIN-ORG recipe visibility rule, in one place.

    Mirrors the access branch of `RecipeService._build_list_query` exactly. The two must agree: a
    recipe you cannot find in the list must not be reachable by id, which is precisely the hole
    every by-id route had.

    **Assumes :func:`_in_org` has already passed** — every caller here checks it first and 404s.
    That ordering is load-bearing rather than stylistic: `is_public` returns True on its own, so
    were this reached for a foreign row it would hand it over. That was the live bug — `is_public`
    meant public to the INSTANCE, not to the org, so every tenant's public recipes were readable
    by everyone.

    Org Owners/Admins need no special case — Passport's ladder gives them Manager at every brand of
    their org, so `accessible_unit_ids` already covers them. An `is_org_admin` bypass here would
    not widen their access; it would only leak OTHER orgs, because the org-less form means "admin
    of any of your orgs".
    """
    if recipe.owner_id == user.id or recipe.is_public:
        return True

    visible_unit_ids = access.accessible_unit_ids(session, user.id)
    if not visible_unit_ids:
        return False

    served_here = session.exec(
        select(RecipeOutlet).where(
            RecipeOutlet.recipe_id == recipe.id,
            col(RecipeOutlet.unit_id).in_(visible_unit_ids),
            RecipeOutlet.is_active,
        )
    ).first()
    return served_here is not None


def require_recipe_access(
    recipe_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    org: OrgContext = Depends(get_org_context),
) -> Recipe:
    """The recipe, if the caller may see it. 404 if it does not exist, 403 if it is not theirs.

    Use on EVERY route under `/recipes/{recipe_id}` and on any child that hangs off a recipe.
    Reading a recipe's ingredients, costs, instructions, images or sub-recipe tree is reading the
    recipe.
    """
    recipe = session.get(Recipe, recipe_id)
    # A recipe in another org is reported exactly as a recipe that does not exist: same status,
    # same detail. Anything else confirms it exists to someone with no business knowing.
    if not recipe or not _in_org(recipe, org.organization_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Recipe not found",
        )

    if not _may_see_recipe(session, current_user, recipe):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to access this recipe",
        )

    return recipe


def require_recipe_access_or_tasting_participant(
    recipe_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    org: OrgContext = Depends(get_org_context),
) -> Recipe:
    """The recipe, if the caller may see it OR is tasting it.

    `GET /recipes/tasting/{id}` declared "No access control - users can view recipe details while
    in a tasting session regardless of their normal recipe access level". The intent is real and
    worth keeping: a tasting session gathers people around a dish, and a guest chef invited to
    taste it holds no brand role. But "regardless of access level" was implemented as no check at
    all, so it returned any recipe's `instructions_raw` and `cost_price` to anyone with an id.

    So: the normal rule, OR the recipe is actually on a session you participate in. The exception
    is now scoped to the case it was written for, instead of being a hole shaped like one.
    """
    recipe = session.get(Recipe, recipe_id)
    # A recipe in another org is reported exactly as a recipe that does not exist: same status,
    # same detail. Anything else confirms it exists to someone with no business knowing.
    if not recipe or not _in_org(recipe, org.organization_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Recipe not found",
        )

    if _may_see_recipe(session, current_user, recipe):
        return recipe

    # On a session this user takes part in? Creator counts — they may not hold the brand role.
    my_sessions = select(TastingUser.tasting_session_id).where(
        TastingUser.user_id == current_user.id
    )
    tasting_it = session.exec(
        select(RecipeTasting).where(
            RecipeTasting.recipe_id == recipe_id,
            col(RecipeTasting.tasting_session_id).in_(
                select(TastingSession.id).where(
                    or_(
                        col(TastingSession.creator_id) == current_user.id,
                        col(TastingSession.id).in_(my_sessions),
                    )
                )
            ),
        )
    ).first()

    if not tasting_it:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to access this recipe",
        )

    return recipe


def _may_reach_session(session: Session, user: User, session_id: int | None) -> bool:
    """Whether ``user`` may reach the tasting session behind some child row.

    The predicate half of :func:`require_session_access`, for guards that resolve a session
    INDIRECTLY (a note, an image) and so cannot take `session_id` as a path parameter.
    """
    if session_id is None:
        return False
    tasting_session = session.get(TastingSession, session_id)
    if tasting_session is None:
        return False
    if access.admins_row(session, user.id, tasting_session.organization_id):
        return True
    if tasting_session.creator_id == user.id:
        return True
    return (
        session.exec(
            select(TastingUser).where(
                TastingUser.tasting_session_id == session_id,
                TastingUser.user_id == user.id,
            )
        ).first()
        is not None
    )


def _session_id_of_note(session: Session, image: TastingNoteImage) -> int | None:
    """The tasting session an image hangs off, via whichever note owns it.

    An image belongs to a recipe note OR an ingredient note — both carry `session_id`, and both
    columns on the image are nullable, so which one is set decides the chain.
    """
    if image.tasting_note_id is not None:
        note = session.get(TastingNote, image.tasting_note_id)
        return note.session_id if note else None
    if image.ingredient_tasting_note_id is not None:
        note = session.get(IngredientTastingNote, image.ingredient_tasting_note_id)
        return note.session_id if note else None
    return None


def require_note_image_access(
    image_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> TastingNoteImage:
    """The image, if the caller may reach the session it hangs off.

    `DELETE /tasting-note-images/{image_id}` resolved no user at all: a bare integer destroyed a
    row AND the storage object behind it, for any account, on anyone's tasting session. An image
    is somebody's photo of somebody else's dish.

    An image orphaned from both note types is unreachable — nothing places it in a session, so
    nobody can prove they may have it.
    """
    image = session.get(TastingNoteImage, image_id)
    if not image:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Image not found",
        )

    if not _may_reach_session(session, current_user, _session_id_of_note(session, image)):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Image not found",
        )

    return image


def require_tasting_note_access(
    tasting_note_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> TastingNote:
    """A recipe tasting note, if the caller may reach its session."""
    note = session.get(TastingNote, tasting_note_id)
    if not note:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tasting note not found",
        )
    if not _may_reach_session(session, current_user, note.session_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tasting note not found",
        )
    return note


def require_ingredient_note_access(
    ingredient_tasting_note_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> IngredientTastingNote:
    """An ingredient tasting note, if the caller may reach its session."""
    note = session.get(IngredientTastingNote, ingredient_tasting_note_id)
    if not note:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tasting note not found",
        )
    if not _may_reach_session(session, current_user, note.session_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tasting note not found",
        )
    return note


def require_session_access(
    session_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> TastingSession:
    """The tasting session, if the caller may see it. 404 if absent, 403 if not theirs.

    CLAUDE.md's domain invariant: "non-admin users can only access sessions they participate in
    (403 otherwise); admins bypass". That was enforced in `tastings.py` and NOWHERE else, so every
    note, image and per-recipe route hanging off a session was reachable by id from any account.

    Semantics are copied from `tastings.py::_check_session_access` on purpose — same 403, same
    admin bypass, same participant rule. A guard that disagreed with the module it is generalising
    would just be a second, competing answer.

    The admin bypass is scoped to the SESSION's own org via `access.admins_row`. The org-less
    `is_org_admin` would mean "admin of any of your orgs", so an Owner of org B could read org A's
    sessions. A session hangs off no unit, so its `organization_id` is the only thing to scope by;
    while that is still NULL (pre-backfill) `admins_row` falls back to the org-less question rather
    than silently revoking the documented bypass.
    """
    tasting_session = session.get(TastingSession, session_id)
    if not tasting_session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tasting session not found",
        )

    if access.admins_row(session, current_user.id, tasting_session.organization_id):
        return tasting_session
    if tasting_session.creator_id == current_user.id:
        return tasting_session

    participates = session.exec(
        select(TastingUser).where(
            TastingUser.tasting_session_id == session_id,
            TastingUser.user_id == current_user.id,
        )
    ).first()
    if not participates:
        # "Only session participants..." rather than `_check_session_access`'s bare "Access
        # denied": the guard runs as a dependency, so it fires BEFORE any message the route had,
        # and two routes had a better one. A guard that generalises a check should not make the
        # error worse than the check it replaces.
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only session participants can access this session",
        )

    return tasting_session


# --- Menu-sketch family ---------------------------------------------------------------
#
# The sketch itself is org-scoped by `MenuSketchService`, which carries the acting org. Its
# children resolve their OWN ids and never reach that service, so a guessed integer walked past
# the parent's scoping entirely: 11 routes that authorised nothing.
#
# The chain is comment -> item -> section -> sketch -> org, and every link has to be followed. A
# guard on the sketch alone leaves the comment routes open, because a comment id never mentions a
# sketch. Each guard below resolves exactly one link and delegates the rest upward, so the org test
# lives in ONE place (`_sketch_in_org`) rather than four.


def _sketch_in_org(session: Session, sketch_id: int, organization_id: str) -> MenuSketch | None:
    """The sketch, if it belongs to the acting org. Mirrors `MenuSketchService.get_sketch`."""
    return session.exec(
        select(MenuSketch).where(
            MenuSketch.id == sketch_id,
            org_scope(MenuSketch, organization_id),
        )
    ).first()


def _sketch_not_found() -> HTTPException:
    """404 for every failure in this family — missing, or another org's.

    Same status and same detail either way: a sketch in another tenant must be indistinguishable
    from one that does not exist.
    """
    return HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="Menu sketch not found",
    )


def require_sketch_access(
    menu_sketch_id: int,
    session: Session = Depends(get_session),
    org: OrgContext = Depends(get_org_context),
) -> MenuSketch:
    """The sketch named by a `menu_sketch_id` path/query parameter, if it is in the acting org."""
    sketch = _sketch_in_org(session, menu_sketch_id, org.organization_id)
    if sketch is None:
        raise _sketch_not_found()
    return sketch


def require_section_access(
    section_id: int,
    session: Session = Depends(get_session),
    org: OrgContext = Depends(get_org_context),
) -> MenuSketchSection:
    """The section, if its sketch is in the acting org."""
    section = session.get(MenuSketchSection, section_id)
    if section is None or _sketch_in_org(session, section.menu_sketch_id, org.organization_id) is None:
        raise _sketch_not_found()
    return section


def require_sketch_item_access(
    item_id: int,
    session: Session = Depends(get_session),
    org: OrgContext = Depends(get_org_context),
) -> MenuSketchSectionItem:
    """The item, if its section's sketch is in the acting org."""
    item = session.get(MenuSketchSectionItem, item_id)
    if item is None:
        raise _sketch_not_found()
    section = session.get(MenuSketchSection, item.menu_sketch_section_id)
    if section is None or _sketch_in_org(session, section.menu_sketch_id, org.organization_id) is None:
        raise _sketch_not_found()
    return item


def require_sketch_comment_access(
    comment_id: int,
    session: Session = Depends(get_session),
    org: OrgContext = Depends(get_org_context),
) -> MenuSketchSectionItemComment:
    """The comment, if its item's section's sketch is in the acting org — the full chain."""
    comment = session.get(MenuSketchSectionItemComment, comment_id)
    if comment is None:
        raise _sketch_not_found()
    item = session.get(MenuSketchSectionItem, comment.menu_sketch_section_item_id)
    if item is None:
        raise _sketch_not_found()
    section = session.get(MenuSketchSection, item.menu_sketch_section_id)
    if section is None or _sketch_in_org(session, section.menu_sketch_id, org.organization_id) is None:
        raise _sketch_not_found()
    return comment


def sketch_reachable(session: Session, sketch_id: int, organization_id: str) -> bool:
    """Predicate form, for routes that take the parent id in the REQUEST BODY.

    A body-supplied parent id is not a path parameter, so no dependency can resolve it — the route
    has to ask. This is the shape that hid an IDOR inside `tasting-note-images/sync/*`: ids arriving
    in the body and being trusted because the route "had a guard".
    """
    return _sketch_in_org(session, sketch_id, organization_id) is not None


def section_reachable(session: Session, section_id: int, organization_id: str) -> bool:
    """Predicate form for a body-supplied `menu_sketch_section_id` — see `sketch_reachable`."""
    section = session.get(MenuSketchSection, section_id)
    if section is None:
        return False
    return _sketch_in_org(session, section.menu_sketch_id, organization_id) is not None


def sketch_item_reachable(session: Session, item_id: int, organization_id: str) -> bool:
    """Predicate form for a body-supplied `menu_sketch_section_item_id` — see `sketch_reachable`."""
    item = session.get(MenuSketchSectionItem, item_id)
    if item is None:
        return False
    return section_reachable(session, item.menu_sketch_section_id, organization_id)


def require_recipe_image_access(
    image_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    org: OrgContext = Depends(get_org_context),
) -> RecipeImage:
    """The image, if the caller may reach the recipe it hangs off.

    `DELETE /recipe-images/{image_id}` took a bare integer and removed any recipe's image — the
    same shape as `tasting-note-images` before v0.0.65. The recipe's own image LIST was guarded;
    the image's id was not, so the by-id route was looser than the list it belonged to.

    404 for a recipe in another org, 403 for one in your org but outside your brands — the same
    split as `require_recipe_access`, since this is that question asked one hop away.
    """
    image = session.get(RecipeImage, image_id)
    if image is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Image not found")

    recipe = session.get(Recipe, image.recipe_id)
    if recipe is None or not _in_org(recipe, org.organization_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Image not found")

    if not _may_see_recipe(session, current_user, recipe):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to access this recipe",
        )
    return image


def visible_recipe_ids(
    session: Session, user: User, organization_id: str, recipe_ids: list[int]
) -> set[int]:
    """Of ``recipe_ids``, the ones the caller may actually see.

    For BATCH routes, whose ids arrive in the request body where no dependency can reach them. The
    route must filter, and this is the filter — the same rule `require_recipe_access` applies, asked
    about many ids at once.

    Answering for an id you cannot see is a leak even when the answer is a bare `False`: it confirms
    the recipe exists. `POST /recipes/sub-recipes/batch` returned exactly that, and
    `POST /recipes/allergens/batch` returned the allergen list itself.

    Ids that do not survive are simply absent from the result, which is the batch equivalent of a
    404: the caller cannot tell "not yours" from "not there".
    """
    if not recipe_ids:
        return set()

    rows = session.exec(
        select(Recipe).where(
            col(Recipe.id).in_(recipe_ids),
            Recipe.organization_id == organization_id,
        )
    ).all()
    return {r.id for r in rows if _may_see_recipe(session, user, r)}


def ingredient_reachable(session: Session, ingredient_id: int, organization_id: str) -> bool:
    """Whether the ingredient belongs to the acting org.

    Predicate form, for routes that hang off an ingredient id but do not want the row itself.
    """
    ingredient = session.get(Ingredient, ingredient_id)
    return ingredient is not None and ingredient.organization_id == organization_id
