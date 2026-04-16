# Front Office Resources Module Brief

## Purpose

This document explains the intended role, practical use, and proposed future shape of the `Front Office / Resources` module at:

- `/agent/resources`

It is written as a product-facing brief for alignment with PM review.

---

## One-line Definition

`/agent/resources` should be the agent's `execution resource hub` inside Front Office:

- one place to quickly find the right playbook, template, document, training refresher, or vendor contact
- one place to support the next live action
- not a passive file archive
- not a broad public marketplace
- not the formal Back Office document system

---

## Why This Module Exists

The operational problem this module should solve is not “lack of content.”

The real problem is:

- agents lose time searching for the right script or template
- shared materials are scattered across chat, drive folders, local files, and memory
- vendor contacts are not packaged into the same workflow as the agent's next step
- agents often know they need help, but do not know which material or partner to open first
- managers cannot easily tell whether resources are actually being used

So this module exists to reduce execution drag:

- faster follow-up
- faster coordination
- better consistency
- fewer missed next steps
- easier reuse of the office's best materials

---

## Product Positioning

Inside Front Office, `Resources` should sit under:

- `Resources / Efficiency Tools`

Its role is to support active field execution, especially during:

- first contact
- follow-up
- objection handling
- appointment coordination
- showing preparation
- send preparation
- pre-handoff preparation before Back Office takes over

This means the module should behave more like a `workbench` than a `library browser`.

---

## What This Module Is

At product level, this module should be understood as a combination of:

1. `Execution material hub`
   - playbooks
   - scripts
   - templates
   - forms
   - reference docs
   - training refreshers

2. `Vendor action desk`
   - trusted outside partners
   - quick contact actions
   - category-based coverage
   - practical partner shortcuts tied to real tasks

3. `Lightweight usage signal layer`
   - what is being searched
   - what is being opened
   - what training is being completed
   - what vendor contacts are actually being used

4. `Execution guidance layer`
   - help the agent decide what to open first
   - keep materials organized by the job to be done
   - keep the hub compact and operational instead of turning into a dumping ground

---

## What This Module Is Not

To avoid product confusion, this module should explicitly **not** be treated as:

- the Back Office company document repository
- the legal or compliance source of truth
- a generic shared drive mirror
- a vendor marketplace with broad browsing and procurement behavior
- a training LMS
- a public resource center

Important boundary:

- `/office/library` is the internal Back Office document workspace
- `/agent/resources` should be the Front Office curated consumption layer

In other words:

- `office/library` = internal storage and management workspace
- `agent/resources` = execution-oriented delivery and action workspace

---

## Core Users

### Agent

Primary user.

The agent should use this module when they need to:

- find the right script fast
- pull a send-ready template
- open a supporting form or reference
- watch a short refresher before a live task
- contact a partner without leaving the execution flow

### Team Lead / Office Admin

Secondary user.

They should use this module to:

- verify the team has the right published materials
- understand whether the hub is actually being used
- see which materials and partner categories are hottest
- identify thin or missing coverage areas

### Content Owner / Operations

Publishing and curation role.

They should treat this module as the distribution surface for:

- office-approved playbooks
- templates
- refreshers
- vendor cards

They should not treat it as an unstructured upload bucket.

---

## Current Resource Types

Based on the current implementation, the module already supports these content types:

- `Playbook`
- `Template`
- `Document`
- `Training video`
- `Vendor card`

This taxonomy is strong because it matches real agent behavior:

- `Playbook` = what should I say or do
- `Template` = give me a structure I can personalize
- `Document` = I need the supporting file or reference
- `Training video` = refresh me quickly
- `Vendor card` = I need outside support now

---

## Current Page Structure

The current page structure is directionally correct and should remain the foundation:

### 1. Search

Purpose:

- fastest path when the agent already knows what they need

Expected behavior:

- search across playbooks, templates, documents, vendors, and tags
- return the shortest possible path to action
- keep search inside the hub instead of sending people into a filter-heavy archive

### 2. Browse by section

Purpose:

- help the agent start from the job, not from the file tree

Expected behavior:

- group materials by work type
- tell the user where to start
- prevent the “I know I need help but I don't know what to open” problem

### 3. Library by section

Purpose:

- present the published material set in a stable, compact, actionable format

Expected behavior:

- show only curated, published materials
- keep content practical and lightweight
- avoid turning the page into a second formal records system

### 4. Vendor desk

Purpose:

- let agents move from “I need a partner” to “take action now”

Expected behavior:

- ready-now partners at the top
- category coverage visible
- quick call/email/site actions
- use vendor cards as operational shortcuts, not passive directory entries

---

## Recommended Usage Instructions

This is the product-facing usage guidance I would expect for this module.

### For Agents

#### When to open this page

Use `Resources` when:

- you know the next move, but need the right support material
- you need a script, template, or form quickly
- you need a refresher before a live call or appointment
- the next step requires an outside partner

#### Best-practice usage flow

1. Start with `Search` if you already know the topic.
   - Example: staging checklist, viewing reminder, financing partner, intro script

2. Use `Browse by section` if you know the task but not the exact asset.
   - Example: “I need something for follow-up” or “I need a showing support document”

3. Open from `Library by section` when you want the curated published material.
   - This should be the stable office-approved set

4. Use `Vendor desk` when the next step is outside coordination.
   - Example: lender, attorney, inspection, repair, moving support

5. Log training progress only for real progress.
   - This should help the office understand training follow-through without creating LMS overhead

### For Team Leads / Admins

