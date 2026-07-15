# Preliminary naming collision scan

**Scan date:** 14 July 2026  
**Purpose:** remove obviously crowded engineering names before repositories, package scopes, domains, and product assets are created.

This is a **preliminary public-name scan**, not trademark clearance. A usable public brand still requires searches across UKIPO, EUIPO, USPTO and target-country registers; Companies House and equivalent company registers; domains; npm, crates.io, PyPI, Homebrew, Winget, Chocolatey and app stores; social handles; product-search results; and relevant common-law uses. Legal counsel should review the selected final mark.

## Decisions

| Candidate | Preliminary result | Decision |
|---|---|---|
| **Voquill** | Exact public GitHub organisation/repository and multiple exact-name repositories exist. | **Reject.** Do not use as product, package, repository, executable, protocol or company name. |
| **SceneWeave / SceneWeaver** | Exact and near-exact public GitHub repositories are crowded. | **Reject as the primary Studio name.** |
| **Glyphloom** | Not retained. It is descriptive enough to be collision-prone and would separate design from the unified design/video product. | **Retire from the canonical architecture.** |
| **Reelwright** | Not retained because the product is no longer a standalone video editor. | **Retire from the canonical architecture.** |
| **Toolshape** | No exact-name GitHub repository was returned by the preliminary scan used for this handover. | **Provisional umbrella engineering name only.** |
| **Toolshape Voice** | No exact-name result was found in the preliminary public scan used for this handover. | **Provisional module name.** |
| **Toolshape Studio** | No exact-name result was found in the preliminary public scan used for this handover. | **Provisional module name.** |

Absence from one search is not evidence of legal availability. The names remain placeholders until the full checklist below is completed.

## Required clearance workflow

1. Define the intended goods/services and likely Nice classes.
2. Search exact, phonetic, visual and conceptually similar marks in UKIPO, EUIPO and USPTO.
3. Search Companies House and equivalent target-market company registers.
4. Search exact and near-exact names across GitHub, GitLab, npm, PyPI, crates.io, package managers and app stores.
5. Search `.com`, `.ai`, `.app`, `.dev`, `.io`, country domains and common typo domains.
6. Search general web, social platforms, Product Hunt, Hacker News, Reddit and software directories.
7. Review linguistic meaning and pronunciation in intended launch languages.
8. Check whether the name can support a clear wordmark, icon, CLI command and package scope.
9. Run legal review before public announcement or paid acquisition.
10. Reserve repositories, domains, package scopes and social handles together after approval.

## Naming architecture

Keep the technical contracts brand-neutral even after final naming:

```text
ANAC capability IDs       studio.timeline.split_clip
                          voice.session.start

Protocol/resource URIs    app://projects/{id}
                          secret://handles/{id}

Public display labels     <final brand> Voice
                          <final brand> Studio
```

This prevents a later rename from breaking stored workflows, manifests, schemas or third-party integrations.

## Evidence log

The scan used GitHub repository-name search and public exact-name web searches on 14 July 2026. The rejected-name evidence should be archived with the naming decision issue when the implementation repository is created. Re-run the scan immediately before repository creation and again before public launch.
