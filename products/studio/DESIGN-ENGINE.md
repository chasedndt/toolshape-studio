# Design engine

## Canonical scene operations

```text
node.create
node.update_properties
node.remove
node.reparent
node.reorder
node.group / node.ungroup
selection.align
selection.distribute
constraint.set
style.apply_token
component.create / component.instantiate / component.override
image.set_crop
image.add_adjustment
mask.set
artboard.create_variant
layout.reflow
text.replace
text.apply_style
binding.set
```

Agent plans use stable IDs and declarative property changes. UI drags are converted into the same operations at commit boundaries.

## Transform model

Use affine matrices for node transforms with explicit decomposition for inspector display:

```text
translation
rotation
scale
skew where supported
anchor/pivot
```

Keep parent/child coordinate spaces clear. Test matrix composition, inversion, hit testing, bounding boxes, and pixel snapping.

## Layout and constraints

Support progressively:

### V1

- absolute positioning;
- alignment and distribution;
- margins/guides/grids;
- pin left/right/top/bottom;
- fixed/hug/fill sizing;
- basic stack/row/column auto layout;
- text fit and overflow diagnostics.

### Later

- advanced constraint solving;
- responsive component rules;
- content-aware composition;
- complex wrap/flow;
- data visualisation layouts.

Agent-generated layouts produce explicit constraints where possible rather than one-time coordinates.

## Typography

Track:

- font family/file and licence;
- fallback stack;
- variable-font axes where supported;
- size, weight, style, line height, tracking;
- paragraph alignment, indents, lists, spacing;
- language/script and direction;
- text runs/spans;
- bounding/overflow state;
- glyph/font substitution warnings.

Pin fonts in deterministic render tests. A missing font is a blocking or declared fallback condition, never a silent substitution in final export.

## Images

Original image remains immutable. Store non-destructive operations:

```text
crop and focal point
mask
transform
adjustment stack
filter/effect stack
background/object edit result reference
colour profile metadata
```

Provider-backed smart edits create new assets with provenance and licence/retention metadata. They do not overwrite the original.

## Flat-image to editable-layer reconstruction

This is a strategic AI feature inspired by the broader need for editable AI output.

Pipeline:

```text
input image
→ OCR/text region detection
→ object/foreground/background segmentation
→ hierarchy/group inference
→ font/style approximation with confidence
→ layer reconstruction proposal
→ original-versus-reconstructed preview
→ operator correction
→ structured scene
```

Limitations must be visible. Do not promise exact recovery of unknown fonts, hidden objects, or original vector geometry.

## Templates and components

A template is a versioned project/scene with replaceable slots and constraints. A component has a source definition and instances with allowed overrides.

Agents should prefer component/token edits when the goal is consistent change across variants.

## Responsive variants

A variant retains lineage:

```text
source artboard revision
preset and constraints
agent operations
manual overrides
quality findings
```

When the source changes, Studio can propose rebase operations rather than overwrite variant-specific art direction.

## Data-driven creation

Bind text/image/colour/visibility/component properties to typed data fields. Validate each row, create previews, and report row-level failures without corrupting the whole batch.

## Headless rendering

The headless renderer must support the declared P0 node/effect set and return explicit unsupported-feature errors. Visual regression fixtures pin renderer, fonts, colour profile, dimensions, and scale.
