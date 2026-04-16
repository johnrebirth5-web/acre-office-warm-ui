# Front Office Resources Module Brief

## Purpose

This document captures the current PM-aligned positioning for:

- `/agent/resources`
- `/office/resources`

It replaces the earlier “execution hub” framing with the simpler directory model that Product approved.

## One-line Definition

`/agent/resources` is a passive agent-facing directory with internal tabs for documents, vendors, and YouTube training.

Its main job is to help agents search, browse, and open the materials they already know they need, while keeping PDF-style resources, partner contacts, and video refreshers separated by tab inside one screen.

It is not:

- a task-guidance system
- a next-action engine
- a workflow recommender
- a vendor marketplace
- the Back Office source-of-truth document system

## Core Product Position

The primary use case is straightforward:

1. an agent needs a file or vendor contact
2. the agent opens `Resources`
3. the agent searches for it
4. the agent opens it

This means the product should optimize for:

- search first
- simple browsing second
- low cognitive load
- stable directory behavior

This means the product should not optimize for:

- guessing the agent’s current task
- telling the agent what to do next
- building scenario- or lane-based navigation
- creating heavy analytics or training workflows

## Expected Usage Mix

Product guidance for current use:

- `Search`: roughly `80%`
- `Browse by type / section`: roughly `5%`
- `Library-style browsing of all approved materials`: roughly `5%`
- `Vendor lookup`: direct, manual lookup when needed
- `Training`: stays in its own simple searchable tab inside Resources; entries use direct YouTube links

## Agent Experience

The resources page should feel like a clean directory:

- a strong search entry at the top
- segmented tabs below search
- a `Documents` tab for PDFs, templates, and playbooks
- a `Vendors` tab for partner lookup
- a `Training` / `Video Academy` tab for YouTube videos
- no YouTube training mixed into the document list
- no execution-deck language
- no “recommended next step”
- no “open this first”

The important experience is:

- “I know what I need”
- “I can find it quickly”
- “I can open it immediately”

## Vendor Positioning

Vendor support stays inside the module, but in a lightweight way.

It should behave like a searchable vendor pool:

- category
- name
- short description
- contact links
- optional featured flag

It should not behave like a context-aware routing system.

The system does not need to decide whether the user’s next step is vendor-related. The agent can decide that and search or browse manually.

## Office Admin Positioning

`/office/resources` is the management side of this directory and includes internal tabs for `Documents`, `Vendors`, and `Training`.

It should be:

- office-admin only
- PDF upload and simple CRUD for documents
- training videos managed in the `Training` tab, using direct YouTube links
- simple CRUD for vendors
- all content published here is shared across every company / office in the organization; there is no per-company resources split
- no approval flow
- no draft-first workflow in the admin UI; new records should publish directly into the agent-facing directory
- no complex curation logic

The office admin is the single owner of directory content.

## Relationship to `/office/library`

The boundary should stay explicit:

- `/office/library` = Back Office internal document library
- `/agent/resources` = the single agent-facing directory route, with separate tabs for documents, vendors, and YouTube training
- `/office/resources` = the single office-admin management route, with separate tabs for `Documents`, `Vendors`, and `Training`

`/agent/resources` should not simply be treated as a workflow hub layered on top of `/office/library`.

It should simply display the materials that admins make available to agents.

## Minimal Analytics

The module should only expose very lightweight management signals.

The two most useful signals are:

- which resources are opened the most
- which resources have not been opened for months

That is enough to support cleanup and maintenance.

This module does not need a full analytics product surface.

## Current Product Rule Set

When implementing this module, default to these rules:

- `Search` is the primary entry point
- tab switching and type browsing are secondary
- vendor browsing is manual, not recommended
- training is its own tab inside Resources, not just another row inside the document list
- each tab should stay lightweight with paginated results instead of one very long directory column
- only office admins manage content
- all published resources, vendors, and training entries are shared across all companies in the same organization
- agent-facing experience should stay simple
- do not introduce task guidance, next-action logic, or scenario routing

## Summary

`Front Office / Resources` should behave like a reliable, searchable directory for agents.

Its value is not in telling agents what to do.

Its value is in making sure that when an agent already knows they need a file, template, playbook, training item, or vendor contact, they can find it quickly and open it with minimal friction.
The training tab should feel separate:

- only YouTube training videos
- simple search by topic
- show thumbnail-grid browsing with page controls instead of document-style rows
- keep the list lightweight with 12 videos per page
- open a single on-demand full-screen player inside the page instead of preloading many embeds
- no PDFs or vendor cards mixed in
