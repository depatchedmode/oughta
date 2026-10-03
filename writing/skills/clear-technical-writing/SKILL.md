---
name: clear-technical-writing
description: Draft, revise, or review technical documentation, explanations, and procedures for clear, accurate English. Use when reader understanding or unambiguous instructions matter; preserve the requested voice and genre.
---

# Clear technical writing

Make the reader's task easier without changing what the text claims. Use clarity practices inspired by [ASD-STE100 Simplified Technical English](https://www.asd-ste100.org/about_STE.html), adapted to the reader and genre. This skill does not establish formal STE compliance or ASD endorsement.

## Establish the task

- Identify the reader, what they need to understand or do, and their likely technical knowledge. Infer these from the request and surrounding material; ask only when the answer would materially change the writing.
- Keep the requested voice, genre, length, and format. A conversational explanation can remain conversational; a procedure needs precise actions and sequence. Do not impose a controlled vocabulary on every kind of prose.
- For a revision, use the source as the baseline for meaning. For a new draft, ground factual claims in the supplied evidence or appropriate primary sources. Flag missing facts rather than inventing them.

## Draft or revise

- Lead with the result, decision, or action the reader needs. Add context where it helps the reader use that information.
- Make actors and actions explicit when known: who does what, to which object, and under which conditions. Prefer direct verbs to abstract nouns. Keep passive voice when the actor is unknown or the result matters more; do not invent an actor to make a sentence active.
- Give each sentence a clear focus. Split tangled clauses when that improves comprehension, but keep conditions, exceptions, and causes attached to the claims they qualify. Do not enforce a word-count limit or turn connected prose into choppy fragments.
- Use a consistent term for each concept. Preserve necessary technical terms, identifiers, UI labels, units, and domain distinctions; explain unfamiliar terms at first use when the reader needs it. Do not substitute a simpler word that changes the concept.
- Replace ambiguous pronouns and vague quantities with concrete references when the source supports them. If the source does not identify what "it" means or how long "soon" is, flag the ambiguity instead of guessing.
- For procedures, state prerequisites before dependent actions, use ordered steps, and give each step a clear action. Put warnings before the action they govern. Include expected results or recovery actions only when supported by the source.
- Remove filler, repeated conclusions, and ornamental wording. Preserve useful examples, transitions, and the author's voice. Use lists or tables when the information is easier to act on or compare in that form.

## Check meaning before delivery

Compare the result with the source or drafting evidence. Check:

- **Claims and uncertainty:** Does "may" still mean "may"? Have observations become promises, correlation become causation, or estimates become exact values?
- **Requirements and scope:** Are obligations, permissions, prohibitions, negation, conditions, and exceptions intact? Preserve distinctions such as "must", "should", and "can".
- **Technical details:** Are names, quantities, units, commands, code, links, and citations accurate? Do not silently edit code or quoted text as prose.
- **Procedure:** Are dependencies and step order intact? Can the reader tell which actor performs each action and when it is complete?
- **Voice and usability:** Does the result fit the requested genre, and can the intended reader understand or perform the task?

If the source is contradictory or materially ambiguous, identify the unresolved point. Do not conceal it with a smooth rewrite. For a review request, give concrete findings and suggested edits; for a drafting or editing request, return the requested text. Add a brief note only when an unresolved issue or substantive change needs the user's attention.

## Original examples

**Explicit action, preserved condition**

Before: "In the event that synchronization is unsuccessful, a retry can be initiated by the operator after verification of network availability."

After: "If synchronization fails, the operator can retry after checking that the network is available."

The condition and permission remain intact; the revision does not require a retry or promise success.

**Focused sentences, preserved caveat**

Before: "The cache, which retains responses for up to 10 minutes unless invalidated earlier by an update, may reduce request latency, although the measurements do not establish that it caused the improvement."

After: "The cache retains responses for up to 10 minutes unless an update invalidates them earlier. It may reduce request latency. The measurements do not establish that the cache caused the improvement."

Keep the retention limit, early invalidation, uncertainty, and limit on the causal claim.

## When prose needs help

If spatial relationships, branching behavior, or changing states remain hard to explain, briefly recommend a diagram, interactive example, or short demonstration. Say what it would clarify. Keep this proportionate to the request; do not expand a prose edit into a separate media project without authorization.

## Source and limits

[ASD's official site](https://asd-ste100.org/) provides the current standard and access information. Consult it when a user explicitly requires formal ASD-STE100 compliance; this skill alone is not a compliance check. Link to the official material rather than redistributing its specification or dictionary.

The inspiration is [Andrej Karpathy's post on technical communication](https://x.com/karpathy/status/2105819303471976479). The instructions and examples here are original guidance, not a reproduction of the standard.