Use this page to check:

- which lane is well covered
- which lane is thin
- whether the team is using resources or ignoring them
- whether the vendor desk is actually “ready now” or still reference-only

### For Content Owners

Use the publishing workflow to ensure this page stays:

- curated
- practical
- current
- tied to real Front Office moments

Do not publish materials just because they exist.

The filter for inclusion should be:

- will this help an agent finish a live Front Office step faster or better?

---

## Ideal Target Experience

The best version of this module should feel like this:

### 1. Job-first, not file-first

Agents should not browse by abstract folder logic.

They should feel:

- “I need follow-up help”
- “I need a showing support asset”
- “I need a financing partner”
- “I need a quick refresher”

And the page should answer with the next best material or partner.

### 2. One click from need to action

The module should reduce the number of steps between:

- problem
- material
- action

Examples:

- find script -> open script
- find vendor -> call vendor
- find template -> copy and use template
- find refresher -> log progress after use

### 3. Curated, not bloated

This page should stay intentionally compact.

That means:

- fewer but better materials
- clear publishing standards
- visible freshness
- no dumping of raw documents

### 4. Vendor desk should feel operational

Vendor cards should not just show names.

They should answer:

- who is ready now
- what category they support
- how to contact them immediately
- what area they cover
- whether they are a shared go-to

### 5. Lightweight analytics, not a separate analytics product

The usage signal layer should support management decisions without creating a second reporting module.

The right level is:

- which lane is being used
- which materials are hot
- which partner categories are active
- whether usage is search-led, vendor-led, training-led, or balanced

The wrong level is:

- building a heavy BI dashboard inside the resource module

---

## Proposed Future Functionality

Below is the direction I believe fits both the current product intent and the existing implementation foundation.

### A. Stronger execution lanes

Add clearer task-oriented lane framing such as:

- first touch / intro
- follow-up recovery
- showing prep
- shortlist send support
- handoff prep
- partner coordination

Goal:

- let agents start from the real job they are trying to finish

### B. Better “recommended first open” behavior

For each lane, the module should better answer:

- what should the agent open first
- what should they open second
- when should they switch to a vendor action

Goal:

- turn the module from a shelf into a guided workbench

### C. Practical resource cards

Each resource card should ideally answer:

- what this is for
- when to use it
- what lane it supports
- how fresh it is
- the fastest action available

### D. Real vendor readiness model

Vendor desk should distinguish between:

- `Ready now`
- `Reference only`
- `Featured go-to`

Goal:

- let partner coverage become operationally meaningful, not just informational

### E. Better publishing and curation loop

The office should have a clean way to:

- publish FO-specific playbooks
- mark items as curated
- retire stale assets
- manage vendor cards separately from pure library files
- distinguish curated FO delivery from broad BO file storage

This is the biggest product gap today.

### F. Deeper FO cross-entry points

Over time, this module should be reachable directly from:

- dashboard pressure cards
- client dossier context
- listings send lane
- notifications / cleanup center

Goal:

- resources should appear as contextual help, not only as a standalone destination

### G. Shared adoption pulse for leads/admins

Leadership users should be able to see:

- top actors
- hottest targets
- lane strength
- trend vs prior period

But still inside a light workbench surface.

---

## Desired UX Principles

The module should feel:

- fast
- clear
- compact
- curated
- action-oriented

It should not feel:

- archival
- academic
- training-heavy
- cluttered
- marketplace-like

The ideal emotional response from an agent is:

- “I know exactly where to go”
- “I found the right thing fast”
- “I can act immediately”

---

## Current Reality vs Target

### What already aligns well

- the page is already framed as a resource hub plus vendor desk
- search is already part of the model
- the content taxonomy is strong
- the vendor concept is already integrated
- interaction tracking already exists
- the module already has the right high-level direction

### What is still incomplete

- the current page can still feel empty when published content is thin
- the publishing / operating loop is not yet clearly separated from the Back Office library model
- the practical “recommended first move” behavior is still lighter than it should be
- the current page shell is ahead of the actual content operations maturity
- the management signal layer exists in data but should become more visibly useful

### Biggest product risk

If this module is treated as “just another document page,” it will lose its value.

Its value depends on staying:

- Front Office-specific
- task-oriented
- curated
- tied to live execution

---

## PM Alignment Questions

To confirm that this interpretation matches product intent, I would want PM review on the following:

1. Should `Resources` be explicitly positioned as a `Front Office execution hub`, rather than a generic resource list?
2. Should `Vendor desk` remain part of the same module, or should vendors eventually become a separate FO workspace?
3. Should `/agent/resources` be a curated delivery layer distinct from `/office/library`, rather than a simple mirror of it?
4. Should the page optimize for `fast next action` over `deep browsing`?
5. Should management-facing usage signals stay lightweight inside this module, instead of becoming a separate analytics tool?
6. Should we prioritize stronger `lane / scenario / recommended-first-open` behavior before adding more raw content volume?
7. Should FO resource publishing eventually have its own explicit curation workflow, even if files continue to live in the broader office library infrastructure?

---

## Proposed Product Summary

If I had to summarize the intended product in a few lines for PM sign-off, I would describe it like this:

`Front Office / Resources` should be the agent's execution support hub.

It helps agents quickly find the right script, template, document, refresher, or vendor contact for the next live action.

It should feel like a curated workbench, not a passive library.

Its job is to shorten the time from “I need support” to “I can act now,” while giving leads and admins a lightweight signal on whether the office's shared materials are actually being used.
